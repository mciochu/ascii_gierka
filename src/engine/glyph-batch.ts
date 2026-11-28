import {
  Buffer,
  BufferImageSource,
  BufferUsage,
  Container,
  Geometry,
  Mesh,
  Shader,
  Texture
} from "pixi.js";
import {
  EDGE_GLYPHS,
  GLYPH_ATLAS_CHARS,
  LUMINANCE_RAMP,
  SPECIAL_GLYPHS,
  MICRO_GLYPH_CELL,
  getZoomProfile,
  microGlyphActiveSize,
  rasterizeMicroGlyph,
  screenSpaceGlyphMinimum,
  type GlyphDensity
} from "./effulgence";
import {
  GlyphDisplay,
  type GlyphMaterialKind,
  type GlyphInstanceRecord
} from "./glyph";

const ATLAS_COLUMNS = 16;
const ATLAS_ROWS = 32;
const ATLAS_CELL_WIDTH = 6;
const ATLAS_CELL_HEIGHT = 8;
const BASE_GLYPH_BANKS = 3;
const BASE_GLYPH_SLOTS = GLYPH_ATLAS_CHARS.length * BASE_GLYPH_BANKS;
const DENSITY_BANKS: readonly GlyphDensity[] = ["small", "medium", "large"];
const RASTER_SCALE = 8;
const ATLAS_WIDTH = ATLAS_COLUMNS * ATLAS_CELL_WIDTH;
const ATLAS_HEIGHT = ATLAS_ROWS * ATLAS_CELL_HEIGHT;
const ATLAS_CAPACITY = ATLAS_COLUMNS * ATLAS_ROWS;

const INSTANCE_FLOATS = 28;
const INSTANCE_STRIDE_BYTES = INSTANCE_FLOATS * 4;
const INITIAL_INSTANCE_CAPACITY = 4096;

const MATERIAL_IDS: Record<GlyphMaterialKind, number> = {
  terrain: 0,
  building: 1,
  unit: 2,
  selection: 3,
  vfx: 3,
  utility: 0,
  overview: 4
};

const QUAD_VERTEX = new Float32Array([
  -0.5, -0.5,
  0.5, -0.5,
  0.5, 0.5,
  -0.5, 0.5
]);
const QUAD_UV = new Float32Array([
  0, 0,
  1, 0,
  1, 1,
  0, 1
]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);

const INSTANCE_VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
in vec4 aInstanceRect;
in vec4 aInstanceUV;
in vec4 aInstanceTint;
in vec4 aInstanceMeta;
in vec4 aInstanceId;
in vec4 aInstanceNormal;
in vec4 aInstanceEmission;

out vec2 vUV;
out vec4 vTint;
out vec4 vMeta;
flat out uvec4 vEntityId;
out vec4 vNormal;
out vec4 vEmission;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  vec2 point = aPosition * aInstanceRect.zw;
  float c = aInstanceMeta.x;
  float s = aInstanceMeta.y;
  point = mat2(c, s, -s, c) * point;
  point += aInstanceRect.xy;

  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(point, 1.0)).xy, 0.0, 1.0);

  vUV = mix(aInstanceUV.xy, aInstanceUV.zw, aUV);
  vTint = aInstanceTint;
  vMeta = aInstanceMeta;
  vEntityId = uvec4(round(aInstanceId));
  vNormal = aInstanceNormal;
  vEmission = aInstanceEmission;
}
`;

const GBUFFER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUV;
in vec4 vTint;
in vec4 vMeta;
flat in uvec4 vEntityId;
in vec4 vNormal;
in vec4 vEmission;

uniform sampler2D uGlyphAtlas;

layout(location = 0) out vec4 outAlbedo;
layout(location = 1) out vec4 outNormalHeight;
layout(location = 2) out vec4 outEmissive;
layout(location = 3) out highp uvec4 outEntityID;

void main() {
  float mask = texture(uGlyphAtlas, vUV).r;
  if (mask < 0.5 || vTint.a < 0.002) discard;

  float coverage = clamp(mask * vTint.a, 0.0, 1.0);
  vec3 albedo = vTint.rgb;
  vec3 normal = normalize(vNormal.xyz);

  outAlbedo = vec4(albedo * coverage, coverage);
  outNormalHeight = vec4(normal * coverage, clamp(vMeta.z, 0.0, 1.0) * coverage);
  outEmissive = vec4(vEmission.rgb * max(vMeta.w, 0.0) * coverage, coverage);
  outEntityID = vEntityId;
}
`;

