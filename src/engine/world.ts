import { Container } from "pixi.js";
import { addGlyph, addWord, GlyphDisplay, type GlyphLodSet } from "./glyph";
import { drawTeutonicAsset, type TeutonicAssetKind } from "./teutonic-art";
import { HUNTING_NODES, type ProductionType, type StorageType } from "./logistics";
import { applyFortificationToTile, canPlaceFortification, type FortificationKind } from "./fortifications";
import { createWorldGrid, GRID_PIVOT, worldPositionForCell, type WorldGrid, type TerrainKind } from "./grid";

export type EntityKind = "building" | "unit";
export type Faction = "player" | "enemy" | "neutral";
export type UnitStance = "stand-ground" | "defensive" | "aggressive";

export interface GameEntity {
  id: string;
  name: string;
  kind: EntityKind;
  description: string;
  role: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  count?: number;
  team: Faction;
  unitClass?: string;
  moveSpeed?: number;
  attackDamage?: number;
  attackRange?: number;
  attackCooldown?: number;
  attackTargetId?: string;
  attackMoveTarget?: { x: number; y: number };
  moveTarget?: { x: number; y: number };
  movementQueue?: { x: number; y: number }[];
  holdPosition?: boolean;
  stance?: UnitStance;
  stanceReturnTarget?: { x: number; y: number };
  lordSide?: "player" | "enemy";
  fortificationKind?: FortificationKind;
  gridCol?: number;
  gridRow?: number;
  gateOpen?: boolean;
  underlyingTerrain?: TerrainKind;
  underlyingWalkable?: boolean;
  underlyingBuildable?: boolean;
  group: Container;
}

export interface WorldLayers {
  terrain: Container;
  details: Container;
  structures: Container;
  actors: Container;
  effects: Container;
}

export interface WorldState {
  entities: GameEntity[];
  layers: WorldLayers;
  grid: WorldGrid;
  setFlattened(flattened: boolean): void;
}

const WORLD_WIDTH = 2600;
const WORLD_HEIGHT = 1850;

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function insideWorldDiamond(x: number, y: number): boolean {
  return Math.abs(x - GRID_PIVOT.x) / GRID_PIVOT.x + Math.abs(y - GRID_PIVOT.y) / GRID_PIVOT.y <= 1;
}

function addTree(parent: Container, x: number, y: number, scale: number, seed: number): void {
  const rand = random(seed);
  const canopy = ["♣", "♧", "♠", "❧"];
  const greens = ["#293e2d", "#3c5637", "#526b43", "#405d3c", "#718052", "#87915d"];
  const count = 6 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = rand() * 22 * scale;
    const leafX = x + Math.cos(angle) * radius;
    const leafY = y + Math.sin(angle) * radius;
    if (!insideWorldDiamond(leafX, leafY)) continue;
    addGlyph(parent, {
      char: canopy[Math.floor(rand() * canopy.length)] ?? "♣",
      x: leafX,
      y: leafY,
      size: (15 + rand() * 15) * scale,
      color: greens[Math.floor(rand() * greens.length)] ?? "#547c50",
      alpha: 0.78 + rand() * 0.2,
      rotation: (rand() - 0.5) * 0.35
    });
  }
  if (insideWorldDiamond(x, y + 15 * scale)) addGlyph(parent, {
    char: "│",
    x: x + (rand() - 0.5) * 5,
    y: y + 15 * scale,
    size: 12 * scale,
    color: "#63462f",
    alpha: 0.8
  });
  if (rand() > 0.48) {
    const dotX = x + (rand() - 0.5) * 35 * scale;
    const dotY = y + (rand() - 0.5) * 32 * scale;
    if (insideWorldDiamond(dotX, dotY)) addGlyph(parent, {
      char: "·",
      x: dotX,
      y: dotY,
      size: 10 * scale,
      color: "#91a05d",
      alpha: 0.85
    });
  }
}

function addForest(parent: Container, centerX: number, centerY: number, radiusX: number, radiusY: number, seed: number): void {
  const rand = random(seed);
  const count = 22 + Math.floor(rand() * 15);
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const distance = Math.sqrt(rand());
    const x = centerX + Math.cos(angle) * radiusX * distance;
    const y = centerY + Math.sin(angle) * radiusY * distance;
    addTree(parent, x, y, 0.72 + rand() * 0.48, seed + i * 31);
  }
  for (let i = 0; i < 16; i += 1) {
    const x = centerX + (rand() - 0.5) * radiusX * 2.4;
    const y = centerY + (rand() - 0.5) * radiusY * 2.4;
    if (!insideWorldDiamond(x, y)) continue;
    addGlyph(parent, {
      char: ["·", "⁙", "‚", "˙"][Math.floor(rand() * 4)] ?? "·",
      x,
      y,
      size: 8 + rand() * 9,
      color: "#536a43",
      alpha: 0.6
    });
  }
}

