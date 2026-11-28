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

### Etap 2 — HUD i klasyczne sterowanie (częściowa implementacja)
Zakres: sekcje 2 i 3 specyfikacji.
- Dolny HUD z sześcioma tarczami kategorii budowania oraz pełnym katalogiem budynków.
- Środkowy panel kontekstowy dla katalogu, zaznaczonych budynków i grup jednostek; dla istniejących miejsc pracy jest kontrola wstrzymania/wznowienia oraz zwolnienia pracowników do ogniska.
- Skryba, księga raportów, minimapa, ranking, dyplomacja, opcje, Undo i burzenie.
- Klasyczny schemat LPM: wybór i wydawanie rozkazów zależnie od kontekstu.
- Portrety typów jednostek, rozkazy specjalne, menu gestów kamery, minimapa i zakładki kamery.
- Skróty opisane w dokumencie, edge-scroll, flatten, zoom oraz pełne zachowanie pauzy.
**Status: częściowo wdrożony.** Gotowe są układ HUD, sześć kategorii i katalog 52 pozycji, panel kontekstowy prototypu, podstawowe sterowanie LPM/PPM, minimapa, kamera, zapis oraz postawy jednostek. Pełna zgodność z sekcjami 2–3 nie jest jeszcze osiągnięta: raport/ranking i dyplomacja są uproszczone, część skrótów nie ma jeszcze obiektu docelowego, a panele ekonomiczne i produkcyjne czekają na etapy 4–6.

### Etap 3 — mieszkańcy, populacja i popularność
Zakres: sekcja 4 specyfikacji.
- Ognisko, limit 24 bezrobotnych, tempo przyrostu zależne od popularności i odejścia mieszkańców.
- Chłopi obsadzają nieobsadzone budynki; rekrutacja zużywa chłopa, żołnierze nie zużywają żywności ani miejsc w chatach.
- Pełny bilans racji i różnorodności, podatków/łapówek, piwa, religii i Fear Factor.
- Rzeczywiste obiekty Dobrych i Złych Rzeczy, księża i wygasające błogosławieństwa.
- Raport popularności „W nadchodzącym miesiącu” z rozbiciem wszystkich modyfikatorów.
**Status: wdrożony w zakresie populacji, zatrudniania, obsługi miejsc pracy i podstawowego bilansu popularności.** Fizyczne dostawy piwa i integrację wydajności produkcji wykonuje etap 4; pełny interfejs rekrutacji, ceny i pobieranie uzbrojenia należą do etapu 5.

### Etap 4 — magazyny, logistyka i łańcuchy produkcyjne
Zakres: sekcja 5 specyfikacji oraz fizyczne zasoby z sekcji 1.
- Fizyczny Skład, Spichlerz i Zbrojownia z odrębnymi polami i limitami pojemności. Złoto pozostaje zasobem globalnym; HUD pokazuje sumę towaru przechowywanego fizycznie.
- Pracownicy realizują kursy po siatce: dojście do magazynu, pobranie surowca, powrót do budynku, przetworzenie, zabranie produktu i dostawa do właściwego magazynu. Towar nie zwiększa stanu zapasów, dopóki kurier faktycznie nie dotrze.
- Pełny magazyn wstrzymuje rozładunek/produkcję; pracownik czeka z ładunkiem. Budynki i moduły nie mogą być zburzone, gdy zawierają towary lub istnieje aktywny transport do/z nich.
- Magazyny można rozbudować dostawianym obok modułem (+25 pól). Zmniejszenie pojemności jest blokowane, gdy towary zajęłyby pola usuwanego modułu.
- Zasoby źródłowe są sprawdzane przy stawianiu budynków: las, złoże kamienia, złoże żelaza, bagno smołowe, oaza oraz oznaczone punkty jeleni. Farma jest dostępna wyłącznie na oazie, a kopalnie/warsztat smoły na właściwym złożu.
- Zaimplementowano produkcję drewna, kamienia (z obowiązkowym wołem wożącym partie po 8), żelaza, smoły, jabłek, mięsa, sera i bydła, pszenicy, mąki, chleba, chmielu, piwa oraz uzbrojenia i pancerzy.
- Łańcuchy przetwarzania używają fizycznych wejść/wyjść: pszenica → mąka → chleb (1 mąka = 8 chlebów); chmiel → piwo → gospoda; bydło z farmy mlecznej → garbarz. Panel warsztatu umożliwia wybór łuku/kuszy, włóczni/piki i buzdyganu/miecza.
- Targowisko oferuje wyłącznie handel ręczny, stałe ceny zakupu/sprzedaży i partie 1/5 sztuk. Zakup jest blokowany, jeśli właściwy magazyn nie ma wolnych pól; nieudana sprzedaż nie usuwa częściowego towaru.
- Zapis obejmuje magazyny, zawartość, moduły, cykle produkcji, kolejki dostaw i ładunki pracowników. Stare zapisy z etapów 2–3 są migrowane z dawnych liczników zasobów do magazynów.
**Status: implementacja i testy ukończone; wdrożenie następuje w bieżącym wydaniu po synchronizacji z `main`.**

