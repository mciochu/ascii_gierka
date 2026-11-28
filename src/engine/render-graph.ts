import {
  Application, BufferImageSource, Container, Geometry, Mesh, RenderTarget,
  Shader, Sprite, Texture, TextureSource
} from "pixi.js";
import {
  cellSizeForDensity, DEFAULT_EFFULGENCE_SETTINGS, getZoomProfile, microGlyphActiveSize,
  normalizeEffulgenceSettings, type EffulgenceSettings, type GlyphDensity
} from "./effulgence";
import { createGlyphBatchRenderer } from "./glyph-batch";
import type { WorldLayers } from "./world";

const DENSITY_BANK_ROW: Record<GlyphDensity, number> = { small: 0, medium: 4, large: 8 };

const FULLSCREEN_VERTEX = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

const LIGHTING_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uAlbedo;
uniform sampler2D uNormalHeight;
uniform sampler2D uEmissive;
uniform sampler2D uPointLights;
uniform vec3 uAmbient;
uniform vec3 uDirectionalColor;
uniform vec3 uDirectionalVector;
uniform float uDirectionalIntensity;
uniform float uTerrainAmbient;
uniform float uLightCount;
void main() {
  vec4 albedo = texture(uAlbedo, vUV);
  if (albedo.a < 0.002) { finalColor = vec4(0.0); return; }
  vec4 nh = texture(uNormalHeight, vUV);
  vec3 normal = normalize(nh.rgb / max(albedo.a, 0.0001));
  float height = clamp(nh.a / max(albedo.a, 0.0001), 0.0, 1.0);
  vec3 baseColor = albedo.rgb / max(albedo.a, 0.0001);
  float lambert = max(dot(normal, normalize(uDirectionalVector)), 0.0);
  vec3 directional = uDirectionalColor * uDirectionalIntensity * lambert;
  vec3 ambient = uAmbient * uTerrainAmbient;
  float heightFactor = mix(0.75, 1.18, height);
  vec3 lit = baseColor * (ambient + directional) * heightFactor;
  lit += texture(uEmissive, vUV).rgb / max(albedo.a, 0.0001);
  for (int i = 0; i < 64; i++) {
    if (float(i) >= uLightCount) break;
    vec4 point = texelFetch(uPointLights, ivec2(i, 0), 0);
    vec4 color = texelFetch(uPointLights, ivec2(i, 1), 0);
    float d = length(gl_FragCoord.xy - point.xy);
    float attenuation = pow(1.0 - clamp(d / max(point.z, 1.0), 0.0, 1.0), 2.0) * point.w;
    lit += baseColor * color.rgb * attenuation;
  }
  finalColor = vec4(lit * albedo.a, albedo.a);
}
`;

const CELL_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
layout(location = 0) out vec4 outCellData;
layout(location = 1) out vec4 outEdgeData;
uniform sampler2D uLitHDR;
uniform sampler2D uAlbedo;
uniform sampler2D uNormalHeight;
uniform sampler2D uEmissive;
uniform highp usampler2D uEntityIDs;
uniform vec2 uCellSize;
uniform vec2 uInputSize;
uniform vec2 uCameraModulo;
uniform float uZoomNorm;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
ivec2 centerPixel(ivec2 cell) {
  return clamp(cell * ivec2(uCellSize) - ivec2(uCameraModulo) + ivec2(uCellSize * 0.5),
    ivec2(0), ivec2(uInputSize) - ivec2(1));
}
float heightAt(ivec2 cell) {
  ivec2 p = centerPixel(cell);
  vec4 a = texelFetch(uAlbedo, p, 0);
  vec4 n = texelFetch(uNormalHeight, p, 0);
  return a.a > 0.001 ? n.a / a.a : 0.0;
}
vec3 normalAt(ivec2 cell) {
  ivec2 p = centerPixel(cell);
  vec4 a = texelFetch(uAlbedo, p, 0);
  vec4 n = texelFetch(uNormalHeight, p, 0);
  return a.a > 0.001 ? normalize(n.rgb / a.a) : vec3(0.0, 0.0, 1.0);
}
uvec3 idAt(ivec2 cell) { return texelFetch(uEntityIDs, centerPixel(cell), 0).rgb; }
float decodedHeight(ivec2 p) {
  vec4 a = texelFetch(uAlbedo, p, 0);
  vec4 n = texelFetch(uNormalHeight, p, 0);
  return a.a > 0.001 ? n.a / a.a : 0.0;
}
vec3 decodedNormal(ivec2 p) {
  vec4 a = texelFetch(uAlbedo, p, 0);
  vec4 n = texelFetch(uNormalHeight, p, 0);
  return a.a > 0.001 ? normalize(n.rgb / a.a) : vec3(0.0, 0.0, 1.0);
}
bool buildingEdgeAt(ivec2 p) {
  ivec2 maximum = ivec2(uInputSize) - ivec2(1);
  uvec4 centerId = texelFetch(uEntityIDs, p, 0);
  if (int(centerId.a & 127u) != 1) return false;
  float centerHeight = decodedHeight(p);
  vec3 centerNormal = decodedNormal(p);
  ivec2 directions[4] = ivec2[4](ivec2(-1, 0), ivec2(1, 0), ivec2(0, -1), ivec2(0, 1));
  for (int i = 0; i < 4; i++) {
    ivec2 q = clamp(p + directions[i], ivec2(0), maximum);
    uvec4 neighborId = texelFetch(uEntityIDs, q, 0);
    if (int(neighborId.a & 127u) != 1 || any(notEqual(neighborId.rgb, centerId.rgb))) return true;
    if (abs(decodedHeight(q) - centerHeight) > mix(0.065, 0.10, uZoomNorm)) return true;
    if (length(decodedNormal(q) - centerNormal) > 0.22) return true;
  }
  return false;
}
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  ivec2 origin = cell * ivec2(uCellSize) - ivec2(uCameraModulo);
  vec3 sum = vec3(0.0);
  float peak = 0.0;
  float samples = 0.0;
  float bestScore = -1.0;
  float bestLuminance = 0.0;
  vec3 bestColor = vec3(0.0);
  int winningLayer = 0;
  int winningPriority = 0;
  bool bestAnimated = false;

  // Importance-weighted maximum pooling: hero pixels always beat terrain averages.
  for (int y = 0; y < 15; y++) {
    for (int x = 0; x < 10; x++) {
      if (float(x) >= uCellSize.x || float(y) >= uCellSize.y) continue;
      ivec2 p = origin + ivec2(x, y);
      if (p.x < 0 || p.y < 0 || p.x >= int(uInputSize.x) || p.y >= int(uInputSize.y)) continue;

      vec4 albedo = texelFetch(uAlbedo, p, 0);
      vec4 litSample = texelFetch(uLitHDR, p, 0);
      if (albedo.a < 0.002 || litSample.a < 0.002) continue;
      vec3 lit = litSample.rgb / max(litSample.a, 0.0001);
      float lum = luma(lit);
      sum += lit;
      peak = max(peak, lum);
      samples += 1.0;

      uvec4 entity = texelFetch(uEntityIDs, p, 0);
      int layer = int(entity.a & 127u);
      bool animated = (entity.a & 128u) != 0u;
      vec3 emissive = texelFetch(uEmissive, p, 0).rgb;
      float emissiveStrength = max(max(emissive.r, emissive.g), emissive.b);
      bool buildingEdge = layer == 1 && buildingEdgeAt(p);
      int priority = 1;
      if (emissiveStrength > 1.0 || layer == 3) priority = 4;
      else if (layer == 2 || layer == 4) priority = 3;
      else if (layer == 1 && buildingEdge) priority = 2;

      float score = float(priority) * 10.0 + lum;
      if (score > bestScore) {
        bestScore = score;
        bestLuminance = lum;
        bestColor = lit;
        winningLayer = layer;
        winningPriority = priority;
        bestAnimated = animated;
      }
    }
  }

  vec3 averageColor = sum / max(samples, 1.0);
  bool usePriorityWinner = winningPriority > 1;
  vec3 chosenColor = usePriorityWinner ? bestColor : averageColor;
  float chosenLuminance = usePriorityWinner ? bestLuminance : peak;

  float tl = heightAt(cell + ivec2(-1, -1));
  float tc = heightAt(cell + ivec2(0, -1));
  float tr = heightAt(cell + ivec2(1, -1));
  float ml = heightAt(cell + ivec2(-1, 0));
  float mr = heightAt(cell + ivec2(1, 0));
  float bl = heightAt(cell + ivec2(-1, 1));
  float bc = heightAt(cell + ivec2(0, 1));
  float br = heightAt(cell + ivec2(1, 1));
  vec2 depthGradient = vec2(
    (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl),
    (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr)
  );
  vec3 ntl = normalAt(cell + ivec2(-1, -1));
  vec3 ntc = normalAt(cell + ivec2(0, -1));
  vec3 ntr = normalAt(cell + ivec2(1, -1));
  vec3 nml = normalAt(cell + ivec2(-1, 0));
  vec3 nmr = normalAt(cell + ivec2(1, 0));
  vec3 nbl = normalAt(cell + ivec2(-1, 1));
  vec3 nbc = normalAt(cell + ivec2(0, 1));
  vec3 nbr = normalAt(cell + ivec2(1, 1));
  vec3 gxN = (ntr + 2.0 * nmr + nbr) - (ntl + 2.0 * nml + nbl);
  vec3 gyN = (nbl + 2.0 * nbc + nbr) - (ntl + 2.0 * ntc + ntr);
  uvec3 centerId = idAt(cell);
  float tlId = any(notEqual(idAt(cell + ivec2(-1, -1)), centerId)) ? 1.0 : 0.0;
  float tcId = any(notEqual(idAt(cell + ivec2(0, -1)), centerId)) ? 1.0 : 0.0;
  float trId = any(notEqual(idAt(cell + ivec2(1, -1)), centerId)) ? 1.0 : 0.0;
  float mlId = any(notEqual(idAt(cell + ivec2(-1, 0)), centerId)) ? 1.0 : 0.0;
  float mrId = any(notEqual(idAt(cell + ivec2(1, 0)), centerId)) ? 1.0 : 0.0;
  float blId = any(notEqual(idAt(cell + ivec2(-1, 1)), centerId)) ? 1.0 : 0.0;
  float bcId = any(notEqual(idAt(cell + ivec2(0, 1)), centerId)) ? 1.0 : 0.0;
  float brId = any(notEqual(idAt(cell + ivec2(1, 1)), centerId)) ? 1.0 : 0.0;
  vec2 idGradient = vec2(
    (trId + 2.0 * mrId + brId) - (tlId + 2.0 * mlId + blId),
    (blId + 2.0 * bcId + brId) - (tlId + 2.0 * tcId + trId)
  );
  float edgeMag = max(length(depthGradient),
    max(length(vec2(length(gxN), length(gyN))) * 0.8, length(idGradient) * 1.2));
  vec2 gradient = depthGradient + vec2(length(gxN), length(gyN)) * 0.8 + idGradient * 1.2;
  float encodedWinner = float(winningLayer) + (bestAnimated ? 8.0 : 0.0) +
    (winningPriority == 4 ? 32.0 : 0.0);
  outCellData = vec4(chosenColor, chosenLuminance);
  outEdgeData = vec4(edgeMag, gradient.x, gradient.y, encodedWinner);
}
`;

