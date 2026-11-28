import { Container } from "pixi.js";

export type GlyphMaterialKind = "terrain" | "building" | "unit" | "selection" | "vfx" | "utility";
export type GlyphLod = "close" | "standard" | "strategic";
export type GlyphLodSet = GlyphLod | readonly GlyphLod[];

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
  material?: GlyphMaterialKind;
  height?: number;
  emissive?: number;
  emissiveColor?: string;
  animated?: boolean;
  normal?: readonly [number, number, number];
  entityId?: string | number;
  lod?: GlyphLodSet;
  strategicGlyph?: string;
  minScreenCells?: readonly [number, number];
}

export interface GlyphInstanceRecord {
  character: string;
  offsetX: number;
  offsetY: number;
  size: number;
  weight: "normal" | "bold";
  color: string;
  stroke?: string;
  strokeWidth: number;
  height: number;
  emissive: number;
  emissiveColor: string;
  animated: boolean;
  material: GlyphMaterialKind | null;
  entityId: string | number | null;
  normal: readonly [number, number, number];
  lod?: GlyphLodSet;
  strategicGlyph?: string;
  minScreenCells?: readonly [number, number];
}

/**
 * A scene-graph node containing glyph data only.
 *
 * It intentionally owns no PixiJS Text, Sprite, or per-glyph texture. The
 * Effulgence renderer collects these records and submits them to GPU
 * instanced-quad batches, grouped by world layer.
 */
export class GlyphDisplay extends Container {
  private _text = "";
  private fillColor: string;
  private readonly fontSize: number;
  private readonly fontWeight: "normal" | "bold";
  private readonly strokeColor?: string;
  private readonly strokeWidth: number;
  private readonly material: GlyphMaterialKind | null;
  private readonly glyphHeight: number;
  private readonly emissive: number;
  private readonly emissiveColor: string;
  private readonly animated: boolean;
  private readonly normal: readonly [number, number, number];
  private readonly explicitEntityId: string | number | null;
  private lod?: GlyphLodSet;
  private readonly strategicGlyph?: string;
  private readonly minScreenCells?: readonly [number, number];
  private _records: GlyphInstanceRecord[] = [];
  readonly style: { fill: string };

  constructor(parent: Container, spec: GlyphSpec) {
    super();
    this.fillColor = spec.color ?? "#a9b99a";
    this.fontSize = Math.max(1, spec.size ?? 14);
    this.fontWeight = spec.weight ?? "normal";
    this.strokeColor = spec.stroke;
    this.strokeWidth = Math.max(0, spec.strokeWidth ?? 0);
    this.material = spec.material ?? null;
    this.glyphHeight = spec.height === undefined ? -1 : clamp01(spec.height);
    this.emissive = Math.max(0, Number.isFinite(spec.emissive) ? spec.emissive! : 0);
    this.emissiveColor = spec.emissiveColor ?? this.fillColor;
    this.animated = spec.animated ?? false;
    this.normal = spec.normal ?? [0, 0, 1];
    this.explicitEntityId = spec.entityId ?? null;
    this.lod = spec.lod;
    this.strategicGlyph = spec.strategicGlyph;
    this.minScreenCells = spec.minScreenCells;

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
    this.rebuildRecords();
  }

  get glyphRecords(): readonly GlyphInstanceRecord[] {
    return this._records;
  }

  get fontSizeValue(): number {
    return this.fontSize;
  }

  get fontWeightValue(): "normal" | "bold" {
    return this.fontWeight;
  }

  get fillValue(): string {
    return this.fillColor;
  }

  get materialValue(): GlyphMaterialKind | null {
    return this.material;
  }

  setFill(color: string): void {
    this.fillColor = color;
    this.rebuildRecords();
  }

  setLod(lod: GlyphLodSet | undefined): void {
    this.lod = lod;
    this.rebuildRecords();
  }

  private rebuildRecords(): void {
    const characters = splitGlyphText(this._text);
    const advance = glyphAdvance(this.fontSize);
    const startX = -((characters.length - 1) * advance) / 2;
    this._records = characters.map((character, index) => ({
      character,
      offsetX: startX + index * advance,
      offsetY: 0,
      size: this.fontSize,
      weight: this.fontWeight,
      color: this.fillColor,
      ...(this.strokeColor ? { stroke: this.strokeColor } : {}),
      strokeWidth: this.strokeWidth,
      height: this.glyphHeight,
      emissive: this.emissive,
      emissiveColor: this.emissiveColor,
      animated: this.animated,
      material: this.material,
      entityId: this.explicitEntityId,
      normal: this.normal,
      ...(this.lod ? { lod: this.lod } : {}),
      ...(this.strategicGlyph ? { strategicGlyph: this.strategicGlyph } : {}),
      ...(this.minScreenCells ? { minScreenCells: this.minScreenCells } : {})
    }));
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function splitGlyphText(value: string): string[] {
  return Array.from(value);
}

export function glyphAdvance(fontSize: number): number {
  return Math.max(1, fontSize * 0.68);
}

export function addGlyph(parent: Container, spec: GlyphSpec): GlyphDisplay {
  return new GlyphDisplay(parent, spec);
}

/** Adds a word as independent glyph nodes, preserving the original custom baseline. */
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
