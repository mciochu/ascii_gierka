import { Application, Container } from "pixi.js";
import "./style.css";
import {
  DEFAULT_EFFULGENCE_SETTINGS,
  EFFULGENCE_SETTINGS_KEY,
  normalizeEffulgenceSettings,
  cellSizeForDensity,
  unitPickRadiusWorld,
  type EffulgenceSettings
} from "./engine/effulgence";
import { addGlyph, type GlyphDisplay } from "./engine/glyph";
import { advanceProjectile, projectileDuration, projectilePointAt } from "./engine/projectiles";
import { createEffulgenceRenderGraph } from "./engine/render-graph";
import {
  createWatchtower, createTownBuilding, createStorageBuilding, createProductionBuilding, createCombatSquad, createFortification, createWorld, WORLD_SIZE,
  type GameEntity, type TownBuildingType, type LogisticsBuildingType
} from "./engine/world";
import {
  addStorageBuilding,
  addWorksite,
  advanceProduction,
  pickupProductionInput,
  completeProductionInputDelivery,
  advanceSimulation,
  assignAvailableWorkers,
  calculateFearFactor,
  CAMPFIRE,
  campfireIdlePosition,
  setWorksiteEnabled,
  depositStoredResource,
  spendStoredResource,
  storeResource,
  syncResourceCounters,
  totalResource,
  BLESSING_DURATION_SECONDS,
  VILLAGER_MOVE_SPEED,
  getFearDamageMultiplier,
  getFearWorkMultiplier,
  getPopularityModifiers,
  removeWorksite,
  setGameSpeed,
  setHovelCapacity,
  syncPopulationCounters,
  updateBlessedShare,
  createSimulation,
  recruitFromCampfire,
  TAX_RULES
} from "./engine/simulation";
import { BUILD_CATEGORIES, findBuildCategory, findBuildItem } from "./ui/catalog";
import {
  canRecruitUnit, RECRUITMENT_RECIPES, resolveLordOutcome,
  type GameOutcome, type RecruitableUnitClass
} from "./engine/warfare";
import {
  canPlaceFortification, FORTIFICATION_COSTS, removeFortificationFromTile, setFortificationGate,
  type FortificationKind
} from "./engine/fortifications";
import {
  DEFAULT_STORAGE_CAPACITY, HUNTING_NODES, PRODUCTION_RECIPES, RESOURCE_DEFINITIONS, STAGE4_BUILD_COSTS,
  STORAGE_MODULE_CAPACITY, STORAGE_MODULE_COST, canStoreResource, expandStorage,
  normalizeLogistics, removeStorage, storageFreeSlots, storageUsedSlots, tradeAtMarket,
  type ProductionType, type ResourceId, type StorageType
} from "./engine/logistics";
import {
  findGridPath,
  GRID_PIVOT,
  isBuildableAtWorld,
  isWalkableAtWorld,
  isWorldPointInViewport,
  viewportToWorld,
  worldPositionForCell,
  worldToCell,
  worldToViewport
} from "./engine/grid";

type ToolMode = "select" | "attack-move" | "build" | "demolish";
type CameraState = { x: number; y: number; zoom: number; rotation: number };
const TOWN_BUILD_COSTS: Record<TownBuildingType, { wood: number; gold: number }> = {
  hovel: { wood: 6, gold: 0 }, chapel: { wood: 0, gold: 250 },
  church: { wood: 0, gold: 500 }, cathedral: { wood: 0, gold: 1000 },
  inn: { wood: 20, gold: 100 }, good: { wood: 0, gold: 20 }, bad: { wood: 0, gold: 40 }
};
type SavedEntity = Omit<GameEntity, "group">;
type PlacedStructureCost = {
  wood: number;
  stone: number;
  gold: number;
  housing?: number;
  worksiteId?: string;
  fearObjectId?: string;
  storageId?: string;
  storageModuleId?: string;
  storageModuleSlots?: number;
};

