import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  GLYPH_ATLAS_LAYOUT,
  glyphAdvance,
  splitGlyphText
} from "../src/engine/glyph.ts";

test("wspólny atlas glifów ma stałą siatkę i bezpieczną pojemność", () => {
  assert.deepEqual(GLYPH_ATLAS_LAYOUT, {
    cellWidth: 48,
    cellHeight: 64,
    columns: 16,
    rows: 32
  });
  assert.equal(GLYPH_ATLAS_LAYOUT.columns * GLYPH_ATLAS_LAYOUT.rows, 512);
});

test("dzielenie tekstu zachowuje polskie znaki i znaki spoza BMP jako pojedyncze glify", () => {
  assert.deepEqual(splitGlyphText("ŁUCZ x32"), ["Ł", "U", "C", "Z", " ", "x", "3", "2"]);
  assert.deepEqual(splitGlyphText("👑A"), ["👑", "A"]);
});

test("odstęp glifu skaluje się liniowo z rozmiarem fontu", () => {
  assert.equal(glyphAdvance(10), 6.800000000000001);
  assert.equal(glyphAdvance(20), 13.600000000000001);
  assert.equal(glyphAdvance(0), 1);
});

test("mapa nie tworzy już obiektów PixiJS Text dla glifów świata", async () => {
  const files = [
    "../src/engine/glyph.ts",
    "../src/engine/world.ts",
    "../src/main.ts"
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /new\s+Text\s*\(/, file);
    assert.doesNotMatch(source, /import\s*\{[^}]*\bText\b/s, file);
  }
});