export interface GlyphBatchLayerInput {
  root: Container | null;
  material: GlyphMaterialKind;
  layerId: number;
}

export interface GlyphBatchRenderer {
  readonly atlasTexture: Texture;
  setRoots(roots: Array<Container | null> | null): void;
  update(): void;
  destroy(): void;
  stats(): { layers: number; instances: number; uniqueGlyphs: number; capacity: number };
  setView(zoom: number, pixelRatio: number, cellWidth: number, cellHeight: number, density: GlyphDensity): void;
}

interface AtlasData {
  pixels: Uint8Array;
  source: BufferImageSource;
  texture: Texture;
  lookup: Map<string, number>;
  nextSlot: number;
  dirtyStart: number;
  dirtyEnd: number;
  temporaryCanvas: HTMLCanvasElement;
  temporaryContext: CanvasRenderingContext2D;
  view: { zoom: number; pixelRatio: number; cellWidth: number; cellHeight: number; density: GlyphDensity };
}

interface Transform2D {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  visible: boolean;
}

interface LayerBatch {
  input: GlyphBatchLayerInput;
  buffer: Buffer;
  geometry: Geometry;
  mesh: Mesh<Geometry, Shader>;
  data: Float32Array;
  capacity: number;
  count: number;
}

function createAtlas(): AtlasData {
  const pixels = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT);
  const source = new BufferImageSource({
    resource: pixels,
    width: ATLAS_WIDTH,
    height: ATLAS_HEIGHT,
    format: "r8unorm",
    scaleMode: "nearest",
    alphaMode: "no-premultiply-alpha"
  });
  const texture = new Texture({ source });
  const temporaryCanvas = document.createElement("canvas");
  temporaryCanvas.width = ATLAS_CELL_WIDTH * RASTER_SCALE;
  temporaryCanvas.height = ATLAS_CELL_HEIGHT * RASTER_SCALE;
  const temporaryContext = temporaryCanvas.getContext("2d", { willReadFrequently: true });
  if (!temporaryContext) throw new Error("Cannot create the Effulgence monochrome glyph rasterizer.");

  const atlas: AtlasData = {
    pixels, source, texture, lookup: new Map(), nextSlot: BASE_GLYPH_SLOTS,
    dirtyStart: Number.POSITIVE_INFINITY,
    dirtyEnd: 0,
    temporaryCanvas,
    temporaryContext,
    view: { zoom: 0.62, pixelRatio: 1, cellWidth: 5, cellHeight: 7, density: "medium" }
  };

  // Three fixed banks provide real 3×5, 4×6 and 5×7 1-bit variants.
  for (const [bank, density] of DENSITY_BANKS.entries()) {
    for (const [glyphIndex, character] of GLYPH_ATLAS_CHARS.entries()) {
      rasterizeGlyph(atlas, character, bank * GLYPH_ATLAS_CHARS.length + glyphIndex, "normal", density);
    }
  }
  flushAtlas(atlas);
  return atlas;
}

