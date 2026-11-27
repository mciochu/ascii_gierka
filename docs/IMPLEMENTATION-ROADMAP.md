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
**Status: wdrożony w zakresie HUD i klasycznego sterowania.** Dostępne są obecne systemy prototypu; pozycje wymagające przyszłej ekonomii, fortyfikacji lub Lordów AI pozostają jawnie nieaktywne.

### Etap 3 — mieszkańcy, populacja i popularność
Zakres: sekcja 4 specyfikacji.
- Ognisko, limit 24 bezrobotnych, tempo przyrostu zależne od popularności i odejścia mieszkańców.
- Chłopi obsadzają nieobsadzone budynki; rekrutacja zużywa chłopa, żołnierze nie zużywają żywności ani miejsc w chatach.
- Pełny bilans racji i różnorodności, podatków/łapówek, piwa, religii i Fear Factor.
- Rzeczywiste obiekty Dobrych i Złych Rzeczy, księża i wygasające błogosławieństwa.
- Raport popularności „W nadchodzącym miesiącu” z rozbiciem wszystkich modyfikatorów.
**Status: wdrożony w zakresie mieszkańców, zatrudniania i podstawowego bilansu popularności.** Dostawy beczek piwa oraz pełna wydajność łańcuchów produkcji pozostają zależne od etapu 4, a właściwy interfejs rekrutacji i pełne koszty oddziałów od etapu 5.

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


### Etap 2 — HUD i klasyczne sterowanie (2026-11-27)

**Interfejs i katalog**
- index.html oraz src/style.css: stały dolny HUD, który można ukryć klawiszem Tab lub gestem kamery. Układ ma sześć tarcz kategorii, środkowy panel kontekstowy oraz prawy panel Skryby, narzędzi i minimapy. Topbar zachowuje zasoby, miesiąc, popularność, prędkość i pauzę.
- src/ui/catalog.ts: katalog sześciu kategorii i 52 pozycji zgodnych z listą w specyfikacji. Jedyną pozycją aktywnej budowy jest istniejąca w prototypie Wieża strażnicza (70 drewna, 30 kamienia). Reszta jest widoczna, ale nieaktywna, dopóki nie powstaną jej mechaniki w etapach 4–5.
- Panel kontekstowy pokazuje katalog, szczegóły zaznaczonego obiektu albo grupy jednostek. Jednostki są grupowane według typu, mają liczebność oraz trzy przyciski postaw: Utrzymać pozycję, Obronna, Agresywna. Dostępne są rozkazy Stop i Atak w ruchu.
- Skryba prezentuje na żywo popularność (kolor i mimika), złoto oraz populację. Księga raportów pokazuje bieżącą prognozę bilansu popularności z rozbiciem modyfikatorów oraz armię pogrupowaną według typów.
- Minimapę renderują wyłącznie znaki Unicode: uproszczone rodzaje terenu, budowle, oddziały własne i wrogie oraz ramka aktualnego widoku. Kliknięcie i przeciągnięcie przesuwa kamerę.
- Przyciski Undo i burzenia działają dla wież wzniesionych w tej rozgrywce: cofnięcie zwraca 100% znanych kosztów, burzenie 50%. Startowe budynki nie są niszczone, ponieważ ich koszt nie jest zapisany w modelu. Ranking pokazuje dane gracza i aktualnego oddziału rozbójników; dyplomacja wyjaśnia brak sojuszników AI w obecnym prototypie.
- Opcje udostępniają zmianę prędkości, widok/ukrywanie HUD, ustawienie racji i podatków/łapówek oraz zapis i wczytanie stanu w localStorage przeglądarki (klucz dominium.save.v1, wersja formatu 1). Zapis obejmuje symulację, obiekty, rozkazy i postawy oddziałów, wieże, zaznaczenie, grupy kontrolne, historię Undo, ustawienia widoku i zakładki kamery. Wczytywanie waliduje strukturę oraz zakresy danych przed odtworzeniem świata.
- Raporty rankingowe i dyplomatyczne nie udają jeszcze pełnej ekonomii lub Lordów AI. Wykresy ekonomiczne nie zostały dodane, bo właściwe magazyny i łańcuchy danych powstaną w etapie 4.

