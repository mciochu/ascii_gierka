/** Physical storage, resource accounting, recipes and manual market for DOMINIUM. */
export type StorageType = "stockpile" | "granary" | "armory";
export type ResourceId =
  | "wood" | "stone" | "iron" | "pitch" | "wheat" | "flour" | "hops" | "beer" | "cows"
  | "apples" | "cheese" | "meat" | "bread"
  | "bow" | "crossbow" | "spear" | "pike" | "mace" | "sword" | "leatherArmor" | "plateArmor";

export interface StorageBuilding {
  id: string;
  type: StorageType;
  x: number;
  y: number;
  capacitySlots: number;
  moduleCount: number;
  inventory: Partial<Record<ResourceId, number>>;
}

export interface LogisticsState {
  storages: StorageBuilding[];
}

export interface ResourceDefinition {
  name: string;
  storage: StorageType;
  stackSize: number;
  buyPrice: number;
  sellPrice: number;
  food?: boolean;
}

export const RESOURCE_DEFINITIONS: Record<ResourceId, ResourceDefinition> = {
  wood: { name: "Drewno", storage: "stockpile", stackSize: 10, buyPrice: 12, sellPrice: 6 },
  stone: { name: "Kamień", storage: "stockpile", stackSize: 10, buyPrice: 20, sellPrice: 10 },
  iron: { name: "Żelazo", storage: "stockpile", stackSize: 10, buyPrice: 24, sellPrice: 12 },
  pitch: { name: "Smoła", storage: "stockpile", stackSize: 5, buyPrice: 12, sellPrice: 6 },
  wheat: { name: "Pszenica", storage: "stockpile", stackSize: 10, buyPrice: 6, sellPrice: 3 },
  flour: { name: "Mąka", storage: "stockpile", stackSize: 10, buyPrice: 8, sellPrice: 4 },
  hops: { name: "Chmiel", storage: "stockpile", stackSize: 10, buyPrice: 6, sellPrice: 3 },
  beer: { name: "Piwo", storage: "stockpile", stackSize: 5, buyPrice: 8, sellPrice: 4 },
  cows: { name: "Bydło", storage: "granary", stackSize: 5, buyPrice: 0, sellPrice: 0 },
  apples: { name: "Jabłka", storage: "granary", stackSize: 10, buyPrice: 8, sellPrice: 4, food: true },
  cheese: { name: "Ser", storage: "granary", stackSize: 10, buyPrice: 10, sellPrice: 5, food: true },
  meat: { name: "Mięso", storage: "granary", stackSize: 10, buyPrice: 10, sellPrice: 5, food: true },
  bread: { name: "Chleb", storage: "granary", stackSize: 10, buyPrice: 8, sellPrice: 4, food: true },
  bow: { name: "Łuk", storage: "armory", stackSize: 5, buyPrice: 16, sellPrice: 8 },
  crossbow: { name: "Kusza", storage: "armory", stackSize: 5, buyPrice: 28, sellPrice: 14 },
  spear: { name: "Włócznia", storage: "armory", stackSize: 5, buyPrice: 12, sellPrice: 6 },
  pike: { name: "Pika", storage: "armory", stackSize: 5, buyPrice: 18, sellPrice: 9 },
  mace: { name: "Buzdygan", storage: "armory", stackSize: 5, buyPrice: 20, sellPrice: 10 },
  sword: { name: "Miecz", storage: "armory", stackSize: 5, buyPrice: 32, sellPrice: 16 },
  leatherArmor: { name: "Skórzana zbroja", storage: "armory", stackSize: 5, buyPrice: 24, sellPrice: 12 },
  plateArmor: { name: "Zbroja płytowa", storage: "armory", stackSize: 5, buyPrice: 40, sellPrice: 20 }
};

/** Static hunting spots placed on walkable forest cells of the current map. */
export const HUNTING_NODES = [
  { x: 1976, y: 834 }, { x: 767, y: 465 }, { x: 1196, y: 1248 }, { x: 1742, y: 1302 }
] as const;

export const DEFAULT_STORAGE_CAPACITY = 100;
export const STORAGE_MODULE_CAPACITY = 25;
export const STORAGE_MODULE_COST = { wood: 40, stone: 15 };

