export type GlyphDensity = "small" | "medium" | "large";
export type GlyphLodTier = "close" | "standard" | "strategic";

export interface EffulgenceSettings {
  density: GlyphDensity;
  bloomIntensity: number;
  terrainAmbient: number;
  shimmerEnabled: boolean;
}

export interface EffulgenceZoomProfile {
  zoomNorm: number;
  lodTier: GlyphLodTier;
  terrainMaxLuminance: number;
  bloomRadiusScale: number;
  bloomIntensityScale: number;
  edgeThreshold: number;
  unitScale: number;
}

export const DEFAULT_EFFULGENCE_SETTINGS: Readonly<EffulgenceSettings> = Object.freeze({
  density: "medium",
  bloomIntensity: 85,
  terrainAmbient: 100,
  shimmerEnabled: true
});

export const EFFULGENCE_SETTINGS_KEY = "dominium.effulgence.settings.v1";

// Physical-pixel cell sizes: strategic extreme, recommended ultra-dense, balanced.
const CELL_SIZES: Record<GlyphDensity, readonly [number, number]> = {
  small: [4, 6],
  medium: [5, 7],
  large: [6, 8]
};

export const MICRO_GLYPH_CELL = Object.freeze({
  width: 6,
  height: 8,
  activeWidth: 4,
  activeHeight: 6,
  gutterRight: 1,
  gutterBottom: 1
});

export function microGlyphActiveSize(density: GlyphDensity): readonly [number, number] {
  const [cellWidth, cellHeight] = CELL_SIZES[density];
  return [cellWidth - 1, cellHeight - 1];
}

export const LUMINANCE_RAMP = [
  " ", ".", "'", ",", ":", ";", "-", "~",
  "+", "*", "x", "%", "#", "&", "@", "█"
] as const;

export const EDGE_GLYPHS = ["-", "/", "|", "\\", "=", "_", "+", "╳"] as const;

export const HALF_BLOCK_GLYPHS = ["▀", "▄", "▌", "▐", "▖", "▗", "▘", "▝"] as const;

export const SPECIAL_GLYPHS = [
  ">", "^", "/", "-", ".", "*", "~", "'",
  "@", "#", "o", "(", ")", "%", ";", "c",
  "&", "░", "·", "+", "▒", "≈", "=", "║",
  "X", "!", "┼", "†", "T", "♞", "♟", "⚑",
  ...HALF_BLOCK_GLYPHS
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

export function getZoomProfile(zoom: number): EffulgenceZoomProfile {
  const safeZoom = Number.isFinite(zoom) ? Math.max(0.5, Math.min(2.0, zoom)) : 1.0;
  const zoomNorm = Math.max(0, Math.min(1, (safeZoom - 0.5) / (2.0 - 0.5)));
  const lodTier: GlyphLodTier = safeZoom <= 0.65
    ? "strategic"
    : safeZoom >= 1.5 ? "close" : "standard";
  return {
    zoomNorm,
    lodTier,
    terrainMaxLuminance: 0.09 + 0.11 * zoomNorm,
    bloomRadiusScale: 0.45 + 0.55 * zoomNorm,
    bloomIntensityScale: 0.65 + 0.35 * zoomNorm,
    edgeThreshold: 0.14 + 0.10 * zoomNorm,
    unitScale: lodTier === "strategic" ? 1.25 : 1
  };
}

/** Importance order used by Pass 2; layers: terrain=0, building=1, unit=2, selection/VFX=3. */
export function priorityForCellSample(layer: number, emissiveLuminance: number, buildingEdge: boolean): number {
  if ((Number.isFinite(emissiveLuminance) && emissiveLuminance > 1) || layer === 3) return 4;
  if (layer === 2) return 3;
  if (layer === 1 && buildingEdge) return 2;
  return 1;
}

/** Convert a high-resolution alpha mask into a 1-bit glyph with a right/bottom black gutter. */
export function rasterizeMicroGlyph(
  sourceAlpha: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  threshold = 160,
  density: GlyphDensity = "medium"
): Uint8Array {
  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) ||
      sourceWidth <= 0 || sourceHeight <= 0 || sourceAlpha.length < sourceWidth * sourceHeight ||
      sourceWidth % MICRO_GLYPH_CELL.width !== 0 || sourceHeight % MICRO_GLYPH_CELL.height !== 0) {
    throw new RangeError("Micro-glyph source must be a complete 6×8 atlas cell grid.");
  }
  const output = new Uint8Array(MICRO_GLYPH_CELL.width * MICRO_GLYPH_CELL.height);
  const cellScaleX = sourceWidth / MICRO_GLYPH_CELL.width;
  const cellScaleY = sourceHeight / MICRO_GLYPH_CELL.height;
  const [activeWidth, activeHeight] = microGlyphActiveSize(density);
  for (let y = 0; y < activeHeight; y += 1) {
    for (let x = 0; x < activeWidth; x += 1) {
      const x0 = Math.floor(x * cellScaleX);
      const y0 = Math.floor(y * cellScaleY);
      const x1 = Math.floor((x + 1) * cellScaleX);
      const y1 = Math.floor((y + 1) * cellScaleY);
      let lit = false;
      for (let sy = y0; sy < y1 && !lit; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          if ((sourceAlpha[sy * sourceWidth + sx] ?? 0) >= threshold) {
            lit = true;
            break;
          }
        }
      }
      output[y * MICRO_GLYPH_CELL.width + x] = lit ? 255 : 0;
    }
  }
  // Right and bottom gutters remain zero by construction.
  return output;
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
