import { Container } from "pixi.js";
import { addGlyph, addWord } from "./glyph.ts";

export type TeutonicAssetKind =
  | "keep" | "watchtower" | "wall" | "gate" | "barracks" | "stables" | "armory"
  | "stockpile" | "granary" | "hovel" | "chapel" | "church" | "cathedral" | "inn"
  | "woodcutter" | "quarry" | "mine" | "pitch" | "orchard" | "farm" | "mill"
  | "bakery" | "brewery" | "smithy" | "tannery" | "market" | "garden" | "gallows"
  | "knight" | "sergeant" | "spearman" | "crossbowman" | "archer" | "cavalry" | "villager" | "priest" | "lord";

export interface TeutonicAssetOptions {
  scale?: number;
  faction?: "order" | "polish" | "neutral" | "enemy";
  lod?: "close" | "standard" | "strategic";
  entityId?: string | number;
  label?: string;
}

const C = {
  stone: "#aeb7b4", stoneLight: "#e0dfd0", stoneDark: "#58666a", mortar: "#78837f",
  brick: "#9b4937", brickLight: "#c56b4d", brickDark: "#63352f",
  roof: "#343d48", roofLight: "#69727a", timber: "#855536", timberLight: "#bd8b55",
  soil: "#746047", grass: "#52684b", leaf: "#66804f", water: "#477c91",
  iron: "#9da8aa", steel: "#d5d9d3", gold: "#d3b36c", parchment: "#d5c69c",
  cloth: "#d8d5c7", red: "#a63832", black: "#20262b", white: "#e9e5d7",
  skin: "#c58d68", leather: "#8a573c", blue: "#425f79", wheat: "#b69a52"
} as const;

const ORDER = { primary: C.white, secondary: C.black, trim: C.red, metal: C.steel };
const POLISH = { primary: "#c9d5d7", secondary: "#b33d36", trim: C.gold, metal: C.steel };
const ENEMY = { primary: "#b5b0a1", secondary: "#493c34", trim: "#9c6540", metal: "#b8aaa0" };

type Pattern = { rows: string[]; palette: Record<string, string>; accent?: string[] };
const stone = { "#": C.stone, "+": C.stoneLight, "-": C.mortar, "x": C.stoneDark, "=": C.brick, "r": C.brickLight, "d": C.brickDark, "^": C.roof, "~": C.roofLight, "w": C.white, "b": C.black, "g": C.gold, "t": C.timber, "T": C.timberLight, ".": C.parchment, " ": "" };

