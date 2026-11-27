import { Container, Rectangle, Sprite, Texture } from "pixi.js";

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

export const GLYPH_ATLAS_LAYOUT = Object.freeze({
  cellWidth: 48,
  cellHeight: 64,
  columns: 16,
  rows: 32
});

const FONT = '"JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Consolas, monospace';
const FONT_SIZE = 45;
const DEFAULT_COLOR = "#a9b99a";
const textureCache = new Map<string, Texture>();

type GlyphAtlas = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  sourceTexture: Texture;
  dirty: boolean;
};

let atlas: GlyphAtlas | null = null;

function ensureAtlas(): GlyphAtlas {
  if (atlas) return atlas;

  const canvas = document.createElement("canvas");
  canvas.width = GLYPH_ATLAS_LAYOUT.cellWidth * GLYPH_ATLAS_LAYOUT.columns;
  canvas.height = GLYPH_ATLAS_LAYOUT.cellHeight * GLYPH_ATLAS_LAYOUT.rows;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Cannot create the shared DOMINIUM glyph atlas.");

  context.clearRect(0, 0, canvas.width, canvas.height);
  const sourceTexture = Texture.from(canvas);
  sourceTexture.source.scaleMode = "linear";

  atlas = { canvas, context, sourceTexture, dirty: false };
  return atlas;
}

function cacheKey(character: string, weight: "normal" | "bold"): string {
  return weight + ":" + character;
}

function glyphTexture(character: string, weight: "normal" | "bold"): Texture {
  const key = cacheKey(character, weight);
  const existing = textureCache.get(key);
  if (existing) return existing;

  const state = ensureAtlas();
  const index = textureCache.size;
  const capacity = GLYPH_ATLAS_LAYOUT.columns * GLYPH_ATLAS_LAYOUT.rows;
  if (index >= capacity) {
    if (character !== "?") return glyphTexture("?", weight);
    throw new Error("The shared DOMINIUM glyph atlas is full.");
  }

  const column = index % GLYPH_ATLAS_LAYOUT.columns;
  const row = Math.floor(index / GLYPH_ATLAS_LAYOUT.columns);
  const x = column * GLYPH_ATLAS_LAYOUT.cellWidth;
  const y = row * GLYPH_ATLAS_LAYOUT.cellHeight;

  state.context.clearRect(x, y, GLYPH_ATLAS_LAYOUT.cellWidth, GLYPH_ATLAS_LAYOUT.cellHeight);
  state.context.fillStyle = "#ffffff";
  state.context.textAlign = "center";
  state.context.textBaseline = "middle";
  state.context.font = (weight === "bold" ? "700 " : "500 ") + FONT_SIZE + "px " + FONT;
  state.context.fillText(
    character,
    x + GLYPH_ATLAS_LAYOUT.cellWidth / 2,
    y + GLYPH_ATLAS_LAYOUT.cellHeight / 2 + 1
  );
  state.dirty = true;

  const frame = new Rectangle(x, y, GLYPH_ATLAS_LAYOUT.cellWidth, GLYPH_ATLAS_LAYOUT.cellHeight);
  const texture = new Texture({
    source: state.sourceTexture.source,
    frame,
    orig: new Rectangle(0, 0, GLYPH_ATLAS_LAYOUT.cellWidth, GLYPH_ATLAS_LAYOUT.cellHeight)
  });
  textureCache.set(key, texture);
  return texture;
}

function colorToTint(color: string | undefined): number {
  const value = (color ?? DEFAULT_COLOR).trim();
  const normalized = value.startsWith("#") ? value.slice(1) : value;
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  const parsed = Number.parseInt(expanded, 16);
  return Number.isFinite(parsed) ? parsed : 0xffffff;
}

function createSprite(
  character: string,
  weight: "normal" | "bold",
  color: string,
  size: number,
  x: number,
  y: number
): Sprite {
  const sprite = new Sprite(glyphTexture(character, weight));
  sprite.anchor.set(0.5);
  sprite.setSize(size * 0.72, size * 1.05);
  sprite.position.set(x, y);
  sprite.tint = colorToTint(color);
  sprite.roundPixels = true;
  return sprite;
}