function addQuadraticPath(parent: Container, start: { x: number; y: number }, control: { x: number; y: number }, end: { x: number; y: number }, count: number, seed: number): void {
  const rand = random(seed);
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const inverse = 1 - t;
    const x = inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x;
    const y = inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y;
    const spread = (rand() - 0.5) * 23;
    const pointX = x + spread;
    const pointY = y + (rand() - 0.5) * 18;
    if (!insideWorldDiamond(pointX, pointY)) continue;
    addGlyph(parent, {
      char: ["·", "⸱", "∙", "╌", "‚"][Math.floor(rand() * 5)] ?? "·",
      x: pointX,
      y: pointY,
      size: 10 + rand() * 8,
      color: rand() > 0.5 ? "#3b3428" : "#514532",
      alpha: 0.42 + rand() * 0.25
    });
  }
}

function addRiver(parent: Container): void {
  const rand = random(8071);
  const course = [
    { x: 1350, y: 180 },
    { x: 1450, y: 300 },
    { x: 1580, y: 430 },
    { x: 1720, y: 580 },
    { x: 1840, y: 760 },
    { x: 1920, y: 930 },
    { x: 1850, y: 1110 },
    { x: 1710, y: 1270 }
  ];
  const pointAt = (progress: number): { x: number; y: number } => {
    const position = progress * (course.length - 1);
    const segment = Math.min(course.length - 2, Math.floor(position));
    const local = position - segment;
    const start = course[segment]!;
    const end = course[segment + 1]!;
    return {
      x: start.x + (end.x - start.x) * local,
      y: start.y + (end.y - start.y) * local
    };
  };

  for (let i = 0; i < 145; i += 1) {
    const center = pointAt(i / 144);
    const spread = (rand() - 0.5) * 78;
    const x = center.x + spread;
    const y = center.y + (rand() - 0.5) * 34;
    if (!insideWorldDiamond(x, y)) continue;
    addGlyph(parent, {
      char: ["≈", "∿", "﹏", "~", "〜"][Math.floor(rand() * 5)] ?? "≈",
      x,
      y,
      size: 16 + rand() * 16,
      color: rand() > 0.55 ? "#355d70" : "#477c91",
      alpha: 0.42 + rand() * 0.2,
      rotation: -0.22,
      material: "terrain", height: 0.02, animated: true, entityId: "terrain:water"
    });
  }
  for (let i = 0; i < 58; i += 1) {
    const center = pointAt(i / 57);
    const x = center.x + (rand() - 0.5) * 78;
    const y = center.y + (rand() - 0.5) * 85;
    if (!insideWorldDiamond(x, y)) continue;
    addGlyph(parent, {
      char: "·",
      x,
      y,
      size: 7 + rand() * 9,
      color: "#7094a0",
      alpha: 0.55,
      material: "terrain", height: 0.02, animated: true, entityId: "terrain:water"
    });
  }
}

function addTerrain(layers: WorldLayers): void {
  const rand = random(1204);
  const grass = ["·", "˙", "‚", "⁙", "⸱", "∙", "'", "٫"];
  const sands = ["#172017", "#1b2419", "#222a1d", "#171f18", "#282a1e", "#24261d"];
  let placed = 0;
  let attempts = 0;
  while (placed < 680 && attempts < 5000) {
    attempts += 1;
    const x = rand() * WORLD_WIDTH;
    const y = rand() * WORLD_HEIGHT;
    if (!insideWorldDiamond(x, y)) continue;
    placed += 1;
    const size = 7 + rand() * 11;
    addGlyph(layers.terrain, {
      char: grass[Math.floor(rand() * grass.length)] ?? "·",
      x,
      y,
      size,
      color: sands[Math.floor(rand() * sands.length)] ?? "#b99a70",
      alpha: 0.25 + rand() * 0.43,
      rotation: (rand() - 0.5) * 1.2
    });
  }

  addRiver(layers.details);
  addQuadraticPath(layers.details, { x: 100, y: 1015 }, { x: 630, y: 1080 }, { x: 1190, y: 930 }, 115, 91);
  addQuadraticPath(layers.details, { x: 1190, y: 930 }, { x: 1370, y: 1190 }, { x: 1510, y: 1660 }, 83, 92);
  addQuadraticPath(layers.details, { x: 1190, y: 930 }, { x: 1280, y: 630 }, { x: 1610, y: 480 }, 67, 93);

  addForest(layers.details, 900, 500, 140, 105, 33);
  addForest(layers.details, 1900, 930, 155, 110, 39);
  addForest(layers.details, 1180, 1160, 125, 95, 45);
  addForest(layers.details, 1700, 1410, 145, 115, 51);

  for (let i = 0; i < 74; i += 1) {
    const x = 1320 + rand() * 300;
    const y = 1250 + rand() * 250;
    if (!insideWorldDiamond(x, y)) continue;
    addGlyph(layers.details, {
      char: ["▲", "△", "▴", "◆", "◈"][Math.floor(rand() * 5)] ?? "▲",
      x,
      y,
      size: 10 + rand() * 20,
      color: rand() > 0.5 ? "#625d4f" : "#8a8b7d",
      alpha: 0.35 + rand() * 0.35,
      rotation: rand() * 0.6
    });
  }

  // Irregular field furrows: the lines intentionally drift rather than snapping to a tile grid.
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 13; col += 1) {
      const x = 480 + col * 18 + (rand() - 0.5) * 10 + row * 2;
      const y = 1130 + row * 13 + Math.sin(col * 0.55) * 6 + (rand() - 0.5) * 6;
      if (!insideWorldDiamond(x, y)) continue;
      addGlyph(layers.details, {
        char: rand() > 0.5 ? "╱" : "╲",
        x,
        y,
        size: 14 + rand() * 5,
        color: "#4a3b28",
        alpha: 0.42
      });
    }
  }
}

