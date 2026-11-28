import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Container } from "pixi.js";
import { drawTeutonicAsset } from "../src/engine/teutonic-art.ts";
const assets = ["keep","watchtower","wall","gate","barracks","stables","armory","stockpile","granary","hovel","chapel","church","cathedral","inn","woodcutter","quarry","mine","pitch","orchard","farm","mill","bakery","brewery","smithy","tannery","market","garden","gallows","knight","sergeant","spearman","crossbowman","archer","cavalry","villager","priest","lord"];
test("Teutonic catalogue renders every building, civilian and military family as glyph compositions", () => {
  assert.equal(assets.length, 37);
  for (const asset of assets) {
    const parent = new Container();
    drawTeutonicAsset(parent, asset, 0, 0, { faction: "order", scale: 1 });
    assert.ok(parent.children.length >= 8, asset);
    assert.ok(parent.children.every(child => Number.isFinite(child.position.x) && Number.isFinite(child.position.y)), asset);
    parent.destroy({ children: true });
  }
});
test("Order, Polish and enemy factions produce separate heraldic treatments", () => {
  for (const faction of ["order", "polish", "enemy"]) {
    const parent = new Container();
    drawTeutonicAsset(parent, "knight", 0, 0, { faction });
    assert.ok(parent.children.length > 10);
    parent.destroy({ children: true });
  }
});
test("world uses the Teutonic glyph asset pipeline instead of generic sprite assignments", async () => {
  const world = await readFile(new URL("../src/engine/world.ts", import.meta.url), "utf8");
  const art = await readFile(new URL("../src/engine/teutonic-art.ts", import.meta.url), "utf8");
  assert.ok(world.includes('import { drawTeutonicAsset, type TeutonicAssetKind } from "./teutonic-art";'));
  assert.ok(world.includes('drawTeutonicAsset(group, unitArt[role] ?? "sergeant"'));
  assert.ok(world.includes('const townArt: Record<TownBuildingType, TeutonicAssetKind>'));
  assert.ok(world.includes('const productionArt: Record<LogisticsBuildingType, TeutonicAssetKind>'));
  assert.ok(art.includes('char: "✠"'));
  assert.ok(!world.includes("addKenneySprite"));
});
