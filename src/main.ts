import { Application, Container, Text } from "pixi.js";
import "./style.css";
import { addGlyph } from "./engine/glyph";
import { createWatchtower, createWorld, WORLD_SIZE, type GameEntity } from "./engine/world";
import { advanceSimulation, createSimulation, setGameSpeed, TAX_RULES } from "./engine/simulation";
import { BUILD_CATEGORIES, findBuildCategory, findBuildItem } from "./ui/catalog";
import {
  findGridPath,
  GRID_PIVOT,
  isBuildableAtWorld,
  viewportToWorld,
  worldPositionForCell,
  worldToCell,
  worldToViewport
} from "./engine/grid";

type ToolMode = "select" | "attack-move" | "build" | "demolish";
type CameraState = { x: number; y: number; zoom: number; rotation: number };
type SavedEntity = Omit<GameEntity, "group">;
interface GameSave {
  version: 1;
  savedAt: string;
  simulation: ReturnType<typeof createSimulation>;
  entities: SavedEntity[];
  selectedIds: string[];
  controlGroups: [number, string[]][];
  placedStructures: [string, { wood: number; stone: number }][];
  undoStack: string[];
  towerCounter: number;
  camera: CameraState;
  cameraBookmarks: [number, CameraState][];
  lastCameraBeforeJump: CameraState | null;
  flattenLatched: boolean;
  hudVisible: boolean;
}
type PointerSession = {
  pointerId: number;
  kind: "select" | "pan" | "context";
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  additive: boolean;
  toggle: boolean;
};

const viewport = document.querySelector<HTMLDivElement>("#map-viewport")!;
const statusMessage = document.querySelector<HTMLElement>("#status-message")!;
const zoomLabel = document.querySelector<HTMLElement>("#zoom-label")!;
const modeLabel = document.querySelector<HTMLElement>("#mode-label")!;
const mapHint = document.querySelector<HTMLElement>("#map-hint")!;
const selectedCountLabel = document.querySelector<HTMLElement>("#selected-count")!;
const contextContent = document.querySelector<HTMLElement>("#context-content")!;
const contextTitle = document.querySelector<HTMLElement>("#context-title")!;
const contextSubtitle = document.querySelector<HTMLElement>("#context-subtitle")!;
const selectionRect = document.querySelector<HTMLDivElement>("#selection-rect")!;
const hud = document.querySelector<HTMLElement>("#hud")!;
const hudReveal = document.querySelector<HTMLButtonElement>("#hud-reveal")!;
const minimap = document.querySelector<HTMLDivElement>("#minimap")!;
const minimapGrid = document.querySelector<HTMLDivElement>("#minimap-grid")!;
const minimapCamera = document.querySelector<HTMLDivElement>("#minimap-camera")!;
const gestureMenu = document.querySelector<HTMLDivElement>("#gesture-menu")!;
const dialogOverlay = document.querySelector<HTMLDivElement>("#dialog-overlay")!;
const dialogTitle = document.querySelector<HTMLElement>("#dialog-title")!;
const dialogKicker = document.querySelector<HTMLElement>("#dialog-kicker")!;
const dialogContent = document.querySelector<HTMLElement>("#dialog-content")!;
const demolishButton = document.querySelector<HTMLButtonElement>("#demolish-button")!;

if (!viewport || !statusMessage || !zoomLabel || !modeLabel || !mapHint ||
    !selectedCountLabel || !contextContent || !contextTitle || !contextSubtitle || !selectionRect ||
    !hud || !hudReveal || !minimap || !minimapGrid || !minimapCamera || !gestureMenu ||
    !dialogOverlay || !dialogTitle || !dialogKicker || !dialogContent || !demolishButton) {
  throw new Error("DOMINIUM game interface is incomplete.");
}

const goldValue = document.querySelector<HTMLElement>("#gold-value");
const foodValue = document.querySelector<HTMLElement>("#food-value");
const woodValue = document.querySelector<HTMLElement>("#wood-value");
const stoneValue = document.querySelector<HTMLElement>("#stone-value");

const app = new Application();
await app.init({
  background: "#000000",
  resizeTo: viewport,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  preference: "webgl"
});

const canvas = app.canvas;
canvas.setAttribute("aria-label", "Mapa świata DOMINIUM");
canvas.style.position = "absolute";
canvas.style.inset = "0";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.zIndex = "0";
viewport.prepend(canvas);

const worldRoot = new Container();
worldRoot.sortableChildren = true;
app.stage.addChild(worldRoot);
const world = createWorld(worldRoot);
const entities = world.entities;

let zoom = 0.62;
let mapRotation = 0;
const MAP_PIVOT = GRID_PIVOT;
let mode: ToolMode = "select";
let paused = false;
const simulation = createSimulation();
let gold = simulation.gold;
let food = simulation.food;
let wood = simulation.wood;
let stone = simulation.stone;
let towerCounter = 0;
let pointerSession: PointerSession | null = null;
let lastClick: { id: string; at: number } | null = null;
const selectedIds = new Set<string>();
const selectionMarkers = new Map<string, Text>();
const controlGroups = new Map<number, string[]>();
const keysDown = new Set<string>();
let activeCategoryId = "castle";
let selectedBuildItemId: string | null = null;
let hudVisible = true;
let flattenLatched = false;
let temporaryFlatten = false;
let edgePointer: { x: number; y: number } | null = null;
let minimapPointerId: number | null = null;
let lastSelectedGroupKey: { number: number; at: number } | null = null;
let lastCameraBeforeJump: CameraState | null = null;
const cameraBookmarks = new Map<number, CameraState>();
const placedStructures = new Map<string, { wood: number; stone: number }>();
const undoStack: string[] = [];
let minimapRefresh = 0;

function setStatus(message: string): void {
  statusMessage.textContent = message;
}

function allSelected(): GameEntity[] {
  return entities.filter((entity) => selectedIds.has(entity.id));
}

function selectedUnits(): GameEntity[] {
  return allSelected().filter((entity) => entity.kind === "unit" && entity.team === "player");
}

function setMode(next: ToolMode): void {
  if (paused && next !== "select") {
    setStatus("Gra jest wstrzymana — nie można rozpoczynać budowania ani wydawać rozkazów.");
    next = "select";
  }
  mode = next;
  demolishButton.classList.toggle("active", mode === "demolish");
  const labels: Record<ToolMode, string> = {
    select: "ZAZNACZANIE", "attack-move": "ATAK W RUCHU", build: "BUDOWANIE", demolish: "BURZENIE"
  };
  const hints: Record<ToolMode, string> = {
    select: "LPM: WYBÓR / ROZKAZ · SHIFT+LPM: KOLEJNY PUNKT TRASY",
    "attack-move": "LPM WSKAŻ CEL ATAKU W RUCHU · PPM ANULUJE",
    build: "LPM POSTAW WIEŻĘ · PPM ANULUJE",
    demolish: "LPM WYBIERZ WŁASNĄ WIEŻĘ DO BURZENIA · PPM ANULUJE"
  };
  modeLabel.textContent = labels[mode] ?? labels.select;
  mapHint.textContent = hints[mode] ?? hints.select;
  canvas.style.cursor = mode === "select" ? "default" : mode === "attack-move" ? "crosshair" : mode === "build" ? "copy" : "not-allowed";
}

function renderBuildCategory(): void {
  const category = findBuildCategory(activeCategoryId) ?? BUILD_CATEGORIES[0]!;
  contextTitle.textContent = category.name.toLocaleUpperCase("pl-PL");
  contextSubtitle.textContent = category.items.length + " POZYCJI · " + category.description.toLocaleUpperCase("pl-PL");
  const itemsMarkup = category.items.map((item) =>
    '<button type="button" class="build-item' + (item.implemented ? "" : " unavailable") +
    (selectedBuildItemId === item.id ? " selected" : "") + '" data-build-id="' + item.id +
    '" title="' + (item.note ?? item.name) + '"><span class="build-glyph">' + item.glyph +
    '</span><span><b>' + item.name + '</b><small>' +
    (item.cost ?? (item.implemented ? "DOSTĘPNE" : "KOLEJNY ETAP")) +
    '</small></span></button>'
  ).join("");
  contextContent.innerHTML = '<div class="build-list">' + itemsMarkup + '</div>';
  contextContent.querySelectorAll<HTMLButtonElement>("[data-build-id]").forEach((button) => {
    button.addEventListener("click", () => selectBuildItem(button.dataset.buildId ?? ""));
  });
}

function selectBuildItem(itemId: string): void {
  const item = findBuildItem(itemId);
  if (!item) return;
  selectedBuildItemId = itemId;
  renderBuildCategory();
  if (!item.implemented) {
    setMode("select");
    setStatus(item.name + ": " + (item.note ?? "Mechanika nie jest jeszcze dostępna."));
    return;
  }
  if (itemId === "watchtower") {
    setMode("build");
    setStatus("Budowa wieży: kliknij wolne, dozwolone pole mapy. Koszt: 70 drewna i 30 kamienia.");
    return;
  }
  setMode("select");
}

function setResources(): void {
  gold = simulation.gold; food = simulation.food; wood = simulation.wood; stone = simulation.stone;
  if (goldValue) goldValue.textContent = gold.toLocaleString("pl-PL");
  if (foodValue) foodValue.textContent = food.toLocaleString("pl-PL");
  if (woodValue) woodValue.textContent = wood.toLocaleString("pl-PL");
  if (stoneValue) stoneValue.textContent = stone.toLocaleString("pl-PL");
  const scribeGold = document.querySelector<HTMLElement>("#scribe-gold");
  if (scribeGold) scribeGold.textContent = gold.toLocaleString("pl-PL");
  updateScribe();
}

function updateScribe(): void {
  const popularity = document.querySelector<HTMLElement>("#scribe-popularity");
  const population = document.querySelector<HTMLElement>("#scribe-population");
  const face = document.querySelector<HTMLElement>("#scribe-face");
  if (popularity) {
    popularity.textContent = String(simulation.popularity);
    popularity.style.color = simulation.popularity >= 50 ? "#68cc83" : "#f06c65";
  }
  if (population) population.textContent = simulation.population + "/" + simulation.housing;
  if (face) {
    face.textContent = simulation.popularity >= 65 ? "☺" : simulation.popularity >= 50 ? "◡" : "☹";
    face.style.color = simulation.popularity >= 50 ? "#e5c579" : "#f07870";
  }
}

