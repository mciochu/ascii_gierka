import { addGlyph, glyphAdvance, type GlyphDisplay, type GlyphLodSet, type GlyphMaterialKind } from "./glyph";
import { KENNEY_GLYPH_SPRITES } from "./kenney-sprites.generated";

export interface KenneySpriteOptions {
  cellSize?: number;
  material?: GlyphMaterialKind;
  height?: number;
  lod?: GlyphLodSet;
  alpha?: number;
  entityId?: string | number;
}

/**
 * Draws a pre-converted Kenney sprite using colored Unicode glyphs only.
 * No PNG, Canvas, texture, or sprite is used by the running game.
 */
export function addKenneySprite(
  parent: Parameters<typeof addGlyph>[0],
  spriteId: string,
  x: number,
  y: number,
  options: KenneySpriteOptions = {}
): GlyphDisplay[] {
  const sprite = KENNEY_GLYPH_SPRITES[spriteId];
  if (!sprite) return [];
  const cellSize = Math.max(2, options.cellSize ?? 6.5);
  const advance = glyphAdvance(cellSize);
  const left = -((sprite.width - 1) * advance) / 2;
  const top = -((sprite.height - 1) * cellSize) / 2;
  const output: GlyphDisplay[] = [];

  for (let row = 0; row < sprite.height; row += 1) {
    const glyphs = Array.from(sprite.rows[row] ?? "");
    const colors = sprite.colors[row] ?? [];
    for (let column = 0; column < sprite.width; column += 1) {
      const character = glyphs[column] ?? " ";
      const color = colors[column] ?? "";
      if (character === " " || !color) continue;
      output.push(addGlyph(parent, {
        char: character,
        x: x + left + column * advance,
        y: y + top + row * cellSize,
        size: cellSize,
        color,
        alpha: options.alpha ?? 0.98,
        material: options.material ?? "building",
        height: options.height ?? 0.22,
        ...(options.lod ? { lod: options.lod } : {}),
        ...(options.entityId ? { entityId: options.entityId } : {})
      }));
    }
  }
  return output;
}
