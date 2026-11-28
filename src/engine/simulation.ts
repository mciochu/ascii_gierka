/** Deterministic economy, civilian population, religion and fear systems for DOMINIUM. */
import {
  addStorage, canStoreResource, consumeFood, createInitialLogistics, depositResource,
  findStorageWithResource, getFoodTotal, getFoodTypes, getResourceTotal,
  PRODUCTION_RECIPES, RESOURCE_DEFINITIONS, withdrawResource,
  type LogisticsState, type ResourceId, type StorageBuilding, type ProductionType
} from "./logistics.ts";
export type RationLevel = 0 | 0.5 | 1 | 1.5 | 2;
export type TaxLevel = "bribe-generous" | "bribe-large" | "bribe-small" | "none" | "low" | "medium" | "high" | "heavy" | "extortionate" | "cruel";
export type WorksiteKind = "production" | "religion" | "inn";
export type ReligiousBuilding = "chapel" | "church" | "cathedral";
export type FearObjectKind = "good" | "bad";
export type VillagerStatus = "idle" | "walking-to-work" | "working" | "returning-to-campfire" | "leaving" |
  "fetching-input" | "hauling-output" | "returning-to-work" | "waiting-at-storage" | "waiting-for-route";
export type VillagerRole = "laborer" | "priest";

export interface Villager {
  id: string;
  x: number;
  y: number;
  status: VillagerStatus;
  role: VillagerRole;
  worksiteId?: string;
  targetX?: number;
  targetY?: number;
  moveTarget?: { x: number; y: number };
  movementQueue: { x: number; y: number }[];
  blessedUntil: number;
  departureStartedAt?: number;
  departed?: boolean;
  blessingTargetId?: string;
  blessingReadyAt?: number;
  cargo?: { resource: ResourceId; amount: number }[];
  logisticsTask?: "fetch-input" | "deliver-output";
  targetStorageId?: string;
  returnWorksiteId?: string;
}

export interface Worksite {
  id: string;
  kind: WorksiteKind;
  requiredWorkers: number;
  workerIds: string[];
  /** False pauses this building and releases its workers back to the campfire. */
  enabled?: boolean;
  x: number;
  y: number;
  buildingType?: ReligiousBuilding;
  productionType?: ProductionType;
  productionProgress?: number;
  inputBuffer?: Partial<Record<ResourceId, number>>;
  pendingOutput?: { resource: ResourceId; amount: number };
  pendingOutputs?: { resource: ResourceId; amount: number }[];
  productionCycles?: number;
  outputVariant?: ResourceId;
  waitingReason?: string;
  sourceX?: number;
  sourceY?: number;
  oxTetherFor?: string;
}

export interface FearObject {
  id: string;
  kind: FearObjectKind;
  x: number;
  y: number;
}

export interface SimulationState {
  month: number;
  speed: number;
  monthProgress: number;
  /** Most recent twelve actual month settlements; persisted in local saves. */
  monthlyHistory: MonthlyReport[];
  gold: number;
  food: number;
  wood: number;
  stone: number;
  popularity: number;
  population: number;
  housing: number;
  unemployed: number;
  ration: RationLevel;
  tax: TaxLevel;
  /** Null until the source specification provides an exact cost per villager. */
  bribeCostPerVillager: number | null;
  foodTypes: number;
  /** Legacy display counter; active taverns are derived from staffed inn worksites. */
  taverns: number;
  beerBarrels: number;
  churches: number;
  cathedrals: number;
  blessedShare: number;
  fear: number;
  villagers: Villager[];
  worksites: Worksite[];
  fearObjects: FearObject[];
  spawnProgress: number;
  elapsedSeconds: number;
  nextVillagerId: number;
  logistics: LogisticsState;
}

export const MONTH_LENGTH_SECONDS = 30;
export const MIN_GAME_SPEED = 20;
export const MAX_GAME_SPEED = 90;
export const CAMPFIRE = { x: 1228, y: 1015 };
export const CAMPFIRE_IDLE_LIMIT = 24;
export const BLESSING_DURATION_SECONDS = 90;
export const VILLAGER_MOVE_SPEED = 76;

