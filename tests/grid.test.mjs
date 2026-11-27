import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorldGrid,
  findGridPath,
  isBuildableAtWorld,
  isWalkableAtWorld,
  rotateOffset,
  tileAt,
  worldPositionForCell,
  worldToCell
} from '../src/engine/grid.ts';

test('siatka jest izometryczna, ma stały rozmiar i mapuje komórki na świat', () => {
  const grid = createWorldGrid();
  assert.equal(grid.columns, 100);
  assert.equal(grid.rows, 100);
  assert.equal(grid.tiles.length, 10000);
  for (const [col, row] of [[0, 41], [40, 0], [58, 99], [98, 58], [37, 45]]) {
    const world = worldPositionForCell(grid, col, row);
    assert.ok(world);
    const cell = worldToCell(grid, world);
    assert.equal(cell?.col, col);
    assert.equal(cell?.row, row);
  }
});

test('świat ma fizyczne typy terenu, zróżnicowaną wysokość i pola nieprzechodnie', () => {
  const grid = createWorldGrid();
  const terrain = new Set(grid.tiles.map((tile) => tile.terrain));
  assert.ok(terrain.has('sand'));
  assert.ok(terrain.has('oasis'));
  assert.ok(terrain.has('forest'));
  assert.ok(terrain.has('water'));
  assert.ok(terrain.has('cliff'));
  assert.ok(terrain.has('stone'));
  assert.ok(terrain.has('iron'));
  assert.ok(terrain.has('tar'));
  assert.ok(grid.tiles.some((tile) => tile.elevation > 1));
  assert.ok(grid.tiles.some((tile) => tile.terrain === 'water' && !tile.walkable));
  assert.ok(grid.tiles.some((tile) => tile.terrain === 'forest' && !tile.walkable));
  assert.ok(grid.tiles.some((tile) => tile.terrain === 'cliff' && !tile.buildable));
});

test('woda i klify blokują ruch, a oaza dopuszcza budowanie', () => {
  const grid = createWorldGrid();
  const water = grid.tiles.find((tile) => tile.terrain === 'water');
  const cliff = grid.tiles.find((tile) => tile.terrain === 'cliff');
  const oasis = grid.tiles.find((tile) => tile.terrain === 'oasis');
  assert.ok(water && cliff && oasis);
  const waterPoint = worldPositionForCell(grid, water.col, water.row);
  const cliffPoint = worldPositionForCell(grid, cliff.col, cliff.row);
  const oasisPoint = worldPositionForCell(grid, oasis.col, oasis.row);
  assert.ok(waterPoint && cliffPoint && oasisPoint);
  assert.equal(isWalkableAtWorld(grid, waterPoint), false);
  assert.equal(isWalkableAtWorld(grid, cliffPoint), false);
  assert.equal(isBuildableAtWorld(grid, oasisPoint), true);
});

test('wyznaczanie trasy omija pola nieprzechodnie', () => {
  const grid = createWorldGrid();
  const route = findGridPath(grid, { x: 1090, y: 660 }, { x: 2380, y: 900 });
  assert.ok(route);
  assert.ok(route.length > 0);
  for (const point of route) assert.equal(isWalkableAtWorld(grid, point), true);
});

test('cztery obroty po 90 stopni wracają do punktu wyjścia', () => {
  const point = { x: 123, y: -456 };
  let rotated = point;
  for (let turn = 0; turn < 4; turn += 1) rotated = rotateOffset(rotated, 1);
  assert.ok(Math.abs(rotated.x - point.x) < 1e-9);
  assert.ok(Math.abs(rotated.y - point.y) < 1e-9);
  assert.deepEqual(rotateOffset(point, 2), { x: -123, y: 456 });
});
