import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, settleMonth, advanceSimulation, setGameSpeed } from '../src/engine/simulation.ts';

test('miesięczne zużycie żywności odpowiada tabeli racji', () => {
  const expected = [[0, 0], [0.5, 0.8], [1, 1.6], [1.5, 2.56], [2, 3.2]];
  for (const [ration, consumed] of expected) {
    const state = createSimulation();
    state.population = 8;
    state.housing = 8;
    state.unemployed = 8;
    state.ration = ration;
    const report = settleMonth(state);
    assert.ok(Math.abs(report.foodConsumed - consumed) < 1e-9, `ration ${ration}`);
  }
});

test('pusty spichlerz lub niedobór obniża popularność racjami do -8', () => {
  const empty = createSimulation(); empty.food = 0;
  assert.equal(settleMonth(empty).popularityChange, -7); // -8 racje +1 brak podatków
  const shortage = createSimulation(); shortage.food = 0.1;
  assert.equal(settleMonth(shortage).popularityChange, -7);
});

test('różnorodność żywności działa tylko przy dodatnich racjach', () => {
  const state = createSimulation(); state.foodTypes = 4;
  assert.equal(settleMonth(state).popularityChange, 4); // +3 variety, +1 no tax
  const none = createSimulation(); none.foodTypes = 4; none.ration = 0;
  assert.equal(settleMonth(none).popularityChange, -7);
});

test('podatek nalicza złoto i właściwy modyfikator popularności', () => {
  const state = createSimulation(); state.tax = 'low';
  const report = settleMonth(state);
  assert.equal(report.taxes, 4.8);
  assert.equal(state.gold, 1244.8);
  assert.equal(report.popularityChange, -2);
});

test('łapówka bez zdefiniowanego kosztu nie daje bonusu', () => {
  const state = createSimulation(); state.tax = 'bribe-generous';
  const report = settleMonth(state);
  assert.equal(report.popularityChange, 0);
  assert.equal(report.bribeCost, 0);
  assert.equal(state.gold, 1240);
  assert.match(report.messages.join(' '), /Koszt łapówki nie jest określony/);
});

test('opłacona łapówka wymaga wystarczającego złota', () => {
  const state = createSimulation(); state.tax = 'bribe-small'; state.bribeCostPerVillager = 0.5;
  const report = settleMonth(state);
  assert.equal(report.bribeCost, 4);
  assert.equal(report.popularityChange, 3);
  assert.equal(state.gold, 1236);
  const poor = createSimulation(); poor.tax = 'bribe-small'; poor.bribeCostPerVillager = 999;
  assert.equal(settleMonth(poor).popularityChange, 0);
});

test('gospoda zużywa 0.144 beczki na miesiąc i skaluje bonus pokryciem', () => {
  const state = createSimulation(); state.taverns = 1; state.beerBarrels = 1;
  const report = settleMonth(state);
  assert.equal(report.popularityChange, 9); // +8 beer, +1 no tax
  assert.ok(Math.abs(state.beerBarrels - 0.856) < 1e-9);
  assert.equal(settleMonth(state).popularityChange, 9);
});

test('popularność jest ograniczona do 0–100, a populacja rośnie lub maleje warunkowo', () => {
  const high = createSimulation(); high.popularity = 100; high.ration = 2;
  const highReport = settleMonth(high);
  assert.equal(high.popularity, 100);
  assert.equal(highReport.spawnedVillagers, 0); // housing is full
  const low = createSimulation(); low.popularity = 10;
  const lowReport = settleMonth(low);
  assert.equal(lowReport.leftVillagers, 1);
  assert.equal(low.population, 7);
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