export const TAX_RULES: Record<TaxLevel, { label: string; popularity: number; goldPerVillager: number; bribe: number }> = {
  "bribe-generous": { label: "Hojna łapówka", popularity: 7, goldPerVillager: 0, bribe: 0 },
  "bribe-large": { label: "Duża łapówka", popularity: 5, goldPerVillager: 0, bribe: 0 },
  "bribe-small": { label: "Mała łapówka", popularity: 3, goldPerVillager: 0, bribe: 0 },
  none: { label: "Brak podatków", popularity: 1, goldPerVillager: 0, bribe: 0 },
  low: { label: "Niskie podatki", popularity: -2, goldPerVillager: 0.6, bribe: 0 },
  medium: { label: "Średnie podatki", popularity: -4, goldPerVillager: 0.8, bribe: 0 },
  high: { label: "Wysokie podatki", popularity: -6, goldPerVillager: 1, bribe: 0 },
  heavy: { label: "Uciążliwe podatki", popularity: -8, goldPerVillager: 1.2, bribe: 0 },
  extortionate: { label: "Złodziejskie podatki", popularity: -12, goldPerVillager: 1.4, bribe: 0 },
  cruel: { label: "Okrutne podatki", popularity: -16, goldPerVillager: 1.8, bribe: 0 }
};

export function campfireIdlePosition(index: number): { x: number; y: number } {
  const safeIndex = Math.max(0, Math.trunc(index));
  const angle = safeIndex * 2.399963229728653;
  const radius = 24 + Math.sqrt(safeIndex) * 15;
  return { x: CAMPFIRE.x + Math.cos(angle) * radius, y: CAMPFIRE.y + Math.sin(angle) * radius };
}

function makeVillager(id: string, index: number, x = CAMPFIRE.x, y = CAMPFIRE.y): Villager {
  const idle = campfireIdlePosition(index);
  return {
    id,
    x: x === CAMPFIRE.x && y === CAMPFIRE.y ? idle.x : x,
    y: x === CAMPFIRE.x && y === CAMPFIRE.y ? idle.y : y,
    status: "idle",
    role: "laborer",
    movementQueue: [],
    blessedUntil: 0
  };
}

export function assignAvailableWorkers(state: SimulationState): number {
  let assigned = 0;
  for (const site of state.worksites) {
    if (site.enabled === false) continue;
    while (site.workerIds.length < site.requiredWorkers) {
      const villager = state.villagers.find((candidate) => candidate.status === "idle");
      if (!villager) break;
      villager.status = "walking-to-work";
      villager.role = site.kind === "religion" ? "priest" : "laborer";
      villager.worksiteId = site.id;
      villager.targetX = site.x;
      villager.targetY = site.y;
      villager.moveTarget = undefined;
      villager.movementQueue = [];
      site.workerIds.push(villager.id);
      assigned += 1;
    }
  }
  syncPopulationCounters(state);
  return assigned;
}

export function syncPopulationCounters(state: SimulationState): void {
  state.population = state.villagers.length;
  state.unemployed = state.villagers.filter((villager) => villager.status === "idle").length;
  state.churches = state.worksites.filter((site) => site.kind === "religion" && site.buildingType === "church").length;
  state.cathedrals = state.worksites.filter((site) => site.kind === "religion" && site.buildingType === "cathedral").length;
  state.taverns = activeInnCount(state);
}

export function addWorksite(state: SimulationState, site: Worksite): void {
  state.worksites.push({ ...site, enabled: site.enabled !== false, workerIds: [] });
  assignAvailableWorkers(state);
}

function releaseWorksiteWorkers(state: SimulationState, worksiteId: string): void {
  for (const villager of state.villagers) {
    if (villager.worksiteId !== worksiteId) continue;
    villager.worksiteId = undefined;
    villager.role = "laborer";
    villager.status = "returning-to-campfire";
    villager.targetX = undefined;
    villager.targetY = undefined;
    villager.moveTarget = undefined;
    villager.movementQueue = [];
    villager.blessingTargetId = undefined;
    villager.blessingReadyAt = undefined;
  }
}

