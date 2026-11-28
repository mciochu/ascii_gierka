import test from "node:test";
import assert from "node:assert/strict";
import { createWorldGrid, findGridPath, tileAt, worldPositionForCell } from "../src/engine/grid.ts";
import {
  FORTIFICATION_COSTS, applyFortificationToTile, canPlaceFortification,
  fortificationBlocks, removeFortificationFromTile, setFortificationGate
} from "../src/engine/fortifications.ts";

function findBuildable(grid) {
  const tile = grid.tiles.find((candidate) => candidate.walkable && candidate.buildable);
  assert.ok(tile);
  return tile;
}

test("mur zamyka przechodnie pole i jego usunięcie przywraca naturalny teren", () => {
  const grid = createWorldGrid();
  const tile = findBuildable(grid);
  const record = {
    fortificationKind: "wall-high", gridCol: tile.col, gridRow: tile.row,
    underlyingTerrain: undefined, underlyingWalkable: undefined, underlyingBuildable: undefined, gateOpen: false
  };
  assert.equal(canPlaceFortification(grid, tile.col, tile.row), true);
  assert.equal(applyFortificationToTile(grid, record), true);
  assert.equal(tile.walkable, false);
  assert.equal(tile.buildable, false);
  assert.equal(removeFortificationFromTile(grid, record), true);
  assert.equal(tile.walkable, true);
  assert.equal(tile.buildable, true);
});

test("zamknięta brama blokuje trasę, a otwarta ponownie dopuszcza ruch", () => {
  const grid = createWorldGrid();
  const tile = findBuildable(grid);
  const gate = {
    id: "gate-small-1", fortificationKind: "gate-small", gridCol: tile.col, gridRow: tile.row,
    gateOpen: false, underlyingTerrain: tile.terrain, underlyingWalkable: tile.walkable,
    underlyingBuildable: tile.buildable, health: 320, maxHealth: 320
  };
  assert.equal(applyFortificationToTile(grid, gate), true);
  assert.equal(tile.walkable, false);
  assert.equal(fortificationBlocks("gate-small", false), true);
  assert.equal(setFortificationGate(grid, gate, true), true);
  assert.equal(tile.walkable, true);
  assert.equal(fortificationBlocks("gate-small", true), false);
  assert.equal(setFortificationGate(grid, gate, false), true);
  assert.equal(tile.walkable, false);
});

test("fosa zmienia rodzaj terenu, blokuje ruch i zachowuje go do odtworzenia", () => {
  const grid = createWorldGrid();
  const tile = findBuildable(grid);
  const originalTerrain = tile.terrain;
  const moat = {
    fortificationKind: "moat", gridCol: tile.col, gridRow: tile.row,
    gateOpen: false, underlyingTerrain: tile.terrain, underlyingWalkable: tile.walkable,
    underlyingBuildable: tile.buildable
  };
  assert.equal(applyFortificationToTile(grid, moat), true);
  assert.equal(tile.terrain, "moat");
  assert.equal(tile.walkable, false);
  assert.equal(removeFortificationFromTile(grid, moat), true);
  assert.equal(tile.terrain, originalTerrain);
  assert.equal(tile.walkable, true);
});

test("koszty fortyfikacji są jawne, nieujemne i skupione w jednej konfiguracji", () => {
  for (const [kind, cost] of Object.entries(FORTIFICATION_COSTS)) {
    assert.ok(kind);
    for (const amount of Object.values(cost)) assert.ok(Number.isFinite(amount) && amount >= 0);
  }
  const grid = createWorldGrid();
  assert.equal(tileAt(grid, -1, 0), null);
  assert.equal(canPlaceFortification(grid, -1, 0), false);
  const water = grid.tiles.find((tile) => tile.terrain === "water");
  assert.ok(water);
  assert.equal(canPlaceFortification(grid, water.col, water.row), false);
});

test("ściana blokuje bezpośrednią trasę przez swoje pole", () => {
  const grid = createWorldGrid();
  let middle;
  for (let row = 10; row < 90 && !middle; row += 1) {
    for (let col = 10; col < 90; col += 1) {
      const tile = tileAt(grid, col, row);
      const left = tileAt(grid, col - 1, row);
      const right = tileAt(grid, col + 1, row);
      if (tile?.walkable && tile.buildable && left?.walkable && right?.walkable) {
        middle = tile;
        break;
      }
    }
  }
  assert.ok(middle);
  const start = worldPositionForCell(grid, middle.col - 1, middle.row);
  const goal = worldPositionForCell(grid, middle.col + 1, middle.row);
  assert.ok(start && goal);
  const original = findGridPath(grid, start, goal);
  assert.ok(original);
  const wall = {
    fortificationKind: "wall-low", gridCol: middle.col, gridRow: middle.row,
    underlyingTerrain: middle.terrain, underlyingWalkable: middle.walkable,
    underlyingBuildable: middle.buildable
  };
  assert.equal(applyFortificationToTile(grid, wall), true);
  const detour = findGridPath(grid, start, goal);
  assert.ok(detour);
  assert.ok(detour.length > original.length);
  assert.equal(detour.some((point) => {
    const cell = grid.tiles.find((tile) => {
      const center = worldPositionForCell(grid, tile.col, tile.row);
      return center && center.x === point.x && center.y === point.y;
    });
    return cell?.col === middle.col && cell?.row === middle.row;
  }), false);
});
