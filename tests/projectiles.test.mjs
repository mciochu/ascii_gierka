import test from "node:test";
import assert from "node:assert/strict";
import { advanceProjectile, projectileDuration, projectilePointAt } from "../src/engine/projectiles.ts";

test("pocisk przemieszcza się po prostej i kończy lot dokładnie na celu", () => {
  const start = { x: 10, y: 20 };
  const target = { x: 110, y: 70 };
  assert.deepEqual(projectilePointAt(start, target, 0), start);
  assert.deepEqual(projectilePointAt(start, target, 0.5), { x: 60, y: 45 });
  assert.deepEqual(projectilePointAt(start, target, 1), target);
});

test("czas lotu skaluje się z dystansem i zachowuje minimalną/maksymalną wartość", () => {
  assert.equal(projectileDuration(0, 600), 0.12);
  assert.equal(projectileDuration(600, 600), 1);
  assert.equal(projectileDuration(6000, 600), 1.2);
});

test("postęp lotu uwzględnia delta czasu i zatrzymuje się na 100 procent", () => {
  const flight = { elapsed: 0, duration: 0.5 };
  assert.equal(advanceProjectile(flight, 0.1), 0.2);
  assert.equal(advanceProjectile(flight, 0.15), 0.5);
  assert.equal(advanceProjectile(flight, 2), 1);
  assert.equal(flight.elapsed, 0.5);
});

test("ujemny lub błędny krok czasu nie cofa ani nie psuje pocisku", () => {
  const flight = { elapsed: 0.2, duration: 0.4 };
  assert.equal(advanceProjectile(flight, -10), 0.5);
  assert.equal(advanceProjectile(flight, Number.NaN), 0.5);
});
