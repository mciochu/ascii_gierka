import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

test("HUD ma wszystkie cztery bloki, księgę, narzędzia i minimapę", () => {
  for (const id of [
    "build-categories", "context-content", "scribe-popularity", "scribe-gold",
    "scribe-population", "undo-button", "demolish-button", "rank-button",
    "diplomacy-button", "options-button", "minimap", "minimap-grid", "minimap-camera"
  ]) {
    assert.match(html, new RegExp('id="' + id + '"|class="[^"]*' + id + '[^"]*"'), "brak elementu " + id);
  }
  assert.equal((html.match(/data-category=/g) ?? []).length, 6);
  assert.match(html, /id="hud-reveal"/);
});

test("HUD działa bez starych referencji do bocznego inspektora i prawego przycisku rozkazów", () => {
  assert.doesNotMatch(main, /selection-content|\.inspector|handleContextCommand/);
  assert.match(main, /event\.button === 2[\s\S]{0,180}kind: "context"/);
  assert.match(main, /function handleLeftClick/);
  assert.match(main, /function renderMinimap/);
  assert.match(main, /minimap\.addEventListener\("pointerdown", \(event\) => \{\n  if \(event\.button !== 0\) return;/);
});

test("panel wojska wystawia wszystkie trzy postawy", () => {
  for (const stance of ["stand-ground", "defensive", "aggressive"]) {
    assert.ok(main.includes('data-stance="' + stance + '"'), "brak postawy " + stance);
  }
  assert.match(main, /function setUnitStance/);
  assert.match(main, /const acquireRange = unit\.stance === "aggressive"/);
});

test("Opcje udostępniają lokalny zapis i wczytanie walidowanego stanu", () => {
  assert.match(main, /data-dialog-action="save"/);
  assert.match(main, /data-dialog-action="load"/);
  assert.match(main, /localStorage\.setItem\("dominium\.save\.v1"/);
  assert.match(main, /localStorage\.getItem\("dominium\.save\.v1"/);
  assert.match(main, /parsed\.version !== 1/);
  assert.match(main, /function saveGame/);
  assert.match(main, /function loadGame/);
});

test("skróty klasycznego sterowania i kamery są podłączone do zdarzeń", () => {
  for (const expression of [
    /event\.shiftKey/, /event\.ctrlKey/, /event\.metaKey/,
    /key === " "/, /key === "v"/, /key === "x"/, /key === "c"/,
    /key === "z"/, /key === "p"/, /saveCameraBookmark\(/, /jumpCameraBookmark\(/,
    /keysDown\.has\("arrowleft"\)/, /edgePointer/
  ]) {
    assert.match(main, expression);
  }
});