interface GameSave {
  version: 1;
  savedAt: string;
  simulation: ReturnType<typeof createSimulation>;
  entities: SavedEntity[];
  selectedIds: string[];
  controlGroups: [number, string[]][];
  placedStructures: [string, PlacedStructureCost][];
  undoStack: string[];
  towerCounter: number;
  townBuildingCounter: number;
  stage4BuildingCounter: number;
  recruitedUnitCounter?: number;
  fortificationCounter?: number;
  gameOutcome?: GameOutcome;
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
const effulgence = createEffulgenceRenderGraph(app, worldRoot, world.layers);
effulgence.setLights([{
  id: "keep-campfire",
  x: CAMPFIRE.x,
  y: CAMPFIRE.y,
  color: "#FF7B1A",
  intensity: 1.35,
  radius: 6.5,
  flickerHz: 7,
  flickerAmplitude: 0.08,
  priority: 100
}]);
let effulgenceSettings: EffulgenceSettings = { ...DEFAULT_EFFULGENCE_SETTINGS };
try {
  const savedVisualSettings = localStorage.getItem(EFFULGENCE_SETTINGS_KEY);
  if (savedVisualSettings) effulgenceSettings = normalizeEffulgenceSettings(JSON.parse(savedVisualSettings));
} catch {
  effulgenceSettings = { ...DEFAULT_EFFULGENCE_SETTINGS };
}
effulgence.setSettings(effulgenceSettings);
const entities = world.entities;
let buildPreviewLayer = new Container();
buildPreviewLayer.zIndex = 1000;
buildPreviewLayer.visible = false;
worldRoot.addChild(buildPreviewLayer);
effulgence.setLayers(world.layers, buildPreviewLayer);
let buildPreviewRing: GlyphDisplay | null = null;
let buildPreviewGlyph: GlyphDisplay | null = null;
let lastBuildPreviewClient: { x: number; y: number } | null = null;

let zoom = 1.0;
let mapRotation = 0;
const MAP_PIVOT = GRID_PIVOT;
let mode: ToolMode = "select";
let paused = false;
let gameOutcome: GameOutcome = "playing";
let recruitedUnitCounter = 0;
let fortificationCounter = 0;
interface CombatProjectile {
  targetId: string;
  start: { x: number; y: number };
  elapsed: number;
  duration: number;
  damage: number;
  glyph: GlyphDisplay;
}
const combatProjectiles: CombatProjectile[] = [];
const simulation = createSimulation();
let gold = simulation.gold;
let food = simulation.food;
let wood = simulation.wood;
let stone = simulation.stone;
let towerCounter = 0;
let pointerSession: PointerSession | null = null;
let lastClick: { id: string; at: number } | null = null;
const selectedIds = new Set<string>();
const selectionMarkers = new Map<string, GlyphDisplay>();
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
const placedStructures = new Map<string, PlacedStructureCost>();
const undoStack: string[] = [];
let townBuildingCounter = 0;
let stage4BuildingCounter = 0;
let minimapRefresh = 0;
const villagerViews = new Map<string, GlyphDisplay>();
let campfireRingGreen: GlyphDisplay;
let campfireRingRed: GlyphDisplay;
let campfireGlyph: GlyphDisplay;
let campfireLabel: GlyphDisplay;
let campfireProgressGlyph: GlyphDisplay;
function createCampfireVisuals(): void {
  campfireRingGreen = addGlyph(world.layers.details, { char: "◌", x: CAMPFIRE.x, y: CAMPFIRE.y, size: 62, color: "#68d47f", alpha: 0.9 });
  campfireRingRed = addGlyph(world.layers.details, { char: "◌", x: CAMPFIRE.x, y: CAMPFIRE.y, size: 62, color: "#ef625d", alpha: 0 });
  campfireProgressGlyph = addGlyph(world.layers.details, { char: "◔", x: CAMPFIRE.x, y: CAMPFIRE.y, size: 62, color: "#d8f1d7", alpha: 0.95 });
  campfireGlyph = addGlyph(world.layers.details, {
    char: "♨", x: CAMPFIRE.x, y: CAMPFIRE.y, size: 35, color: "#e4ad55", alpha: 0.96,
    material: "vfx", height: 0.1, emissive: 1.35, emissiveColor: "#FF7B1A", animated: true,
    entityId: "keep-campfire"
  });
  campfireLabel = addGlyph(world.layers.details, { char: "0/24", x: CAMPFIRE.x, y: CAMPFIRE.y - 44, size: 13, color: "#9bd8a7", alpha: 0.9, weight: "bold" });
}
createCampfireVisuals();
let lastViewportCenter = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };

function setStatus(message: string): void {
  statusMessage.textContent = message;
}

function allSelected(): GameEntity[] {
  return entities.filter((entity) => selectedIds.has(entity.id));
}

function selectedUnits(): GameEntity[] {
  return allSelected().filter((entity) => entity.kind === "unit" && entity.team === "player");
}

function canPlaceBuildPreview(itemId: string, point: { x: number; y: number }): boolean {
  if (point.x < 40 || point.y < 40 || point.x > WORLD_SIZE.width - 40 || point.y > WORLD_SIZE.height - 40) return false;
  if (FORTIFICATION_BUILDING_IDS.includes(itemId)) {
    const kind = FORTIFICATION_KIND_BY_ITEM[itemId]!;
    const tile = worldToCell(world.grid, point);
    if (!tile || !canPlaceFortification(world.grid, tile.col, tile.row) ||
        entities.some((entity) => entity.fortificationKind
          ? entity.gridCol === tile.col && entity.gridRow === tile.row
          : Math.hypot(entity.x - point.x, entity.y - point.y) < (entity.kind === "building" ? 48 : 38))) return false;
    const cost = FORTIFICATION_COSTS[kind];
    return totalResource(simulation, "wood") >= cost.wood &&
      totalResource(simulation, "stone") >= cost.stone && simulation.gold >= cost.gold;
  }
  if (STAGE4_BUILDING_IDS.includes(itemId)) {
    const cost = STAGE4_BUILD_COSTS[itemId];
    const placement = stage4PlacementPoint(itemId, point.x, point.y);
    return !!cost && !!placement && totalResource(simulation, "wood") >= cost.wood &&
      totalResource(simulation, "stone") >= cost.stone && simulation.gold >= cost.gold;
  }
  if (!isBuildableAtWorld(world.grid, point)) return false;
  if (itemId === "watchtower") {
    if (simulation.wood < 70 || simulation.stone < 30) return false;
    return !entities.some((entity) => Math.hypot(entity.x - point.x, entity.y - point.y) < (entity.kind === "building" ? 112 : 48));
  }
  const types: Record<string, TownBuildingType> = {
    hovel: "hovel", chapel: "chapel", church: "church", cathedral: "cathedral", inn: "inn",
    "good-things": "good", "bad-things": "bad"
  };
  const type = types[itemId];
  if (!type) return false;
  const cost = TOWN_BUILD_COSTS[type];
  if (simulation.wood < cost.wood || simulation.gold < cost.gold) return false;
  const clearance = type === "good" || type === "bad" ? 54 : 86;
  return !entities.some((entity) => Math.hypot(entity.x - point.x, entity.y - point.y) < (entity.kind === "building" ? clearance : 48));
}