**Parametry strojenia — nie są wartościami narzuconymi przez specyfikację**
- Pojemność startowa: 100 pól na magazyn; moduł: +25 pól.
- Rozmiary stosów, koszty budowli/modułów, ceny większości towarów i długości cykli produkcji są ustawieniami bazowymi prototypu. Specyfikacja definiuje przepływy, pracowników i przykład spreadu handlu, ale nie podaje pełnych wartości liczbowych.
- Ceny żywności na rynku przyjęto zgodnie z przykładem w specyfikacji (kupno 8, sprzedaż 4); pozostałe towary mają stałe ceny konfigurowalne w `src/engine/logistics.ts`.
- Punkty jeleni są na razie oznaczonymi, stałymi punktami mapy, a źródła lasu/oazy/złóż nie są jeszcze wyczerpywane po określonej liczbie cykli — specyfikacja nie definiuje ilości ani tempa odnowy tych zasobów.
- Stary zapis miał wyłącznie łączną liczbę żywności, bez podziału na typy. Migrator zachowuje ilość, przydzielając historyczny zapas do jabłek; dokładnej dawnej różnorodności nie da się odtworzyć z tego formatu.


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
- Minimapę renderują wyłącznie znaki Unicode: uproszczone rodzaje terenu (w tym pola złóż), budowle, oddziały własne i wrogie, mieszkańcy oraz ramka aktualnego widoku. Kliknięcie i przeciągnięcie przesuwa kamerę.
- Przyciski Undo i burzenia działają dla budynków wzniesionych w tej rozgrywce i mających zapisany koszt: cofnięcie zwraca 100%, burzenie 50%. Startowe budynki pozostają chronione, ponieważ ich koszt nie jest zapisany. Ranking pokazuje dane gracza i aktualnego oddziału rozbójników, a nie pełny ranking Lordów; dyplomacja jest ekranem informacyjnym bez sojuszników AI.
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
- Katalog ma 52 pozycje; aktywne mechaniki etapu 4 obejmują magazyny, przemysł, rolnictwo, produkcję broni/żywności i targowisko. Nadal nieaktywne są m.in. fortyfikacje, fosy i pozostałe budynki wojskowe z etapu 5.
- Przełącznik pracy jest dostępny dla obecnych budynków z miejscem pracy; magazyny, panele produkcji i ręczny handel są dostarczone w etapie 4. Pełne wykresy ekonomii oraz pozostałe sterowanie zależne od fortyfikacji/armii pozostają do integracji w etapach 5–6.
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

**Audyt porównawczy etapów 1–3 (2026-11-27)**

- Etap 1: ponownie zweryfikowano wszystkie 10 000 środków pól, mapowanie komórka↔świat, spójność sieci pól przechodnich, zakaz ścinania narożników, teren i konwersję kamery w czterech obrotach. Nie znaleziono nowego błędu siatki. Kompas otrzymał kierunkową strzałkę, która obraca się wraz z mapą. Fosy, mury, Lord i fizyczne magazyny pozostają poza zakresem ukończonego fundamentu.
- Etap 2: podwójne kliknięcie filtrowało oddziały według osiowego prostokąta świata, co po obrocie mogło włączać jednostki niewidoczne na ekranie. Teraz sprawdza rzeczywiste współrzędne ekranowe w aktualnym obrocie. Usunięto błędną sugestię, że `X` burzy budynek (X obraca mapę). Tryb budowy pokazuje zielony/czerwony podgląd pola dla obecnych aktywnych budowli, z walidacją terenu, kosztu i odstępu. Panel istniejącego budynku z miejscem pracy udostępnia przełącznik pracy; kontrolki pozostają zablokowane podczas pauzy. Skróty M/N/I/S nie mają jeszcze obiektów docelowych i nie są przedstawiane jako działające.
- Etap 3: wstrzymanie miejsca pracy zwalnia pracowników, którzy fizycznie wracają do ogniska; po dotarciu mogą zostać przydzieleni do pierwszego aktywnego wolnego stanowiska. Wznowienie obsadza wolne miejsca, a zburzenie budynku także zwalnia personel. Stan `enabled` budynku i status powrotu są częścią zapisu.
- Dodano testy regresyjne dla widoczności po obrocie, wstrzymywania/wznawiania miejsc pracy, zwalniania pracowników, podglądu budowania i interfejsu kompasu. Łącznie 57/57 testów, TypeScript, build i `git diff --check` PASS.
- Ręczna weryfikacja obrazu strony w przeglądarce nadal nie jest wykonana z powodu braku `libatk-1.0.so.0` w środowisku VPS; test HTTP nie jest przedstawiany jako test wizualny.

