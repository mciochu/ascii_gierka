import {
  Filter,
  Texture,
  defaultFilterVert,
  type Application,
  type Container
} from "pixi.js";

export type GlyphDensity = "small" | "medium" | "large";

export interface EffulgenceSettings {
  density: GlyphDensity;
  bloomIntensity: number;
  terrainAmbient: number;
  shimmerEnabled: boolean;
}

export const DEFAULT_EFFULGENCE_SETTINGS: Readonly<EffulgenceSettings> = Object.freeze({
  density: "medium",
  bloomIntensity: 85,
  terrainAmbient: 100,
  shimmerEnabled: true
});

export const EFFULGENCE_SETTINGS_KEY = "dominium.effulgence.settings.v1";

const CELL_SIZES: Record<GlyphDensity, readonly [number, number]> = {
  small: [6, 9],
  medium: [8, 12],
  large: [10, 15]
};

export const LUMINANCE_RAMP = [
  " ", ".", "'", ",", ":", ";", "-", "~",
  "+", "*", "x", "%", "#", "&", "@", "█"
] as const;

export const EDGE_GLYPHS = ["-", "/", "|", "\\", "=", "_", "+", "╳"] as const;

export const SPECIAL_GLYPHS = [
  ">", "^", "/", "-", ".", "*", "~", "'",
  "@", "#", "o", "(", ")", "%", ":", ".",
  "~", "c", "&", "░", "·", "+", "▒", "≈",
  "=", "║", "X", "!", "┼", ")", "†", "T",
  "♞", "♟", "⚑", "O", "Ø", "Θ", "▓", "W"
] as const;

export const GLYPH_ATLAS_CHARS = [
  ...LUMINANCE_RAMP,
  ...EDGE_GLYPHS,
  ...SPECIAL_GLYPHS
] as const;

const LUMINANCE_THRESHOLDS = [
  0.045, 0.095, 0.145, 0.2, 0.26, 0.325, 0.39, 0.46,
  0.53, 0.605, 0.68, 0.755, 0.83, 0.905, 0.965
] as const;

export function cellSizeForDensity(density: GlyphDensity): readonly [number, number] {
  return CELL_SIZES[density];
}

export function quantizeLuminance(value: number): number {
  const luminance = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const thresholdIndex = LUMINANCE_THRESHOLDS.findIndex((threshold) => luminance < threshold);
  return thresholdIndex < 0 ? 15 : thresholdIndex;
}

export function edgeGlyphIndexForAngle(theta: number, corner = false): number {
  if (corner) return 22;
  const normalized = ((theta % 180) + 180) % 180;
  if (normalized < 16 || normalized >= 164) return 16;
  if (normalized < 70) return 17;
  if (normalized < 110) return 18;
  return 19;
}

export function normalizeEffulgenceSettings(value: unknown): EffulgenceSettings {
  const candidate = value && typeof value === "object"
    ? value as Partial<EffulgenceSettings>
    : {};
  const density: GlyphDensity = candidate.density === "small" || candidate.density === "large"
    ? candidate.density
    : "medium";
  const bloomIntensity = Number.isFinite(candidate.bloomIntensity)
    ? Math.max(0, Math.min(150, Number(candidate.bloomIntensity)))
    : DEFAULT_EFFULGENCE_SETTINGS.bloomIntensity;
  const terrainAmbient = Number.isFinite(candidate.terrainAmbient)
    ? Math.max(50, Math.min(150, Number(candidate.terrainAmbient)))
    : DEFAULT_EFFULGENCE_SETTINGS.terrainAmbient;
  return {
    density,
    bloomIntensity,
    terrainAmbient,
    shimmerEnabled: typeof candidate.shimmerEnabled === "boolean"
      ? candidate.shimmerEnabled
      : DEFAULT_EFFULGENCE_SETTINGS.shimmerEnabled
  };
}

const GLYPH_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uGlyphAtlas;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uInputClamp;

uniform vec2 uCellSize;
uniform vec2 uCameraPos;
uniform float uTime;
uniform float uTerrainAmbient;
uniform float uShimmerEnabled;

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec4 sourceAt(vec2 pixelOffset) {
  vec2 uv = clamp(vTextureCoord + pixelOffset * uInputSize.zw, uInputClamp.xy, uInputClamp.zw);
  return texture(uTexture, uv);
}