function updateBuildPreview(clientX: number, clientY: number): void {
  if (mode !== "build" || !selectedBuildItemId) {
    buildPreviewLayer.visible = false;
    return;
  }
  lastBuildPreviewClient = { x: clientX, y: clientY };
  const rect = viewport.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    buildPreviewLayer.visible = false;
    return;
  }
  const worldPoint = screenToWorld(clientX, clientY);
  const tile = worldToCell(world.grid, worldPoint);
  const point = tile ? worldPositionForCell(world.grid, tile.col, tile.row) : null;
  if (!point) {
    buildPreviewLayer.visible = false;
    return;
  }
  const valid = canPlaceBuildPreview(selectedBuildItemId, point);
  const item = findBuildItem(selectedBuildItemId);
  const glyph = item?.glyph ?? "◇";
  const color = valid ? "#65e08b" : "#ef6862";
  if (!buildPreviewRing) {
    buildPreviewRing = addGlyph(buildPreviewLayer, { char: "◇", x: point.x, y: point.y, size: 96, color, alpha: 0.76, weight: "bold", stroke: "#090d0d", strokeWidth: 1 });
  } else {
    buildPreviewRing.position.set(point.x, point.y);
    buildPreviewRing.style.fill = color;
    buildPreviewRing.alpha = 0.76;
  }
  if (!buildPreviewGlyph) {
    buildPreviewGlyph = addGlyph(buildPreviewLayer, { char: glyph, x: point.x, y: point.y - 2, size: 42, color, alpha: 0.98, weight: "bold", stroke: "#090d0d", strokeWidth: 1 });
  } else {
    buildPreviewGlyph.text = glyph;
    buildPreviewGlyph.position.set(point.x, point.y - 2);
    buildPreviewGlyph.style.fill = color;
    buildPreviewGlyph.alpha = 0.98;
  }
  buildPreviewLayer.visible = true;
}

function setMode(next: ToolMode): void {
  if (paused && next !== "select") {
    setStatus("Gra jest wstrzymana — nie można rozpoczynać budowania ani wydawać rozkazów.");
    next = "select";
  }
  mode = next;
  buildPreviewLayer.visible = mode === "build";
  if (mode === "build" && lastBuildPreviewClient) {
    updateBuildPreview(lastBuildPreviewClient.x, lastBuildPreviewClient.y);
  }
  demolishButton.classList.toggle("active", mode === "demolish");
  const labels: Record<ToolMode, string> = {
    select: "ZAZNACZANIE", "attack-move": "ATAK W RUCHU", build: "BUDOWANIE", demolish: "BURZENIE"
  };
  const hints: Record<ToolMode, string> = {
    select: "LPM: WYBÓR / ROZKAZ · SHIFT+LPM: KOLEJNY PUNKT TRASY",
    "attack-move": "LPM WSKAŻ CEL ATAKU W RUCHU · PPM ANULUJE",
    build: "LPM POSTAW WYBRANĄ BUDOWLĘ · PPM ANULUJE",
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
  const itemsMarkup = category.items.map((item) => {
    const tooltip = item.name + (item.cost ? " — koszt: " + item.cost : item.note ? " — " + item.note : " — dostępne w kolejnym etapie");
    return '<button type="button" class="build-item' + (item.implemented ? "" : " unavailable") +
    (selectedBuildItemId === item.id ? " selected" : "") + '" data-build-id="' + item.id +
    '" title="' + tooltip + '"><span class="build-glyph">' + item.glyph +
    '</span><span><b>' + item.name + '</b><small>' +
    (item.cost ?? (item.implemented ? "DOSTĘPNE" : "KOLEJNY ETAP")) +
    '</small></span></button>';
  }).join("");
  contextContent.innerHTML = '<div class="build-list">' + itemsMarkup + '</div>';
  contextContent.querySelectorAll<HTMLButtonElement>("[data-build-id]").forEach((button) => {
    button.addEventListener("click", () => selectBuildItem(button.dataset.buildId ?? ""));
  });
}

function selectBuildItem(itemId: string): void {
  const item = findBuildItem(itemId);
  if (!item) return;
  if (item.implemented && paused) {
    setStatus("Gra jest wstrzymana — wznów symulację, aby rozpocząć budowanie.");
    return;
  }
  selectedBuildItemId = itemId;
  renderBuildCategory();
  if (!item.implemented) {
    setMode("select");
    setStatus(item.name + ": " + (item.note ?? "Mechanika nie jest jeszcze dostępna."));
    return;
  }
  const stageThreeBuildings = ["hovel", "chapel", "church", "cathedral", "inn", "good-things", "bad-things"];
  if (itemId === "watchtower" || stageThreeBuildings.includes(itemId) || STAGE4_BUILDING_IDS.includes(itemId)) {
    setMode("build");
    setStatus("Budowa: kliknij wolne, dozwolone pole mapy. " + (item.cost ?? ""));
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
    popularity.style.color = simulation.popularity >= 50 ? "#87966b" : "#a63832";
  }
  if (population) population.textContent = simulation.population + "/" + simulation.housing;
  const unemployed = document.querySelector<HTMLElement>("#scribe-unemployed");
  if (unemployed) unemployed.textContent = simulation.unemployed + " PRZY OGNISKU";
  if (face) {
    face.textContent = simulation.popularity >= 65 ? "☺" : simulation.popularity >= 50 ? "◡" : "☹";
    face.style.color = simulation.popularity >= 50 ? "#e5c579" : "#f07870";
  }
}

function redrawSelectionMarkers(): void {
  for (const marker of selectionMarkers.values()) marker.destroy();
  selectionMarkers.clear();

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
      strokeWidth: 2,
      material: "selection",
      height: 0.025,
      emissive: 0.15,
      entityId: "selection:" + entity.id
    });
    selectionMarkers.set(entity.id, marker);
  }
}