**Granice etapu 3 — świadomie pozostawione na później**
- Dostawa, składowanie i fizyczne zużywanie beczek piwa wymagają Składu i logistyki z etapu 4. Gospoda jest budowalna i zatrudnia karczmarza, ale sama nie tworzy beczek.
- Mnożnik wydajności pracy jest udostępniony i raportowany; jego wpływ na ilość przetwarzanych towarów zostanie włączony wraz z łańcuchami produkcji w etapie 4.
- `recruitFromCampfire` realizuje zużycie bezrobotnego, natomiast pełny panel rekrutacji, typy jednostek, ceny i pobieranie uzbrojenia należą do etapu 5.
- Rzeczywista liczebność mieszkańców jest rozdzielona od żołnierzy; żołnierze nie płacą podatków i nie zużywają racji.

## Warstwa renderowania Effulgence — faza 1 (2026-11-27)

**Wdrożona baza renderera GPU**
- `src/engine/effulgence.ts` dodaje osobny moduł renderowania oparty na filtrach WebGL2 PixiJS. Końcowa scena mapy przechodzi przez filtr kompozycji glifowej i filtr końcowy; HTML-owy HUD pozostaje poza tym potokiem, więc jego tekst nie jest pikselizowany ani objęty bloomem.
- Atlas ma 64 sloty: 16 poziomów rampy luminancji, 8 znaków krawędzi i 40 znaków specjalnych. Atlas jest tworzony raz przy uruchomieniu z monochromatycznego fontu monospace; nie dodano zewnętrznych bitmap, sprite'ów ani tekstur krajobrazu.
- Shader wyznacza komórkę z rozmiaru 8×12 px (domyślnie), uwzględnia fazę kamery, próbkuje luminancję, wybiera poziom rampy i glif, oblicza gradient Sobela luminancji oraz stosuje dithering Bayera 4×4. Dla kolorystycznie wykrytych obszarów wody, ognia i zieleni opcjonalnie zmienia gęstość znaku z częstotliwością 8 Hz.
- Końcowy shader stosuje wielopromieniową aproksymację poświaty jasnych glifów, krzywą ACES Filmic oraz przyciemnienie narożników o 12%. Siatka subpikselowa pozostaje wyłączona.
- Opcje obrazu są dostępne w oknie Opcje: gęstość 6×9 / 8×12 / 10×15, bloom 0–150% (domyślnie 85%), jasność terenu 50–150% (100%) i migotanie 8 Hz. Ustawienia są zapisywane osobno w `localStorage` i nie modyfikują formatu zapisu rozgrywki.
- HUD został ułożony w czterech blokach o docelowych proporcjach 14/46/22/18; minimapa jest osobnym czwartym blokiem. Stylistyka kontrolek przeszła na czarną bazę, chłodny cyjan, ostre ramki i brak gradientów dekoracyjnych w kontrolkach.

**Granice tej fazy — nie oznaczać jako ukończone**
- To nie jest jeszcze pełny ośmioprzebiegowy G-Buffer. Nie ma oddzielnych tekstur Albedo, NormalHeight, Emissive i EntityID; aktualny Sobel analizuje luminancję, a nie osobne bufory głębi, normalnych i identyfikatorów obiektów.
- Oświetlenie kierunkowe i maksymalnie 64 światła punktowe z cullingiem, fizyczne wysokości i cienie materiałów, komplet ośmiu palet frakcji oraz dedykowane maski animowanych materiałów pozostają do implementacji.
- Poświata w tej fazie jest filtrem wielopromieniowym, a nie pełnym Dual-Kawase z osobnymi poziomami downsample/upsample. Wyjściowa ścieżka nie jest jeszcze rzeczywistym wieloburowym HDR RGBA16F.
- Jednostki i VFX nadal korzystają z dotychczasowych obiektów tekstowych PixiJS. Nie ma jeszcze osobnego hero/VFX passu, GPU instancingu klastrów, Hit-Flash 65 ms, rozpadu śmierci, pełnych świateł dynamicznych ani testu obciążeniowego 100 łuczników / 50 niewolników / 30 pól smoły / 3 machin.
- Aktualny dobór migotania bazuje na heurystyce koloru, nie na flagach materiału. Faza kamery uwzględnia translację kontenera; pełna walidacja sub-cell lock przy zoomie, obrotach i wszystkich rozdzielczościach wymaga testu wizualnego.
- Cel 60 FPS na zintegrowanym GPU nie został jeszcze zmierzony. Testy automatyczne nie zastępują pomiarów GPU ani ręcznej oceny migotania i czytelności sceny.
- Przeglądarkowy test wizualny nie został wykonany na VPS, ponieważ środowisko headless Chromium nadal nie uruchamia się bez `libatk-1.0.so.0`. Nie zmieniano bibliotek systemowych serwera.