/** Tunable starting balance values; the source specification defines recipes, not construction prices. */
export const STAGE4_BUILD_COSTS: Record<string, { wood: number; stone: number; gold: number }> = {
  stockpile: { wood: 60, stone: 20, gold: 0 }, granary: { wood: 60, stone: 10, gold: 0 }, armory: { wood: 70, stone: 25, gold: 0 },
  woodcutter: { wood: 30, stone: 0, gold: 0 }, quarry: { wood: 50, stone: 10, gold: 0 }, "ox-tether": { wood: 20, stone: 0, gold: 0 },
  "iron-mine": { wood: 45, stone: 15, gold: 0 }, "pitch-worker": { wood: 35, stone: 5, gold: 0 }, market: { wood: 80, stone: 15, gold: 0 },
  hunter: { wood: 25, stone: 0, gold: 0 }, "apple-orchard": { wood: 25, stone: 0, gold: 0 }, "dairy-farm": { wood: 40, stone: 0, gold: 0 },
  "wheat-farm": { wood: 25, stone: 0, gold: 0 }, "hop-farm": { wood: 25, stone: 0, gold: 0 },
  mill: { wood: 60, stone: 15, gold: 0 }, bakery: { wood: 30, stone: 0, gold: 0 }, brewery: { wood: 40, stone: 0, gold: 0 },
  bowyer: { wood: 35, stone: 0, gold: 0 }, poleturner: { wood: 30, stone: 0, gold: 0 }, blacksmith: { wood: 35, stone: 10, gold: 0 },
  tanner: { wood: 35, stone: 0, gold: 0 }, armourer: { wood: 35, stone: 10, gold: 0 }
};

export function createInitialLogistics(): LogisticsState {
  return {
    storages: [
      {
        id: "stockpile", type: "stockpile", x: 715, y: 1080,
        capacitySlots: DEFAULT_STORAGE_CAPACITY, moduleCount: 0,
        inventory: { wood: 340, stone: 210 }
      },
      {
        id: "storehouse", type: "granary", x: 875, y: 1100,
        capacitySlots: DEFAULT_STORAGE_CAPACITY, moduleCount: 0,
        inventory: { apples: 860 }
      }
    ]
  };
}

export function storageUsedSlots(storage: StorageBuilding): number {
  return (Object.entries(storage.inventory) as [ResourceId, number][])
    .reduce((sum, [resource, amount]) => {
      if (!(amount > 0)) return sum;
      const stackSize = RESOURCE_DEFINITIONS[resource].stackSize;
      return sum + Math.ceil(amount / stackSize);
    }, 0);
}

export function storageFreeSlots(storage: StorageBuilding): number {
  return Math.max(0, storage.capacitySlots - storageUsedSlots(storage));
}

export function canStoreResource(storage: StorageBuilding, resource: ResourceId, amount: number): boolean {
  if (RESOURCE_DEFINITIONS[resource].storage !== storage.type || !Number.isFinite(amount) || amount < 0) return false;
  const current = storage.inventory[resource] ?? 0;
  const stackSize = RESOURCE_DEFINITIONS[resource].stackSize;
  const usedBefore = storageUsedSlots(storage);
  const usedAfter = usedBefore - (current > 0 ? Math.ceil(current / stackSize) : 0) +
    Math.ceil((current + amount) / stackSize);
  return usedAfter <= storage.capacitySlots;
}

/** Deposits only what physically fits. The return value is the quantity actually stored. */
export function depositResource(storage: StorageBuilding, resource: ResourceId, amount: number): number {
  if (RESOURCE_DEFINITIONS[resource].storage !== storage.type || !Number.isFinite(amount) || amount <= 0) return 0;
  const current = storage.inventory[resource] ?? 0;
  const stackSize = RESOURCE_DEFINITIONS[resource].stackSize;
  let accepted = amount;
  if (!canStoreResource(storage, resource, amount)) {
    const currentSlots = current > 0 ? Math.ceil(current / stackSize) : 0;
    const freeSlots = Math.max(0, storage.capacitySlots - (storageUsedSlots(storage) - currentSlots));
    const maxAmount = Math.max(0, freeSlots * stackSize - current);
    accepted = Math.min(amount, maxAmount);
  }
  if (accepted > 0) storage.inventory[resource] = current + accepted;
  return accepted;
}

