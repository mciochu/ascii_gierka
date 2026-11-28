[Reading 847 lines from start (total: 847 lines, 0 remaining)]

import { Container } from "pixi.js";
import { addGlyph, addWord, GlyphDisplay, type GlyphLodSet } from "./glyph";
import { addKenneySprite } from "./kenney-sprites";
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
  const greens = ["#176b35", "#278b45", "#38a958", "#1d753b", "#5a9c51"];
  const count = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = rand() * 17 * scale;
    const leafX = x + Math.cos(angle) * radius;
    const leafY = y + Math.sin(angle) * radius;
    if (!insideWorldDiamond(leafX, leafY)) continue;
    addGlyph(parent, {
      char: canopy[Math.floor(rand() * canopy.length)] ?? "♣",
      x: leafX,
      y: leafY,
      size: (18 + rand() * 13) * scale,
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
    color: "#a86f43",
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
      color: "#66c96f",
      alpha: 0.85
    });
  }
}

function addForest(parent: Container, centerX: number, centerY: number, radiusX: number, radiusY: number, seed: number): void {
  const rand = random(seed);
  const count = 13 + Math.floor(rand() * 10);
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
      color: "#3d9b54",
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
      color: rand() > 0.5 ? "#171b20" : "#20242a",
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
      color: rand() > 0.55 ? "#115475" : "#17658b",
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
      color: "#287b9b",
      alpha: 0.55,
      material: "terrain", height: 0.02, animated: true, entityId: "terrain:water"
    });
  }
}

function addTerrain(layers: WorldLayers): void {
  const rand = random(1204);
  const grass = ["·", "˙", "‚", "⁙", "⸱", "∙", "'", "٫"];
  const sands = ["#080c12", "#0b1017", "#101720", "#0d131a", "#111821"];
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
      color: rand() > 0.5 ? "#596977" : "#8494a2",
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
    sand: { char: "·", color: "#0b1118", alpha: 0.26 },
    oasis: { char: "❧", color: "#23694f", alpha: 0.52 },
    forest: { char: "♣", color: "#1c5a3d", alpha: 0.56 },
    water: { char: "≈", color: "#135475", alpha: 0.72 },
    hill: { char: "﹏", color: "#202a35", alpha: 0.43 },
    cliff: { char: "▲", color: "#788995", alpha: 0.70 },
    stone: { char: "◈", color: "#78838c", alpha: 0.74 },
    iron: { char: "◆", color: "#9a4528", alpha: 0.78 },
    tar: { char: "◉", color: "#39234e", alpha: 0.72 },
    moat: { char: "⌁", color: "#145a78", alpha: 0.8 }
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
        color: "#46545e",
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
  const rand = random(77);
  for (let dx = -99; dx <= 99; dx += 14) {
    addGlyph(group, { char: dx % 2 === 0 ? "━" : "═", x: dx + (rand() - 0.5) * 2, y: -67 + (rand() - 0.5) * 3, size: 20, color: "#c0c9d1", alpha: 0.95 });
    addGlyph(group, { char: "━", x: dx + (rand() - 0.5) * 2, y: 68 + (rand() - 0.5) * 3, size: 20, color: "#9daab5", alpha: 0.9 });
  }
  for (let dy = -54; dy <= 54; dy += 13) {
    addGlyph(group, {
      char: "║", x: -103 + (rand() - 0.5) * 3, y: dy, size: 19, color: "#d4dde2",
      normal: [-0.8, 0.0, 0.6], height: 0.76, material: "building"
    });
    addGlyph(group, {
      char: "║", x: 103 + (rand() - 0.5) * 3, y: dy, size: 19, color: "#d4dde2",
      normal: [0.8, 0.0, 0.6], height: 0.76, material: "building"
    });
  }
  const towers = [[-103, -68], [103, -68], [-103, 68], [103, 68]];
  for (const [tx, ty] of towers) {
    addGlyph(group, { char: "▥", x: tx, y: ty, size: 39, color: "#d2dae0", weight: "bold", stroke: "#6d715c", strokeWidth: 1 });
    addGlyph(group, { char: "╬", x: tx, y: ty - 20, size: 17, color: "#eff4f6" });
  }
  addGlyph(group, { char: "╧", x: 0, y: 67, size: 24, color: "#d2bd8c" });
  addGlyph(group, { char: "▤", x: -33, y: -5, size: 61, color: "#ae794a", alpha: 0.78 });
  addGlyph(group, { char: "▥", x: 24, y: -8, size: 55, color: "#c38b52", alpha: 0.82 });
  addWord(group, "DONJON", 0, 26, 12, "#f2d18a", 0.78);
  addWord(group, "CASTELLUM", 0, 91, 9, "#e0be7b", 0.77);
  group.position.set(x, y);
  return group;
}