**Wynik weryfikacji fazy 1**
- Testy jednostkowe atlasu, 16 progów luminancji, mapowania kątów krawędzi, wielkości komórek i walidacji opcji renderera.
- Testy struktury czterech bloków HUD i kontrolek ustawień Effulgence.
- Pełny zestaw regresyjny etapów 1–4, TypeScript, build Vite oraz `git diff --check`.


## Warstwa renderowania Effulgence — faza 2 (2026-11-27)

**Migracja sceny z PixiJS Text do wspólnego atlasu glifów**
- `src/engine/glyph.ts` nie tworzy już osobnego obiektu `PixiJS Text` dla każdej litery. Glify są rasteryzowane tylko raz na kombinację znaku i grubości fontu do wspólnego atlasu 16×32 (512 komórek).
- Widoczne znaki są teraz sprite'ami/quadami korzystającymi z jednego `TextureSource`, więc PixiJS może łączyć je w partie renderowania. Nie są używane ilustracje, bitmapy terenu ani gotowe sprite sheety — atlas zawiera wyłącznie litery i znaki typograficzne.
- Obiekt `GlyphDisplay` zachowuje API niezbędne aktualnej grze: pozycję, obrót, alpha, zmianę tekstu i zmianę koloru w panelu podglądu budowania. Obsługiwany jest także obrys glyphów przez dodatkowe quady.
- Nowe znaki są dopisywane do atlasu na żądanie; aktualizacja tekstury jest grupowana do pojedynczego odświeżenia przed renderowaniem klatki.
- Zmiana obejmuje teren, szczegóły, budynki, jednostki, cywilów, oznaczenia selekcji, podgląd budowania i etykiety liczbowe. Typy znaczników zostały zmienione z `Text` na `GlyphDisplay`.
- Zachowana jest jedna wspólna mapa atlasu z obsługą znaków Unicode i polskich znaków diakrytycznych. Pojemność wynosi 512 odrębnych kombinacji znak/grubość; przekroczenie limitu korzysta z glifu zastępczego zamiast wywołać niekontrolowany wzrost tekstury.

**Granice tej fazy — nadal nie oznaczać jako ukończone**
- To jest migracja do atlasowych quadów i batchingu PixiJS, ale nie jest jeszcze własnym GPU instancingiem Passu 4. Każdy glif ma nadal obiekt Sprite w drzewie sceny; wymagane bufory instancji jednostek i cząsteczek nie zostały jeszcze dodane.
- Nie powstały jeszcze osobne tekstury Passu 0 (`RT_Albedo`, `RT_NormalHeight`, `RT_Emissive`, `RT_EntityID`) ani właściwy Pass 1 ze światłem kierunkowym, gradientem wysokości, 64 światłami punktowymi i paletami frakcji.
- Dotychczasowy filtr obrazu i przybliżony bloom pozostają na miejscu. Pełny ośmioprzebiegowy Render Graph, Dual-Kawase, HDR RGBA16F, materiały i maski animacji są nadal do wykonania.
- Wymagania dotyczące budynków, machin, pełnego rosteru jednostek, pocisków, VFX, minimapy 32×16/40×20, raportów, dyplomacji, alertów i kompletnej macierzy kursorów nadal nie są spełnione.

**Weryfikacja fazy 2**
- Testy obejmują pojemność atlasu, dzielenie znaków Unicode/emoji i skalowanie odstępów glifów.
- TypeScript, komplet testów i produkcyjny build Vite muszą przejść przed publikacją.
- Test wizualny w przeglądarce VPS nadal jest ograniczony brakiem `libatk-1.0.so.0`; wynik HTTP nie jest uznawany za test wyglądu ani płynności.


## Rewizja architektury Effulgence — faza 3 (2026-11-28)