function addGridTerrain(layers: WorldLayers, grid: WorldGrid): { glyph: GlyphDisplay; rise: number }[] {
  const elevationMarks: { glyph: GlyphDisplay; rise: number }[] = [];
  const symbols: Record<string, { char: string; color: string; alpha: number }> = {
    sand: { char: "·", color: "#63553e", alpha: 0.32 },
    oasis: { char: "❧", color: "#60784b", alpha: 0.62 },
    forest: { char: "♣", color: "#3f5b39", alpha: 0.72 },
    water: { char: "≈", color: "#477c91", alpha: 0.72 },
    hill: { char: "﹏", color: "#625239", alpha: 0.52 },
    cliff: { char: "▲", color: "#817d6b", alpha: 0.76 },
    stone: { char: "◈", color: "#a7a89c", alpha: 0.74 },
    iron: { char: "◆", color: "#a45a3d", alpha: 0.78 },
    tar: { char: "◉", color: "#302b29", alpha: 0.78 },
    moat: { char: "⌁", color: "#477c91", alpha: 0.8 }
  };

  for (const tile of grid.tiles) {
    if (tile.terrain === "sand" && (tile.col + tile.row * 3) % 5 !== 0) continue;
    const point = worldPositionForCell(grid, tile.col, tile.row);
    if (!point || point.x < 0 || point.x > WORLD_WIDTH || point.y < 0 || point.y > WORLD_HEIGHT) continue;
    const mark = symbols[tile.terrain] ?? symbols.sand!;
    const rise = tile.elevation * grid.heightStep;
    const glyph = addGlyph(layers.terrain, {
      char: mark.char,
      x: point.x,
      y: point.y,
      size: tile.terrain === "sand" ? 7 : 10,
      color: mark.color,
      alpha: mark.alpha,
      material: "terrain",
      height: Math.max(0, Math.min(1, tile.elevation / 4)),
      normal: tile.terrain === "cliff" ? [0.0, 0.82, 0.57] : tile.terrain === "hill" ? [0.18, 0.34, 0.92] : [0.0, 0.0, 1.0],
      entityId: "terrain:" + tile.terrain,
      animated: tile.terrain === "water" || tile.terrain === "oasis" || tile.terrain === "tar"
    });
    elevationMarks.push({ glyph, rise });
    if (tile.terrain === "cliff") {
      const lowerGlyph = addGlyph(layers.terrain, {
        char: "▰",
        x: point.x,
        y: point.y + 8,
        size: 12,
        color: "#5c625b",
        alpha: 0.55,
        material: "terrain",
        height: Math.max(0, Math.min(1, tile.elevation / 4)) * 0.75,
        normal: [0.0, 0.78, 0.62],
        entityId: "terrain:cliff"
      });
      elevationMarks.push({ glyph: lowerGlyph, rise });
    }
  }
  return elevationMarks;
}

function makeKeep(parent: Container, x: number, y: number): Container {
  const group = new Container();
  parent.addChild(group);
  drawTeutonicAsset(group, "keep", 0, -4, { scale: 1.0, faction: "order", label: "DONŻON" });
  group.position.set(x, y);
  return group;
}

function makeBarracks(parent: Container, x: number, y: number): Container {
  const group = new Container();
  parent.addChild(group);
  drawTeutonicAsset(group, "barracks", 0, -3, { scale: 1.12, faction: "order", label: "KOSZARY" });
  group.position.set(x, y);
  return group;
}

function makeMill(parent: Container, x: number, y: number): Container {
  const group = new Container();
  parent.addChild(group);
  drawTeutonicAsset(group, "mill", 0, -3, { scale: 1.25, faction: "order", label: "MŁYN" });
  group.position.set(x, y);
  return group;
}

function makeStorehouse(parent: Container, x: number, y: number): Container {
  const group = new Container();
  parent.addChild(group);
  drawTeutonicAsset(group, "granary", 0, -3, { scale: 1.18, faction: "order", label: "SPICHLERZ" });
  group.position.set(x, y);
  return group;
}

