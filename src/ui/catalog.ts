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
      { id: "armory", name: "Zbrojownia", glyph: "⚔", cost: "70 drewna · 25 kamienia", implemented: true, note: "Fizyczny magazyn na broń i pancerze." },
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
      { id: "stockpile", name: "Skład (Stockpile)", glyph: "▥", cost: "60 drewna · 20 kamienia", implemented: true, note: "Magazyn surowców; rozbudowa przez dostawianie modułów." },
      { id: "woodcutter", name: "Chata drwala", glyph: "♧", cost: "30 drewna", implemented: true, note: "Wymaga lasu w pobliżu. Drewno trafia pieszo do Składu." },
      { id: "quarry", name: "Kamieniołom", glyph: "◈", cost: "50 drewna · 10 kamienia", implemented: true, note: "Stawiany na złożu kamienia. Wymaga 3 pracowników i działającego uwiązu wołu." },
      { id: "ox-tether", name: "Wół (Ox Tether)", glyph: "♉", cost: "20 drewna", implemented: true, note: "Przypisz do kamieniołomu; zatrudnia dodatkowego pracownika i uruchamia transport bloków." },
      { id: "iron-mine", name: "Kopalnia żelaza", glyph: "◆", cost: "45 drewna · 15 kamienia", implemented: true, note: "Stawiana na złożu żelaza. Sztabki trafiają do Składu." },
      { id: "pitch-worker", name: "Warsztat smolarza", glyph: "◉", cost: "35 drewna · 5 kamienia", implemented: true, note: "Stawiany na bagnie smołowym. Beczki trafiają do Składu." },
      { id: "market", name: "Targowisko (Market)", glyph: "⚖", cost: "80 drewna · 15 kamienia", implemented: true, note: "Ręczny zakup i sprzedaż towarów w paczkach po 1 lub 5 sztuk." }
    ]
  },
  {
    id: "agriculture", name: "Rolnictwo", shortName: "ROLNICTWO", glyph: "❧",
    description: "Produkcja żywności i gospodarstwa na oazie.",
    items: [
      { id: "granary", name: "Spichlerz (Granary)", glyph: "▤", cost: "60 drewna · 10 kamienia", implemented: true, note: "Fizyczny magazyn żywności; rozbudowa przez dostawianie modułów." },
      { id: "hunter", name: "Chata myśliwego", glyph: "♜", cost: "25 drewna", implemented: true, note: "Wymaga stada zwierzyny w pobliżu. Mięso trafia do Spichlerza." },
      { id: "apple-orchard", name: "Sad jabłoni", glyph: "♧", cost: "25 drewna", implemented: true, note: "Stawiany na oazie. Jabłka trafiają do Spichlerza." },
      { id: "dairy-farm", name: "Farma mleczna", glyph: "♉", cost: "40 drewna", implemented: true, note: "Stawiana na oazie. Produkuje ser; krowy dla Garbarza są osobnym zasobem." },
      { id: "wheat-farm", name: "Farma pszenicy", glyph: "✧", cost: "25 drewna", implemented: true, note: "Stawiana na oazie. Pszenica trafia do Składu." },
      { id: "hop-farm", name: "Farma chmielu", glyph: "❧", cost: "25 drewna", implemented: true, note: "Stawiana na oazie. Chmiel trafia do Składu." }
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
      { id: "bowyer", name: "Łuczarz", glyph: "⌒", cost: "35 drewna", implemented: true, note: "Zużywa drewno ze Składu; łuki i kusze trafiają do Zbrojowni." },
      { id: "poleturner", name: "Drzewcarz", glyph: "†", cost: "30 drewna", implemented: true, note: "Zużywa drewno ze Składu; włócznie i piki trafiają do Zbrojowni." },
      { id: "blacksmith", name: "Kowal", glyph: "⚒", cost: "35 drewna · 10 kamienia", implemented: true, note: "Zużywa żelazo ze Składu; broń trafia do Zbrojowni." },
      { id: "tanner", name: "Garbarz", glyph: "▤", cost: "35 drewna", implemented: true, note: "Zużywa bydło wytworzone przez farmę mleczną; pancerze trafiają do Zbrojowni." },
      { id: "armourer", name: "Płatnerz", glyph: "♢", cost: "35 drewna · 10 kamienia", implemented: true, note: "Zużywa żelazo ze Składu; zbroje trafiają do Zbrojowni." }
    ]
  },
  {
    id: "food", name: "Przetwórstwo żywności", shortName: "ŻYWNOŚĆ", glyph: "♨",
    description: "Młyn, piekarnia, browar i gospoda.",
    items: [
      { id: "mill", name: "Młyn", glyph: "✣", cost: "60 drewna · 15 kamienia", implemented: true, note: "Wymaga pszenicy w Składzie; produkuje mąkę do Składu." },
      { id: "bakery", name: "Piekarnia", glyph: "♨", cost: "30 drewna", implemented: true, note: "Zużywa mąkę ze Składu; 1 mąka daje 8 chlebów do Spichlerza." },
      { id: "brewery", name: "Browar", glyph: "♜", cost: "40 drewna", implemented: true, note: "Zużywa chmiel ze Składu; piwo trafia do Składu." },
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
