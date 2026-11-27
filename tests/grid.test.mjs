import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorldGrid,
  findGridPath,
  GRID_PIVOT,
  isBuildableAtWorld,
  isWorldPointInViewport,
  isWalkableAtWorld,
  rotateOffset,
  tileAt,
  worldPositionForCell,
  worldToCell,
  viewportToWorld,
  worldToViewport
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

test('wszystkie 10 000 pól mieszczą się w mapie i mają dokładne mapowanie w obie strony', () => {
  const grid = createWorldGrid();
  for (const tile of grid.tiles) {
    const point = worldPositionForCell(grid, tile.col, tile.row);
    assert.ok(point);
    assert.ok(point.x >= 0 && point.x <= 2600, 'x poza mapą: ' + tile.col + ',' + tile.row);
    assert.ok(point.y >= 0 && point.y <= 1850, 'y poza mapą: ' + tile.col + ',' + tile.row);
    const resolved = worldToCell(grid, point);
    assert.equal(resolved?.col, tile.col, 'kolumna ' + tile.col + ',' + tile.row);
    assert.equal(resolved?.row, tile.row, 'wiersz ' + tile.col + ',' + tile.row);
  }
  assert.equal(worldToCell(grid, { x: 0, y: 0 }), null);
  assert.equal(worldToCell(grid, { x: 2590, y: 1820 }), null);
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
  assert.ok(grid.tiles.some((tile) => tile.terrain === 'forest' && tile.walkable && !tile.buildable));
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

test('wszystkie początkowe budynki i oddziały leżą na przechodnich polach', () => {
  const grid = createWorldGrid();
  const starts = [
    ['keep', { x: 1190, y: 915 }],
    ['barracks', { x: 930, y: 760 }],
    ['mill', { x: 1455, y: 1100 }],
    ['storehouse', { x: 875, y: 1100 }],
    ['guard', { x: 1090, y: 660 }],
    ['archers', { x: 1515, y: 825 }],
    ['riders', { x: 775, y: 1300 }],
    ['raiders', { x: 2150, y: 1050 }]
  ];
  for (const [name, point] of starts) {
    assert.equal(isWalkableAtWorld(grid, point), true, name);
  }
});

test('każde pole przechodnie należy do tej samej sieci dróg', () => {
  const grid = createWorldGrid();
  const walkableCount = grid.tiles.filter((tile) => tile.walkable).length;
  const first = grid.tiles.find((tile) => tile.walkable);
  assert.ok(first);
  const queue = [first];
  const visited = new Set([first.row * grid.columns + first.col]);
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [dc, dr] of directions) {
      const col = current.col + dc;
      const row = current.row + dr;
      const next = tileAt(grid, col, row);
      if (!next?.walkable) continue;
      if (dc !== 0 && dr !== 0) {
        if (!tileAt(grid, current.col + dc, current.row)?.walkable ||
            !tileAt(grid, current.col, current.row + dr)?.walkable) continue;
      }
      const key = row * grid.columns + col;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  assert.equal(visited.size, walkableCount);
});

test('zabudowa jest blokowana na lesie, wodzie, klifach i złożach', () => {
  const grid = createWorldGrid();
  for (const type of ['forest', 'water', 'cliff', 'stone', 'iron', 'tar']) {
    const tile = grid.tiles.find((candidate) => candidate.terrain === type);
    assert.ok(tile);
    const point = worldPositionForCell(grid, tile.col, tile.row);
    assert.ok(point);
    assert.equal(isBuildableAtWorld(grid, point), false, type);
  }
  const sand = grid.tiles.find((tile) => tile.terrain === 'sand');
  const oasis = grid.tiles.find((tile) => tile.terrain === 'oasis');
  assert.ok(sand && oasis);
  assert.equal(isBuildableAtWorld(grid, worldPositionForCell(grid, sand.col, sand.row)), true);
  assert.equal(isBuildableAtWorld(grid, worldPositionForCell(grid, oasis.col, oasis.row)), true);
});

test('wyznaczanie trasy omija pola nieprzechodnie', () => {
  const grid = createWorldGrid();
  const route = findGridPath(grid, { x: 1090, y: 660 }, { x: 2380, y: 900 });
  assert.ok(route);
  assert.ok(route.length > 0);
  for (const point of route) assert.equal(isWalkableAtWorld(grid, point), true);
});

test('wyznaczanie trasy nie przecina narożników dwóch zablokowanych pól', () => {
  const grid = createWorldGrid();
  grid.tiles = grid.tiles.map((tile) => ({ ...tile, walkable: false, buildable: false }));
  const start = tileAt(grid, 50, 50);
  const target = tileAt(grid, 51, 51);
  const sideA = tileAt(grid, 51, 50);
  const sideB = tileAt(grid, 50, 51);
  assert.ok(start && target && sideA && sideB);
  start.walkable = true;
  target.walkable = true;
  const startPoint = worldPositionForCell(grid, start.col, start.row);
  const targetPoint = worldPositionForCell(grid, target.col, target.row);
  assert.ok(startPoint && targetPoint);
  assert.equal(findGridPath(grid, startPoint, targetPoint), null);
  sideA.walkable = true;
  sideB.walkable = true;
  assert.ok(findGridPath(grid, startPoint, targetPoint));
});

test('kamera zachowuje odwrotne mapowanie współrzędnych we wszystkich czterech obrotach', () => {
  const pivot = GRID_PIVOT;
  const position = { x: 640, y: 360 };
  const points = [
    { x: 1287, y: 891 },
    { x: 1090, y: 660 },
    { x: 1515, y: 825 },
    { x: 2200, y: 1200 }
  ];
  for (let quarterTurns = 0; quarterTurns < 4; quarterTurns += 1) {
    const camera = { position, pivot, zoom: 0.62, quarterTurns };
    for (const point of points) {
      const viewport = worldToViewport(point, camera);
      const restored = viewportToWorld(viewport, camera);
      assert.ok(Math.abs(restored.x - point.x) < 1e-9);
      assert.ok(Math.abs(restored.y - point.y) < 1e-9);
    }
  }
});

test('obszary lasu, oazy i złóż mają osiągalne pola z centrum mapy', () => {
  const grid = createWorldGrid();
  for (const type of ['forest', 'oasis', 'iron', 'stone', 'tar']) {
    const tile = grid.tiles.find((candidate) => candidate.terrain === type);
    assert.ok(tile, 'brak terenu: ' + type);
    const point = worldPositionForCell(grid, tile.col, tile.row);
    assert.ok(point);
    const route = findGridPath(grid, { x: 1190, y: 915 }, point);
    assert.ok(route, 'teren poza zasięgiem trasy: ' + type);
  }
});

test('wybór jednostek rozpoznaje faktyczny prostokąt ekranu we wszystkich obrotach', () => {
  const camera = {
    position: { x: 320, y: 240 },
    pivot: GRID_PIVOT,
    zoom: 0.62,
    quarterTurns: 0
  };
  for (let quarterTurns = 0; quarterTurns < 4; quarterTurns += 1) {
    camera.quarterTurns = quarterTurns;
    const center = viewportToWorld({ x: 320, y: 240 }, camera);
    const outsideLeft = viewportToWorld({ x: -1, y: 240 }, camera);
    const outsideBottom = viewportToWorld({ x: 320, y: 481 }, camera);
    assert.equal(isWorldPointInViewport(center, camera, { width: 640, height: 480 }), true);
    assert.equal(isWorldPointInViewport(outsideLeft, camera, { width: 640, height: 480 }), false);
    assert.equal(isWorldPointInViewport(outsideBottom, camera, { width: 640, height: 480 }), false);
  }
});

test('cztery obroty po 90 stopni wracają do punktu wyjścia', () => {
  const point = { x: 123, y: -456 };
  let rotated = point;
  for (let turn = 0; turn < 4; turn += 1) rotated = rotateOffset(rotated, 1);
  assert.ok(Math.abs(rotated.x - point.x) < 1e-9);
  assert.ok(Math.abs(rotated.y - point.y) < 1e-9);
  assert.deepEqual(rotateOffset(point, 2), { x: -123, y: 456 });
});
