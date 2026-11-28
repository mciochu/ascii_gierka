import test from "node:test";
import assert from "node:assert/strict";
import { canRecruitUnit, resolveLordOutcome, RECRUITMENT_RECIPES } from "../src/engine/warfare.ts";

test("rekrutacja wymaga aktywnej rozgrywki, chłopa i właściwej broni", () => {
  assert.equal(canRecruitUnit("archers", 1, 1), true);
  assert.equal(canRecruitUnit("crossbowmen", 1, 1), true);
  assert.equal(canRecruitUnit("pikemen", 1, 1), true);
  assert.equal(canRecruitUnit("swordsmen", 1, 1), true);
  assert.equal(canRecruitUnit("archers", 0, 1), false);
  assert.equal(canRecruitUnit("archers", 1, 0), false);
  assert.equal(canRecruitUnit("archers", 1, 1, "victory"), false);
  assert.equal(canRecruitUnit("archers", 1, 1, "defeat"), false);
});

test("każda klasa wymaga broni zgodnej z recepturą", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(RECRUITMENT_RECIPES).map(([key, value]) => [key, value.weapon])), {
    archers: "bow", crossbowmen: "crossbow", pikemen: "pike", swordsmen: "sword"
  });
});

test("śmierć Lorda rozstrzyga zwycięstwo, porażkę lub remis", () => {
  assert.equal(resolveLordOutcome(true, true), "playing");
  assert.equal(resolveLordOutcome(true, false), "victory");
  assert.equal(resolveLordOutcome(false, true), "defeat");
  assert.equal(resolveLordOutcome(false, false), "draw");
});
