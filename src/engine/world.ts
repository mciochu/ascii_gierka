import { Container, Text } from "pixi.js";
import { addGlyph, addWord } from "./glyph";
import { createWorldGrid, GRID_PIVOT, worldPositionForCell, type WorldGrid } from "./grid";

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
      color: rand() > 0.5 ? "#9a6b45" : "#c08a55",
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
      color: rand() > 0.55 ? "#197eb5" : "#38a8dd",
      alpha: 0.42 + rand() * 0.2,
      rotation: -0.22
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
      color: "#6bd4e4",
      alpha: 0.55
    });
  }
}

function addTerrain(layers: WorldLayers): void {
  const rand = random(1204);
  const grass = ["·", "˙", "‚", "⁙", "⸱", "∙", "'", "٫"];
  const sands = ["#a98a61", "#b99a70", "#c5a77c", "#8f754f", "#d0b386"];
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
      color: rand() > 0.5 ? "#8998a5" : "#c0cad1",
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
        color: "#b28a4b",
        alpha: 0.42
      });
    }
  }
}

function addGridTerrain(layers: WorldLayers, grid: WorldGrid): { glyph: Text; rise: number }[] {
  const elevationMarks: { glyph: Text; rise: number }[] = [];
  const symbols: Record<string, { char: string; color: string; alpha: number }> = {
    sand: { char: "·", color: "#b69a70", alpha: 0.20 },
    oasis: { char: "❧", color: "#80c66f", alpha: 0.52 },
    forest: { char: "♣", color: "#276d3b", alpha: 0.56 },
    water: { char: "≈", color: "#55b6df", alpha: 0.72 },
    hill: { char: "﹏", color: "#c5a36d", alpha: 0.43 },
    cliff: { char: "▲", color: "#c0cbd2", alpha: 0.70 },
    stone: { char: "◈", color: "#d0d5d9", alpha: 0.74 },
    iron: { char: "◆", color: "#c98257", alpha: 0.78 },
    tar: { char: "◉", color: "#384344", alpha: 0.72 },
    moat: { char: "⌁", color: "#4aa9d5", alpha: 0.8 }
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
      alpha: mark.alpha
    });
    elevationMarks.push({ glyph, rise });
    if (tile.terrain === "cliff") {
      const lowerGlyph = addGlyph(layers.terrain, {
        char: "▰",
        x: point.x,
        y: point.y + 8,
        size: 12,
        color: "#667783",
        alpha: 0.55
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
    addGlyph(group, { char: "║", x: -103 + (rand() - 0.5) * 3, y: dy, size: 19, color: "#d4dde2" });
    addGlyph(group, { char: "║", x: 103 + (rand() - 0.5) * 3, y: dy, size: 19, color: "#d4dde2" });
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

function makeUnit(parent: Container, x: number, y: number, variant: number): Container {
  const group = new Container();
  parent.addChild(group);
  const offsets = variant === 0
    ? [[-17, 7], [0, -5], [16, 8], [2, 17]]
    : variant === 1
      ? [[-12, -9], [9, -12], [-2, 10]]
      : [[-18, 0], [0, -10], [18, 3], [5, 18]];
  offsets.forEach(([ox, oy], index) => {
    addGlyph(group, {
      char: index === 1 && variant === 0 ? "♞" : "♟",
      x: ox,
      y: oy,
      size: index === 1 ? 28 : 23,
      color: variant === 3 ? "#f07869" : variant === 1 ? "#a5d6f1" : "#74c7f5",
      stroke: "#263328",
      strokeWidth: 1,
      alpha: 0.96
    });
  });
  addGlyph(group, { char: "⚑", x: 0, y: -27, size: 16, color: variant === 3 ? "#f05252" : variant === 2 ? "#e4bd63" : "#75c9f3" });
  group.position.set(x, y);
  return group;
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
  return {
    group, id, name, kind, description, role, x, y, health, maxHealth: 100, count, team, unitClass,
    moveSpeed: unitClass === "cavalry" ? 142 : unitClass === "archers" ? 82 : 94,
    attackDamage: unitClass === "archers" ? 11 : unitClass === "cavalry" ? 14 : 9,
    attackRange: unitClass === "archers" ? 150 : unitClass === "cavalry" ? 48 : 55
  };
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
  entities.push(entity(store, "storehouse", "Spichlerz", "building", "Centralny magazyn zapasów. Utrzymanie zapasów jest kluczem do długiego oblężenia.", "GOSPODARKA · MAGAZYN", storeX, storeY, 100));

  const guard = makeUnit(layers.actors, 1090, 660, 0);
  entities.push(entity(guard, "guard", "Straż zamkowa", "unit", "Zawodowi obrońcy twierdzy. Utrzymują pozycję i czekają na rozkazy.", "PIKINIERZY · ODDZIAŁ", 1090, 660, 100, 12, "player", "pikemen"));

  const archers = makeUnit(layers.actors, 1515, 825, 1);
  entities.push(entity(archers, "archers", "Łucznicy z doliny", "unit", "Lekka piechota dystansowa. Najskuteczniejsza na murach i w osłonie terenu.", "ŁUCZNICY · ODDZIAŁ", 1515, 825, 92, 8, "player", "archers"));

  const riders = makeUnit(layers.actors, 775, 1300, 2);
  entities.push(entity(riders, "riders", "Zwiadowcy", "unit", "Ruchliwy oddział patrolowy. Może szybko dotrzeć do odległych części posiadłości.", "ZWIADOWCY · KONNI", 775, 1300, 100, 5, "player", "cavalry"));

  const raiders = makeUnit(layers.actors, 2150, 1050, 3);
  entities.push(entity(raiders, "raiders", "Banda rozbójników", "unit", "Wrogi oddział grasujący przy trakcie. Czerwone sztandary oznaczają nieprzyjaciela.", "ROZBÓJNICY · WROGI ODDZIAŁ", 2150, 1050, 100, 9, "enemy", "raiders"));

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
  addGlyph(group, { char: type === "hovel" ? "⌂" : type === "bad" ? "†" : visual.glyph, x: 0, y: -7, size: type === "cathedral" ? 43 : 36, color: visual.color, weight: "bold", stroke: "#080a0b", strokeWidth: 1 });
  if (type !== "good" && type !== "bad") {
    addGlyph(group, { char: type === "hovel" ? "╱" : "═", x: 0, y: 8, size: 31, color: "#a9b5b9", alpha: 0.8 });
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