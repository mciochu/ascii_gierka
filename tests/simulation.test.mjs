import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSimulation, settleMonth, advanceSimulation, setGameSpeed, advancePopulation,
  addWorksite, assignAvailableWorkers, recruitFromCampfire, setHovelCapacity, setWorksiteEnabled, removeWorksite,
  calculateFearFactor, getFearWorkMultiplier, getFearDamageMultiplier,
  getPopularityModifiers, updateBlessedShare, depositStoredResource
} from '../src/engine/simulation.ts';
import { createWorldGrid, isWalkableAtWorld, findGridPath } from '../src/engine/grid.ts';

function addIdleVillagers(state, count) {
  for (let index = 0; index < count; index += 1) {
    state.villagers.push({
      id: 'test-villager-' + index,
      x: 1228 + index * 3, y: 1015,
      status: 'idle', role: 'laborer', movementQueue: [], blessedUntil: 0
    });
  }
}

test('ognisko i młyn są połączone przechodnią trasą dla cywilów', () => {
  const grid = createWorldGrid();
  assert.equal(isWalkableAtWorld(grid, { x: 1228, y: 1015 }), true);
  assert.ok(findGridPath(grid, { x: 1228, y: 1015 }, { x: 1455, y: 1100 }));
});

test('miesięczne zużycie żywności odpowiada tabeli racji wyłącznie dla mieszkańców', () => {
  const expected = [[0, 0], [0.5, 0.8], [1, 1.6], [1.5, 2.56], [2, 3.2]];
  for (const [ration, consumed] of expected) {
    const state = createSimulation();
    state.ration = ration;
    const report = settleMonth(state);
    assert.ok(Math.abs(report.foodConsumed - consumed) < 1e-9, 'ration ' + ration);
    assert.equal(state.population, 8);
  }
});

test('pusty spichlerz lub niedobór obniża popularność racjami do -8', () => {
  const empty = createSimulation();
  empty.logistics.storages.find((storage) => storage.type === 'granary').inventory = {};
  assert.equal(settleMonth(empty).modifiers.ration, -8);
  const shortage = createSimulation();
  shortage.logistics.storages.find((storage) => storage.type === 'granary').inventory.apples = 0.1;
  assert.equal(settleMonth(shortage).modifiers.ration, -8);
});

test('różnorodność żywności działa tylko przy dodatnich racjach', () => {
  const state = createSimulation();
  const granary = state.logistics.storages.find((storage) => storage.type === 'granary');
  granary.inventory.cheese = 10; granary.inventory.meat = 10; granary.inventory.bread = 10;
  assert.equal(settleMonth(state).modifiers.variety, 3);
  const none = createSimulation();
  const emptyRationGranary = none.logistics.storages.find((storage) => storage.type === 'granary');
  emptyRationGranary.inventory.cheese = 10; emptyRationGranary.inventory.meat = 10; emptyRationGranary.inventory.bread = 10;
  none.ration = 0;
  assert.equal(settleMonth(none).modifiers.variety, 0);
});

test('podatek nalicza złoto i właściwy modyfikator popularności od chłopów', () => {
  const state = createSimulation(); state.tax = 'low';
  const report = settleMonth(state);
  assert.equal(report.taxes, 4.8);
  assert.equal(state.gold, 1244.8);
  assert.equal(report.modifiers.tax, -2);
});

test('łapówka bez zdefiniowanego kosztu nie daje bonusu', () => {
  const state = createSimulation(); state.tax = 'bribe-generous';
  const report = settleMonth(state);
  assert.equal(report.modifiers.tax, 0);
  assert.equal(report.bribeCost, 0);
  assert.equal(state.gold, 1240);
  assert.match(report.messages.join(' '), /Koszt łapówki nie jest określony/);
});

test('opłacona łapówka wymaga wystarczającego złota', () => {
  const state = createSimulation(); state.tax = 'bribe-small'; state.bribeCostPerVillager = 0.5;
  const report = settleMonth(state);
  assert.equal(report.bribeCost, 4);
  assert.equal(report.modifiers.tax, 3);
  assert.equal(state.gold, 1236);
  const poor = createSimulation(); poor.tax = 'bribe-small'; poor.bribeCostPerVillager = 999;
  assert.equal(settleMonth(poor).modifiers.tax, 0);
});

test('gospoda daje bonus tylko po obsadzeniu karczmarzem i zużywa 0.144 beczki', () => {
  const state = createSimulation();
  state.worksites.push({ id: 'inn-1', kind: 'inn', requiredWorkers: 1, workerIds: [], x: 1400, y: 1000 });
  assignAvailableWorkers(state);
  const innKeeper = state.villagers.find((villager) => villager.worksiteId === 'inn-1');
  innKeeper.status = 'working';
  depositStoredResource(state, 'stockpile', 'beer', 1);
  const report = settleMonth(state);
  assert.equal(report.modifiers.beer, 8);
  assert.ok(Math.abs(state.beerBarrels - 0.856) < 1e-9);
  const unstaffed = createSimulation();
  unstaffed.worksites.push({ id: 'inn-1', kind: 'inn', requiredWorkers: 1, workerIds: [], x: 1400, y: 1000 });
  depositStoredResource(unstaffed, 'stockpile', 'beer', 1);
  assert.equal(settleMonth(unstaffed).modifiers.beer, 0);
});

