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