function redrawSelectionMarkers(): void {
  for (const marker of selectionMarkers.values()) marker.destroy();
  selectionMarkers.clear();
  world.layers.effects.removeChildren();

  for (const entity of allSelected()) {
    const marker = addGlyph(world.layers.effects, {
      char: entity.kind === "unit" ? "◎" : "⌜",
      x: entity.x,
      y: entity.y,
      size: entity.kind === "unit" ? 43 : 102,
      color: entity.team === "enemy" ? "#ff625d" : "#71caff",
      alpha: 0.94,
      weight: "bold",
      stroke: "#000000",
      strokeWidth: 2
    });
    selectionMarkers.set(entity.id, marker);
  }
}

function renderSelectionPanel(): void {
  const selection = allSelected();
  const units = selection.filter((entity) => entity.kind === "unit");
  const buildings = selection.filter((entity) => entity.kind === "building");
  selectedCountLabel.textContent = String(selection.length);

  if (selection.length === 0) {
    renderBuildCategory();
    return;
  }

  selectedBuildItemId = null;
  contextTitle.textContent = selection.length === 1 ? "PANEL OBIEKTU" : "PANEL ODDZIAŁÓW";
  contextSubtitle.textContent = selection.length + " ZAZNACZONYCH · DANE I DOSTĘPNE ROZKAZY";
  if (selection.length > 1) {
    const totalSoldiers = units.reduce((sum, unit) => sum + (unit.count ?? 1), 0);
    const types = [...new Set(units.map((unit) => unit.unitClass ?? unit.role))];
    const health = Math.round(selection.reduce((sum, entity) => sum + entity.health, 0) / selection.length);
    const typeButtons = types.map((type) =>
      '<button type="button" class="unit-filter" data-unit-type="' + type + '"><span class="unit-portrait">♟</span><b>' + type +
      '</b><small>×' + units.filter((unit) => (unit.unitClass ?? unit.role) === type).length + '</small></button>'
    ).join("");
    const stanceButtons = units.length
      ? '<div class="stance-controls"><small>POSTAWY BOJOWE</small><div>' +
        '<button type="button" data-stance="stand-ground">▣ UTRZYMAĆ POZYCJĘ</button>' +
        '<button type="button" data-stance="defensive">◇ OBRONNA</button>' +
        '<button type="button" data-stance="aggressive">⚔ AGRESYWNA</button>' +
        '</div></div>'
      : "";
    contextContent.innerHTML =
      '<div class="selection-panel group-selection"><div class="selection-topline"><span>GRUPA BOJOWA</span><strong>' +
      selection.length + ' OBIEKTY</strong></div><h2>Wybrane oddziały</h2><p>' + units.length +
      ' grup · ' + totalSoldiers + ' żołnierzy' + (buildings.length ? ' · ' + buildings.length + ' budynki' : '') +
      '</p><div class="selection-health"><span style="width:' + health + '%"></span></div>' +
      '<div class="selection-meta">ŚREDNI STAN <b>' + health + '%</b></div><div class="unit-type-list">' +
      typeButtons + '</div>' + stanceButtons + '<div class="selection-actions"><button type="button" data-command="stop">■ STOP</button>' +
      '<button type="button" data-command="attack-move">⚔ ATAK W RUCHU</button></div></div>';
  } else {
    const entity = selection[0]!;
    const health = Math.max(0, Math.min(100, entity.health));
    contextContent.innerHTML =
      '<div class="selection-panel single-selection"><div class="selection-topline"><span>' +
      (entity.team === "enemy" ? "WROGI OBIEKT" : entity.kind === "unit" ? "ODDZIAŁ BOJOWY" : "BUDOWLA") +
      '</span><strong>' + entity.role + '</strong></div><h2>' + entity.name + '</h2><p>' +
      entity.description + '</p><div class="selection-health"><span style="width:' + health +
      '%;background:' + (entity.team === "enemy" ? "#e45b52" : "#78b8dd") +
      '"></span></div><div class="selection-meta">WYTRZYMAŁOŚĆ <b>' + Math.ceil(health) + '%</b></div>' +
      (entity.kind === "unit" ? '<div class="selection-meta">LICZEBNOŚĆ <b>' + (entity.count ?? 1) + '</b></div>' : '') +
      (entity.kind === "unit" && entity.team === "player" ?
        '<div class="stance-controls"><small>POSTAWA BOJOWA · ' + (entity.stance ?? "DOMYŚLNA").toUpperCase() +
        '</small><div><button type="button" data-stance="stand-ground">▣ UTRZYMAĆ POZYCJĘ</button>' +
        '<button type="button" data-stance="defensive">◇ OBRONNA</button>' +
        '<button type="button" data-stance="aggressive">⚔ AGRESYWNA</button></div></div>' +
        '<div class="selection-actions"><button type="button" data-command="stop">■ STOP</button>' +
        '<button type="button" data-command="attack-move">⚔ ATAK W RUCHU</button></div>' : '') +
      '</div>';
  }

  contextContent.querySelectorAll<HTMLButtonElement>("[data-stance]").forEach((button) => {
    button.addEventListener("click", () => {
      const stance = button.dataset.stance;
      if (stance === "stand-ground" || stance === "defensive" || stance === "aggressive") setUnitStance(stance);
    });
  });
  contextContent.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runSelectionCommand(button.dataset.command ?? ""));
  });
  contextContent.querySelectorAll<HTMLButtonElement>("[data-unit-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.unitType ?? "";
      replaceSelection(allSelected().filter((entity) => entity.kind === "unit" && (entity.unitClass ?? entity.role) === type));
      setStatus("Zawężono zaznaczenie do oddziałów typu " + type + ".");
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const type = button.dataset.unitType ?? "";
      replaceSelection(allSelected().filter((entity) => !(entity.kind === "unit" && (entity.unitClass ?? entity.role) === type)));
      setStatus("Usunięto typ " + type + " z zaznaczenia.");
    });
  });
}

function updateSelection(): void {
  redrawSelectionMarkers();
  renderSelectionPanel();
}

function replaceSelection(items: GameEntity[]): void {
  selectedIds.clear();
  for (const entity of items) selectedIds.add(entity.id);
  updateSelection();
}

function clearSelection(): void {
  selectedIds.clear();
  updateSelection();
}

function toggleSelection(entity: GameEntity): void {
  if (selectedIds.has(entity.id)) selectedIds.delete(entity.id);
  else selectedIds.add(entity.id);
  updateSelection();
}

function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return viewportToWorld(
    { x: screenX - rect.left, y: screenY - rect.top },
    {
      position: { x: worldRoot.position.x, y: worldRoot.position.y },
      pivot: MAP_PIVOT,
      zoom,
      quarterTurns: mapRotation
    }
  );
}