const MICRO_GLYPH_ALIASES: Record<string, string> = {
  "♞": "m", "♟": "█", "♙": "█", "⚑": "!", "♨": "*",
  "♜": "R", "⚔": "X", "✣": "+", "▤": "#", "▥": "#", "⚒": "T",
  "†": "+", "⚖": "=", "♧": "Y", "◆": "@", "◉": "@", "⌂": "^", "✝": "+", "✿": "*",
  "♣": "Y", "≈": "~", "▲": "^", "﹏": "=", "❧": "Y",
  "◌": "o", "◔": "o", "◈": "o", "◇": "o", "◩": "#",
  "╔": "+", "╗": "+", "╚": "+", "╝": "+", "╬": "+", "╧": "+",
  "━": "=", "═": "=", "─": "-", "╱": "/", "╲": "\\",
  "▧": "#", "⌜": "+",
  "Ł": "L", "Ą": "A", "Ę": "E", "Ó": "O", "Ś": "S", "Ć": "C", "Ż": "Z", "Ź": "Z", "Ń": "N",
  "ł": "l", "ą": "a", "ę": "e", "ó": "o", "ś": "s", "ć": "c", "ż": "z", "ź": "z", "ń": "n"
};

function drawHalfBlock(context: CanvasRenderingContext2D, character: string, density: GlyphDensity): boolean {
  const [activeColumns, activeRows] = microGlyphActiveSize(density);
  const width = activeColumns * RASTER_SCALE;
  const height = activeRows * RASTER_SCALE;
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const blocks: Record<string, [number, number, number, number]> = {
    "█": [0, 0, width, height], "▀": [0, 0, width, halfHeight], "▄": [0, halfHeight, width, height - halfHeight],
    "▌": [0, 0, halfWidth, height], "▐": [halfWidth, 0, width - halfWidth, height],
    "▖": [0, halfHeight, halfWidth, height - halfHeight], "▗": [halfWidth, halfHeight, width - halfWidth, height - halfHeight],
    "▘": [0, 0, halfWidth, halfHeight], "▝": [halfWidth, 0, width - halfWidth, halfHeight]
  };
  const block = blocks[character];
  if (!block) return false;
  context.fillRect(block[0], block[1], block[2], block[3]);
  return true;
}

function rasterizeGlyph(
  atlas: AtlasData,
  character: string,
  index: number,
  weight: "normal" | "bold",
  density: GlyphDensity
): void {
  const context = atlas.temporaryContext;
  context.clearRect(0, 0, atlas.temporaryCanvas.width, atlas.temporaryCanvas.height);
  context.fillStyle = "#ffffff";
  context.save();
  const [activeColumns, activeRows] = microGlyphActiveSize(density);
  context.beginPath();
  context.rect(0, 0, activeColumns * RASTER_SCALE, activeRows * RASTER_SCALE);
  context.clip();
  const displayCharacter = MICRO_GLYPH_ALIASES[character] ?? character;
  const isBlock = drawHalfBlock(context, character, density);
  if (!isBlock && displayCharacter !== " ") {
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = (weight === "bold" ? "700 " : "500 ") +
      '50px "JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Consolas, monospace';
    context.fillText(
      displayCharacter,
      activeColumns * RASTER_SCALE / 2,
      activeRows * RASTER_SCALE / 2
    );
  }
  context.restore();

  const image = context.getImageData(0, 0, atlas.temporaryCanvas.width, atlas.temporaryCanvas.height);
  const alpha = new Uint8Array(atlas.temporaryCanvas.width * atlas.temporaryCanvas.height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = image.data[i * 4 + 3] ?? 0;
  const micro = rasterizeMicroGlyph(alpha, atlas.temporaryCanvas.width, atlas.temporaryCanvas.height, 160, density);

  const column = index % ATLAS_COLUMNS;
  const row = Math.floor(index / ATLAS_COLUMNS);
  const atlasX = column * ATLAS_CELL_WIDTH;
  const atlasY = row * ATLAS_CELL_HEIGHT;
  for (let y = 0; y < ATLAS_CELL_HEIGHT; y += 1) {
    for (let x = 0; x < ATLAS_CELL_WIDTH; x += 1) {
      atlas.pixels[(atlasY + y) * ATLAS_WIDTH + atlasX + x] = micro[y * ATLAS_CELL_WIDTH + x] ?? 0;
    }
  }

  atlas.dirtyStart = Math.min(atlas.dirtyStart, index * ATLAS_CELL_WIDTH * ATLAS_CELL_HEIGHT);
  atlas.dirtyEnd = Math.max(atlas.dirtyEnd, (index + 1) * ATLAS_CELL_WIDTH * ATLAS_CELL_HEIGHT);
}

function flushAtlas(atlas: AtlasData): void {
  if (!Number.isFinite(atlas.dirtyStart) || atlas.dirtyEnd <= atlas.dirtyStart) return;
  // Atlas slots are two-dimensional tiles, not a contiguous row-major span.
  // Upload the full atlas only when new glyphs were rasterized (rare event).
  atlas.source.update();
  atlas.dirtyStart = Number.POSITIVE_INFINITY;
  atlas.dirtyEnd = 0;
}

function atlasSlot(atlas: AtlasData, character: string, weight: "normal" | "bold"): number {
  const densityBank = DENSITY_BANKS.indexOf(atlas.view.density);
  const baseIndex = GLYPH_ATLAS_CHARS.indexOf(character as (typeof GLYPH_ATLAS_CHARS)[number]);
  if (weight === "normal" && baseIndex >= 0) {
    return Math.max(0, densityBank) * GLYPH_ATLAS_CHARS.length + baseIndex;
  }

  const key = atlas.view.density + ":" + weight + ":" + character;
  const existing = atlas.lookup.get(key);
  if (existing !== undefined) return existing;

  if (atlas.nextSlot >= ATLAS_CAPACITY) {
    return Math.max(0, densityBank) * GLYPH_ATLAS_CHARS.length + 8;
  }
  const slot = atlas.nextSlot++;
  atlas.lookup.set(key, slot);
  rasterizeGlyph(atlas, character, slot, weight, atlas.view.density);
  return slot;
}

function colorChannels(color: string): [number, number, number] {
  const normalized = color.startsWith("#") ? color.slice(1) : color;
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  const value = Number.parseInt(expanded, 16);
  if (!Number.isFinite(value)) return [0.66, 0.73, 0.6];
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  ];
}

