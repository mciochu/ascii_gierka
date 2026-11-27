import { Container } from "pixi.js";
import { addGlyph, addWord } from "./glyph";

export type EntityKind = "building" | "unit";
export type Faction = "player" | "enemy" | "neutral";

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

function addTree(parent: Container, x: number, y: number, scale: number, seed: number): void {
  const rand = random(seed);
  const canopy = ["♣", "♧", "♠", "❧"];
  const greens = ["#176b35", "#278b45", "#38a958", "#1d753b", "#5a9c51"];
  const count = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = rand() * 17 * scale;
    addGlyph(parent, {
      char: canopy[Math.floor(rand() * canopy.length)] ?? "♣",
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      size: (18 + rand() * 13) * scale,
      color: greens[Math.floor(rand() * greens.length)] ?? "#547c50",
      alpha: 0.78 + rand() * 0.2,
      rotation: (rand() - 0.5) * 0.35
    });
  }
  addGlyph(parent, {
    char: "│",
    x: x + (rand() - 0.5) * 5,
    y: y + 15 * scale,
    size: 12 * scale,
    color: "#a86f43",
    alpha: 0.8
  });
  if (rand() > 0.48) {
    addGlyph(parent, {
      char: "·",
      x: x + (rand() - 0.5) * 35 * scale,
      y: y + (rand() - 0.5) * 32 * scale,
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
    addGlyph(parent, {
      char: ["·", "⸱", "∙", "╌", "‚"][Math.floor(rand() * 5)] ?? "·",
      x: x + spread,
      y: y + (rand() - 0.5) * 18,
      size: 10 + rand() * 8,
      color: rand() > 0.5 ? "#9a6b45" : "#c08a55",
      alpha: 0.42 + rand() * 0.25
    });
  }
}

function addRiver(parent: Container): void {
  const rand = random(8071);
  for (let i = 0; i < 105; i += 1) {
    const t = i / 104;
    const x = 1720 + t * 610 + Math.sin(t * 8) * 68;
    const y = 130 + t * 540 + Math.sin(t * 5.5) * 44;
    const spread = (rand() - 0.5) * 125;
    addGlyph(parent, {
      char: ["≈", "∿", "﹏", "~", "〜"][Math.floor(rand() * 5)] ?? "≈",
      x: x + spread,
      y: y + (rand() - 0.5) * 30,
      size: 16 + rand() * 16,
      color: rand() > 0.55 ? "#197eb5" : "#38a8dd",
      alpha: 0.42 + rand() * 0.2,
      rotation: -0.22
    });
  }
  for (let i = 0; i < 42; i += 1) {
    const t = i / 42;
    addGlyph(parent, {
      char: "·",
      x: 1712 + t * 620 + Math.sin(t * 8) * 68 + (rand() - 0.5) * 40,
      y: 120 + t * 540 + Math.sin(t * 5.5) * 44 + (rand() - 0.5) * 130,
      size: 7 + rand() * 9,
      color: "#6bd4e4",
      alpha: 0.55
    });
  }
}

function addTerrain(layers: WorldLayers): void {
  const rand = random(1204);
  const grass = ["·", "˙", "‚", "⁙", "⸱", "∙", "'", "٫"];
  const greens = ["#1b7c3d", "#278b47", "#45a859", "#286a36", "#76c56e", "#3d934e"];
  for (let i = 0; i < 680; i += 1) {
    const x = rand() * WORLD_WIDTH;
    const y = rand() * WORLD_HEIGHT;
    const size = 7 + rand() * 11;
    addGlyph(layers.terrain, {
      char: grass[Math.floor(rand() * grass.length)] ?? "·",
      x,
      y,
      size,
      color: greens[Math.floor(rand() * greens.length)] ?? "#607b55",
      alpha: 0.25 + rand() * 0.43,
      rotation: (rand() - 0.5) * 1.2
    });
  }

  addRiver(layers.details);
  addQuadraticPath(layers.details, { x: 100, y: 1015 }, { x: 630, y: 1080 }, { x: 1190, y: 930 }, 115, 91);
  addQuadraticPath(layers.details, { x: 1190, y: 930 }, { x: 1370, y: 1190 }, { x: 1510, y: 1660 }, 83, 92);
  addQuadraticPath(layers.details, { x: 1190, y: 930 }, { x: 1280, y: 630 }, { x: 1610, y: 480 }, 67, 93);

  addForest(layers.details, 390, 390, 245, 180, 33);
  addForest(layers.details, 2060, 1305, 245, 200, 39);
  addForest(layers.details, 2200, 550, 170, 140, 45);
  addForest(layers.details, 580, 1510, 185, 140, 51);

  for (let i = 0; i < 74; i += 1) {
    const x = 1550 + rand() * 360;
    const y = 1260 + rand() * 360;
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
      const x = 360 + col * 25 + (rand() - 0.5) * 12 + row * 3;
      const y = 1190 + row * 22 + Math.sin(col * 0.55) * 8 + (rand() - 0.5) * 8;
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

  addTerrain(layers);
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

  const raiders = makeUnit(layers.actors, 1890, 945, 3);
  entities.push(entity(raiders, "raiders", "Banda rozbójników", "unit", "Wrogi oddział grasujący przy trakcie. Czerwone sztandary oznaczają nieprzyjaciela.", "ROZBÓJNICY · WROGI ODDZIAŁ", 1890, 945, 100, 9, "enemy", "raiders"));

  return { entities, layers };
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