function findEntityAt(x: number, y: number): GameEntity | null {
  let nearest: GameEntity | null = null;
  let nearestDistance = Infinity;
  for (const entity of entities) {
    if (entity.health <= 0) continue;
    const distance = Math.hypot(entity.x - x, entity.y - y);
    const radius = entity.kind === "building" ? 76 : 43;
    if (distance <= radius && distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function visibleWorldBounds(): { left: number; top: number; right: number; bottom: number } {
  const rect = viewport.getBoundingClientRect();
  const corners = [
    screenToWorld(rect.left, rect.top),
    screenToWorld(rect.right, rect.top),
    screenToWorld(rect.left, rect.bottom),
    screenToWorld(rect.right, rect.bottom)
  ];
  return {
    left: Math.min(...corners.map((point) => point.x)),
    top: Math.min(...corners.map((point) => point.y)),
    right: Math.max(...corners.map((point) => point.x)),
    bottom: Math.max(...corners.map((point) => point.y))
  };
}

function selectBox(polygon: { x: number; y: number }[], additive: boolean, toggle: boolean): void {
  if (polygon.length < 3) return;
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const bounds = {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  };

  const contains = (x: number, y: number): boolean => {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
      const current = polygon[index]!;
      const prior = polygon[previous]!;
      const intersects = ((current.y > y) !== (prior.y > y)) &&
        (x < ((prior.x - current.x) * (y - current.y)) / (prior.y - current.y) + current.x);
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const hits = entities.filter((entity) =>
    entity.kind === "unit" &&
    entity.team === "player" &&
    entity.health > 0 &&
    entity.x >= bounds.left && entity.x <= bounds.right &&
    entity.y >= bounds.top && entity.y <= bounds.bottom &&
    contains(entity.x, entity.y)
  );

  if (!additive && !toggle) selectedIds.clear();
  for (const entity of hits) {
    if (toggle && selectedIds.has(entity.id)) selectedIds.delete(entity.id);
    else selectedIds.add(entity.id);
  }
  updateSelection();
  setStatus(hits.length
    ? "Zaznaczono " + hits.length + " oddziałów. LPM na mapie wydaje rozkaz ruchu lub ataku."
    : additive || toggle ? "Nie znaleziono kolejnych oddziałów w zaznaczonym obszarze." : "Pusty obszar — zaznaczenie wyczyszczone.");
}
function selectClickedEntity(entity: GameEntity, additive: boolean, toggle: boolean): void {
  if (toggle) {
    toggleSelection(entity);
  } else if (additive) {
    selectedIds.add(entity.id);
    updateSelection();
  } else {
    replaceSelection([entity]);
  }

  if (entity.kind === "unit" && entity.team === "player") {
    const now = performance.now();
    if (lastClick?.id === entity.id && now - lastClick.at < 360) {
      const bounds = visibleWorldBounds();
      const sameType = entities.filter((candidate) =>
        candidate.kind === "unit" &&
        candidate.team === "player" &&
        candidate.unitClass === entity.unitClass &&
        candidate.x >= bounds.left && candidate.x <= bounds.right &&
        candidate.y >= bounds.top && candidate.y <= bounds.bottom
      );
      replaceSelection(sameType);
      setStatus(`Wybrano wszystkie widoczne oddziały typu: ${entity.unitClass ?? entity.name}.`);
      lastClick = null;
      return;
    }
    lastClick = { id: entity.id, at: now };
  } else {
    lastClick = null;
  }
  setStatus(`Wybrano: ${entity.name}.`);
}

function setMoveOrder(unit: GameEntity, x: number, y: number, queued: boolean): boolean {
  unit.attackTargetId = undefined;
  unit.attackMoveTarget = undefined;
  unit.stanceReturnTarget = undefined;
  unit.holdPosition = false;
  const destination = {
    x: Math.max(28, Math.min(WORLD_SIZE.width - 28, x)),
    y: Math.max(28, Math.min(WORLD_SIZE.height - 28, y))
  };
  const lastQueuedPoint = unit.movementQueue?.[unit.movementQueue.length - 1];
  const routeStart = queued ? lastQueuedPoint ?? unit.moveTarget ?? unit : unit;
  const route = findGridPath(world.grid, routeStart, destination);
  if (!route) {
    if (!queued) {
      unit.moveTarget = undefined;
      unit.movementQueue = [];
    }
    return false;
  }
  if (route.length === 0) route.push(destination);
  if (queued) {
    unit.movementQueue ??= [];
    unit.movementQueue.push(...route);
    if (!unit.moveTarget) unit.moveTarget = unit.movementQueue.shift();
  } else {
    unit.movementQueue = route.slice(1);
    unit.moveTarget = route[0];
  }
  return true;
}

function issueFormationOrder(x: number, y: number, queued: boolean): void {
  if (paused) { setStatus("Gra jest wstrzymana — wznów symulację, aby wydawać rozkazy."); return; }
  const units = selectedUnits();
  if (units.length === 0) {
    setStatus("Najpierw zaznacz własne oddziały.");
    return;
  }

  const columns = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / columns);
  const spacing = units.length > 12 ? 66 : 54;
  let routed = 0;
  units.forEach((unit, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const offsetX = (column - (columns - 1) / 2) * spacing;
    const offsetY = (row - (rows - 1) / 2) * spacing;
    if (setMoveOrder(unit, x + offsetX, y + offsetY, queued)) routed += 1;
  });
  setStatus(routed === units.length
    ? queued
      ? "Dodano trasę do kolejki dla " + routed + " oddziałów."
      : "Rozkaz marszu: " + routed + " oddziałów rusza wyznaczoną trasą."
    : "Trasę wyznaczono dla " + routed + "/" + units.length + " oddziałów. Woda lub klify blokują przejście.");
}

function issueAttackOrder(target: GameEntity): void {
  if (paused) { setStatus("Gra jest wstrzymana — wznów symulację, aby wydawać rozkazy."); return; }
  const units = selectedUnits();
  if (units.length === 0) {
    setStatus("Zaznacz własne oddziały, aby wydać rozkaz ataku.");
    return;
  }
  for (const unit of units) {
    unit.attackTargetId = target.id;
    unit.attackMoveTarget = undefined;
    if (unit.stance === "defensive" || unit.stance === "aggressive") {
      unit.stanceReturnTarget ??= { x: unit.x, y: unit.y };
    }
    unit.moveTarget = undefined;
    unit.movementQueue = [];
    unit.holdPosition = false;
  }
  setStatus(`Rozkaz ataku: ${units.length} oddziałów atakuje ${target.name}.`);
}

function issueAttackMove(x: number, y: number): void {
  if (paused) { setStatus("Gra jest wstrzymana — wznów symulację, aby wydawać rozkazy."); setMode("select"); return; }
  const units = selectedUnits();
  if (units.length === 0) {
    setStatus("Najpierw zaznacz własne oddziały.");
    setMode("select");
    return;
  }
  const columns = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / columns);
  let routed = 0;
  units.forEach((unit, index) => {
    const offsetX = (index % columns - (columns - 1) / 2) * 54;
    const offsetY = (Math.floor(index / columns) - (rows - 1) / 2) * 54;
    const destination = { x: x + offsetX, y: y + offsetY };
    const route = findGridPath(world.grid, unit, destination);
    unit.attackTargetId = undefined;
    unit.holdPosition = false;
    if (unit.stance === "stand-ground") unit.stance = undefined;
    unit.stanceReturnTarget = undefined;
    unit.movementQueue = route ? route.slice(1) : [];
    unit.attackMoveTarget = route ? destination : undefined;
    unit.moveTarget = route ? route[0] ?? destination : undefined;
    if (route) routed += 1;
  });
  setStatus(routed === units.length
    ? "Oddziały ruszają wyznaczoną trasą z rozkazem ataku w ruchu."
    : "Trasę ataku wyznaczono dla " + routed + "/" + units.length + " oddziałów.");
  setMode("select");
}

function stopUnits(): void {
  if (paused) { setStatus("Gra jest wstrzymana — rozkazy są niedostępne."); return; }
  for (const unit of selectedUnits()) {
    unit.moveTarget = undefined;
    unit.attackMoveTarget = undefined;
    unit.attackTargetId = undefined;
    unit.movementQueue = [];
    unit.holdPosition = false;
    unit.stance = undefined;
    unit.stanceReturnTarget = undefined;
  }
  updateSelection();
  setStatus("Rozkaz STOP: oddziały zatrzymały się.");
}

function setUnitStance(stance: "stand-ground" | "defensive" | "aggressive"): void {
  if (paused) { setStatus("Gra jest wstrzymana — zmiana postaw jest niedostępna."); return; }
  const units = selectedUnits();
  if (units.length === 0) { setStatus("Najpierw zaznacz własne oddziały."); return; }
  for (const unit of units) {
    unit.attackTargetId = undefined;
    unit.attackMoveTarget = undefined;
    unit.moveTarget = undefined;
    unit.movementQueue = [];
    unit.stance = stance;
    unit.holdPosition = stance === "stand-ground";
    unit.stanceReturnTarget = stance === "stand-ground" ? undefined : { x: unit.x, y: unit.y };
  }
  const labels = {
    "stand-ground": "Utrzymać pozycję",
    defensive: "Postawa obronna",
    aggressive: "Postawa agresywna"
  };
  updateSelection();
  setStatus(labels[stance] + ": zmieniono postawę " + units.length + " oddziałów.");
}

function holdUnits(): void {
  setUnitStance("stand-ground");
}

function runSelectionCommand(command: string): void {
  if (command === "stop") stopUnits();
  else if (command === "hold") holdUnits();
  else if (command === "attack-move") setMode("attack-move");
}


function placeWatchtower(x: number, y: number): void {
  if (paused) { setStatus("Gra jest wstrzymana — budowanie jest niedostępne."); return; }
  if (wood < 70 || stone < 30) {
    setStatus("Brakuje surowców: wieża wymaga 70 drewna i 30 kamienia.");
    return;
  }
  if (x < 40 || y < 40 || x > WORLD_SIZE.width - 40 || y > WORLD_SIZE.height - 40) {
    setStatus("Nie można budować poza granicami mapy.");
    return;
  }
  const buildTile = worldToCell(world.grid, { x, y });
  const buildPoint = buildTile ? worldPositionForCell(world.grid, buildTile.col, buildTile.row) : null;
  if (!buildPoint || !isBuildableAtWorld(world.grid, buildPoint)) {
    setStatus("Teren jest niedostępny pod budowę. Woda, las, klify i złoża mają własne zasady zabudowy.");
    return;
  }
  if (entities.some((entity) => Math.hypot(entity.x - buildPoint.x, entity.y - buildPoint.y) < (entity.kind === "building" ? 112 : 48))) {
    setStatus("To miejsce jest zajęte. Wybierz wolny teren.");
    return;
  }

  simulation.wood -= 70;
  simulation.stone -= 30;
  towerCounter += 1;
  const tower = createWatchtower(world.layers.structures, buildPoint.x, buildPoint.y, towerCounter);
  entities.push(tower);
  placedStructures.set(tower.id, { wood: 70, stone: 30 });
  undoStack.push(tower.id);
  setResources();
  replaceSelection([tower]);
  setMode("select");
  setStatus("Wieża strażnicza wzniesiona.");
}

function removePlacedStructure(entity: GameEntity, refundRatio: number): boolean {
  const cost = placedStructures.get(entity.id);
  if (!cost) return false;
  const index = entities.findIndex((candidate) => candidate.id === entity.id);
  if (index < 0) return false;
  entities.splice(index, 1);
  selectedIds.delete(entity.id);
  entity.group.destroy({ children: true });
  simulation.wood += Math.floor(cost.wood * refundRatio);
  simulation.stone += Math.floor(cost.stone * refundRatio);
  placedStructures.delete(entity.id);
  const stackIndex = undoStack.lastIndexOf(entity.id);
  if (stackIndex >= 0) undoStack.splice(stackIndex, 1);
  setResources();
  updateSelection();
  return true;
}

function undoLastBuild(): void {
  if (paused) { setStatus("Gra jest wstrzymana — cofanie budowy jest niedostępne."); return; }
  const id = undoStack[undoStack.length - 1];
  if (!id) { setStatus("Nie ma budowy do cofnięcia."); return; }
  const entity = entities.find((candidate) => candidate.id === id);
  if (!entity || !removePlacedStructure(entity, 1)) {
    undoStack.pop();
    setStatus("Ostatnia budowla nie istnieje — nie można jej cofnąć.");
    return;
  }
  setMode("select");
  setStatus("Cofnięto ostatnią budowę. Zwrócono 100% kosztów.");
}

function demolishAt(x: number, y: number): void {
  if (paused) { setStatus("Gra jest wstrzymana — burzenie jest niedostępne."); return; }
  const entity = findEntityAt(x, y);
  if (!entity || entity.kind !== "building" || entity.team !== "player") {
    setStatus("Wskaż własną budowlę, aby ją zburzyć.");
    return;
  }
  if (!placedStructures.has(entity.id)) {
    setStatus("Koszt tej budowli nie jest zapisany w prototypie — nie zostanie usunięta bez znanej kwoty zwrotu.");
    return;
  }
  if (removePlacedStructure(entity, 0.5)) {
    setMode("select");
    setStatus("Zburzono " + entity.name + ". Zwrócono 50% kosztów surowcowych.");
  }
}

function handleLeftClick(clientX: number, clientY: number, additive: boolean, toggle: boolean): void {
  if (paused && mode !== "select") { setStatus("Gra jest wstrzymana — wznowienie odblokuje budowanie i rozkazy."); return; }
  const point = screenToWorld(clientX, clientY);
  const entity = findEntityAt(point.x, point.y);

  if (mode === "build") {
    placeWatchtower(point.x, point.y);
    return;
  }
  if (mode === "demolish") {
    demolishAt(point.x, point.y);
    return;
  }
  if (mode === "attack-move") {
    issueAttackMove(point.x, point.y);
    return;
  }

  const units = selectedUnits();
  if (units.length > 0) {
    if (paused) { setStatus("Gra jest wstrzymana — rozkazy są niedostępne."); return; }
    if (entity?.team === "enemy") {
      issueAttackOrder(entity);
      return;
    }
    if (!entity) {
      issueFormationOrder(point.x, point.y, additive);
      return;
    }
    if (entity.kind === "unit" && entity.team === "player") {
      selectClickedEntity(entity, additive, toggle);
      return;
    }
    if (entity.kind === "building") {
      selectClickedEntity(entity, additive, toggle);
      return;
    }
  }

  if (entity) {
    selectClickedEntity(entity, additive, toggle);
  } else if (!additive && !toggle) {
    clearSelection();
    setStatus("Zaznaczenie wyczyszczone.");
  }
}

function updateSelectionRectangle(clientX: number, clientY: number): void {
  if (!pointerSession) return;
  const bounds = viewport.getBoundingClientRect();
  const left = Math.min(pointerSession.startX, clientX);
  const top = Math.min(pointerSession.startY, clientY);
  const right = Math.max(pointerSession.startX, clientX);
  const bottom = Math.max(pointerSession.startY, clientY);
  selectionRect.style.display = "block";
  selectionRect.style.left = `${left - bounds.left}px`;
  selectionRect.style.top = `${top - bounds.top}px`;
  selectionRect.style.width = `${right - left}px`;
  selectionRect.style.height = `${bottom - top}px`;
}

function hideSelectionRectangle(): void {
  selectionRect.style.display = "none";
}

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button === 2) {
    pointerSession = {
      pointerId: event.pointerId, kind: "context",
      startX: event.clientX, startY: event.clientY,
      lastX: event.clientX, lastY: event.clientY,
      moved: false, additive: false, toggle: false
    };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  if (event.button !== 0 && event.button !== 1) return;
  const pan = event.button === 1;
  pointerSession = {
    pointerId: event.pointerId,
    kind: pan ? "pan" : "select",
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
    additive: event.shiftKey,
    toggle: event.ctrlKey || event.metaKey
  };
  canvas.setPointerCapture(event.pointerId);
  if (pan) canvas.style.cursor = "grabbing";
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event: PointerEvent) => {
  edgePointer = { x: event.clientX, y: event.clientY };
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  const dx = event.clientX - pointerSession.lastX;
  const dy = event.clientY - pointerSession.lastY;
  const totalDistance = Math.hypot(event.clientX - pointerSession.startX, event.clientY - pointerSession.startY);

  if (pointerSession.kind === "context") {
    pointerSession.moved = totalDistance > 26;
    if (pointerSession.moved) {
      const bounds = viewport.getBoundingClientRect();
      gestureMenu.hidden = false;
      gestureMenu.style.left = (pointerSession.startX - bounds.left) + "px";
      gestureMenu.style.top = (pointerSession.startY - bounds.top) + "px";
    }
  } else if (pointerSession.kind === "pan") {
    worldRoot.position.x += dx;
    worldRoot.position.y += dy;
    pointerSession.moved = totalDistance > 2;
  } else if (mode === "select" && totalDistance > 5) {
    pointerSession.moved = true;
    updateSelectionRectangle(event.clientX, event.clientY);
  }
  pointerSession.lastX = event.clientX;
  pointerSession.lastY = event.clientY;
});

