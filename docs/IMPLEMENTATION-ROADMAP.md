# DOMINIUM — realizacja specyfikacji Twierdzy: Krzyżowiec

Źródło wymagań: przekazany plik „Specyfikacja systemu gry: Twierdza: Krzyżowiec (Stronghold Crusader, 2002 / HD)” z 2026-11-27.

## Zasady projektu

- Świat i wszystkie obiekty pozostają renderowane znakami Unicode na czarnym tle; bez bitmap, sprite'ów i tekstur graficznych.
- GitHub `mciochu/ascii_gierka`, gałąź `main`, jest źródłem kodu. Produkcja działa na Ubuntu VPS; nie używać Render ani Vercel.
- Każdy etap: implementacja → testy i TypeScript → build → wdrożenie → kontrola HTTP i regresji.
- Nie oznaczać mechaniki jako gotowej, dopóki rzeczywiście działa w symulacji, a nie tylko prezentuje się w HUD.
- Nie dopowiadać arbitralnie brakujących kosztów ani reguł. Wartości nieokreślone w specyfikacji pozostają konfigurowalne albo wyłączone.

## Podział całej specyfikacji na 6 etapów

### Etap 1 — fundament mapy i świata
Zakres: przestrzeń i fizyka mapy z sekcji 1 oraz podstawy geometrii potrzebne do dalszych systemów.
- Izometryczna siatka logiczna, mapowanie komórka ↔ współrzędne świata i ustalone rozmiary pól.
- Cztery orientacje mapy, obrót co 90° bez rozjeżdżania obiektów, zaznaczeń i kamery.
- Typy terenu: pustynia/piasek, oaza, las, wzgórza, klify, woda, złoża kamienia, żelaza i smoły.
- Wysokość terenu oraz przeszkody nieprzechodnie.
- Wyznaczanie tras po siatce z omijaniem wody i klifów; walidacja miejsca budowy.
- Przygotowanie siatki pod późniejsze fosy, mury, bramy i fizyczne zasoby.
**Status: ukończony w zakresie fundamentu mapy; audyt techniczny PASS.** Nie oznacza to ukończenia całej sekcji 1 pierwotnego dokumentu — fizyczne magazyny są w etapie 4, a Lord i warunek porażki w etapie 5.

### Etap 2 — kompletny HUD i klasyczne sterowanie
Zakres: sekcje 2 i 3 specyfikacji.
- Dolny HUD z sześcioma tarczami kategorii budowania oraz pełnym katalogiem budynków.
- Środkowy panel kontekstowy dla budowy, budynków i grup jednostek.
- Skryba, księga raportów, minimapa, ranking, dyplomacja, opcje, Undo i burzenie.
- Klasyczny schemat LPM: wybór i wydawanie rozkazów zależnie od kontekstu.
- Portrety typów jednostek, rozkazy specjalne, menu gestów kamery, minimapa i zakładki kamery.
- Skróty opisane w dokumencie, edge-scroll, flatten, zoom oraz pełne zachowanie pauzy.
**Status: do wykonania.**

### Etap 3 — mieszkańcy, populacja i popularność
Zakres: sekcja 4 specyfikacji.
- Ognisko, limit 24 bezrobotnych, tempo przyrostu zależne od popularności i odejścia mieszkańców.
- Chłopi obsadzają nieobsadzone budynki; rekrutacja zużywa chłopa, żołnierze nie zużywają żywności ani miejsc w chatach.
- Pełny bilans racji i różnorodności, podatków/łapówek, piwa, religii i Fear Factor.
- Rzeczywiste obiekty Dobrych i Złych Rzeczy, księża i wygasające błogosławieństwa.
- Raport popularności „W nadchodzącym miesiącu” z rozbiciem wszystkich modyfikatorów.
**Status: częściowe podstawy ekonomii są już w kodzie; pełny cykl życia mieszkańców pozostaje do wykonania.**

### Etap 4 — magazyny, logistyka i łańcuchy produkcyjne
Zakres: sekcja 5 specyfikacji oraz fizyczne zasoby z sekcji 1.
- Fizyczny Skład, Spichlerz i Zbrojownia z pojemnością pól; złoto pozostaje zasobem globalnym.
- Dostawy piesze, trasy pracowników, czas produkcji zależny od odległości i blokada przy pełnym magazynie.
- Rozbudowa magazynów modułami i sprzedaż nadwyżek.
- Oaza, drzewa, jelenie, kamień, żelazo i smoła jako rzeczywiste zasoby mapy.
- Wszystkie łańcuchy żywności, piwa, surowców, broni i pancerzy oraz zależności wejścia/wyjścia.
- Targowisko z ręcznym handlem, stałymi cenami, spreadem i kontrolą wolnego miejsca.
**Status: do wykonania.**

### Etap 5 — twierdza, fortyfikacje i pełne wojsko
Zakres: sekcje 6 i 7 oraz Lord/warunki zwycięstwa i porażki z sekcji 1.
- Mury, wieże, bramy, schody, mosty, szczelność zamku i przejmowanie bram.
- Fosy kopane przez jednostki, zasypywanie, wysokość i bonusy fortyfikacji.
- Smoła, ogień, rozprzestrzenianie pożarów, gaszenie, wrzący olej i zaraza.
- Jednostki europejskie, arabskie i specjaliści; wymagania rekrutacji, brak regeneracji HP.
- Machiny oblężnicze, artyleria wieżowa, trzy postawy, patrole, ostrzał punktu i friendly fire.
- Lord jako pojedynczy władca na Siedzibie, samoobrona i natychmiastowa porażka po jego śmierci.
**Status: istnieje tylko prototyp podstawowych oddziałów i uproszczonej walki; etap nie jest rozpoczęty.**