/** Pause/resume a staffed building. Released workers walk back to the campfire. */
export function setWorksiteEnabled(state: SimulationState, worksiteId: string, enabled: boolean): boolean {
  const site = state.worksites.find((candidate) => candidate.id === worksiteId);
  if (!site || (site.enabled !== false) === enabled) return false;
  site.enabled = enabled;
  if (!enabled) {
    releaseWorksiteWorkers(state, worksiteId);
    site.workerIds = [];
    assignAvailableWorkers(state);
  } else {
    assignAvailableWorkers(state);
  }
  syncPopulationCounters(state);
  return true;
}

export function removeWorksite(state: SimulationState, worksiteId: string): void {
  const index = state.worksites.findIndex((site) => site.id === worksiteId);
  if (index < 0) return;
  state.worksites.splice(index, 1);
  releaseWorksiteWorkers(state, worksiteId);
  assignAvailableWorkers(state);
  syncPopulationCounters(state);
}

export function createSimulation(): SimulationState {
  const state: SimulationState = {
    month: 1, speed: 40, monthProgress: 0, monthlyHistory: [],
    gold: 1240, food: 860, wood: 340, stone: 210,
    popularity: 65, population: 8, housing: 8, unemployed: 8,
    ration: 1, tax: "none", bribeCostPerVillager: null, foodTypes: 1, taverns: 0, beerBarrels: 0,
    churches: 0, cathedrals: 0, blessedShare: 0, fear: 0,
    villagers: Array.from({ length: 8 }, (_, index) => makeVillager("villager-" + (index + 1), index)),
    worksites: [{ id: "mill", kind: "production", requiredWorkers: 3, workerIds: [], enabled: true, x: 1455, y: 1100 }],
    fearObjects: [],
    spawnProgress: 0,
    elapsedSeconds: 0,
    nextVillagerId: 9,
    logistics: createInitialLogistics()
  };
  state.worksites[0]!.productionType = "mill";
  state.worksites[0]!.productionProgress = 0;
  syncResourceCounters(state);
  assignAvailableWorkers(state);
  return state;
}

/** Legacy HUD totals are derived from the contents of physical warehouses. */
export function syncResourceCounters(state: SimulationState): void {
  state.food = getFoodTotal(state.logistics);
  state.foodTypes = getFoodTypes(state.logistics);
  state.wood = getResourceTotal(state.logistics, "wood");
  state.stone = getResourceTotal(state.logistics, "stone");
  state.beerBarrels = getResourceTotal(state.logistics, "beer");
}

export function totalResource(state: SimulationState, resource: ResourceId): number {
  return getResourceTotal(state.logistics, resource);
}

export function addStorageBuilding(state: SimulationState, storage: StorageBuilding): boolean {
  return addStorage(state.logistics, storage);
}

export function depositStoredResource(state: SimulationState, storageId: string, resource: ResourceId, amount: number): number {
  const storage = state.logistics.storages.find((candidate) => candidate.id === storageId);
  if (!storage) return 0;
  const accepted = depositResource(storage, resource, amount);
  syncResourceCounters(state);
  return accepted;
}

export function withdrawStoredResource(state: SimulationState, storageId: string, resource: ResourceId, amount: number): number {
  const storage = state.logistics.storages.find((candidate) => candidate.id === storageId);
  if (!storage) return 0;
  const taken = withdrawResource(storage, resource, amount);
  syncResourceCounters(state);
  return taken;
}

export function spendStoredResource(state: SimulationState, resource: ResourceId, amount: number): boolean {
  if (!Number.isFinite(amount) || amount < 0 || totalResource(state, resource) + 0.000001 < amount) return false;
  let remaining = amount;
  for (const storage of state.logistics.storages.filter((candidate) => candidate.type === RESOURCE_DEFINITIONS[resource].storage)) {
    remaining -= withdrawResource(storage, resource, remaining);
    if (remaining <= 0.000001) break;
  }
  syncResourceCounters(state);
  return remaining <= 0.000001;
}

export function consumeStoredFood(state: SimulationState, amount: number): number {
  const consumed = consumeFood(state.logistics, amount);
  syncResourceCounters(state);
  return consumed;
}

export function storeResource(state: SimulationState, storageId: string, resource: ResourceId, amount: number): number {
  return depositStoredResource(state, storageId, resource, amount);
}

