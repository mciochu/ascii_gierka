/** Grid-backed fortress pieces. Costs are centralized here so balancing never leaks into UI code. */
import { tileAt, worldPositionForCell, type WorldGrid } from "./grid.ts";
import type { GameEntity } from "./world.ts";

export type FortificationKind = "wall-high" | "wall-low" | "gate-small" | "gate-large" | "moat";
export interface FortificationCost { wood: number; stone: number; gold: number; }
export const FORTIFICATION_COSTS: Record<FortificationKind, FortificationCost> = {
  "wall-high": { wood: 5, stone: 20, gold: 0 },
  "wall-low": { wood: 3, stone: 12, gold: 0 },
  "gate-small": { wood: 10, stone: 12, gold: 0 },
  "gate-large": { wood: 15, stone: 18, gold: 0 },
  moat: { wood: 0, stone: 0, gold: 0 }
};

export function fortificationBlocks(kind: FortificationKind, gateOpen = false): boolean {
  if (kind === "moat") return true;
  if (kind === "gate-small" || kind === "gate-large") return !gateOpen;
  return true;
}

export function canPlaceFortification(grid: WorldGrid, col: number, row: number): boolean {
  const tile = tileAt(grid, col, row);
  return !!tile && tile.walkable && tile.buildable && tile.terrain !== "water" && tile.terrain !== "cliff" && tile.terrain !== "moat";
}

/** Apply a wall/gate/moat while remembering the natural terrain for demolition and loading. */
export function applyFortificationToTile(
  grid: WorldGrid,
  entity: Pick<GameEntity, "fortificationKind" | "gridCol" | "gridRow" | "gateOpen" | "underlyingTerrain" | "underlyingWalkable" | "underlyingBuildable">
): boolean {
  if (!entity.fortificationKind || entity.gridCol === undefined || entity.gridRow === undefined) return false;
  const tile = tileAt(grid, entity.gridCol, entity.gridRow);
  if (!tile) return false;
  if (entity.underlyingTerrain === undefined) entity.underlyingTerrain = tile.terrain;
  if (entity.underlyingWalkable === undefined) entity.underlyingWalkable = tile.walkable;
  if (entity.underlyingBuildable === undefined) entity.underlyingBuildable = tile.buildable;
  tile.walkable = !fortificationBlocks(entity.fortificationKind, entity.gateOpen === true);
  tile.buildable = false;
  if (entity.fortificationKind === "moat") tile.terrain = "moat";
  return true;
}

export function setFortificationGate(grid: WorldGrid, entity: GameEntity, open: boolean): boolean {
  if (entity.fortificationKind !== "gate-small" && entity.fortificationKind !== "gate-large") return false;
  const tile = tileAt(grid, entity.gridCol ?? -1, entity.gridRow ?? -1);
  if (!tile) return false;
  entity.gateOpen = open;
  tile.walkable = open && (entity.underlyingWalkable ?? true);
  tile.buildable = false;
  if (entity.group) {
    for (const child of entity.group.children) {
      if (child.label === "gate-open-left" || child.label === "gate-open-right") child.alpha = open ? 0.98 : 0;
    }
  }
  return true;
}

export function removeFortificationFromTile(grid: WorldGrid, entity: GameEntity): boolean {
  if (!entity.fortificationKind || entity.gridCol === undefined || entity.gridRow === undefined) return false;
  const tile = tileAt(grid, entity.gridCol, entity.gridRow);
  if (!tile) return false;
  if (entity.underlyingTerrain !== undefined) tile.terrain = entity.underlyingTerrain;
  if (entity.underlyingWalkable !== undefined) tile.walkable = entity.underlyingWalkable;
  if (entity.underlyingBuildable !== undefined) tile.buildable = entity.underlyingBuildable;
  return true;
}

export function fortificationWorldPosition(grid: WorldGrid, col: number, row: number): { x: number; y: number } | null {
  return worldPositionForCell(grid, col, row);
}
