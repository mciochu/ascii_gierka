/** Recruitment and end-of-game rules shared by the DOMINIUM interface and simulation. */
export type RecruitableUnitClass = "archers" | "crossbowmen" | "pikemen" | "swordsmen";
export type GameOutcome = "playing" | "victory" | "defeat" | "draw";

/**
 * Recruitment consumes one unemployed villager and one finished weapon already
 * delivered to the physical Armory. Gold prices are deliberately omitted until
 * the source specification defines them.
 */
export const RECRUITMENT_RECIPES = {
  archers: { label: "Łucznik", weapon: "bow", damage: 11, range: 150, speed: 82, variant: 1 },
  crossbowmen: { label: "Kusznik", weapon: "crossbow", damage: 16, range: 185, speed: 72, variant: 4 },
  pikemen: { label: "Pikinier", weapon: "pike", damage: 10, range: 54, speed: 94, variant: 0 },
  swordsmen: { label: "Szermierz", weapon: "sword", damage: 15, range: 52, speed: 92, variant: 5 }
} as const satisfies Record<RecruitableUnitClass, {
  label: string; weapon: "bow" | "crossbow" | "pike" | "sword";
  damage: number; range: number; speed: number; variant: number;
}>;

export function canRecruitUnit(
  unitClass: RecruitableUnitClass,
  unemployed: number,
  weaponStock: number,
  outcome: GameOutcome = "playing"
): boolean {
  return outcome === "playing" && Number.isFinite(unemployed) && unemployed >= 1 &&
    Number.isFinite(weaponStock) && weaponStock >= 1 &&
    Object.hasOwn(RECRUITMENT_RECIPES, unitClass);
}

/** Lord death is the decisive game condition; simultaneous deaths are a draw. */
export function resolveLordOutcome(playerLordAlive: boolean, enemyLordAlive: boolean): GameOutcome {
  if (playerLordAlive && enemyLordAlive) return "playing";
  if (!playerLordAlive && !enemyLordAlive) return "draw";
  return playerLordAlive ? "victory" : "defeat";
}