export function withdrawResource(storage: StorageBuilding, resource: ResourceId, amount: number): number {
  if (RESOURCE_DEFINITIONS[resource].storage !== storage.type || !Number.isFinite(amount) || amount <= 0) return 0;
  const current = storage.inventory[resource] ?? 0;
  const taken = Math.min(current, amount);
  const remaining = current - taken;
  if (remaining <= 0.000001) delete storage.inventory[resource];
  else storage.inventory[resource] = remaining;
  return taken;
}

export function findStorage(
  logistics: LogisticsState,
  resource: ResourceId,
  origin?: { x: number; y: number }
): StorageBuilding | undefined {
  const candidates = logistics.storages.filter((storage) => storage.type === RESOURCE_DEFINITIONS[resource].storage);
  return candidates.sort((a, b) => origin
    ? Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
    : a.id.localeCompare(b.id))[0];
}

export function findStorageWithResource(
  logistics: LogisticsState,
  resource: ResourceId,
  amount: number,
  origin?: { x: number; y: number }
): StorageBuilding | undefined {
  return logistics.storages
    .filter((storage) => storage.type === RESOURCE_DEFINITIONS[resource].storage && (storage.inventory[resource] ?? 0) >= amount)
    .sort((a, b) => origin
      ? Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
      : a.id.localeCompare(b.id))[0];
}

export function findStorageWithRoom(
  logistics: LogisticsState,
  resource: ResourceId,
  amount: number,
  origin?: { x: number; y: number }
): StorageBuilding | undefined {
  return logistics.storages
    .filter((storage) => canStoreResource(storage, resource, amount))
    .sort((a, b) => {
      if (origin) return Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y);
      return a.id.localeCompare(b.id);
    })[0];
}

export function getResourceTotal(logistics: LogisticsState, resource: ResourceId): number {
  return logistics.storages.reduce((sum, storage) => sum + (storage.inventory[resource] ?? 0), 0);
}

export function getFoodTotal(logistics: LogisticsState): number {
  return (["apples", "cheese", "meat", "bread"] as const)
    .reduce((sum, resource) => sum + getResourceTotal(logistics, resource), 0);
}

export function getFoodTypes(logistics: LogisticsState): number {
  return (["apples", "cheese", "meat", "bread"] as const)
    .filter((resource) => getResourceTotal(logistics, resource) > 0).length;
}

export function consumeFood(logistics: LogisticsState, amount: number): number {
  let remaining = Math.max(0, amount);
  let consumed = 0;
  // The granary consumes existing food in a stable order; no food is generated by the monthly tick.
  for (const resource of ["bread", "cheese", "meat", "apples"] as const) {
    for (const storage of logistics.storages.filter((candidate) => candidate.type === "granary")) {
      const taken = withdrawResource(storage, resource, remaining);
      consumed += taken;
      remaining -= taken;
      if (remaining <= 0.000001) return consumed;
    }
  }
  return consumed;
}

export function addStorage(logistics: LogisticsState, storage: StorageBuilding): boolean {
  if (logistics.storages.some((candidate) => candidate.id === storage.id) ||
      !Number.isInteger(storage.capacitySlots) || storage.capacitySlots < 1) return false;
  logistics.storages.push({ ...storage, moduleCount: 0, inventory: { ...storage.inventory } });
  return true;
}

export function removeStorage(logistics: LogisticsState, storageId: string): StorageBuilding | undefined {
  const index = logistics.storages.findIndex((storage) => storage.id === storageId);
  if (index < 0) return undefined;
  const [storage] = logistics.storages.splice(index, 1);
  return storage;
}

export function expandStorage(storage: StorageBuilding, extraSlots = STORAGE_MODULE_CAPACITY): boolean {
  if (!Number.isInteger(extraSlots) || extraSlots <= 0) return false;
  storage.capacitySlots += extraSlots;
  storage.moduleCount += 1;
  return true;
}

