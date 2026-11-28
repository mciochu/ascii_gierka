import { Application, Container } from "pixi.js";
import "./style.css";
import {
  DEFAULT_EFFULGENCE_SETTINGS,
  EFFULGENCE_SETTINGS_KEY,
  normalizeEffulgenceSettings,
  type EffulgenceSettings
} from "./engine/effulgence";
import { addGlyph, type GlyphDisplay } from "./engine/glyph";
import { createEffulgenceRenderGraph } from "./engine/render-graph";
import {
  createWatchtower, createTownBuilding, createStorageBuilding, createProductionBuilding, createWorld, WORLD_SIZE,
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
  TAX_RULES
} from "./engine/simulation";
import { BUILD_CATEGORIES, findBuildCategory, findBuildItem } from "./ui/catalog";
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
    popularity.style.color = simulation.popularity >= 50 ? "#68cc83" : "#f06c65";
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
        material: "unit", height: 0.24, entityId: villager.id
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
    const health = Math.max(0, Math.min(100, entity.health));
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

    contextContent.innerHTML =
      '<div class="selection-panel single-selection"><div class="selection-topline"><span>' +
      (entity.team === "enemy" ? "WROGI OBIEKT" : entity.kind === "unit" ? "ODDZIAŁ BOJOWY" : "BUDOWLA") +
      '</span><strong>' + entity.role + '</strong></div><h2>' + entity.name + '</h2><p>' +
      entity.description + '</p><div class="selection-health"><span style="width:' + health +
      '%;background:' + (entity.team === "enemy" ? "#e45b52" : "#78b8dd") +
      '"></span></div><div class="selection-meta">WYTRZYMAŁOŚĆ <b>' + Math.ceil(health) + '%</b></div>' +
      (entity.kind === "unit" ? '<div class="selection-meta">LICZEBNOŚĆ <b>' + (entity.count ?? 1) + '</b></div>' : '') +
      storageMarkup + worksiteMarkup + marketMarkup +
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

function expandSelectedStorage(storageId: string): void {
  if (paused) { setStatus("Gra jest wstrzymana — rozbudowa magazynu jest niedostępna."); return; }
  const storage = simulation.logistics.storages.find((candidate) => candidate.id === storageId);
  const storageEntity = entities.find((entity) => entity.id === storageId);
  if (!storage || !storageEntity) return;
  if (totalResource(simulation, "wood") < STORAGE_MODULE_COST.wood || totalResource(simulation, "stone") < STORAGE_MODULE_COST.stone) {
    setStatus("Rozbudowa wymaga " + STORAGE_MODULE_COST.wood + " drewna i " + STORAGE_MODULE_COST.stone + " kamienia w Składzie.");
    return;
  }
  const parentTile = worldToCell(world.grid, storage);
  if (!parentTile) { setStatus("Nie można rozbudować magazynu poza siatką mapy."); return; }
  const attachedModules = [...placedStructures.entries()]
    .filter(([, record]) => record.storageModuleId === storageId)
    .map(([id]) => entities.find((entity) => entity.id === id))
    .filter((entity): entity is GameEntity => !!entity);
  const anchors = [storageEntity, ...attachedModules];
  const candidatePoints: { x: number; y: number; distance: number }[] = [];
  for (const anchorEntity of anchors) {
    const anchorTile = worldToCell(world.grid, anchorEntity);
    if (!anchorTile) continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const col = anchorTile.col + dc;
      const row = anchorTile.row + dr;
      if (col < 0 || row < 0 || col >= world.grid.columns || row >= world.grid.rows) continue;
      const tile = world.grid.tiles[row * world.grid.columns + col];
      if (!tile || !tile.walkable || !tile.buildable) continue;
      const point = worldPositionForCell(world.grid, tile.col, tile.row);
      if (!point) continue;
      if (entities.some((entity) => Math.hypot(entity.x - point.x, entity.y - point.y) < 8)) continue;
      candidatePoints.push({ ...point, distance: Math.hypot(point.x - anchorEntity.x, point.y - anchorEntity.y) });
    }
  }
  candidatePoints.sort((a, b) => a.distance - b.distance);
  const point = candidatePoints[0] ? { x: candidatePoints[0].x, y: candidatePoints[0].y } : undefined;
  if (!point) { setStatus("Brak wolnego pola bezpośrednio obok magazynu. Oczyść teren przed rozbudową."); return; }
  if (totalResource(simulation, "wood") < STORAGE_MODULE_COST.wood || totalResource(simulation, "stone") < STORAGE_MODULE_COST.stone) {
    setStatus("Rozbudowa wymaga obu surowców w Składzie.");
    return;
  }
  spendStoredResource(simulation, "wood", STORAGE_MODULE_COST.wood);
  spendStoredResource(simulation, "stone", STORAGE_MODULE_COST.stone);
  stage4BuildingCounter += 1;
  const module = createStorageBuilding(world.layers.structures, storage.type, stage4BuildingCounter, point.x, point.y, true);
  expandStorage(storage, STORAGE_MODULE_CAPACITY);
  entities.push(module);
  placedStructures.set(module.id, { wood: STORAGE_MODULE_COST.wood, stone: STORAGE_MODULE_COST.stone, gold: 0, storageModuleId: storage.id, storageModuleSlots: STORAGE_MODULE_CAPACITY });
  undoStack.push(module.id);
  setResources();
  renderMinimap();
  updateSelection();
  setStatus("Dostawiono moduł magazynu. Pojemność " + storage.capacitySlots + " pól.");
}

