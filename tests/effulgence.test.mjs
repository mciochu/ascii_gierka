import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EFFULGENCE_SETTINGS,
  EDGE_GLYPHS,
  GLYPH_ATLAS_CHARS,
  LUMINANCE_RAMP,
  SPECIAL_GLYPHS,
  cellSizeForDensity,
  edgeGlyphIndexForAngle,
  normalizeEffulgenceSettings,
  quantizeLuminance
} from "../src/engine/effulgence.ts";

test("atlas Effulgence ma dokładnie 64 sloty: rampa, krawędzie i glify specjalne", () => {
  assert.equal(LUMINANCE_RAMP.length, 16);
  assert.equal(EDGE_GLYPHS.length, 8);
  assert.equal(SPECIAL_GLYPHS.length, 40);
  assert.equal(GLYPH_ATLAS_CHARS.length, 64);
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
  assert.deepEqual(cellSizeForDensity("small"), [6, 9]);
  assert.deepEqual(cellSizeForDensity("medium"), [8, 12]);
  assert.deepEqual(cellSizeForDensity("large"), [10, 15]);
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