function finishPointer(event: PointerEvent): void {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  const session = pointerSession;
  pointerSession = null;
  hideSelectionRectangle();
  gestureMenu.hidden = true;

  if (session.kind === "context") {
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (Math.hypot(dx, dy) > 26) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) zoomAt(zoom < 0.9 ? 1.15 : 0.62, session.startX, session.startY);
        else toggleHud();
      } else if (dy < 0) {
        const turns = Math.max(1, Math.floor(Math.abs(dy) / 80));
        for (let turn = 0; turn < turns; turn += 1) rotateMap(1);
      } else {
        toggleFlatten();
      }
    } else if (mode !== "select") {
      setMode("select");
      setStatus("Anulowano aktywny tryb.");
    } else {
      clearSelection();
      setStatus("Zaznaczenie wyczyszczone.");
    }
    return;
  }
  if (session.kind === "pan") {
    canvas.style.cursor = mode === "select" ? "default" : mode === "attack-move" ? "crosshair" : mode === "build" ? "copy" : "not-allowed";
    return;
  }
  if (session.moved && mode === "select") {
    const start = screenToWorld(session.startX, session.startY);
    const end = screenToWorld(event.clientX, event.clientY);
    const polygon = [
      start,
      screenToWorld(event.clientX, session.startY),
      end,
      screenToWorld(session.startX, event.clientY)
    ];
    selectBox(polygon, session.additive, session.toggle);
  } else {
    handleLeftClick(event.clientX, event.clientY, session.additive, session.toggle);
  }
}
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function zoomAt(nextZoom: number, clientX?: number, clientY?: number): void {
  const clamped = Math.max(0.28, Math.min(1.7, nextZoom));
  if (Math.abs(clamped - zoom) < 0.001) return;
  const rect = canvas.getBoundingClientRect();
  const px = clientX === undefined ? rect.width / 2 : clientX - rect.left;
  const py = clientY === undefined ? rect.height / 2 : clientY - rect.top;
  const focus = screenToWorld(
    clientX === undefined ? rect.left + px : clientX,
    clientY === undefined ? rect.top + py : clientY
  );
  const offset = worldToViewport(focus, {
    position: { x: 0, y: 0 },
    pivot: MAP_PIVOT,
    zoom: clamped,
    quarterTurns: mapRotation
  });
  zoom = clamped;
  worldRoot.scale.set(zoom);
  worldRoot.position.set(px - offset.x, py - offset.y);
  zoomLabel.textContent = String(Math.round(zoom * 100)) + "%";
}

function centerCamera(): void {
  zoom = 0.62;
  worldRoot.pivot.set(MAP_PIVOT.x, MAP_PIVOT.y);
  worldRoot.rotation = mapRotation * Math.PI / 2;
  worldRoot.scale.set(zoom);
  worldRoot.position.set(viewport.clientWidth / 2, viewport.clientHeight / 2);
  zoomLabel.textContent = String(Math.round(zoom * 100)) + "%";
}

function rotateMap(direction: 1 | -1): void {
  mapRotation = (mapRotation + direction + 4) % 4;
  worldRoot.rotation = mapRotation * Math.PI / 2;
  const label = document.querySelector<HTMLElement>("#rotation-label");
  if (label) label.textContent = String(mapRotation * 90) + "°";
  setStatus("Obrót mapy: " + (mapRotation * 90) + "°. Siatka i teren pozostają wyrównane z obiektami.");
}


function centerCameraOnPoint(point: { x: number; y: number }): void {
  const offset = worldToViewport(point, {
    position: { x: 0, y: 0 },
    pivot: MAP_PIVOT,
    zoom,
    quarterTurns: mapRotation
  });
  worldRoot.position.set(viewport.clientWidth / 2 - offset.x, viewport.clientHeight / 2 - offset.y);
}

function toggleHud(): void {
  hudVisible = !hudVisible;
  hud.hidden = !hudVisible;
  hudReveal.hidden = hudVisible;
  if (hudVisible) centerCamera();
  setStatus(hudVisible ? "HUD został pokazany." : "HUD został ukryty. Użyj przycisku na dole ekranu lub klawisza Tab, aby go przywrócić.");
}

function applyFlattenState(): void {
  world.setFlattened(flattenLatched || temporaryFlatten);
  document.body.classList.toggle("map-flattened", flattenLatched || temporaryFlatten);
}

function toggleFlatten(): void {
  flattenLatched = !flattenLatched;
  applyFlattenState();
  setStatus(flattenLatched ? "Spłaszczenie terenu włączone." : "Spłaszczenie terenu wyłączone.");
}

function openDialog(title: string, kicker: string, html: string): void {
  dialogTitle.textContent = title;
  dialogKicker.textContent = kicker;
  dialogContent.innerHTML = html;
  dialogOverlay.hidden = false;
  document.querySelector<HTMLButtonElement>("#dialog-close")?.focus();
}

function closeDialog(): void {
  dialogOverlay.hidden = true;
}

function renderReports(): void {
  const ration = simulation.food <= 0 ? 0 : simulation.ration;
  const rationMods: Record<number, number> = { 0: -8, 0.5: -4, 1: 0, 1.5: 4, 2: 8 };
  const rationNames: Record<number, string> = { 0: "Brak", 0.5: "Połowa", 1: "Normalne", 1.5: "Dodatkowe", 2: "Podwójne" };
  const monthlyFoodPerVillager: Record<number, number> = { 0: 0, 0.5: 0.1, 1: 0.2, 1.5: 0.32, 2: 0.4 };
  const requestedFood = simulation.population * monthlyFoodPerVillager[ration];
  const foodShortage = requestedFood > simulation.food + 0.0001;
  const foodConsumed = Math.min(simulation.food, requestedFood);
  const rationModifier = foodShortage ? -8 : rationMods[ration] ?? 0;
  const varietyModifier = ration > 0 ? Math.max(0, Math.min(3, Math.trunc(simulation.foodTypes) - 1)) : 0;
  const taxRule = TAX_RULES[simulation.tax];
  const bribe = simulation.tax.startsWith("bribe-");
  const bribeCost = bribe && simulation.bribeCostPerVillager !== null
    ? simulation.population * simulation.bribeCostPerVillager : 0;
  const bribePaid = bribe && simulation.bribeCostPerVillager !== null && simulation.gold >= bribeCost;
  const taxModifier = bribe ? bribePaid ? taxRule.popularity : 0 : taxRule.popularity;
  const goldDelta = bribe ? bribePaid ? -bribeCost : 0 : simulation.population * taxRule.goldPerVillager;
  const beerCoverage = Math.min(1, simulation.taverns * 30 / Math.max(1, simulation.population));
  const beerAvailable = simulation.taverns > 0 && simulation.beerBarrels >= 0.144;
  const beerModifier = !beerAvailable ? 0 : beerCoverage >= 1 ? 8 : beerCoverage >= .75 ? 6 : beerCoverage >= .5 ? 4 : beerCoverage >= .25 ? 2 : 0;
  const religion = (simulation.churches > 0 ? 1 : 0) + (simulation.cathedrals > 0 ? 2 : 0);
  const blessings = Math.round(Math.max(0, Math.min(1, simulation.blessedShare)) * 8);
  const fear = Math.max(-5, Math.min(5, Math.trunc(simulation.fear)));
  const total = rationModifier + varietyModifier + taxModifier + beerModifier + religion + blessings + fear;
  const projected = Math.max(0, Math.min(100, simulation.popularity + total));
  const army = entities.filter((entity) => entity.kind === "unit" && entity.team === "player");
  const soldiers = army.reduce((sum, unit) => sum + (unit.count ?? 1), 0);
  const armyByType = new Map<string, number>();
  for (const unit of army) {
    const type = unit.unitClass ?? unit.role;
    armyByType.set(type, (armyByType.get(type) ?? 0) + (unit.count ?? 1));
  }
  const armyRows = [...armyByType.entries()].map(([type, count]) =>
    '<div class="dialog-row"><span>' + type + '</span><b>' + count + '</b></div>'
  ).join("") || '<p class="dialog-note">Brak jednostek w armii.</p>';
  const rows = [
    ["Racje (" + (rationNames[ration] ?? "brak") + ")", rationModifier],
    ["Różnorodność żywności", varietyModifier],
    [bribe ? "Łapówki" : "Podatki", taxModifier],
    ["Piwo", beerModifier],
    ["Religia · bonus stały", religion],
    ["Błogosławieństwa", blessings],
    ["Współczynnik strachu", fear]
  ].map(([label, value]) => '<div class="dialog-row"><span>' + label + '</span><b>' + (Number(value) > 0 ? "+" : "") + value + '</b></div>').join("");
  openDialog("KSIĘGA RAPORTÓW", "BILANS POPULARNOŚCI · NASTĘPNY MIESIĄC",
    '<div class="dialog-grid">' +
      '<div class="dialog-stat"><small>OBECNA POPULARNOŚĆ</small><b>' + simulation.popularity + '/100</b></div>' +
      '<div class="dialog-stat"><small>PROGNOZA PO NASTĘPNYM TICKU</small><b>' + projected + '/100</b></div>' +
      '<div class="dialog-stat"><small>POPULACJA</small><b>' + simulation.population + '/' + simulation.housing + '</b></div>' +
      '<div class="dialog-stat"><small>ARMIA</small><b>' + soldiers + ' żołnierzy</b></div>' +
      '<div class="dialog-stat"><small>ŻYWNOŚĆ · PRZEWIDYWANE ZUŻYCIE</small><b>' + foodConsumed.toLocaleString("pl-PL") +
        (foodShortage ? ' · NIEDOBÓR' : '') + '</b></div>' +
      '<div class="dialog-stat"><small>ZŁOTO · BILANS Z PODATKÓW</small><b>' + (goldDelta > 0 ? '+' : '') +
        goldDelta.toLocaleString("pl-PL") + '</b></div>' +
    '</div><h3>Składniki popularności</h3>' + rows +
    '<h3>Stan armii · według typów</h3>' + armyRows +
    '<p class="dialog-note">Prognoza zakłada, że obecne ustawienia i dostępność zasobów nie zmienią się przed rozliczeniem. Koszt łapówek nie jest określony w specyfikacji, więc ich bonus pozostaje zerowy, dopóki koszt nie zostanie skonfigurowany.</p>');
}

