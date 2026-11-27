import { Container, Text, TextStyle } from "pixi.js";

export interface GlyphSpec {
  char: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
  alpha?: number;
  rotation?: number;
  weight?: "normal" | "bold";
  stroke?: string;
  strokeWidth?: number;
}

const styleCache = new Map<string, TextStyle>();
const FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

function styleFor(spec: GlyphSpec): TextStyle {
  const size = spec.size ?? 14;
  const color = spec.color ?? "#a9b99a";
  const weight = spec.weight ?? "normal";
  const stroke = spec.stroke ?? "";
  const strokeWidth = spec.strokeWidth ?? 0;
  const key = [size, color, weight, stroke, strokeWidth].join("|");
  let style = styleCache.get(key);

  if (!style) {
    style = new TextStyle({
      fontFamily: FONT,
      fontSize: size,
      fontWeight: weight,
      fill: color,
      stroke: stroke ? { color: stroke, width: strokeWidth } : undefined,
      padding: 2,
      align: "center"
    });
    styleCache.set(key, style);
  }

  return style;
}

/** One visible mark. Glyph coordinates are continuous world coordinates, not cells. */
export function addGlyph(parent: Container, spec: GlyphSpec): Text {
  const glyph = new Text({ text: spec.char, style: styleFor(spec) });
  glyph.anchor.set(0.5);
  glyph.position.set(spec.x, spec.y);
  glyph.alpha = spec.alpha ?? 1;
  glyph.rotation = spec.rotation ?? 0;
  glyph.roundPixels = true;
  parent.addChild(glyph);
  return glyph;
}

/** Adds a word as independent glyphs, allowing a hand-composed baseline. */
export function addWord(
  parent: Container,
  word: string,
  x: number,
  y: number,
  size: number,
  color: string,
  spacing = 0.72
): void {
  const letters = [...word];
  const width = (letters.length - 1) * size * spacing;
  letters.forEach((char, index) => {
    const offset = (index * size * spacing) - width / 2;
    const jitter = Math.sin(index * 2.17 + word.length) * size * 0.035;
    addGlyph(parent, {
      char,
      x: x + offset,
      y: y + jitter,
      size,
      color,
      weight: "bold"
    });
  });
}

export function glyphCacheStats(): number {
  return styleCache.size;
}
