import { Container } from "pixi.js";
import { addGlyph, addWord } from "./glyph.ts";

export type TeutonicAssetKind =
  | "keep" | "watchtower" | "wall" | "gate" | "barbican" | "palisade" | "drawbridge"
  | "barracks" | "stables" | "armory" | "stockpile" | "granary"
  | "hovel" | "manor" | "chapel" | "church" | "cathedral" | "monastery" | "inn" | "infirmary" | "well"
  | "woodcutter" | "hunter" | "quarry" | "mine" | "pitch" | "orchard" | "farm" | "wheat-farm" | "hop-farm"
  | "dairy-farm" | "mill" | "bakery" | "brewery" | "smithy" | "bowyer" | "poleturner" | "tannery"
  | "armourer" | "ox-tether" | "market" | "garden" | "gallows"
  | "trebuchet" | "mangonel" | "battering-ram" | "siege-tower" | "bridge" | "wagon" | "ox-cart" | "camp" | "shrine"
  | "knight" | "sergeant" | "spearman" | "crossbowman" | "archer" | "cavalry" | "villager" | "priest" | "lord"
  | "banner-bearer" | "scout" | "engineer" | "miner" | "messenger";

export interface TeutonicAssetOptions {
  scale?: number;
  faction?: "order" | "polish" | "neutral" | "enemy";
  lod?: "close" | "standard" | "strategic";
  entityId?: string | number;
  label?: string;
  heraldry?: boolean;
  shadow?: boolean;
}

export interface TeutonicAssetStats {
  width: number;
  height: number;
  glyphs: number;
  category: "fortress" | "town" | "industry" | "siege" | "unit" | "nature";
}

const C = {
  stone: "#929b96",
  limestone: "#d1d0c3",
  limestoneWarm: "#b9b29f",
  stoneDark: "#4b5551",
  mortar: "#69716b",
  brick: "#8e4032",
  brickLight: "#bd654a",
  brickDark: "#542b26",
  roof: "#303943",
  roofLight: "#626d73",
  timber: "#69442e",
  timberLight: "#a8794d",
  soil: "#554431",
  earth: "#786246",
  grass: "#526845",
  leaf: "#647c4d",
  leafLight: "#8a985e",
  water: "#477889",
  iron: "#77827f",
  steel: "#c5cbc5",
  gold: "#d1b16e",
  parchment: "#d8c9a5",
  cloth: "#ded9c8",
  white: "#eee9d9",
  red: "#96372f",
  redLight: "#c05a45",
  black: "#191c19",
  shadow: "#080907",
  window: "#8aabb0",
  skin: "#bd8968",
  leather: "#76503b",
  wheat: "#c4a35d",
  fire: "#df8d4a",
  smoke: "#8e9187",
  purple: "#716071"
} as const;

const ORDER = { cloth: C.white, shadow: C.black, trim: C.red, metal: C.steel };
const POLISH = { cloth: "#e5e0d1", shadow: C.red, trim: "#b4463c", metal: C.steel };
const ENEMY = { cloth: "#897e6b", shadow: "#332921", trim: "#9b5b39", metal: "#9e9b8c" };
const NEUTRAL = { cloth: C.parchment, shadow: C.black, trim: C.timber, metal: C.iron };

type Pattern = {
  rows: string[];
  category: TeutonicAssetStats["category"];
  palette?: Record<string, string>;
};

const P = {
  "#": C.stone,
  "█": C.stone,
  "▓": C.stoneDark,
  "▒": C.stone,
  "░": C.limestone,
  "+": C.limestone,
  ":": C.mortar,
  "-": C.mortar,
  "=": C.brick,
  "r": C.brickLight,
  "d": C.brickDark,
  "^": C.roof,
  "~": C.roofLight,
  "/": C.roof,
  "\\": C.roof,
  "|": C.stoneDark,
  "t": C.timber,
  "T": C.timberLight,
  "w": C.cloth,
  "b": C.black,
  "g": C.gold,
  "o": C.window,
  "@": C.shadow,
  "*": C.fire,
  "s": C.wheat,
  "l": C.leaf,
  "L": C.leafLight,
  "♣": C.leaf,
  "✿": C.gold,
  "♞": C.leather,
  "▣": C.steel,
  "†": C.gold,
  "h": C.steel,
  "c": C.skin,
  "p": C.parchment,
  "i": C.iron,
  "R": C.red,
  " ": ""
} satisfies Record<string, string>;