function routeVillagerTo(villager: (typeof simulation.villagers)[number], target: { x: number; y: number }): boolean {
  const route = findGridPath(world.grid, villager, target);
  if (!route) return false;
  villager.movementQueue = route.slice(1);
  villager.moveTarget = route[0] ?? { ...target };
  return true;
}

function routeVillagerOut(villager: (typeof simulation.villagers)[number]): void {
  const current = worldToCell(world.grid, villager);
  if (!current) return;
  const edgeTiles = world.grid.tiles.filter((tile) =>
    tile.walkable && (tile.row === 0 || tile.row === world.grid.rows - 1 || tile.col === 0 || tile.col === world.grid.columns - 1)
  );
  edgeTiles.sort((left, right) =>
    (Math.abs(left.col - current.col) + Math.abs(left.row - current.row)) -
    (Math.abs(right.col - current.col) + Math.abs(right.row - current.row))
  );
  for (const tile of edgeTiles.slice(0, 12)) {
    const exit = worldPositionForCell(world.grid, tile.col, tile.row);
    if (exit && routeVillagerTo(villager, exit)) return;
  }
}

function advanceVillagerRoute(villager: (typeof simulation.villagers)[number], gameDelta: number): boolean {
  if (!villager.moveTarget) return true;
  const dx = villager.moveTarget.x - villager.x;
  const dy = villager.moveTarget.y - villager.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 4) {
    villager.x = villager.moveTarget.x;
    villager.y = villager.moveTarget.y;
    villager.moveTarget = villager.movementQueue.shift();
    return !villager.moveTarget && villager.movementQueue.length === 0;
  }
  const step = Math.min(distance, VILLAGER_MOVE_SPEED * gameDelta);
  villager.x += dx / distance * step;
  villager.y += dy / distance * step;
  return false;
}