const PATTERNS: Partial<Record<TeutonicAssetKind, Pattern>> = {
  keep: { rows: ["    ^^^^    ", "   ^~~~~^   ", "  #+####+#  ", "  ########  ", "  ##+##+##  ", "  ########  ", " ##x####x## ", " ########## ", " ##+####+## ", " ########## ", "  ##====##  ", "  ########  "], palette: stone },
  watchtower: { rows: ["  ^^^^^^  ", " ^~~~~~~^ ", " #+####+# ", " ######## ", " ##+##+## ", " ######## ", " ##x##x## ", " ######## ", "  ##==##  ", "  ######  "], palette: stone },
  wall: { rows: ["##+##+##+##", "###########", "##x##x##x##", "###########", "##+##+##+##"], palette: stone },
  gate: { rows: ["##+#####+##", "###########", "##x#####x##", "##x  t  x##", "##x  T  x##", "##x  b  x##", "###########"], palette: stone },
  barracks: { rows: ["   ^^^^^   ", "  ^~~~~~^  ", " ##+####+## ", " ########## ", " ##t####t## ", " ##t ww t## ", " ##t ww t## ", " ########## ", "  ##====##  "], palette: stone },
  stables: { rows: ["  ^^^^^^^  ", " ^~~~~~~~^ ", "##+#####+##", "###########", "##t##t##t##", "##t##t##t##", "##  ##  ## ", "###########"], palette: stone },
  armory: { rows: ["   ^^^^^   ", "  ^~~~~~^  ", " ##+###+## ", " ######### ", " ##x###x## ", " ## w#w ## ", " ## w#w ## ", " ######### ", "  ##===##  "], palette: stone },
  stockpile: { rows: ["   ^^^^^^   ", "  ^~~~~~~^  ", " ##+####+## ", " ########## ", " ##t####t## ", " ##t####t## ", " ########## ", "  ##====##  "], palette: stone },
  granary: { rows: ["   ^^^^^^   ", "  ^~~~~~~^  ", " ##+####+## ", " ########## ", " ##  ww  ## ", " ##  ww  ## ", " ##  ww  ## ", " ########## ", "  ##====##  "], palette: stone },
  hovel: { rows: ["    ^^^^    ", "   ^~~~~^   ", "  ##+##+##  ", " ########## ", " ##t####t## ", " ##t ww t## ", " ##t ww t## ", " ########## ", "  ##====##  "], palette: stone },
  chapel: { rows: ["     ^      ", "    ^+^     ", "   ^~~~^    ", "  ##+##+##  ", "  ########  ", " ##+####+## ", " ########## ", " ##  ww  ## ", " ########## ", "  ##====##  "], palette: stone },
  church: { rows: ["      +      ", "      #      ", "     ^#^     ", "    ^~~~^    ", "   ##+##+##   ", "   ########   ", "  ##+####+##  ", "  ##########  ", "  ##  ww  ##  ", "  ##########  ", "   ##====##   "], palette: stone },
  cathedral: { rows: ["      +      ", "      #      ", "   ^^^#^^^   ", "  ^~~~~~~~^  ", " ##+##+##+## ", " ########### ", "##+#########+##", "###############", "##  ww  ww  ##", "###############", " ##=========## "], palette: stone },
  inn: { rows: ["   ^^^^^^   ", "  ^~~~~~~^  ", " ##+####+## ", " ########## ", " ##t####t## ", " ##  ww  ## ", " ##  ww  ## ", " ########## ", "  ##====##  "], palette: stone },
  woodcutter: { rows: ["  ♣   ♣   ", " ♣♣♣ ♣♣♣ ", "   ####   ", "  ##t##   ", " ##tT##   ", " ######## ", "  ##==##  "], palette: { ...stone, "♣": C.leaf } },
  quarry: { rows: ["  /^^^\\  ", " /#####\\ ", "##+##x### ", "##########", "##x##+####", " ######## ", "  ##==##  "], palette: stone },
  mine: { rows: ["   ^^^^^   ", "  ^#####^  ", " ##+###x## ", " ######### ", " ##x###x## ", " ######### ", "  ##====#  "], palette: stone },
  pitch: { rows: ["   ^^^^^   ", "  ^~~~~~^  ", " ##+###+## ", " ######### ", " ##x###x## ", " ##  ww ## ", " ######### ", "  ##====#  "], palette: stone },
  orchard: { rows: [" ♣   ♣   ♣ ", "  ♣  o  ♣  ", " ♣   ♣   ♣ ", "    ####   ", "   ##t##   ", "  ##====## "], palette: { ...stone, "♣": C.leaf, "o": C.red } },
  farm: { rows: ["  / / / /  ", " / / / / / ", "  / / / /  ", " / / / / / ", "  / / / /  ", "    ##     "], palette: { ...stone, "/": C.wheat } },
  mill: { rows: ["    +      ", "  \\ | /   ", "   \\|/    ", " ---#---   ", "   /|\\    ", "  / | \\   ", "   ##+##   ", "  ##===##  "], palette: stone },
  bakery: { rows: ["   ^^^^^   ", "  ^~~~~~^  ", " ##+###+## ", " ######### ", " ##  ♨  ## ", " ##  ♨  ## ", " ######### ", "  ##====#  "], palette: { ...stone, "♨": C.brickLight } },
  brewery: { rows: ["   ^^^^^   ", "  ^~~~~~^  ", " ##+###+## ", " ######### ", " ##  ▣  ## ", " ##  ▣  ## ", " ######### ", "  ##====#  "], palette: { ...stone, "▣": C.gold } },
  smithy: { rows: ["   ^^^^^   ", "  ^~~~~~^  ", " ##+###+## ", " ######### ", " ## ⚒ ## ", " ##  ♨  ## ", " ######### ", "  ##====#  "], palette: { ...stone, "⚒": C.steel, "♨": C.brickLight } },
  tannery: { rows: ["  ^^^^^^  ", " ^~~~~~~^ ", "##+#####+##", "###########", "##t####t##", "## .  . ##", "###########", " ##====## "], palette: stone },
  market: { rows: ["  ^  ^  ^  ", " /#\\/#\\/#\\ ", "##+####+##", "##  ww  ##", "##  ww  ##", "##########", " ##====## "], palette: stone },
  garden: { rows: ["  ♣  ✿  ♣  ", " ✿  ♣  ✿  ", "  ♣  ✿  ♣  "], palette: { ...stone, "♣": C.leaf, "✿": C.gold } },
  gallows: { rows: ["##t####t##", "##t####t##", "##t  † t##", "##t    t##", "##########"], palette: { ...stone, "†": C.red } }
};

