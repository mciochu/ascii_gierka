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


test("anulowanie Pointer nie może wykonywać kliknięcia ani rozkazu", () => {
  assert.match(main, /function cancelPointer\(event: PointerEvent\): void[\s\S]*?hideSelectionRectangle\(\);[\s\S]*?gestureMenu\.hidden = true;/);
  assert.match(main, /canvas\.addEventListener\("pointercancel", cancelPointer\)/);
  assert.doesNotMatch(main, /canvas\.addEventListener\("pointercancel", finishPointer\)/);
});

test("otwarty dialog odcina skróty mapy, ale Escape zamyka okno", () => {
  assert.match(main, /if \(key === "escape" && !dialogOverlay\.hidden\)[\s\S]*?closeDialog\(\);[\s\S]*?return;[\s\S]*?if \(!dialogOverlay\.hidden\) return;/);
});

test("HUD i zmiana rozmiaru zachowują punkt obserwacji kamery", () => {
  assert.match(main, /function preserveCameraCenter\(/);
  assert.match(main, /function toggleHud\(\): void \{[\s\S]*?preserveCameraCenter\(/);
  assert.match(main, /window\.addEventListener\("resize", \(\) => \{[\s\S]*?preserveCameraCenter\(/);
  assert.doesNotMatch(main, /if \(hudVisible\) centerCamera\(\)/);
});

test("liczebność portretu typu uwzględnia licznik żołnierzy w grupie", () => {
  assert.match(main, /units\.filter\(\(unit\) => \(unit\.unitClass \?\? unit\.role\) === type\)[\s\S]*?reduce\(\(sum, unit\) => sum \+ \(unit\.count \?\? 1\), 0\)/);
});

test("wybór aktywnej budowli w pauzie nie sugeruje wejścia w tryb budowania", () => {
  assert.match(main, /if \(item\.implemented && paused\)[\s\S]*?rozpocząć budowanie/);
});

test("etap 3 renderuje ognisko, licznik bezrobotnych i wskaźnik przyrostu", () => {
  assert.match(main, /createCampfireVisuals\(\)/);
  assert.match(main, /campfireLabel\.text = simulation\.unemployed \+ "\/24/);
  assert.match(main, /simulation\.spawnProgress/);
  assert.match(html, /id="scribe-unemployed"/);
});

test("etap 3 ma działającą budowę chat, religii i obiektów strachu", () => {
  for (const id of ["hovel", "chapel", "church", "cathedral", "inn", "good-things", "bad-things"]) {
    assert.match(main, new RegExp('"' + id + '"'));
  }
  assert.match(main, /function placeTownBuilding/);
  assert.match(main, /addWorksite\(simulation/);
  assert.match(main, /simulation\.fearObjects\.push/);
  assert.match(main, /setHovelCapacity\(simulation, 1\)/);
});

test("zapis obejmuje mieszkańców, miejsca pracy, obiekty strachu i nowe budowle", () => {
  assert.match(main, /simulation: \{ \.\.\.simulation \}/);
  assert.match(main, /townBuildingCounter/);
  assert.match(main, /savedSimulation\.villagers/);
  assert.match(main, /savedSimulation\.worksites/);
  assert.match(main, /savedSimulation\.fearObjects/);
});

test("panel budynku pozwala wstrzymać i wznowić pracę oraz odsyła mieszkańców do ogniska", () => {
  assert.match(main, /data-worksite-toggle/);
  assert.match(main, /function toggleWorksite\(/);
  assert.match(main, /setWorksiteEnabled\(simulation, worksiteId, resume\)/);
  assert.match(main, /status === "returning-to-campfire"/);
  assert.match(main, /routeVillagerTo\(villager, CAMPFIRE\)/);
  assert.match(main, /if \(returnedToCampfire\) assignAvailableWorkers\(simulation\)/);
});

test("interfejs nie przypisuje klawisza X do burzenia, a kompas obraca się z mapą", () => {
  assert.doesNotMatch(html, /Burzenie \(X\)/);
  assert.match(html, /class="map-compass"[\s\S]*?<b>↑<\/b>/);
  assert.match(main, /function updateCompass\(\)[\s\S]*?map-compass b[\s\S]*?style\.transform/);
  assert.match(main, /updateCompass\(\);[\s\S]*?function rotateMap/);
});

test("dwuklik wybiera oddziały tego samego typu tylko wewnątrz viewportu", () => {
  assert.match(main, /isWorldPointInViewport\(candidate, camera, viewportSize\)/);
  assert.doesNotMatch(main, /candidate\.x >= bounds\.left && candidate\.x <= bounds\.right/);
});


test("tryb budowania pokazuje zielony lub czerwony podgląd pola przed postawieniem budowli", () => {
  assert.match(main, /function canPlaceBuildPreview\(/);
  assert.match(main, /function updateBuildPreview\(/);
  assert.match(main, /const color = valid \? "#65e08b" : "#ef6862"/);
  assert.match(main, /canvas\.addEventListener\("pointermove", \(event: PointerEvent\) => \{[\s\S]*?updateBuildPreview\(event\.clientX, event\.clientY\)/);
  assert.match(main, /buildPreviewLayer\.visible = mode === "build"/);
  assert.match(main, /const cost = TOWN_BUILD_COSTS\[type\]/);
});