### Etap 6 — symulacja czasu rzeczywistego, cywile i AI
Zakres: sekcja 8 oraz końcowa integracja wszystkich systemów.
- FSM pracowników: pobranie surowca → transport → przetworzenie → dostawa → ewentualna przerwa.
- Oczekiwanie przy budynku, gdy brakuje surowca albo miejsca w magazynie.
- Lordowie AI z planami zamków, własną ekonomią, handlem, rekrutacją i realnymi kosztami.
- Nękające oddziały, progi oblężenia, machiny oblężnicze i reakcje obronne.
- Alerty Skryby i komunikaty tekstowe/głosowe dla stanów krytycznych.
- Integracja miesięcznego bilansu z pracą budynków, magazynami, populacją, wojskiem i AI; końcowe testy regresji.
**Status: do wykonania.**

## Wcześniej wykonane fundamenty (nie są osobnym etapem)

- Zegar RTS z prędkością 20–90, domyślnie 40, pauzą P i miesięcznym tickiem.
- Podstawowa symulacja racji, różnorodności żywności, podatków, piwa, religii, strachu, popularności i przyrostu/odpływu ludności.
- Testy symulacji miesięcznej oraz skrypt weryfikacji TypeScript + build.
- Prototyp PixiJS, wybieranie obiektów, grupy kontrolne, ruch, uproszczona walka i wieża strażnicza.

## Dziennik audytu i wdrożeń

### Etap 1 — fundament mapy i świata (2026-11-27)

**Implementacja**
- `src/engine/grid.ts`: logiczna siatka 100×100 pól, izometryczne mapowanie komórka ↔ współrzędne świata.
- Kafelek ma wymiary projekcyjne 26×18; przesunięcie wysokości wynosi 3 jednostki na poziom. Środek siatki jest wspólnym pivotem kamery.
- Wszystkie 10 000 środków pól mieści się w granicach świata 2600×1850, są unikalne i dokładnie mapują się w obie strony.
- Rodzaje terenu: piasek, oaza, las, woda, wzgórza, klify, złoża kamienia, żelaza i smoły. Każde pole przechowuje wysokość, przechodniość i możliwość zabudowy.
- Obszary lasu, oaz i rzeka są umieszczone wewnątrz rombowej granicy mapy; początkowe budynki i oddziały znajdują się na przechodnich polach.
- Mapa jest renderowana znakami Unicode. Zwykły piasek ma rzadsze znaczniki, żeby nie tworzyć osobnego obiektu tekstowego dla każdego domyślnego pola.
- Obrót X/C działa w czterech kierunkach; wspólne przekształcenia kamery są używane dla renderowania, hit-testu i zaznaczania.
- Ruch, atak w ruchu i pościg w walce korzystają z tras po siatce. Woda i klify blokują ruch; diagonalne przejście nie może ścinać narożników blokowanych pól.
- Po zakończeniu lokalnej walki oddział z rozkazem ataku w ruchu wraca do pierwotnego celu.
- Budowanie wieży jest przyciągane do środka pola i odrzuca teren niedozwolony.
- W pauzie zatrzymuje się symulacja i ruch jednostek, ale nadal można przesuwać kamerę.

**Usterki wykryte w audycie i poprawione**
- Pierwotne kafle 64×32 powodowały, że tylko 4 754 z 10 000 środków pól znajdowały się w granicach mapy. Zmieniono geometrię na 26×18 i wycentrowano pivot.
- Zbyt duży krok wysokości powodował nakładanie się środków sąsiednich pól. Zmniejszono go do 3 i dodano wyczerpujący test mapowania wszystkich komórek.
- Zwykły rozkaz ataku wcześniej pościgał cel po prostej. Pościg został podłączony do wyszukiwania trasy po siatce.
- Dekoracyjne lasy i rzeka częściowo leżały poza granicą siatki. Przesunięto je i zsynchronizowano z logicznym terenem.
- Początkowy wrogi oddział stał na nowym polu wodnym. Przeniesiono go na pole przechodnie i dodano test pozycji wszystkich obiektów startowych.
- Nawigacja kamery strzałkami działa również podczas pauzy; sama symulacja pozostaje zatrzymana.

**Wynik testów**
- 21/21 testów automatycznych PASS (w tym 12 testów siatki/kamery/tras oraz wcześniejsze testy symulacji ekonomicznej).
- TypeScript PASS.
- Vite production build PASS.
- Audyt siatki: 10 000/10 000 unikalnych środków pól, 0 poza mapą, 0 błędów mapowania.
- 9 196 pól przechodnich w jednej spójnej sieci; trasy do lasu, oazy i złóż są osiągalne.
- Wszystkie początkowe obiekty leżą na przechodnich polach.
- Weryfikacja obejmuje logikę i build. Ręczny test obrazu w przeglądarce nie został wykonany na VPS, ponieważ uruchomiony headless Chromium nie startuje bez systemowej biblioteki `libatk-1.0.so.0`.

**Granice tego etapu — nie oznaczać jako gotowe**
- Fosa jest przewidziana jako typ terenu w modelu, ale nie ma jeszcze wyznaczania, kopania ani zasypywania; to etap 5.
- Fizyczne magazyny, pojemność pól i dostawy pracowników nie są jeszcze wdrożone; to etap 4.
- Lord, jego samoobrona, śmierć i warunek porażki nie są jeszcze wdrożone; to etap 5.
- Zasoby złoża są oznaczone na mapie, ale wydobycie i łańcuchy transportu są etapem 4.
- Pełne UI obrotu i menu gestów kamery, minimapa, HUD i pozostałe skróty są etapem 2.