**Status i ważna korekta dokumentacji**

Ta faza zastępuje wcześniejszy tymczasowy renderer filtrów oraz wcześniejszy etap atlasowych sprite'ów. Opisy faz 1–2 powyżej zachowują historię zmian, ale nie opisują już aktualnej architektury. W aktualnej wersji nie ma osobnego `PixiJS Text` ani `Sprite` dla każdego glifu mapy.

**Wdrożone elementy z docelowej specyfikacji**

- `src/engine/glyph.ts` przechowuje wyłącznie rekordy glifów i transformacje. Nie tworzy tekstów, sprite'ów ani tekstur na pojedynczy znak.
- `src/engine/glyph-batch.ts` rasteruje monochromatyczny atlas `16×32` o komórkach `48×64`, z 64 stałymi slotami specyfikacji. Dane glifów są pakowane do buforów instancji i wysyłane do GPU partiami per warstwa. Dodatkowe znaki Unicode i warianty pogrubione zajmują pozostałą pojemność atlasu; przepełnienie używa glifu zastępczego.
- Pass 0 renderuje scenę do czterech osobnych załączników MRT: `RGBA8` Albedo, `RGBA16F` NormalHeight, `RGBA16F` Emissive oraz `RGBA8UI` EntityID.
- Pass 1 odczytuje G-Buffer, stosuje ciemne niebieskie światło otoczenia, kierunkowy wektor światła, cieniowanie wysokości i bufor do 64 świateł punktowych z cullingiem oraz łączeniem bliskich źródeł. Na tę chwilę z gry dostarczane jest rzeczywiste źródło światła ogniska; pozostałe źródła z tabeli specyfikacji nie są jeszcze podłączone.
- Pass 2 wykonuje próbkowanie komórek i detekcję krawędzi z kanałów wysokości, normalnych i ID obiektu. Wykrywanie animacji korzysta z flagi materiału zakodowanej w ID, nie z heurystyki koloru.
- Pass 3 stosuje 16-stopniową rampę, glify krawędziowe, dithering Bayera, opcjonalne migotanie `8 Hz` dla oznaczonych materiałów oraz rozjaśnianie rdzenia HDR.
- Pass 5 ma cztery poziomy downsample i cztery poziomy upsample Dual-Kawase z progiem `0.72` i miękkim kolanem `0.15`.
- Pass 6 wykonuje ACES Filmic, winietę 12% i pozostawia mikro-siatkę wyłączoną.
- HTML-owy HUD nadal jest osobnym, natywnym elementem interfejsu. Podgląd budowania otrzymał własną partię glifów, a odświeżanie zaznaczeń nie czyści już wspólnej warstwy VFX.
- Wczytywanie zapisu odpina partie GPU przed usunięciem starego świata i przypina je do nowych warstw. Format zapisów i logika symulacji nie zostały zmienione.
- Kolory podstawowych materiałów pustyni, wody, oazy, lasu, wzgórz, klifów, kamienia, żelaza i smoły zostały przyciemnione w kierunku limitów luminancji z tabeli terenu. Wybrane elementy mają już jawne normalne, wysokości i ID materiału.

**Częściowe — nie oznaczać jako ukończone**

- GPU instancing dotyczy obecnie całej warstwy glifów świata, ale CPU nadal spłaszcza drzewo sceny do rekordów instancji przy odświeżaniu. Docelowy koszt i stabilne 60 FPS nie zostały zmierzone.
- Bufory wysokości, normalnych, emisji i ID istnieją, lecz wiele detali/budynków nadal korzysta z domyślnych wartości materiału. Jawna geometria i normalne są na razie przypisane do wybranych terenów oraz ścian siedziby.
- Infrastruktura obsługuje maksymalnie 64 światła, culling i klastrowanie, ale nie ma jeszcze wszystkich pozycji z katalogu świateł (kuźnie, warsztaty, pochodnie, pożary, zaraza, strzały, obiekty strachu i inne).
- Obecne postacie i glify selekcji korzystają z instancjonowanej ścieżki G-Buffer. Oddzielny, natywny dla ekranu Pass 4 z ostrymi klastrami jednostek, testem głębokości i osobnymi buforami pocisków/cząsteczek nie jest jeszcze ukończony.
- Próbkowanie komórek uwzględnia fazę kamery i rozdzielczość DPI, ale pełne testy sub-cell lock przy zoomie, czterech obrotach i zmianie rozdzielczości wymagają kontroli obrazu w przeglądarce.

**Pozostałe wymagania źródła do wykonania**