function updateVillagerVisuals(realDeltaSeconds: number): void {
  const gameDelta = paused ? 0 : realDeltaSeconds * (simulation.speed / 40);
  if (gameDelta > 0) advanceProduction(simulation, gameDelta);
  const activeIds = new Set(simulation.villagers.map((villager) => villager.id));
  for (const [id, glyph] of villagerViews) {
    if (!activeIds.has(id)) { glyph.destroy(); villagerViews.delete(id); }
  }

  const getWorksite = (villager: (typeof simulation.villagers)[number]) =>
    simulation.worksites.find((site) => site.id === (villager.returnWorksiteId ?? villager.worksiteId));
  const getStorage = (storageId: string | undefined) =>
    simulation.logistics.storages.find((storage) => storage.id === storageId);
  const sendWorkerBack = (villager: (typeof simulation.villagers)[number]): void => {
    villager.status = "returning-to-work";
    villager.moveTarget = undefined;
    villager.movementQueue = [];
  };
  const deliverCargo = (villager: (typeof simulation.villagers)[number]): boolean => {
    const storage = getStorage(villager.targetStorageId);
    if (!storage || !villager.cargo?.length) return false;
    const remaining: NonNullable<typeof villager.cargo> = [];
    for (const item of villager.cargo) {
      const stored = storeResource(simulation, storage.id, item.resource, item.amount);
      if (stored + 0.000001 < item.amount) remaining.push({ resource: item.resource, amount: item.amount - stored });
    }
    if (remaining.length) {
      villager.cargo = remaining;
      const alternative = simulation.logistics.storages
        .filter((candidate) => candidate.id !== storage.id && remaining.every((item) => canStoreResource(candidate, item.resource, item.amount)))
        .sort((a, b) => Math.hypot(a.x - villager.x, a.y - villager.y) - Math.hypot(b.x - villager.x, b.y - villager.y))[0];
      if (alternative) {
        villager.targetStorageId = alternative.id;
        villager.status = "hauling-output";
        villager.moveTarget = undefined;
        villager.movementQueue = [];
      } else {
        villager.status = "waiting-at-storage";
      }
      return false;
    }
    villager.cargo = undefined;
    villager.logisticsTask = undefined;
    villager.targetStorageId = undefined;
    sendWorkerBack(villager);
    setResources();
    return true;
  };

  let returnedToCampfire = false;
  for (const villager of simulation.villagers) {
    let glyph = villagerViews.get(villager.id);
    if (!glyph) {
      glyph = addGlyph(world.layers.actors, {
        char: villager.role === "priest" ? "♙" : "♟",
        x: villager.x, y: villager.y, size: 19,
        color: villager.status === "leaving" ? "#b36b62" : villager.cargo?.length ? "#e4c36e" : villager.role === "priest" ? "#e9dfbc" : "#8bd18a",
        alpha: 0.96, stroke: "#10140f", strokeWidth: 1,
        material: "unit", height: 0.24, entityId: villager.id,
        strategicGlyph: villager.role === "priest" ? "†" : "*",
        minScreenCells: [1, 2]
      });
      villagerViews.set(villager.id, glyph);
    }
    glyph.text = villager.role === "priest" ? "♙" : "♟";
    glyph.style.fill = villager.status === "leaving" ? "#b36b62" : villager.cargo?.length ? "#e4c36e" : villager.role === "priest" ? "#e9dfbc" : "#8bd18a";

    if (villager.status === "walking-to-work" && !villager.moveTarget && villager.movementQueue.length === 0) {
      const target = { x: villager.targetX ?? villager.x, y: villager.targetY ?? villager.y };
      if (!routeVillagerTo(villager, target)) {
        for (const site of simulation.worksites) {
          const workerIndex = site.workerIds.indexOf(villager.id);
          if (workerIndex >= 0) site.workerIds.splice(workerIndex, 1);
        }
        villager.status = "idle";
        villager.worksiteId = undefined;
        villager.targetX = undefined;
        villager.targetY = undefined;
        villager.role = "laborer";
        syncPopulationCounters(simulation);
      }
    }
    if (["fetching-input", "hauling-output", "waiting-for-route"].includes(villager.status) &&
        !villager.moveTarget && villager.movementQueue.length === 0) {
      const returning = villager.status === "waiting-for-route" && !!villager.returnWorksiteId && !villager.targetStorageId;
      const destination = returning ? getWorksite(villager) : getStorage(villager.targetStorageId);
      if (destination) {
        const routed = routeVillagerTo(villager, destination);
        if (routed) villager.status = returning ? "returning-to-work" : villager.logisticsTask === "fetch-input" ? "fetching-input" : "hauling-output";
        else villager.status = "waiting-for-route";
      } else {
        villager.status = "waiting-for-route";
      }
    }
    if (villager.status === "waiting-at-storage") {
      if (villager.logisticsTask === "fetch-input" && !villager.cargo) pickupProductionInput(simulation, villager.id);
      else deliverCargo(villager);
    }
    if (villager.status === "returning-to-work" && !villager.moveTarget && villager.movementQueue.length === 0) {
      const site = getWorksite(villager);
      if (site && !routeVillagerTo(villager, site)) {
        villager.status = "waiting-for-route";
        site.waitingReason = "Pracownik nie ma drożnej trasy powrotnej";
      }
    }
    if (villager.status === "returning-to-campfire" && !villager.moveTarget && villager.movementQueue.length === 0) {
      routeVillagerTo(villager, CAMPFIRE);
    }
    if (villager.status === "leaving" && !villager.moveTarget && villager.movementQueue.length === 0) {
      routeVillagerOut(villager);
    }

    const movingStatuses = ["walking-to-work", "returning-to-campfire", "leaving", "fetching-input", "hauling-output", "returning-to-work"];
    if (gameDelta > 0 && movingStatuses.includes(villager.status)) {
      const arrived = advanceVillagerRoute(villager, gameDelta);
      if (arrived && villager.status === "leaving") villager.departed = true;
      if (arrived && villager.status === "returning-to-campfire") {
        const idlePosition = campfireIdlePosition(simulation.villagers.filter((candidate) => candidate.status === "idle").length);
        villager.x = idlePosition.x;
        villager.y = idlePosition.y;
        villager.status = "idle";
        villager.targetX = undefined;
        villager.targetY = undefined;
        villager.moveTarget = undefined;
        villager.movementQueue = [];
        returnedToCampfire = true;
      }
      if (arrived && villager.status === "walking-to-work") {
        const site = getWorksite(villager);
        if (site) {
          const slot = Math.max(0, site.workerIds.indexOf(villager.id));
          const angle = slot * 2.399963229728653;
          villager.x = site.x + Math.cos(angle) * 22;
          villager.y = site.y + Math.sin(angle) * 18;
        }
        villager.status = "working";
      } else if (arrived && villager.status === "fetching-input") {
        pickupProductionInput(simulation, villager.id);
      } else if (arrived && villager.status === "hauling-output") {
        deliverCargo(villager);
      } else if (arrived && villager.status === "returning-to-work") {
        const site = getWorksite(villager);
        if (villager.logisticsTask === "fetch-input") {
          completeProductionInputDelivery(simulation, villager.id);
        } else {
          villager.logisticsTask = undefined;
          villager.targetStorageId = undefined;
          villager.returnWorksiteId = undefined;
          villager.status = "working";
        }
        if (site) {
          const slot = Math.max(0, site.workerIds.indexOf(villager.id));
          const angle = slot * 2.399963229728653;
          villager.x = site.x + Math.cos(angle) * 22;
          villager.y = site.y + Math.sin(angle) * 18;
        }
      }
    }
    glyph.position.set(villager.x, villager.y);
  }

  if (returnedToCampfire) assignAvailableWorkers(simulation);

  // Priests roam between residents. Blessings expire, so they revisit the least recently blessed people.
  for (const priest of simulation.villagers.filter((villager) => villager.role === "priest" && villager.status === "working")) {
    if (priest.blessingReadyAt && priest.blessingReadyAt > simulation.elapsedSeconds) continue;
    let target = simulation.villagers.find((villager) => villager.id === priest.blessingTargetId && villager.status !== "leaving" && villager.role !== "priest");
    if (!target || (!priest.moveTarget && priest.movementQueue.length === 0 && Math.hypot(target.x - priest.x, target.y - priest.y) < 70)) {
      target = simulation.villagers
        .filter((villager) => villager.status !== "leaving" && villager.role !== "priest" && villager.id !== priest.id)
        .sort((left, right) => left.blessedUntil - right.blessedUntil || Math.hypot(left.x - priest.x, left.y - priest.y) - Math.hypot(right.x - priest.x, right.y - priest.y))[0];
      priest.blessingTargetId = target?.id;
      priest.moveTarget = undefined;
      priest.movementQueue = [];
    }
    if (!target) continue;
    if (Math.hypot(target.x - priest.x, target.y - priest.y) <= 68) {
      target.blessedUntil = simulation.elapsedSeconds + BLESSING_DURATION_SECONDS;
      priest.blessingTargetId = undefined;
      priest.blessingReadyAt = simulation.elapsedSeconds + 2;
      priest.moveTarget = undefined;
      priest.movementQueue = [];
      continue;
    }
    if (!priest.moveTarget && priest.movementQueue.length === 0) routeVillagerTo(priest, target);
    if (gameDelta > 0) advanceVillagerRoute(priest, gameDelta);
    const view = villagerViews.get(priest.id);
    if (view) view.position.set(priest.x, priest.y);
  }

  syncPopulationCounters(simulation);
  syncResourceCounters(simulation);
  simulation.fear = calculateFearFactor(simulation.fearObjects, simulation.population);
  updateBlessedShare(simulation);
  const topPopulation = document.querySelector<HTMLElement>("#population-value");
  if (topPopulation) topPopulation.textContent = simulation.population + "/" + simulation.housing;
  const topPopularity = document.querySelector<HTMLElement>("#popularity-value");
  if (topPopularity) topPopularity.textContent = String(simulation.popularity);
  campfireRingGreen.alpha = simulation.popularity >= 50 ? 0.95 : 0.12;
  campfireRingRed.alpha = simulation.popularity < 50 ? 0.95 : 0.12;
  campfireLabel.text = simulation.unemployed + "/24 · " + Math.round(simulation.spawnProgress * 100) + "%";
  campfireLabel.style.fill = simulation.unemployed >= 24 ? "#ef7770" : "#9bd8a7";
  const ring = ["◔", "◑", "◕", "●"];
  campfireProgressGlyph.text = ring[Math.min(3, Math.floor(simulation.spawnProgress * 4))] ?? "◔";
  campfireProgressGlyph.alpha = simulation.popularity >= 50 && simulation.population < simulation.housing && simulation.unemployed < 24 ? 0.95 : 0.18;
  campfireGlyph.alpha = simulation.unemployed >= 24 ? 0.55 : 0.96;
  updateScribe();
}