function makeUnit(
  parent: Container,
  x: number,
  y: number,
  variant: number,
  count: number,
  unitClass?: string,
  team: Faction = "player"
): Container {
  const group = new Container();
  parent.addChild(group);
  const offsets = (variant === 0
    ? [[-17, 7], [0, -5], [16, 8], [2, 17]]
    : variant === 1 || variant === 4
      ? [[-12, -9], [9, -12], [-2, 10], [16, 13]]
      : [[-18, 0], [0, -10], [18, 3], [5, 18]]
  ).slice(0, Math.max(1, Math.min(4, count)));
  const role = unitClass ?? (variant === 1 ? "archers" : variant === 2 ? "cavalry" : variant === 3 ? "raiders" : "pikemen");
  const tacticalGlyph = variant === 1 ? ")" : variant === 2 ? "m" : variant === 3 ? "*" : "█";
  const classGlyph: Record<string, string> = {
    archers: ")", crossbowmen: "}", pikemen: "█", swordsmen: "⚔",
    cavalry: "m", raiders: "*", lord: "♛"
  };
  const palette = team === "enemy" || variant === 3
    ? "#a63832"
    : role === "archers" || role === "crossbowmen" ? "#d1b16e"
      : role === "lord" ? "#eee4c9" : "#c5cbc5";
  const unitArt: Record<string, TeutonicAssetKind> = {
    archers: "archer", crossbowmen: "crossbowman", pikemen: "spearman",
    swordsmen: "knight", cavalry: "cavalry", raiders: "sergeant", lord: "lord"
  };
  offsets.forEach(([ox, oy]) => {
    const faction = team === "enemy" || variant === 3 ? "enemy" : "order";
    drawTeutonicAsset(group, unitArt[role] ?? "sergeant", ox, oy, {
      scale: 0.44, faction, lod: "close"
    });
    drawTeutonicAsset(group, unitArt[role] ?? "sergeant", ox, oy, {
      scale: 0.35, faction, lod: "standard"
    });
  });
  addGlyph(group, {
    char: classGlyph[role] ?? tacticalGlyph, x: 0, y: 0, size: 24, color: palette, weight: "bold",
    alpha: 0.98, material: "unit", height: 0.24, lod: "strategic", minScreenCells: [1, 2]
  });
  addGlyph(group, {
    char: "[x" + count + "]", x: 18, y: -17, size: 14, color: palette, weight: "bold",
    alpha: 0.98, material: "unit", height: 0.24, lod: "strategic", minScreenCells: [1, 1]
  });
  addGlyph(group, {
    char: "|", x: 23, y: -34, size: 23, color: "#a8794d",
    material: "unit", lod: "standard"
  });
  addGlyph(group, {
    char: "⚑", x: 29, y: -43, size: 18,
    color: team === "enemy" || variant === 3 ? "#96372f" : "#eee9d9",
    material: "unit", lod: "standard"
  });
  if (team !== "enemy" && variant !== 3) addGlyph(group, {
    char: "✠", x: 29, y: -43, size: 8, color: "#191c19",
    material: "unit", lod: "standard"
  });
  group.position.set(x, y);
  return group;
}

function setGlyphTreeLod(node: Container, lod: GlyphLodSet): void {
  for (const child of node.children) {
    if (child instanceof GlyphDisplay) child.setLod(lod);
    else if (child instanceof Container) setGlyphTreeLod(child, lod);
  }
}

function strategicBuildingGlyph(id: string): { char: string; color: string } {
  if (id === "keep") return { char: "K", color: "#d1b16e" };
  if (id === "barracks") return { char: "B", color: "#d1d0c3" };
  if (id === "mill") return { char: "M", color: "#d7bd85" };
  if (id === "storehouse" || id.startsWith("granary")) return { char: "S", color: "#cdbb8b" };
  if (id.startsWith("stockpile")) return { char: "▣", color: "#b4b8aa" };
  if (id.startsWith("armory")) return { char: "A", color: "#c6a9a0" };
  if (id.startsWith("watchtower")) return { char: "T", color: "#d1d0c3" };
  if (id.startsWith("market")) return { char: "$", color: "#d1b16e" };
  if (id.startsWith("quarry")) return { char: "Q", color: "#b8b8b0" };
  if (id.startsWith("woodcutter") || id.startsWith("hunter")) return { char: "W", color: "#87966b" };
  if (id.startsWith("iron-mine")) return { char: "I", color: "#aebac7" };
  if (id.startsWith("pitch")) return { char: "P", color: "#b6a2c9" };
  if (id.startsWith("hovel")) return { char: "H", color: "#cda77f" };
  if (id.startsWith("chapel") || id.startsWith("church") || id.startsWith("cathedral")) return { char: "†", color: "#e3d6b1" };
  return { char: "#", color: "#c5c6c1" };
}

function entity(
  group: Container,
  id: string,
  name: string,
  kind: EntityKind,
  description: string,
  role: string,
  x: number,
  y: number,
  health: number,
  count?: number,
  team: "player" | "enemy" | "neutral" = "player",
  unitClass?: string
): GameEntity {
  group.label = id;
  if (kind === "building") {
    // Existing architecture remains the shared standard/close silhouette;
    // a single representative mark replaces its detail at strategic zoom.
    setGlyphTreeLod(group, ["standard", "close"]);
    const marker = strategicBuildingGlyph(id);
    addGlyph(group, {
      char: marker.char, x: 0, y: -52, size: 38,
      color: marker.color, weight: "bold", alpha: 0.98,
      material: "building", height: 0.62, lod: "strategic",
      minScreenCells: [1, 1], entityId: "strategic-building:" + id
    });
  }
  return {
    group, id, name, kind, description, role, x, y, health, maxHealth: 100, count, team, unitClass,
    moveSpeed: unitClass === "cavalry" ? 142 : unitClass === "archers" ? 82 : unitClass === "crossbowmen" ? 72 : 94,
    attackDamage: unitClass === "archers" ? 11 : unitClass === "crossbowmen" ? 16 : unitClass === "swordsmen" ? 15 : unitClass === "cavalry" ? 14 : 9,
    attackRange: unitClass === "archers" ? 150 : unitClass === "crossbowmen" ? 185 : unitClass === "cavalry" ? 48 : 55
  };
}