function hashEntityId(value: string | number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value)) & 0xffffff;
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash & 0xffffff;
}

function materialDefaultHeight(material: GlyphMaterialKind): number {
  switch (material) {
    case "building": return 0.62;
    case "unit": return 0.24;
    case "selection": return 0.025;
    case "vfx": return 0.18;
    case "utility": return 0.02;
    default: return 0.06;
  }
}

function composeTransform(parent: Transform2D, node: Container): Transform2D {
  const cosine = Math.cos(parent.rotation);
  const sine = Math.sin(parent.rotation);
  const localX = node.position.x * parent.scaleX;
  const localY = node.position.y * parent.scaleY;
  return {
    x: parent.x + localX * cosine - localY * sine,
    y: parent.y + localX * sine + localY * cosine,
    scaleX: parent.scaleX * node.scale.x,
    scaleY: parent.scaleY * node.scale.y,
    rotation: parent.rotation + node.rotation,
    alpha: parent.alpha * node.alpha,
    visible: parent.visible && node.visible && node.renderable
  };
}

function instanceValues(
  atlas: AtlasData,
  layer: LayerBatch,
  record: GlyphInstanceRecord,
  transform: Transform2D,
  entityLabel: string | number,
  data: Float32Array,
  offset: number
): number {
  const material = record.material ?? layer.input.material;
  const materialId = MATERIAL_IDS[material] ?? MATERIAL_IDS[layer.input.material];
  const entityId = hashEntityId(record.entityId ?? entityLabel);
  const [red, green, blue] = colorChannels(record.color);
  const profile = getZoomProfile(atlas.view.zoom);
  if (record.lod) {
    const allowedTiers = Array.isArray(record.lod) ? record.lod : [record.lod];
    if (!allowedTiers.includes(profile.lodTier)) return offset;
  }
  const character = profile.lodTier === "strategic" && record.strategicGlyph
    ? record.strategicGlyph : record.character;
  const slot = atlasSlot(atlas, character, record.weight);
  const column = slot % ATLAS_COLUMNS;
  const row = Math.floor(slot / ATLAS_COLUMNS);
  const [activeWidth, activeHeight] = microGlyphActiveSize(atlas.view.density);

  const u0 = (column * ATLAS_CELL_WIDTH + 0.5) / ATLAS_WIDTH;
  const v0 = (row * ATLAS_CELL_HEIGHT + 0.5) / ATLAS_HEIGHT;
  const u1 = (column * ATLAS_CELL_WIDTH + activeWidth - 0.5) / ATLAS_WIDTH;
  const v1 = (row * ATLAS_CELL_HEIGHT + activeHeight - 0.5) / ATLAS_HEIGHT;

  const rotation = transform.rotation;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const baseX = transform.x + record.offsetX * transform.scaleX * cosine - record.offsetY * transform.scaleY * sine;
  const baseY = transform.y + record.offsetX * transform.scaleX * sine + record.offsetY * transform.scaleY * cosine;
  const unitBoost = material === "unit" ? profile.unitScale : 1;
  const rawWidth = Math.abs(record.size * 0.80 * transform.scaleX * unitBoost);
  const rawHeight = Math.abs(record.size * 1.15 * transform.scaleY * unitBoost);
  const minimum = record.minScreenCells
    ? screenSpaceGlyphMinimum(
        record.minScreenCells,
        atlas.view.cellWidth,
        atlas.view.cellHeight,
        atlas.view.pixelRatio,
        atlas.view.zoom
      )
    : [0, 0] as const;
  const width = Math.max(rawWidth, minimum[0]);
  const height = Math.max(rawHeight, minimum[1]);
  const alpha = Math.max(0, Math.min(1, transform.alpha));
  const materialLayerByte = materialId | (record.animated ? 128 : 0);
  const normal = record.normal;
  const heightValue = record.height >= 0 ? record.height : materialDefaultHeight(material);

  data[offset] = baseX;
  data[offset + 1] = baseY;
  data[offset + 2] = width;
  data[offset + 3] = height;
  data[offset + 4] = u0;
  data[offset + 5] = v0;
  data[offset + 6] = u1;
  data[offset + 7] = v1;
  data[offset + 8] = red;
  data[offset + 9] = green;
  data[offset + 10] = blue;
  data[offset + 11] = alpha;
  data[offset + 12] = cosine;
  data[offset + 13] = sine;
  data[offset + 14] = heightValue;
  data[offset + 15] = record.emissive;
  data[offset + 16] = entityId & 255;
  data[offset + 17] = (entityId >> 8) & 255;
  data[offset + 18] = (entityId >> 16) & 255;
  data[offset + 19] = materialLayerByte;
  data[offset + 20] = normal[0];
  data[offset + 21] = normal[1];
  data[offset + 22] = normal[2];
  data[offset + 23] = record.animated ? 1 : 0;
  const [emissionRed, emissionGreen, emissionBlue] = colorChannels(record.emissiveColor);
  data[offset + 24] = emissionRed;
  data[offset + 25] = emissionGreen;
  data[offset + 26] = emissionBlue;
  data[offset + 27] = 1;
  return offset + INSTANCE_FLOATS;
}