const B: Record<string, Pattern> = {
  keep: {
    category: "fortress",
    rows: [
      "          +####+                         +####+          ",
      "          |####|                         |####|          ",
      "          |####|                         |####|          ",
      "      +###+====+###+                 +###+====+###+      ",
      "      |#############|                 |#############|      ",
      "      |##o####o#####+#################+####o####o##|      ",
      "  +===+#############################################+===+ ",
      "  |#####################################################| ",
      "  |##o####o####o####o####o####o####o####o####o####o##| ",
      "  |#####################################################| ",
      "  |##x#############################################x##| ",
      "  |#####################################################| ",
      "  |##########+#########################+##############| ",
      "  |##########|@@@@@@@@@@@@@@@@@@@@@@@@@|##############| ",
      "  |##########|@@@@@@@@@@@@@@@@@@@@@@@@@|##############| ",
      "  +==========+=========================+==============+ ",
      "       ======+==========+==========+======               ",
      "        ttttttttttttttttttttttttttttttt                  "
    ]
  },
  watchtower: {
    category: "fortress",
    rows: [
      "        +####### +",
      "       /=========\\",
      "      /~~^^^g^^^~~\\",
      "     +#############+",
      "     |##o#######o##|",
      "     |#############|",
      "     |#####+++#####|",
      "     |#####|@@@|###|",
      "     |#####|@@@|###|",
      "     |#####|@@@|###|",
      "     |#############|",
      "     |##o#######o##|",
      "     +#############+",
      "       ============ ",
      "        tttttttttt  "
    ]
  },
  wall: {
    category: "fortress",
    rows: [
      "+##+##+##+##+##+",
      "|##############|",
      "|##x####x####x#|",
      "|##############|",
      "+==============+"
    ]
  },
  gate: {
    category: "fortress",
    rows: [
      "   +####+       +####+   ",
      "   |####|       |####|   ",
      "  /======\\     /======\\  ",
      " +########+===+########+ ",
      " |######################| ",
      " |##o################o##| ",
      " |#######+++++++########| ",
      " |#######|ttttt|########| ",
      " |#######|ttttt|########| ",
      " |#######|ttttt|########| ",
      " +=======+=====+========+ "
    ]
  },
  barbican: {
    category: "fortress",
    rows: [
      "       +####+       +####+       ",
      "       |####|       |####|       ",
      "  +====+####+=======+####+====+  ",
      "  |###########################|  ",
      "  |##o####o#########o####o###|  ",
      "  |###########################|  ",
      "  |##########+++++############|  ",
      "  |##########|@@@|############| ",
      "  |##########|@@@|############| ",
      "  +==========+===+============+  "
    ]
  },
  palisade: {
    category: "fortress",
    rows: [
      "  /|  /|  /|  /|  /|  /|  /|  /|",
      "  ||  ||  ||  ||  ||  ||  ||  ||",
      "  ||  ||  ||  ||  ||  ||  ||  ||",
      "  ||==||==||==||==||==||==||==||",
      "  ||  ||  ||  ||  ||  ||  ||  ||",
      "  tt  tt  tt  tt  tt  tt  tt  tt"
    ]
  },
  drawbridge: {
    category: "fortress",
    rows: [
      "     +########+     ",
      "     |########|     ",
      "     |##@@@@##|     ",
      "     +##@@@@##+     ",
      "  ===/========\\===  ",
      " ttt/==========\\ttt ",
      "    |==========|    ",
      "    +==========+    "
    ]
  },
  barracks: {
    category: "fortress",
    rows: [
      "           +###g###+           ",
      "         /===========\\         ",
      "        /~~~^^^g^^^~~~\\        ",
      "       +#################+       ",
      "       |##o####o####o###|       ",
      "       |#################|       ",
      "       |##t###########t##|       ",
      "       |##t##h###h###t##|       ",
      "       |##t###########t##|       ",
      "       +#################+       ",
      "          ============           ",
      "           tttttttttt             "
    ]
  },
  stables: {
    category: "fortress",
    rows: [
      "       +################+       ",
      "     /====================\\     ",
      "    /~~~~~~^^g^^~~~~~~~\\    ",
      "   +######################+   ",
      "   |##t####t####t####t##|   ",
      "   |##t####t####t####t##|   ",
      "   |##@####@####@####@##|   ",
      "   |##♞####♞####♞####♞##|   ",
      "   +======================+   ",
      "      ttttttttttttttttt       "
    ]
  },
  armory: {
    category: "fortress",
    rows: [
      "        +########+        ",
      "      /============\\      ",
      "     /~~~^^g^^~~~\\     ",
      "    +##############+    ",
      "    |##o########o##|    ",
      "    |##############|    ",
      "    |##†###†###†##|    ",
      "    |##h###h###h##|    ",
      "    |##############|    ",
      "    +==============+    ",
      "       ==========       "
    ]
  },
  stockpile: {
    category: "industry",
    rows: [
      "        /=========\\        ",
      "       /###########\\       ",
      "  +===+#############+===+  ",
      "  |###|tttTTTtttTTT|###|  ",
      "  |###|tttTTTtttTTT|###|  ",
      "  |###|###h###h####|###|  ",
      "  |###|############|###|  ",
      "  +===+============+===+  ",
      "      tttttttttttttt       "
    ]
  },
  granary: {
    category: "industry",
    rows: [
      "          +###g###+          ",
      "        /===========\\        ",
      "       /sssssssssssss\\       ",
      "      +#################+      ",
      "      |##s##s##s##s##s##|      ",
      "      |#################|      ",
      "      |##o###########o##|      ",
      "      |#######+++#######|      ",
      "      |#######|@@@|#####|      ",
      "      +=======+===+=====+      ",
      "         sssssssssss           "
    ]
  },
  hovel: {
    category: "town",
    rows: [
      "          /\\          ",
      "         /ss\\         ",
      "        /ssss\\        ",
      "       /ssssss\\       ",
      "      +########+      ",
      "      |ttTTttTT|      ",
      "      |########|      ",
      "      |##o##o##|      ",
      "      |########|      ",
      "      |##@@@###|      ",
      "      +========+      ",
      "       tttttttt       "
    ]
  },
  manor: {
    category: "town",
    rows: [
      "          +####+          ",
      "        /========\\        ",
      "       /~~^^g^^~~~\\       ",
      "  +===+############+===+  ",
      "  |####################|  ",
      "  |##o####o####o####o##|  ",
      "  |####################|  ",
      "  |##t##############t##|  ",
      "  |####################|  ",
      "  |#########@@@########|  ",
      "  +====================+  "
    ]
  },
  chapel: {
    category: "town",
    rows: [
      "             +g+             ",
      "             |†|             ",
      "          +##| |##+          ",
      "         /========\\         ",
      "        /~~~^^^~~~\\        ",
      "       +############+       ",
      "       |##o######o##|       ",
      "       |############|       ",
      "       |#####+++####|       ",
      "       |#####|@@|###|       ",
      "       +=====+==+===+       "
    ]
  },
  church: {
    category: "town",
    rows: [
      "                +g+                ",
      "                |†|                ",
      "             +##| |##+             ",
      "            /=========\\            ",
      "       +===/~~~~^^^~~~~\\===+       ",
      "      /=====================\\      ",
      "     +#########################+     ",
      "     |##o####o####o####o####o##|     ",
      "     |#########################|     ",
      "     |#######+++++++###########|     ",
      "     |#######|@@@@@|###########|     ",
      "     +=======+=====+===========+     "
    ]
  },
  cathedral: {
    category: "town",
    rows: [
      "                  +g+                  ",
      "                  |†|                  ",
      "               +##| |##+               ",
      "              /=========\\              ",
      "         +===/~~~~^^^~~~~\\===+         ",
      "        /=====================\\        ",
      "       /~~^^^g^^~~~~~~~~^^g^^~~~\\       ",
      "      +###########################+      ",
      "      |##o####o####o####o####o##|      ",
      "      |##########################|      ",
      "      |#######o#########o########|      ",
      "      |##########################|      ",
      "      |##########+++++###########|      ",
      "      |##########|@@@|###########|      ",
      "      +==========+===+===========+      "
    ]
  },
  monastery: {
    category: "town",
    rows: [
      "        +####+             +####+        ",
      "        |####|             |####|        ",
      "   +====+####+=============+####+====+   ",
      "   |##################################|   ",
      "   |##o####o####o####o####o####o####o##|   ",
      "   |##################################|   ",
      "   |##+############################+##|   ",
      "   |##|@@@@@@@@@@@@@@@@@@@@@@@@@@@@|##|   ",
      "   |##|@@@@@@@@@@@@@@@@@@@@@@@@@@@@|##|   ",
      "   |##+############################+##|   ",
      "   +==================================+   ",
      "       †          †           †          "
    ]
  },
  inn: {
    category: "town",
    rows: [
      "          /\\          ",
      "         /ss\\         ",
      "        /ssss\\        ",
      "       +########+      ",
      "       |##o##o##|      ",
      "       |########|      ",
      "       |##tTTt##|      ",
      "       |########|      ",
      "       |###@@###|      ",
      "       +========+      ",
      "          tttt         "
    ]
  },
  infirmary: {
    category: "town",
    rows: [
      "        +########+        ",
      "      /============\\      ",
      "     /~~~~~~g~~~~~~~\\     ",
      "    +################+    ",
      "    |##o##o##o##o##o#|    ",
      "    |################|    ",
      "    |########†#######|    ",
      "    |################|    ",
      "    +================+    "
    ]
  },
  well: {
    category: "town",
    rows: [
      "          +######+          ",
      "        /##t####t##\\        ",
      "       |###t####t###|       ",
      "       |##+######+##|       ",
      "       |##|~~~~~~|##|       ",
      "       |##|~~~~~~|##|       ",
      "       +##+======+##+       ",
      "          tttttt             "
    ]
  },
  woodcutter: {
    category: "industry",
    rows: [
      "           ♣llll           ",
      "        ♣llLlllll♣        ",
      "       +############+       ",
      "      /tttttttttttttt\\      ",
      "     /ttTTttTTttTTttTT\\     ",
      "    +##################+    ",
      "    |##o##########o####|    ",
      "    |#######@@@########|    ",
      "    +==================+    ",
      "       tttttt  hhh          "
    ]
  },
  hunter: {
    category: "industry",
    rows: [
      "        ♣lllll♣        ",
      "       +########+       ",
      "      /tttttttttt\\      ",
      "     /ttTTttTTttTT\\     ",
      "    +##############+    ",
      "    |##o########o##|    ",
      "    |######@@@#####|    ",
      "    +==============+    ",
      "       ♞  ♞  ♞          "
    ]
  },
  quarry: {
    category: "industry",
    rows: [
      "       ▲▲▲▲▲▲▲       ",
      "     ▲▓▓▓▓▓▓▓▓▓▲     ",
      "    ▲▓▓+▓▓▓▓+▓▓▓▲    ",
      "   +##############+   ",
      "   |##▒##▒##▒##▒##|   ",
      "   |##############|   ",
      "   |##h####h####h#|   ",
      "   +==============+   ",
      "      ###   ###        "
    ]
  },
  mine: {
    category: "industry",
    rows: [
      "        ▲▓▓▓▓▓▲        ",
      "      ▲▓▓▓▓▓▓▓▓▲      ",
      "     +############+     ",
      "    /tttttttttttttt\\    ",
      "   +################+   ",
      "   |################|   ",
      "   |#######@@#######|   ",
      "   |######@@@@######|   ",
      "   +================+   ",
      "       hhh  hhh          "
    ]
  },
  pitch: {
    category: "industry",
    rows: [
      "          ~~~          ",
      "         ~~~~~         ",
      "           *           ",
      "      +########+       ",
      "    /============\\     ",
      "   /~~~~^^g^^~~~~~\\    ",
      "  +################+   ",
      "  |##o##########o##|   ",
      "  |######@@@#######|   ",
      "  +================+   "
    ]
  },
  orchard: {
    category: "nature",
    rows: [
      "  ♣llLll♣       ♣llLll♣  ",
      " ♣lllllll♣     ♣lllllll♣ ",
      "  ♣llLll♣       ♣llLll♣  ",
      "       ttt         ttt    ",
      "      +##+         +##+   ",
      "  ♣llLll♣       ♣llLll♣  ",
      " ♣lllllll♣     ♣lllllll♣ ",
      "  ♣llLll♣       ♣llLll♣  ",
      "      ttt           ttt   "
    ]
  },
  farm: {
    category: "industry",
    rows: [
      "   s  s  s  s  s  s   ",
      "  s  s  s  s  s  s  s  ",
      "   s  s  s  s  s  s   ",
      "  s  s  s  s  s  s  s  ",
      "   s  s  s  s  s  s   ",
      "  s  s  s  s  s  s  s  ",
      "  ::::::::::::::::::: ",
      "       ttttttt         "
    ]
  },
  "wheat-farm": {
    category: "industry",
    rows: [
      "   sssssssssssssss   ",
      "  s  s  s  s  s  s  ",
      "   s  s  s  s  s    ",
      "  s  s  s  s  s  s  ",
      "   s  s  s  s  s    ",
      "  s  s  s  s  s  s  ",
      "  :::::::::::::::::  "
    ]
  },
  "hop-farm": {
    category: "industry",
    rows: [
      "   l   l   l   l   ",
      "  lL  lL  lL  lL  ",
      "   l   l   l   l   ",
      "  ttt ttt ttt ttt  ",
      "  :::::::::::::::  "
    ]
  },
  "dairy-farm": {
    category: "industry",
    rows: [
      "        +####+        ",
      "      /========\\      ",
      "     /ssssssssss\\     ",
      "    +############+    ",
      "    |##o######o##|    ",
      "    |############|    ",
      "    |##♞####♞###|    ",
      "    +============+    "
    ]
  },
  mill: {
    category: "industry",
    rows: [
      "       +####+          ",
      "      /======\\         ",
      "     /~~^^g^~~\\        ",
      "    +##########+       ",
      "    |##o####o##|       ",
      "    |##########|       ",
      "    |##@@@@@@##|       ",
      "    +==========+       ",
      "       tttttt          ",
      "          +            ",
      "      \\   |   /        ",
      "       \\  |  /         ",
      "    -----+-----        ",
      "       / | \\           ",
      "      /  |  \\          "
    ]
  },
  bakery: {
    category: "industry",
    rows: [
      "        ~~~             ",
      "       ~~~~~            ",
      "        *               ",
      "      +########+        ",
      "     /============\\     ",
      "    /~~~~^^g^^~~~~~\\    ",
      "   +################+   ",
      "   |##o##########o##|   ",
      "   |######++++######|   ",
      "   |######|@@|######|   ",
      "   +======+==+======+   ",
      "       ssssssss         "
    ]
  },
  brewery: {
    category: "industry",
    rows: [
      "       +########+       ",
      "      /============\\    ",
      "     /~~~^^g^^~~~~~~\\   ",
      "    +################+  ",
      "    |##o##########o##|  ",
      "    |################|  ",
      "    |##t##t##t##t###|   ",
      "    |##@##@##@##@###|   ",
      "    +================+  ",
      "      ttttt  ttttt      "
    ]
  },
  smithy: {
    category: "industry",
    rows: [
      "         ~~~~           ",
      "        ~~~~~~          ",
      "          *             ",
      "       +########+       ",
      "      /============\\    ",
      "     /~~~~^^g^^~~~~~\\   ",
      "    +################+  ",
      "    |##o########o####|  ",
      "    |###h####h#######|  ",
      "    |###@@**@@#######|  ",
      "    +================+  "
    ]
  },
  bowyer: {
    category: "industry",
    rows: [
      "       +########+       ",
      "      /============\\    ",
      "     /~~~^^g^^~~~~~~\\   ",
      "    +################+  ",
      "    |##o##########o##|  ",
      "    |################|  ",
      "    |##))))))))))###|   ",
      "    |################|  ",
      "    +================+  "
    ]
  },
  poleturner: {
    category: "industry",
    rows: [
      "       +########+       ",
      "      /============\\    ",
      "     /~~~^^g^^~~~~~~\\   ",
      "    +################+  ",
      "    |##o##########o##|  ",
      "    |################|  ",
      "    |##|†|†|†|†|†|##|   ",
      "    |################|  ",
      "    +================+  "
    ]
  },
  tannery: {
    category: "industry",
    rows: [
      "       +########+       ",
      "      /============\\    ",
      "     /~~~^^g^^~~~~~~\\   ",
      "    +################+  ",
      "    |##o##########o##|  ",
      "    |################|  ",
      "    |##ppppppppppp##|   ",
      "    |##ppppppppppp##|   ",
      "    +================+  "
    ]
  },
  armourer: {
    category: "industry",
    rows: [
      "       +########+       ",
      "      /============\\    ",
      "     /~~~^^g^^~~~~~~\\   ",
      "    +################+  ",
      "    |##o####o####o##|   ",
      "    |################|  ",
      "    |###h##†##h#####|   ",
      "    |################|  ",
      "    +================+  "
    ]
  },
  "ox-tether": {
    category: "industry",
    rows: [
      "      +########+      ",
      "     /==========\\     ",
      "    /~~~~^^g^^~~~\\    ",
      "   +##############+   ",
      "   |##o########o##|   ",
      "   |##############|   ",
      "   |##♞##########|   ",
      "   +==============+   ",
      "       tttttttt       "
    ]
  },
  market: {
    category: "industry",
    rows: [
      "  rrrrr      rrrrr      rrrrr  ",
      " /wwwww\\    /wwwww\\    /wwwww\\ ",
      "+#######++++#######++++#######+",
      "|##tTTt##|  |##tTTt##|  |##tTTt##|",
      "|########|  |########|  |########|",
      "+========+  +========+  +========+",
      "  ttttt       ttttt       ttttt "
    ]
  },
  garden: {
    category: "nature",
    rows: [
      "    ♣ll♣     ✿     ♣ll♣    ",
      "  ♣llllll♣       ♣llllll♣  ",
      "    ♣ll♣     ✿     ♣ll♣    ",
      "  ✿      +=========+    ✿ ",
      "         |ttt@@@ttt|       ",
      "         +=========+       "
    ]
  },
  gallows: {
    category: "town",
    rows: [
      "  ttttttttttttttttt  ",
      "  |###############|  ",
      "  |###t#######t###|  ",
      "  |###t###†###t###|  ",
      "  |###t#######t###|  ",
      "  |###############|  ",
      "  +===============+  "
    ]
  },
  trebuchet: {
    category: "siege",
    rows: [
      "              hhhhhh",
      "          hhhh      ",
      "      hhhh          ",
      "  tttt               ",
      "  |##|         ####  ",
      "  |##|      ###    # ",
      "  |##|    ##       # ",
      "  |##|  ##       ##  ",
      "  +==+##=======##    ",
      "      ttttttttt       "
    ]
  },
  mangonel: {
    category: "siege",
    rows: [
      "       hhhhhh       ",
      "       |    |       ",
      "       |    |       ",
      "    ttt|    |ttt    ",
      "   /###|    |###\\   ",
      "  /####+====+####\\  ",
      "  |##############|  ",
      "  +==============+  ",
      "    ttt        ttt   "
    ]
  },
  "battering-ram": {
    category: "siege",
    rows: [
      "     +################+     ",
      "   //tttttttttttttttttt\\\\   ",
      "  /tttTTTTTTTTTTTTTTTTttt\\  ",
      "  |######################|  ",
      "  |##♞##############♞###|  ",
      "  +======================+  ",
      "     o              o       "
    ]
  },
  "siege-tower": {
    category: "siege",
    rows: [
      "         +####+         ",
      "         |####|         ",
      "       /========\\       ",
      "      +##########+      ",
      "      |##o####o##|      ",
      "      |##########|      ",
      "      |##o####o##|      ",
      "      |##########|      ",
      "      |##o####o##|      ",
      "      +==========+      ",
      "       tttttttttt       "
    ]
  },
  bridge: {
    category: "fortress",
    rows: [
      "    ttttttttttttttttt    ",
      "  ##+================+## ",
      "  ##|tttttttttttttttt|## ",
      "  ##|tttttttttttttttt|## ",
      "  ##+================+## ",
      "      ▒▒▒▒▒▒▒▒▒▒▒      "
    ]
  },
  wagon: {
    category: "industry",
    rows: [
      "      +########+      ",
      "     /ssssssssss\\     ",
      "    +############+    ",
      "    |##tttttttt##|    ",
      "    +============+    ",
      "     o          o     ",
      "    o            o    "
    ]
  },
  "ox-cart": {
    category: "industry",
    rows: [
      "  ♞       +########+      ",
      " /|\\     /tttttttttt\\     ",
      " / \\    +############+    ",
      "        |##tttttttt##|    ",
      "        +============+    ",
      "          o        o       "
    ]
  },
  camp: {
    category: "nature",
    rows: [
      "          ~~~          ",
      "         ~~~~~         ",
      "           *           ",
      "        *  *  *        ",
      "       ttttttttt       ",
      "      /ttttttttt\\      ",
      "     /ttttttttttt\\     ",
      "     +===========+     "
    ]
  },
  shrine: {
    category: "town",
    rows: [
      "           +g+          ",
      "           |†|          ",
      "        +##| |##+       ",
      "       /========\\      ",
      "      /~~~^^g^~~~\\     ",
      "     +############+    ",
      "     |##o######o##|    ",
      "     +============+    "
    ]
  }
};