/** Called when a worker physically reaches the storage selected for an input delivery. */
export function pickupProductionInput(state: SimulationState, villagerId: string): boolean {
  const villager = state.villagers.find((candidate) => candidate.id === villagerId);
  if (!villager || villager.status !== "fetching-input" || villager.logisticsTask !== "fetch-input" || villager.cargo?.length) return false;
  const site = state.worksites.find((candidate) => candidate.id === villager.returnWorksiteId);
  const recipe = site?.productionType ? PRODUCTION_RECIPES[site.productionType] : undefined;
  const input = recipe?.input;
  const source = state.logistics.storages.find((storage) => storage.id === villager.targetStorageId);
  if (!site || !input || !source || source.type !== RESOURCE_DEFINITIONS[input.resource].storage) return false;
  const taken = withdrawResource(source, input.resource, input.amount);
  if (taken < input.amount) {
    if (taken > 0) depositResource(source, input.resource, taken);
    site.waitingReason = "Brak surowca wejściowego: " + RESOURCE_DEFINITIONS[input.resource].name;
    villager.status = "working";
    villager.logisticsTask = undefined;
    villager.targetStorageId = undefined;
    villager.returnWorksiteId = undefined;
    syncResourceCounters(state);
    return false;
  }
  villager.cargo = [{ resource: input.resource, amount: taken }];
  villager.targetStorageId = undefined;
  villager.status = "returning-to-work";
  site.waitingReason = undefined;
  syncResourceCounters(state);
  return true;
}

/** Called when a courier carrying recipe input physically returns to its worksite. */
export function completeProductionInputDelivery(state: SimulationState, villagerId: string): boolean {
  const villager = state.villagers.find((candidate) => candidate.id === villagerId);
  if (!villager || villager.status !== "returning-to-work" || villager.logisticsTask !== "fetch-input" || !villager.cargo?.length) return false;
  const site = state.worksites.find((candidate) => candidate.id === villager.returnWorksiteId);
  if (!site) return false;
  site.inputBuffer ??= {};
  for (const item of villager.cargo) site.inputBuffer[item.resource] = (site.inputBuffer[item.resource] ?? 0) + item.amount;
  villager.cargo = undefined;
  villager.logisticsTask = undefined;
  villager.targetStorageId = undefined;
  villager.returnWorksiteId = undefined;
  villager.status = "working";
  return true;
}