**Sterowanie**
- LPM wybiera obiekt, zaznacza prostokątem, wydaje rozkaz ruchu/ataku, stawia wieżę lub burzy ją — zależnie od kontekstu. Dwuklik własnej jednostki wybiera widoczne jednostki tego samego typu. Shift+LPM kolejkuje punkt trasy.
- PPM na mapie anuluje aktywny tryb lub czyści zaznaczenie; przytrzymanie i przeciągnięcie otwiera 4-kierunkowe menu kamery: góra — obrót, dół — spłaszczenie, prawo — zoom, lewo — HUD.
- PPM na portrecie typu jednostki usuwa ten typ z zaznaczenia. Środkowy przycisk przeciąga kamerę.
- Strzałki oraz krawędzie mapy przewijają kamerę; Spacja przełącza spłaszczenie, V tymczasowo je włącza, X/C obracają, Z przełącza zoom, P pauzuje, +/- reguluje prędkość.
- Ctrl+Alt+0–9 zapisuje zakładkę kamery, Alt+0–9 ją przywraca; Ctrl+0–9 przypisuje grupę wojska, sam klawisz wybiera grupę. H/G/M/B/N/I/S skaczą do istniejących lub przewidzianych punktów kluczowych, a Shift+klawisz wraca do poprzedniego widoku.
- Trzy postawy mają działające zachowanie prototypowe: „Utrzymać pozycję” atakuje wyłącznie cel w zasięgu i nie podchodzi; „Obronna” ściga pobliskie zagrożenie i wraca do punktu startu; „Agresywna” ściga wykrytego przeciwnika niezależnie od dystansu. Wszystkie ścieżki ruchu korzystają z nawigacji siatkowej z etapu 1.

**Wynik audytu i testów**
- Poprawiono anulowanie `pointercancel` (nie może kończyć się kliknięciem/rozkazem), blokadę skrótów mapy podczas otwartego dialogu, zachowanie punktu widoku podczas ukrywania/pokazywania HUD-u i zmiany rozmiaru, liczebność portretów typów oraz komunikat budowania w pauzie.
- 35/35 testów automatycznych PASS (w tym testy katalogu, siatki, ekonomii oraz regresje interfejsu i sterowania).
- TypeScript PASS.
- Vite production build PASS.
- git diff --check PASS przed zatwierdzeniem.
- Ręczny test wizualny/przeglądarkowy nie został wykonany na VPS: środowisko headless Chromium wcześniej nie startowało z powodu braku biblioteki systemowej libatk-1.0.so.0. Nie zmieniano bibliotek systemowych serwera.

**Granice etapu 2 — świadomie pozostawione na później**
- Pełne mechaniki 51 pozostałych pozycji katalogu: m.in. magazyny/produkcja/handel z etapu 4 oraz fortyfikacje, fosy i pozostałe budynki wojskowe z etapu 5.
- Panele sterowania pracą każdego budynku, zakup/sprzedaż na targu i pełne ekrany ekonomii wymagają danych i mechanik etapów 4–5.
- Prawdziwy ranking Lordów, rozkazy sojuszniczym botom i transfery zasobów wymagają systemu Lordów i AI z etapów 5–6.
- Patrol, ostrzał punktu, rekrutacja i pełen zestaw rozkazów specjalnych zostają do etapu 5.
- Zapis jest lokalny dla przeglądarki/originu; nie jest synchronizowany między urządzeniami.

### Etap 3 — mieszkańcy, populacja i popularność (2026-11-27)

**Mieszkańcy i ognisko**
- `src/engine/simulation.ts`: symulacja ma osobne obiekty chłopów z pozycją, statusem, rolą, przypisaniem do miejsca pracy, trasą ruchu i czasem błogosławieństwa.
- Na starcie jest 8 chłopów; trzy osoby automatycznie obsadzają istniejący młyn, a pozostałe pięć pozostaje przy ognisku. Pracownicy i kapłani są widoczni na mapie jako znaki Unicode i poruszają się po siatce z etapu 1.
- Ognisko ma zielony/czerwony pierścień i wskaźnik postępu. Przyrost jest ciągły: `popularność / 100` jednostki postępu na miesiąc gry; przy 100 popularności jeden chłop przybywa w miesiącu, przy 50 — w dwóch. To jawny, regulowany parametr tempa, ponieważ specyfikacja nie podaje dokładnej liczby sekund.
- Nowy mieszkaniec pojawia się wyłącznie przy popularności co najmniej 50, wolnym miejscu mieszkalnym i mniej niż 24 bezrobotnych. Jest automatycznie wysyłany do pierwszego nieobsadzonego miejsca pracy.
- Spadek popularności poniżej 50 zatrzymuje przyrost i uruchamia odchodzenie mieszkańców. Najpierw zwalniane są stanowiska produkcyjne; mieszkaniec przestaje zajmować miejsce pracy od razu, ale znika z populacji po opuszczeniu mapy.
- `recruitFromCampfire` zużywa jednego bezrobotnego chłopa. Żołnierze pozostają poza liczbą mieszkańców, limitami chat i konsumpcją żywności. Pełny ekran rekrutacji, ceny jednostek oraz sprzęt koszar należą do etapu 5.