export function createFortification(
  parent: Container,
  grid: WorldGrid,
  id: string,
  kind: FortificationKind,
  col: number,
  row: number
): GameEntity | null {
  if (!canPlaceFortification(grid, col, row)) return null;
  const point = worldPositionForCell(grid, col, row);
  const tile = grid.tiles[row * grid.columns + col];
  if (!point || !tile) return null;
  const group = new Container();
  parent.addChild(group);
  const visuals: Record<FortificationKind, { name: string; glyph: string; color: string; size: number; health: number }> = {
    "wall-high": { name: "Mur wysoki", glyph: "▤", color: "#b8c5ce", size: 37, health: 360 },
    "wall-low": { name: "Mur niski", glyph: "▥", color: "#9daeb7", size: 29, health: 240 },
    "gate-small": { name: "Brama mała", glyph: "╫", color: "#c5a36d", size: 36, health: 320 },
    "gate-large": { name: "Brama duża", glyph: "╬", color: "#d2ae72", size: 44, health: 420 },
    moat: { name: "Fosa", glyph: "≈", color: "#577f89", size: 37, health: 200 }
  };
  const visual = visuals[kind];
  if (kind === "moat") {
    addGlyph(group, { char: "≈", x: -9, y: 1, size: 26, color: "#416f7b", alpha: 0.9, material: "terrain" });
    addGlyph(group, { char: "≈", x: 9, y: -3, size: 26, color: "#628b93", alpha: 0.86, material: "terrain" });
    addGlyph(group, { char: "·", x: 0, y: 8, size: 12, color: "#d1d0c3", alpha: 0.7, material: "terrain" });
  } else {
    const isGate = kind === "gate-small" || kind === "gate-large";
    drawTeutonicAsset(group, isGate ? "gate" : "wall", 0, 0, {
      scale: kind === "wall-high" || kind === "gate-large" ? 1.25 : 0.95,
      faction: "order"
    });
    if (isGate) {
      const leftDoor = addGlyph(group, { char: "╱", x: -9, y: 1, size: 23, color: "#bd8b55", weight: "bold", alpha: 0, material: "building" });
      leftDoor.label = "gate-open-left";
      const rightDoor = addGlyph(group, { char: "╲", x: 9, y: 1, size: 23, color: "#bd8b55", weight: "bold", alpha: 0, material: "building" });
      rightDoor.label = "gate-open-right";
    }
    if (kind === "wall-high") addGlyph(group, { char: "╥", x: 0, y: -17, size: 19, color: "#e0dfd0", alpha: 0.9, material: "building" });
  }
  group.position.set(point.x, point.y);
  const created = entity(
    group, id, visual.name, "building",
    kind === "moat" ? "Wykopana fosa. Blokuje przejście piesze i wymaga mostu lub obejścia." :
      kind.includes("gate") ? "Brama fortyfikacji. Można ją otwierać i zamykać; zamknięta blokuje ruch." :
        "Odcinek fortyfikacji. Blokuje ruch i może przyjmować obrażenia.",
    kind === "moat" ? "OBRONA · FOSA" : kind.includes("gate") ? "OBRONA · BRAMA" : "OBRONA · MUR",
    point.x, point.y, visual.health, undefined, "player", kind
  );
  created.maxHealth = visual.health;
  created.fortificationKind = kind;
  created.gridCol = col;
  created.gridRow = row;
  created.gateOpen = false;
  created.underlyingTerrain = tile.terrain;
  created.underlyingWalkable = tile.walkable;
  created.underlyingBuildable = tile.buildable;
  if (!applyFortificationToTile(grid, created)) {
    group.destroy({ children: true });
    return null;
  }
  return created;
}

export function createCombatSquad(
  parent: Container,
  id: string,
  unitClass: string,
  count: number,
  x: number,
  y: number,
  team: Faction = "player"
): GameEntity {
  const variants: Record<string, number> = {
    pikemen: 0, archers: 1, cavalry: 2, raiders: 3, crossbowmen: 4, swordsmen: 5, lord: 0
  };
  const labels: Record<string, { name: string; role: string; description: string }> = {
    pikemen: { name: "Pikinierzy", role: "PIKINIERZY · ODDZIAŁ", description: "Piechota z pikami. Broń pochodzi ze Zbrojowni." },
    archers: { name: "Łucznicy", role: "ŁUCZNICY · ODDZIAŁ", description: "Piechota dystansowa uzbrojona w łuki." },
    crossbowmen: { name: "Kusznicy", role: "KUSZNICY · ODDZIAŁ", description: "Cięższa piechota dystansowa uzbrojona w kusze." },
    swordsmen: { name: "Szermierze", role: "SZERMIERZE · ODDZIAŁ", description: "Piechota walcząca mieczami." },
    cavalry: { name: "Kawaleria", role: "KAWALERIA · ODDZIAŁ", description: "Ruchliwy oddział konny." },
    raiders: { name: "Rozbójnicy", role: "ROZBÓJNICY · ODDZIAŁ", description: "Wrogi oddział najeźdźców." },
    lord: { name: team === "enemy" ? "Wrogi Lord" : "Lord Castellum", role: "WŁADCA · WARUNEK ZWYCIĘSTWA", description: "Pojedynczy władca. Jego śmierć kończy rozgrywkę." }
  };
  const label = labels[unitClass] ?? labels.pikemen!;
  const group = makeUnit(parent, x, y, variants[unitClass] ?? 0, count, unitClass, team);
  return entity(group, id, label.name, "unit", label.description, label.role, x, y, 100, count, team, unitClass);
}