const variantNamesForMain: Partial<Record<ResourceId, string>> = {
  bow: "Łuk", crossbow: "Kusza", spear: "Włócznia", pike: "Pika", mace: "Buzdygan", sword: "Miecz"
};


function recruitmentSpawnPoint(): { x: number; y: number } | null {
  const barracks = entities.find((entity) => entity.id === "barracks");
  if (!barracks) return null;
  const origin = worldToCell(world.grid, barracks);
  if (!origin) return null;
  const candidates: { x: number; y: number; distance: number }[] = [];
  for (let radius = 1; radius <= 5; radius += 1) {
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
        const col = origin.col + dc;
        const row = origin.row + dr;
        const tile = world.grid.tiles[row * world.grid.columns + col];
        if (!tile || !tile.walkable || !tile.buildable) continue;
        const point = worldPositionForCell(world.grid, col, row);
        if (!point || !findGridPath(world.grid, barracks, point)) continue;
        if (entities.some((entity) => Math.hypot(entity.x - point.x, entity.y - point.y) < (entity.kind === "building" ? 62 : 46))) continue;
        candidates.push({ ...point, distance: Math.hypot(point.x - barracks.x, point.y - barracks.y) });
      }
    }
    if (candidates.length) break;
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : null;
}

function recruitAtBarracks(unitClass: RecruitableUnitClass): void {
  if (paused || gameOutcome !== "playing") {
    setStatus("Rekrutacja jest dostępna wyłącznie podczas aktywnej rozgrywki.");
    return;
  }
  const recipe = RECRUITMENT_RECIPES[unitClass];
  if (!recipe) return;
  const stock = totalResource(simulation, recipe.weapon);
  if (!canRecruitUnit(unitClass, simulation.unemployed, stock, gameOutcome) ||
      !simulation.villagers.some((villager) => villager.status === "idle")) {
    setStatus("Brak bezrobotnego chłopa lub właściwej broni w Zbrojowni.");
    renderSelectionPanel();
    return;
  }
  const spawn = recruitmentSpawnPoint();
  if (!spawn) {
    setStatus("Brak wolnego, dostępnego pola przy Koszarach. Oczyść miejsce na wymarsz oddziału.");
    return;
  }
  if (!spendStoredResource(simulation, recipe.weapon, 1)) {
    setStatus("Broń musi znajdować się fizycznie w Zbrojowni.");
    return;
  }
  if (!recruitFromCampfire(simulation)) {
    storeResource(simulation, "armory", recipe.weapon, 1);
    setStatus("Nie znaleziono bezrobotnego mieszkańca przy ognisku.");
    return;
  }
  recruitedUnitCounter += 1;
  const squad = createCombatSquad(
    world.layers.actors,
    "recruit-" + unitClass + "-" + recruitedUnitCounter,
    unitClass,
    1,
    spawn.x,
    spawn.y,
    "player"
  );
  squad.attackDamage = recipe.damage;
  squad.attackRange = recipe.range;
  squad.moveSpeed = recipe.speed;
  entities.push(squad);
  syncPopulationCounters(simulation);
  syncResourceCounters(simulation);
  setResources();
  updateVillagerVisuals(0);
  renderMinimap();
  replaceSelection([squad]);
  setStatus("Zwerbowano: " + recipe.label + ". Zużyto 1 bezrobotnego i 1 " + RESOURCE_DEFINITIONS[recipe.weapon].name + " ze Zbrojowni.");
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
      '</b><small>×' + units.filter((unit) => (unit.unitClass ?? unit.role) === type)
        .reduce((sum, unit) => sum + (unit.count ?? 1), 0) + '</small></button>'
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
    const health = Math.max(0, Math.min(100, (entity.health / Math.max(1, entity.maxHealth)) * 100));
    const worksite = entity.kind === "building"
      ? simulation.worksites.find((site) => site.id === entity.id)
      : undefined;
    const storage = entity.kind === "building"
      ? simulation.logistics.storages.find((candidate) => candidate.id === entity.id)
      : undefined;
    const storageRows = storage
      ? (Object.entries(storage.inventory) as [ResourceId, number][]).filter(([, amount]) => amount > 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([resource, amount]) => '<div class="dialog-row"><span>' + RESOURCE_DEFINITIONS[resource].name + '</span><b>' + amount.toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + '</b></div>').join("")
      : '';
    const storageMarkup = storage
      ? '<div class="storage-panel"><div class="selection-meta">MAGAZYN · WYKORZYSTANIE POL <b>' + storageUsedSlots(storage) + '/' + storage.capacitySlots +
        ' · WOLNE ' + storageFreeSlots(storage) + '</b></div>' + (storageRows || '<p class="dialog-note">Magazyn jest pusty.</p>') +
        '<button type="button" data-storage-expand="' + storage.id + '"' + (paused ? ' disabled' : '') + '>＋ DOSTAW MODUŁ +' + STORAGE_MODULE_CAPACITY + ' PÓL · ' + STORAGE_MODULE_COST.wood + ' DREWNA / ' + STORAGE_MODULE_COST.stone + ' KAMIENIA</button></div>'
      : '';
    const worksiteStatus = worksite?.waitingReason ? ' · ' + worksite.waitingReason : worksite?.productionType ? ' · POSTĘP ' + Math.floor(((worksite.productionProgress ?? 0) / PRODUCTION_RECIPES[worksite.productionType].cycleSeconds) * 100) + '%' : '';
    const variants: Partial<Record<ProductionType, ResourceId[]>> = {
      bowyer: ["bow", "crossbow"], poleturner: ["spear", "pike"], blacksmith: ["mace", "sword"]
    };
    const availableVariants = worksite?.productionType ? variants[worksite.productionType] : undefined;
    const variantNames: Partial<Record<ResourceId, string>> = { bow: "Łuk", crossbow: "Kusza", spear: "Włócznia", pike: "Pika", mace: "Buzdygan", sword: "Miecz" };
    const variantMarkup = availableVariants
      ? '<div class="selection-meta">PRODUKOWANE UZBROJENIE</div><div class="variant-controls">' + availableVariants.map((variant) =>
        '<button type="button" data-production-variant="' + variant + '" data-worksite-id="' + worksite!.id + '" class="' + ((worksite!.outputVariant ?? PRODUCTION_RECIPES[worksite!.productionType!].output.resource) === variant ? 'active' : '') + '"' + (paused ? ' disabled' : '') + '>' + variantNames[variant] + '</button>'
      ).join("") + '</div>'
      : '';
    const worksiteMarkup = worksite
      ? '<div class="worksite-controls"><div class="selection-meta">PRACOWNICY <b>' + worksite.workerIds.length + '/' + worksite.requiredWorkers +
        ' · ' + (worksite.enabled === false ? 'WSTRZYMANO' : 'AKTYWNY') + worksiteStatus + '</b></div>' + variantMarkup + '<button type="button" data-worksite-toggle="' + worksite.id + '"' +
        (paused ? ' disabled' : '') + '>' + (worksite.enabled === false ? '▶ WZNÓW PRACĘ' : 'Ⅱ WSTRZYMAJ PRACĘ') + '</button></div>'
      : '';
    const marketResources: ResourceId[] = ["wood", "stone", "iron", "pitch", "wheat", "flour", "hops", "beer", "apples", "cheese", "meat", "bread", "bow", "crossbow", "spear", "pike", "mace", "sword", "leatherArmor", "plateArmor"];
    const marketMarkup = entity.id.startsWith("market-")
      ? '<div class="market-panel"><div class="selection-meta">HANDEL RĘCZNY · CENA ZAKUPU / SPRZEDAŻY</div>' +
        marketResources.filter((resource) => RESOURCE_DEFINITIONS[resource].buyPrice > 0).map((resource) => {
          const info = RESOURCE_DEFINITIONS[resource];
          const owned = totalResource(simulation, resource);
          return '<div class="market-row"><span>' + info.name + '<small>Masz: ' + owned + ' · ' + info.buyPrice + '/' + info.sellPrice + ' zł</small></span><div>' +
            '<button type="button" data-market-direction="buy" data-market-resource="' + resource + '" data-market-quantity="1"' + (paused ? ' disabled' : '') + '>+1</button>' +
            '<button type="button" data-market-direction="buy" data-market-resource="' + resource + '" data-market-quantity="5"' + (paused ? ' disabled' : '') + '>+5</button>' +
            '<button type="button" data-market-direction="sell" data-market-resource="' + resource + '" data-market-quantity="1"' + (paused ? ' disabled' : '') + '>−1</button>' +
            '<button type="button" data-market-direction="sell" data-market-resource="' + resource + '" data-market-quantity="5"' + (paused ? ' disabled' : '') + '>−5</button></div></div>';
        }).join("") + '</div>'
      : '';
    const barracksMarkup = entity.id === "barracks"
      ? '<div class="worksite-controls"><div class="selection-meta">REKRUTACJA · ZBROJOWNIA I OGNISKO</div>' +
        (Object.keys(RECRUITMENT_RECIPES) as RecruitableUnitClass[]).map((unitClass) => {
          const recipe = RECRUITMENT_RECIPES[unitClass];
          const stock = totalResource(simulation, recipe.weapon);
          const enabled = canRecruitUnit(unitClass, simulation.unemployed, stock, gameOutcome) &&
            simulation.villagers.some((villager) => villager.status === "idle") && !paused;
          return '<div class="dialog-row"><span>' + recipe.label + '<small>' + RESOURCE_DEFINITIONS[recipe.weapon].name + ': ' + stock + '</small></span>' +
            '<button type="button" data-recruit-unit="' + unitClass + '"' + (enabled ? '' : ' disabled') + '>ZWERBUJ · 1</button></div>';
        }).join("") +
        '<p class="dialog-note">Rekrutacja zużywa jednego bezrobotnego i jedną sztukę właściwej broni z fizycznej Zbrojowni. Nie pobiera złota — ceny rekrutacji nie zostały określone w konfiguracji.</p></div>'
      : '';
    const gateMarkup = entity.fortificationKind === "gate-small" || entity.fortificationKind === "gate-large"
      ? '<div class="worksite-controls"><div class="selection-meta">BRAMA · KONTROLA PRZEJŚCIA</div><button type="button" data-gate-toggle="' + entity.id + '"' + (paused ? ' disabled' : '') + '>' +
        (entity.gateOpen ? 'ZAMKNIJ BRAMĘ' : 'OTWÓRZ BRAMĘ') + '</button><p class="dialog-note">' +
        (entity.gateOpen ? 'Brama jest otwarta i przepuszcza ruch.' : 'Brama jest zamknięta i blokuje ruch.') + '</p></div>'
      : '';

    contextContent.innerHTML =
      '<div class="selection-panel single-selection"><div class="selection-topline"><span>' +
      (entity.team === "enemy" ? "WROGI OBIEKT" : entity.kind === "unit" ? "ODDZIAŁ BOJOWY" : "BUDOWLA") +
      '</span><strong>' + entity.role + '</strong></div><h2>' + entity.name + '</h2><p>' +
      entity.description + '</p><div class="selection-health"><span style="width:' + health +
      '%;background:' + (entity.team === "enemy" ? "#a63832" : "#c9a45c") +
      '"></span></div><div class="selection-meta">WYTRZYMAŁOŚĆ <b>' + Math.ceil(health) + '%</b></div>' +
      (entity.kind === "unit" ? '<div class="selection-meta">LICZEBNOŚĆ <b>' + (entity.count ?? 1) + '</b></div>' : '') +
      storageMarkup + worksiteMarkup + marketMarkup + barracksMarkup + gateMarkup +
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
  contextContent.querySelectorAll<HTMLButtonElement>("[data-worksite-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleWorksite(button.dataset.worksiteToggle ?? ""));
  });
  contextContent.querySelectorAll<HTMLButtonElement>("[data-storage-expand]").forEach((button) => {
    button.addEventListener("click", () => expandSelectedStorage(button.dataset.storageExpand ?? ""));
  });
  contextContent.querySelectorAll<HTMLButtonElement>("[data-production-variant]").forEach((button) => {
    button.addEventListener("click", () => {
      if (paused) { setStatus("Gra jest wstrzymana — zmiana produkcji jest niedostępna."); return; }
      const site = simulation.worksites.find((candidate) => candidate.id === button.dataset.worksiteId);
      const variant = button.dataset.productionVariant as ResourceId | undefined;
      if (!site || !variant || !["bow", "crossbow", "spear", "pike", "mace", "sword"].includes(variant)) return;
      if (site.pendingOutput || site.pendingOutputs?.length || simulation.villagers.some((villager) => villager.worksiteId === site.id && villager.cargo?.length)) {
        setStatus("Zakończ bieżącą dostawę przed zmianą rodzaju produkowanej broni."); return;
      }
      site.outputVariant = variant;
      renderSelectionPanel();
      setStatus("Zmieniono produkowany towar na: " + (variantNamesForMain[variant] ?? variant) + ".");
    });
  });
  contextContent.querySelectorAll<HTMLButtonElement>("[data-market-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      if (paused) { setStatus("Gra jest wstrzymana — handel jest niedostępny."); return; }
      const resource = button.dataset.marketResource as ResourceId | undefined;
      const direction = button.dataset.marketDirection;
      const quantity = Number(button.dataset.marketQuantity);
      if (!resource || (direction !== "buy" && direction !== "sell")) return;
      const result = tradeAtMarket(simulation.logistics, simulation.gold, resource, quantity, direction);
      simulation.gold = result.gold;
      syncResourceCounters(simulation);
      setResources();
      renderSelectionPanel();
      setStatus(result.message);
    });
  });
  contextContent.querySelectorAll<HTMLButtonElement>("[data-gate-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      if (paused) return;
      const gate = entities.find((candidate) => candidate.id === button.dataset.gateToggle);
      if (!gate || !gate.fortificationKind) return;
      if (setFortificationGate(world.grid, gate, gate.gateOpen !== true)) {
        renderMinimap();
        updateSelection();
        setStatus(gate.gateOpen ? "Brama otwarta — jednostki mogą przejść." : "Brama zamknięta — przejście zablokowane.");
      }
    });
  });
  contextContent.querySelectorAll<HTMLButtonElement>("[data-recruit-unit]").forEach((button) => {
    button.addEventListener("click", () => {
      const unitClass = button.dataset.recruitUnit as RecruitableUnitClass | undefined;
      if (unitClass && Object.hasOwn(RECRUITMENT_RECIPES, unitClass)) recruitAtBarracks(unitClass);
