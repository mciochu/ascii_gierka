import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialLogistics, storageUsedSlots, storageFreeSlots, canStoreResource,
  depositResource, withdrawResource, consumeFood, getFoodTotal, getFoodTypes,
  expandStorage, normalizeLogistics, tradeAtMarket, PRODUCTION_RECIPES, HUNTING_NODES
} from "../src/engine/logistics.ts";
import { createWorldGrid, worldPositionForCell, worldToCell } from "../src/engine/grid.ts";
import {
  createSimulation, addWorksite, advanceProduction, depositStoredResource,
  pickupProductionInput, completeProductionInputDelivery, totalResource, storeResource
} from "../src/engine/simulation.ts";

function storage(logistics, id) {
  const found = logistics.storages.find((entry) => entry.id === id);
  assert.ok(found, "missing storage " + id);
  return found;
}

test("startowy Skład i Spichlerz są fizycznym źródłem liczników zasobów", () => {
  const logistics = createInitialLogistics();
  const stockpile = storage(logistics, "stockpile");
  const granary = storage(logistics, "storehouse");
  assert.equal(stockpile.type, "stockpile");
  assert.equal(granary.type, "granary");
  assert.equal(stockpile.inventory.wood, 340);
  assert.equal(stockpile.inventory.stone, 210);
  assert.equal(granary.inventory.apples, 860);
  assert.equal(storageUsedSlots(stockpile), 55);
  assert.equal(storageUsedSlots(granary), 86);
  assert.equal(storageFreeSlots(stockpile), 45);
  assert.equal(storageFreeSlots(granary), 14);
});

test("towar trafia wyłącznie do właściwego typu magazynu", () => {
  const logistics = createInitialLogistics();
  assert.equal(depositResource(storage(logistics, "stockpile"), "apples", 5), 0);
  assert.equal(depositResource(storage(logistics, "storehouse"), "wood", 5), 0);
  assert.equal(depositResource(storage(logistics, "stockpile"), "iron", 4), 4);
  assert.equal(depositResource(storage(logistics, "storehouse"), "bread", 8), 8);
});

test("pełny Spichlerz blokuje dostawę, a moduł zwiększa pojemność o 25 pól", () => {
  const logistics = createInitialLogistics();
  const granary = storage(logistics, "storehouse");
  assert.equal(depositResource(granary, "apples", 200), 140);
  assert.equal(storageUsedSlots(granary), 100);
  assert.equal(storageFreeSlots(granary), 0);
  assert.equal(canStoreResource(granary, "cheese", 1), false);
  assert.equal(depositResource(granary, "cheese", 1), 0);
  assert.equal(expandStorage(granary), true);
  assert.equal(granary.capacitySlots, 125);
  assert.equal(storageFreeSlots(granary), 25);
  assert.equal(depositResource(granary, "cheese", 1), 1);
});

test("liczba typów żywności i miesięczna konsumpcja są wyliczane ze Spichlerza", () => {
  const logistics = createInitialLogistics();
  const granary = storage(logistics, "storehouse");
  depositResource(granary, "bread", 8);
  depositResource(granary, "cheese", 5);
  depositResource(granary, "meat", 3);
  assert.equal(getFoodTypes(logistics), 4);
  assert.equal(getFoodTotal(logistics), 876);
  assert.equal(consumeFood(logistics, 10), 10);
  assert.equal(granary.inventory.bread, undefined);
  assert.equal(granary.inventory.cheese, 3);
  assert.equal(granary.inventory.meat, 3);
  assert.equal(granary.inventory.apples, 860);
  assert.equal(getFoodTotal(logistics), 866);
});

test("ręczny handel kupuje i sprzedaje partie po 1 lub 5 po stałej cenie", () => {
  const logistics = createInitialLogistics();
  const before = totalResource(createSimulation(), "wood");
  assert.equal(before, 340);
  const bought = tradeAtMarket(logistics, 1000, "apples", 5, "buy");
  assert.equal(bought.ok, true);
  assert.equal(bought.gold, 960);
  assert.equal(storage(logistics, "storehouse").inventory.apples, 865);
  const sold = tradeAtMarket(logistics, bought.gold, "apples", 5, "sell");
  assert.equal(sold.ok, true);
  assert.equal(sold.gold, 980);
  assert.equal(storage(logistics, "storehouse").inventory.apples, 860);
  const invalidPack = tradeAtMarket(logistics, 1000, "apples", 2, "buy");
  assert.equal(invalidPack.ok, false);
  assert.equal(invalidPack.gold, 1000);
});