/** Progresses only while all required workers are at their building and physical stock exists. */
export function advanceProduction(state: SimulationState, deltaSeconds: number): void {
  const delta = Math.max(0, deltaSeconds);
  if (delta <= 0) return;
  for (const site of state.worksites) {
    if (!site.productionType || site.enabled === false) continue;
    const recipe = PRODUCTION_RECIPES[site.productionType];
    const workers = site.workerIds.map((id) => state.villagers.find((villager) => villager.id === id)).filter((v): v is Villager => !!v);
    if (workers.length < recipe.workers || workers.some((worker) => worker.status !== "working")) continue;
    const oxCarrier = recipe.requiresOx
      ? state.worksites.filter((candidate) => candidate.oxTetherFor === site.id && candidate.enabled !== false)
        .flatMap((oxSite) => oxSite.workerIds.map((id) => state.villagers.find((villager) => villager.id === id)))
        .find((villager): villager is Villager => !!villager && villager.status === "working")
      : undefined;
    if (recipe.requiresOx && !oxCarrier) {
      site.waitingReason = "Brak czynnego wołu przypisanego do kamieniołomu";
      continue;
    }
    const carrier = oxCarrier ?? workers[0]!;
    const pending = site.pendingOutputs ?? (site.pendingOutput ? [site.pendingOutput] : []);
    if (pending.length) {
      const target = state.logistics.storages.find((storage) => pending.every((item) => canStoreResource(storage, item.resource, item.amount)));
      if (!target) { site.waitingReason = "Magazyn docelowy jest pełny"; continue; }
      carrier.cargo = pending.map((item) => ({ ...item }));
      carrier.returnWorksiteId = site.id;
      carrier.logisticsTask = "deliver-output";
      carrier.targetStorageId = target.id;
      carrier.status = "hauling-output";
      site.pendingOutput = undefined;
      site.pendingOutputs = undefined;
      site.waitingReason = undefined;
      continue;
    }
    if (recipe.input) {
      const buffered = site.inputBuffer?.[recipe.input.resource] ?? 0;
      const progress = site.productionProgress ?? 0;
      if (progress <= 0 && buffered < recipe.input.amount) {
        if (carrier.status !== "working") continue;
        const source = findStorageWithResource(state.logistics, recipe.input.resource, recipe.input.amount, site);
        if (!source) {
          site.waitingReason = "Brak surowca wejściowego: " + RESOURCE_DEFINITIONS[recipe.input.resource].name;
          continue;
        }
        // Dispatch first. Inventory is withdrawn only when the worker reaches the source store.
        carrier.cargo = undefined;
        carrier.returnWorksiteId = site.id;
        carrier.logisticsTask = "fetch-input";
        carrier.targetStorageId = source.id;
        carrier.status = "fetching-input";
        site.waitingReason = undefined;
        continue;
      }
      if (progress <= 0 && buffered >= recipe.input.amount) {
        const remainingInput = buffered - recipe.input.amount;
        site.inputBuffer ??= {};
        if (remainingInput <= 0.000001) delete site.inputBuffer[recipe.input.resource];
        else site.inputBuffer[recipe.input.resource] = remainingInput;
      }
    }
    site.waitingReason = undefined;
    site.productionProgress = (site.productionProgress ?? 0) + delta * getFearWorkMultiplier(state.fear);
    if (site.productionProgress >= recipe.cycleSeconds) {
      site.productionProgress = 0;
      site.productionCycles = (site.productionCycles ?? 0) + 1;
      const outputs: { resource: ResourceId; amount: number }[] = [{
        resource: site.outputVariant && site.outputVariant in RESOURCE_DEFINITIONS ? site.outputVariant : recipe.output.resource,
        amount: recipe.output.amount
      }];
      if (recipe.byproduct && site.productionCycles % recipe.byproduct.everyCycles === 0) {
        outputs.push({ resource: recipe.byproduct.resource, amount: recipe.byproduct.amount });
      }
      site.pendingOutputs = outputs;
      site.pendingOutput = undefined;
      const target = state.logistics.storages.find((storage) => outputs.every((item) => canStoreResource(storage, item.resource, item.amount)));
      if (!target) {
        site.waitingReason = "Magazyn docelowy jest pełny";
      } else {
        carrier.cargo = outputs.map((item) => ({ ...item }));
        carrier.returnWorksiteId = site.id;
        carrier.logisticsTask = "deliver-output";
        carrier.targetStorageId = target.id;
        carrier.status = "hauling-output";
        site.pendingOutputs = undefined;
      }
    }
  }
}

export interface PopularityModifiers {
  ration: number;
  variety: number;
  tax: number;
  beer: number;
  religionPassive: number;
  blessings: number;
  fear: number;
  total: number;
}

export interface MonthlyReport {
  month: number;
  foodConsumed: number;
  taxes: number;
  bribeCost: number;
  popularityChange: number;
  spawnedVillagers: number;
  leftVillagers: number;
  messages: string[];
  modifiers: PopularityModifiers;
  unemployed: number;
  population: number;
}

export function calculateFearFactor(objects: FearObject[], population: number): number {
  if (objects.length === 0 || population <= 0) return 0;
  const good = objects.filter((object) => object.kind === "good").length;
  const bad = objects.filter((object) => object.kind === "bad").length;
  const difference = good - bad;
  if (difference === 0) return 0;
  const levels = Math.floor((Math.abs(difference) * 15) / Math.max(1, population));
  return Math.sign(difference) * Math.min(5, levels);
}

export function getFearWorkMultiplier(fear: number): number {
  const level = Math.max(-5, Math.min(5, Math.trunc(fear)));
  return level > 0 ? 1 - level * 0.1 : 1 + Math.abs(level) * 0.1;
}

export function getFearDamageMultiplier(fear: number): number {
  const level = Math.max(-5, Math.min(5, Math.trunc(fear)));
  return 1 + level * 0.05;
}

export function activeInnCount(state: SimulationState): number {
  return state.worksites.filter((site) =>
    site.kind === "inn" && site.enabled !== false && site.workerIds.some((id) =>
      state.villagers.some((villager) => villager.id === id && villager.status === "working")
    )
  ).length;
}