function makeBarracks(parent: Container, x: number, y: number): Container {
  const group = new Container();
  parent.addChild(group);
  addGlyph(group, { char: "╔", x: -38, y: -25, size: 25, color: "#bdc8d0" });
  addGlyph(group, { char: "╗", x: 38, y: -25, size: 25, color: "#bdc8d0" });
  addGlyph(group, { char: "╚", x: -38, y: 25, size: 25, color: "#bdc8d0" });
  addGlyph(group, { char: "╝", x: 38, y: 25, size: 25, color: "#bdc8d0" });
  for (let i = -2; i <= 2; i += 1) {
    addGlyph(group, { char: "▤", x: i * 13, y: -24 + Math.sin(i) * 3, size: 19, color: "#a7794d" });
  }
  addWord(group, "KOSZARY", 0, 2, 10, "#e5bd70", 0.75);
  addGlyph(group, { char: "⚑", x: 0, y: 21, size: 19, color: "#d79b53" });
  group.position.set(x, y);
  return group;
}

function makeMill(parent: Container, x: number, y: number): Container {
  const group = new Container();
  parent.addChild(group);
  addGlyph(group, { char: "╱", x: -20, y: -16, size: 35, color: "#c28a50" });
  addGlyph(group, { char: "╲", x: 20, y: -16, size: 35, color: "#c28a50" });
  addGlyph(group, { char: "╲", x: -20, y: 16, size: 35, color: "#98633e" });
  addGlyph(group, { char: "╱", x: 20, y: 16, size: 35, color: "#98633e" });
  addGlyph(group, { char: "✣", x: 0, y: 0, size: 37, color: "#e5c27a" });
  addGlyph(group, { char: "│", x: 0, y: 26, size: 36, color: "#a06d43" });
  addWord(group, "MŁYN", 0, 52, 9, "#e3b966", 0.8);
  group.position.set(x, y);
  return group;
}