export function createWorld(root: Container): WorldState {
  const layers: WorldLayers = {
    terrain: new Container(),
    details: new Container(),
    structures: new Container(),
    actors: new Container(),
    effects: new Container()
  };
  root.addChild(layers.terrain, layers.details, layers.structures, layers.actors, layers.effects);

  const grid = createWorldGrid();
  addTerrain(layers);
  const elevationMarks = addGridTerrain(layers, grid);
  let isFlattened = false;
  const setFlattened = (flattened: boolean): void => {
    if (flattened === isFlattened) return;
    for (const mark of elevationMarks) mark.glyph.position.y += flattened ? mark.rise : -mark.rise;
    isFlattened = flattened;
  };
  const entities: GameEntity[] = [];

  const keepX = 1190;
  const keepY = 915;
  const keep = makeKeep(layers.structures, keepX, keepY);
  entities.push(entity(keep, "keep", "Donżon Castellum", "building", "Główna siedziba władcy. Serce twierdzy i symbol władzy nad doliną.", "TWIERDZA · CENTRUM WŁADZY", keepX, keepY, 100));

  const barracksX = 930;
  const barracksY = 760;
  const barracks = makeBarracks(layers.structures, barracksX, barracksY);
  entities.push(entity(barracks, "barracks", "Koszary", "building", "Szkolą i kwaterują straż zamkową. Stąd wyruszają oddziały obrońców.", "WOJSKO · REKRUTACJA", barracksX, barracksY, 94));

  const millX = 1455;
  const millY = 1100;
  const mill = makeMill(layers.structures, millX, millY);
  entities.push(entity(mill, "mill", "Młyn nad traktem", "building", "Przetwarza zboże na mąkę i wspiera zaopatrzenie okolicznych osad.", "GOSPODARKA · ŻYWNOŚĆ", millX, millY, 86));

  const storeX = 875;
  const storeY = 1100;
  const store = makeStorehouse(layers.structures, storeX, storeY);
  entities.push(entity(store, "storehouse", "Spichlerz", "building", "Centralny magazyn żywności. Produkty trafiają tu pieszo z gospodarstw.", "GOSPODARKA · SPICHLERZ", storeX, storeY, 100));
  const stockpile = createStorageBuilding(layers.structures, "stockpile", 0, 715, 1080);
  entities.push(stockpile);
  for (const [index, node] of HUNTING_NODES.entries()) {
    addGlyph(layers.details, { char: "♞", x: node.x, y: node.y, size: 23, color: "#c2ad83", alpha: 0.88, stroke: "#10140f", strokeWidth: 1 });
    addWord(layers.details, "JELENIE " + (index + 1), node.x, node.y + 20, 7, "#c2ad83", 0.72);
  }

  const guard = makeUnit(layers.actors, 1090, 660, 0, 12);
  entities.push(entity(guard, "guard", "Straż zamkowa", "unit", "Zawodowi obrońcy twierdzy. Utrzymują pozycję i czekają na rozkazy.", "PIKINIERZY · ODDZIAŁ", 1090, 660, 100, 12, "player", "pikemen"));

  const archers = makeUnit(layers.actors, 1515, 825, 1, 8);
  entities.push(entity(archers, "archers", "Łucznicy z doliny", "unit", "Lekka piechota dystansowa. Najskuteczniejsza na murach i w osłonie terenu.", "ŁUCZNICY · ODDZIAŁ", 1515, 825, 92, 8, "player", "archers"));

  const riders = makeUnit(layers.actors, 775, 1300, 2, 5);
  entities.push(entity(riders, "riders", "Zwiadowcy", "unit", "Ruchliwy oddział patrolowy. Może szybko dotrzeć do odległych części posiadłości.", "ZWIADOWCY · KONNI", 775, 1300, 100, 5, "player", "cavalry"));

  const raiders = makeUnit(layers.actors, 2150, 1050, 3, 9, "raiders", "enemy");
  const raiderUnit = entity(raiders, "raiders", "Banda rozbójników", "unit", "Wrogi oddział grasujący przy trakcie. Czerwone sztandary oznaczają nieprzyjaciela.", "ROZBÓJNICY · WROGI ODDZIAŁ", 2150, 1050, 100, 9, "enemy", "raiders");
  raiderUnit.stance = "aggressive";
  entities.push(raiderUnit);

  const playerLord = createCombatSquad(layers.actors, "lord", "lord", 1, 1240, 890, "player");
  playerLord.lordSide = "player";
  playerLord.attackDamage = 16;
  playerLord.attackRange = 52;
  playerLord.moveSpeed = 88;
  playerLord.stance = "defensive";
  playerLord.stanceReturnTarget = { x: playerLord.x, y: playerLord.y };
  entities.push(playerLord);

  const enemyLord = createCombatSquad(layers.actors, "enemy-lord", "lord", 1, 2310, 930, "enemy");
  enemyLord.lordSide = "enemy";
  enemyLord.attackDamage = 16;
  enemyLord.attackRange = 52;
  enemyLord.moveSpeed = 88;
  enemyLord.stance = "stand-ground";
  enemyLord.holdPosition = true;
  entities.push(enemyLord);

  return { entities, layers, grid, setFlattened };
}