export function updateBlessedShare(state: SimulationState): number {
  const civilians = state.villagers.filter((villager) => villager.status !== "leaving");
  const blessed = civilians.filter((villager) => villager.blessedUntil > state.elapsedSeconds).length;
  state.blessedShare = civilians.length > 0 ? blessed / civilians.length : 0;
  return state.blessedShare;
}

function removeWorkerFromSite(state: SimulationState, villagerId: string): void {
  for (const site of state.worksites) {
    const index = site.workerIds.indexOf(villagerId);
    if (index >= 0) site.workerIds.splice(index, 1);
  }
}

function startVillagerDeparture(state: SimulationState): boolean {
  // A civilian carrying goods must finish the delivery before the population can dismiss them.
  const leaving = state.villagers
    .filter((villager) => villager.status !== "leaving" && !villager.cargo?.length)
    .sort((left, right) => {
      const leftSite = state.worksites.find((site) => site.id === left.worksiteId);
      const rightSite = state.worksites.find((site) => site.id === right.worksiteId);
      const leftProduction = leftSite?.kind === "production" ? 1 : 0;
      const rightProduction = rightSite?.kind === "production" ? 1 : 0;
      return rightProduction - leftProduction;
    })[0];
  if (!leaving) return false;
  removeWorkerFromSite(state, leaving.id);
  leaving.status = "leaving";
  leaving.departureStartedAt = state.elapsedSeconds;
  leaving.role = "laborer";
  leaving.worksiteId = undefined;
  leaving.targetX = undefined;
  leaving.targetY = undefined;
  leaving.moveTarget = undefined;
  leaving.movementQueue = [];
  syncPopulationCounters(state);
  return true;
}

function createNewVillager(state: SimulationState): Villager {
  const id = "villager-" + state.nextVillagerId++;
  const position = campfireIdlePosition(state.villagers.length);
  const villager = makeVillager(id, state.villagers.length, position.x, position.y);
  state.villagers.push(villager);
  assignAvailableWorkers(state);
  syncPopulationCounters(state);
  return villager;
}

/** Continuous campfire growth. Higher popularity fills the ring faster; 100 popularity means one new peasant per game month. */
export function advancePopulation(state: SimulationState, scaledDeltaSeconds: number): number {
  const delta = Math.max(0, scaledDeltaSeconds);
  state.elapsedSeconds += delta;
  state.villagers = state.villagers.filter((villager) =>
    villager.status !== "leaving" || (!villager.departed && state.elapsedSeconds - (villager.departureStartedAt ?? state.elapsedSeconds) < 60)
  );
  // A villager can disappear after reaching the map edge (or the timeout). Refresh
  // counters before evaluating housing and campfire limits, not only on early returns.
  syncPopulationCounters(state);
  if (state.popularity < 50 || state.population >= state.housing || state.unemployed >= CAMPFIRE_IDLE_LIMIT) {
    if (state.popularity < 50) state.spawnProgress = 0;
    syncPopulationCounters(state);
    updateBlessedShare(state);
    return 0;
  }
  state.spawnProgress += (delta / MONTH_LENGTH_SECONDS) * (state.popularity / 100);
  let spawned = 0;
  while (state.spawnProgress >= 1 && state.population < state.housing && state.unemployed < CAMPFIRE_IDLE_LIMIT) {
    state.spawnProgress -= 1;
    createNewVillager(state);
    spawned += 1;
  }
  updateBlessedShare(state);
  return spawned;
}

/** Consumes one idle civilian from the campfire. Soldiers are not part of housing or food consumption. */
export function recruitFromCampfire(state: SimulationState): boolean {
  const index = state.villagers.findIndex((villager) => villager.status === "idle");
  if (index < 0) return false;
  state.villagers.splice(index, 1);
  syncPopulationCounters(state);
  return true;
}

export function setHovelCapacity(state: SimulationState, delta: number): void {
  state.housing = Math.max(8, state.housing + Math.trunc(delta) * 8);
}

