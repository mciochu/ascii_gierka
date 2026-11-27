# DOMINIUM — realizacja specyfikacji Twierdzy: Krzyżowiec

Dokument kontrolny względem specyfikacji przekazanej 2026-11-27. Statusy opisują stan kodu, nie samą obecność elementu na ekranie.

## Zasady projektu
- Świat i wszystkie obiekty pozostają renderowane znakami Unicode na czarnym tle; bez bitmap, sprite'ów i tekstur graficznych.
- GitHub `mciochu/ascii_gierka`, gałąź `main`, jest źródłem kodu. Produkcja działa na Ubuntu VPS; nie używać Render ani Vercel.
- Każdy etap: implementacja → `npm run verify` → wdrożenie → kontrola HTTP i regresji.
- Nie oznaczać mechaniki jako gotowej, dopóki nie jest wykonywana przez symulację, a nie tylko prezentowana w HUD.

## Status ogólny
- [x] Audyt bazowy: istniejący kod to prototyp PixiJS z mapą, czterema budynkami, trzema własnymi oddziałami, jednym wrogiem, ruchem, zaznaczaniem i prostą walką.
- [x] Fundament zegara RTS: prędkość 20–90 (domyślnie 40), pauza i rozliczenia miesięczne.
- [x] Fundament popularności i populacji: racje, podatki, różnorodność żywności, piwo, religia, strach, limit bezrobotnych i przyrost/odpływ mieszkańców.
- [ ] Pełna zgodność z poniższymi sekcjami — prace etapowe, nieukończone.

## 1. Architektura i warunki rozgrywki
- [ ] Izometryczna siatka logiczna i cztery obroty mapy.
- [ ] Wysokości terenu, klify, woda i fosy jako elementy fizyczne.
- [x] Czas rzeczywisty, regulacja 20–90, pauza i miesięczny tick.
- [ ] Pauza blokuje wszystkie rozkazy (ruch, budowę, rekrutację, handel), pozostawiając nawigację i inspekcję.
- [ ] Lord gracza/AI, samoobrona, śmierć Lorda, natychmiastowy warunek porażki i usunięcie jego domeny.
- [ ] Fizyczne magazynowanie zasobów, pojemność pól, modułowa rozbudowa i blokowanie dostaw.
- [ ] Złoto jako globalny zasób bez pojemności.

## 2. Interfejs HUD
- [ ] 6 kategorii budowania i komplet katalogu budowli.
- [ ] Kontekstowy panel budowy, budynku i grup jednostek.
- [ ] Skryba, księga raportów, popularność, złoto, populacja i mimika.
- [ ] Raport miesięczny „W nadchodzącym miesiącu”, wykresy ekonomii i stan armii.
- [ ] Undo, burzenie ze zwrotem 50%, ranking, dyplomacja, opcje zapisu/wczytania.
- [ ] Minimapa z zasobami, wojskami i ramką kamery.

## 3. Sterowanie
- [ ] Klasyczne jednoprzyciskowe LPM: zaznaczanie i rozkazy kontekstowe.
- [x] Klik, dwuklik, box select, Shift-add i Ctrl-toggle.
- [ ] LPM na portretach zawęża grupę, PPM usuwa typ z grupy.
- [ ] PPM-gesture: radialne menu kamery, obrót, flatten, zoom, HUD.
- [ ] Minimapa, edge-scroll, flatten, V, X/C, Z i zakładki kamery.
- [x] Grupy kontrolne i podstawowe rozkazy ruchu/ataku/stop/obrona.
- [ ] Pełne rozkazy: patrol, punkt zbiórki, wejście na mur, machiny, kopanie fosy, ostrzał punktu.
- [ ] Skróty do budynków, powrót Shift, Alt+0–9 i Ctrl+Alt+0–9.
- [ ] Szybkie rekrutowanie/handel paczkami.