function createLayerBatch(input: GlyphBatchLayerInput, shader: Shader): LayerBatch {
  const capacity = INITIAL_INSTANCE_CAPACITY;
  const data = new Float32Array(capacity * INSTANCE_FLOATS);
  const buffer = new Buffer({
    data,
    usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    shrinkToFit: false,
    label: "Effulgence · " + input.material + " instances"
  });

  const geometry = new Geometry({
    attributes: {
      aPosition: { buffer: QUAD_VERTEX, format: "float32x2" },
      aUV: { buffer: QUAD_UV, format: "float32x2" },
      aInstanceRect: {
        buffer, format: "float32x4", stride: INSTANCE_STRIDE_BYTES,
        offset: 0, instance: true, divisor: 1
      },
      aInstanceUV: {
        buffer, format: "float32x4", stride: INSTANCE_STRIDE_BYTES,
        offset: 16, instance: true, divisor: 1
      },
      aInstanceTint: {
        buffer, format: "float32x4", stride: INSTANCE_STRIDE_BYTES,
        offset: 32, instance: true, divisor: 1
      },
      aInstanceMeta: {
        buffer, format: "float32x4", stride: INSTANCE_STRIDE_BYTES,
        offset: 48, instance: true, divisor: 1
      },
      aInstanceId: {
        buffer, format: "float32x4", stride: INSTANCE_STRIDE_BYTES,
        offset: 64, instance: true, divisor: 1
      },
      aInstanceNormal: {
        buffer, format: "float32x4", stride: INSTANCE_STRIDE_BYTES,
        offset: 80, instance: true, divisor: 1
      },
      aInstanceEmission: {
        buffer, format: "float32x4", stride: INSTANCE_STRIDE_BYTES,
        offset: 96, instance: true, divisor: 1
      }
    },
    indexBuffer: QUAD_INDICES,
    instanceCount: 0
  });

  const mesh = new Mesh({ geometry, shader });
  mesh.label = "Effulgence GPU batch · " + input.material;
  mesh.eventMode = "none";
  input.root?.addChild(mesh);
  return { input, buffer, geometry, mesh, data, capacity, count: 0 };
}