export function normalizeLogistics(value: unknown, fallback: LogisticsState): LogisticsState {
  if (!value || typeof value !== "object" || !Array.isArray((value as LogisticsState).storages)) {
    return structuredClone(fallback);
  }
  const storages = (value as LogisticsState).storages;
  const valid = storages.filter((storage): storage is StorageBuilding => {
    if (!storage || typeof storage !== "object") return false;
    const item = storage as StorageBuilding;
    return typeof item.id === "string" && ["stockpile", "granary", "armory"].includes(item.type) &&
      Number.isFinite(item.x) && Number.isFinite(item.y) && Number.isInteger(item.capacitySlots) && item.capacitySlots >= 1 &&
      Number.isInteger(item.moduleCount) && item.moduleCount >= 0 && !!item.inventory && typeof item.inventory === "object";
  }).map((storage) => {
    const inventory: Partial<Record<ResourceId, number>> = {};
    for (const [resource, amount] of Object.entries(storage.inventory)) {
      if (resource in RESOURCE_DEFINITIONS && typeof amount === "number" && Number.isFinite(amount) && amount >= 0 &&
          RESOURCE_DEFINITIONS[resource as ResourceId].storage === storage.type) {
        inventory[resource as ResourceId] = amount;
      }
    }
    const normalized = { ...storage, inventory };
    // Reject malformed saves rather than silently overflowing physical capacity.
    if (storageUsedSlots(normalized) > normalized.capacitySlots) throw new Error("Storage capacity exceeded");
    return normalized;
  });
  if (!valid.some((storage) => storage.id === "stockpile" && storage.type === "stockpile") ||
      !valid.some((storage) => storage.id === "storehouse" && storage.type === "granary")) {
    throw new Error("Required starting storage missing");
  }
  return { storages: valid };
}

export interface ProductionRecipe {
  name: string;
  workers: number;
  cycleSeconds: number;
  input?: { resource: ResourceId; amount: number };
  output: { resource: ResourceId; amount: number; storage: StorageType };
  byproduct?: { resource: ResourceId; amount: number; everyCycles: number };
  source: "forest" | "stone" | "iron" | "tar" | "oasis" | "deer" | "none";
  sourceRange: number;
  requiresOx?: boolean;
}

export type ProductionType =
  | "woodcutter" | "quarry" | "iron-mine" | "pitch-worker" | "apple-orchard" | "hunter"
  | "dairy-farm" | "wheat-farm" | "mill" | "bakery" | "hop-farm" | "brewery"
  | "bowyer" | "poleturner" | "blacksmith" | "tanner" | "armourer";

export const PRODUCTION_RECIPES: Record<ProductionType, ProductionRecipe> = {
  woodcutter: { name: "Chata drwala", workers: 1, cycleSeconds: 22, output: { resource: "wood", amount: 4, storage: "stockpile" }, source: "forest", sourceRange: 220 },
  quarry: { name: "Kamieniołom", workers: 3, cycleSeconds: 34, output: { resource: "stone", amount: 8, storage: "stockpile" }, source: "stone", sourceRange: 90, requiresOx: true },
  "iron-mine": { name: "Kopalnia żelaza", workers: 2, cycleSeconds: 32, output: { resource: "iron", amount: 4, storage: "stockpile" }, source: "iron", sourceRange: 90 },
  "pitch-worker": { name: "Warsztat smolarza", workers: 1, cycleSeconds: 26, output: { resource: "pitch", amount: 2, storage: "stockpile" }, source: "tar", sourceRange: 90 },
  "apple-orchard": { name: "Sad jabłoni", workers: 1, cycleSeconds: 20, output: { resource: "apples", amount: 4, storage: "granary" }, source: "oasis", sourceRange: 12 },
  hunter: { name: "Chata myśliwego", workers: 1, cycleSeconds: 28, output: { resource: "meat", amount: 3, storage: "granary" }, source: "deer", sourceRange: 230 },
  "dairy-farm": { name: "Farma mleczna", workers: 1, cycleSeconds: 26, output: { resource: "cheese", amount: 2, storage: "granary" }, byproduct: { resource: "cows", amount: 1, everyCycles: 3 }, source: "oasis", sourceRange: 12 },
  "wheat-farm": { name: "Farma pszenicy", workers: 1, cycleSeconds: 30, output: { resource: "wheat", amount: 4, storage: "stockpile" }, source: "oasis", sourceRange: 12 },
  mill: { name: "Młyn", workers: 3, cycleSeconds: 16, input: { resource: "wheat", amount: 1 }, output: { resource: "flour", amount: 1, storage: "stockpile" }, source: "none", sourceRange: 0 },
  bakery: { name: "Piekarnia", workers: 1, cycleSeconds: 12, input: { resource: "flour", amount: 1 }, output: { resource: "bread", amount: 8, storage: "granary" }, source: "none", sourceRange: 0 },
  "hop-farm": { name: "Farma chmielu", workers: 1, cycleSeconds: 30, output: { resource: "hops", amount: 2, storage: "stockpile" }, source: "oasis", sourceRange: 12 },
  brewery: { name: "Browar", workers: 1, cycleSeconds: 18, input: { resource: "hops", amount: 1 }, output: { resource: "beer", amount: 2, storage: "stockpile" }, source: "none", sourceRange: 0 },
  bowyer: { name: "Łuczarz", workers: 1, cycleSeconds: 26, input: { resource: "wood", amount: 2 }, output: { resource: "bow", amount: 1, storage: "armory" }, source: "none", sourceRange: 0 },
  poleturner: { name: "Drzewcarz", workers: 1, cycleSeconds: 20, input: { resource: "wood", amount: 1 }, output: { resource: "spear", amount: 1, storage: "armory" }, source: "none", sourceRange: 0 },
  blacksmith: { name: "Kowal", workers: 1, cycleSeconds: 34, input: { resource: "iron", amount: 1 }, output: { resource: "mace", amount: 1, storage: "armory" }, source: "none", sourceRange: 0 },
  tanner: { name: "Garbarz", workers: 1, cycleSeconds: 28, input: { resource: "cows", amount: 1 }, output: { resource: "leatherArmor", amount: 1, storage: "armory" }, source: "none", sourceRange: 0 },
  armourer: { name: "Płatnerz", workers: 1, cycleSeconds: 34, input: { resource: "iron", amount: 2 }, output: { resource: "plateArmor", amount: 1, storage: "armory" }, source: "none", sourceRange: 0 }
};