const U: Record<string, Pattern> = {
  knight: {
    category: "unit",
    rows: [
      "       +h+       ",
      "      /hhh\\      ",
      "     /h###h\\     ",
      "     |h#o#h|     ",
      "      |###|      ",
      "   +==|###|==+   ",
      "   |w##h##h##w|  ",
      "   |w##†##h##w|  ",
      "   +##h####h##+  ",
      "      |ttt|      ",
      "      |t|t|      ",
      "       t t       "
    ]
  },
  sergeant: {
    category: "unit",
    rows: [
      "       +hhh+      ",
      "      /hhhhh\\     ",
      "     |h#o#h|      ",
      "      |###|       ",
      "   +==|ttt|==+    ",
      "   |ttt#h#ttt|    ",
      "   |ttt#†#ttt|    ",
      "   +###h#####+    ",
      "      |ttt|       ",
      "      |t|t|       ",
      "       t t        "
    ]
  },
  spearman: {
    category: "unit",
    rows: [
      "        h         ",
      "        |         ",
      "        |         ",
      "       +h+        ",
      "      /hhh\\       ",
      "     |h#o#h|      ",
      "      |###|       ",
      "   +==|www|==+    ",
      "   |ww#†#ww|      ",
      "   +###ttt#+      ",
      "      |t|t|       ",
      "       t t        "
    ]
  },
  crossbowman: {
    category: "unit",
    rows: [
      "       +hhh+      ",
      "      /hhhhh\\     ",
      "     |h#o#h|      ",
      "      |###|       ",
      "   +==|www|==+    ",
      "   |ww#†#ww|      ",
      "   +##h╳h##+      ",
      "      |ttt|       ",
      "      |t|t|       ",
      "       t t        "
    ]
  },
  archer: {
    category: "unit",
    rows: [
      "        h         ",
      "       /h\\        ",
      "      |#o#|       ",
      "       |#|        ",
      "   )== |w| ==(    ",
      "  )    |†|    (   ",
      "   )   |w|   (    ",
      "        |         ",
      "       / \\        ",
      "      t   t       "
    ]
  },
  cavalry: {
    category: "unit",
    rows: [
      "             +hhh+      ",
      "            /hhhhh\\     ",
      "           |h#o#h|      ",
      "        +==|###|==+     ",
      "   ♞  /################\\ ",
      "  /|\\ |##w###†###w###|  ",
      "  / \\ |################| ",
      "      +===tttttttttt===+ ",
      "       o            o    ",
      "       t            t    "
    ]
  },
  villager: {
    category: "unit",
    rows: [
      "       sssss        ",
      "      sssssss       ",
      "     |c#o#c|        ",
      "      |ccc|         ",
      "    +==|ppp|==+     ",
      "    |ppp###ppp|     ",
      "    +#########+     ",
      "       |tt|         ",
      "       t  t         "
    ]
  },
  priest: {
    category: "unit",
    rows: [
      "        +†+         ",
      "        |w|         ",
      "      /wwwww\\       ",
      "     |w#c#w|        ",
      "      |ccc|         ",
      "   +==|www|==+      ",
      "   |www#†#www|      ",
      "   +#########+      ",
      "      |www|         ",
      "      |w|w|         "
    ]
  },
  lord: {
    category: "unit",
    rows: [
      "        ggggg       ",
      "       g+g+g+g      ",
      "       |www|        ",
      "      /wwwww\\       ",
      "     |w#o#w|        ",
      "      |###|         ",
      "   +==|www|==+      ",
      "   |www#†#www|      ",
      "   |wwwwwwwww|      ",
      "   +#########+      ",
      "      |www|         ",
      "      |w|w|         ",
      "       t t          "
    ]
  },
  "banner-bearer": {
    category: "unit",
    rows: [
      "        ⚑          ",
      "        |          ",
      "        |          ",
      "       +hhh+       ",
      "      /hhhhh\\      ",
      "     |h#o#h|       ",
      "      |###|        ",
      "   +==|www|==+     ",
      "   |www#†#www|     ",
      "   +#########+     ",
      "      |t|t|        "
    ]
  },
  scout: {
    category: "unit",
    rows: [
      "       sssss       ",
      "      /sssss\\      ",
      "     |s#o#s|       ",
      "      |###|        ",
      "   +==|ttt|==+     ",
      "   |ttt#t#ttt|     ",
      "   +#########+     ",
      "      |t|t|        ",
      "       t t         "
    ]
  },
  engineer: {
    category: "unit",
    rows: [
      "       hhh         ",
      "      /hhh\\        ",
      "     |h#o#h|       ",
      "      |###|        ",
      "   +==|ttt|==+     ",
      "   |ttt#h#ttt|     ",
      "   +#########+     ",
      "      |t|t|        ",
      "       t t         "
    ]
  },
  miner: {
    category: "unit",
    rows: [
      "       sss         ",
      "      /sss\\        ",
      "     |s#o#s|       ",
      "      |###|        ",
      "   +==|ttt|==+     ",
      "   |ttt#h#ttt|     ",
      "   +#########+     ",
      "      |t|t|        ",
      "       t t         "
    ]
  },
  messenger: {
    category: "unit",
    rows: [
      "       sss         ",
      "      /sss\\        ",
      "     |s#o#s|       ",
      "      |###|        ",
      "   +==|www|==+     ",
      "   |www#†#www|     ",
      "   +#########+     ",
      "      |t|t|        ",
      "       t t         "
    ]
  }
};