const GLYPH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uCellData;
uniform sampler2D uEdgeData;
uniform sampler2D uGlyphAtlas;
uniform vec2 uCellSize;
uniform vec2 uGridSize;
uniform vec2 uCameraModulo;
uniform vec2 uAtlasSize;
uniform float uTime;
uniform float uShimmerEnabled;
uniform float uZoomNorm;
uniform float uTerrainMaxLuminance;
uniform float uEdgeThreshold;
uniform vec2 uGlyphPixelSize;
uniform float uGlyphBankRow;
uniform float uPixelRatio;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.y) * 4 + int(q.x);
  float v = 0.0;
  if (i == 0) v = 0.0; else if (i == 1) v = 8.0;
  else if (i == 2) v = 2.0; else if (i == 3) v = 10.0;
  else if (i == 4) v = 12.0; else if (i == 5) v = 4.0;
  else if (i == 6) v = 14.0; else if (i == 7) v = 6.0;
  else if (i == 8) v = 3.0; else if (i == 9) v = 11.0;
  else if (i == 10) v = 1.0; else if (i == 11) v = 9.0;
  else if (i == 12) v = 15.0; else if (i == 13) v = 7.0;
  else if (i == 14) v = 13.0; else v = 5.0;
  return (v + 0.5) / 16.0;
}
float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
int rampIndex(float l) {
  if (l < 0.045) return 0; if (l < 0.095) return 1;
  if (l < 0.145) return 2; if (l < 0.200) return 3;
  if (l < 0.260) return 4; if (l < 0.325) return 5;
  if (l < 0.390) return 6; if (l < 0.460) return 7;
  if (l < 0.530) return 8; if (l < 0.605) return 9;
  if (l < 0.680) return 10; if (l < 0.755) return 11;
  if (l < 0.830) return 12; if (l < 0.905) return 13;
  if (l < 0.965) return 14; return 15;
}
void main() {
  vec2 snapped = gl_FragCoord.xy + uCameraModulo;
  vec2 cellIndex = floor(snapped / uCellSize);
  vec2 localUV = fract(snapped / uCellSize);
  ivec2 cell = clamp(ivec2(cellIndex), ivec2(0), ivec2(uGridSize) - ivec2(1));
  vec4 stats = texelFetch(uCellData, cell, 0);
  vec4 edges = texelFetch(uEdgeData, cell, 0);
  int winningLayer = int(mod(floor(edges.a + 0.5), 8.0));
  bool animated = mod(floor(edges.a / 8.0), 2.0) > 0.5;
  bool priorityFour = floor(edges.a / 32.0) > 0.5;
  float averageL = luma(stats.rgb);
  float level = mix(averageL, stats.a, 0.62);
  if (winningLayer == 0 && !priorityFour) level = min(level, uTerrainMaxLuminance);
  if (uShimmerEnabled > 0.5 && animated) {
    float stepTime = floor(uTime * 8.0);
    level += (hash21(cellIndex + vec2(stepTime, stepTime * 0.37)) - 0.5) * 0.16;
  }
  level = clamp(level + (bayer4(cellIndex) - 0.5) * 0.055, 0.0, 1.5);
  int glyphIndex = rampIndex(level);
  if (edges.r > uEdgeThreshold && level > 0.12) {
    float theta = mod(degrees(atan(edges.g, edges.b)) + 90.0, 180.0);
    bool corner = abs(edges.g) > 0.34 && abs(edges.b) > 0.34;
    if (winningLayer == 1 && edges.r > 0.5) {
      if (abs(edges.g) > abs(edges.b) * 1.5) glyphIndex = edges.g >= 0.0 ? 56 : 57;
      else if (abs(edges.b) > abs(edges.g) * 1.5) glyphIndex = edges.b >= 0.0 ? 58 : 59;
      else if (edges.g >= 0.0 && edges.b >= 0.0) glyphIndex = 60;
      else if (edges.g < 0.0 && edges.b >= 0.0) glyphIndex = 61;
      else if (edges.g >= 0.0) glyphIndex = 62;
      else glyphIndex = 63;
    } else if (corner) glyphIndex = 22;
    else if (theta < 16.0 || theta >= 164.0) glyphIndex = level > 0.5 ? 20 : 21;
    else if (theta < 70.0) glyphIndex = 17;
    else if (theta < 110.0) glyphIndex = 18;
    else glyphIndex = 19;
  }
  vec3 chroma = stats.rgb / max(averageL, 0.018);
  // Preserve the material's own hue; the previous cyan bias washed out
  // forest and earth tones at strategic zoom.
  vec3 cellColor = clamp(chroma * vec3(1.05, 1.0, 0.86), 0.0, 2.4) * level;
  float whiteMix = smoothstep(0.75, 1.35, level);
  cellColor = mix(cellColor, vec3(level * 1.15), whiteMix * 0.72);
  cellColor *= mix(0.98, 1.0, uZoomNorm);
  vec2 localPixel = floor(localUV * uCellSize);
  vec2 activePhysical = uGlyphPixelSize * uPixelRatio;
  if (localPixel.x >= activePhysical.x || localPixel.y >= activePhysical.y) {
    finalColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec2 microPixel = floor(localPixel / max(uPixelRatio, 1.0));
  vec2 tile = vec2(mod(float(glyphIndex), 16.0), floor(float(glyphIndex) / 16.0) + uGlyphBankRow);
  vec2 glyphPx = tile * vec2(6.0, 8.0) + microPixel + vec2(0.5);
  float mask = texture(uGlyphAtlas, glyphPx / uAtlasSize).r;
  finalColor = vec4(cellColor * mask, 1.0);
}
`;

const BLOOM_DOWN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uThreshold;
uniform float uKnee;
uniform float uExtract;
uniform float uBloomRadius;
uniform float uZoomNorm;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 thresholdColor(vec3 c) {
  float b = luma(c);
  float soft = clamp((b - uThreshold + uKnee) / max(2.0 * uKnee, 0.0001), 0.0, 1.0);
  soft = soft * soft * uKnee;
  float contribution = max(b - uThreshold, soft) / max(b, 0.0001);
  return c * contribution;
}
void main() {
  vec2 o = uTexelSize * 0.5 * uBloomRadius * mix(0.45, 1.0, clamp(uZoomNorm, 0.0, 1.0));
  vec3 c = texture(uSource, vUV + vec2(-o.x, -o.y)).rgb;
  c += texture(uSource, vUV + vec2(o.x, -o.y)).rgb;
  c += texture(uSource, vUV + vec2(-o.x, o.y)).rgb;
  c += texture(uSource, vUV + vec2(o.x, o.y)).rgb;
  c *= 0.25;
  if (uExtract > 0.5) c = thresholdColor(c);
  finalColor = vec4(c, 1.0);
}
`;

const BLOOM_UP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uLowRes;
uniform sampler2D uHighRes;
uniform vec2 uHighTexel;
uniform float uBloomRadius;
uniform float uZoomNorm;
void main() {
  vec2 o = uHighTexel * 1.5 * uBloomRadius * mix(0.45, 1.0, clamp(uZoomNorm, 0.0, 1.0));
  vec3 h = texture(uHighRes, vUV + vec2(-o.x, -o.y)).rgb;
  h += texture(uHighRes, vUV + vec2(o.x, -o.y)).rgb;
  h += texture(uHighRes, vUV + vec2(-o.x, o.y)).rgb;
  h += texture(uHighRes, vUV + vec2(o.x, o.y)).rgb;
  h *= 0.25;
  finalColor = vec4(texture(uLowRes, vUV).rgb + h * 0.35, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uAsciiHDR;
uniform sampler2D uBloom;
uniform float uBloomIntensity;
uniform float uVignette;
uniform float uMicroGrid;
uniform float uZoomNorm;
vec3 aces(vec3 c) {
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec3 color = aces(texture(uAsciiHDR, vUV).rgb + texture(uBloom, vUV).rgb * uBloomIntensity);
  vec2 centered = vUV * 2.0 - 1.0;
  float vignette = smoothstep(0.32, 1.5, dot(centered, centered));
  color *= mix(1.0, mix(0.90, 0.88, uZoomNorm), vignette * uVignette);
  if (uMicroGrid > 0.5 && mod(floor(gl_FragCoord.y), 2.0) < 1.0) color *= 0.985;
  finalColor = vec4(color, 1.0);
}
`;

export interface EffulgenceLight {
  id: string; x: number; y: number; color: string; intensity: number; radius: number;
  flickerHz?: number; flickerAmplitude?: number; priority?: number;
}
export interface EffulgenceRenderGraph {
  readonly output: Sprite;
  setSettings(settings: EffulgenceSettings): void;
  getSettings(): EffulgenceSettings;
  setLights(lights: EffulgenceLight[]): void;
  setLayers(layers: WorldLayers | null, previewRoot?: Container | null): void;
  update(timeSeconds: number, zoom?: number): void;
  render(): void;
  resize(width: number, height: number): void;
  destroy(): void;
  stats(): { gbufferPasses: number; lightingPasses: number; cellPasses: number; glyphPasses: number; bloomPasses: number; entityInstances: number; activeLights: number };
}
interface PassMesh { mesh: Mesh<Geometry, Shader>; geometry: Geometry; shader: Shader; width: number; height: number; }

function parseColor(color: string): [number, number, number] {
  const clean = color.startsWith("#") ? color.slice(1) : color;
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return [1, 0.48, 0.1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
function createColorTarget(width: number, height: number, resolution: number, format: "rgba8unorm" | "rgba16float" | "rgba8uint", label: string, scaleMode: "nearest" | "linear" = "linear"): RenderTarget {
  const texture = new TextureSource({
    width, height, resolution, format, scaleMode,
    ...(format === "rgba8uint" ? { alphaMode: "no-premultiply-alpha" as const } : {})
  });
  return new RenderTarget({ colorAttachments: [{ texture, clearValue: [0, 0, 0, 0] }], label });
}
function createGBuffer(width: number, height: number, resolution: number): RenderTarget {
  const albedo = new TextureSource({ width, height, resolution, format: "rgba8unorm", scaleMode: "linear" });
  const normalHeight = new TextureSource({ width, height, resolution, format: "rgba16float", scaleMode: "linear" });
  const emissive = new TextureSource({ width, height, resolution, format: "rgba16float", scaleMode: "linear" });
  const ids = new TextureSource({ width, height, resolution, format: "rgba8uint", scaleMode: "nearest", alphaMode: "no-premultiply-alpha" });
  return new RenderTarget({
    colorAttachments: [
      { texture: albedo, clearValue: [0, 0, 0, 0] },
      { texture: normalHeight, clearValue: [0, 0, 0, 0] },
      { texture: emissive, clearValue: [0, 0, 0, 0] },
      { texture: ids, clearValue: [0, 0, 0, 0] }
    ],
    label: "Effulgence Pass 0 · G-Buffer"
  });
}
function makeTexture(source: TextureSource): Texture { return new Texture({ source }); }
function createPass(shader: Shader, width: number, height: number, label: string): PassMesh {
  const geometry = new Geometry({
    attributes: {
      aPosition: new Float32Array([0, 0, width, 0, width, height, 0, height]),
      aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
    },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3])
  });
  const mesh = new Mesh({ geometry, shader });
  mesh.label = label; mesh.eventMode = "none";
  return { mesh, geometry, shader, width, height };
}
function resizePass(pass: PassMesh, width: number, height: number): void {
  if (pass.width === width && pass.height === height) return;
  pass.width = width; pass.height = height;
  const buffer = pass.geometry.getBuffer("aPosition");
  buffer.data = new Float32Array([0, 0, width, 0, width, height, 0, height]);
  buffer.update();
}
function renderPass(renderer: Application["renderer"], pass: PassMesh, target: RenderTarget): void {
  renderer.render({ container: pass.mesh, target, clear: true });
}
function clusterLights(lights: EffulgenceLight[]): EffulgenceLight[] {
  const ordered = [...lights].filter((l) =>
    Number.isFinite(l.x) && Number.isFinite(l.y) && Number.isFinite(l.radius) && l.radius > 0 &&
    Number.isFinite(l.intensity) && l.intensity > 0
  ).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const result: EffulgenceLight[] = [];
  for (const light of ordered) {
    const found = result.find((candidate) =>
      Math.hypot(candidate.x - light.x, candidate.y - light.y) <= Math.min(candidate.radius, light.radius) * 0.3
    );
    if (!found) { result.push({ ...light }); continue; }
    const total = found.intensity + light.intensity;
    found.x = (found.x * found.intensity + light.x * light.intensity) / total;
    found.y = (found.y * found.intensity + light.y * light.intensity) / total;
    found.radius = Math.max(found.radius, light.radius);
    found.intensity = Math.min(2.5, total);
    found.priority = Math.max(found.priority ?? 0, light.priority ?? 0);
  }
  return result.slice(0, 64);
}

export function createEffulgenceRenderGraph(app: Application, worldRoot: Container, layers: WorldLayers): EffulgenceRenderGraph {
  const pixelRatio = app.renderer.resolution || 1;
  let logicalWidth = Math.max(1, app.screen.width);
  let logicalHeight = Math.max(1, app.screen.height);
  let physicalWidth = Math.max(1, Math.round(logicalWidth * pixelRatio));
  let physicalHeight = Math.max(1, Math.round(logicalHeight * pixelRatio));

  const gbuffer = createGBuffer(logicalWidth, logicalHeight, pixelRatio);
  const albedo = makeTexture(gbuffer.colorTextures[0]!);
  const normalHeight = makeTexture(gbuffer.colorTextures[1]!);
  const emissive = makeTexture(gbuffer.colorTextures[2]!);
  const entityIds = makeTexture(gbuffer.colorTextures[3]!);

  const lightingTarget = createColorTarget(logicalWidth, logicalHeight, pixelRatio, "rgba16float", "Effulgence Pass 1 · Lighting");
  const lightingTexture = makeTexture(lightingTarget.colorTexture);
  let density = cellSizeForDensity(DEFAULT_EFFULGENCE_SETTINGS.density);
  const cellSizePx = new Float32Array([density[0] * pixelRatio, density[1] * pixelRatio]);
  const cameraModulo = new Float32Array([0, 0]);
  let cellWidth = Math.ceil(physicalWidth / cellSizePx[0]) + 1;
  let cellHeight = Math.ceil(physicalHeight / cellSizePx[1]) + 1;
  const cellTarget = new RenderTarget({
    colorAttachments: [
      { texture: new TextureSource({ width: cellWidth, height: cellHeight, format: "rgba16float" }), clearValue: [0, 0, 0, 0] },
      { texture: new TextureSource({ width: cellWidth, height: cellHeight, format: "rgba16float" }), clearValue: [0, 0, 0, 0] }
    ],
    label: "Effulgence Pass 2 · Cell & Edge Data"
  });
  const cellData = makeTexture(cellTarget.colorTextures[0]!);
  const edgeData = makeTexture(cellTarget.colorTextures[1]!);
  const asciiTarget = createColorTarget(logicalWidth, logicalHeight, pixelRatio, "rgba16float", "Effulgence Pass 3 · ASCII HDR");
  const asciiTexture = makeTexture(asciiTarget.colorTexture);

  const downTargets: RenderTarget[] = [];
  const downTextures: Texture[] = [];
  for (let i = 0; i < 4; i++) {
    const divisor = 2 ** (i + 1);
    const target = createColorTarget(Math.max(1, Math.ceil(physicalWidth / divisor)), Math.max(1, Math.ceil(physicalHeight / divisor)), 1, "rgba16float", "Kawase Down " + i);
    downTargets.push(target); downTextures.push(makeTexture(target.colorTexture));
  }
  const upTargets: RenderTarget[] = [];
  const upTextures: Texture[] = [];
  const upSizes = [
    [Math.max(1, Math.ceil(physicalWidth / 8)), Math.max(1, Math.ceil(physicalHeight / 8))],
    [Math.max(1, Math.ceil(physicalWidth / 4)), Math.max(1, Math.ceil(physicalHeight / 4))],
    [Math.max(1, Math.ceil(physicalWidth / 2)), Math.max(1, Math.ceil(physicalHeight / 2))],
    [physicalWidth, physicalHeight]
  ];
  for (let i = 0; i < 4; i++) {
    const size = upSizes[i]!;
    const target = createColorTarget(size[0]!, size[1]!, 1, "rgba16float", "Kawase Up " + i);
    upTargets.push(target); upTextures.push(makeTexture(target.colorTexture));
  }
  const compositeTarget = createColorTarget(logicalWidth, logicalHeight, pixelRatio, "rgba8unorm", "Effulgence Pass 6 · Composite");
  const compositeTexture = makeTexture(compositeTarget.colorTexture);
  const output = new Sprite(compositeTexture);
  output.label = "Effulgence · Composite Output";
  output.anchor.set(0);
  app.stage.addChild(output);

  const glyphBatches = createGlyphBatchRenderer([
    { root: layers.terrain, material: "terrain", layerId: 0 },
    { root: layers.details, material: "terrain", layerId: 0 },
    { root: layers.structures, material: "building", layerId: 1 },
    { root: layers.actors, material: "unit", layerId: 2 },
    { root: layers.effects, material: "vfx", layerId: 3 },
    { root: null, material: "selection", layerId: 4 }
  ]);

  const lightPixels = new Float32Array(64 * 2 * 4);
  const lightSource = new BufferImageSource({
    resource: lightPixels, width: 64, height: 2, format: "rgba32float",
    scaleMode: "nearest", alphaMode: "no-premultiply-alpha"
  });
  const lightTexture = makeTexture(lightSource);
  const lightingUniforms = {
    uAmbient: { value: new Float32Array([0.03, 0.045, 0.07]), type: "vec3<f32>" as const },
    uDirectionalColor: { value: new Float32Array([0.42, 0.643, 0.784]), type: "vec3<f32>" as const },
    uDirectionalVector: { value: new Float32Array([-0.60, -0.65, 0.46]), type: "vec3<f32>" as const },
    uDirectionalIntensity: { value: 0.55, type: "f32" as const },
    uTerrainAmbient: { value: 1, type: "f32" as const },
    uLightCount: { value: 0, type: "f32" as const }
  };
  const lightingShader = Shader.from({
    gl: { vertex: FULLSCREEN_VERTEX, fragment: LIGHTING_FRAGMENT },
    resources: {
      uAlbedo: albedo.source, uAlbedoSampler: albedo.source.style,
      uNormalHeight: normalHeight.source, uNormalHeightSampler: normalHeight.source.style,
      uEmissive: emissive.source, uEmissiveSampler: emissive.source.style,
      uPointLights: lightTexture.source, uPointLightsSampler: lightTexture.source.style,
      lightingUniforms
    }
  });
  const lightingPass = createPass(lightingShader, logicalWidth, logicalHeight, "Effulgence Pass 1 · Lighting");

  const cellUniforms = {
    uCellSize: { value: cellSizePx, type: "vec2<f32>" as const },
    uInputSize: { value: new Float32Array([physicalWidth, physicalHeight]), type: "vec2<f32>" as const },
    uCameraModulo: { value: cameraModulo, type: "vec2<f32>" as const },
    uZoomNorm: { value: 0.24, type: "f32" as const }
  };
  const cellShader = Shader.from({
    gl: { vertex: FULLSCREEN_VERTEX, fragment: CELL_FRAGMENT },
    resources: {
      uLitHDR: lightingTexture.source, uLitHDRSampler: lightingTexture.source.style,
      uAlbedo: albedo.source, uAlbedoSampler: albedo.source.style,
      uNormalHeight: normalHeight.source, uNormalHeightSampler: normalHeight.source.style,
      uEmissive: emissive.source, uEmissiveSampler: emissive.source.style,
      uEntityIDs: entityIds.source, uEntityIDsSampler: entityIds.source.style,
      cellUniforms
    }
  });
  const cellPass = createPass(cellShader, cellWidth, cellHeight, "Effulgence Pass 2 · Downsample");

  const glyphUniforms = {
    uCellSize: { value: cellSizePx, type: "vec2<f32>" as const },
    uGridSize: { value: new Float32Array([cellWidth, cellHeight]), type: "vec2<f32>" as const },
    uCameraModulo: { value: cameraModulo, type: "vec2<f32>" as const },
    uAtlasSize: { value: new Float32Array([96, 256]), type: "vec2<f32>" as const },
    uGlyphPixelSize: { value: new Float32Array([4, 6]), type: "vec2<f32>" as const },
    uGlyphBankRow: { value: 4, type: "f32" as const },
    uPixelRatio: { value: pixelRatio, type: "f32" as const },
    uTime: { value: 0, type: "f32" as const },
    uShimmerEnabled: { value: 1, type: "f32" as const },
    uZoomNorm: { value: 0.24, type: "f32" as const },
    uTerrainMaxLuminance: { value: 0.116, type: "f32" as const },
    uEdgeThreshold: { value: 0.164, type: "f32" as const }
  };
  const glyphShader = Shader.from({
    gl: { vertex: FULLSCREEN_VERTEX, fragment: GLYPH_FRAGMENT },
    resources: {
      uCellData: cellData.source, uCellDataSampler: cellData.source.style,
      uEdgeData: edgeData.source, uEdgeDataSampler: edgeData.source.style,
      uGlyphAtlas: glyphBatches.atlasTexture.source, uGlyphAtlasSampler: glyphBatches.atlasTexture.source.style,
      glyphUniforms
    }
  });
  const glyphPass = createPass(glyphShader, logicalWidth, logicalHeight, "Effulgence Pass 3 · Glyph Composition");

  const bloomDownUniforms = Array.from({ length: 4 }, (_, i) => ({
    uTexelSize: { value: new Float32Array([1 / physicalWidth, 1 / physicalHeight]), type: "vec2<f32>" as const },
    uThreshold: { value: 0.72, type: "f32" as const },
    uKnee: { value: 0.15, type: "f32" as const },
    uExtract: { value: i === 0 ? 1 : 0, type: "f32" as const },
    uBloomRadius: { value: 0.582, type: "f32" as const },
    uZoomNorm: { value: 0.24, type: "f32" as const }
  }));
  const bloomDownPasses = bloomDownUniforms.map((uniforms, i) => {
    const source = i === 0 ? asciiTexture : downTextures[i - 1]!;
    const target = downTargets[i]!;
    const shader = Shader.from({
      gl: { vertex: FULLSCREEN_VERTEX, fragment: BLOOM_DOWN_FRAGMENT },
      resources: { uSource: source.source, uSourceSampler: source.source.style, bloomDownUniforms: uniforms }
    });
    const pass = createPass(shader, target.width, target.height, "Kawase Down " + i);
    uniforms.uTexelSize.value[0] = 1 / (i === 0 ? physicalWidth : downTargets[i - 1]!.width);
    uniforms.uTexelSize.value[1] = 1 / (i === 0 ? physicalHeight : downTargets[i - 1]!.height);
    return pass;
  });
  const bloomUpPasses: PassMesh[] = [];
  const bloomUpUniforms: Array<{ uHighTexel: { value: Float32Array; type: "vec2<f32>" }; uBloomRadius: { value: number; type: "f32" }; uZoomNorm: { value: number; type: "f32" } }> = [];
  for (let i = 0; i < 4; i++) {
    const low = i === 0 ? downTextures[3]! : upTextures[i - 1]!;
    const high = i === 0 ? downTextures[2]! : i === 1 ? downTextures[1]! : i === 2 ? downTextures[0]! : asciiTexture;
    const target = upTargets[i]!;
    const uniforms = {
      uHighTexel: { value: new Float32Array([1 / high.source.width, 1 / high.source.height]), type: "vec2<f32>" as const },
      uBloomRadius: { value: 0.582, type: "f32" as const },
      uZoomNorm: { value: 0.24, type: "f32" as const }
    };
    bloomUpUniforms.push(uniforms);
    const shader = Shader.from({
      gl: { vertex: FULLSCREEN_VERTEX, fragment: BLOOM_UP_FRAGMENT },
      resources: {
        uLowRes: low.source, uLowResSampler: low.source.style,
        uHighRes: high.source, uHighResSampler: high.source.style,
        bloomUpUniforms: uniforms
      }
    });
    bloomUpPasses.push(createPass(shader, target.width, target.height, "Kawase Up " + i));
  }

  const compositeUniforms = {
    uBloomIntensity: { value: DEFAULT_EFFULGENCE_SETTINGS.bloomIntensity / 100, type: "f32" as const },
    uVignette: { value: 1, type: "f32" as const },
    uMicroGrid: { value: 0, type: "f32" as const },
    uZoomNorm: { value: 0.24, type: "f32" as const }
  };
  const compositeShader = Shader.from({
    gl: { vertex: FULLSCREEN_VERTEX, fragment: COMPOSITE_FRAGMENT },
    resources: {
      uAsciiHDR: asciiTexture.source, uAsciiHDRSampler: asciiTexture.source.style,
      uBloom: upTextures[3]!.source, uBloomSampler: upTextures[3]!.source.style,
      compositeUniforms
    }
  });
  const compositePass = createPass(compositeShader, logicalWidth, logicalHeight, "Effulgence Pass 6 · Composite");

  let settings = normalizeEffulgenceSettings(DEFAULT_EFFULGENCE_SETTINGS);
  let currentZoom = worldRoot.scale.x || 0.62;
  let zoomProfile = getZoomProfile(currentZoom);
  let timeSeconds = 0;
  let lights: EffulgenceLight[] = [];
  let activeLightCount = 0;
  let lastCellGrid = String(cellWidth) + ":" + String(cellHeight);

  const setLayers = (nextLayers: WorldLayers | null, previewRoot: Container | null = null): void => {
    const roots = nextLayers
      ? [nextLayers.terrain, nextLayers.details, nextLayers.structures, nextLayers.actors, nextLayers.effects, previewRoot]
      : null;
    glyphBatches.setRoots(roots);
    if (roots) glyphBatches.update();
  };

  const updateLightBuffer = (): void => {
    const projected: Array<{ light: EffulgenceLight; screenX: number; screenY: number; priority: number }> = [];
    const scale = worldRoot.scale.x || 1;
    const cosine = Math.cos(worldRoot.rotation);
    const sine = Math.sin(worldRoot.rotation);
    for (const light of lights) {
      const px = (light.x - worldRoot.pivot.x) * scale;
      const py = (light.y - worldRoot.pivot.y) * scale;
      const screenX = (px * cosine - py * sine + worldRoot.position.x) * pixelRatio;
      const screenY = (px * sine + py * cosine + worldRoot.position.y) * pixelRatio;
      const radiusPx = Math.max(1, light.radius * 26 * scale * pixelRatio);
      const visible = screenX + radiusPx >= 0 && screenY + radiusPx >= 0 &&
        screenX - radiusPx <= physicalWidth && screenY - radiusPx <= physicalHeight;
      if (visible) projected.push({
        light, screenX, screenY,
        priority: (light.priority ?? 0) * 100000 - Math.hypot(screenX - physicalWidth / 2, screenY - physicalHeight / 2)
      });
    }
    projected.sort((a, b) => b.priority - a.priority);
    const active = projected.slice(0, 64);
    lightPixels.fill(0);
    active.forEach(({ light, screenX, screenY }, i) => {
      const flicker = light.flickerHz
        ? 1 + Math.sin(timeSeconds * light.flickerHz * Math.PI * 2) * (light.flickerAmplitude ?? 0)
        : 1;
      const radiusPx = Math.max(1, light.radius * 26 * (worldRoot.scale.x || 1) * pixelRatio);
      const p = i * 4;
      const c = (64 + i) * 4;
      const rgb = parseColor(light.color);
      lightPixels[p] = screenX; lightPixels[p + 1] = screenY;
      lightPixels[p + 2] = radiusPx; lightPixels[p + 3] = light.intensity * flicker;
      lightPixels[c] = rgb[0]; lightPixels[c + 1] = rgb[1];
      lightPixels[c + 2] = rgb[2]; lightPixels[c + 3] = flicker;
    });
    activeLightCount = active.length;
    lightSource.update();
    lightingUniforms.uLightCount.value = activeLightCount;
  };

  const update = (time: number, zoom = worldRoot.scale.x || currentZoom): void => {
    timeSeconds = Number.isFinite(time) ? time : 0;
    currentZoom = Number.isFinite(zoom) ? zoom : currentZoom;
    zoomProfile = getZoomProfile(currentZoom);
    glyphBatches.setView(currentZoom, pixelRatio, cellSizePx[0], cellSizePx[1], settings.density);
    cellUniforms.uZoomNorm.value = zoomProfile.zoomNorm;
    glyphUniforms.uZoomNorm.value = zoomProfile.zoomNorm;
    glyphUniforms.uTerrainMaxLuminance.value = zoomProfile.terrainMaxLuminance;
    glyphUniforms.uEdgeThreshold.value = zoomProfile.edgeThreshold;
    bloomDownUniforms.forEach((uniforms) => {
      uniforms.uBloomRadius.value = 1;
      uniforms.uZoomNorm.value = zoomProfile.zoomNorm;
    });
    bloomUpUniforms.forEach((uniforms) => {
      uniforms.uBloomRadius.value = 1;
      uniforms.uZoomNorm.value = zoomProfile.zoomNorm;
    });
    compositeUniforms.uZoomNorm.value = zoomProfile.zoomNorm;
    cameraModulo[0] = ((Math.floor(worldRoot.position.x * pixelRatio) % cellSizePx[0]) + cellSizePx[0]) % cellSizePx[0];
    cameraModulo[1] = ((Math.floor(worldRoot.position.y * pixelRatio) % cellSizePx[1]) + cellSizePx[1]) % cellSizePx[1];
    cellUniforms.uCameraModulo.value = cameraModulo;
    glyphUniforms.uCameraModulo.value = cameraModulo;
    glyphUniforms.uTime.value = timeSeconds;
    glyphUniforms.uShimmerEnabled.value = settings.shimmerEnabled ? 1 : 0;
    lightingUniforms.uTerrainAmbient.value = settings.terrainAmbient / 100;
    compositeUniforms.uBloomIntensity.value = settings.bloomIntensity / 100 * zoomProfile.bloomIntensityScale;
    updateLightBuffer();
  };

  const render = (): void => {
    glyphBatches.update();
    const previousRenderable = worldRoot.renderable;
    worldRoot.renderable = true;
    app.renderer.render({ container: worldRoot, target: gbuffer, clear: true });
    worldRoot.renderable = false;
    renderPass(app.renderer, lightingPass, lightingTarget);
    renderPass(app.renderer, cellPass, cellTarget);
    renderPass(app.renderer, glyphPass, asciiTarget);
    bloomDownPasses.forEach((pass, i) => renderPass(app.renderer, pass, downTargets[i]!));
    bloomUpPasses.forEach((pass, i) => renderPass(app.renderer, pass, upTargets[i]!));
    renderPass(app.renderer, compositePass, compositeTarget);
    output.width = logicalWidth;
    output.height = logicalHeight;
    if (!previousRenderable) worldRoot.renderable = false;
  };

  const setSettings = (next: EffulgenceSettings): void => {
    settings = normalizeEffulgenceSettings(next);
    density = cellSizeForDensity(settings.density);
    cellSizePx[0] = density[0] * pixelRatio;
    cellSizePx[1] = density[1] * pixelRatio;
    cellWidth = Math.ceil(physicalWidth / cellSizePx[0]) + 1;
    cellHeight = Math.ceil(physicalHeight / cellSizePx[1]) + 1;
    cellUniforms.uCellSize.value = cellSizePx;
    cellUniforms.uInputSize.value[0] = physicalWidth;
    cellUniforms.uInputSize.value[1] = physicalHeight;
    glyphUniforms.uCellSize.value = cellSizePx;
    const glyphPixels = microGlyphActiveSize(settings.density);
    glyphUniforms.uGlyphPixelSize.value[0] = glyphPixels[0];
    glyphUniforms.uGlyphPixelSize.value[1] = glyphPixels[1];
    glyphUniforms.uGlyphBankRow.value = DENSITY_BANK_ROW[settings.density];
    glyphUniforms.uPixelRatio.value = pixelRatio;
    glyphBatches.setView(currentZoom, pixelRatio, cellSizePx[0], cellSizePx[1], settings.density);
    glyphUniforms.uGridSize.value[0] = cellWidth;
    glyphUniforms.uGridSize.value[1] = cellHeight;
    glyphUniforms.uShimmerEnabled.value = settings.shimmerEnabled ? 1 : 0;
    lightingUniforms.uTerrainAmbient.value = settings.terrainAmbient / 100;
    compositeUniforms.uBloomIntensity.value = settings.bloomIntensity / 100 * zoomProfile.bloomIntensityScale;
    const nextKey = String(cellWidth) + ":" + String(cellHeight);
    if (nextKey !== lastCellGrid) {
      cellTarget.resize(cellWidth, cellHeight, 1);
      resizePass(cellPass, cellWidth, cellHeight);
      lastCellGrid = nextKey;
    }
  };

  const setLights = (next: EffulgenceLight[]): void => {
    lights = clusterLights(next);
    updateLightBuffer();
  };

  const resize = (width: number, height: number): void => {
    logicalWidth = Math.max(1, width);
    logicalHeight = Math.max(1, height);
    physicalWidth = Math.max(1, Math.round(logicalWidth * pixelRatio));
    physicalHeight = Math.max(1, Math.round(logicalHeight * pixelRatio));
    gbuffer.resize(logicalWidth, logicalHeight, pixelRatio);
    lightingTarget.resize(logicalWidth, logicalHeight, pixelRatio);
    asciiTarget.resize(logicalWidth, logicalHeight, pixelRatio);
    compositeTarget.resize(logicalWidth, logicalHeight, pixelRatio);

    cellWidth = Math.ceil(physicalWidth / cellSizePx[0]) + 1;
    cellHeight = Math.ceil(physicalHeight / cellSizePx[1]) + 1;
    cellTarget.resize(cellWidth, cellHeight, 1);
    cellUniforms.uInputSize.value[0] = physicalWidth;
    cellUniforms.uInputSize.value[1] = physicalHeight;
    glyphUniforms.uGridSize.value[0] = cellWidth;
    glyphUniforms.uGridSize.value[1] = cellHeight;

    for (let i = 0; i < 4; i++) {
      const divisor = 2 ** (i + 1);
      const w = Math.max(1, Math.ceil(physicalWidth / divisor));
      const h = Math.max(1, Math.ceil(physicalHeight / divisor));
      downTargets[i]!.resize(w, h, 1);
      resizePass(bloomDownPasses[i]!, w, h);
      const sourceW = i === 0 ? physicalWidth : downTargets[i - 1]!.width;
      const sourceH = i === 0 ? physicalHeight : downTargets[i - 1]!.height;
      bloomDownUniforms[i]!.uTexelSize.value[0] = 1 / sourceW;
      bloomDownUniforms[i]!.uTexelSize.value[1] = 1 / sourceH;
    }
    const sizes = [
      [Math.max(1, Math.ceil(physicalWidth / 8)), Math.max(1, Math.ceil(physicalHeight / 8))],
      [Math.max(1, Math.ceil(physicalWidth / 4)), Math.max(1, Math.ceil(physicalHeight / 4))],
      [Math.max(1, Math.ceil(physicalWidth / 2)), Math.max(1, Math.ceil(physicalHeight / 2))],
      [physicalWidth, physicalHeight]
    ];
    sizes.forEach((size, i) => {
      upTargets[i]!.resize(size[0]!, size[1]!, 1);
      resizePass(bloomUpPasses[i]!, size[0]!, size[1]!);
    });
    resizePass(lightingPass, logicalWidth, logicalHeight);
    resizePass(cellPass, cellWidth, cellHeight);
    resizePass(glyphPass, logicalWidth, logicalHeight);
    resizePass(compositePass, logicalWidth, logicalHeight);
    output.width = logicalWidth;
    output.height = logicalHeight;
    updateLightBuffer();
  };

  const stats = () => ({
    gbufferPasses: 1, lightingPasses: 1, cellPasses: 1, glyphPasses: 1,
    bloomPasses: bloomDownPasses.length + bloomUpPasses.length,
    entityInstances: glyphBatches.stats().instances, activeLights: activeLightCount
  });
  glyphBatches.setView(currentZoom, pixelRatio, cellSizePx[0], cellSizePx[1], settings.density);
  setSettings(normalizeEffulgenceSettings(DEFAULT_EFFULGENCE_SETTINGS));

  return {
    output, setSettings, getSettings: () => ({ ...settings }), setLights, setLayers, update, render, resize,
    destroy(): void {
      app.stage.removeChild(output);
      output.destroy({ texture: false });
      glyphBatches.destroy();
      const passes = [lightingPass, cellPass, glyphPass, ...bloomDownPasses, ...bloomUpPasses, compositePass];
      for (const pass of passes) {
        pass.mesh.destroy({ children: true });
        pass.geometry.destroy();
        pass.shader.destroy();
      }
      gbuffer.destroy();
      lightingTarget.destroy();
      cellTarget.destroy();
      asciiTarget.destroy();
      downTargets.forEach((target) => target.destroy());
      upTargets.forEach((target) => target.destroy());
      compositeTarget.destroy();
      [albedo, normalHeight, emissive, entityIds, lightingTexture, cellData, edgeData, asciiTexture,
        ...downTextures, ...upTextures, compositeTexture, lightTexture].forEach((texture) => {
        const source = texture.source;
        texture.destroy(false);
        source.destroy();
      });
    },
    stats
  };
}