float neighborLuma(vec2 cellCenter, vec2 cellDelta) {
  vec2 offsetPx = cellCenter + cellDelta * uCellSize - vTextureCoord * uInputSize.xy;
  return luminance(sourceAt(offsetPx).rgb);
}

float bayer4(vec2 position) {
  vec2 p = mod(floor(position), 4.0);
  int index = int(p.y) * 4 + int(p.x);
  float value = 0.0;
  if (index == 0) value = 0.0;
  else if (index == 1) value = 8.0;
  else if (index == 2) value = 2.0;
  else if (index == 3) value = 10.0;
  else if (index == 4) value = 12.0;
  else if (index == 5) value = 4.0;
  else if (index == 6) value = 14.0;
  else if (index == 7) value = 6.0;
  else if (index == 8) value = 3.0;
  else if (index == 9) value = 11.0;
  else if (index == 10) value = 1.0;
  else if (index == 11) value = 9.0;
  else if (index == 12) value = 15.0;
  else if (index == 13) value = 7.0;
  else if (index == 14) value = 13.0;
  else value = 5.0;
  return (value + 0.5) / 16.0;
}

int rampIndex(float value) {
  if (value < 0.045) return 0;
  if (value < 0.095) return 1;
  if (value < 0.145) return 2;
  if (value < 0.200) return 3;
  if (value < 0.260) return 4;
  if (value < 0.325) return 5;
  if (value < 0.390) return 6;
  if (value < 0.460) return 7;
  if (value < 0.530) return 8;
  if (value < 0.605) return 9;
  if (value < 0.680) return 10;
  if (value < 0.755) return 11;
  if (value < 0.830) return 12;
  if (value < 0.905) return 13;
  if (value < 0.965) return 14;
  return 15;
}

