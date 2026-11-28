export type TerrainKind =
  | "sand"
  | "oasis"
  | "forest"
  | "water"
  | "hill"
  | "cliff"
  | "stone"
  | "iron"
  | "tar"
  | "moat";

export interface GridTile {
  col: number;
  row: number;
  terrain: TerrainKind;
  elevation: number;
  walkable: boolean;
  buildable: boolean;
}

export interface WorldGrid {
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  heightStep: number;
  tiles: GridTile[];
}

export interface WorldPoint {
  x: number;
  y: number;
}

const COLUMNS = 100;
const ROWS = 100;
const TILE_WIDTH = 26;
const TILE_HEIGHT = 18;
const HEIGHT_STEP = 3;
const ROW_ORIGIN = ROWS - 1;
const HALF_TILE_X = TILE_WIDTH / 2;
const HALF_TILE_Y = TILE_HEIGHT / 2;
export const GRID_PIVOT = {
  x: HALF_TILE_X * (COLUMNS - 1),
  y: HALF_TILE_Y * (ROWS - 1)
};

const WATER_PATH: WorldPoint[] = [
  { x: 1350, y: 180 },
  { x: 1450, y: 300 },
  { x: 1580, y: 430 },
  { x: 1720, y: 580 },
  { x: 1840, y: 760 },
  { x: 1920, y: 930 },
  { x: 1850, y: 1110 },
  { x: 1710, y: 1270 }
];

const FORESTS = [
  { x: 900, y: 500, rx: 140, ry: 105 },
  { x: 1900, y: 930, rx: 155, ry: 110 },
  { x: 1180, y: 1160, rx: 125, ry: 95 },
  { x: 1700, y: 1410, rx: 145, ry: 115 }
];