function openRanking(): void {
  const ownArmy = entities.filter((entity) => entity.kind === "unit" && entity.team === "player")
    .reduce((sum, entity) => sum + (entity.count ?? 1), 0);
  const enemyArmy = entities.filter((entity) => entity.kind === "unit" && entity.team === "enemy")
    .reduce((sum, entity) => sum + (entity.count ?? 1), 0);
  openDialog("TABELA WYNIKÓW", "ORDER OF MERIT · DOSTĘPNE DANE",
    '<div class="dialog-row"><span>CASTELLUM · gracz</span><b>Złoto ' + simulation.gold.toLocaleString("pl-PL") +
    ' · Armia ' + ownArmy + ' · Popularność ' + simulation.popularity + '</b></div>' +
    '<div class="dialog-row"><span>Banda rozbójników</span><b>Złoto — · Armia ' + enemyArmy + ' · Popularność —</b></div>' +
    '<p class="dialog-note">Pełny ranking Lordów pojawi się wraz z systemem Lordów i ekonomią przeciwników. Obecny oddział wrogi nie jest jeszcze Lordem AI.</p>');
}

function openDiplomacy(): void {
  openDialog("DYPLOMACJA I SOJUSZNICY", "ROZKAZY DLA SPRZYMIERZONYCH LORDÓW",
    '<div class="empty-context"><span>♬</span><b>Brak sojuszników</b><p>W tej rozgrywce nie ma jeszcze sprzymierzonych Lordów AI. Rozkazy ataku, obrony i transfery zasobów zostaną aktywowane po wdrożeniu dyplomacji oraz ekonomii botów.</p></div>');
}

function openOptions(): void {
  const rationValues: [number, string][] = [
    [0, "Brak racji · −8"], [0.5, "Połowa · −4"], [1, "Normalne · 0"],
    [1.5, "Dodatkowe · +4"], [2, "Podwójne · +8"]
  ];
  const taxValues: [string, string][] = [
    ["bribe-generous", "Hojna łapówka · +7"], ["bribe-large", "Duża łapówka · +5"],
    ["bribe-small", "Mała łapówka · +3"], ["none", "Brak podatków · +1"],
    ["low", "Niskie podatki · −2"], ["medium", "Średnie podatki · −4"],
    ["high", "Wysokie podatki · −6"], ["heavy", "Uciążliwe podatki · −8"],
    ["extortionate", "Złodziejskie podatki · −12"], ["cruel", "Okrutne podatki · −16"]
  ];
  const rationOptions = rationValues.map(([value, label]) =>
    '<option value="' + value + '"' + (simulation.ration === value ? " selected" : "") + '>' + label + '</option>'
  ).join("");
  const taxOptions = taxValues.map(([value, label]) =>
    '<option value="' + value + '"' + (simulation.tax === value ? " selected" : "") + '>' + label + '</option>'
  ).join("");
  openDialog("OPCJE", "USTAWIENIA ROZGRYWKI I STEROWANIA",
    '<div class="dialog-grid"><div class="dialog-stat"><small>PRĘDKOŚĆ GRY</small><b id="option-speed">' + simulation.speed + '</b>' +
    '<div class="dialog-actions"><button type="button" data-dialog-action="slower">−</button><button type="button" data-dialog-action="faster">＋</button></div></div>' +
    '<div class="dialog-stat"><small>WIDOK</small><b>' + (flattenLatched || temporaryFlatten ? "Spłaszczony" : "Normalny") +
    '</b><div class="dialog-actions"><button type="button" data-dialog-action="flatten">Spłaszczenie</button><button type="button" data-dialog-action="hud">Ukryj HUD</button></div></div></div>' +
    '<h3>Gospodarka</h3><div class="dialog-grid">' +
    '<label class="dialog-stat"><small>RACJE ŻYWNOŚCIOWE</small><select data-option-ration>' + rationOptions + '</select></label>' +
    '<label class="dialog-stat"><small>PODATKI I ŁAPÓWKI</small><select data-option-tax>' + taxOptions + '</select></label>' +
    '</div><h3>Skróty</h3><div class="dialog-row"><span>LPM</span><b>Wybór / rozkaz / budowa</b></div>' +
    '<div class="dialog-row"><span>PPM klik</span><b>Anuluj / odznacz</b></div>' +
    '<div class="dialog-row"><span>PPM + gest</span><b>Obrót / spłaszczenie / zoom / HUD</b></div>' +
    '<div class="dialog-row"><span>Spacja · V</span><b>Spłaszczenie · przytrzymaj</b></div>' +
    '<div class="dialog-row"><span>X / C · Z</span><b>Obrót · zoom</b></div>' +
    '<div class="dialog-row"><span>P · + / −</span><b>Pauza · prędkość</b></div>' +
    '<div class="dialog-row"><span>Ctrl+Alt+0–9 / Alt+0–9</span><b>Zapis / skok do kamery</b></div>' +
    '<div class="dialog-row"><span>H G M B N I S</span><b>Skok do kluczowych budynków</b></div>' +
    '<h3>Stan rozgrywki</h3><div class="dialog-actions">' +
    '<button type="button" data-dialog-action="save">ZAPISZ GRĘ</button>' +
    '<button type="button" data-dialog-action="load">WCZYTAJ ZAPIS</button></div>' +
    '<p class="dialog-note">Zapis jest przechowywany lokalnie w tej przeglądarce. Koszt łapówek nie jest określony — ich premia nie zostanie przyznana bez konfiguracji kosztu.</p>');
}

function runDialogAction(action: string): void {
  if (action === "slower") setGameSpeed(simulation, simulation.speed - 5);
  else if (action === "faster") setGameSpeed(simulation, simulation.speed + 5);
  else if (action === "flatten") toggleFlatten();
  else if (action === "hud") { closeDialog(); toggleHud(); return; }
  else if (action === "save") { saveGame(); return; }
  else if (action === "load") { loadGame(); return; }
  const speedLabel = document.querySelector<HTMLElement>("#option-speed");
  if (speedLabel) speedLabel.textContent = String(simulation.speed);
}


function renderMinimap(): void {
  const size = 25;
  const symbols: Record<string, string> = {
    sand: "·", oasis: "❧", forest: "♣", water: "≈", hill: "﹏",
    cliff: "▲", stone: "◈", iron: "◆", tar: "◉", moat: "⌁"
  };
  const cells: { terrain: string; glyph: string; owner?: string }[] = [];
  for (let miniRow = 0; miniRow < size; miniRow += 1) {
    for (let miniCol = 0; miniCol < size; miniCol += 1) {
      const counts = new Map<string, number>();
      for (let row = miniRow * 4; row < miniRow * 4 + 4; row += 1) {
        for (let col = miniCol * 4; col < miniCol * 4 + 4; col += 1) {
          const tile = world.grid.tiles[row * world.grid.columns + col];
          if (tile) counts.set(tile.terrain, (counts.get(tile.terrain) ?? 0) + 1);
        }
      }
      const terrain = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "sand";
      cells.push({ terrain, glyph: symbols[terrain] ?? "·" });
    }
  }
  for (const entity of entities) {
    if (entity.health <= 0) continue;
    const tile = worldToCell(world.grid, entity);
    if (!tile) continue;
    const miniCol = Math.max(0, Math.min(size - 1, Math.floor(tile.col / 4)));
    const miniRow = Math.max(0, Math.min(size - 1, Math.floor(tile.row / 4)));
    const cell = cells[miniRow * size + miniCol];
    if (!cell) continue;
    cell.owner = entity.team === "enemy" ? "enemy" : entity.team === "player" ? (entity.kind === "unit" ? "player" : "friendly-building") : undefined;
    if (entity.team === "enemy") cell.glyph = "●";
    else if (entity.kind === "unit") cell.glyph = "●";
    else cell.glyph = "■";
  }
  minimapGrid.innerHTML = cells.map((cell) =>
    '<span class="mini-cell ' + cell.terrain + (cell.owner ? " " + cell.owner : "") + '">' + cell.glyph + '</span>'
  ).join("");

  const bounds = visibleWorldBounds();
  const corners = [
    worldToCell(world.grid, { x: bounds.left, y: bounds.top }),
    worldToCell(world.grid, { x: bounds.right, y: bounds.top }),
    worldToCell(world.grid, { x: bounds.left, y: bounds.bottom }),
    worldToCell(world.grid, { x: bounds.right, y: bounds.bottom })
  ].filter((tile): tile is NonNullable<typeof tile> => tile !== null);
  if (corners.length) {
    const minCol = Math.min(...corners.map((tile) => tile.col));
    const maxCol = Math.max(...corners.map((tile) => tile.col));
    const minRow = Math.min(...corners.map((tile) => tile.row));
    const maxRow = Math.max(...corners.map((tile) => tile.row));
    minimapCamera.style.left = (minCol / world.grid.columns * 100) + "%";
    minimapCamera.style.top = (minRow / world.grid.rows * 100) + "%";
    minimapCamera.style.width = Math.max(3, (maxCol - minCol + 1) / world.grid.columns * 100) + "%";
    minimapCamera.style.height = Math.max(3, (maxRow - minRow + 1) / world.grid.rows * 100) + "%";
  }
}