const HERALDIC = new Set<TeutonicAssetKind>([
  "keep", "watchtower", "gate", "barbican", "barracks", "armory",
  "manor", "chapel", "church", "cathedral", "monastery", "shrine"
]);
const SMOKE = new Set<TeutonicAssetKind>(["bakery", "brewery", "smithy", "pitch"]);
const PALETTES: Record<string, string> = {
  ...P,
  w: C.white,
  R: C.red,
  b: C.black,
  g: C.gold
};

function familyPalette(faction: TeutonicAssetOptions["faction"]): { cloth: string; shadow: string; trim: string; metal: string } {
  switch (faction) {
    case "polish": return POLISH;
    case "enemy": return ENEMY;
    case "neutral": return NEUTRAL;
    default: return ORDER;
  }
}

/**
 * High-density medieval miniatures drawn from independently positioned glyphs.
 * Patterns are an authoring shorthand only: every cell enters the existing GPU
 * glyph renderer, never a bitmap, sprite sheet or Canvas image.
 */
export function drawTeutonicAsset(
  parent: Container,
  kind: TeutonicAssetKind,
  x: number,
  y: number,
  options: TeutonicAssetOptions = {}
): TeutonicAssetStats {
  const pattern = U[kind] ?? B[kind];
  if (!pattern) throw new RangeError("Unknown Teutonic asset: " + kind);
  const scale = clamp(options.scale ?? 1, 0.35, 2.4);
  const rows = pattern.rows;
  const chars = rows.map(row => Array.from(row));
  const width = Math.max(...chars.map(row => row.length));
  const height = rows.length;
  const cell = 5.2 * scale;
  const stepX = cell * 0.82;
  const stepY = cell * 0.84;
  const faction = options.faction ?? "order";
  const heraldry = options.heraldry ?? HERALDIC.has(kind);
  const colors = familyPalette(faction);
  const palette = { ...PALETTES, ...(pattern.palette ?? {}) };
  let glyphCount = 0;
  const centerCol = (width - 1) / 2;
  const centerRow = (height - 1) / 2;

  // Low offset shadow, then the material body: this keeps the little buildings
  // legible against a black map without turning them into a flat icon.
  if (options.shadow !== false) {
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < (chars[row]?.length ?? 0); col += 1) {
        const char = chars[row]?.[col] ?? " ";
        if (char === " ") continue;
        addGlyph(parent, {
          char,
          x: x + (col - centerCol) * stepX + cell * 0.12,
          y: y + (row - centerRow) * stepY + cell * 0.18,
          size: cell * 1.02,
          color: C.shadow,
          alpha: 0.5,
          weight: "bold",
          material: pattern.category === "unit" ? "unit" : "building",
          height: 0.08,
          ...(options.lod ? { lod: options.lod } : {})
        });
        glyphCount += 1;
      }
    }
  }

  for (let row = 0; row < height; row += 1) {
    const line = chars[row] ?? [];
    for (let col = 0; col < line.length; col += 1) {
      const char = line[col] ?? " ";
      if (char === " ") continue;
      const isUnit = pattern.category === "unit";
      const factionColor =
        char === "w" ? colors.cloth :
        char === "R" ? colors.trim :
        char === "b" ? colors.shadow :
        char === "h" && isUnit ? colors.metal :
        palette[char] ?? C.stone;
      const frontEdge = col < Math.max(1, width * 0.36);
      const sideShade = col > width * 0.68 ? 0.84 : 1;
      const jitterX = Math.sin(row * 2.31 + col * 1.73) * cell * 0.035;
      const jitterY = Math.cos(row * 1.61 + col * 2.19) * cell * 0.03;
      const sizeNoise = 0.96 + ((row * 13 + col * 7) % 5) * 0.012;
      const isMasonry = char === "#" || char === "█" || char === "▓" || char === "▒";
      const isHighlight = char === "+" || char === "░" || char === "g" || char === "h";
      const isFire = char === "*";
      addGlyph(parent, {
        char,
        x: x + (col - centerCol) * stepX + jitterX,
        y: y + (row - centerRow) * stepY + jitterY,
        size: cell * sizeNoise * (isHighlight ? 0.94 : 1.04),
        color: sideShade < 1 ? shade(factionColor, sideShade) : factionColor,
        alpha: isFire ? 0.96 : isMasonry ? 0.97 : 0.92,
        weight: "bold",
        material: isUnit ? "unit" : "building",
        height: clamp(0.16 + (1 - row / Math.max(1, height - 1)) * 0.48, 0.12, 0.68),
        normal: isMasonry ? (frontEdge ? [-0.18, 0.14, 0.97] : [0.2, 0.12, 0.96]) : [0, 0.08, 1],
        ...(isFire ? { emissive: 0.8, emissiveColor: C.fire, animated: true } : {}),
        ...(options.entityId !== undefined ? { entityId: options.entityId } : {}),
        ...(options.lod ? { lod: options.lod } : {})
      });
      glyphCount += 1;
    }
  }

  if (heraldry) {
    drawPennant(parent, x + width * stepX * 0.36, y - height * stepY * 0.42, scale, faction, options);
    glyphCount += faction === "enemy" ? 2 : 3;
  }

  if (pattern.category === "unit") {
    const shieldX = x - width * stepX * 0.28;
    const shieldY = y + height * stepY * 0.09;
    addGlyph(parent, {
      char: "▣", x: shieldX, y: shieldY, size: 8.3 * scale,
      color: faction === "enemy" ? ENEMY.trim : faction === "polish" ? POLISH.trim : C.white,
      weight: "bold", material: "unit", height: 0.38, alpha: 0.98,
      ...(options.lod ? { lod: options.lod } : {})
    });
    if (faction === "order") {
      addGlyph(parent, {
        char: "✠", x: shieldX, y: shieldY, size: 5.2 * scale,
        color: C.black, weight: "bold", material: "unit", height: 0.4,
        ...(options.lod ? { lod: options.lod } : {})
      });
    } else if (faction === "polish") {
      addGlyph(parent, {
        char: "♞", x: shieldX, y: shieldY, size: 4.8 * scale,
        color: C.white, weight: "bold", material: "unit", height: 0.4,
        ...(options.lod ? { lod: options.lod } : {})
      });
    }
    glyphCount += faction === "enemy" ? 1 : 2;
  }

  if (SMOKE.has(kind)) {
    const smokeX = x + width * stepX * 0.22;
    const smokeY = y - height * stepY * 0.42;
    for (let puff = 0; puff < 3; puff += 1) {
      addGlyph(parent, {
        char: puff === 1 ? "~" : "·",
        x: smokeX + Math.sin(puff * 1.7) * cell * 0.38,
        y: smokeY - puff * cell * 0.68,
        size: cell * (0.66 - puff * 0.08),
        color: C.smoke,
        alpha: 0.28 + puff * 0.05,
        material: "vfx",
        animated: true,
        height: 0.06,
        ...(options.lod ? { lod: options.lod } : {})
      });
      glyphCount += 1;
    }
  }

  if (options.label) {
    addWord(
      parent,
      options.label.toLocaleUpperCase("pl-PL"),
      x,
      y + height * stepY * 0.5 + 9 * scale,
      6.2 * scale,
      C.gold,
      0.78
    );
    glyphCount += Array.from(options.label).length;
  }

  return { width, height, glyphs: glyphCount, category: pattern.category };
}