float hash21(vec2 point) {
  vec3 p3 = fract(vec3(point.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 screenPx = vTextureCoord * uInputSize.xy;
  vec2 cameraModulo = mod(floor(uCameraPos), uCellSize);
  vec2 cellIndex = floor((screenPx + cameraModulo) / uCellSize);
  vec2 cellCenterPx = (cellIndex + 0.5) * uCellSize - cameraModulo;
  vec2 centerOffset = cellCenterPx - screenPx;

  vec4 centerSample = sourceAt(centerOffset);
  vec4 sum = centerSample * 0.28;
  float peakL = luminance(centerSample.rgb);
  vec2 sampleX = uCellSize * vec2(0.30, 0.0);
  vec2 sampleY = uCellSize * vec2(0.0, 0.30);
  vec4 s1 = sourceAt(centerOffset + sampleX);
  vec4 s2 = sourceAt(centerOffset - sampleX);
  vec4 s3 = sourceAt(centerOffset + sampleY);
  vec4 s4 = sourceAt(centerOffset - sampleY);
  sum += (s1 + s2 + s3 + s4) * 0.18;
  peakL = max(peakL, max(max(luminance(s1.rgb), luminance(s2.rgb)), max(luminance(s3.rgb), luminance(s4.rgb))));
  float averageL = luminance(sum.rgb);

  float tl = neighborLuma(cellCenterPx, vec2(-1.0, -1.0));
  float tc = neighborLuma(cellCenterPx, vec2(0.0, -1.0));
  float tr = neighborLuma(cellCenterPx, vec2(1.0, -1.0));
  float ml = neighborLuma(cellCenterPx, vec2(-1.0, 0.0));
  float mr = neighborLuma(cellCenterPx, vec2(1.0, 0.0));
  float bl = neighborLuma(cellCenterPx, vec2(-1.0, 1.0));
  float bc = neighborLuma(cellCenterPx, vec2(0.0, 1.0));
  float br = neighborLuma(cellCenterPx, vec2(1.0, 1.0));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
  float edgeMag = length(vec2(gx, gy)) * 0.25;

  vec3 averagedColor = sum.rgb / max(sum.a, 0.0001);
  float level = mix(averageL, peakL, 0.62) * uTerrainAmbient;

  bool blueSurface = averagedColor.b > averagedColor.r * 1.10 && averagedColor.b > averagedColor.g * 1.04;
  bool fireSurface = averagedColor.r > averagedColor.g * 1.28 && averagedColor.r > averagedColor.b * 1.5;
  bool greenSurface = averagedColor.g > averagedColor.r * 1.18 && averagedColor.g > averagedColor.b * 1.08;
  bool animatedSurface = blueSurface || fireSurface || greenSurface;
  if (uShimmerEnabled > 0.5 && animatedSurface) {
    float shimmerStep = floor(uTime * 8.0);
    level += (hash21(cellIndex + vec2(shimmerStep, shimmerStep * 0.37)) - 0.5) * 0.16;
  }

  level = clamp(level + (bayer4(cellIndex) - 0.5) * 0.055, 0.0, 1.0);
  int glyphIndex = rampIndex(level);
  if (edgeMag > 0.24 && level > 0.12) {
    float theta = mod(degrees(atan(gy, gx)) + 90.0, 180.0);
    bool corner = abs(gx) > 0.34 && abs(gy) > 0.34;
    if (corner) glyphIndex = 22;
    else if (theta < 16.0 || theta >= 164.0) glyphIndex = level > 0.5 ? 20 : 21;
    else if (theta < 70.0) glyphIndex = 17;
    else if (theta < 110.0) glyphIndex = 18;
    else glyphIndex = 19;
  }

  vec3 chroma = averagedColor / max(luminance(averagedColor), 0.018);
  chroma = clamp(chroma * vec3(0.82, 0.94, 1.10), 0.0, 2.4);
  vec3 cellColor = chroma * level;
  float whiteMix = smoothstep(0.75, 1.35, level);
  cellColor = mix(cellColor, vec3(level * 1.15), whiteMix * 0.72);

  vec2 cellLocal = fract((screenPx + cameraModulo) / uCellSize);
  vec2 tile = vec2(mod(float(glyphIndex), 8.0), floor(float(glyphIndex) / 8.0));
  vec2 innerUV = mix(vec2(1.0 / 32.0, 1.0 / 48.0), vec2(31.0 / 32.0, 47.0 / 48.0), cellLocal);
  vec2 atlasUV = (tile + innerUV) / 8.0;
  float glyphMask = texture(uGlyphAtlas, atlasUV).a;
  finalColor = vec4(cellColor * glyphMask, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uInputClamp;

uniform float uBloomIntensity;
uniform float uVignetteEnabled;
uniform float uMicroGridEnabled;

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec3 brightSample(vec2 uv) {
  vec3 color = texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw)).rgb;
  float brightness = luminance(color);
  float soft = smoothstep(0.72 - 0.15, 0.72 + 0.15, brightness);
  return color * soft;
}

vec3 acesToneMap(vec3 color) {
  return clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  vec2 local = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  vec2 pixel = vTextureCoord * uInputSize.xy;
  vec2 px = uInputSize.zw;

  vec3 bloom = vec3(0.0);
  float totalWeight = 0.0;
  for (int ring = 0; ring < 4; ring++) {
    float radius = ring == 0 ? 2.0 : ring == 1 ? 4.5 : ring == 2 ? 9.0 : 18.0;
    float weight = ring == 0 ? 0.34 : ring == 1 ? 0.25 : ring == 2 ? 0.16 : 0.09;
    vec2 offset = px * radius;
    bloom += brightSample(vTextureCoord + vec2(offset.x, 0.0)) * weight;
    bloom += brightSample(vTextureCoord - vec2(offset.x, 0.0)) * weight;
    bloom += brightSample(vTextureCoord + vec2(0.0, offset.y)) * weight;
    bloom += brightSample(vTextureCoord - vec2(0.0, offset.y)) * weight;
    totalWeight += weight * 4.0;
  }
  bloom /= max(totalWeight, 0.0001);

  vec3 hdrColor = source.rgb + bloom * uBloomIntensity * 2.25;
  vec3 mapped = acesToneMap(hdrColor);
  vec2 centered = local * 2.0 - 1.0;
  float vignette = smoothstep(0.32, 1.5, dot(centered, centered));
  if (uVignetteEnabled > 0.5) mapped *= mix(1.0, 0.88, vignette);
  if (uMicroGridEnabled > 0.5 && mod(floor(pixel.y), 2.0) < 1.0) mapped *= 0.985;
  finalColor = vec4(mapped, source.a);
}
`;

function createGlyphAtlas(): Texture {
  const canvas = document.createElement("canvas");
  const tileWidth = 32;
  const tileHeight = 48;
  canvas.width = tileWidth * 8;
  canvas.height = tileHeight * 8;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Cannot create the Effulgence glyph atlas.");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = '500 37px "JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Consolas, monospace';

  GLYPH_ATLAS_CHARS.forEach((character, index) => {
    if (!character.trim()) return;
    const column = index % 8;
    const row = Math.floor(index / 8);
    context.fillText(
      character,
      column * tileWidth + tileWidth / 2,
      row * tileHeight + tileHeight / 2 + 1
    );
  });

  const texture = Texture.from(canvas);
  texture.source.scaleMode = "linear";
  return texture;
}

export interface EffulgenceRenderer {
  setSettings(settings: EffulgenceSettings): void;
  getSettings(): EffulgenceSettings;
  update(timeSeconds: number): void;
  destroy(): void;
}

export function createEffulgenceRenderer(
  app: Application,
  stage: Container,
  camera: Container
): EffulgenceRenderer {
  const atlas = createGlyphAtlas();
  const cellSize = new Float32Array(cellSizeForDensity(DEFAULT_EFFULGENCE_SETTINGS.density));
  const cameraPosition = new Float32Array([0, 0]);
  const glyphTime = { value: 0, type: "f32" as const };
  const terrainAmbient = { value: DEFAULT_EFFULGENCE_SETTINGS.terrainAmbient / 100, type: "f32" as const };
  const shimmerEnabled = { value: 1, type: "f32" as const };
  const bloomIntensity = { value: DEFAULT_EFFULGENCE_SETTINGS.bloomIntensity / 100, type: "f32" as const };
  const vignetteEnabled = { value: 1, type: "f32" as const };
  const microGridEnabled = { value: 0, type: "f32" as const };

  const glyphFilter = Filter.from({
    gl: { vertex: defaultFilterVert, fragment: GLYPH_FRAGMENT },
    resources: {
      effulgenceGlyphUniforms: {
        uCellSize: { value: cellSize, type: "vec2<f32>" },
        uCameraPos: { value: cameraPosition, type: "vec2<f32>" },
        uTime: glyphTime,
        uTerrainAmbient: terrainAmbient,
        uShimmerEnabled: shimmerEnabled
      },
      uGlyphAtlas: atlas.source
    },
    resolution: 1,
    antialias: "off"
  });

  const compositeFilter = Filter.from({
    gl: { vertex: defaultFilterVert, fragment: COMPOSITE_FRAGMENT },
    resources: {
      effulgenceCompositeUniforms: {
        uBloomIntensity: bloomIntensity,
        uVignetteEnabled: vignetteEnabled,
        uMicroGridEnabled: microGridEnabled
      }
    },
    resolution: 1,
    antialias: "off"
  });

  stage.filterArea = app.screen;
  stage.filters = [glyphFilter, compositeFilter];

  let settings = normalizeEffulgenceSettings(DEFAULT_EFFULGENCE_SETTINGS);

  const setSettings = (nextSettings: EffulgenceSettings): void => {
    settings = normalizeEffulgenceSettings(nextSettings);
    const nextCell = cellSizeForDensity(settings.density);
    cellSize[0] = nextCell[0];
    cellSize[1] = nextCell[1];
    terrainAmbient.value = settings.terrainAmbient / 100;
    bloomIntensity.value = settings.bloomIntensity / 100;
    shimmerEnabled.value = settings.shimmerEnabled ? 1 : 0;
  };

  setSettings(settings);

  return {
    setSettings,
    getSettings: () => ({ ...settings }),
    update(timeSeconds: number): void {
      glyphTime.value = Number.isFinite(timeSeconds) ? timeSeconds : 0;
      cameraPosition[0] = camera.position.x;
      cameraPosition[1] = camera.position.y;
    },
    destroy(): void {
      stage.filters = [];
      atlas.destroy(true);
      glyphFilter.destroy();
      compositeFilter.destroy();
    }
  };
}