function moveCameraFromMinimap(clientX: number, clientY: number): void {
  const rect = minimap.getBoundingClientRect();
  const col = Math.max(0, Math.min(world.grid.columns - 1, Math.floor((clientX - rect.left) / rect.width * world.grid.columns)));
  const row = Math.max(0, Math.min(world.grid.rows - 1, Math.floor((clientY - rect.top) / rect.height * world.grid.rows)));
  const point = worldPositionForCell(world.grid, col, row);
  if (point) {
    centerCameraOnPoint(point);
    renderMinimap();
  }
}

minimap.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  minimapPointerId = event.pointerId;
  minimap.setPointerCapture(event.pointerId);
  moveCameraFromMinimap(event.clientX, event.clientY);
  event.preventDefault();
});
minimap.addEventListener("pointermove", (event) => {
  if (minimapPointerId === event.pointerId) moveCameraFromMinimap(event.clientX, event.clientY);
});
minimap.addEventListener("pointerup", (event) => {
  if (minimapPointerId === event.pointerId) minimapPointerId = null;
});
minimap.addEventListener("pointercancel", () => { minimapPointerId = null; });
minimap.addEventListener("contextmenu", (event) => event.preventDefault());

function saveControlGroup(number: number): void {
  const units = selectedUnits();
  if (units.length === 0) return;
  controlGroups.set(number, units.map((unit) => unit.id));
  setStatus(`Zapisano grupę ${number}: ${units.length} oddziałów. Użyj klawisza ${number}, aby ją wybrać.`);
}

function selectControlGroup(number: number): void {
  const ids = controlGroups.get(number);
  if (!ids) return;
  const now = performance.now();
  const doublePress = lastSelectedGroupKey?.number === number && now - lastSelectedGroupKey.at < 360;
  lastSelectedGroupKey = { number, at: now };
  const group = entities.filter((entity) => ids.includes(entity.id) && entity.health > 0);
  replaceSelection(group);
  if (doublePress && group.length > 0) {
    const center = group.reduce((point, entity) => ({
      x: point.x + entity.x / group.length,
      y: point.y + entity.y / group.length
    }), { x: 0, y: 0 });
    centerCameraOnPoint(center);
    setStatus("Wybrano i wyśrodkowano kamerę na grupie " + number + " (" + group.length + " obiektów).");
  } else {
    setStatus("Wybrano grupę " + number + ": " + group.length + " obiektów. Dwukrotne naciśnięcie wyśrodkuje kamerę.");
  }
}

document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategoryId = button.dataset.category ?? "castle";
    selectedBuildItemId = null;
    clearSelection();
    document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((dial) => {
      const active = dial.dataset.category === activeCategoryId;
      dial.classList.toggle("active", active);
      dial.setAttribute("aria-pressed", String(active));
    });
    renderBuildCategory();
  });
});
document.querySelector<HTMLButtonElement>("#context-clear")?.addEventListener("click", () => {
  clearSelection();
  selectedBuildItemId = null;
  renderBuildCategory();
});
document.querySelector<HTMLButtonElement>("#undo-button")?.addEventListener("click", undoLastBuild);
document.querySelector<HTMLButtonElement>("#demolish-button")?.addEventListener("click", () => {
  setMode(mode === "demolish" ? "select" : "demolish");
  setStatus(mode === "demolish" ? "Wskaż własną wieżę do burzenia. Zwrot 50% znanych kosztów." : "Anulowano tryb burzenia.");
});
document.querySelector<HTMLButtonElement>("#rank-button")?.addEventListener("click", openRanking);
document.querySelector<HTMLButtonElement>("#diplomacy-button")?.addEventListener("click", openDiplomacy);
document.querySelector<HTMLButtonElement>("#options-button")?.addEventListener("click", openOptions);
document.querySelector<HTMLButtonElement>("#book-button")?.addEventListener("click", renderReports);
document.querySelector<HTMLButtonElement>("#hud-reveal")?.addEventListener("click", toggleHud);
document.querySelector<HTMLButtonElement>("#zoom-in")?.addEventListener("click", () => zoomAt(zoom * 1.18));
document.querySelector<HTMLButtonElement>("#zoom-out")?.addEventListener("click", () => zoomAt(zoom / 1.18));
document.querySelector<HTMLButtonElement>("#reset-camera")?.addEventListener("click", centerCamera);
document.querySelector<HTMLButtonElement>("#dialog-close")?.addEventListener("click", closeDialog);
dialogOverlay.addEventListener("click", (event) => {
  if (event.target === dialogOverlay) closeDialog();
});
dialogContent.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-dialog-action]");
  if (button) runDialogAction(button.dataset.dialogAction ?? "");
});
dialogContent.addEventListener("change", (event) => {
  const control = event.target as HTMLSelectElement;
  if (control.matches("[data-option-ration]")) {
    const value = Number(control.value);
    if ([0, 0.5, 1, 1.5, 2].includes(value)) {
      simulation.ration = value as 0 | 0.5 | 1 | 1.5 | 2;
      setStatus("Zmieniono poziom racji. Nowy bilans będzie rozliczony w kolejnym miesiącu.");
    }
  } else if (control.matches("[data-option-tax]")) {
    if (control.value in TAX_RULES) {
      simulation.tax = control.value as typeof simulation.tax;
      setStatus("Zmieniono politykę podatkową. Bilans będzie rozliczony w kolejnym miesiącu.");
    }
  }
});


function togglePause(): void {
  paused = !paused;
  const button = document.querySelector<HTMLButtonElement>("#pause-button");
  if (button) {
    button.innerHTML = paused ? "<span>▶</span><small>WZNÓW</small>" : "<span>Ⅱ</span><small>PAUZA</small>";
    button.classList.toggle("paused", paused);
  }
  if (paused) setMode("select");
  setStatus(paused ? "Symulacja zatrzymana. Kamera i minimapa pozostają aktywne." : "Symulacja wznowiona.");
}
document.querySelector<HTMLButtonElement>("#pause-button")?.addEventListener("click", togglePause);

function updateSpeedLabel(): void {
  const label = document.querySelector<HTMLElement>("#speed-value");
  if (label) label.textContent = String(simulation.speed);
  const optionSpeed = document.querySelector<HTMLElement>("#option-speed");
  if (optionSpeed) optionSpeed.textContent = String(simulation.speed);
}
document.querySelector<HTMLButtonElement>("#speed-down")?.addEventListener("click", () => {
  setGameSpeed(simulation, simulation.speed - 5); updateSpeedLabel();
  setStatus(`Prędkość symulacji: ${simulation.speed}.`);
});
document.querySelector<HTMLButtonElement>("#speed-up")?.addEventListener("click", () => {
  setGameSpeed(simulation, simulation.speed + 5); updateSpeedLabel();
  setStatus(`Prędkość symulacji: ${simulation.speed}.`);
});


function captureCamera(): { x: number; y: number; zoom: number; rotation: number } {
  return { x: worldRoot.position.x, y: worldRoot.position.y, zoom, rotation: mapRotation };
}

function restoreCamera(bookmark: { x: number; y: number; zoom: number; rotation: number }): void {
  mapRotation = bookmark.rotation;
  zoom = bookmark.zoom;
  worldRoot.rotation = mapRotation * Math.PI / 2;
  worldRoot.scale.set(zoom);
  worldRoot.position.set(bookmark.x, bookmark.y);
  zoomLabel.textContent = Math.round(zoom * 100) + "%";
  const label = document.querySelector<HTMLElement>("#rotation-label");
  if (label) label.textContent = mapRotation * 90 + "°";
  renderMinimap();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCameraState(value: unknown): value is CameraState {
  return isRecord(value) &&
    typeof value.x === "number" && Number.isFinite(value.x) &&
    typeof value.y === "number" && Number.isFinite(value.y) &&
    typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom >= 0.2 && value.zoom <= 2 &&
    typeof value.rotation === "number" && Number.isInteger(value.rotation) && value.rotation >= 0 && value.rotation <= 3;
}

function safeSavedPoint(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value) || typeof value.x !== "number" || typeof value.y !== "number" ||
      !Number.isFinite(value.x) || !Number.isFinite(value.y)) return undefined;
  if (value.x < 0 || value.y < 0 || value.x > WORLD_SIZE.width || value.y > WORLD_SIZE.height) return undefined;
  return { x: value.x, y: value.y };
}

function saveGame(): void {
  try {
    const savedEntities: SavedEntity[] = entities.map((entity) => {
      const { group: _group, ...saved } = entity;
      return saved;
    });
    const snapshot: GameSave = {
      version: 1,
      savedAt: new Date().toISOString(),
      simulation: { ...simulation },
      entities: savedEntities,
      selectedIds: [...selectedIds],
      controlGroups: [...controlGroups.entries()].map(([number, ids]) => [number, [...ids]]),
      placedStructures: [...placedStructures.entries()].map(([id, cost]) => [id, { ...cost }]),
      undoStack: [...undoStack],
      towerCounter,
      camera: captureCamera(),
      cameraBookmarks: [...cameraBookmarks.entries()].map(([number, bookmark]) => [number, { ...bookmark }]),
      lastCameraBeforeJump: lastCameraBeforeJump ? { ...lastCameraBeforeJump } : null,
      flattenLatched,
      hudVisible
    };
    localStorage.setItem("dominium.save.v1", JSON.stringify(snapshot));
    closeDialog();
    setStatus("Zapisano rozgrywkę lokalnie w tej przeglądarce.");
  } catch (error) {
    closeDialog();
    setStatus("Nie udało się zapisać gry. Przeglądarka może blokować lokalne zapisy.");
    console.error("DOMINIUM save failed", error);
  }
}

