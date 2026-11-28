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
