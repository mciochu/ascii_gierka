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

test("Effulgence ma cztery bloki HUD w proporcjach 14/46/22/18 i osobną minimapę", () => {
  assert.match(html, /class="bottom-hud"[\s\S]*class="build-categories"[\s\S]*class="context-panel"[\s\S]*class="scribe-panel"[\s\S]*class="minimap-panel"/);
  assert.match(html, /id="minimap"/);
  const scribeStart = html.indexOf('class="scribe-panel"');
  const minimapStart = html.indexOf('class="minimap-panel"');
  assert.ok(scribeStart >= 0 && minimapStart > scribeStart);
  assert.doesNotMatch(html.slice(scribeStart, minimapStart), /id="minimap"/);
});

test("Opcje Effulgence sterują gęstością, bloomem, jasnością i migotaniem", () => {
  assert.match(main, /data-effulgence-density/);
  assert.match(main, /data-effulgence-bloom/);
  assert.match(main, /data-effulgence-ambient/);
  assert.match(main, /data-effulgence-shimmer/);
  assert.match(main, /localStorage\.setItem\(EFFULGENCE_SETTINGS_KEY/);
  assert.match(main, /effulgence\.update\(performance\.now\(\) \/ 1000, zoom\)/);
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

test("kamera udostępnia pełny widok strategiczny i nie ucina zoomu poniżej 15%", () => {
  assert.match(main, /const MIN_CAMERA_ZOOM = 0\.15/);
  assert.match(main, /const MAX_CAMERA_ZOOM = 2\.0/);
  assert.match(main, /Math\.max\(MIN_CAMERA_ZOOM, Math\.min\(MAX_CAMERA_ZOOM, nextZoom\)\)/);
  assert.match(main, /zoom = Math\.max\(MIN_CAMERA_ZOOM, Math\.min\(MAX_CAMERA_ZOOM, bookmark\.zoom\)\)/);
  assert.match(main, /if \(zoom <= 0\.68\)[\s\S]*?worldRoot\.position\.set\(rect\.width \/ 2, rect\.height \/ 2\)/);
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
  assert.match(main, /const color = valid \? "#9aa36d" : "#96372f"/);
  assert.match(main, /canvas\.addEventListener\("pointermove", \(event: PointerEvent\) => \{[\s\S]*?updateBuildPreview\(event\.clientX, event\.clientY\)/);
  assert.match(main, /buildPreviewLayer\.visible = mode === "build"/);
  assert.match(main, /const cost = TOWN_BUILD_COSTS\[type\]/);
});


test("etap 4 pokazuje fizyczne magazyny, pojemność i moduły obok magazynu", () => {
  assert.match(main, /simulation\.logistics\.storages/);
  assert.match(main, /storageUsedSlots\(storage\)/);
  assert.match(main, /storageFreeSlots\(storage\)/);
  assert.match(main, /function expandSelectedStorage\(/);
  assert.match(main, /anchorTile\.col \+ dc/);
  assert.match(main, /storageModuleId/);
  assert.match(main, /Nie można zburzyć magazynu, który zawiera towary/);
});

test("etap 4 ma transport wejść i wyjść przez fizyczny magazyn, bez teleportowania surowców", () => {
  assert.match(main, /pickupProductionInput\(simulation, villager\.id\)/);
  assert.match(main, /completeProductionInputDelivery\(simulation, villager\.id\)/);
  assert.match(main, /status === \"fetching-input/);
  assert.match(main, /status === \"hauling-output/);
  assert.match(main, /storeResource\(simulation, storage\.id/);
  assert.match(main, /advanceProduction\(simulation, gameDelta\)/);
});

test("etap 4 udostępnia rynek ręczny i panel wyboru produkowanej broni", () => {
  assert.match(main, /data-market-direction/);
  assert.match(main, /tradeAtMarket\(simulation\.logistics/);
  assert.match(main, /data-production-variant/);
  assert.match(main, /data-storage-expand/);
  assert.match(main, /result\.message/);
});

test("zapis etapu 4 zachowuje stan magazynów, produkcję, ładunki i migruje dawne liczniki", () => {
  assert.match(main, /simulation: \{ \.\.\.simulation \}/);
  assert.match(main, /normalizeLogistics\(savedSimulation\.logistics, legacyLogistics\)/);
  assert.match(main, /stockpile\.inventory\.wood = Number\(savedSimulation\.wood\)/);
  assert.match(main, /savedSimulation\.villagers/);
  assert.match(main, /entry\.cargo/);
  assert.match(main, /entry\.pendingOutputs/);
  assert.match(main, /stage4BuildingCounter/);
});