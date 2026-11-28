import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EFFULGENCE_SETTINGS,
  EDGE_GLYPHS,
  GLYPH_ATLAS_CHARS,
  LUMINANCE_RAMP,
  SPECIAL_GLYPHS,
  HALF_BLOCK_GLYPHS,
  MICRO_GLYPH_CELL,
  cellSizeForDensity,
  microGlyphActiveSize,
  screenSpaceGlyphMinimum,
  unitPickRadiusWorld,
  edgeGlyphIndexForAngle,
  getZoomProfile,
  priorityForCellSample,
  rasterizeMicroGlyph,
  normalizeEffulgenceSettings,
  quantizeLuminance
} from "../src/engine/effulgence.ts";

test("atlas Effulgence ma dokładnie 64 sloty: rampa, krawędzie i glify specjalne", () => {
  assert.equal(LUMINANCE_RAMP.length, 16);
  assert.equal(EDGE_GLYPHS.length, 8);
  assert.equal(SPECIAL_GLYPHS.length, 40);
  assert.equal(GLYPH_ATLAS_CHARS.length, 64);
  assert.equal(HALF_BLOCK_GLYPHS.length, 8);
  assert.equal(LUMINANCE_RAMP[0], " ");
  assert.equal(LUMINANCE_RAMP[15], "█");
});

test("kwantyzacja luminancji wybiera 16 poziomów i ogranicza wartości wejściowe", () => {
  assert.equal(quantizeLuminance(-1), 0);
  assert.equal(quantizeLuminance(0), 0);
  assert.equal(quantizeLuminance(0.0449), 0);
  assert.equal(quantizeLuminance(0.045), 1);
  assert.equal(quantizeLuminance(0.965), 15);
  assert.equal(quantizeLuminance(1), 15);
  assert.equal(quantizeLuminance(2), 15);
  assert.equal(quantizeLuminance(Number.NaN), 0);
});

test("detekcja kąta krawędzi mapuje cztery kierunki i narożniki", () => {
  assert.equal(edgeGlyphIndexForAngle(0), 16);
  assert.equal(edgeGlyphIndexForAngle(26.565), 17);
  assert.equal(edgeGlyphIndexForAngle(90), 18);
  assert.equal(edgeGlyphIndexForAngle(135), 19);
  assert.equal(edgeGlyphIndexForAngle(170), 16);
  assert.equal(edgeGlyphIndexForAngle(45, true), 22);
});

test("gęstość komórek utrzymuje rozmiary dla trzech poziomów", () => {
  assert.deepEqual(cellSizeForDensity("small"), [4, 6]);
  assert.deepEqual(cellSizeForDensity("medium"), [5, 7]);
  assert.deepEqual(cellSizeForDensity("large"), [6, 8]);
});

test("ustawienia renderera mają bezpieczne wartości domyślne i ograniczenia", () => {
  assert.deepEqual(normalizeEffulgenceSettings(null), DEFAULT_EFFULGENCE_SETTINGS);
  assert.deepEqual(normalizeEffulgenceSettings({
    density: "large", bloomIntensity: 999, terrainAmbient: 1, shimmerEnabled: false
  }), {
    density: "large", bloomIntensity: 150, terrainAmbient: 50, shimmerEnabled: false
  });
  assert.deepEqual(normalizeEffulgenceSettings({
    density: "broken", bloomIntensity: Number.NaN, terrainAmbient: Number.POSITIVE_INFINITY
  }), DEFAULT_EFFULGENCE_SETTINGS);
});


