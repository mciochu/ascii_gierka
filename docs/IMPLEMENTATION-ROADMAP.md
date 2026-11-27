# DOMINIUM — plan realizacji specyfikacji Twierdzy: Krzyżowiec

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
**Status: ukończony.**

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
Zakres: sekcja 5 specyfikacji.
- Fizyczny Skład, Spichlerz i Zbrojownia z pojemnością pól; złoto pozostaje zasobem globalnym.
- Dostawy piesze, trasy pracowników, czas produkcji zależny od odległości i blokada przy pełnym magazynie.
- Rozbudowa magazynów modułami i sprzedaż nadwyżek.
- Oaza, drzewa, jelenie, kamień, żelazo i smoła jako rzeczywiste zasoby mapy.
- Wszystkie łańcuchy żywności, piwa, surowców, broni i pancerzy oraz zależności wejścia/wyjścia.
- Targowisko z ręcznym handlem, stałymi cenami, spreadem i kontrolą wolnego miejsca.
**Status: do wykonania.**

### Etap 5 — twierdza, fortyfikacje i pełne wojsko
Zakres: sekcje 6 i 7 oraz warunki zwycięstwa/porażki z sekcji 1.
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
- Nękające oddziały, progi oblężenia, machinie oblężnicze i reakcje obronne.
- Alerty Skryby i komunikaty tekstowe/głosowe dla stanów krytycznych.
- Integracja miesięcznego bilansu z pracą budynków, magazynami, populacją, wojskiem i AI; końcowe testy regresji.
**Status: do wykonania.**

## Wcześniej wykonane fundamenty (nie są osobnym etapem)

- Zegar RTS z prędkością 20–90, domyślnie 40, pauzą P i miesięcznym tickiem.
- Podstawowa symulacja racji, różnorodności żywności, podatków, piwa, religii, strachu, popularności i przyrostu/odpływu ludności.
- Testy symulacji miesięcznej oraz skrypt weryfikacji TypeScript + build.
- Prototyp PixiJS, wybieranie obiektów, grupy kontrolne, ruch, uproszczona walka i wieża strażnicza.

## Dziennik wdrożeń

### Etap 1 — fundament mapy i świata (2026-11-27)
- Dodano `src/engine/grid.ts`: logiczna siatka 100×100 z izometrycznym mapowaniem komórek na współrzędne świata.
- Dodano typy terenu: piasek, oaza, las, woda, wzgórza, klify, złoża kamienia, żelaza i smoły; pola mają wysokość oraz flagi przechodniości i zabudowy.
- Mapa jest renderowana znakami Unicode; wysokości wpływają na pozycję znaków terenu.
- Dodano obrót mapy w czterech kierunkach skrótami X/C; kamera, zoom, hit-test i zaznaczanie przeliczają współrzędne przy obrocie.
- Rozkazy ruchu i ataku w ruchu korzystają z tras po siatce. Woda i klify blokują przejście, a trasa omija przeszkody.
- Budowa wieży odrzuca teren nieprzeznaczony pod zabudowę.
- Dodano testy geometrii, typów terenu, wysokości, blokad, tras i obrotu mapy.
- Weryfikacja: 14/14 testów PASS, TypeScript PASS, Vite build PASS.
- Ograniczenia, które pozostają na później: brak jeszcze stawiania/zasypywania fos, budowy murów i pełnej obsługi terenu przez gospodarkę; brak fizycznego Lorda i reguły porażki; teren zasobów nie jest jeszcze połączony z pełnymi łańcuchami produkcyjnymi.
