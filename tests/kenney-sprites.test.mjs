[Reading 40 lines from start (total: 40 lines, 0 remaining)]

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { KENNEY_GLYPH_SPRITES } from "../src/engine/kenney-sprites.generated.ts";

test("Kenney atlas is converted to 23 structures and 24 unit glyph sprites", () => {
  const keys = Object.keys(KENNEY_GLYPH_SPRITES);
  assert.equal(keys.filter((key) => key.startsWith("medievalStructure_")).length, 23);
  assert.equal(keys.filter((key) => key.startsWith("medievalUnit_")).length, 24);
});

test("every converted sprite has matching glyph and color grids with renderer-supported characters", () => {
  const supported = new Set([" ", "·", "░", "▒", "█"]);
  for (const [id, sprite] of Object.entries(KENNEY_GLYPH_SPRITES)) {
    assert.ok(sprite.width > 0 && sprite.height > 0, id);
    assert.equal(sprite.rows.length, sprite.height, id);
    assert.equal(sprite.colors.length, sprite.height, id);
    for (let row = 0; row < sprite.height; row += 1) {
      const glyphs = Array.from(sprite.rows[row] ?? "");
      const colors = sprite.colors[row] ?? [];
      assert.equal(glyphs.length, sprite.width, id);
      assert.equal(colors.length, sprite.width, id);
      for (let column = 0; column < sprite.width; column += 1) {
        assert.ok(supported.has(glyphs[column] ?? " "), id);
        assert.equal((glyphs[column] === " "), !Boolean(colors[column]), id);
      }
    }
  }
});

test("world buildings and combat squads render converted Kenney sprites through glyph nodes", async () => {
  const world = await readFile(new URL("../src/engine/world.ts", import.meta.url), "utf8");
  const helper = await readFile(new URL("../src/engine/kenney-sprites.ts", import.meta.url), "utf8");
  assert.ok(world.includes('import { addKenneySprite } from "./kenney-sprites";'));
  assert.ok(world.includes('addKenneySprite(group, spriteId, ox, oy'));
  assert.ok(world.includes('hovel: "medievalStructure_18"'));
  assert.ok(world.includes('church: "medievalStructure_04"'));
  assert.ok(helper.includes("addGlyph(parent"));
  assert.ok(helper.includes("No PNG, Canvas, texture, or sprite is used by the running game."));
});

[executed on device: vps-d5543227 (f98401a2-4f25-449c-a7ff-f53738afd282)]