export function getPopularityModifiers(state: SimulationState): PopularityModifiers {
  syncPopulationCounters(state);
  syncResourceCounters(state);
  state.fear = calculateFearFactor(state.fearObjects, state.population);
  const tax = TAX_RULES[state.tax];
  const effectiveRation: RationLevel = state.food <= 0 ? 0 : state.ration;
  const consumptionPerVillager: Record<RationLevel, number> = { 0: 0, 0.5: 0.1, 1: 0.2, 1.5: 0.32, 2: 0.4 };
  const requestedFood = state.population * consumptionPerVillager[effectiveRation];
  const rationModifier = requestedFood > state.food + 0.0001
    ? -8
    : ({ 0: -8, 0.5: -4, 1: 0, 1.5: 4, 2: 8 } as Record<RationLevel, number>)[effectiveRation];
  const varietyModifier = effectiveRation > 0 ? Math.max(0, Math.min(3, Math.trunc(state.foodTypes) - 1)) : 0;
  const isBribe = state.tax.startsWith("bribe-");
  const bribeCost = isBribe && state.bribeCostPerVillager !== null
    ? state.population * Math.max(0, state.bribeCostPerVillager) : 0;
  const bribePaid = isBribe && state.bribeCostPerVillager !== null && state.gold >= bribeCost;
  const taxModifier = isBribe ? (bribePaid ? tax.popularity : 0) : tax.popularity;
  const innCount = activeInnCount(state);
  const beerUse = innCount * 0.144;
  const beerAvailable = innCount > 0 && state.beerBarrels + 0.000001 >= beerUse;
  const beerCoverage = Math.min(1, (innCount * 30) / Math.max(1, state.population));
  const beerModifier = beerAvailable
    ? (beerCoverage >= 1 ? 8 : beerCoverage >= 0.75 ? 6 : beerCoverage >= 0.5 ? 4 : beerCoverage >= 0.25 ? 2 : 0)
    : 0;
  const religionPassive =
    (state.worksites.some((site) => site.kind === "religion" && site.buildingType === "church") ? 1 : 0) +
    (state.worksites.some((site) => site.kind === "religion" && site.buildingType === "cathedral") ? 2 : 0);
  const blessings = Math.round(Math.max(0, Math.min(1, state.blessedShare)) * 8);
  const fear = Math.max(-5, Math.min(5, Math.trunc(state.fear)));
  const total = rationModifier + varietyModifier + taxModifier + beerModifier + religionPassive + blessings + fear;
  return { ration: rationModifier, variety: varietyModifier, tax: taxModifier, beer: beerModifier, religionPassive, blessings, fear, total };
}