function countGlyphInstances(node: Container): number {
  let total = node instanceof GlyphDisplay ? node.glyphRecords.reduce((sum, record) => sum + (record.stroke && record.strokeWidth > 0 ? 9 : 1), 0) : 0;
  for (const child of node.children) {
    if (child instanceof Mesh) continue;
    if (child instanceof Container) total += countGlyphInstances(child);
  }
  return total;
}

function appendInstances(
  node: Container,
  layer: LayerBatch,
  atlas: AtlasData,
  parentTransform: Transform2D,
  inheritedEntityId: string | number,
  data: Float32Array,
  initialOffset: number
): number {
  const transform = composeTransform(parentTransform, node);
  if (!transform.visible || transform.alpha <= 0) return initialOffset;

  let offset = initialOffset;
  const entityLabel = node.label || inheritedEntityId;

  if (node instanceof GlyphDisplay) {
    for (const record of node.glyphRecords) {
      if (record.stroke && record.strokeWidth > 0) {
        const distance = record.strokeWidth;
        const outlineOffsets = [
          [-1, 0], [1, 0], [0, -1], [0, 1],
          [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]
        ];
        for (const [dx, dy] of outlineOffsets) {
          offset = instanceValues(atlas, layer, {
            ...record,
            offsetX: record.offsetX + dx * distance,
            offsetY: record.offsetY + dy * distance,
            color: record.stroke,
            stroke: undefined,
            strokeWidth: 0,
            emissive: 0
          }, transform, entityLabel, data, offset);
        }
      }
      offset = instanceValues(atlas, layer, record, transform, entityLabel, data, offset);
    }
    return offset;
  }

  for (const child of node.children) {
    if (child instanceof Mesh) continue;
    if (child instanceof Container) {
      offset = appendInstances(
        child, layer, atlas, transform, entityLabel, data, offset
      );
    }
  }
  return offset;
}

function createMrtShader(atlas: Texture): Shader {
  return Shader.from({
    gl: {
      vertex: INSTANCE_VERTEX_SHADER,
      fragment: GBUFFER_FRAGMENT_SHADER
    },
    resources: {
      uGlyphAtlas: atlas.source,
      uGlyphAtlasSampler: atlas.source.style
    }
  });
}

