import test from "node:test";
import assert from "node:assert/strict";
import { BUILD_CATEGORIES, findBuildCategory, findBuildItem } from "../src/ui/catalog.ts";

test("katalog budowania ma dokładnie sześć kategorii z kolejności specyfikacji", () => {
  assert.deepEqual(
    BUILD_CATEGORIES.map((category) => category.id),
    ["castle", "industry", "agriculture", "town", "weapons", "food"]
  );
});

test("katalog zawiera rozpoznawalne pozycje każdej kategorii Stronghold", () => {
  const allItems = new Set(BUILD_CATEGORIES.flatMap((category) => category.items.map((item) => item.id)));
  for (const id of [
    "watchtower", "wall-high", "wall-low", "stairs", "crenellations", "gate-small", "gate-large",
    "drawbridge", "towers", "barracks", "mercenary-post", "engineer-guild", "diggers-guild",
    "stables", "armory", "dog-kennel", "tar-pit", "wolf-pit", "braizer", "oil-cauldron", "moat-plan",
    "stockpile", "woodcutter", "quarry", "iron-mine", "market",
    "granary", "hunter", "apple-orchard", "dairy-farm", "wheat-farm", "hop-farm",
    "hovel", "chapel", "church", "cathedral", "apothecary", "well", "good-things", "bad-things",
    "bowyer", "poleturner", "blacksmith", "tanner", "armourer",
    "mill", "bakery", "brewery", "inn"
  ]) {
    assert.ok(allItems.has(id), "brak pozycji " + id);
  }
  assert.equal(allItems.size, 52);
});

test("etapy 3–4 oraz wybrane elementy fortyfikacji są aktywne, a pozostałe mechaniki późniejsze pozostają zablokowane", () => {
  const enabled = BUILD_CATEGORIES.flatMap((category) => category.items)
    .filter((item) => item.implemented)
    .map((item) => item.id);
  assert.deepEqual(enabled, [
    "watchtower", "wall-high", "wall-low", "gate-small", "gate-large", "armory", "moat-plan", "stockpile", "woodcutter", "quarry", "ox-tether", "iron-mine", "pitch-worker", "market",
    "granary", "hunter", "apple-orchard", "dairy-farm", "wheat-farm", "hop-farm",
    "hovel", "chapel", "church", "cathedral", "good-things", "bad-things",
    "bowyer", "poleturner", "blacksmith", "tanner", "armourer", "mill", "bakery", "brewery", "inn"
  ]);
  assert.equal(findBuildItem("watchtower")?.cost, "70 drewna · 30 kamienia");
  assert.equal(findBuildItem("hovel")?.cost, "6 drewna · +8 miejsc");
  assert.equal(findBuildItem("church")?.implemented, true);
  assert.equal(findBuildItem("inn")?.cost, "20 drewna · 100 złota · 1 karczmarz");
  assert.equal(findBuildItem("market")?.implemented, true);
  assert.equal(findBuildItem("quarry")?.implemented, true);
  assert.equal(findBuildItem("wall-high")?.implemented, true);
  assert.equal(findBuildItem("gate-small")?.implemented, true);
  assert.equal(findBuildItem("moat-plan")?.implemented, true);
  assert.equal(findBuildItem("stairs")?.implemented, undefined);
  assert.equal(findBuildItem("drawbridge")?.implemented, undefined);
  assert.equal(findBuildItem("oil-cauldron")?.implemented, undefined);
});

test("wyszukiwanie kategorii i budowli zwraca właściwe pozycje", () => {
  assert.equal(findBuildCategory("agriculture")?.name, "Rolnictwo");
  assert.equal(findBuildItem("granary")?.name, "Spichlerz (Granary)");
  assert.equal(findBuildCategory("missing"), undefined);
  assert.equal(findBuildItem("missing"), undefined);
});
