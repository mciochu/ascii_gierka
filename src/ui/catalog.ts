export interface BuildItem {
  id: string;
  name: string;
  glyph: string;
  cost?: string;
  implemented?: boolean;
  note?: string;
}

export interface BuildCategory {
  id: string;
  name: string;
  shortName: string;
  glyph: string;
  description: string;
  items: BuildItem[];
}

const unavailable = "Mechanika tej budowli należy do kolejnego etapu i nie jest jeszcze dostępna.";

export const BUILD_CATEGORIES: BuildCategory[] = [
  {
    id: "castle", name: "Budowle zamkowe", shortName: "ZAMEK", glyph: "♜",
    description: "Fortyfikacje, wieże i infrastruktura obronna.",
    items: [
      { id: "watchtower", name: "Wieża strażnicza", glyph: "▥", cost: "70 drewna · 30 kamienia", implemented: true, note: "Dostępna budowa prototypowej wieży strażniczej." },
      { id: "wall-high", name: "Mur wysoki", glyph: "▤", note: unavailable },
      { id: "wall-low", name: "Mur niski", glyph: "▥", note: unavailable },
      { id: "stairs", name: "Schody", glyph: "╱", note: unavailable },
      { id: "crenellations", name: "Blanki", glyph: "▦", note: unavailable },
      { id: "gate-small", name: "Brama mała", glyph: "▥", note: unavailable },
      { id: "gate-large", name: "Brama duża", glyph: "▥", note: unavailable },
      { id: "drawbridge", name: "Most zwodzony", glyph: "╫", note: unavailable },
      { id: "towers", name: "Wieże (5 rozmiarów)", glyph: "♜", note: unavailable },
      { id: "barracks", name: "Koszary", glyph: "▤", note: unavailable },
      { id: "mercenary-post", name: "Obóz najemników", glyph: "⚑", note: unavailable },
      { id: "engineer-guild", name: "Gildia inżynierów", glyph: "⚒", note: unavailable },
      { id: "diggers-guild", name: "Gildia kopaczy", glyph: "⚒", note: unavailable },
      { id: "stables", name: "Stajnie", glyph: "♞", note: unavailable },
      { id: "armory", name: "Zbrojownia", glyph: "⚔", note: unavailable },
      { id: "dog-kennel", name: "Klatka z psami", glyph: "♟", note: unavailable },
      { id: "tar-pit", name: "Doły ze smołą", glyph: "◉", note: unavailable },
      { id: "wolf-pit", name: "Wilcze doły", glyph: "⌄", note: unavailable },
      { id: "braizer", name: "Koksownik", glyph: "♨", note: unavailable },
      { id: "oil-cauldron", name: "Kocioł z olejem", glyph: "♨", note: unavailable },
      { id: "moat-plan", name: "Wyznaczanie fosy", glyph: "⌁", note: unavailable }
    ]
  },
  {
    id: "industry", name: "Przemysł", shortName: "PRZEMYSŁ", glyph: "⚒",
    description: "Surowce, transport i zaplecze gospodarcze.",
    items: [
      { id: "stockpile", name: "Skład (Stockpile)", glyph: "▥", note: unavailable },
      { id: "woodcutter", name: "Chata drwala", glyph: "♧", note: unavailable },
      { id: "quarry", name: "Kamieniołom", glyph: "◈", note: unavailable },
      { id: "ox-tether", name: "Wół (Ox Tether)", glyph: "♉", note: unavailable },
      { id: "iron-mine", name: "Kopalnia żelaza", glyph: "◆", note: unavailable },
      { id: "pitch-worker", name: "Warsztat smolarza", glyph: "◉", note: unavailable },
      { id: "market", name: "Targowisko (Market)", glyph: "⚖", note: unavailable }
    ]
  },
  {
    id: "agriculture", name: "Rolnictwo", shortName: "ROLNICTWO", glyph: "❧",
    description: "Produkcja żywności i gospodarstwa na oazie.",
    items: [
      { id: "granary", name: "Spichlerz (Granary)", glyph: "▤", note: unavailable },
      { id: "hunter", name: "Chata myśliwego", glyph: "♜", note: unavailable },
      { id: "apple-orchard", name: "Sad jabłoni", glyph: "♧", note: unavailable },
      { id: "dairy-farm", name: "Farma mleczna", glyph: "♉", note: unavailable },
      { id: "wheat-farm", name: "Farma pszenicy", glyph: "✧", note: unavailable },
      { id: "hop-farm", name: "Farma chmielu", glyph: "❧", note: unavailable }
    ]
  },
  {
    id: "town", name: "Miasto", shortName: "MIASTO", glyph: "⌂",
    description: "Mieszkania, religia, usługi i obiekty wpływające na strach.",
    items: [
      { id: "hovel", name: "Chata (Hovel)", glyph: "⌂", cost: "6 drewna · +8 miejsc", implemented: true, note: "Zwiększa pojemność mieszkalną o 8 chłopów." },
      { id: "chapel", name: "Kaplica", glyph: "✝", cost: "250 złota · 1 ksiądz", implemented: true, note: "Kapłan chodzi po zamku i błogosławi mieszkańców." },
      { id: "church", name: "Kościół", glyph: "✝", cost: "500 złota · 1 ksiądz", implemented: true, note: "Kapłan błogosławi mieszkańców; pierwszy kościół daje +1 popularności." },
      { id: "cathedral", name: "Katedra", glyph: "♜", cost: "1000 złota · 1 ksiądz", implemented: true, note: "Kapłan błogosławi mieszkańców; pierwsza katedra daje +2 popularności." },
      { id: "apothecary", name: "Apteka", glyph: "⚕", note: unavailable },
      { id: "well", name: "Studnia", glyph: "◉", note: unavailable },
      { id: "water-pot", name: "Zbiornik wodny (Water Pot)", glyph: "◉", note: unavailable },
      { id: "good-things", name: "Dobre Rzeczy · ogród", glyph: "✿", cost: "20 złota · obiekt podstawowy", implemented: true, note: "Zwiększa popularność i obrażenia wojska, ale zmniejsza wydajność pracy." },
      { id: "bad-things", name: "Złe Rzeczy · szubienica", glyph: "†", cost: "40 złota · obiekt podstawowy", implemented: true, note: "Zmniejsza popularność i obrażenia wojska, ale zwiększa wydajność pracy." }
    ]
  },
  {
    id: "weapons", name: "Produkcja broni", shortName: "BROŃ", glyph: "⚔",
    description: "Warsztaty produkujące broń i pancerze.",
    items: [
      { id: "bowyer", name: "Łuczarz", glyph: "⌒", note: unavailable },
      { id: "poleturner", name: "Drzewcarz", glyph: "†", note: unavailable },
      { id: "blacksmith", name: "Kowal", glyph: "⚒", note: unavailable },
      { id: "tanner", name: "Garbarz", glyph: "▤", note: unavailable },
      { id: "armourer", name: "Płatnerz", glyph: "♢", note: unavailable }
    ]
  },
  {
    id: "food", name: "Przetwórstwo żywności", shortName: "ŻYWNOŚĆ", glyph: "♨",
    description: "Młyn, piekarnia, browar i gospoda.",
    items: [
      { id: "mill", name: "Młyn", glyph: "✣", note: unavailable },
      { id: "bakery", name: "Piekarnia", glyph: "♨", note: unavailable },
      { id: "brewery", name: "Browar", glyph: "♜", note: unavailable },
      { id: "inn", name: "Gospoda (Inn)", glyph: "♧", cost: "20 drewna · 100 złota · 1 karczmarz", implemented: true, note: "Obsługuje do 30 mieszkańców. Bonus wymaga piwa dostarczonego ze Składu (etap 4)." }
    ]
  }
];

export function findBuildCategory(categoryId: string): BuildCategory | undefined {
  return BUILD_CATEGORIES.find((category) => category.id === categoryId);
}

export function findBuildItem(itemId: string): BuildItem | undefined {
  return BUILD_CATEGORIES.flatMap((category) => category.items).find((item) => item.id === itemId);
}