export function createGlyphBatchRenderer(
  layers: GlyphBatchLayerInput[]
): GlyphBatchRenderer {
  const atlas = createAtlas();
  const shader = createMrtShader(atlas.texture);
  const batches = layers.map((layer) => createLayerBatch(layer, shader));

  const identityTransform: Transform2D = {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0,
    alpha: 1, visible: true
  };
  let totalInstances = 0;

  const update = (): void => {
    totalInstances = 0;

    for (const batch of batches) {
      const root = batch.input.root;
      if (!root) { batch.count = 0; batch.geometry.instanceCount = 0; batch.mesh.visible = false; continue; }
      let required = 0;
      for (const child of root.children) {
        if (child instanceof Mesh) continue;
        if (child instanceof Container) required += countGlyphInstances(child);
      }

      if (required > batch.capacity) {
        let nextCapacity = batch.capacity;
        while (nextCapacity < required) nextCapacity *= 2;
        const nextData = new Float32Array(nextCapacity * INSTANCE_FLOATS);
        batch.buffer.data = nextData;
        batch.data = nextData;
        batch.capacity = nextCapacity;
      }

      let offset = 0;
      for (const child of root.children) {
        if (child instanceof Mesh) continue;
        if (child instanceof Container) {
          offset = appendInstances(
            child, batch, atlas, identityTransform,
            "layer-" + batch.input.layerId, batch.data, offset
          );
        }
      }

      batch.count = Math.floor(offset / INSTANCE_FLOATS);
      batch.geometry.instanceCount = batch.count;
      if (batch.count > 0) {
        batch.buffer.update(batch.count * INSTANCE_STRIDE_BYTES, 0);
        batch.mesh.visible = true;
      } else {
        batch.mesh.visible = false;
      }
      totalInstances += batch.count;
    }
    flushAtlas(atlas);
  };

  update();

  return {
    atlasTexture: atlas.texture,
    setView(zoom: number, pixelRatio: number, cellWidth: number, cellHeight: number, density: GlyphDensity): void {
      atlas.view = { zoom, pixelRatio, cellWidth, cellHeight, density };
    },
    setRoots(roots: Array<Container | null> | null): void {
      batches.forEach((batch, index) => {
        const nextRoot = roots?.[index] ?? null;
        if (batch.input.root === nextRoot) return;
        if (batch.input.root && batch.mesh.parent === batch.input.root) {
          batch.input.root.removeChild(batch.mesh);
        }
        batch.input = { ...batch.input, root: nextRoot };
        if (nextRoot) nextRoot.addChild(batch.mesh);
        else batch.mesh.visible = false;
      });
    },
    update,
    destroy(): void {
      for (const batch of batches) {
        if (batch.input.root && batch.mesh.parent === batch.input.root) batch.input.root.removeChild(batch.mesh);
        batch.mesh.destroy({ children: true });
        batch.geometry.destroy();
        batch.buffer.destroy();
      }
      shader.destroy();
      atlas.texture.destroy(false);
      atlas.source.destroy();
    },
    stats: () => ({
      layers: batches.length,
      instances: totalInstances,
      uniqueGlyphs: atlas.nextSlot,
      capacity: ATLAS_CAPACITY
    })
  };
}

export const EFFULGENCE_GLYPH_ATLAS = Object.freeze({
  columns: ATLAS_COLUMNS,
  rows: ATLAS_ROWS,
  cellWidth: ATLAS_CELL_WIDTH,
  cellHeight: ATLAS_CELL_HEIGHT,
  activeWidth: MICRO_GLYPH_CELL.activeWidth,
  activeHeight: MICRO_GLYPH_CELL.activeHeight,
  reservedBanks: BASE_GLYPH_BANKS,
  reservedSlots: BASE_GLYPH_SLOTS,
  gutterRight: MICRO_GLYPH_CELL.gutterRight,
  gutterBottom: MICRO_GLYPH_CELL.gutterBottom,
  capacity: ATLAS_CAPACITY,
  fixedSlots: {
    ramp: LUMINANCE_RAMP.length,
    edges: EDGE_GLYPHS.length,
    special: SPECIAL_GLYPHS.length
  }
});