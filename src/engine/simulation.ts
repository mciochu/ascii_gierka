/** Deterministic economic clock and monthly settlement for DOMINIUM. */
export type RationLevel = 0 | 0.5 | 1 | 1.5 | 2;
export type TaxLevel = "bribe-generous" | "bribe-large" | "bribe-small" | "none" | "low" | "medium" | "high" | "heavy" | "extortionate" | "cruel";

export interface SimulationState {
  month: number;
  speed: number;
  monthProgress: number;
  gold: number;
  food: number;
  wood: number;
  stone: number;
  popularity: number;
  population: number;
  housing: number;
  unemployed: number;
  ration: RationLevel;
  tax: TaxLevel;
  /** Null until the source specification provides an exact cost per villager. */
  bribeCostPerVillager: number | null;
  foodTypes: number;
  taverns: number;
  beerBarrels: number;
  churches: number;
  cathedrals: number;
  blessedShare: number;
  fear: number;
}

export const MONTH_LENGTH_SECONDS = 30;
export const MIN_GAME_SPEED = 20;
export const MAX_GAME_SPEED = 90;

export const TAX_RULES: Record<TaxLevel, { label: string; popularity: number; goldPerVillager: number; bribe: number }> = {
  "bribe-generous": { label: "Hojna łapówka", popularity: 7, goldPerVillager: 0, bribe: 0 },
  "bribe-large": { label: "Duża łapówka", popularity: 5, goldPerVillager: 0, bribe: 0 },
  "bribe-small": { label: "Mała łapówka", popularity: 3, goldPerVillager: 0, bribe: 0 },
  none: { label: "Brak podatków", popularity: 1, goldPerVillager: 0, bribe: 0 },
  low: { label: "Niskie podatki", popularity: -2, goldPerVillager: 0.6, bribe: 0 },
  medium: { label: "Średnie podatki", popularity: -4, goldPerVillager: 0.8, bribe: 0 },
  high: { label: "Wysokie podatki", popularity: -6, goldPerVillager: 1, bribe: 0 },
  heavy: { label: "Uciążliwe podatki", popularity: -8, goldPerVillager: 1.2, bribe: 0 },
  extortionate: { label: "Złodziejskie podatki", popularity: -12, goldPerVillager: 1.4, bribe: 0 },
  cruel: { label: "Okrutne podatki", popularity: -16, goldPerVillager: 1.8, bribe: 0 }
};

export function createSimulation(): SimulationState {
  return {
    month: 1, speed: 40, monthProgress: 0,
    gold: 1240, food: 860, wood: 340, stone: 210,
    popularity: 65, population: 8, housing: 8, unemployed: 8,
    ration: 1, tax: "none", bribeCostPerVillager: null, foodTypes: 1, taverns: 0, beerBarrels: 0,
    churches: 0, cathedrals: 0, blessedShare: 0, fear: 0
  };
}

export interface MonthlyReport {
  month: number;
  foodConsumed: number;
  taxes: number;
  bribeCost: number;
  popularityChange: number;
  spawnedVillagers: number;
  leftVillagers: number;
  messages: string[];
}