export function createWatchtower(parent: Container, x: number, y: number, index: number): GameEntity {
  const group = new Container();
  parent.addChild(group);
  drawTeutonicAsset(group, "watchtower", 0, -4, { scale: 1.12, faction: "order", label: "WIEŻA" });
  group.position.set(x, y);
  return entity(group, `watchtower-${index}`, "Wieża strażnicza", "building", "Posterunek obserwacyjny nad traktem. Zwiększa kontrolę nad okolicą i ostrzega przed zagrożeniem.", "OBRONA · POSTERUNEK", x, y, 100);
}

export const WORLD_SIZE = { width: WORLD_WIDTH, height: WORLD_HEIGHT };


export type TownBuildingType = "hovel" | "chapel" | "church" | "cathedral" | "inn" | "good" | "bad";

export function createTownBuilding(
  parent: Container,
  type: TownBuildingType,
  index: number,
  x: number,
  y: number
): GameEntity {
  const group = new Container();
  parent.addChild(group);
  const visuals: Record<TownBuildingType, { glyph: string; name: string; role: string; color: string; label: string }> = {
    hovel: { glyph: "⌂", name: "Chata", role: "MIESZKANIE · +8 MIEJSC", color: "#b78b58", label: "CHATA" },
    chapel: { glyph: "✝", name: "Kaplica", role: "RELIGIA · KSIĄDZ", color: "#c5b7df", label: "KAPLICA" },
    church: { glyph: "✝", name: "Kościół", role: "RELIGIA · +1 POPULARNOŚCI", color: "#e0c77e", label: "KOŚCIÓŁ" },
    cathedral: { glyph: "♜", name: "Katedra", role: "RELIGIA · +2 POPULARNOŚCI", color: "#e3d3a4", label: "KATEDRA" },
    inn: { glyph: "♨", name: "Gospoda", role: "GOSPODA · 1 KARCZMARZ", color: "#d4ab69", label: "GOSPODA" },
    good: { glyph: "✿", name: "Ogród", role: "DOBRA RZECZ · STRACH", color: "#79c77e", label: "OGRÓD" },
    bad: { glyph: "†", name: "Szubienica", role: "ZŁA RZECZ · STRACH", color: "#d16d65", label: "SZUBIENICA" }
  };
  const visual = visuals[type];
  const townArt: Record<TownBuildingType, TeutonicAssetKind> = {
    hovel: "hovel", chapel: "chapel", church: "church", cathedral: "cathedral",
    inn: "inn", good: "garden", bad: "gallows"
  };
  drawTeutonicAsset(group, townArt[type], 0, -4, {
    scale: type === "cathedral" ? 1.0 : 0.95,
    faction: type === "good" || type === "bad" ? "neutral" : "order",
    label: visual.label
  });
  group.position.set(x, y);
  const id = type === "good" || type === "bad" ? `fear-${type}-${index}` : `${type}-${index}`;
  const description: Record<TownBuildingType, string> = {
    hovel: "Miejsce zamieszkania dla ośmiu dodatkowych chłopów.",
    chapel: "Kapłan chodzi po zamku i błogosławi napotkanych mieszkańców.",
    church: "Kapłan błogosławi mieszkańców; co najmniej jeden kościół daje +1 popularności.",
    cathedral: "Kapłan błogosławi mieszkańców; katedra daje +2 popularności.",
    inn: "Karczmarz obsługuje do trzydziestu mieszkańców; bonus wymaga piwa dostarczonego ze Składu.",
    good: "Obiekt Dobrych Rzeczy podnosi współczynnik strachu, popularność i obrażenia, ale obniża wydajność pracy.",
    bad: "Obiekt Złych Rzeczy obniża współczynnik strachu i obrażenia, ale zwiększa wydajność pracy."
  };
  return entity(group, id, visual.name, "building", description[type], visual.role, x, y, 100);
}