test("handel blokuje zakup przy pełnym magazynie i nie traci części towaru przy nieudanej sprzedaży", () => {
  const logistics = createInitialLogistics();
  const granary = storage(logistics, "storehouse");
  depositResource(granary, "apples", 140);
  assert.equal(storageFreeSlots(granary), 0);
  const blockedBuy = tradeAtMarket(logistics, 1000, "apples", 5, "buy");
  assert.equal(blockedBuy.ok, false);
  assert.equal(blockedBuy.gold, 1000);
  const smallStock = createInitialLogistics();
  const smallGranary = storage(smallStock, "storehouse");
  smallGranary.inventory.apples = 3;
  const before = getFoodTotal(smallStock);
  const failedSell = tradeAtMarket(smallStock, 500, "apples", 5, "sell");
  assert.equal(failedSell.ok, false);
  assert.equal(failedSell.gold, 500);
  assert.equal(getFoodTotal(smallStock), before);
  assert.equal(smallGranary.inventory.apples, 3);
});

test("wczytanie magazynów odrzuca stan przekraczający fizyczną pojemność", () => {
  const fallback = createInitialLogistics();
  const valid = normalizeLogistics(fallback, fallback);
  assert.equal(storage(valid, "stockpile").inventory.wood, 340);
  const invalid = structuredClone(fallback);
  invalid.storages.find((entry) => entry.id === "storehouse").inventory.apples = 1010;
  assert.throws(() => normalizeLogistics(invalid, fallback), /capacity/i);
});

test("łańcuchy produkcji mają przypisane wejścia, wyjścia i właściwe magazyny", () => {
  assert.deepEqual(PRODUCTION_RECIPES.mill.input, { resource: "wheat", amount: 1 });
  assert.deepEqual(PRODUCTION_RECIPES.mill.output, { resource: "flour", amount: 1, storage: "stockpile" });
  assert.deepEqual(PRODUCTION_RECIPES.bakery.output, { resource: "bread", amount: 8, storage: "granary" });
  assert.deepEqual(PRODUCTION_RECIPES.brewery.input, { resource: "hops", amount: 1 });
  assert.equal(PRODUCTION_RECIPES.quarry.requiresOx, true);
  assert.deepEqual(PRODUCTION_RECIPES["dairy-farm"].byproduct, { resource: "cows", amount: 1, everyCycles: 3 });
});

test("młyn czeka bez pszenicy, pobiera ją fizycznie i nie produkuje mąki przed dostawą", () => {
  const state = createSimulation();
  const mill = state.worksites.find((site) => site.id === "mill");
  assert.ok(mill);
  for (const id of mill.workerIds) state.villagers.find((villager) => villager.id === id).status = "working";
  advanceProduction(state, 1);
  assert.match(mill.waitingReason, /pszenica/i);
  assert.equal(totalResource(state, "wheat"), 0);
  assert.equal(depositStoredResource(state, "stockpile", "wheat", 1), 1);
  advanceProduction(state, 1);
  const carrier = state.villagers.find((villager) => villager.id === mill.workerIds[0]);
  assert.equal(carrier.status, "fetching-input");
  assert.equal(carrier.cargo, undefined, "wheat stays in the Stockpile until the carrier reaches it");
  assert.equal(totalResource(state, "wheat"), 1);
  assert.equal(carrier.returnWorksiteId, "mill");
  assert.equal(pickupProductionInput(state, carrier.id), true);
  assert.equal(carrier.status, "returning-to-work");
  assert.deepEqual(carrier.cargo, [{ resource: "wheat", amount: 1 }]);
  assert.equal(totalResource(state, "wheat"), 0);
  assert.equal(completeProductionInputDelivery(state, carrier.id), true);
  assert.equal(carrier.status, "working");
  assert.deepEqual(mill.inputBuffer, { wheat: 1 });
  advanceProduction(state, 16);
  assert.equal(mill.inputBuffer.wheat, undefined);
  assert.equal(carrier.status, "hauling-output");
  assert.deepEqual(carrier.cargo, [{ resource: "flour", amount: 1 }]);
  assert.equal(carrier.targetStorageId, "stockpile");
  assert.equal(totalResource(state, "flour"), 0);
});

test("kamieniołom czeka na wół, a po jego uruchomieniu to pracownik uwiązu niesie bloki", () => {
  const state = createSimulation();
  addWorksite(state, { id: "quarry-1", kind: "production", requiredWorkers: 3, workerIds: [], x: 1200, y: 1200, productionType: "quarry", productionProgress: 0 });
  const quarry = state.worksites.find((site) => site.id === "quarry-1");
  for (const id of quarry.workerIds) state.villagers.find((villager) => villager.id === id).status = "working";
  advanceProduction(state, 34);
  assert.match(quarry.waitingReason, /wołu/i);
  addWorksite(state, { id: "ox-tether-1", kind: "production", requiredWorkers: 1, workerIds: [], x: 1220, y: 1200, oxTetherFor: quarry.id });
  const tether = state.worksites.find((site) => site.id === "ox-tether-1");
  for (const id of tether.workerIds) state.villagers.find((villager) => villager.id === id).status = "working";
  advanceProduction(state, 34);
  const ox = state.villagers.find((villager) => villager.id === tether.workerIds[0]);
  assert.equal(ox.status, "hauling-output");
  assert.deepEqual(ox.cargo, [{ resource: "stone", amount: 8 }]);
  assert.equal(ox.returnWorksiteId, quarry.id);
});