function toggleWorksite(worksiteId: string): void {
  if (paused) { setStatus("Gra jest wstrzymana — nie można zmieniać pracy budynku."); return; }
  const site = simulation.worksites.find((candidate) => candidate.id === worksiteId);
  if (!site) return;
  const linkedOx = site.productionType === "quarry"
    ? simulation.worksites.find((candidate) => candidate.oxTetherFor === site.id)
    : undefined;
  const hasCargo = simulation.villagers.some((villager) =>
    (villager.worksiteId === worksiteId || villager.worksiteId === linkedOx?.id || villager.returnWorksiteId === worksiteId) && !!villager.cargo?.length
  );
  if (site.enabled !== false && hasCargo) { setStatus("Pracownik niesie towar — poczekaj na zakończenie dostawy."); return; }
  const resume = site.enabled === false;
  if (!setWorksiteEnabled(simulation, worksiteId, resume)) return;
  if (linkedOx) setWorksiteEnabled(simulation, linkedOx.id, resume);
  if (site.oxTetherFor) {
    const quarry = simulation.worksites.find((candidate) => candidate.id === site.oxTetherFor);
    if (quarry) setWorksiteEnabled(simulation, quarry.id, resume);
  }
  updateVillagerVisuals(0);
  updateSelection();
  setStatus(resume
    ? "Wznowiono pracę budynku. Wolni chłopi zostaną przydzieleni automatycznie."
    : "Wstrzymano pracę budynku. Pracownicy wracają do ogniska.");
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
      const camera = {
        position: { x: worldRoot.position.x, y: worldRoot.position.y },
        pivot: MAP_PIVOT,
        zoom,
        quarterTurns: mapRotation
      };
      const viewportSize = { width: viewport.clientWidth, height: viewport.clientHeight };
      const sameType = entities.filter((candidate) =>
        candidate.kind === "unit" &&
        candidate.team === "player" &&
        candidate.unitClass === entity.unitClass &&
        isWorldPointInViewport(candidate, camera, viewportSize)
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


const STAGE4_STORAGE_TYPES: Record<string, StorageType> = { stockpile: "stockpile", granary: "granary", armory: "armory" };
const STAGE4_PRODUCTION_TYPES = Object.keys(PRODUCTION_RECIPES) as ProductionType[];
const STAGE4_BUILDING_IDS = ["stockpile", "granary", "armory", "market", "ox-tether", ...STAGE4_PRODUCTION_TYPES];

function findProductionSource(type: ProductionType, point: { x: number; y: number }): { x: number; y: number } | null {
  const recipe = PRODUCTION_RECIPES[type];
  if (recipe.source === "none") return point;
  if (recipe.source === "deer") {
    const nearest = [...HUNTING_NODES].sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
    return nearest && Math.hypot(nearest.x - point.x, nearest.y - point.y) <= recipe.sourceRange ? nearest : null;
  }
  if (recipe.source === "forest") {
    const nearest = world.grid.tiles.filter((tile) => tile.terrain === "forest" && tile.walkable)
      .map((tile) => worldPositionForCell(world.grid, tile.col, tile.row))
      .filter((candidate): candidate is { x: number; y: number } => !!candidate)
      .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
    return nearest && Math.hypot(nearest.x - point.x, nearest.y - point.y) <= recipe.sourceRange ? nearest : null;
  }
  const tile = worldToCell(world.grid, point);
  if (!tile || tile.terrain !== recipe.source) return null;
  return worldPositionForCell(world.grid, tile.col, tile.row);
}

function stage4PlacementPoint(itemId: string, x: number, y: number): { point: { x: number; y: number }; source?: { x: number; y: number } } | null {
  if (x < 40 || y < 40 || x > WORLD_SIZE.width - 40 || y > WORLD_SIZE.height - 40) return null;
  const tile = worldToCell(world.grid, { x, y });
  const point = tile ? worldPositionForCell(world.grid, tile.col, tile.row) : null;
  if (!tile || !point || !tile.walkable) return null;
  const storageType = STAGE4_STORAGE_TYPES[itemId];
  if (storageType || itemId === "market" || itemId === "ox-tether") {
    if (!tile.buildable) return null;
  } else {
    const productionType = itemId as ProductionType;
    if (!(productionType in PRODUCTION_RECIPES)) return null;
    const source = findProductionSource(productionType, point);
    if (!source) return null;
    const sourceKind = PRODUCTION_RECIPES[productionType].source;
    if (["stone", "iron", "tar"].includes(sourceKind) && tile.terrain !== sourceKind) return null;
    if (sourceKind === "oasis" && tile.terrain !== "oasis") return null;
    if (!["stone", "iron", "tar"].includes(sourceKind) && !tile.buildable) return null;
    if (entities.some((entity) => Math.hypot(entity.x - point.x, entity.y - point.y) < (entity.kind === "building" ? 90 : 48))) return null;
    return { point, source };
  }
  if (itemId === "ox-tether" && !simulation.worksites.some((site) => site.productionType === "quarry" && Math.hypot(site.x - point.x, site.y - point.y) <= 150)) return null;
  if (entities.some((entity) => Math.hypot(entity.x - point.x, entity.y - point.y) < (entity.kind === "building" ? 100 : 48))) return null;
  return { point };
}

function placeStage4Building(itemId: string, x: number, y: number): void {
  if (paused) { setStatus("Gra jest wstrzymana — budowanie jest niedostępne."); return; }
  const cost = STAGE4_BUILD_COSTS[itemId];
  const placement = stage4PlacementPoint(itemId, x, y);
  if (!cost || !placement) {
    setStatus("Nieprawidłowe miejsce. Sprawdź wymagany teren, złoże, oazę lub wolne miejsce obok innych budynków.");
    return;
  }
  if (totalResource(simulation, "wood") < cost.wood || totalResource(simulation, "stone") < cost.stone || simulation.gold < cost.gold) {
    setStatus("Brakuje surowców w Składzie lub złota w skarbcu.");
    return;
  }
  if (cost.wood && !spendStoredResource(simulation, "wood", cost.wood)) return;
  if (cost.stone && !spendStoredResource(simulation, "stone", cost.stone)) {
    if (cost.wood) depositStoredResource(simulation, "stockpile", "wood", cost.wood);
    setResources();
    return;
  }
  simulation.gold -= cost.gold;
  stage4BuildingCounter += 1;
  let building: GameEntity;
  const storageType = STAGE4_STORAGE_TYPES[itemId];
  const record: PlacedStructureCost = { wood: cost.wood, stone: cost.stone, gold: cost.gold };
  if (storageType) {
    building = createStorageBuilding(world.layers.structures, storageType, stage4BuildingCounter, placement.point.x, placement.point.y);
    if (!addStorageBuilding(simulation, {
      id: building.id, type: storageType, x: building.x, y: building.y,
      capacitySlots: DEFAULT_STORAGE_CAPACITY, moduleCount: 0, inventory: {}
    })) {
      building.group.destroy({ children: true });
      setStatus("Nie udało się utworzyć magazynu o tym identyfikatorze.");
      return;
    }
    record.storageId = building.id;
    entities.push(building);
  } else {
    building = createProductionBuilding(world.layers.structures, itemId as LogisticsBuildingType, stage4BuildingCounter, placement.point.x, placement.point.y);
    entities.push(building);
    if (itemId === "ox-tether") {
      const quarry = simulation.worksites
        .filter((site) => site.productionType === "quarry")
        .sort((a, b) => Math.hypot(a.x - building.x, a.y - building.y) - Math.hypot(b.x - building.x, b.y - building.y))[0];
      if (!quarry) { entities.pop(); building.group.destroy({ children: true }); setStatus("Najpierw postaw kamieniołom."); return; }
      addWorksite(simulation, { id: building.id, kind: "production", requiredWorkers: 1, workerIds: [], x: building.x, y: building.y, oxTetherFor: quarry.id });
      record.worksiteId = building.id;
    } else if (itemId !== "market") {
      const productionType = itemId as ProductionType;
      const recipe = PRODUCTION_RECIPES[productionType];
      addWorksite(simulation, {
        id: building.id, kind: "production", requiredWorkers: recipe.workers, workerIds: [],
        enabled: true, x: building.x, y: building.y, productionType,
        productionProgress: 0, inputBuffer: {}, sourceX: placement.source?.x, sourceY: placement.source?.y
      });
      record.worksiteId = building.id;
    }
  }
  placedStructures.set(building.id, record);
  undoStack.push(building.id);
  syncResourceCounters(simulation);
  updateVillagerVisuals(0);
  setResources();
  replaceSelection([building]);
  setMode("select");
  renderMinimap();
  const note = storageType
    ? "Utworzono fizyczny magazyn. Pojemność początkowa: " + DEFAULT_STORAGE_CAPACITY + " pól."
    : itemId === "market" ? "Targowisko jest gotowe do ręcznego handlu." : "Załoga została przydzielona. Produkcja czeka na surowce i wolne miejsce w magazynie.";
  setStatus(building.name + " wzniesiono. " + note);
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

  if (totalResource(simulation, "wood") < 70 || totalResource(simulation, "stone") < 30) {
    setStatus("Surowce muszą znajdować się fizycznie w Składzie.");
    return;
  }
  spendStoredResource(simulation, "wood", 70);
  spendStoredResource(simulation, "stone", 30);
  towerCounter += 1;
  const tower = createWatchtower(world.layers.structures, buildPoint.x, buildPoint.y, towerCounter);
  entities.push(tower);
  placedStructures.set(tower.id, { wood: 70, stone: 30, gold: 0 });
  undoStack.push(tower.id);
  setResources();
  replaceSelection([tower]);
  setMode("select");
  setStatus("Wieża strażnicza wzniesiona.");
}

function placeTownBuilding(itemId: string, x: number, y: number): void {
  if (paused) { setStatus("Gra jest wstrzymana — budowanie jest niedostępne."); return; }
  const types: Record<string, TownBuildingType> = {
    hovel: "hovel", chapel: "chapel", church: "church", cathedral: "cathedral", inn: "inn",
    "good-things": "good", "bad-things": "bad"
  };
  const type = types[itemId];
  if (!type) { setStatus("Ta budowla nie jest jeszcze dostępna."); return; }
  const cost = TOWN_BUILD_COSTS[type];
  if (simulation.wood < cost.wood || simulation.gold < cost.gold) {
    setStatus("Brakuje surowców: " + (cost.wood ? cost.wood + " drewna " : "") + (cost.gold ? cost.gold + " złota" : "") + ".");
    return;
  }
  if (x < 40 || y < 40 || x > WORLD_SIZE.width - 40 || y > WORLD_SIZE.height - 40) {
    setStatus("Nie można budować poza granicami mapy.");
    return;
  }
  const tile = worldToCell(world.grid, { x, y });
  const point = tile ? worldPositionForCell(world.grid, tile.col, tile.row) : null;
  if (!point || !isBuildableAtWorld(world.grid, point)) {
    setStatus("Teren jest niedostępny pod budowę. Wybierz wolny piasek lub inne dozwolone pole.");
    return;
  }
  const clearance = type === "good" || type === "bad" ? 54 : 86;
  if (entities.some((entity) => Math.hypot(entity.x - point.x, entity.y - point.y) < (entity.kind === "building" ? clearance : 48))) {
    setStatus("To miejsce jest zajęte. Wybierz wolne pole.");
    return;
  }

  townBuildingCounter += 1;
  const building = createTownBuilding(world.layers.structures, type, townBuildingCounter, point.x, point.y);
  entities.push(building);
  if (cost.wood && !spendStoredResource(simulation, "wood", cost.wood)) {
    building.group.destroy({ children: true });
    entities.splice(entities.indexOf(building), 1);
    setStatus("Drewno musi znajdować się fizycznie w Składzie.");
    return;
  }
  simulation.gold -= cost.gold;

  const record: PlacedStructureCost = { wood: cost.wood, stone: 0, gold: cost.gold };
  if (type === "hovel") {
    record.housing = 8;
    setHovelCapacity(simulation, 1);
  } else if (type === "chapel" || type === "church" || type === "cathedral") {
    record.worksiteId = building.id;
    addWorksite(simulation, {
      id: building.id, kind: "religion", requiredWorkers: 1, workerIds: [],
      x: building.x, y: building.y, buildingType: type
    });
  } else if (type === "inn") {
    record.worksiteId = building.id;
    addWorksite(simulation, { id: building.id, kind: "inn", requiredWorkers: 1, workerIds: [], x: building.x, y: building.y });
  } else {
    record.fearObjectId = building.id;
    simulation.fearObjects.push({ id: building.id, kind: type, x: building.x, y: building.y });
    simulation.fear = calculateFearFactor(simulation.fearObjects, simulation.population);
  }
  placedStructures.set(building.id, record);
  undoStack.push(building.id);
  syncPopulationCounters(simulation);
  updateVillagerVisuals(0);
  setResources();
  replaceSelection([building]);
  setMode("select");
  renderMinimap();
  const placementNote = type === "hovel"
    ? "Pojemność mieszkalna +8."
    : type === "good" || type === "bad"
      ? "Współczynnik strachu: " + simulation.fear + "."
      : type === "inn"
        ? "Karczmarz obsadza gospodę. Dostawy piwa ze Składu zostaną uruchomione w etapie 4."
        : "Miejsce pracy dla kapłana utworzone.";
  setStatus(building.name + " wzniesiono. " + placementNote);
}

function removePlacedStructure(entity: GameEntity, refundRatio: number): boolean {
  const cost = placedStructures.get(entity.id);
  if (!cost) return false;
  const index = entities.findIndex((candidate) => candidate.id === entity.id);
  if (index < 0) return false;
  const storage = cost.storageId
    ? simulation.logistics.storages.find((candidate) => candidate.id === cost.storageId)
    : undefined;
  if (storage && (Object.values(storage.inventory).some((amount) => (amount ?? 0) > 0) ||
      simulation.villagers.some((villager) => villager.targetStorageId === storage.id && !!villager.cargo?.length))) {
    setStatus("Nie można zburzyć magazynu, który zawiera towary lub jest celem aktywnej dostawy.");
    return false;
  }
  if (cost.storageModuleId) {
    const parentStorage = simulation.logistics.storages.find((candidate) => candidate.id === cost.storageModuleId);
    const slots = cost.storageModuleSlots ?? STORAGE_MODULE_CAPACITY;
    if (!parentStorage || storageUsedSlots(parentStorage) > parentStorage.capacitySlots - slots) {
      setStatus("Nie można zdjąć modułu: towary zajmują jeszcze jego pola. Najpierw opróżnij magazyn.");
      return false;
    }
  }
  const worksite = cost.worksiteId ? simulation.worksites.find((site) => site.id === cost.worksiteId) : undefined;
  if (worksite && (worksite.pendingOutput || worksite.pendingOutputs?.length || simulation.villagers.some((villager) =>
    (villager.worksiteId === worksite.id || villager.returnWorksiteId === worksite.id) && !!villager.cargo?.length
  ))) {
    setStatus("Pracownik lub budynek ma niedostarczony towar. Poczekaj na zakończenie transportu.");
    return false;
  }
  if (worksite?.productionType === "quarry" && simulation.worksites.some((site) => site.oxTetherFor === worksite.id)) {
    setStatus("Najpierw usuń przypisane uwiązy wołów.");
    return false;
  }
  const refundWood = Math.floor(cost.wood * refundRatio);
  const refundStone = Math.floor(cost.stone * refundRatio);
  const refundTargets: { resource: ResourceId; amount: number; storageId: string }[] = [];
  for (const [resource, amount] of [["wood", refundWood], ["stone", refundStone]] as [ResourceId, number][]) {
    if (amount <= 0) continue;
    const destination = simulation.logistics.storages.find((candidate) =>
      candidate.type === RESOURCE_DEFINITIONS[resource].storage && candidate.id !== cost.storageId && canStoreResource(candidate, resource, amount)
    );
    if (!destination) {
      setStatus("Brak wolnego miejsca w magazynie na zwrot kosztów. Opróżnij lub rozbuduj magazyn.");
      return false;
    }
    refundTargets.push({ resource, amount, storageId: destination.id });
  }
  for (const refund of refundTargets) depositStoredResource(simulation, refund.storageId, refund.resource, refund.amount);
  entities.splice(index, 1);
  selectedIds.delete(entity.id);
  entity.group.destroy({ children: true });
  simulation.gold += Math.floor(cost.gold * refundRatio);
  if (cost.housing) setHovelCapacity(simulation, -1);
  if (cost.worksiteId) removeWorksite(simulation, cost.worksiteId);
  if (cost.storageId) removeStorage(simulation.logistics, cost.storageId);
  if (cost.storageModuleId) {
    const parentStorage = simulation.logistics.storages.find((candidate) => candidate.id === cost.storageModuleId);
    if (parentStorage) {
      parentStorage.capacitySlots -= cost.storageModuleSlots ?? STORAGE_MODULE_CAPACITY;
      parentStorage.moduleCount = Math.max(0, parentStorage.moduleCount - 1);
    }
  }
  if (cost.fearObjectId) {
    simulation.fearObjects = simulation.fearObjects.filter((object) => object.id !== cost.fearObjectId);
    simulation.fear = calculateFearFactor(simulation.fearObjects, simulation.population);
  }
  placedStructures.delete(entity.id);
  const stackIndex = undoStack.lastIndexOf(entity.id);
  if (stackIndex >= 0) undoStack.splice(stackIndex, 1);
  syncPopulationCounters(simulation);
  syncResourceCounters(simulation);
  updateVillagerVisuals(0);
  setResources();
  updateSelection();
  renderMinimap();
  return true;
}

function undoLastBuild(): void {
  if (paused) { setStatus("Gra jest wstrzymana — cofanie budowy jest niedostępne."); return; }
  const id = undoStack[undoStack.length - 1];
  if (!id) { setStatus("Nie ma budowy do cofnięcia."); return; }
  const entity = entities.find((candidate) => candidate.id === id);
  if (!entity) {
    undoStack.pop();
    setStatus("Ostatnia budowla nie istnieje — nie można jej cofnąć.");
    return;
  }
  if (!removePlacedStructure(entity, 1)) return;
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
    if (selectedBuildItemId === "watchtower") placeWatchtower(point.x, point.y);
    else if (STAGE4_BUILDING_IDS.includes(selectedBuildItemId ?? "")) placeStage4Building(selectedBuildItemId ?? "", point.x, point.y);
    else placeTownBuilding(selectedBuildItemId ?? "", point.x, point.y);
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
  updateBuildPreview(event.clientX, event.clientY);
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
canvas.addEventListener("pointerleave", () => {
  if (!pointerSession) buildPreviewLayer.visible = false;
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
function cancelPointer(event: PointerEvent): void {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  const session = pointerSession;
  pointerSession = null;
  hideSelectionRectangle();
  gestureMenu.hidden = true;
  if (session.kind === "pan") {
    canvas.style.cursor = mode === "select" ? "default" : mode === "attack-move" ? "crosshair" : mode === "build" ? "copy" : "not-allowed";
  }
}
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", cancelPointer);
canvas.addEventListener("lostpointercapture", cancelPointer);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function preserveCameraCenter(nextCenter: { x: number; y: number }): void {
  const worldAtCenter = viewportToWorld(lastViewportCenter, {
    position: { x: worldRoot.position.x, y: worldRoot.position.y },
    pivot: MAP_PIVOT,
    zoom,
    quarterTurns: mapRotation
  });
  const offset = worldToViewport(worldAtCenter, {
    position: { x: 0, y: 0 },
    pivot: MAP_PIVOT,
    zoom,
    quarterTurns: mapRotation
  });
  worldRoot.position.set(nextCenter.x - offset.x, nextCenter.y - offset.y);
  lastViewportCenter = nextCenter;
}

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

function updateCompass(): void {
  const arrow = document.querySelector<HTMLElement>(".map-compass b");
  if (arrow) arrow.style.transform = "rotate(" + (mapRotation * 90) + "deg)";
}

function centerCamera(): void {
  zoom = 0.62;
  updateCompass();
  worldRoot.pivot.set(MAP_PIVOT.x, MAP_PIVOT.y);
  worldRoot.rotation = mapRotation * Math.PI / 2;
  worldRoot.scale.set(zoom);
  lastViewportCenter = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
  worldRoot.position.set(lastViewportCenter.x, lastViewportCenter.y);
  zoomLabel.textContent = String(Math.round(zoom * 100)) + "%";
}

function rotateMap(direction: 1 | -1): void {
  mapRotation = (mapRotation + direction + 4) % 4;
  worldRoot.rotation = mapRotation * Math.PI / 2;
  updateCompass();
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
  preserveCameraCenter({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
  renderMinimap();
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
  const modifiers = getPopularityModifiers(simulation);
  const ration = simulation.food <= 0 ? 0 : simulation.ration;
  const monthlyFoodPerVillager: Record<number, number> = { 0: 0, 0.5: 0.1, 1: 0.2, 1.5: 0.32, 2: 0.4 };
  const requestedFood = simulation.population * monthlyFoodPerVillager[ration];
  const foodConsumed = Math.min(simulation.food, requestedFood);
  const foodShortage = requestedFood > simulation.food + 0.0001;
  const taxRule = TAX_RULES[simulation.tax];
  const bribe = simulation.tax.startsWith("bribe-");
  const bribeCost = bribe && simulation.bribeCostPerVillager !== null
    ? simulation.population * simulation.bribeCostPerVillager : 0;
  const bribePaid = bribe && simulation.bribeCostPerVillager !== null && simulation.gold >= bribeCost;
  const goldDelta = bribe ? (bribePaid ? -bribeCost : 0) : simulation.population * taxRule.goldPerVillager;
  const projected = Math.max(0, Math.min(100, simulation.popularity + modifiers.total));
  const army = entities.filter((entity) => entity.kind === "unit" && entity.team === "player");
  const armyByType = new Map<string, number>();
  for (const unit of army) {
    const type = unit.unitClass ?? unit.role;
    armyByType.set(type, (armyByType.get(type) ?? 0) + (unit.count ?? 1));
  }
  const armyRows = [...armyByType.entries()].map(([type, count]) =>
    '<div class="dialog-row"><span>' + type + '</span><b>' + count + '</b></div>'
  ).join("") || '<p class="dialog-note">Brak jednostek w armii.</p>';
  const storageRows = simulation.logistics.storages.map((storage) => {
    const contents = (Object.entries(storage.inventory) as [ResourceId, number][])
      .filter(([, amount]) => amount > 0)
      .map(([resource, amount]) => RESOURCE_DEFINITIONS[resource].name + " " + amount.toLocaleString("pl-PL", { maximumFractionDigits: 2 }))
      .join(" · ") || "pusty";
    return '<div class="dialog-row"><span>' + storage.id + ' · ' + storage.type + '</span><b>' + storageUsedSlots(storage) + '/' + storage.capacitySlots + ' pól · ' + contents + '</b></div>';
  }).join("");
  const productionRows = simulation.worksites.filter((site) => site.productionType).map((site) => {
    const recipe = PRODUCTION_RECIPES[site.productionType!];
    const status = site.enabled === false ? "wstrzymano" : site.waitingReason ?? Math.floor(((site.productionProgress ?? 0) / recipe.cycleSeconds) * 100) + "% cyklu";
    return '<div class="dialog-row"><span>' + recipe.name + ' · ' + site.workerIds.length + '/' + recipe.workers + ' prac.</span><b>' + status + '</b></div>';
  }).join("") || '<p class="dialog-note">Brak uruchomionych łańcuchów produkcji.</p>';
  const formatModifier = (value: number): string => (value > 0 ? "+" : "") + value;
  const rows = [
    ["Racje żywnościowe", modifiers.ration],
    ["Różnorodność żywności", modifiers.variety],
    [bribe ? "Łapówki" : "Podatki", modifiers.tax],
    ["Piwo · obsługa przez gospody", modifiers.beer],
    ["Religia · bonus stały", modifiers.religionPassive],
    ["Błogosławieństwa kapłanów", modifiers.blessings],
    ["Współczynnik strachu", modifiers.fear]
  ].map(([label, value]) => '<div class="dialog-row"><span>' + label + '</span><b>' + formatModifier(Number(value)) + '</b></div>').join("");
  const employed = simulation.villagers.filter((villager) => villager.status === "working" || villager.status === "walking-to-work").length;
  const priests = simulation.villagers.filter((villager) => villager.role === "priest" && villager.status !== "leaving").length;
  const activeSites = simulation.worksites.filter((site) => site.workerIds.length >= site.requiredWorkers).length;
  const goodCount = simulation.fearObjects.filter((object) => object.kind === "good").length;
  const badCount = simulation.fearObjects.filter((object) => object.kind === "bad").length;
  const rationNames: Record<number, string> = { 0: "Brak", 0.5: "Połowa", 1: "Normalne", 1.5: "Dodatkowe", 2: "Podwójne" };
  openDialog("KSIĘGA RAPORTÓW", "BILANS POPULARNOŚCI · W NADCHODZĄCYM MIESIĄCU",
    '<div class="dialog-grid">' +
      '<div class="dialog-stat"><small>OBECNA POPULARNOŚĆ</small><b>' + simulation.popularity + '/100</b></div>' +
      '<div class="dialog-stat"><small>PROGNOZA PO NASTĘPNYM TICKU</small><b>' + projected + '/100</b></div>' +
      '<div class="dialog-stat"><small>MIESZKAŃCY / MIEJSCA</small><b>' + simulation.population + '/' + simulation.housing + '</b></div>' +
      '<div class="dialog-stat"><small>BEZROBOTNI PRZY OGNISKU</small><b>' + simulation.unemployed + '/24</b></div>' +
      '<div class="dialog-stat"><small>PRACUJĄCY / MIEJSCA PRACY</small><b>' + employed + ' / ' + simulation.worksites.reduce((sum, site) => sum + site.requiredWorkers, 0) + '</b></div>' +
      '<div class="dialog-stat"><small>KAPŁANI / BŁOGOSŁAWIEŃSTWA</small><b>' + priests + ' / ' + Math.round(simulation.blessedShare * 100) + '%</b></div>' +
      '<div class="dialog-stat"><small>ŻYWNOŚĆ · RACJE ' + (rationNames[ration] ?? "brak") + '</small><b>' + foodConsumed.toLocaleString("pl-PL") + (foodShortage ? ' · NIEDOBÓR' : '') + '</b></div>' +
      '<div class="dialog-stat"><small>ZŁOTO · BILANS Z PODATKÓW</small><b>' + (goldDelta > 0 ? '+' : '') + goldDelta.toLocaleString("pl-PL") + '</b></div>' +
    '</div><h3>Składniki popularności</h3>' + rows +
    '<h3>Praca i strach</h3>' +
    '<div class="dialog-row"><span>Obsadzone miejsca pracy</span><b>' + activeSites + '/' + simulation.worksites.length + '</b></div>' +
    '<div class="dialog-row"><span>Dobre rzeczy / złe rzeczy</span><b>' + goodCount + ' / ' + badCount + '</b></div>' +
    '<div class="dialog-row"><span>Poziom strachu</span><b>' + formatModifier(simulation.fear) + '/5</b></div>' +
    '<div class="dialog-row"><span>Wydajność pracy</span><b>' + Math.round(getFearWorkMultiplier(simulation.fear) * 100) + '%</b></div>' +
    '<div class="dialog-row"><span>Mnożnik obrażeń własnego wojska</span><b>' + Math.round(getFearDamageMultiplier(simulation.fear) * 100) + '%</b></div>' +
    '<h3>Magazyny i towary · fizyczne pola</h3>' + storageRows +
    '<h3>Produkcja i logistyka</h3>' + productionRows +
    '<h3>Stan armii · według typów</h3>' + armyRows +
    '<p class="dialog-note">Towary zajmują ograniczone pola magazynów. Pracownicy przewożą je pieszo; produkcja czeka, gdy brakuje wejścia lub wolnego pola w magazynie docelowym. Przyrost ludności zatrzymuje się przy popularności poniżej 50, braku miejsca albo 24 bezrobotnych przy ognisku. Żołnierze nie zajmują miejsc mieszkalnych i nie zużywają racji. Koszt łapówek pozostaje nieaktywny, dopóki nie zostanie skonfigurowany.</p>');
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

function applyEffulgenceSettings(next: unknown): void {
  effulgenceSettings = normalizeEffulgenceSettings(next);
  effulgence.setSettings(effulgenceSettings);
  try {
    localStorage.setItem(EFFULGENCE_SETTINGS_KEY, JSON.stringify(effulgenceSettings));
  } catch {
    setStatus("Ustawienia obrazu działają do końca tej sesji, ale przeglądarka nie pozwala ich zapisać.");
  }
}

function updateEffulgenceControl(control: HTMLElement): boolean {
  const next = { ...effulgenceSettings };
  if (control.matches("[data-effulgence-density]")) {
    next.density = (control as HTMLSelectElement).value as EffulgenceSettings["density"];
  } else if (control.matches("[data-effulgence-bloom]")) {
    next.bloomIntensity = Number((control as HTMLInputElement).value);
  } else if (control.matches("[data-effulgence-ambient]")) {
    next.terrainAmbient = Number((control as HTMLInputElement).value);
  } else if (control.matches("[data-effulgence-shimmer]")) {
    next.shimmerEnabled = (control as HTMLInputElement).checked;
  } else {
    return false;
  }

  applyEffulgenceSettings(next);
  const bloomOutput = dialogContent.querySelector<HTMLOutputElement>('[data-effulgence-value="bloom"]');
  const ambientOutput = dialogContent.querySelector<HTMLOutputElement>('[data-effulgence-value="ambient"]');
  if (bloomOutput) bloomOutput.value = `${effulgenceSettings.bloomIntensity}%`;
  if (ambientOutput) ambientOutput.value = `${effulgenceSettings.terrainAmbient}%`;
  return true;
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
    '<h3>Renderowanie Effulgence · GPU</h3><div class="effulgence-options">' +
    '<label class="dialog-stat"><small>GĘSTOŚĆ GLIFÓW</small><select data-effulgence-density>' +
    '<option value="small"' + (effulgenceSettings.density === "small" ? " selected" : "") + '>Małe · 6×9</option>' +
    '<option value="medium"' + (effulgenceSettings.density === "medium" ? " selected" : "") + '>Średnie · 8×12</option>' +
    '<option value="large"' + (effulgenceSettings.density === "large" ? " selected" : "") + '>Duże · 10×15</option></select></label>' +
    '<label class="dialog-stat"><small>BLOOM · <output data-effulgence-value="bloom">' + effulgenceSettings.bloomIntensity + '%</output></small><input type="range" min="0" max="150" step="5" value="' + effulgenceSettings.bloomIntensity + '" data-effulgence-bloom></label>' +
    '<label class="dialog-stat"><small>JASNOŚĆ TERENU · <output data-effulgence-value="ambient">' + effulgenceSettings.terrainAmbient + '%</output></small><input type="range" min="50" max="150" step="5" value="' + effulgenceSettings.terrainAmbient + '" data-effulgence-ambient></label>' +
    '<label class="dialog-stat effulgence-toggle"><small>MIGOTANIE GLIFÓW · 8 HZ</small><input type="checkbox" data-effulgence-shimmer' + (effulgenceSettings.shimmerEnabled ? ' checked' : '') + '> Włączone</label>' +
    '</div><p class="dialog-note">Rozmiar komórki pozostaje stały względem powiększenia mapy. Rampa 16 poziomów, dithering Bayera, krawędzie Sobela i tonowanie działają w filtrach GPU. Migotanie jest ograniczane do wykrytych kolorystycznie powierzchni wody, zieleni i ognia.</p>' +
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
  for (const villager of simulation.villagers) {
    if (villager.status === "leaving") continue;
    const tile = worldToCell(world.grid, villager);
    if (!tile) continue;
    const miniCol = Math.max(0, Math.min(size - 1, Math.floor(tile.col / 4)));
    const miniRow = Math.max(0, Math.min(size - 1, Math.floor(tile.row / 4)));
    const cell = cells[miniRow * size + miniCol];
    if (cell && !["player", "enemy", "friendly-building"].includes(cell.owner ?? "")) {
      cell.owner = "villager";
      cell.glyph = "♟";
    }
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
dialogContent.addEventListener("input", (event) => {
  updateEffulgenceControl(event.target as HTMLElement);
});
dialogContent.addEventListener("change", (event) => {
  const control = event.target as HTMLSelectElement | HTMLInputElement;
  if (updateEffulgenceControl(control)) return;
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
  updateSelection();
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
  updateCompass();
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
    syncResourceCounters(simulation);
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
      townBuildingCounter,
      stage4BuildingCounter,
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
  const defaultSimulation = createSimulation();
  const defaults = defaultSimulation as unknown as Record<string, unknown>;
  for (const field of [
    "month", "speed", "monthProgress", "gold", "food", "wood", "stone", "popularity",
    "population", "housing", "unemployed", "ration", "tax", "bribeCostPerVillager", "foodTypes",
    "taverns", "beerBarrels", "churches", "cathedrals", "blessedShare", "fear",
    "spawnProgress", "elapsedSeconds", "nextVillagerId"
  ]) {
    if (savedSimulation[field] === undefined) savedSimulation[field] = defaults[field];
  }
  const numericFields = [
    "month", "speed", "monthProgress", "gold", "food", "wood", "stone", "popularity",
    "population", "housing", "unemployed", "foodTypes", "taverns", "beerBarrels",
    "churches", "cathedrals", "blessedShare", "fear", "spawnProgress", "elapsedSeconds", "nextVillagerId"
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

  const legacyCivilianSave = !Array.isArray(savedSimulation.villagers);
  const legacyLogistics = createSimulation().logistics;
  if (!savedSimulation.logistics || typeof savedSimulation.logistics !== "object") {
    const stockpile = legacyLogistics.storages.find((storage) => storage.id === "stockpile")!;
    const granary = legacyLogistics.storages.find((storage) => storage.id === "storehouse")!;
    stockpile.inventory = {};
    granary.inventory = {};
    if (Number(savedSimulation.wood) > 0) stockpile.inventory.wood = Number(savedSimulation.wood);
    if (Number(savedSimulation.stone) > 0) stockpile.inventory.stone = Number(savedSimulation.stone);
    if (Number(savedSimulation.beerBarrels) > 0) stockpile.inventory.beer = Number(savedSimulation.beerBarrels);
    if (Number(savedSimulation.food) > 0) granary.inventory.apples = Number(savedSimulation.food);
  }
  let restoredLogistics;
  try {
    restoredLogistics = normalizeLogistics(savedSimulation.logistics, legacyLogistics);
  } catch {
    closeDialog(); setStatus("Zapis zawiera magazyn z przekroczoną pojemnością lub nieprawidłowym towarem.");
    return;
  }

  const allowedBaseIds = new Set(["keep", "barracks", "mill", "storehouse", "stockpile", "guard", "archers", "riders", "raiders"]);
  const savedRecords = parsed.entities.filter((entry): entry is Record<string, unknown> =>
    isRecord(entry) && typeof entry.id === "string" &&
    (allowedBaseIds.has(entry.id) || /^watchtower-\d+$/.test(entry.id) || /^hovel-\d+$/.test(entry.id) ||
      /^(chapel|church|cathedral|inn)-\d+$/.test(entry.id) || /^fear-(good|bad)-\d+$/.test(entry.id) ||
      /^(stockpile|granary|armory)-\d+$/.test(entry.id) || /^(stockpile|granary|armory)-module-\d+$/.test(entry.id) ||
      /^(woodcutter|quarry|iron-mine|pitch-worker|apple-orchard|hunter|dairy-farm|wheat-farm|mill|bakery|hop-farm|brewery|bowyer|poleturner|blacksmith|tanner|armourer|ox-tether|market)-\d+$/.test(entry.id)) &&
    typeof entry.x === "number" && Number.isFinite(entry.x) &&
    typeof entry.y === "number" && Number.isFinite(entry.y) &&
    typeof entry.health === "number" && Number.isFinite(entry.health)
  );
  if (!savedRecords.some((entry) => entry.id === "stockpile")) {
    savedRecords.push({ id: "stockpile", x: 715, y: 1080, health: 100 });
  }
  if (savedRecords.length === 0 || savedRecords.length > 200) {
    closeDialog(); setStatus("Zapis nie zawiera prawidłowych obiektów rozgrywki.");
    return;
  }

  if (Array.isArray(savedSimulation.villagers)) {
    if (savedSimulation.villagers.length > 200 || !savedSimulation.villagers.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && typeof entry.x === "number" && Number.isFinite(entry.x) &&
      typeof entry.y === "number" && Number.isFinite(entry.y) &&
      ["idle", "walking-to-work", "working", "returning-to-campfire", "leaving", "fetching-input", "hauling-output", "returning-to-work", "waiting-at-storage", "waiting-for-route"].includes(String(entry.status)) &&
      ["laborer", "priest"].includes(String(entry.role)) && typeof entry.blessedUntil === "number" &&
      Array.isArray(entry.movementQueue) &&
      (entry.cargo === undefined || (Array.isArray(entry.cargo) && entry.cargo.every((item) =>
        isRecord(item) && typeof item.resource === "string" && item.resource in RESOURCE_DEFINITIONS &&
        typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount >= 0))) &&
      (entry.targetStorageId === undefined || typeof entry.targetStorageId === "string") &&
      (entry.returnWorksiteId === undefined || typeof entry.returnWorksiteId === "string"))) {
      closeDialog(); setStatus("Zapis zawiera nieprawidłową listę mieszkańców."); return;
    }
  }
  if (Array.isArray(savedSimulation.worksites) && !savedSimulation.worksites.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && typeof entry.x === "number" && Number.isFinite(entry.x) &&
    typeof entry.y === "number" && Number.isFinite(entry.y) && Number.isFinite(entry.requiredWorkers) &&
    Array.isArray(entry.workerIds) && entry.workerIds.every((id) => typeof id === "string") &&
    (entry.enabled === undefined || typeof entry.enabled === "boolean") &&
    (entry.productionType === undefined || (typeof entry.productionType === "string" && entry.productionType in PRODUCTION_RECIPES)) &&
    (entry.outputVariant === undefined || (typeof entry.outputVariant === "string" && entry.outputVariant in RESOURCE_DEFINITIONS)) &&
    (entry.productionProgress === undefined || (typeof entry.productionProgress === "number" && Number.isFinite(entry.productionProgress) && entry.productionProgress >= 0)) &&
    (entry.inputBuffer === undefined || (isRecord(entry.inputBuffer) && Object.entries(entry.inputBuffer).every(([resource, amount]) => resource in RESOURCE_DEFINITIONS && typeof amount === "number" && Number.isFinite(amount) && amount >= 0))) &&
    (entry.pendingOutputs === undefined || (Array.isArray(entry.pendingOutputs) && entry.pendingOutputs.every((item) => isRecord(item) && typeof item.resource === "string" && item.resource in RESOURCE_DEFINITIONS && typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount >= 0))) &&
    (entry.oxTetherFor === undefined || typeof entry.oxTetherFor === "string"))) {
    closeDialog(); setStatus("Zapis zawiera nieprawidłowe miejsca pracy."); return;
  }
  if (Array.isArray(savedSimulation.fearObjects) && !savedSimulation.fearObjects.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && (entry.kind === "good" || entry.kind === "bad") &&
    typeof entry.x === "number" && typeof entry.y === "number")) {
    closeDialog(); setStatus("Zapis zawiera nieprawidłowe obiekty strachu."); return;
  }

  // Detach GPU batches before disposing the previous world containers.
  effulgence.setLayers(null);
  // Recreate the deterministic world, then apply the saved state to its entities.
  for (const glyph of villagerViews.values()) glyph.destroy();
  villagerViews.clear();
  for (const child of worldRoot.removeChildren()) child.destroy({ children: true });
  const freshWorld = createWorld(worldRoot);
  buildPreviewLayer = new Container();
  buildPreviewLayer.zIndex = 1000;
  worldRoot.addChild(buildPreviewLayer);
  buildPreviewRing = null;
  buildPreviewGlyph = null;
  buildPreviewLayer.visible = false;
  lastBuildPreviewClient = null;
  world.layers = freshWorld.layers;
  effulgence.setLayers(world.layers, buildPreviewLayer);
  world.grid = freshWorld.grid;
  world.setFlattened = freshWorld.setFlattened;
  createCampfireVisuals();
  selectionMarkers.clear();
  selectedIds.clear();
  placedStructures.clear();
  undoStack.length = 0;
  controlGroups.clear();
  cameraBookmarks.clear();
  towerCounter = 0;
  townBuildingCounter = 0;
  stage4BuildingCounter = 0;

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
    if (!entity && (/^hovel-\d+$/.test(id) || /^(chapel|church|cathedral|inn)-\d+$/.test(id) || /^fear-(good|bad)-\d+$/.test(id))) {
      const match = id.match(/^(fear-(?:good|bad)|hovel|chapel|church|cathedral|inn)-(\d+)$/);
      if (match) {
        const prefix = match[1]!;
        const suffix = Number(match[2]);
        const type: TownBuildingType = prefix === "fear-good" ? "good" : prefix === "fear-bad" ? "bad" : prefix as TownBuildingType;
        entity = createTownBuilding(freshWorld.layers.structures, type, suffix, Number(record.x), Number(record.y));
        townBuildingCounter = Math.max(townBuildingCounter, suffix);
      }
    }
    if (!entity) {
      const moduleMatch = id.match(/^(stockpile|granary|armory)-module-(\d+)$/);
      const storageMatch = id.match(/^(stockpile|granary|armory)-(\d+)$/);
      const logisticsMatch = id.match(/^(woodcutter|quarry|iron-mine|pitch-worker|apple-orchard|hunter|dairy-farm|wheat-farm|hop-farm|mill|bakery|brewery|bowyer|poleturner|blacksmith|tanner|armourer|ox-tether|market)-(\d+)$/);
      if (moduleMatch) entity = createStorageBuilding(freshWorld.layers.structures, moduleMatch[1] as StorageType, Number(moduleMatch[2]), Number(record.x), Number(record.y), true);
      else if (storageMatch) entity = createStorageBuilding(freshWorld.layers.structures, storageMatch[1] as StorageType, Number(storageMatch[2]), Number(record.x), Number(record.y));
      else if (logisticsMatch) entity = createProductionBuilding(freshWorld.layers.structures, logisticsMatch[1] as LogisticsBuildingType, Number(logisticsMatch[2]), Number(record.x), Number(record.y));
      if (logisticsMatch || storageMatch || moduleMatch) {
        const suffix = Number((moduleMatch ?? storageMatch ?? logisticsMatch)?.[2] ?? 0);
        stage4BuildingCounter = Math.max(stage4BuildingCounter, suffix);
      }
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
  simulation.logistics = restoredLogistics;
  if (legacyCivilianSave) {
    const defaults = createSimulation();
    simulation.villagers = defaults.villagers;
    simulation.worksites = defaults.worksites;
    simulation.fearObjects = [];
    simulation.spawnProgress = 0;
    simulation.elapsedSeconds = 0;
    simulation.nextVillagerId = defaults.nextVillagerId;
    syncPopulationCounters(simulation);
  }
  if (!Array.isArray(simulation.worksites)) simulation.worksites = [];
  const legacyMill = simulation.worksites.find((site) => site.id === "mill");
  if (legacyMill && !legacyMill.productionType) {
    legacyMill.productionType = "mill";
    legacyMill.productionProgress = 0;
    legacyMill.inputBuffer = {};
  }
  if (!Array.isArray(simulation.fearObjects)) simulation.fearObjects = [];
  if (!Array.isArray(simulation.villagers)) simulation.villagers = createSimulation().villagers;
  if (legacyCivilianSave) assignAvailableWorkers(simulation);
  syncPopulationCounters(simulation);
  syncResourceCounters(simulation);
  towerCounter = Math.max(towerCounter, typeof parsed.towerCounter === "number" ? parsed.towerCounter : 0);
  townBuildingCounter = Math.max(townBuildingCounter, typeof parsed.townBuildingCounter === "number" ? parsed.townBuildingCounter : 0);
  stage4BuildingCounter = Math.max(stage4BuildingCounter, typeof parsed.stage4BuildingCounter === "number" ? parsed.stage4BuildingCounter : 0);

  if (Array.isArray(parsed.placedStructures)) {
    for (const entry of parsed.placedStructures) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || !restoredIds.has(entry[0]) || !isRecord(entry[1])) continue;
      const { wood: savedWood, stone: savedStone, gold: savedGold, housing: savedHousing, worksiteId, fearObjectId,
        storageId, storageModuleId, storageModuleSlots } = entry[1];
      if (typeof savedWood === "number" && Number.isFinite(savedWood) &&
          typeof savedStone === "number" && Number.isFinite(savedStone)) {
        placedStructures.set(entry[0], {
          wood: Math.max(0, savedWood), stone: Math.max(0, savedStone),
          gold: typeof savedGold === "number" && Number.isFinite(savedGold) ? Math.max(0, savedGold) : 0,
          ...(typeof savedHousing === "number" ? { housing: savedHousing } : {}),
          ...(typeof worksiteId === "string" ? { worksiteId } : {}),
          ...(typeof fearObjectId === "string" ? { fearObjectId } : {}),
          ...(typeof storageId === "string" ? { storageId } : {}),
          ...(typeof storageModuleId === "string" ? { storageModuleId } : {}),
          ...(typeof storageModuleSlots === "number" && Number.isFinite(storageModuleSlots) ? { storageModuleSlots } : {})
        });
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
  updateVillagerVisuals(0);
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
  const key = event.key.toLowerCase();
  if (key === "escape" && !dialogOverlay.hidden) {
    event.preventDefault();
    closeDialog();
    return;
  }
  if (!dialogOverlay.hidden) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
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
        const fearDamage = unit.team === "player" ? getFearDamageMultiplier(simulation.fear) : 1;
        target.health -= (unit.attackDamage ?? 9) * fearDamage;
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
  if (paused) {
    updateVillagerVisuals(0);
    effulgence.update(performance.now() / 1000);
    effulgence.render();
    return;
  }
  const populationBeforeTick = simulation.population;
  const reports = advanceSimulation(simulation, deltaSeconds);
  updateVillagerVisuals(deltaSeconds);
  if (simulation.population !== populationBeforeTick && reports.length === 0) {
    const change = simulation.population > populationBeforeTick ? "Nowy mieszkaniec dotarł do ogniska." : "Mieszkaniec opuścił zamek.";
    setStatus(change + " Ludność: " + simulation.population + "/" + simulation.housing + ", bezrobotni: " + simulation.unemployed + ".");
  }
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
    updateVillagerVisuals(0);
    setStatus(`Rozliczenie miesiąca ${latest.month - 1}: żywność −${latest.foodConsumed.toFixed(2)}, złoto ${latest.taxes >= 0 ? "+" : ""}${latest.taxes.toFixed(1)}${latest.bribeCost ? `, łapówka −${latest.bribeCost.toFixed(1)}` : ""}, popularność ${latest.popularityChange >= 0 ? "+" : ""}${latest.popularityChange}. ${latest.messages.join(" ")}`);
  }
  updateCombat(deltaSeconds);
  for (const entity of entities) {
    if (entity.kind === "unit") moveUnit(entity, deltaSeconds);
  }
  effulgence.update(performance.now() / 1000);
  effulgence.render();
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
updateVillagerVisuals(0);
renderMinimap();
updateScribe();
window.addEventListener("resize", () => {
  effulgence.resize(app.screen.width, app.screen.height);
  preserveCameraCenter({ x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
  renderMinimap();
});