test("mikro-atlas ma trzy maski 1-bit z osobnym czarnym gutterem i czarną rynnę po prawej oraz na dole", () => {
  assert.deepEqual(MICRO_GLYPH_CELL, {
    width: 6, height: 8, activeWidth: 4, activeHeight: 6, gutterRight: 1, gutterBottom: 1
  });
  assert.deepEqual(microGlyphActiveSize("small"), [3, 5]);
  assert.deepEqual(microGlyphActiveSize("medium"), [4, 6]);
  assert.deepEqual(microGlyphActiveSize("large"), [5, 7]);
  const source = new Uint8Array(48 * 64);
  source[0] = 255;
  source[47 * 48 + 31] = 255;
  const mask = rasterizeMicroGlyph(source, 48, 64, 160, "medium");
  assert.equal(mask.length, 48);
  assert.ok([...mask].every((pixel) => pixel === 0 || pixel === 255));
  assert.equal(mask[0], 255);
  assert.equal(mask[5 * 6 + 3], 255);
  for (let y = 0; y < 8; y += 1) assert.equal(mask[y * 6 + 4], 0);
  for (let x = 0; x < 6; x += 1) assert.equal(mask[6 * 6 + x], 0);
});

test("priorytety próbkowania komórki zachowują jednostki, krawędzie, selekcję i emisję", () => {
  assert.equal(priorityForCellSample(0, 1.01, false), 4);
  assert.equal(priorityForCellSample(3, 0, false), 4);
  assert.equal(priorityForCellSample(2, 0, false), 3);
  assert.equal(priorityForCellSample(1, 0, true), 2);
  assert.equal(priorityForCellSample(1, 0, false), 1);
  assert.equal(priorityForCellSample(0, 0, false), 1);
});

test("profil zoomu zmienia teren, bloom, próg krawędzi i rozmiar oddziału", () => {
  const far = getZoomProfile(0.15);
  assert.equal(far.zoomNorm, 0);
  assert.equal(far.lodTier, "strategic");
  assert.equal(far.terrainMaxLuminance, 0.16);
  assert.equal(far.bloomRadiusScale, 0.38);
  assert.equal(far.bloomIntensityScale, 0.62);
  assert.equal(far.edgeThreshold, 0.13);
  assert.equal(far.unitScale, 1.12);
  const half = getZoomProfile(0.5);
  assert.equal(half.lodTier, "strategic");
  const standard = getZoomProfile(1.0);
  assert.ok(Math.abs(standard.zoomNorm - (0.85 / 1.85)) < 1e-10);
  assert.equal(standard.lodTier, "standard");
  const close = getZoomProfile(2.0);
  assert.equal(close.zoomNorm, 1);
  assert.equal(close.lodTier, "close");
  assert.ok(Math.abs(close.terrainMaxLuminance - 0.23) < 1e-10);
  assert.equal(close.bloomRadiusScale, 1);
  assert.equal(close.bloomIntensityScale, 1);
  assert.ok(Math.abs(close.edgeThreshold - 0.24) < 1e-10);
  assert.equal(close.unitScale, 1);
  assert.equal(getZoomProfile(0.68).lodTier, "strategic");
  assert.equal(getZoomProfile(0.69).lodTier, "standard");
  assert.equal(getZoomProfile(3).zoomNorm, 1);
});


test("screen-space clamp utrzymuje rozmiar ekranowy także przy oddaleniu i HiDPI", () => {
  assert.deepEqual(screenSpaceGlyphMinimum([1, 2], 10, 14, 2), [5, 14]);
  assert.deepEqual(screenSpaceGlyphMinimum([1, 1], 12, 16, 2), [6, 8]);
  assert.deepEqual(screenSpaceGlyphMinimum([1, 2], 5, 7, 1), [5, 14]);
  const overviewSize = screenSpaceGlyphMinimum([2, 2], 5, 7, 1, 0.15);
  assert.ok(Math.abs(overviewSize[0] - 200 / 3) < 1e-10);
  assert.ok(Math.abs(overviewSize[1] - 280 / 3) < 1e-10);
  assert.deepEqual(screenSpaceGlyphMinimum([1, 1], 5, 7, 2, 0.5), [5, 7]);
});

test("promień klikalności oddziału pozostaje stały w pikselach przy zoomie 0.15×, 0.5×, 1× i 2×", () => {
  for (const zoom of [0.15, 0.5, 1, 2]) {
    const worldRadius = unitPickRadiusWorld(zoom, 7);
    assert.ok(Math.abs(worldRadius * zoom - 14) < 1e-10);
  }
  assert.equal(unitPickRadiusWorld(1, 12), 18);
});