export function settleMonth(state: SimulationState): MonthlyReport {
  const messages: string[] = [];
  syncPopulationCounters(state);
  syncResourceCounters(state);
  const tax = TAX_RULES[state.tax];
  const effectiveRation: RationLevel = state.food <= 0 ? 0 : state.ration;
  const consumptionPerVillager: Record<RationLevel, number> = { 0: 0, 0.5: 0.1, 1: 0.2, 1.5: 0.32, 2: 0.4 };
  const requestedFood = state.population * consumptionPerVillager[effectiveRation];
  const foodConsumed = consumeStoredFood(state, requestedFood);
  const shortage = requestedFood > 0 && foodConsumed + 0.0001 < requestedFood;
  const rationModifier = shortage
    ? -8
    : ({ 0: -8, 0.5: -4, 1: 0, 1.5: 4, 2: 8 } as Record<RationLevel, number>)[effectiveRation];
  const varietyModifier = effectiveRation > 0 ? Math.max(0, Math.min(3, Math.trunc(state.foodTypes) - 1)) : 0;

  state.fear = calculateFearFactor(state.fearObjects, state.population);
  const innCount = activeInnCount(state);
  const beerMonthlyUse = innCount * 0.144;
  const beerAvailable = innCount > 0 && state.beerBarrels + 0.000001 >= beerMonthlyUse;
  const beerCoverage = Math.min(1, (innCount * 30) / Math.max(1, state.population));
  const beerBonus = beerAvailable
    ? (beerCoverage >= 1 ? 8 : beerCoverage >= 0.75 ? 6 : beerCoverage >= 0.5 ? 4 : beerCoverage >= 0.25 ? 2 : 0)
    : 0;
  if (beerAvailable) spendStoredResource(state, "beer", beerMonthlyUse);

  const religionPassive =
    (state.worksites.some((site) => site.kind === "religion" && site.buildingType === "church") ? 1 : 0) +
    (state.worksites.some((site) => site.kind === "religion" && site.buildingType === "cathedral") ? 2 : 0);
  const religionBlessing = Math.round(Math.max(0, Math.min(1, state.blessedShare)) * 8);
  const fearModifier = Math.max(-5, Math.min(5, Math.trunc(state.fear)));
  const isBribe = state.tax.startsWith("bribe-");
  const bribeCost = isBribe && state.bribeCostPerVillager !== null
    ? state.population * Math.max(0, state.bribeCostPerVillager) : 0;
  const bribePaid = isBribe && state.bribeCostPerVillager !== null && state.gold >= bribeCost;
  const bribeBonus = bribePaid ? tax.popularity : 0;
  const taxModifier = isBribe ? bribeBonus : tax.popularity;
  const taxes = isBribe ? 0 : state.population * tax.goldPerVillager;
  const modifiers: PopularityModifiers = {
    ration: rationModifier, variety: varietyModifier, tax: taxModifier, beer: beerBonus,
    religionPassive, blessings: religionBlessing, fear: fearModifier,
    total: rationModifier + varietyModifier + taxModifier + beerBonus + religionPassive + religionBlessing + fearModifier
  };
  const popularityBefore = state.popularity;
  state.popularity = Math.max(0, Math.min(100, state.popularity + modifiers.total));
  state.gold = Math.max(0, state.gold + taxes - (bribePaid ? bribeCost : 0));

  let spawnedVillagers = 0;
  let leftVillagers = 0;
  if (state.popularity < 50 && state.population > 0) {
    if (startVillagerDeparture(state)) {
      leftVillagers = 1;
      messages.push("Popularność spadła poniżej 50 — mieszkaniec opuszcza zamek, a jego miejsce pracy zostaje zwolnione.");
    }
  }
  if (state.popularity >= 50 && state.population < state.housing && state.unemployed < CAMPFIRE_IDLE_LIMIT) {
    messages.push("Ognisko przyciąga nowych mieszkańców. Tempo przyrostu zależy od popularności.");
  }
  if (isBribe && state.bribeCostPerVillager === null) messages.push("Koszt łapówki nie jest określony — jej bonus nie został naliczony.");
  else if (isBribe && !bribePaid) messages.push("Brak złota na łapówkę — bonus popularności nie został naliczony.");
  if (state.food <= 0) messages.push("Spichlerz jest pusty. Racje żywnościowe spadły do zera.");
  if (state.unemployed >= CAMPFIRE_IDLE_LIMIT) messages.push("Ognisko osiągnęło limit 24 bezrobotnych chłopów.");
  if (popularityBefore >= 50 && state.popularity < 50) messages.push("Popularność spadła poniżej progu 50 — przyrost ludności zatrzymuje się.");

  syncPopulationCounters(state);
  state.month += 1;
  return {
    month: state.month, foodConsumed, taxes, bribeCost: bribePaid ? bribeCost : 0,
    popularityChange: modifiers.total, spawnedVillagers, leftVillagers, messages, modifiers,
    unemployed: state.unemployed, population: state.population
  };
}

export function advanceSimulation(state: SimulationState, realDeltaSeconds: number): MonthlyReport[] {
  const scaledDelta = Math.max(0, realDeltaSeconds) * (state.speed / 40);
  advancePopulation(state, scaledDelta);
  state.monthProgress += scaledDelta;
  const reports: MonthlyReport[] = [];
  while (state.monthProgress >= MONTH_LENGTH_SECONDS) {
    state.monthProgress -= MONTH_LENGTH_SECONDS;
    const report = settleMonth(state);
    state.monthlyHistory.push(report);
    if (state.monthlyHistory.length > 12) state.monthlyHistory.splice(0, state.monthlyHistory.length - 12);
    reports.push(report);
  }
  return reports;
}

export function setGameSpeed(state: SimulationState, next: number): number {
  state.speed = Math.max(MIN_GAME_SPEED, Math.min(MAX_GAME_SPEED, Math.round(next)));
  return state.speed;
}