- Pełna paleta ośmiu frakcji oraz komplet materiałów, limitów `L_max`, obrysów i animacji terenu (w tym planowana/wykopana fosa, bąble smoły, drzewa i jelenie).
- Wizualny FSM wszystkich budynków: pracujący, bez pracownika, pauza, blokada magazynu/surowca, uszkodzenia HP, pożar i rozpad; pełne detale murów, bram, mostów, machin i stosów magazynowych.
- Pełny roster europejski/arabski/specjalistyczny, machiny oblężnicze, pociski artyleryjskie/ogniste, stacking, paski HP, hit-flash `65 ms` i rozpad śmierci `400 ms`.
- Dodatkowe stany i krzywe VFX strzał ogniowych, głazów, cienia, pożaru, wrzącego oleju, krowy/zarazy, gaszenia i zawalenia muru. Podstawowe ASCII-strzały i bełty mają już lot i opóźnione obrażenia.
- Pełny HUD zgodny z dokumentem: księga raportów z 12 miesiącami, dyplomacja, alerty, komplet kursorów, rozetowe sterowanie PPM i pozostałe szczegółowe panele kontekstowe.
- Testy akceptacyjne obrazu, w tym test luki w murze, rozróżnianie siedmiu typów terenu i bitwa stresowa `100` łuczników + `50` niewolników + `30` pól smoły + `3` katapulty z krowami. Nie ma jeszcze pomiaru stałych `60 FPS` na zintegrowanym GPU.

**Weryfikacja tej fazy**

- Regresja symulacji, ekonomii, logistyki, trasowania, sterowania, zapisów i HUD-u: `87/87` testów.
- Testy statyczne sprawdzają atlas, brak obiektów `Text`/`Sprite` per glif, instancing, bufory G-Buffer, światła, downsample krawędzi, Dual-Kawase, ACES, flagę animacji i oddzielny podgląd budowania.
- TypeScript i produkcyjny build Vite muszą przejść przed publikacją.
- Nie wykonano testu wizualnego GPU w przeglądarce VPS; brak `libatk-1.0.so.0` nadal uniemożliwia uruchomienie używanego tam headless Chromium. Build i odpowiedzi HTTP nie są traktowane jako dowód jakości obrazu ani wydajności.

## Ultra-gęste ASCII i czytelność strategiczna — faza 4 (2026-11-28)

Ta faza wdraża pięć mechanizmów z dokumentu Wklejony tekst(20261128-000418).txt. Nie zmienia logiki symulacji, ekonomii, logistyki ani formatu zapisów.

**1. Pixel-perfect Micro-Atlas**
- Atlas ma siatkę 16×32, komórki magazynowe 6×8 i filtrowanie nearest. Trzy pierwsze banki zawierają po 64 podstawowe glify: tryb ekstremalny 3×5, zalecany ultra-gęsty 4×6 oraz zbalansowany 5×7.
- Komórka wyjściowa każdego wariantu zachowuje jeden czarny piksel po prawej i na dole: odpowiednio 4×6, 5×7 i 6×8.
- Rasteryzacja kończy się maską wyłącznie 0/255; źródłowy antyaliasing jest progowany przed zapisem do tekstury R8. Glify nie są skalowane filtrem liniowym.
- Przy pixelRatio > 1 shader powiększa każdy bit nearest-neighbor i zachowuje gutter jako jeden piksel logiczny.
- Pozostałe sloty atlasu mieszczą dodatkowe znaki Unicode i warianty pogrubione. Limit całego atlasu nadal wynosi 512 komórek.

**2. Importance-Weighted Max-Pooling w Passie 2**
- Każda komórka próbuje wszystkie piksele wejściowe i wybiera zwycięzcę według priorytetu zakodowanej warstwy oraz emisji.
- Priorytet 4: warstwa selekcji/VFX oraz emissive > 1.0.
- Priorytet 3: jednostki (layer 2).
- Priorytet 2: krawędzie budynków (layer 1) wykryte z sąsiednich ID, wysokości i normalnych.
- Priorytet 1: płaski teren, wnętrza i dachy; tylko te próbki przechodzą klasyczne uśrednianie.
- Sobel nadal łączy gradient wysokości, normalnych i ID z wagami odpowiednio 1.0, 0.8 i 1.2.