## 4. Populacja i popularność
- [x] Stan populacji, bazowe 8 miejsc, bezrobotni i limit ogniska 24.
- [x] Miesięczne racje 0/0.5/1/1.5/2, zużycie i różnorodność.
- [x] Tabela podatków/łapówek i przychód/koszt per mieszkaniec.
- [x] Podstawowy model piwa, religii i współczynnika strachu.
- [ ] Fizyczne ognisko z paskiem postępu, automatyczne obsadzanie budynków i zwalnianie pracowników.
- [ ] Rekrutacja zużywa chłopa; żołnierze wyłączeni z limitu chat i konsumpcji.
- [ ] Dokładne pokrycie gospód, stałe zużycie beczek i rzeczywiste błogosławieństwa księży.
- [ ] Dobre/Złe Rzeczy liczone z populacji i znoszące się parami.

## 5. Teren, logistyka i produkcja
- [ ] Typy terenu: oaza, złoża kamienia, żelaza, smoła, las, pustynia.
- [ ] Walidacja lokalizacji budowli i ograniczenia terenowe.
- [ ] Piesze trasy pracowników, magazyny docelowe i czas produkcji zależny od dystansu.
- [ ] Wszystkie łańcuchy: drewno, kamień+woły, żelazo, smoła, żywność, piwo, broń i pancerze.
- [ ] Zależności surowców wejściowych, pracownicy, transport i blokada przy pełnym magazynie.
- [ ] Targowisko: ręczny handel, stałe ceny, spread i pojemność magazynu.

## 6. Fortyfikacje, pożary i choroby
- [ ] Szczelność murów, wież, bram i przeszkód naturalnych na siatce.
- [ ] Automatyczne bramy, ręczne blokowanie i przejmowanie bramy.
- [ ] Wysokość, bonusy zasięgu/ochrony, balisty i mangonele z załogą.
- [ ] Plan fosy, kopanie przez wybrane jednostki i zasypywanie przez wroga.
- [ ] Doły smołowe, podpalenia, rozprzestrzenianie ognia i gaszenie.
- [ ] Wrzący olej i obrażenia obszarowe.
- [ ] Zaraza, chmury obszarowe i leczenie przez aptekę.

## 7. Wojsko i walka
- [ ] Wszystkie jednostki europejskie, arabskie i specjalistyczne oraz ich wymagania sprzętowe/złota.
- [ ] Brak regeneracji HP, w tym Lorda.
- [ ] Namiot oblężniczy, inżynierowie i sześć typów machin.
- [ ] Trzy postawy (Stand Ground, Defensive, Aggressive) z odmienną logiką.
- [ ] Stop, patrol, ostrzał punktu, rozformowanie.
- [ ] Stacking bez twardej kolizji.
- [ ] Friendly fire: strzały sojusznicze bez obrażeń, ale ogień/olej/głazy/zaraza ranią wszystkich.

## 8. Pętla symulacji i AI
- [ ] FSM chłopów: pobierz → przetransportuj → przetwórz → odnieś → przerwa.
- [ ] Czekanie przy budynku przy braku surowca lub miejsca w magazynie.
- [ ] Lordowie AI z planami zamków, pełną ekonomią i prawdziwymi kosztami.
- [ ] Harass, progi oblężenia i konstruowanie machin.
- [ ] Alerty tekstowe i głosowe, komunikaty o ekonomii/ataku/pożarze.
- [x] Miesięczny tick dla podstawowego bilansu ekonomicznego i popularności.

## Dziennik etapów
### Etap 1 — zegar i miesięczny bilans (2026-11-27)
- Dodano `src/engine/simulation.ts` z deterministycznym stanem symulacji, prędkością 20–90, miesięcznym tickiem i rozliczeniem racji, różnorodności, podatków, piwa, religii i strachu.
- Dodano liczniki miesiąca, populacji i popularności oraz kontrolę prędkości.
- Pauza blokuje budowę i podstawowe rozkazy jednostek; zaznaczanie i inspekcja pozostają dostępne.
- Uwaga: ten etap nie implementuje jeszcze pracowników, rzeczywistego magazynowania, budynków produkcyjnych ani rekrutacji. Wartości religii/piwa/strachu są na razie stanem symulacji, bez pełnych obiektów świata.
- Weryfikacja: `npm run verify` — TypeScript PASS, Vite build PASS.