function loadGame(): void {
  let parsed: unknown;
  try {
    const raw = localStorage.getItem("dominium.save.v1");
    if (!raw) { closeDialog(); setStatus("Nie znaleziono zapisu tej rozgrywki w tej przeglądarce."); return; }
    parsed = JSON.parse(raw);
  } catch (error) {
    closeDialog(); setStatus("Zapis jest uszkodzony lub niedostępny.");
    console.error("DOMINIUM save read failed", error);
    return;
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.simulation) ||
      !Array.isArray(parsed.entities) || !isCameraState(parsed.camera) ||
      typeof parsed.flattenLatched !== "boolean" || typeof parsed.hudVisible !== "boolean") {
    closeDialog(); setStatus("Nieprawidłowy lub nieobsługiwany format zapisu.");
    return;
  }

  const savedSimulation = parsed.simulation;
  const numericFields = [
    "month", "speed", "monthProgress", "gold", "food", "wood", "stone", "popularity",
    "population", "housing", "unemployed", "foodTypes", "taverns", "beerBarrels",
    "churches", "cathedrals", "blessedShare", "fear"
  ];
  if (!numericFields.every((field) => typeof savedSimulation[field] === "number" && Number.isFinite(savedSimulation[field])) ||
      ![0, 0.5, 1, 1.5, 2].includes(Number(savedSimulation.ration)) ||
      typeof savedSimulation.tax !== "string" || !(savedSimulation.tax in TAX_RULES) ||
      (savedSimulation.bribeCostPerVillager !== null &&
        (typeof savedSimulation.bribeCostPerVillager !== "number" || !Number.isFinite(savedSimulation.bribeCostPerVillager)))) {
    closeDialog(); setStatus("Zapis zawiera nieprawidłowe dane gospodarki.");
    return;
  }
  if (Number(savedSimulation.speed) < 20 || Number(savedSimulation.speed) > 90 ||
      Number(savedSimulation.popularity) < 0 || Number(savedSimulation.popularity) > 100 ||
      Number(savedSimulation.month) < 1 || Number(savedSimulation.monthProgress) < 0 ||
      Number(savedSimulation.monthProgress) >= 30) {
    closeDialog(); setStatus("Zapis zawiera wartości poza dozwolonym zakresem.");
    return;
  }

  const allowedBaseIds = new Set(["keep", "barracks", "mill", "storehouse", "guard", "archers", "riders", "raiders"]);
  const savedRecords = parsed.entities.filter((entry): entry is Record<string, unknown> =>
    isRecord(entry) && typeof entry.id === "string" &&
    (allowedBaseIds.has(entry.id) || /^watchtower-\d+$/.test(entry.id)) &&
    typeof entry.x === "number" && Number.isFinite(entry.x) &&
    typeof entry.y === "number" && Number.isFinite(entry.y) &&
    typeof entry.health === "number" && Number.isFinite(entry.health)
  );
  if (savedRecords.length === 0 || savedRecords.length > 200) {
    closeDialog(); setStatus("Zapis nie zawiera prawidłowych obiektów rozgrywki.");
    return;
  }

  // Recreate the deterministic world, then apply the saved state to its entities.
  for (const child of worldRoot.removeChildren()) child.destroy({ children: true });
  const freshWorld = createWorld(worldRoot);
  world.layers = freshWorld.layers;
  world.grid = freshWorld.grid;
  world.setFlattened = freshWorld.setFlattened;
  selectionMarkers.clear();
  selectedIds.clear();
  placedStructures.clear();
  undoStack.length = 0;
  controlGroups.clear();
  cameraBookmarks.clear();
  towerCounter = 0;

  const baseById = new Map(freshWorld.entities.map((entity) => [entity.id, entity]));
  const restoredEntities: GameEntity[] = [];
  for (const record of savedRecords) {
    const id = String(record.id);
    let entity = baseById.get(id);
    if (!entity && id.startsWith("watchtower-")) {
      const suffix = Number(id.slice("watchtower-".length));
      entity = createWatchtower(freshWorld.layers.structures, Number(record.x), Number(record.y), suffix);
      towerCounter = Math.max(towerCounter, suffix);
    }
    if (!entity) continue;
    entity.x = Number(record.x);
    entity.y = Number(record.y);
    entity.health = Math.max(0, Math.min(entity.maxHealth, Number(record.health)));
    entity.group.position.set(entity.x, entity.y);
    if (typeof record.attackCooldown === "number" && Number.isFinite(record.attackCooldown)) entity.attackCooldown = Math.max(0, record.attackCooldown);
    if (typeof record.attackTargetId === "string") entity.attackTargetId = record.attackTargetId;
    entity.attackMoveTarget = safeSavedPoint(record.attackMoveTarget);
    entity.moveTarget = safeSavedPoint(record.moveTarget);
    entity.movementQueue = Array.isArray(record.movementQueue)
      ? record.movementQueue.map(safeSavedPoint).filter((point): point is { x: number; y: number } => point !== undefined)
      : [];
    entity.holdPosition = record.holdPosition === true;
    entity.stance = record.stance === "stand-ground" || record.stance === "defensive" || record.stance === "aggressive"
      ? record.stance : undefined;
    entity.stanceReturnTarget = safeSavedPoint(record.stanceReturnTarget);
    restoredEntities.push(entity);
  }

  const restoredIds = new Set(restoredEntities.map((entity) => entity.id));
  for (const entity of freshWorld.entities) {
    if (!restoredIds.has(entity.id)) entity.group.destroy({ children: true });
  }
  entities.splice(0, entities.length, ...restoredEntities);

  Object.assign(simulation, savedSimulation);
  towerCounter = Math.max(towerCounter, typeof parsed.towerCounter === "number" ? parsed.towerCounter : 0);

  if (Array.isArray(parsed.placedStructures)) {
    for (const entry of parsed.placedStructures) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || !restoredIds.has(entry[0]) || !isRecord(entry[1])) continue;
      const { wood: savedWood, stone: savedStone } = entry[1];
      if (typeof savedWood === "number" && Number.isFinite(savedWood) &&
          typeof savedStone === "number" && Number.isFinite(savedStone)) {
        placedStructures.set(entry[0], { wood: Math.max(0, savedWood), stone: Math.max(0, savedStone) });
      }
    }
  }
  if (Array.isArray(parsed.undoStack)) {
    for (const id of parsed.undoStack) if (typeof id === "string" && placedStructures.has(id)) undoStack.push(id);
  }
  if (Array.isArray(parsed.controlGroups)) {
    for (const entry of parsed.controlGroups) {
      if (!Array.isArray(entry) || typeof entry[0] !== "number" || !Number.isInteger(entry[0]) ||
          entry[0] < 0 || entry[0] > 9 || !Array.isArray(entry[1])) continue;
      const ids = entry[1].filter((id): id is string =>
        typeof id === "string" && restoredEntities.some((entity) => entity.id === id && entity.kind === "unit" && entity.team === "player")
      );
      if (ids.length) controlGroups.set(entry[0], ids);
    }
  }
  if (Array.isArray(parsed.selectedIds)) {
    for (const id of parsed.selectedIds) if (typeof id === "string" && restoredIds.has(id)) selectedIds.add(id);
  }
  if (Array.isArray(parsed.cameraBookmarks)) {
    for (const entry of parsed.cameraBookmarks) {
      if (Array.isArray(entry) && typeof entry[0] === "number" && Number.isInteger(entry[0]) &&
          entry[0] >= 0 && entry[0] <= 9 && isCameraState(entry[1])) cameraBookmarks.set(entry[0], entry[1]);
    }
  }
  lastCameraBeforeJump = isCameraState(parsed.lastCameraBeforeJump) ? parsed.lastCameraBeforeJump : null;
  flattenLatched = parsed.flattenLatched;
  temporaryFlatten = false;
  hudVisible = parsed.hudVisible;
  hud.hidden = !hudVisible;
  hudReveal.hidden = hudVisible;
  paused = false;
  const pauseButton = document.querySelector<HTMLButtonElement>("#pause-button");
  if (pauseButton) {
    pauseButton.innerHTML = "<span>Ⅱ</span><small>PAUZA</small>";
    pauseButton.classList.remove("paused");
  }

  applyFlattenState();
  restoreCamera(parsed.camera);
  setMode("select");
  setResources();
  updateSpeedLabel();
  const monthLabel = document.querySelector<HTMLElement>("#month-value");
  const populationLabel = document.querySelector<HTMLElement>("#population-value");
  const popularityLabel = document.querySelector<HTMLElement>("#popularity-value");
  if (monthLabel) monthLabel.textContent = "M" + simulation.month;
  if (populationLabel) populationLabel.textContent = simulation.population + "/" + simulation.housing;
  if (popularityLabel) popularityLabel.textContent = String(simulation.popularity);
  updateSelection();
  renderMinimap();
  closeDialog();
  setStatus("Wczytano zapis z " + (typeof parsed.savedAt === "string" ? parsed.savedAt : "nieznanej daty") + ".");
}

function saveCameraBookmark(number: number): void {
  cameraBookmarks.set(number, captureCamera());
  setStatus("Zapisano pozycję kamery " + number + ".");
}

function jumpCameraBookmark(number: number): void {
  const bookmark = cameraBookmarks.get(number);
  if (!bookmark) { setStatus("Nie zapisano pozycji kamery " + number + "."); return; }
  restoreCamera(bookmark);
  setStatus("Przywrócono pozycję kamery " + number + ".");
}