export function createStorageBuilding(
  parent: Container,
  type: StorageType,
  index: number,
  x: number,
  y: number,
  module = false
): GameEntity {
  const group = new Container();
  parent.addChild(group);
  const visuals: Record<StorageType, { glyph: string; name: string; role: string; color: string; label: string }> = {
    stockpile: { glyph: "▥", name: "Skład", role: "MAGAZYN · SUROWCE", color: "#d1b27b", label: "SKŁAD" },
    granary: { glyph: "▤", name: "Spichlerz", role: "MAGAZYN · ŻYWNOŚĆ", color: "#c2a36a", label: "SPICHLERZ" },
    armory: { glyph: "⚔", name: "Zbrojownia", role: "MAGAZYN · UZBROJENIE", color: "#9eb1c1", label: "ZBROJOWNIA" }
  };
  const visual = visuals[type];
  const storageArt: Record<StorageType, TeutonicAssetKind> = {
    stockpile: "stockpile", granary: "granary", armory: "armory"
  };
  drawTeutonicAsset(group, storageArt[type], 0, -4, {
    scale: 0.95, faction: "order", label: module ? "MODUŁ" : visual.label
  });
  if (module) addGlyph(group, { char: "╫", x: 0, y: 12, size: 24, color: "#b9a16e", alpha: 0.9 });
  group.position.set(x, y);
  const id = module ? `${type}-module-${index}` : index === 0 && type === "stockpile" ? "stockpile" : `${type}-${index}`;
  return entity(
    group, id, module ? "Moduł · " + visual.name : visual.name, "building",
    module ? "Dodatkowy moduł magazynu. Zwiększa liczbę dostępnych pól składowania." : "Fizyczny magazyn. Towary zajmują pola i muszą być dostarczone przez pracowników.",
    module ? "MAGAZYN · ROZBUDOWA" : visual.role, x, y, 100
  );
}

export type LogisticsBuildingType = ProductionType | "ox-tether" | "market";

export function createProductionBuilding(
  parent: Container,
  type: LogisticsBuildingType,
  index: number,
  x: number,
  y: number
): GameEntity {
  const group = new Container();
  parent.addChild(group);
  const visuals: Record<LogisticsBuildingType, { glyph: string; name: string; color: string; role: string }> = {
    woodcutter: { glyph: "♧", name: "Chata drwala", color: "#82c486", role: "PRZEMYSŁ · DREWNO" },
    quarry: { glyph: "◈", name: "Kamieniołom", color: "#bbc1c4", role: "PRZEMYSŁ · KAMIEŃ" },
    "iron-mine": { glyph: "◆", name: "Kopalnia żelaza", color: "#d68b5c", role: "PRZEMYSŁ · ŻELAZO" },
    "pitch-worker": { glyph: "◉", name: "Warsztat smolarza", color: "#b0a4a0", role: "PRZEMYSŁ · SMOŁA" },
    "apple-orchard": { glyph: "♧", name: "Sad jabłoni", color: "#80c77d", role: "ROLNICTWO · JABŁKA" },
    hunter: { glyph: "♜", name: "Chata myśliwego", color: "#c4b18a", role: "ROLNICTWO · MIĘSO" },
    "dairy-farm": { glyph: "♉", name: "Farma mleczna", color: "#d8d0b1", role: "ROLNICTWO · SER" },
    "wheat-farm": { glyph: "✧", name: "Farma pszenicy", color: "#d7bd65", role: "ROLNICTWO · PSZENICA" },
    "hop-farm": { glyph: "❧", name: "Farma chmielu", color: "#80ba76", role: "ROLNICTWO · CHMIEL" },
    mill: { glyph: "✣", name: "Młyn", color: "#d2b277", role: "PRZETWÓRSTWO · MĄKA" },
    bakery: { glyph: "♨", name: "Piekarnia", color: "#dc9e63", role: "PRZETWÓRSTWO · CHLEB" },
    brewery: { glyph: "♜", name: "Browar", color: "#d7b86f", role: "PRZETWÓRSTWO · PIWO" },
    bowyer: { glyph: "⌒", name: "Łuczarz", color: "#c4a16d", role: "BROŃ · ŁUKI" },
    poleturner: { glyph: "†", name: "Drzewcarz", color: "#b99b6a", role: "BROŃ · DRZEWCE" },
    blacksmith: { glyph: "⚒", name: "Kowal", color: "#abb5bf", role: "BROŃ · METAL" },
    tanner: { glyph: "▤", name: "Garbarz", color: "#bc8b61", role: "BROŃ · SKÓRY" },
    armourer: { glyph: "♢", name: "Płatnerz", color: "#aebac7", role: "BROŃ · PANCERZE" },
    "ox-tether": { glyph: "♉", name: "Uwiąz wołu", color: "#b9a17c", role: "TRANSPORT · KAMIEŃ" },
    market: { glyph: "⚖", name: "Targowisko", color: "#d0b06e", role: "HANDEL · RĘCZNY" }
  };
  const visual = visuals[type];
  const productionArt: Record<LogisticsBuildingType, TeutonicAssetKind> = {
    woodcutter: "woodcutter", quarry: "quarry", "iron-mine": "mine", "pitch-worker": "pitch",
    "apple-orchard": "orchard", hunter: "hunter", "dairy-farm": "dairy-farm",
    "wheat-farm": "wheat-farm", "hop-farm": "hop-farm", mill: "mill", bakery: "bakery",
    brewery: "brewery", bowyer: "bowyer", poleturner: "poleturner", blacksmith: "smithy",
    tanner: "tannery", armourer: "armourer", "ox-tether": "ox-tether", market: "market"
  };
  drawTeutonicAsset(group, productionArt[type], 0, -4, {
    scale: 0.94, faction: "order", label: visual.name.toLocaleUpperCase("pl-PL").slice(0, 13)
  });
  group.position.set(x, y);
  return entity(group, `${type}-${index}`, visual.name, "building", "Pracownicy wykonują cykl produkcyjny i pieszo dostarczają towary do właściwego magazynu.", visual.role, x, y, 100);
}