test('pasywny bonus religii nie kumuluje kolejnych budynków tego samego typu', () => {
  const state = createSimulation();
  for (const [id, buildingType, x] of [
    ['church-1', 'church', 1300], ['church-2', 'church', 1320],
    ['cathedral-3', 'cathedral', 1340], ['chapel-4', 'chapel', 1360]
  ]) {
    state.worksites.push({ id, kind: 'religion', buildingType, requiredWorkers: 1, workerIds: [], x, y: 1000 });
  }
  assignAvailableWorkers(state);
  state.blessedShare = 0.5;
  const modifiers = getPopularityModifiers(state);
  assert.equal(modifiers.religionPassive, 3);
  assert.equal(modifiers.blessings, 4);
});

test('błogosławieństwa wygasają i dynamiczny bonus zależy od pokrycia', () => {
  const state = createSimulation();
  state.villagers[0].blessedUntil = 5;
  state.elapsedSeconds = 0;
  assert.equal(updateBlessedShare(state), 1 / 8);
  state.elapsedSeconds = 6;
  assert.equal(updateBlessedShare(state), 0);
});

test('chata dodaje dokładnie osiem miejsc mieszkalnych', () => {
  const state = createSimulation();
  setHovelCapacity(state, 1);
  assert.equal(state.housing, 16);
  setHovelCapacity(state, -1);
  assert.equal(state.housing, 8);
  setHovelCapacity(state, -3);
  assert.equal(state.housing, 8);
});

test('nowy chłop pojawia się przy ognisku szybciej przy wyższej popularności', () => {
  const high = createSimulation();
  high.popularity = 100;
  setHovelCapacity(high, 1);
  assert.equal(advancePopulation(high, 30), 1);
  assert.equal(high.population, 9);
  assert.equal(high.unemployed, 6);
  const medium = createSimulation();
  medium.popularity = 50;
  setHovelCapacity(medium, 1);
  assert.equal(advancePopulation(medium, 30), 0);
  assert.equal(advancePopulation(medium, 30), 1);
});

test('przyrost blokuje brak mieszkań albo 24 bezrobotnych przy ognisku', () => {
  const full = createSimulation();
  full.popularity = 100;
  assert.equal(advancePopulation(full, 120), 0);
  const crowdedFire = createSimulation();
  crowdedFire.popularity = 100;
  setHovelCapacity(crowdedFire, 4);
  addIdleVillagers(crowdedFire, 19);
  crowdedFire.unemployed = 24;
  assert.equal(advancePopulation(crowdedFire, 120), 0);
  assert.equal(crowdedFire.population, 27);
});

test('bezrobotni automatycznie obsadzają pierwsze wolne miejsce pracy', () => {
  const state = createSimulation();
  assert.equal(state.population, 8);
  assert.equal(state.worksites[0].workerIds.length, 3);
  assert.equal(state.unemployed, 5);
  addWorksite(state, { id: 'chapel-1', kind: 'religion', buildingType: 'chapel', requiredWorkers: 1, workerIds: [], x: 1340, y: 1000 });
  assert.equal(state.worksites[1].workerIds.length, 1);
  const priest = state.villagers.find((villager) => villager.worksiteId === 'chapel-1');
  assert.equal(priest.role, 'priest');
  assert.equal(priest.status, 'walking-to-work');
  assert.equal(state.unemployed, 4);
});

test('wstrzymanie miejsca pracy zwalnia pracowników, a wznowienie obsadza je ponownie', () => {
  const state = createSimulation();
  const mill = state.worksites[0];
  assert.equal(mill.workerIds.length, 3);
  assert.equal(mill.enabled, true);
  assert.equal(setWorksiteEnabled(state, 'mill', false), true);
  assert.equal(mill.enabled, false);
  assert.equal(mill.workerIds.length, 0);
  assert.equal(state.villagers.filter((villager) => villager.status === 'returning-to-campfire').length, 3);
  assert.equal(state.unemployed, 5); // workers count as idle only after reaching the campfire
  assert.equal(assignAvailableWorkers(state), 0); // disabled buildings cannot take workers
  assert.equal(setWorksiteEnabled(state, 'mill', false), false);
  assert.equal(setWorksiteEnabled(state, 'mill', true), true);
  assert.equal(mill.workerIds.length, 3);
  assert.equal(state.villagers.filter((villager) => villager.worksiteId === 'mill').length, 3);
  assert.equal(state.villagers.filter((villager) => villager.status === 'returning-to-campfire').length, 3);
});

test('zburzenie miejsca pracy zwalnia przypisanych mieszkańców do powrotu przy ognisku', () => {
  const state = createSimulation();
  assert.equal(removeWorksite(state, 'mill'), undefined);
  assert.equal(state.worksites.length, 0);
  assert.equal(state.villagers.filter((villager) => villager.status === 'returning-to-campfire').length, 3);
  assert.equal(state.villagers.filter((villager) => villager.worksiteId === undefined && villager.status === 'returning-to-campfire').length, 3);
  assert.equal(state.unemployed, 5);
});