**Budynki, religia i strach**
- Chata jest budowalna za 6 drewna i dodaje `+8` miejsc.
- Kaplica, kościół i katedra tworzą obsadzone miejsca pracy dla kapłanów. Kapłani poruszają się po zamku i błogosławią mieszkańców; każde błogosławieństwo wygasa po 90 sekundach gry (parametr do strojenia). Pierwszy kościół daje `+1`, pierwsza katedra `+2`; kolejne tego samego typu nie kumulują bonusu.
- Gospoda kosztuje 20 drewna i 100 złota oraz zatrudnia jednego karczmarza. Obsługuje maksymalnie 30 mieszkańców. Premia i zużycie 0,144 beczki miesięcznie działają dopiero, gdy beczki piwa są fizycznie dostępne; dostawy ze Składu są etapem 4.
- Dodano podstawowe obiekty Dobrych Rzeczy (ogród, 20 złota) i Złych Rzeczy (szubienica, 40 złota). Liczą się do różnicy obiektów, niezależnie od położenia. Koszty używają dolnej granicy przedziałów podanych dla tych kategorii w instrukcji HD.
- Strach jest wyliczany z różnicy liczby dobrych i złych obiektów w proporcji około jeden obiekt na 15 mieszkańców na poziom, z ograniczeniem `−5…+5`. Dodatni strach podnosi obrażenia własnego wojska o 5% na poziom i ogranicza wydajność pracy o 10% na poziom; ujemny zmniejsza obrażenia o 5% i podnosi wydajność pracy o 10% na poziom. Mnożnik obrażeń jest podłączony do aktualnej walki; mnożnik pracy jest raportowany i czeka na integrację z produkcją w etapie 4.

**Raporty, zapis i interfejs**
- Księga raportów pokazuje prognozę „W nadchodzącym miesiącu”, osobno racje, różnorodność, podatki/łapówki, piwo, religię, błogosławieństwa i strach oraz stan bezrobotnych, pracy, kapłanów i obiektów strachu.
- Liczniki mieszkańców i bezrobotnych są odświeżane w górnym pasku i panelu Skryby; minimapa pokazuje także cywilów.
- Zapis lokalny obejmuje mieszkańców, pozycje i trasy, miejsca pracy, błogosławieństwa, obiekty strachu, licznik nowych budynków, cofanie i zwroty kosztów. Starszy zapis z etapu 2 jest migrowany do domyślnego modelu mieszkańców.

**Wynik testów**
- 50/50 testów automatycznych PASS, w tym testy tempa przyrostu, limitu 24, zatrudniania, rekrutacyjnego zużycia chłopa, odejścia pracownika, synchronizacji populacji po opuszczeniu mapy, religii, błogosławieństw, strachu, tras ognisko–młyn i regresji etapów 1–2.
- TypeScript PASS.
- Vite production build PASS.
- `git diff --check` PASS.
- Ręczny test wizualny w przeglądarce nie został wykonany na VPS; Chromium nadal nie uruchamia się bez systemowej biblioteki `libatk-1.0.so.0`.

**Audyt poprawkowy po wdrożeniu (2026-11-27)**
- Znaleziono i naprawiono nieaktualizowanie liczników populacji po usunięciu mieszkańca, który już dotarł do krawędzi mapy. Liczniki są teraz synchronizowane bezpośrednio po czyszczeniu listy mieszkańców, przed sprawdzeniem limitów mieszkań i ogniska.
- Naprawiono ścieżkę błędu dojścia do miejsca pracy: pracownik, dla którego nie da się wyznaczyć trasy, jest usuwany z listy obsady budynku i wraca do statusu bezrobotnego. Nie blokuje już miejsca pracy jako „duchowy” pracownik.
- Dodano test regresyjny dla natychmiastowego opuszczenia mapy; pełny zestaw ma 50/50 PASS.
- TypeScript, build i `git diff --check` PASS. Nadal nie wykonano ręcznego testu wizualnego w przeglądarce z powodu braku `libatk-1.0.so.0` w środowisku VPS.

**Granice etapu 3 — świadomie pozostawione na później**
- Dostawa, składowanie i fizyczne zużywanie beczek piwa wymagają Składu i logistyki z etapu 4. Gospoda jest budowalna i zatrudnia karczmarza, ale sama nie tworzy beczek.
- Mnożnik wydajności pracy jest udostępniony i raportowany; jego wpływ na ilość przetwarzanych towarów zostanie włączony wraz z łańcuchami produkcji w etapie 4.
- `recruitFromCampfire` realizuje zużycie bezrobotnego, natomiast pełny panel rekrutacji, typy jednostek, ceny i pobieranie uzbrojenia należą do etapu 5.
- Rzeczywista liczebność mieszkańców jest rozdzielona od żołnierzy; żołnierze nie płacą podatków i nie zużywają racji.

[executed on device: vps-d5543227 (f98401a2-4f25-449c-a7ff-f53738afd282)]