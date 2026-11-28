import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { glyphAdvance, splitGlyphText } from "../src/engine/glyph.ts";

const readSource = (file) => readFile(new URL(file, import.meta.url), "utf8");

test("GPU atlas ma siatkę 16×32 z trzema bankami gęstości", async () => {
  const source = await readSource("../src/engine/glyph-batch.ts");
  assert.match(source, /ATLAS_COLUMNS\s*=\s*16/);
  assert.match(source, /ATLAS_ROWS\s*=\s*32/);
  assert.match(source, /ATLAS_CELL_WIDTH\s*=\s*6/);
  assert.match(source, /ATLAS_CELL_HEIGHT\s*=\s*8/);
  assert.match(source, /BASE_GLYPH_BANKS\s*=\s*3/);
  assert.match(source, /BASE_GLYPH_SLOTS\s*=\s*GLYPH_ATLAS_CHARS\.length\s*\*\s*BASE_GLYPH_BANKS/);
  assert.match(source, /DENSITY_BANKS[\s\S]*"small"[\s\S]*"medium"[\s\S]*"large"/);
  assert.match(source, /RASTER_SCALE\s*=\s*8/);
  assert.match(source, /scaleMode:\s*"nearest"/);
  assert.match(source, /GLYPH_ATLAS_CHARS\.entries\(\)/);
  assert.match(source, /nextSlot:\s*BASE_GLYPH_SLOTS/);
  assert.match(source, /BufferImageSource/);
  assert.match(source, /rasterizeMicroGlyph/);
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
  assert.match(batch, /aInstanceEmission/);
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
  assert.match(source, /uEmissive/);
  assert.ok(source.includes("emissiveStrength > 1.0 || layer == 3"));
  assert.ok(source.includes("else if (layer == 2 || layer == 4) priority = 3"));
  assert.ok(source.includes("else if (layer == 1 && buildingEdge) priority = 2"));
  assert.ok(source.includes("vec3(1.05, 1.0, 0.86)"));
  assert.ok(source.includes("winningLayer == 0 && !priorityFour"));
  assert.ok((await readSource("../src/engine/glyph-batch.ts")).includes("overview: 4"));
  assert.match(source, /bestScore/);
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
  assert.ok(graph.includes("mod(floor(edges.a / 8.0), 2.0)"));
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

test("shader używa wymiarów mikro-atlasu 96×256 i półbloków dla silnych krawędzi", async () => {
  const graph = await readSource("../src/engine/render-graph.ts");
  const effect = await readSource("../src/engine/effulgence.ts");
  assert.ok(graph.includes("new Float32Array([96, 256])"));
  assert.ok(graph.includes("vec2(6.0, 8.0)"));
  assert.ok(graph.includes("uGlyphPixelSize"));
  assert.ok(graph.includes("uGlyphBankRow"));
  assert.ok(graph.includes("glyphIndex = edges.g >= 0.0 ? 56 : 57"));
  assert.match(effect, /gutterRight:\s*1/);
  assert.match(effect, /gutterBottom:\s*1/);
});

test("oddziały zawierają trzy poziomy detalu i znaczniki taktyczne [xN]", async () => {
  const world = await readSource("../src/engine/world.ts");
  const batch = await readSource("../src/engine/glyph-batch.ts");
  assert.ok(world.includes('material: "overview"'));
  assert.ok(world.includes('sand: { char: "░", color: "#c7b78f", alpha: 0.82 }'));
  assert.ok(batch.includes('overview: 4'));
  assert.ok(world.includes('lod: "close"'));
  assert.ok(world.includes('lod: "standard"'));
  assert.ok(world.includes('lod: "strategic"'));
  assert.ok(world.includes('Array.from(String(count))'));
  assert.ok(world.includes('minScreenCells: [2, 2]'));
  assert.ok(world.includes('archers: "⌁", crossbowmen: "╳", pikemen: "⚔"'));
  assert.ok(world.includes('minScreenCells: [1, 1]'));
  assert.ok(world.includes("minScreenCells: [1, 1]"));
  assert.ok(world.includes('setGlyphTreeLod(group, ["standard", "close"])'));
  assert.ok(world.includes('lod: "strategic"'));
  const main = await readSource("../src/main.ts");
  assert.ok(main.includes("unitPickRadiusWorld(zoom, densityCellHeight)"));
  assert.ok(main.includes("minScreenCells: [1, 2]"));
  assert.ok(batch.includes("allowedTiers.includes(profile.lodTier)"));
  assert.ok(batch.includes("profile.unitScale"));
  assert.ok(batch.includes("screenSpaceGlyphMinimum"));
  assert.ok(batch.includes("microGlyphActiveSize(atlas.view.density)"));
  assert.match(batch, /setView\(zoom: number, pixelRatio: number, cellWidth: number, cellHeight: number, density: GlyphDensity\)/);
});