**3. Kompensacja zoomu**
- Zakres kamery wynosi teraz 0.5×–2.0×, a widok początkowy/reset to 1.0×. Starsze zakładki kamery są ograniczane do nowego zakresu przy odtwarzaniu.
- u_zoomNorm jest normalizowany między 0.5× i 2.0×; profil strategiczny jest aktywny w pobliżu 0.5×, standardowy wokół 1.0×, a zbliżenie od 1.5×.
- Maksymalna luminancja terenu przechodzi od 0.09 do 0.20; promień bloom od 0.45 do 1.0; intensywność bloom od 0.65 do 1.0; próg krawędzi od 0.14 do 0.24.
- Jednostki otrzymują dodatkowe 25% skali w widoku strategicznym, by nie znikały pomiędzy komórkami terenu.

**4. Glyph LOD**
- Oddziały startowe posiadają odrębne rekordy dla pełnej sylwetki z bliska (3×5), klastra standardowego (2×3) i znaku taktycznego z daleka.
- Tryb strategiczny używa klas: ) łucznik, █ piechota, m kawaleria i * oddział najeźdźców/niewolników; stos ma etykietę [xN].
- LOD jest wybierany bez zmiany danych jednostki ani stanu symulacji.

**5. Półbloki**
- Atlas zawiera komplet ▀, ▄, ▌, ▐, ▖, ▗, ▘, ▝.
- Silne krawędzie budynków (edge > 0.5) mogą korzystać z tych znaków, a pozostałe krawędzie i wypełnienia pozostają na rampie znaków.

**Silnik i zakres**
- Pozostaje TypeScript + Vite z własnym potokiem GLSL/WebGL2. Obecna warstwa PixiJS zapewnia aplikację i zasoby renderera, ale nie zastępuje własnych passów G-Buffer, priority pooling, glifów i bloom.
- Nie wykonano migracji do Godot ani Three.js: nie byłaby potrzebna do funkcji tej specyfikacji i zwiększałaby ryzyko regresji działającej symulacji.
- Ta faza nie kończy innych punktów z wcześniejszej, szerszej specyfikacji Effulgence: pełnego rosteru, wszystkich VFX, wszystkich źródeł świateł, kompletnego HUD-u ani natywnego Passu 4.

**Weryfikacja fazy 4**
- 97/97 testów automatycznych — PASS.
- TypeScript tsc --noEmit — PASS.
- Produkcyjny vite build — PASS.
- git diff --check — PASS.
- Nie wykonano testu wizualnego GPU ani pomiaru 60 FPS; serwerowy Chromium nadal nie uruchamia się z powodu brakującej biblioteki libatk-1.0.so.0. Testy statyczne potwierdzają strukturę i logikę shaderów, ale nie zastępują kontroli obrazu na rzeczywistym GPU.

### Uzupełnienie fazy 4 — minimalna geometria ekranowa i LOD budynków (2026-11-28)

- Rekord glifu może określić minScreenCells. GPU batch przelicza tę wartość na logiczne piksele ekranu z uwzględnieniem rozdzielczości renderera, a następnie ogranicza rozmiar instancji po transformacji kamery. Nie skaluje całej warstwy ani murów.
- Taktyczny znak jednostki ma minimum 1×2 komórki, a licznik [xN] 1×1. Ruchome postacie/cywile również zachowują minimum 1×2, niezależnie od bazowego rozmiaru fontu.
- Promień trafienia jednostki jest wyliczany w świecie jako ekranowe 14 px podzielone przez zoom. Zasięg kliknięcia pozostaje więc stały na ekranie przy 0.5×, 1.0× i 2.0×; rozmiar modelu i klikalność nie są już zależne wyłącznie od skali świata.
- Budynki zachowują istniejącą sylwetkę w trybie standard i close. Przy zoomie strategicznym ich detale są zastępowane pojedynczym glifem rozpoznawczym (m.in. K — donżon, B — koszary, M — młyn, S — spichlerz, T — wieża, litery obiektów gospodarczych).
- Weryfikacja uzupełnienia: testy konwersji fizycznych komórek na logiczne piksele HiDPI, niezmiennego ekranowego hitboxu dla trzech poziomów zoomu, trzech LOD jednostek i LOD budowli.


## Bieżące uzupełnienie — system walki, fortyfikacje i raporty (2026-11-28)

Ta notatka aktualizuje status etapów 2, 5 i 6 po dalszej implementacji. Nie zastępuje wymagań z wcześniejszych etapów i nie oznacza, że cała gra jest ukończona.

### Działające elementy dodane w tej iteracji

**Lordowie i rozstrzygnięcie bitwy**
- Świat zawiera Lorda gracza i Lorda przeciwnika jako odrębne jednostki z własnym HP, ruchem i samoobroną.
- Śmierć Lorda gracza powoduje porażkę; śmierć wrogiego Lorda przy żywym własnym powoduje zwycięstwo; jednoczesna śmierć to remis.
- Wynik zatrzymuje symulację, blokuje ponowne wznowienie i jest zachowywany w lokalnym zapisie.
- Stare zapisy formatu v1 bez pól Lordów otrzymują domyślnych Lordów podczas migracji. Zapis nadal ma wersję 1, a nowe właściwości są opcjonalne.