function jumpToBuilding(key: string): void {
  if (keysDown.has("shift")) {
    if (!lastCameraBeforeJump) { setStatus("Brak wcześniejszej zakładki kamery."); return; }
    const previous = lastCameraBeforeJump;
    lastCameraBeforeJump = null;
    restoreCamera(previous);
    setStatus("Powrót do poprzedniego widoku.");
    return;
  }
  const ids: Record<string, string> = {
    h: "keep", g: "storehouse", b: "barracks", m: "market",
    n: "mercenary-camp", i: "engineer-guild", s: "signpost"
  };
  const id = ids[key];
  const entity = entities.find((candidate) => candidate.id === id);
  if (!entity) {
    setStatus("Brak obiektu dla skrótu " + key.toUpperCase() + " w obecnym prototypie.");
    return;
  }
  lastCameraBeforeJump = captureCamera();
  centerCameraOnPoint(entity);
  replaceSelection([entity]);
  setStatus("Wyśrodkowano kamerę na: " + entity.name + ".");
}

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  const numberKey = /^[0-9]$/.test(event.key);

  if (event.ctrlKey && event.altKey && numberKey) {
    saveCameraBookmark(Number(event.key));
    event.preventDefault();
    return;
  }
  if (event.altKey && !event.ctrlKey && numberKey) {
    jumpCameraBookmark(Number(event.key));
    event.preventDefault();
    return;
  }
  if (event.ctrlKey && numberKey) {
    saveControlGroup(Number(event.key));
    event.preventDefault();
    return;
  }
  if (!event.ctrlKey && !event.altKey && !event.metaKey && numberKey) {
    selectControlGroup(Number(event.key));
    return;
  }

  if (key === " " && !event.repeat) toggleFlatten();
  if (key === "v" && !event.repeat) {
    temporaryFlatten = true;
    applyFlattenState();
  }
  if (key === "tab" && !event.repeat) {
    event.preventDefault();
    toggleHud();
  }
  keysDown.add(key);
  if (key === "p" && !event.repeat) togglePause();
  if (key === "x" && !event.repeat) rotateMap(1);
  if (key === "c" && !event.repeat) rotateMap(-1);
  if (key === "z" && !event.repeat) zoomAt(zoom < 0.9 ? 1.15 : 0.62);
  if ((key === "+" || key === "=" || key === "add") && !event.repeat) {
    setGameSpeed(simulation, simulation.speed + 5);
    updateSpeedLabel();
    setStatus("Prędkość symulacji: " + simulation.speed + ".");
  }
  if ((key === "-" || key === "subtract") && !event.repeat) {
    setGameSpeed(simulation, simulation.speed - 5);
    updateSpeedLabel();
    setStatus("Prędkość symulacji: " + simulation.speed + ".");
  }
  if (["h", "g", "m", "b", "n", "i", "s"].includes(key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
    jumpToBuilding(key);
  }
  if (key === "escape") {
    if (!dialogOverlay.hidden) closeDialog();
    else setMode("select");
  }

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
});
window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  keysDown.delete(key);
  if (key === "v" && temporaryFlatten) {
    temporaryFlatten = false;
    applyFlattenState();
  }
});
window.addEventListener("blur", () => {
  keysDown.clear();
  if (temporaryFlatten) {
    temporaryFlatten = false;
    applyFlattenState();
  }
});
window.addEventListener("pointermove", (event) => {
  if (!viewport.contains(event.target as Node)) {
    edgePointer = null;
    return;
  }
  edgePointer = { x: event.clientX, y: event.clientY };
});
window.addEventListener("pointerup", (event) => {
  if (event.button === 0) edgePointer = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomAt(zoom * (event.deltaY < 0 ? 1.1 : 0.91), event.clientX, event.clientY);
}, { passive: false });

function findTarget(id: string | undefined): GameEntity | undefined {
  return id ? entities.find((entity) => entity.id === id && entity.health > 0) : undefined;
}

function moveUnit(unit: GameEntity, deltaSeconds: number): void {
  if (!unit.moveTarget) return;
  const dx = unit.moveTarget.x - unit.x;
  const dy = unit.moveTarget.y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 3) {
    unit.x = unit.moveTarget.x;
    unit.y = unit.moveTarget.y;
    unit.moveTarget = unit.movementQueue?.shift();
    if (!unit.moveTarget && unit.attackMoveTarget) {
      unit.attackMoveTarget = undefined;
    }
  } else {
    const speed = unit.moveSpeed ?? 92;
    const step = Math.min(distance, speed * deltaSeconds);
    unit.x += (dx / distance) * step;
    unit.y += (dy / distance) * step;
    unit.group.rotation = Math.atan2(dy, dx) * 0.08;
  }
  unit.group.position.set(unit.x, unit.y);
  const marker = selectionMarkers.get(unit.id);
  if (marker) marker.position.set(unit.x, unit.y);
}

function setGridRoute(unit: GameEntity, destination: { x: number; y: number }): boolean {
  const route = findGridPath(world.grid, unit, destination);
  if (!route) return false;
  unit.movementQueue = route.slice(1);
  unit.moveTarget = route[0] ?? { ...destination };
  return true;
}

function updateCombat(deltaSeconds: number): void {
  const defeated: GameEntity[] = [];
  for (const unit of entities) {
    if (unit.kind !== "unit") continue;
    const standGround = unit.stance === "stand-ground" || unit.holdPosition === true;

    if (!unit.attackTargetId && !unit.attackMoveTarget && unit.stance) {
      const acquireRange = unit.stance === "aggressive"
        ? Infinity
        : standGround ? (unit.attackRange ?? 52) : 180;
      const nearestEnemy = entities
        .filter((candidate) => candidate.team !== unit.team && candidate.health > 0)
        .map((candidate) => ({ candidate, distance: Math.hypot(candidate.x - unit.x, candidate.y - unit.y) }))
        .filter((entry) => entry.distance <= acquireRange)
        .sort((left, right) => left.distance - right.distance)[0]?.candidate;
      if (nearestEnemy) {
        if (!standGround) unit.stanceReturnTarget ??= { x: unit.x, y: unit.y };
        unit.attackTargetId = nearestEnemy.id;
        if (!standGround) {
          unit.moveTarget = undefined;
          unit.movementQueue = [];
        }
      }
    }

    if (unit.attackMoveTarget && !unit.attackTargetId) {
      const nearestEnemy = entities
        .filter((candidate) => candidate.team !== unit.team && candidate.health > 0)
        .map((candidate) => ({ candidate, distance: Math.hypot(candidate.x - unit.x, candidate.y - unit.y) }))
        .filter((entry) => entry.distance < 180)
        .sort((left, right) => left.distance - right.distance)[0]?.candidate;
      if (nearestEnemy) {
        unit.attackTargetId = nearestEnemy.id;
        unit.moveTarget = undefined;
        unit.movementQueue = [];
      }
    }

    const rememberedTarget = unit.attackTargetId;
    const target = findTarget(rememberedTarget);
    if (!target) {
      if (rememberedTarget) unit.attackTargetId = undefined;
      if (unit.attackMoveTarget && !unit.moveTarget && (unit.movementQueue?.length ?? 0) === 0) {
        setGridRoute(unit, unit.attackMoveTarget);
      } else if (unit.stance === "defensive" && unit.stanceReturnTarget) {
        const home = unit.stanceReturnTarget;
        if (Math.hypot(home.x - unit.x, home.y - unit.y) <= 4) {
          unit.stanceReturnTarget = undefined;
        } else if (!unit.moveTarget && (unit.movementQueue?.length ?? 0) === 0) {
          setGridRoute(unit, home);
        }
      } else if (unit.stance === "aggressive") {
        unit.stanceReturnTarget = undefined;
      }
      continue;
    }

    const distance = Math.hypot(target.x - unit.x, target.y - unit.y);
    const range = unit.attackRange ?? 52;
    if (distance > range) {
      if (!standGround && !unit.moveTarget && (unit.movementQueue?.length ?? 0) === 0) {
        setGridRoute(unit, { x: target.x, y: target.y });
      }
    } else {
      unit.moveTarget = undefined;
      unit.movementQueue = [];
      unit.attackCooldown = Math.max(0, (unit.attackCooldown ?? 0) - deltaSeconds);
      if (unit.attackCooldown === 0) {
        target.health -= unit.attackDamage ?? 9;
        unit.attackCooldown = 0.85;
        if (target.health <= 0) defeated.push(target);
      }
    }
  }

  for (const entity of new Set(defeated)) {
    const index = entities.findIndex((candidate) => candidate.id === entity.id);
    if (index >= 0) entities.splice(index, 1);
    selectedIds.delete(entity.id);
    entity.group.destroy({ children: true });
    setStatus(entity.name + " został zniszczony.");
  }
  if (defeated.length > 0) updateSelection();
}

function panCamera(deltaSeconds: number): void {
  const speed = 520 * deltaSeconds;
  let dx = 0;
  let dy = 0;
  if (keysDown.has("arrowleft")) dx += 1;
  if (keysDown.has("arrowright")) dx -= 1;
  if (keysDown.has("arrowup")) dy += 1;
  if (keysDown.has("arrowdown")) dy -= 1;
  if (edgePointer) {
    const rect = viewport.getBoundingClientRect();
    const edge = 12;
    if (edgePointer.x <= rect.left + edge) dx += 1;
    else if (edgePointer.x >= rect.right - edge) dx -= 1;
    if (edgePointer.y <= rect.top + edge) dy += 1;
    else if (edgePointer.y >= rect.bottom - edge) dy -= 1;
  }
  if (dx || dy) {
    const length = Math.hypot(dx, dy) || 1;
    worldRoot.position.x += dx / length * speed;
    worldRoot.position.y += dy / length * speed;
  }
}

app.ticker.add((ticker) => {
  const deltaSeconds = Math.min(ticker.deltaMS / 1000, 0.05);
  // Camera navigation remains available during pause; simulation and unit motion do not.
  panCamera(deltaSeconds);
  minimapRefresh += deltaSeconds;
  if (minimapRefresh >= 0.45) {
    minimapRefresh = 0;
    renderMinimap();
  }
  if (paused) return;
  const reports = advanceSimulation(simulation, deltaSeconds);
  if (reports.length) {
    const latest = reports[reports.length - 1]!;
    setResources();
    const monthLabel = document.querySelector<HTMLElement>("#month-value");
    const populationLabel = document.querySelector<HTMLElement>("#population-value");
    const popularityLabel = document.querySelector<HTMLElement>("#popularity-value");
    if (monthLabel) monthLabel.textContent = `M${simulation.month}`;
    if (populationLabel) populationLabel.textContent = `${simulation.population}/${simulation.housing}`;
    if (popularityLabel) { popularityLabel.textContent = String(simulation.popularity); popularityLabel.style.color = simulation.popularity >= 50 ? "#64c982" : "#f06c65"; }
    updateScribe();
    setStatus(`Rozliczenie miesiąca ${latest.month - 1}: żywność −${latest.foodConsumed.toFixed(2)}, złoto ${latest.taxes >= 0 ? "+" : ""}${latest.taxes.toFixed(1)}${latest.bribeCost ? `, łapówka −${latest.bribeCost.toFixed(1)}` : ""}, popularność ${latest.popularityChange >= 0 ? "+" : ""}${latest.popularityChange}.`);
  }
  updateCombat(deltaSeconds);
  for (const entity of entities) {
    if (entity.kind === "unit") moveUnit(entity, deltaSeconds);
  }
});

setMode("select");
setResources();
updateSpeedLabel();
centerCamera();
updateSelection();
const initialMonth = document.querySelector<HTMLElement>("#month-value");
const initialPopulation = document.querySelector<HTMLElement>("#population-value");
const initialPopularity = document.querySelector<HTMLElement>("#popularity-value");
if (initialMonth) initialMonth.textContent = `M${simulation.month}`;
if (initialPopulation) initialPopulation.textContent = `${simulation.population}/${simulation.housing}`;
if (initialPopularity) initialPopularity.textContent = String(simulation.popularity);
renderBuildCategory();
renderMinimap();
updateScribe();
window.addEventListener("resize", () => {
  centerCamera();
  renderMinimap();
});
