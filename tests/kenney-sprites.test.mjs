import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Container } from "pixi.js";
import {
  drawTeutonicAsset,
  TEUTONIC_ASSET_KINDS
} from "../src/engine/teutonic-art.ts";

const unitKinds = new Set([
  "knight", "sergeant", "spearman", "crossbowman", "archer", "cavalry", "villager",
  "priest", "lord", "banner-bearer", "scout", "engineer", "miner", "messenger"
]);

test("Teutonic visual catalogue contains a broad, unique medieval asset library", () => {
  assert.ok(TEUTONIC_ASSET_KINDS.length >= 60);
  assert.equal(new Set(TEUTONIC_ASSET_KINDS).size, TEUTONIC_ASSET_KINDS.length);
  for (const required of [
    "keep", "barbican", "watchtower", "gate", "monastery", "cathedral",
    "woodcutter", "quarry", "mine", "mill", "smithy", "market",
    "trebuchet", "mangonel", "siege-tower", "battering-ram",
    "knight", "spearman", "crossbowman", "cavalry", "lord"
  ]) assert.ok(TEUTONIC_ASSET_KINDS.includes(required), required);
});

test("every catalogue entry renders a detailed glyph composition with valid bounds", () => {
  for (const kind of TEUTONIC_ASSET_KINDS) {
    const parent = new Container();
    const stats = drawTeutonicAsset(parent, kind, 120, 80, {
      faction: "order",
      scale: unitKinds.has(kind) ? 0.42 : 0.72,
      entityId: "art-test:" + kind
    });
    assert.ok(stats.width >= 7, kind);
    assert.ok(stats.height >= 5, kind);
    assert.ok(stats.glyphs >= 20, kind);
    assert.ok(parent.children.length >= 15, kind);
    assert.ok(parent.children.every(child =>
      Number.isFinite(child.position.x) && Number.isFinite(child.position.y)
    ), kind);
    parent.destroy({ children: true });
  }
});

test("the keep, cathedral and siege tower are genuinely high-detail assets", () => {
  const minimums = { keep: 240, cathedral: 180, "siege-tower": 100 };
  for (const [kind, minimum] of Object.entries(minimums)) {
    const parent = new Container();
    const stats = drawTeutonicAsset(parent, kind, 0, 0, { scale: 0.8 });
    assert.ok(stats.glyphs >= minimum, kind + " has only " + stats.glyphs + " glyphs");
    parent.destroy({ children: true });
  }
});

test("Order, Polish and enemy heraldry is kept faction-specific", () => {
  const order = new Container();
  const polish = new Container();
  const enemy = new Container();
  drawTeutonicAsset(order, "knight", 0, 0, { faction: "order" });
  drawTeutonicAsset(polish, "knight", 0, 0, { faction: "polish" });
  drawTeutonicAsset(enemy, "knight", 0, 0, { faction: "enemy" });
  assert.ok(order.children.some(child => child.text === "✠"));
  assert.ok(!polish.children.some(child => child.text === "✠"));
  assert.ok(!enemy.children.some(child => child.text === "✠"));
  assert.ok(polish.children.some(child => child.text === "♞"));
  assert.ok(enemy.children.some(child => child.text === "▣"));
  order.destroy({ children: true });
  polish.destroy({ children: true });
  enemy.destroy({ children: true });
});

test("world buildings, fortifications and units use the redesigned Teutonic library", async () => {
  const world = await readFile(new URL("../src/engine/world.ts", import.meta.url), "utf8");
  const art = await readFile(new URL("../src/engine/teutonic-art.ts", import.meta.url), "utf8");
  assert.ok(world.includes('import { drawTeutonicAsset, type TeutonicAssetKind } from "./teutonic-art";'));
  assert.ok(world.includes('drawTeutonicAsset(group, unitArt[role] ?? "sergeant"'));
  assert.ok(world.includes('const townArt: Record<TownBuildingType, TeutonicAssetKind>'));
  assert.ok(world.includes('const productionArt: Record<LogisticsBuildingType, TeutonicAssetKind>'));
  assert.ok(world.includes('drawTeutonicAsset(group, "keep"'));
  assert.ok(world.includes('drawTeutonicAsset(group, "barracks"'));
  assert.ok(world.includes('drawTeutonicAsset(group, "mill"'));
  assert.ok(world.includes('drawTeutonicAsset(group, "granary"'));
  assert.ok(world.includes('isGate ? "gate" : "wall"'));
  assert.ok(world.includes('lod: "standard"'));
  assert.ok(art.includes('char: "✠"'));
  assert.ok(art.includes('const HERALDIC'));
  assert.ok(!world.includes("addKenneySprite"));
});

test("the former neon overlay is gone and the interface uses the same medieval materials as the world", async () => {
  const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(css.includes("--oxblood: #96372f"));
  assert.ok(css.includes("--gold: #d1b16e"));
  assert.ok(css.includes("linear-gradient(180deg, #191811"));
  assert.ok(css.includes("@media (max-width: 940px)"));
  assert.ok(!css.toLowerCase().includes("#00e5ff"));
  assert.ok(!css.toLowerCase().includes("#00ff9d"));
  assert.ok(html.includes("POGRANICZE PRUSKIE"));
  assert.ok(html.includes("ROK PAŃSKI 1320"));
});