const UNIT_PATTERNS: Partial<Record<TeutonicAssetKind, Pattern>> = {
  knight: { rows: ["  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ▄████▄ ", " ██████ ", "  ██ ██  ", " ▄██ ██▄ "], palette: { "█": C.steel, "▄": C.roofLight, "◉": C.black, " ": "" } },
  sergeant: { rows: ["  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ▄████▄ ", " ██████ ", "  ██ ██  ", "  ██ ██  "], palette: { "█": C.leather, "▄": C.timberLight, "◉": C.black, " ": "" } },
  spearman: { rows: ["   †   ", "   †   ", "   †   ", "  ███  ", " ▄███▄ ", "  ███  ", "  ██ ██ "], palette: { "█": C.cloth, "▄": C.leather, "†": C.steel, " ": "" } },
  crossbowman: { rows: ["  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ▄████▄ ", " █╪███  ", "  ██ ██ "], palette: { "█": C.blue, "▄": C.leather, "◉": C.black, "╪": C.timberLight, " ": "" } },
  archer: { rows: ["  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ▄████▄ ", " █╭███  ", "  ██ ██ "], palette: { "█": C.grass, "▄": C.leather, "◉": C.black, "╭": C.timberLight, " ": "" } },
  cavalry: { rows: ["   ♞    ", "  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ▄██████", " ███ ██ "], palette: { "█": C.leather, "▄": C.steel, "◉": C.black, "♞": C.white, " ": "" } },
  villager: { rows: ["  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ▄████▄ ", " ██████ ", "  ██ ██ "], palette: { "█": C.timber, "▄": C.parchment, "◉": C.black, " ": "" } },
  priest: { rows: ["  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ██████ ", "  █✝█   ", "  ██ ██ "], palette: { "█": C.cloth, "▄": C.white, "◉": C.black, "✝": C.gold, " ": "" } },
  lord: { rows: ["   ♛    ", "  ▄██▄  ", " ▄████▄ ", " █◉██◉█ ", "  ████  ", " ▄████▄ ", " ██████ ", "  ██ ██ "], palette: { "█": C.gold, "▄": C.white, "◉": C.black, "♛": C.gold, " ": "" } }
};

function factionPalette(faction: TeutonicAssetOptions["faction"]) {
  return faction === "polish" ? POLISH : faction === "enemy" ? ENEMY : ORDER;
}

/** Dense, hand-composed Unicode miniatures: every cell is still a separately positioned glyph. */
export function drawTeutonicAsset(
  parent: Container, kind: TeutonicAssetKind, x: number, y: number, options: TeutonicAssetOptions = {}
): void {
  const scale = Math.max(0.55, Math.min(2.4, options.scale ?? 1));
  const isUnit = Object.hasOwn(UNIT_PATTERNS, kind);
  const pattern = (isUnit ? UNIT_PATTERNS[kind] : PATTERNS[kind]) ?? PATTERNS.keep!;
  const palette = pattern.palette;
  const rows = pattern.rows;
  const height = rows.length;
  const width = Math.max(...rows.map(row => Array.from(row).length));
  const cell = 4.5 * scale;
  const stepX = cell * 0.78;
  const stepY = cell * 0.88;
  const colors = factionPalette(options.faction ?? "order");
  const glyphs: string[] = [];
  for (let row = 0; row < height; row++) {
    const chars = Array.from(rows[row] ?? "");
    for (let col = 0; col < chars.length; col++) {
      const char = chars[col]!;
      if (char === " ") continue;
      const color = palette[char] ?? C.stone;
      const jitterX = Math.sin(row * 2.71 + col * 1.93) * cell * 0.11;
      const jitterY = Math.cos(row * 1.87 + col * 2.33) * cell * 0.09;
      addGlyph(parent, {
        char, x: x + (col - (width - 1) / 2) * stepX + jitterX,
        y: y + (row - (height - 1) / 2) * stepY + jitterY,
        size: cell * (char === " " ? 1 : 1.08),
        color: color === C.white && isUnit ? colors.primary : color,
        alpha: 0.98, weight: "bold", material: isUnit ? "unit" : "building",
        height: isUnit ? 0.26 : 0.3, entityId: options.entityId,
        ...(options.lod ? { lod: options.lod } : {})
      });
      glyphs.push(char);
    }
  }

  // The Order's black cross belongs only to Order cloth; enemy banners never inherit it.
  if (!isUnit && options.faction !== "neutral" && kind !== "garden" && kind !== "gallows") {
    const flagY = y - (height * stepY) / 2 - 7 * scale;
    const isPolish = options.faction === "polish";
    const isEnemy = options.faction === "enemy";
    addGlyph(parent, { char: "│", x: x + 17 * scale, y: flagY + 9 * scale, size: 22 * scale, color: C.timber, weight: "bold", material: "building" });
    addGlyph(parent, { char: "⚑", x: x + 18 * scale, y: flagY, size: 17 * scale, color: isPolish ? C.red : isEnemy ? ENEMY.trim : C.white, weight: "bold", material: "building" });
    if (!isEnemy) addGlyph(parent, { char: "✠", x: x + 18 * scale, y: flagY, size: 9 * scale, color: isPolish ? C.white : C.black, weight: "bold", material: "building" });
  }
  if (isUnit) {
    const faction = options.faction ?? "order";
    const banner = faction === "polish" ? POLISH : faction === "enemy" ? ENEMY : ORDER;
    addGlyph(parent, { char: "⚑", x: x + 12 * scale, y: y - 22 * scale, size: 13 * scale, color: banner.primary, weight: "bold", material: "unit", ...(options.lod ? { lod: options.lod } : {}) });
    if (faction !== "enemy") addGlyph(parent, { char: "✠", x: x + 12 * scale, y: y - 22 * scale, size: 8 * scale, color: faction === "polish" ? C.white : C.black, weight: "bold", material: "unit", ...(options.lod ? { lod: options.lod } : {}) });
  }
  if (options.label) addWord(parent, options.label.toLocaleUpperCase("pl-PL"), x, y + height * stepY / 2 + 8 * scale, 6.5 * scale, C.gold, 0.8);
}

export const TEUTONIC_PALETTE = C;