export type MarketResult = { ok: true; gold: number; quantity: number; message: string } | { ok: false; gold: number; quantity: 0; message: string };

export function tradeAtMarket(
  logistics: LogisticsState,
  gold: number,
  resource: ResourceId,
  quantity: number,
  direction: "buy" | "sell"
): MarketResult {
  const safeQuantity = Math.trunc(quantity);
  if (![1, 5].includes(safeQuantity)) return { ok: false, gold, quantity: 0, message: "Handel odbywa się w paczkach po 1 lub 5 sztuk." };
  const definition = RESOURCE_DEFINITIONS[resource];
  if (!definition || definition.buyPrice <= 0 || definition.sellPrice <= 0) {
    return { ok: false, gold, quantity: 0, message: "Tego towaru nie można handlować." };
  }
  const totalPrice = (direction === "buy" ? definition.buyPrice : definition.sellPrice) * safeQuantity;
  if (direction === "buy") {
    if (gold < totalPrice) return { ok: false, gold, quantity: 0, message: "Za mało złota na zakup." };
    const storage = findStorageWithRoom(logistics, resource, safeQuantity);
    if (!storage) return { ok: false, gold, quantity: 0, message: "Brak wolnych pól we właściwym magazynie." };
    const stored = depositResource(storage, resource, safeQuantity);
    if (stored !== safeQuantity) return { ok: false, gold, quantity: 0, message: "Brak wolnych pól we właściwym magazynie." };
    return { ok: true, gold: gold - totalPrice, quantity: safeQuantity, message: "Kupiono " + safeQuantity + " · " + definition.name + "." };
  }
  const owned = logistics.storages.reduce((sum, storage) => sum + (storage.type === definition.storage ? (storage.inventory[resource] ?? 0) : 0), 0);
  if (owned < safeQuantity) return { ok: false, gold, quantity: 0, message: "Brak wystarczającej ilości towaru w magazynie." };
  let remaining = safeQuantity;
  for (const storage of logistics.storages.filter((candidate) => candidate.type === definition.storage)) {
    remaining -= withdrawResource(storage, resource, remaining);
    if (remaining <= 0) break;
  }
  if (remaining > 0) return { ok: false, gold, quantity: 0, message: "Nie udało się pobrać całej partii towaru." };
  return { ok: true, gold: gold + totalPrice, quantity: safeQuantity, message: "Sprzedano " + safeQuantity + " · " + definition.name + "." };
}
