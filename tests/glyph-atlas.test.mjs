import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { glyphAdvance, splitGlyphText } from "../src/engine/glyph.ts";

const readSource = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("GPU atlas ma stałą siatkę 16×32 z 64 zarezerwowanymi slotami Effulgence", async () => {
  const source = await readSource("../src/engine/glyph-batch.ts");
  assert.match(source, /ATLAS_COLUMNS\s*=\s*16/);
  assert.match(source, /ATLAS_ROWS\s*=\s*32/);
  assert.match(source, /ATLAS_CELL_WIDTH\s*=\s*48/);
  assert.match(source, /ATLAS_CELL_HEIGHT\s*=\s*64/);
  assert.match(source, /GLYPH_ATLAS_CHARS\.entries\(\)/);
  assert.match(source, /atlas\.nextSlot\s*=\s*GLYPH_ATLAS_CHARS\.length/);
  assert.match(source, /BufferImageSource/);
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

test("świat używa instancjonowanych quadów GPU zamiast osobnych Text/Sprite na każdy znak", async () => {
  const files = [
    "../src/engine/glyph.ts",
    "../src/engine/world.ts",
    "../src/main.ts"
  ];
  for (const file of files) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /new\s+Text\s*\(/, file);
    assert.doesNotMatch(source, /new\s+Sprite\s*\(/, file);
    assert.doesNotMatch(source, /import\s*\{[^}]*\bText\b/s, file);
  }
  const batch = await readSource("../src/engine/glyph-batch.ts");
  assert.match(batch, /BufferUsage\.VERTEX/);
  assert.match(batch, /instance:\s*true/);
  assert.match(batch, /divisor:\s*1/);
  assert.match(batch, /instanceCount/);
});

test("render graph tworzy cztery bufory G-Buffer w formatach zgodnych ze specyfikacją", async () => {
  const source = await readSource("../src/engine/render-graph.ts");
  const batch = await readSource("../src/engine/glyph-batch.ts");
  assert.match(source, /format:\s*"rgba8unorm"/);
  assert.match(source, /format:\s*"rgba16float"/);
  assert.match(source, /format:\s*"rgba8uint"/);
  assert.match(source, /Effulgence Pass 0 · G-Buffer/);
  assert.match(batch, /outAlbedo/);
  assert.match(batch, /outNormalHeight/);
  assert.match(batch, /outEmissive/);
  assert.match(batch, /outEntityID/);
});

test("oświetlenie i downsample używają wysokości, normalnych, ID oraz limitu 64 świateł", async () => {
  const source = await readSource("../src/engine/render-graph.ts");
  assert.match(source, /for \(int i = 0; i < 64; i\+\+\)/);
  assert.match(source, /return result\.slice\(0, 64\)/);
  assert.match(source, /uNormalHeight/);
  assert.match(source, /uEntityIDs/);
  assert.match(source, /edgeMag/);
  assert.match(source, /0\.8/);
  assert.match(source, /1\.2/);
});

test("render graph stosuje ośmioprzebiegowy Dual-Kawase i kompozycję ACES", async () => {
  const source = await readSource("../src/engine/render-graph.ts");
  assert.match(source, /length: 4/);
  assert.match(source, /Kawase Down/);
  assert.match(source, /Kawase Up/);
  assert.match(source, /uThreshold.*0\.72/s);
  assert.match(source, /uKnee.*0\.15/s);
  assert.match(source, /vec3 aces\(/);
  assert.match(source, /0\.88/);
});

test("migotanie jest zależne od flagi animowanego materiału, a nie koloru powierzchni", async () => {
  const batch = await readSource("../src/engine/glyph-batch.ts");
  const graph = await readSource("../src/engine/render-graph.ts");
  assert.match(batch, /record\.animated \? 128 : 0/);
  assert.match(graph, /edges\.a > 0\.5/);
  assert.match(graph, /floor\(uTime \* 8\.0\)/);
  assert.doesNotMatch(graph, /color\.g\s*>\s*color\.r/);
});

test("stara ścieżka Pixi Filter została usunięta, a podgląd budowania ma osobną partię", async () => {
  const legacy = await readSource("../src/engine/effulgence.ts");
  const graph = await readSource("../src/engine/render-graph.ts");
  const main = await readSource("../src/main.ts");
  assert.doesNotMatch(legacy, /Filter\.from|createEffulgenceRenderer/);
  assert.match(graph, /previewRoot/);
  assert.match(graph, /material: "selection"/);
  assert.match(main, /effulgence\.setLayers\(world\.layers, buildPreviewLayer\)/);
  assert.doesNotMatch(main, /world\.layers\.effects\.removeChildren\(\)/);
});