export function settleMonth(state: SimulationState): MonthlyReport {
  const messages: string[] = [];
  const tax = TAX_RULES[state.tax];
  const effectiveRation: RationLevel = state.food <= 0 ? 0 : state.ration;
  const consumptionPerVillager: Record<RationLevel, number> = { 0: 0, 0.5: 0.1, 1: 0.2, 1.5: 0.32, 2: 0.4 };
  const requestedFood = state.population * consumptionPerVillager[effectiveRation];
  const foodConsumed = Math.min(state.food, requestedFood);
  state.food = Math.max(0, state.food - foodConsumed);
  const shortage = requestedFood > 0 && foodConsumed + 0.0001 < requestedFood;
  const rationModifier = shortage
    ? -8
    : ({ 0: -8, 0.5: -4, 1: 0, 1.5: 4, 2: 8 } as Record<RationLevel, number>)[effectiveRation];
  const varietyModifier = effectiveRation > 0 ? Math.max(0, Math.min(3, Math.trunc(state.foodTypes) - 1)) : 0;
  const beerCoverage = Math.min(1, (state.taverns * 30) / Math.max(1, state.population));
  const beerMonthlyUse = state.taverns > 0 ? 0.144 : 0;
  const beerAvailable = state.beerBarrels + 0.000001 >= beerMonthlyUse && state.taverns > 0;
  const beerBonus = beerAvailable
    ? (beerCoverage >= 1 ? 8 : beerCoverage >= 0.75 ? 6 : beerCoverage >= 0.5 ? 4 : beerCoverage >= 0.25 ? 2 : 0)
    : 0;
  if (beerAvailable) state.beerBarrels = Math.max(0, state.beerBarrels - beerMonthlyUse);
  const religionPassive = (state.churches > 0 ? 1 : 0) + (state.cathedrals > 0 ? 2 : 0);
  const religionBlessing = Math.round(Math.max(0, Math.min(1, state.blessedShare)) * 8);
  const fearModifier = Math.max(-5, Math.min(5, Math.trunc(state.fear)));
  const isBribe = state.tax.startsWith("bribe-");
  const bribeCost = isBribe && state.bribeCostPerVillager !== null
    ? state.population * Math.max(0, state.bribeCostPerVillager)
    : 0;
  const bribePaid = isBribe && state.bribeCostPerVillager !== null && state.gold >= bribeCost;
  const bribeBonus = bribePaid ? tax.popularity : 0;
  const popularityChange = rationModifier + varietyModifier + (isBribe ? bribeBonus : tax.popularity) + beerBonus + religionPassive + religionBlessing + fearModifier;
  if (isBribe && state.bribeCostPerVillager === null) messages.push("Koszt łapówki nie jest określony w specyfikacji — bonus nie został naliczony.");
  else if (isBribe && !bribePaid) messages.push("Brak złota na łapówkę — bonus popularności nie został naliczony.");
  const taxes = isBribe ? 0 : state.population * tax.goldPerVillager;
  state.gold = Math.max(0, state.gold + taxes - (bribePaid ? bribeCost : 0));
  state.popularity = Math.max(0, Math.min(100, state.popularity + popularityChange));

  let spawnedVillagers = 0;
  let leftVillagers = 0;
  if (state.popularity >= 50 && state.population < state.housing && state.unemployed < 24) {
    spawnedVillagers = 1;
    state.population += 1;
    state.unemployed += 1;
  } else if (state.popularity < 50 && state.population > 0) {
    leftVillagers = 1;
    state.population -= leftVillagers;
    state.unemployed = Math.max(0, state.unemployed - leftVillagers);
    messages.push("Popularność spadła poniżej 50 — mieszkańcy opuszczają osadę.");
  }
  if (state.food <= 0) messages.push("Spichlerz jest pusty. Racje żywnościowe spadły do zera.");
  if (state.unemployed >= 24) messages.push("Ognisko osiągnęło limit 24 bezrobotnych chłopów.");
  state.month += 1;
  return { month: state.month, foodConsumed, taxes, bribeCost: bribePaid ? bribeCost : 0, popularityChange, spawnedVillagers, leftVillagers, messages };
}

export function advanceSimulation(state: SimulationState, realDeltaSeconds: number): MonthlyReport[] {
  const scaledDelta = Math.max(0, realDeltaSeconds) * (state.speed / 40);
  state.monthProgress += scaledDelta;
  const reports: MonthlyReport[] = [];
  while (state.monthProgress >= MONTH_LENGTH_SECONDS) {
    state.monthProgress -= MONTH_LENGTH_SECONDS;
    reports.push(settleMonth(state));
  }
  return reports;
}

export function setGameSpeed(state: SimulationState, next: number): number {
  state.speed = Math.max(MIN_GAME_SPEED, Math.min(MAX_GAME_SPEED, Math.round(next)));
  return state.speed;
}