test("farma mleczna dostarcza ser i bydło, które może zużyć Garbarz", () => {
  const state = createSimulation();
  addWorksite(state, { id: "dairy-1", kind: "production", requiredWorkers: 1, workerIds: [], x: 1027, y: 1368, productionType: "dairy-farm", productionProgress: 0 });
  const dairy = state.worksites.find((site) => site.id === "dairy-1");
  const worker = state.villagers.find((villager) => villager.id === dairy.workerIds[0]);
  worker.status = "working";
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    advanceProduction(state, 26);
    if (cycle < 3) {
      worker.status = "working";
      worker.cargo = undefined;
      worker.logisticsTask = undefined;
      worker.targetStorageId = undefined;
      worker.returnWorksiteId = undefined;
    }
  }
  assert.ok(worker.cargo.some((item) => item.resource === "cheese"));
  assert.ok(worker.cargo.some((item) => item.resource === "cows"));
  assert.equal(worker.targetStorageId, "storehouse");
  assert.ok(totalResource(state, "cows") === 0, "by-product is not counted until physically delivered");
});

test("towary trafiają do magazynu dopiero po fizycznej dostawie", () => {
  const state = createSimulation();
  assert.equal(storeResource(state, "stockpile", "flour", 2), 2);
  assert.equal(totalResource(state, "flour"), 2);
  assert.equal(storeResource(state, "storehouse", "flour", 2), 0);
});


test("wszystkie punkty jeleni stoją na przechodnim lesie i mają miejsce dla chaty myśliwego w zasięgu", () => {
  const grid = createWorldGrid();
  const buildable = grid.tiles.filter((tile) => tile.walkable && tile.buildable)
    .map((tile) => worldPositionForCell(grid, tile.col, tile.row)).filter(Boolean);
  assert.equal(HUNTING_NODES.length, 4);
  for (const node of HUNTING_NODES) {
    const tile = worldToCell(grid, node);
    assert.equal(tile?.terrain, "forest");
    assert.equal(tile?.walkable, true);
    const nearest = Math.min(...buildable.map((point) => Math.hypot(point.x - node.x, point.y - node.y)));
    assert.ok(nearest <= PRODUCTION_RECIPES.hunter.sourceRange);
  }
});


test("częściowy odbiór wejścia zwraca pozostałość na półkę i nie zostawia zablokowanego kuriera", () => {
  const state = createSimulation();
  const mill = state.worksites.find((site) => site.id === "mill");
  for (const id of mill.workerIds) state.villagers.find((villager) => villager.id === id).status = "working";
  depositStoredResource(state, "stockpile", "wheat", 1);
  advanceProduction(state, 1);
  const carrier = state.villagers.find((villager) => villager.id === mill.workerIds[0]);
  assert.equal(carrier.status, "fetching-input");
  // Another task removes half the stack before the courier arrives.
  withdrawResource(storage(state.logistics, "stockpile"), "wheat", 0.5);
  assert.equal(pickupProductionInput(state, carrier.id), false);
  assert.equal(totalResource(state, "wheat"), 0.5);
  assert.equal(carrier.status, "working");
  assert.equal(carrier.cargo, undefined);
  assert.equal(carrier.targetStorageId, undefined);
  assert.equal(carrier.returnWorksiteId, undefined);
});

test("pełny magazyn zatrzymuje gotowy produkt do czasu zwolnienia albo rozbudowy pól", () => {
  const state = createSimulation();
  const mill = state.worksites.find((site) => site.id === "mill");
  const stockpile = storage(state.logistics, "stockpile");
  for (const id of mill.workerIds) state.villagers.find((villager) => villager.id === id).status = "working";
  depositResource(stockpile, "iron", 450);
  assert.equal(storageFreeSlots(stockpile), 0);
  mill.inputBuffer = { wheat: 1 };
  advanceProduction(state, 16);
  assert.deepEqual(mill.pendingOutputs, [{ resource: "flour", amount: 1 }]);
  assert.equal(state.villagers.find((villager) => villager.id === mill.workerIds[0]).cargo, undefined);
  expandStorage(stockpile, 25);
  advanceProduction(state, 1);
  const courier = state.villagers.find((villager) => villager.id === mill.workerIds[0]);
  assert.equal(mill.pendingOutputs, undefined);
  assert.equal(courier.status, "hauling-output");
  assert.deepEqual(courier.cargo, [{ resource: "flour", amount: 1 }]);
});