test('rekrutacja zużywa jednego bezrobotnego, ale nie zmienia pojemności chat', () => {
  const state = createSimulation();
  assert.equal(recruitFromCampfire(state), true);
  assert.equal(state.population, 7);
  assert.equal(state.unemployed, 4);
  assert.equal(state.housing, 8);
  assert.equal(recruitFromCampfire(state), true);
  assert.equal(recruitFromCampfire(state), true);
  assert.equal(recruitFromCampfire(state), true);
  assert.equal(recruitFromCampfire(state), true);
  assert.equal(recruitFromCampfire(state), false);
  assert.equal(state.unemployed, 0);
});

test('poniżej popularności 50 mieszkańcy odchodzą, zaczynając od pracowników produkcji', () => {
  const state = createSimulation();
  state.ration = 0;
  state.tax = 'cruel';
  state.popularity = 10;
  const report = settleMonth(state);
  assert.equal(report.leftVillagers, 1);
  assert.equal(state.population, 8); // liczy się do opuszczenia mapy
  assert.equal(state.worksites[0].workerIds.length, 2);
  assert.ok(state.villagers.some((villager) => villager.status === 'leaving'));
  advancePopulation(state, 61); // zabezpieczenie usuwa z mapy po czasie maksymalnym
  assert.equal(state.population, 7);
});

test('usunięcie mieszkańca po dotarciu do krawędzi natychmiast synchronizuje populację i bezrobotnych', () => {
  const state = createSimulation();
  const leaving = state.villagers[3]; // an unemployed resident who has reached the edge
  leaving.status = 'leaving';
  leaving.departed = true;
  leaving.departureStartedAt = 0;
  state.elapsedSeconds = 10;
  assert.equal(state.population, 8);
  advancePopulation(state, 0);
  assert.equal(state.population, 7);
  assert.equal(state.unemployed, 4);
  assert.equal(state.worksites[0].workerIds.length, 3);
});

test('Dobre i Złe Rzeczy znoszą się, a strach skaluje się z populacją do +/-5', () => {
  const good = Array.from({ length: 2 }, (_, index) => ({ id: 'g' + index, kind: 'good', x: index, y: 0 }));
  const bad = [{ id: 'b1', kind: 'bad', x: 0, y: 0 }];
  assert.equal(calculateFearFactor(good, 30), 1);
  assert.equal(calculateFearFactor([...good, ...bad], 30), 0);
  assert.equal(calculateFearFactor(Array.from({ length: 20 }, (_, i) => ({ id: 'g' + i, kind: 'good', x: i, y: 0 })), 8), 5);
  assert.equal(calculateFearFactor(Array.from({ length: 20 }, (_, i) => ({ id: 'b' + i, kind: 'bad', x: i, y: 0 })), 8), -5);
});

test('strach dodatni obniża wydajność pracy i zwiększa obrażenia, ujemny działa odwrotnie', () => {
  assert.equal(getFearWorkMultiplier(5), 0.5);
  assert.equal(getFearWorkMultiplier(-5), 1.5);
  assert.equal(getFearDamageMultiplier(5), 1.25);
  assert.equal(getFearDamageMultiplier(-5), 0.75);
});

test('popularność pozostaje ograniczona do 0–100', () => {
  const high = createSimulation(); high.popularity = 100; high.ration = 2;
  settleMonth(high);
  assert.equal(high.popularity, 100);
  const low = createSimulation(); low.popularity = 1; low.ration = 0; low.tax = 'cruel';
  settleMonth(low);
  assert.equal(low.popularity, 0);
});

test('prędkość jest ograniczona do 20–90, a miesiąc nalicza się po 30 sekundach przy prędkości 40', () => {
  const state = createSimulation();
  assert.equal(setGameSpeed(state, 1), 20);
  assert.equal(setGameSpeed(state, 100), 90);
  setGameSpeed(state, 40);
  assert.equal(advanceSimulation(state, 29).length, 0);
  assert.equal(advanceSimulation(state, 1).length, 1);
  assert.equal(state.month, 2);
});

test("historia księgi raportów przechowuje maksymalnie 12 rzeczywistych rozliczeń", () => {
  const state = createSimulation();
  setGameSpeed(state, 40);
  for (let month = 0; month < 15; month += 1) {
    advanceSimulation(state, 30);
  }
  assert.equal(state.month, 16);
  assert.equal(state.monthlyHistory.length, 12);
  assert.equal(state.monthlyHistory[0].month, 5);
  assert.equal(state.monthlyHistory.at(-1).month, 16);
  for (const entry of state.monthlyHistory) {
    assert.ok(Number.isFinite(entry.foodConsumed));
    assert.ok(Number.isFinite(entry.popularityChange));
    assert.ok(Array.isArray(entry.messages));
  }
});

test("nowy zapis symulacji rozpoczyna pustą historię miesięczną", () => {
  const state = createSimulation();
  assert.deepEqual(state.monthlyHistory, []);
});