**Rekrutacja**
- Panel Koszar oferuje pikinierów, łuczników, kuszników i szermierzy.
- Każda klasa wymaga jednej sztuki odpowiedniej, gotowej broni w fizycznej Zbrojowni oraz jednego bezrobotnego mieszkańca.
- Rekrutacja tworzy jednostkę w wolnym, osiągalnym polu w pobliżu Koszar i zużywa odpowiedni zapas. Nie wprowadza ceny złota, ponieważ nie ma jej zdefiniowanej w tabeli projektu.

**Fortyfikacje**
- Wysokie/niskie mury, małe/duże bramy i fosa mogą być umieszczane na wolnych polach siatki.
- Zajęte pole blokuje ruch i nowe trasy; zamknięta brama blokuje, a otwarta przywraca przejście. Usunięcie/zniszczenie obiektu przywraca zapamiętany naturalny typ terenu i jego przechodniość.
- Odcinki murów mogą przylegać do siebie. Koszty drewna/kamienia pozostają prototypowymi parametrami strojenia w module fortifications, nie wartościami potwierdzonymi przez źródłową specyfikację.
- Wieża strażnicza ostrzeliwuje najbliższy osiągalny cel w promieniu 280 jednostek świata, zadając 12 obrażeń co 1,2 s. To automatyczna obrona bez osobnego wizualnego pocisku.
- Łucznicy i kusznicy wysyłają widoczne pociski ASCII (strzała/bełt) z czasem lotu zależnym od dystansu; obrażenia są naliczane po dotarciu, a pocisk znika po śmierci celu.

**Raporty i wynik**
- Księga przechowuje dwanaście ostatnich rzeczywistych rozliczeń miesięcznych: zmianę popularności, żywność, podatki/łapówkę oraz populację i bezrobotnych.
- Historia jest częścią zapisu; zapis historyczny bez tego pola rozpoczyna pustą historię, a nieprawidłowe wpisy są odrzucane.
- Tabela wyników pokazuje bieżącą siłę wojsk i przeżycie Lordów. Nie prezentuje skarbca/populacji wroga, ponieważ taka gospodarka jeszcze nie istnieje.

### Status etapów po uzupełnieniu

- **Etap 1:** fundament siatki i trasowania ukończony. Nie oznacza to ukończenia wszystkich późniejszych mechanik terenu.
- **Etap 2:** nadal częściowy. Dwanaście rozliczeń miesięcznych jest dostępnych, lecz pełny ranking wielu Lordów, dyplomacja, alerty Skryby i komplet skrótów/menu kontekstowych pozostają nieukończone.
- **Etap 3:** populacja, pracownicy, bilans popularności, religia i strach działają; dokładne koszty łapówek pozostają wyłączone, dopóki nie zostaną zdefiniowane.
- **Etap 4:** fizyczne magazyny, dostawy, produkcja i handel ręczny są wdrożone i testowane.
- **Etap 5:** **częściowo wdrożony, nieukończony**. Działają Lordowie jako cele rozstrzygnięcia, cztery klasy rekrutacji, pięć typów fortyfikacji i podstawowy ostrzał wież. Nadal brakuje m.in. fos kopanych przez pracowników, zasypywania, schodów, mostów zwodzonych, przejmowania bram, smoły/pożarów/gaszenia/oleju/zarazy, pełnych klas jednostek, machin oblężniczych, pocisków artyleryjskich/ogniowych, friendly fire i patroli.
- **Etap 6:** **nadal nieukończony**. Działają cywile, kolejki dostaw i podstawowy agresywny oddział najeźdźców, ale przeciwnik nie ma własnej ekonomii/populacji/planów zamku/handlu/rekrutacji, systemu dyplomacji i sojuszników. Pełne alerty tekstowe/głosowe oraz końcowa integracja AI pozostają do wykonania.

### Testy tej iteracji
- Automatyczny zestaw testów: 113/113 PASS.
- TypeScript tsc --noEmit: PASS.
- Produkcyjny build Vite: PASS.
- Nie wykonano testu wizualnego w przeglądarce ani pomiaru FPS. Brak libatk-1.0.so.0 nadal blokuje używany serwerowy headless Chromium; testy logiki i build nie są przedstawiane jako dowód jakości obrazu ani 60 FPS.