/**
 * A lightweight display object backed by a shared glyph atlas.
 *
 * Text is rasterized into the atlas once per distinct character and weight.
 * The scene then renders atlas-backed quads that PixiJS can batch by texture
 * source; it no longer creates a PixiJS Text object for every visible mark.
 */
export class GlyphDisplay extends Container {
  private _text = "";
  private fillColor: string;
  private readonly fontSize: number;
  private readonly fontWeight: "normal" | "bold";
  private readonly strokeColor: string | undefined;
  private readonly strokeWidth: number;
  readonly style: { fill: string };

  constructor(parent: Container, spec: GlyphSpec) {
    super();
    this.fillColor = spec.color ?? DEFAULT_COLOR;
    this.fontSize = spec.size ?? 14;
    this.fontWeight = spec.weight ?? "normal";
    this.strokeColor = spec.stroke;
    this.strokeWidth = Math.max(0, spec.strokeWidth ?? 0);

    const self = this;
    this.style = Object.defineProperty({}, "fill", {
      enumerable: true,
      get: () => self.fillColor,
      set: (value: string) => self.setFill(value)
    }) as { fill: string };

    this.position.set(spec.x, spec.y);
    this.alpha = spec.alpha ?? 1;
    this.rotation = spec.rotation ?? 0;
    this.text = spec.char;
    parent.addChild(this);
  }

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    const next = String(value ?? "");
    if (next === this._text) return;
    this._text = next;
    this.rebuildGlyphs();
  }

  setFill(color: string): void {
    this.fillColor = color;
    for (const child of this.children) {
      if (child instanceof Sprite && child.label !== "glyph-stroke") {
        child.tint = colorToTint(color);
      }
    }
  }

  private rebuildGlyphs(): void {
    const previous = this.removeChildren();
    for (const child of previous) child.destroy({ texture: false });

    const characters = splitGlyphText(this._text);
    if (characters.length === 0) return;

    const advance = glyphAdvance(this.fontSize);
    const startX = -((characters.length - 1) * advance) / 2;
    characters.forEach((character, index) => {
      const x = startX + index * advance;

      if (this.strokeColor && this.strokeWidth > 0) {
        const offsets = [
          [-1, 0], [1, 0], [0, -1], [0, 1],
          [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]
        ];
        for (const [dx, dy] of offsets) {
          const outline = createSprite(
            character, this.fontWeight, this.strokeColor, this.fontSize,
            x + dx * this.strokeWidth, dy * this.strokeWidth
          );
          outline.label = "glyph-stroke";
          this.addChild(outline);
        }
      }

      this.addChild(createSprite(
        character, this.fontWeight, this.fillColor, this.fontSize, x, 0
      ));
    });
  }
}

export function splitGlyphText(value: string): string[] {
  return Array.from(value);
}

export function glyphAdvance(fontSize: number): number {
  return Math.max(1, fontSize * 0.68);
}

/** Uploads all newly rasterized atlas cells once, just before a frame is drawn. */
export function flushGlyphAtlas(): void {
  if (!atlas?.dirty) return;
  atlas.sourceTexture.source.update();
  atlas.dirty = false;
}

export function addGlyph(parent: Container, spec: GlyphSpec): GlyphDisplay {
  return new GlyphDisplay(parent, spec);
}

/** Adds a word as independent atlas glyphs, allowing a hand-composed baseline. */
export function addWord(
  parent: Container,
  word: string,
  x: number,
  y: number,
  size: number,
  color: string,
  spacing = 0.72
): void {
  const letters = splitGlyphText(word);
  const width = (letters.length - 1) * size * spacing;
  letters.forEach((character, index) => {
    const offset = (index * size * spacing) - width / 2;
    const jitter = Math.sin(index * 2.17 + word.length) * size * 0.035;
    addGlyph(parent, {
      char: character,
      x: x + offset,
      y: y + jitter,
      size,
      color,
      weight: "bold"
    });
  });
}

export function glyphCacheStats(): number {
  return textureCache.size;
}

export function glyphAtlasStats(): {
  glyphCount: number;
  capacity: number;
  dirty: boolean;
} {
  return {
    glyphCount: textureCache.size,
    capacity: GLYPH_ATLAS_LAYOUT.columns * GLYPH_ATLAS_LAYOUT.rows,
    dirty: atlas?.dirty ?? false
  };
}