function makeStorehouse(parent: Container, x: number, y: number): Container {
  const group = new Container();
  parent.addChild(group);
  for (const dx of [-28, -10, 10, 28]) {
    addGlyph(group, { char: "▥", x: dx + (dx % 3), y: -3 + Math.sin(dx) * 2, size: 34, color: "#aab6bd" });
  }
  addGlyph(group, { char: "╧", x: 0, y: 18, size: 31, color: "#a6b3bd" });
  addWord(group, "SPICHLERZ", 0, 39, 8, "#d8c28c", 0.73);
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
    ? "#f07869"
    : role === "archers" || role === "crossbowmen" ? "#a5d6f1"
      : role === "lord" ? "#e5c987" : "#74c7f5";
  const sourceVariant = Math.max(0, Math.min(5, variant));
  const factionRow = team === "enemy" || variant === 3 ? 1 : 0;
  const spriteNumber = factionRow * 6 + sourceVariant + 1;
  const spriteId = `medievalUnit_${String(spriteNumber).padStart(2, "0")}`;
  offsets.forEach(([ox, oy]) => {
    addKenneySprite(group, spriteId, ox, oy, {
      cellSize: 5.2, material: "unit", height: 0.24, lod: "close"
    });
    addKenneySprite(group, spriteId, ox, oy, {
      cellSize: 4.2, material: "unit", height: 0.24, lod: "standard"
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
    char: "⚑", x: 0, y: -27, size: 16,
    color: team === "enemy" || variant === 3 ? "#f05252" : role === "lord" ? "#e5c987" : "#75c9f3",
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
  if (id === "keep") return { char: "K", color: "#e5c987" };
  if (id === "barracks") return { char: "B", color: "#b9d1e5" };
  if (id === "mill") return { char: "M", color: "#d7bd85" };
  if (id === "storehouse" || id.startsWith("granary")) return { char: "S", color: "#cdbb8b" };
  if (id.startsWith("stockpile")) return { char: "▣", color: "#b9c9cf" };
  if (id.startsWith("armory")) return { char: "A", color: "#c6a9a0" };
  if (id.startsWith("watchtower")) return { char: "T", color: "#b9d1e5" };
  if (id.startsWith("market")) return { char: "$", color: "#e5c987" };
  if (id.startsWith("quarry")) return { char: "Q", color: "#b8b8b0" };
  if (id.startsWith("woodcutter") || id.startsWith("hunter")) return { char: "W", color: "#8fc58c" };
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
    moat: { name: "Fosa", glyph: "≈", color: "#4b9fc5", size: 37, health: 200 }
  };
  const visual = visuals[kind];
  if (kind === "moat") {
    addGlyph(group, { char: "≈", x: -9, y: 1, size: 26, color: "#317da2", alpha: 0.9, material: "terrain" });
    addGlyph(group, { char: "≈", x: 9, y: -3, size: 26, color: "#58b1d5", alpha: 0.86, material: "terrain" });
    addGlyph(group, { char: "·", x: 0, y: 8, size: 12, color: "#8ad8ec", alpha: 0.7, material: "terrain" });
  } else {
    addGlyph(group, { char: visual.glyph, x: 0, y: 0, size: visual.size, color: visual.color, weight: "bold", alpha: 0.97, material: "building", height: kind === "wall-high" ? 0.85 : 0.55 });
    if (kind === "wall-high") addGlyph(group, { char: "╥", x: 0, y: -17, size: 19, color: "#dbe3e7", alpha: 0.9, material: "building" });
    if (kind === "gate-small" || kind === "gate-large") addGlyph(group, { char: "⚑", x: 0, y: -19, size: 16, color: "#e8c37d", alpha: 0.95 });
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
  addGlyph(group, { char: "╔", x: -23, y: -25, size: 26, color: "#bdc8d1" });
  addGlyph(group, { char: "╗", x: 23, y: -25, size: 26, color: "#bdc8d1" });
  addGlyph(group, { char: "╚", x: -23, y: 25, size: 26, color: "#bdc8d1" });
  addGlyph(group, { char: "╝", x: 23, y: 25, size: 26, color: "#bdc8d1" });
  addGlyph(group, { char: "▥", x: -12, y: -8, size: 25, color: "#aab7c0" });
  addGlyph(group, { char: "▥", x: 12, y: -8, size: 25, color: "#aab7c0" });
  addGlyph(group, { char: "⚑", x: 0, y: -30, size: 19, color: "#e7bd68" });
  addWord(group, "WIEŻA", 0, 42, 9, "#e1bf74", 0.78);
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
  const spriteByType: Partial<Record<TownBuildingType, string>> = {
    hovel: "medievalStructure_18",
    chapel: "medievalStructure_04",
    church: "medievalStructure_04",
    cathedral: "medievalStructure_05",
    inn: "medievalStructure_03"
  };
  const spriteId = spriteByType[type];
  if (spriteId) {
    addKenneySprite(group, spriteId, 0, -8, { cellSize: 4.8, material: "building", height: 0.3 });
  } else {
    addGlyph(group, { char: type === "hovel" ? "⌂" : type === "bad" ? "†" : visual.glyph, x: 0, y: -7, size: type === "cathedral" ? 43 : 36, color: visual.color, weight: "bold", stroke: "#080a0b", strokeWidth: 1 });
    if (type !== "good" && type !== "bad") addGlyph(group, { char: type === "hovel" ? "╱" : "═", x: 0, y: 8, size: 31, color: "#a9b5b9", alpha: 0.8 });
  }
  addWord(group, visual.label, 0, 29, 7, visual.color, 0.76);
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
  const spriteByType: Record<StorageType, string> = {
    stockpile: "medievalStructure_03", granary: "medievalStructure_18", armory: "medievalStructure_05"
  };
  addKenneySprite(group, spriteByType[type], 0, -8, { cellSize: 4.8, material: "building", height: 0.3 });
  if (module) addGlyph(group, { char: "╫", x: 0, y: 12, size: 24, color: "#a9b5b9", alpha: 0.8 });
  addWord(group, module ? "MODUŁ" : visual.label, 0, 34, 8, visual.color, 0.86);
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
  const spriteByType: Partial<Record<LogisticsBuildingType, string>> = {
    woodcutter: "medievalStructure_18", quarry: "medievalStructure_09", "iron-mine": "medievalStructure_09",
    "pitch-worker": "medievalStructure_10", hunter: "medievalStructure_18",
    bakery: "medievalStructure_03", brewery: "medievalStructure_03", blacksmith: "medievalStructure_10",
    tanner: "medievalStructure_10", armourer: "medievalStructure_10", market: "medievalStructure_22"
  };
  const spriteId = spriteByType[type];
  if (spriteId) addKenneySprite(group, spriteId, 0, -8, { cellSize: 4.8, material: "building", height: 0.3 });
  else {
    addGlyph(group, { char: visual.glyph, x: 0, y: -8, size: 39, color: visual.color, weight: "bold", stroke: "#080a0b", strokeWidth: 1 });
    addGlyph(group, { char: "═", x: 0, y: 12, size: 32, color: "#a9b5b9", alpha: 0.8 });
  }
  addWord(group, visual.name.toLocaleUpperCase("pl-PL").slice(0, 13), 0, 34, 7, visual.color, 0.84);
  group.position.set(x, y);
  return entity(group, `${type}-${index}`, visual.name, "building", "Pracownicy wykonują cykl produkcyjny i pieszo dostarczają towary do właściwego magazynu.", visual.role, x, y, 100);
}

[executed on device: vps-d5543227 (f98401a2-4f25-449c-a7ff-f53738afd282)]