function hash(col: number, row: number): number {
  let value = Math.imul(col + 17, 374761393) + Math.imul(row + 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

function distanceToSegment(point: WorldPoint, start: WorldPoint, end: WorldPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function distanceToPath(point: WorldPoint, path: WorldPoint[]): number {
  let nearest = Infinity;
  for (let index = 0; index < path.length - 1; index += 1) {
    nearest = Math.min(nearest, distanceToSegment(point, path[index]!, path[index + 1]!));
  }
  return nearest;
}

function inEllipse(point: WorldPoint, area: { x: number; y: number; rx: number; ry: number }): boolean {
  const dx = (point.x - area.x) / area.rx;
  const dy = (point.y - area.y) / area.ry;
  return dx * dx + dy * dy <= 1;
}

function terrainAt(point: WorldPoint, col: number, row: number): Pick<GridTile, "terrain" | "elevation" | "walkable" | "buildable"> {
  const noise = hash(col, row);
  if (distanceToPath(point, WATER_PATH) < 38) {
    return { terrain: "water", elevation: -1, walkable: false, buildable: false };
  }

  const cliff = inEllipse(point, { x: 1655, y: 1450, rx: 220, ry: 155 });
  if (cliff) {
    return { terrain: "cliff", elevation: 3, walkable: false, buildable: false };
  }

  if (FORESTS.some((area) => inEllipse(point, area))) {
    return { terrain: "forest", elevation: 1, walkable: true, buildable: false };
  }

  if (inEllipse(point, { x: 600, y: 1170, rx: 180, ry: 105 }) ||
      inEllipse(point, { x: 1030, y: 1370, rx: 205, ry: 135 })) {
    return { terrain: "oasis", elevation: 0, walkable: true, buildable: true };
  }

  if (inEllipse(point, { x: 1445, y: 1640, rx: 105, ry: 72 })) {
    return { terrain: "stone", elevation: 1, walkable: true, buildable: false };
  }

  if (inEllipse(point, { x: 1290, y: 455, rx: 115, ry: 78 })) {
    return { terrain: "iron", elevation: 1, walkable: true, buildable: false };
  }

  if (inEllipse(point, { x: 660, y: 900, rx: 105, ry: 78 })) {
    return { terrain: "tar", elevation: 0, walkable: true, buildable: false };
  }

  const hillBand = inEllipse(point, { x: 1840, y: 1500, rx: 360, ry: 245 });
  if (hillBand) {
    return { terrain: "hill", elevation: 1 + (noise % 3 === 0 ? 1 : 0), walkable: true, buildable: true };
  }

  return {
    terrain: "sand",
    elevation: noise % 19 === 0 ? 1 : 0,
    walkable: true,
    buildable: true
  };
}

export function createWorldGrid(): WorldGrid {
  const tiles: GridTile[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLUMNS; col += 1) {
      const base = {
        x: HALF_TILE_X * (col - row + ROW_ORIGIN),
        y: HALF_TILE_Y * (col + row)
      };
      const terrain = terrainAt(base, col, row);
      tiles.push({ col, row, ...terrain });
    }
  }
  return {
    columns: COLUMNS,
    rows: ROWS,
    tileWidth: TILE_WIDTH,
    tileHeight: TILE_HEIGHT,
    heightStep: HEIGHT_STEP,
    tiles
  };
}

export interface TerrainOverviewCell {
  x: number;
  y: number;
  terrain: TerrainKind;
  elevation: number;
  coverage: number;
}

/**
 * Collapse the simulation grid into a readable strategic map. One overview
 * cell represents a block of terrain tiles, preventing thousands of tiny marks
 * from merging into visual noise when the camera is far away.
 */
export function createTerrainOverview(grid: WorldGrid, blockSize = 6): TerrainOverviewCell[] {
  if (!Number.isInteger(blockSize) || blockSize < 2 || blockSize > 25) {
    throw new RangeError("Terrain overview block size must be an integer from 2 to 25.");
  }

  const overview: TerrainOverviewCell[] = [];
  for (let rowStart = 0; rowStart < grid.rows; rowStart += blockSize) {
    for (let colStart = 0; colStart < grid.columns; colStart += blockSize) {
      const counts = new Map<TerrainKind, number>();
      let total = 0;
      let elevationTotal = 0;
      for (let row = rowStart; row < Math.min(grid.rows, rowStart + blockSize); row += 1) {
        for (let col = colStart; col < Math.min(grid.columns, colStart + blockSize); col += 1) {
          const tile = grid.tiles[row * grid.columns + col];
          if (!tile) continue;
          counts.set(tile.terrain, (counts.get(tile.terrain) ?? 0) + 1);
          elevationTotal += tile.elevation;
          total += 1;
        }
      }
      if (total === 0) continue;

      const feature = [...counts.entries()]
        .filter(([terrain]) => terrain !== "sand")
        .sort((a, b) => b[1] - a[1])[0];
      const terrain = feature && feature[1] >= Math.max(2, Math.ceil(total * 0.1))
        ? feature[0]
        : "sand";
      const centerCol = Math.min(grid.columns - 1, colStart + Math.floor(Math.min(blockSize, grid.columns - colStart) / 2));
      const centerRow = Math.min(grid.rows - 1, rowStart + Math.floor(Math.min(blockSize, grid.rows - rowStart) / 2));
      const center = worldPositionForCell(grid, centerCol, centerRow);
      if (!center) continue;
      overview.push({
        x: center.x,
        y: center.y,
        terrain,
        elevation: elevationTotal / total,
        coverage: (counts.get(terrain) ?? 0) / total
      });
    }
  }
  return overview;
}

export function tileAt(grid: WorldGrid, col: number, row: number): GridTile | null {
  if (col < 0 || row < 0 || col >= grid.columns || row >= grid.rows) return null;
  return grid.tiles[row * grid.columns + col] ?? null;
}

export function worldPositionForCell(grid: WorldGrid, col: number, row: number): WorldPoint | null {
  const tile = tileAt(grid, col, row);
  if (!tile) return null;
  return {
    x: (grid.tileWidth / 2) * (col - row + ROW_ORIGIN),
    y: (grid.tileHeight / 2) * (col + row) - tile.elevation * grid.heightStep
  };
}

export function worldToCell(grid: WorldGrid, point: WorldPoint): GridTile | null {
  const halfWidth = grid.tileWidth / 2;
  const halfHeight = grid.tileHeight / 2;
  const roughCol = Math.round(((point.x / halfWidth - ROW_ORIGIN) + point.y / halfHeight) / 2);
  const roughRow = Math.round((point.y / halfHeight - (point.x / halfWidth - ROW_ORIGIN)) / 2);
  let nearest: GridTile | null = null;
  let nearestDistance = Infinity;
  for (let row = roughRow - 4; row <= roughRow + 4; row += 1) {
    for (let col = roughCol - 4; col <= roughCol + 4; col += 1) {
      const tile = tileAt(grid, col, row);
      if (!tile) continue;
      const center = worldPositionForCell(grid, col, row);
      if (!center) continue;
      const dx = Math.abs(center.x - point.x);
      const dy = Math.abs(center.y - point.y);
      // A point belongs to a diamond tile only while inside its projected footprint.
      if (dx / halfWidth + dy / halfHeight > 1) continue;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance ||
          (distance === nearestDistance && tile.elevation > (nearest?.elevation ?? -Infinity))) {
        nearest = tile;
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}
export function isWalkableAtWorld(grid: WorldGrid, point: WorldPoint): boolean {
  return worldToCell(grid, point)?.walkable ?? false;
}

export function isBuildableAtWorld(grid: WorldGrid, point: WorldPoint): boolean {
  return worldToCell(grid, point)?.buildable ?? false;
}

function nearestWalkable(grid: WorldGrid, origin: GridTile, radius: number): GridTile | null {
  for (let distance = 0; distance <= radius; distance += 1) {
    let candidate: GridTile | null = null;
    let candidateDistance = Infinity;
    for (let row = origin.row - distance; row <= origin.row + distance; row += 1) {
      for (let col = origin.col - distance; col <= origin.col + distance; col += 1) {
        if (Math.abs(col - origin.col) + Math.abs(row - origin.row) !== distance) continue;
        const tile = tileAt(grid, col, row);
        if (!tile?.walkable) continue;
        const score = Math.hypot(col - origin.col, row - origin.row);
        if (score < candidateDistance) {
          candidate = tile;
          candidateDistance = score;
        }
      }
    }
    if (candidate) return candidate;
  }
  return null;
}

/** Breadth-first grid route. Water, cliffs and moats are impassable; diagonal corner-cutting is forbidden. */
export function findGridPath(grid: WorldGrid, start: WorldPoint, destination: WorldPoint): WorldPoint[] | null {
  const startTile = worldToCell(grid, start);
  const targetTile = worldToCell(grid, destination);
  if (!startTile || !targetTile) return null;

  const startPassable = startTile.walkable ? startTile : nearestWalkable(grid, startTile, 3);
  const targetPassable = targetTile.walkable ? targetTile : nearestWalkable(grid, targetTile, 5);
  if (!startPassable || !targetPassable) return null;

  const total = grid.columns * grid.rows;
  const startIndex = startPassable.row * grid.columns + startPassable.col;
  const targetIndex = targetPassable.row * grid.columns + targetPassable.col;
  if (startIndex === targetIndex) return [];

  const previous = new Int32Array(total);
  previous.fill(-2);
  previous[startIndex] = -1;
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1]
  ];

  while (head < tail && previous[targetIndex] === -2) {
    const currentIndex = queue[head++]!;
    const current = grid.tiles[currentIndex]!;
    for (const [dc, dr] of directions) {
      const col = current.col + dc!;
      const row = current.row + dr!;
      const next = tileAt(grid, col, row);
      if (!next?.walkable) continue;
      const nextIndex = row * grid.columns + col;
      if (previous[nextIndex] !== -2) continue;
      if (dc !== 0 && dr !== 0) {
        const sideA = tileAt(grid, current.col + dc!, current.row);
        const sideB = tileAt(grid, current.col, current.row + dr!);
        if (!sideA?.walkable || !sideB?.walkable) continue;
      }
      previous[nextIndex] = currentIndex;
      queue[tail++] = nextIndex;
    }
  }

  if (previous[targetIndex] === -2) return null;
  const reversed: WorldPoint[] = [];
  let cursor = targetIndex;
  while (cursor !== startIndex) {
    const tile = grid.tiles[cursor]!;
    const position = worldPositionForCell(grid, tile.col, tile.row);
    if (position) reversed.push(position);
    cursor = previous[cursor]!;
  }
  reversed.reverse();
  return reversed;
}

/** Positive quarter-turns rotate the map clockwise, matching the screen's downward Y axis. */
export function rotateOffset(point: WorldPoint, quarterTurns: number): WorldPoint {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 1) return { x: -point.y, y: point.x };
  if (turns === 2) return { x: -point.x, y: -point.y };
  if (turns === 3) return { x: point.y, y: -point.x };
  return { x: point.x, y: point.y };
}


export interface MapCameraTransform {
  position: WorldPoint;
  pivot: WorldPoint;
  zoom: number;
  quarterTurns: number;
}

/** Convert world coordinates to canvas-local screen coordinates for a rotated map camera. */
export function worldToViewport(point: WorldPoint, camera: MapCameraTransform): WorldPoint {
  const offset = rotateOffset({
    x: (point.x - camera.pivot.x) * camera.zoom,
    y: (point.y - camera.pivot.y) * camera.zoom
  }, camera.quarterTurns);
  return { x: camera.position.x + offset.x, y: camera.position.y + offset.y };
}

/** Inverse of worldToViewport; used for hit testing, selection and world-space commands. */
export function viewportToWorld(point: WorldPoint, camera: MapCameraTransform): WorldPoint {
  const offset = rotateOffset({
    x: (point.x - camera.position.x) / camera.zoom,
    y: (point.y - camera.position.y) / camera.zoom
  }, -camera.quarterTurns);
  return { x: camera.pivot.x + offset.x, y: camera.pivot.y + offset.y };
}

/** True only when a world point lands inside the actual screen rectangle. */
export function isWorldPointInViewport(
  point: WorldPoint,
  camera: MapCameraTransform,
  viewport: { width: number; height: number }
): boolean {
  const screen = worldToViewport(point, camera);
  return screen.x >= 0 && screen.y >= 0 && screen.x <= viewport.width && screen.y <= viewport.height;
}