function drawPennant(
  parent: Container,
  x: number,
  y: number,
  scale: number,
  faction: NonNullable<TeutonicAssetOptions["faction"]>,
  options: TeutonicAssetOptions
): void {
  addGlyph(parent, {
    char: "|", x, y: y + 10 * scale, size: 22 * scale,
    color: C.timberLight, weight: "bold", material: "building",
    ...(options.lod ? { lod: options.lod } : {})
  });
  const flagColor = faction === "enemy" ? ENEMY.trim : faction === "polish" ? POLISH.trim : C.white;
  addGlyph(parent, {
    char: "⚑", x: x + 5.8 * scale, y, size: 17 * scale,
    color: flagColor, weight: "bold", material: "building",
    ...(options.lod ? { lod: options.lod } : {})
  });
  if (faction === "order") {
    addGlyph(parent, {
      char: "✠", x: x + 5.8 * scale, y, size: 8 * scale,
      color: C.black, weight: "bold", material: "building",
      ...(options.lod ? { lod: options.lod } : {})
    });
  } else if (faction === "polish") {
    addGlyph(parent, {
      char: "♞", x: x + 5.8 * scale, y, size: 7 * scale,
      color: C.white, weight: "bold", material: "building",
      ...(options.lod ? { lod: options.lod } : {})
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function shade(hex: string, factor: number): string {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw.length === 3 ? raw.split("").map(c => c + c).join("") : raw, 16);
  if (!Number.isFinite(value)) return hex;
  const r = Math.min(255, Math.round(((value >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((value >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((value & 255) * factor));
  return "#" + [r, g, b].map(channel => channel.toString(16).padStart(2, "0")).join("");
}

export const TEUTONIC_PALETTE = C;
export const TEUTONIC_ASSET_KINDS = Object.freeze([...Object.keys(B), ...Object.keys(U)] as TeutonicAssetKind[]);