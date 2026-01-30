# Dokument wymagań produktu (PRD) - HomeBudget

## 1. Przegląd produktu
Aplikacja HomeBudget to webowa PWA wspierająca szybkie zarządzanie miesięcznym budżetem domowym dzięki automatycznej kategoryzacji wydatków wykorzystującej AI. MVP adresuje podstawowy ból użytkowników: czasochłonne ręczne przypisywanie kategorii i monitorowanie bieżącego stanu budżetu. Użytkownik (rodzina / gospodarstwo domowe 2 osoby) może:
- Logować się przez dostawcę social OAuth
- Dodawać pojedyncze wydatki z automatyczną sugestią kategorii przez AI (OpenAI + fallback słowa kluczowe)
- Ustawiać i edytować miesięczne limity budżetowe per kategoria (11 predefiniowanych kategorii)
- Importować większą paczkę wydatków z pliku CSV (minimalny schemat) z automatyczną kategoryzacją i detekcją duplikatów
- Przeglądać wizualizacje (wykres słupkowy: wydatki vs limit + kolorystyczne progi) oraz udział osób w wydatkach
- Przeglądać historię minionych miesięcy (ograniczona edycja) oraz korygować limity bieżącego miesiąca

Architektura: Astro SSR + React (komponenty interaktywne), Supabase (Auth, DB), OpenAI API (kategoryzacja), fallback lokalny mapping słów kluczowych. Waluta: PLN. Język interfejsu: PL. Jedno gospodarstwo per użytkownik w MVP (każdy użytkownik widzi ten sam zestaw danych; brak ról granularnych). 

Założenie nazwy HomeBudget jest tymczasowe (nazwa i branding wciąż nierozstrzygnięte). 

## 2. Problem użytkownika
Zarządzanie budżetem domowym wymaga częstego ręcznego wpisywania wydatków i nadawania kategorii. Użytkownicy tracą czas na:
- Manualną kategoryzację (błędną lub niespójną)
- Zbieranie wielu transakcji z różnych źródeł (paragony, zestawienia bankowe)
- Szybką ocenę stanu realizacji limitów kategorii w bieżącym miesiącu
- Analizę, czy wprowadzony wydatek mieści się w limicie i jaki wpływ ma na całość

Konsekwencje: opóźnione decyzje finansowe, brak przekroju per kategoria na bieżąco, rosnący koszt psychiczny utrzymania systemu. 

Rozwiązanie: Automatyczna kategoryzacja >90% wydatków, szybkie importy CSV, wyraźne wizualizacje limitów, niskie opóźnienie interfejsu (PWA <3s ładowanie), ograniczona liczba kategorii zwiększająca trafność modelu. 

## 3. Wymagania funkcjonalne
3.1 Uwierzytelnianie i sesja
- Social OAuth (co najmniej 1 dostawca; docelowo Favebook i Google) przez Supabase Auth.
- Po pierwszym logowaniu automatyczne utworzenie rekordu użytkownika i przypisanie do domyślnego gospodarstwa (Household).
- Utrzymanie sesji (token Supabase) i automatyczne odświeżanie.

3.2 Model danych (MVP)
- Users: id, email, name, created_at
- Budget: id, month (YYYY-MM), type_id, amount, updated_at
- TransactionTypes (enum lub tabela): id, name
- Transactions: id, user_id, amount, description, date (YYYY-MM-DD), type_id (propozycja AI lub ręcznie wybrana), ai_confidence (0–100), ai_status (success|fallback|error), import_hash (nullable), created_at
- AIKeywordMapping (konfiguracja fallback) – statyczne w MVP (plik / tabela seed) 

3.3 Kategorie (11 stałych w MVP)
Spożywcze, Dom, Zdrowie i Uroda, Samochód, Moda, Rozrywka i Okazje, Rachunki, Stałe wydatki, Nieplanowane, Inne (fallback), Inwestycje.

3.4 Budżety miesięczne
- Domyślne wartości początkowe przy onboardingu (prekonfigurowany zestaw) – użytkownik może edytować inline.
- Limity definiowane per miesiąc i kategoria. Zmiana w bieżącym miesiącu jest natychmiastowa.
- Edycja miesiąca bieżącego. Starsze miesiące (x-1 i dalej) read-only.
- Brak procesu „zamykania” miesiąca.

3.5 Dodawanie wydatku
- Pola: kwota (PLN), opis, data (range ograniczony: bieżący miesiąc plus konfiguracja dla zaległych – np. ostatnie 60 dni, szczegóły do doprecyzowania), opcjonalnie osoba (wybierana automatycznie z user session), kategoria (AI sugeruje, użytkownik może zmienić).
- Walidacja: kwota >0 (lub decyzja ws. ujemnych zwrotów – nierozstrzygnięte), data w dozwolonym zakresie, opis max znaków (np. 200 – do ustalenia), brak przyszłych dat.
- AI kategoryzacja: request do OpenAI, timeout (np. 2s), 1x retry w razie failure; przy timeout lub błędzie fallback mapping słów kluczowych; w braku dopasowania kategoria Inne.
- Prezentacja pewności: badge (skala do doprecyzowania), przy niskiej pewności (threshold TBD) wymuszenie lub zachęta do ręcznej akceptacji/zmiany.
- Logowanie akcji korekty (do analizy accuracy trendu) – status do potwierdzenia (nierozstrzygnięte czy w MVP).
- Możliwość prostego usunięcia wydatku (twarde delete); soft delete i wersjonowanie post-MVP.

3.6 Import CSV
- Minimalny schemat kolumn: Data, Kwota, Opis, Osoba (opc.), Kategoria (opc.).
- Parametry pliku (separator, encoding, format daty, separator dziesiętny) nierozstrzygnięte – przyjęcie safe default: UTF-8, separator przecinek lub średnik auto-detekcja, data YYYY-MM-DD.
- Walidacja wierszy: poprawność daty, kwoty, niepuste wymagane pola.
- Detekcja duplikatów: zestaw (Data + Kwota + Opis) – 100% identyczności → oznaczenie i domyślne pominięcie (użytkownik może odznaczyć do importu).
- Podgląd przed zatwierdzeniem: edycja kategorii, usuwanie pojedynczych wierszy z batcha.
- AI kategoryzacja wykonywana masowo (kolejkowanie) z fallback; błędne wiersze nie blokują całości (polityka częściowo błędnych: preferowana skip pojedynczych z raportem – nadal nierozstrzygnięte, decyzja wymagana). 

3.7 Wizualizacja budżetu
- Wykres słupkowy poziomy: dla każdej kategorii dwa słupki (limit vs wydatki) lub jeden słupek z wypełnieniem; kolorystyka progów (<80% zielony, 80–100% pomarańczowy, >100% czerwony).
- Sumaryczny pasek postępu całkowitego wydatku vs suma limitów.
- Udział osób: procentowy udział kwot w bieżącym miesiącu.
- Historia miesięcy: selektor miesiąca; tryb tylko podglądu dla miesięcy starszych niż x-1.

3.8 PWA i wydajność
- Czas ładowania początkowego <3s na referencyjnym urządzeniu mobilnym (definicja do ustalenia).
- Offline (minimum): caching shell + statyczne zasoby; operacje dodawania wydatków wymagają online (brak offline queue w MVP).

3.9 Dostępność i UX
- Intuicyjne inline edycje limitów.
- Wyraźne zaznaczenie niskiej pewności AI (np. ikona ostrzeżenia + możliwość ręcznego wyboru kategorii).
- Formatowanie kwoty: 2 miejsca po przecinku, separator dziesiętny przecinek lub kropka akceptowany, prezentacja z kropką (standaryzacja).

3.10 Bezpieczeństwo i prywatność
- Dane dostępne wyłącznie dla zalogowanych użytkowników (wspólne gospodarstwo w MVP – brak granularnych ról).
- Brak eksportu oraz zewnętrznych integracji w MVP.
- Ograniczenie zakresu dat ochroni przed błędnym importem historycznie bardzo starych danych (limit do doprecyzowania).

3.11 Obsługa błędów
- Komunikaty przy niepowodzeniu AI: neutralne i zachęta do ręcznej zmiany.
- Przy imporcie: raport liczby poprawnych, duplikatów, odrzuconych.
- Globalne błędy API: toast lub inline komunikat z możliwością ponowienia.

3.12 Logowanie i metryki techniczne
- Czas odpowiedzi AI (ms), liczba retry, częstotliwość fallback.
- Accuracy: procent wydatków bez korekty kategorii.
- Korekty kategorii (jeśli włączone) – event log.
- Liczba duplikatów wykrytych przy imporcie.

## 4. Granice produktu
4.1 W zakresie (MVP)
- Social OAuth (min. 1 provider)
- Jedno gospodarstwo (Household) współdzielone
- 11 predefiniowanych kategorii
- Miesięczne limity kategorii z edycją bieżącego i poprzedniego miesiąca
- Dodawanie i usuwanie pojedynczych wydatków
- AI kategoryzacja + fallback mapping słów kluczowych + manualna korekta
- Import CSV (minimalny schemat) + duplikaty + podgląd
- Wizualizacja budżetu (wykres + progi) + udział osób
- Historia miesięcy (read-only > x-1)
- Podstawowa PWA (możliwość dodania do ekranu użytkownika) 

4.2 Poza zakresem (MVP)
- Wydzielona sekcja stałych opłat miesięcznych
- Wydzielona sekcja kredytów
- Zaawansowane raporty / analizy trendów
- Integracje z bankami / automatyczne transakcje
- Eksport danych / backup
- Wielowalutowość / wielojęzyczność
- Powiadomienia progowe (alerty push / email)
- Soft delete, wersjonowanie, audyt zmian

4.3 Ograniczenia techniczne
- Waluta stała PLN
- Jedna strefa czasowa (Europe/Warsaw)
- Brak kolejkowania offline transakcji

4.4 Nierozstrzygnięte kwestie (do doprecyzowania przed lub tuż po starcie implementacji)
- Dokładny format CSV (separator, decimal, encoding) – potrzebna próbka
- Nazwa i branding produktu (wpływ na domenę i konfiguracje OAuth)
- Rejestrowanie korekt AI (włączone czy odroczone?)
- Progi confidence (np. <50 niski, 50–80 średni, >80 wysoki?) – definicja
- Zwroty/refundy – osobna kategoria czy ujemne wartości
- Polityka częściowo błędnych wierszy przy imporcie (skip vs blokada całości)

## 5. Historyjki użytkowników
Format: ID, Tytuł, Opis, Kryteria akceptacji (testowalne). 

US-001 Logowanie przez OAuth
Opis: Jako użytkownik chcę zalogować się jednym kliknięciem przez dostawcę social aby szybko rozpocząć pracę.
Kryteria akceptacji:
- Po kliknięciu przycisku Google następuje redirect i powrót z aktywną sesją.
- Przy pierwszym logowaniu tworzony rekord użytkownika oraz przypisanie do domyślnego gospodarstwa.
- Błędne logowanie pokazuje komunikat błędu bez utraty stanu strony.
- Sesja jest odtwarzana po odświeżeniu strony.

US-002 Wylogowanie
Opis: Jako użytkownik chcę móc się wylogować aby zakończyć sesję na współdzielonym urządzeniu.
Kryteria akceptacji:
- Kliknięcie Wyloguj powoduje usunięcie tokenu i powrót do ekranu logowania.
- Po wylogowaniu chronione zasoby są niedostępne (przekierowanie / guard).

US-003 Wstępna nazwa i branding placeholder
Opis: Jako zespół chcemy używać tymczasowej nazwy do konfiguracji OAuth.
Kryteria akceptacji:
- Nazwa tymczasowa ustawiona (HomeBudget) w pliku konfiguracyjnym.
- Zmiana możliwa bez wpływu na dane użytkowników.

US-004 Dodanie pojedynczego wydatku z AI kategorią
Opis: Jako użytkownik chcę dodać wydatek i otrzymać sugestię kategorii aby zaoszczędzić czas.
Kryteria akceptacji:
- Formularz wymaga kwoty (>0), opisu (niepusty), daty w dozwolonym zakresie.
- Po wpisaniu opisu wyświetla się proponowana kategoria i badge pewności.
- Przy niskiej pewności (threshold) UI zaznacza potrzebę weryfikacji.
- Zapis tworzy transakcję z kategorią AI lub ręcznie wybraną.
- W razie błędu AI następuje fallback słów kluczowych lub kategoria Inne.

US-005 Ręczna korekta kategorii przed zapisem
Opis: Jako użytkownik chcę nadpisać proponowaną kategorię gdy uznam ją za błędną.
Kryteria akceptacji:
- Lista kategorii dostępna w selektorze.
- Po zmianie kategoria AI nie jest nadpisywana automatycznie.
- Zapis odnotowuje kategorię końcową jako manualną.

US-006 Podgląd i edycja istniejącego wydatku (bieżący miesiąc)
Opis: Jako użytkownik chcę poprawić opis lub kategorię błędnie dodanego wydatku.
Kryteria akceptacji:
- Edycja dostępna dla transakcji z bieżącego miesiąca.
- Zmiana zachowuje nową kategorię i nadpisuje ai_status jeśli była automatyczna.
- Walidacja pól identyczna jak przy dodawaniu.

US-007 Usunięcie wydatku
Opis: Jako użytkownik chcę usunąć błędnie wprowadzony wydatek.
Kryteria akceptacji:
- Ikona Usuń dostępna na liście bieżącego miesiąca.
- Potwierdzenie (modal) przed trwałym usunięciem.
- Po usunięciu wydatek zniknie z listy i wykres się aktualizuje.

US-008 Ustawienie / korekta limitu w trakcie miesiąca
Opis: Jako użytkownik chcę zmienić limit kategorii gdy sytuacja finansowa się zmieni.
Kryteria akceptacji:
- Edycja limitu inline aktualizuje wartość natychmiast po zatwierdzeniu (Enter / blur).
- Wykres odświeża procent wykorzystania.
- Zmiana limitu zapisuje się w budżecie miesiąca.

US-009 Przegląd wykorzystania budżetu
Opis: Chcę zobaczyć w jednej wizualizacji stopień realizacji limitów.
Kryteria akceptacji:
- Wykres pokazuje wszystkie kategorie.
- Kolory zgodne z progami (<80, 80–100, >100).
- Tooltip zawiera: wydane, limit, procent.

US-010 Udział osób w wydatkach
Opis: Chcę widzieć jaki procent wydatków poniosła każda osoba.
Kryteria akceptacji:
- Widok procentów (sumy kwot user_id) dla bieżącego miesiąca.
- Aktualizacja po dodaniu/usunięciu wydatku.

US-011 Dodanie zaległego wydatku (opóźniony)
Opis: Chcę dodać wydatek z poprzednich dni (np. sprzed tygodnia) by utrzymać kompletność danych.
Kryteria akceptacji:
- Data nie może wykraczać poza dozwolony zakres (np. ostatnie 60 dni – do doprecyzowania).
- Próba poza zakresem zwraca komunikat błędu.

US-012 Podgląd wcześniejszych miesięcy
Opis: Chcę przejrzeć wydatki z wcześniejszych miesięcy bez możliwości edycji (poza x-1 dla limitów).
Kryteria akceptacji:
- Selektor miesiąca.
- Dla miesięcy starszych niż x-1 brak przycisków edycji/usuwania.
- Wykres i lista są read-only.

US-013 Edycja limitów poprzedniego miesiąca (x-1)
Opis: Chcę skorygować limity w poprzednim miesiącu jeśli wystąpił błąd.
Kryteria akceptacji:
- Edycja tylko w miesiącu x-1.
- Po zapisaniu przeliczenie procentów w tym miesiącu.

US-014 Import CSV – wgranie pliku
Opis: Chcę zaimportować większą liczbę wydatków z pliku aby skrócić czas wprowadzania.
Kryteria akceptacji:
- Akceptowany plik spełnia minimalne kolumny (Data, Kwota, Opis - do doprecyzowania). Osoba, Kategoria opcjonalne.
- Niepoprawny format kolumn zwraca błąd z instrukcją.

US-015 Import CSV – podgląd i automatyczna kategoryzacja
Opis: Chcę zobaczyć proponowane kategorie przed zatwierdzeniem importu.
Kryteria akceptacji:
- Lista wierszy z podanymi polami i sugerowaną kategorią + confidence.
- Możliwość edycji kategorii każdej pozycji.
- Wiersze duplikatów oznaczone i domyślnie odznaczone do importu.

US-016 Import CSV – zatwierdzenie
Opis: Chcę zatwierdzić wybrane wiersze i dodać je do systemu.
Kryteria akceptacji:
- Kliknięcie Import dodaje tylko zaznaczone wiersze.
- Raport końcowy: liczba dodanych, duplikatów pominiętych, błędnych.

US-017 Detekcja duplikatów przy imporcie
Opis: System ma automatycznie wykryć identyczne wydatki, aby uniknąć powielania.
Kryteria akceptacji:
- Wiersz uznany za duplikat, jeśli Data+Kwota+Opis są identyczne w istniejących transakcjach miesiąca.
- Duplikaty nie są importowane domyślnie.

US-018 Ręczna korekta kategorii przy imporcie
Opis: Chcę zmienić kategorię pojedynczego wiersza, jeśli AI wybrało źle.
Kryteria akceptacji:
- Selektor kategorii w wierszu.
- Zmiana przed zatwierdzeniem zapisuje nową kategorię.

US-019 Obsługa błędnych wierszy w imporcie
Opis: Chcę, aby błędne wiersze nie blokowały importu poprawnych.
Kryteria akceptacji:
- Błędne wiersze oznaczone (np. czerwony). 
- Import dodaje tylko poprawne (jeśli polityka skip – do potwierdzenia).
- Raport listuje odrzucone z przyczyną.

US-020 Fallback kategoryzacji (AI błąd lub timeout)
Opis: Chcę aby wydatek otrzymał sensowną kategorię mimo błędu AI.
Kryteria akceptacji:
- Przy błędzie AI następuje 1 retry.
- Po finalnym niepowodzeniu używany mapping słów kluczowych.
- Brak dopasowania → kategoria Inne + flagowanie niskiej pewności.

US-021 Wskaźnik pewności kategorii
Opis: Chcę widzieć poziom pewności, aby zdecydować o ręcznej korekcie.
Kryteria akceptacji:
- Badge z poziomem (np. wysoki / średni / niski) wg progów (TBD – placeholder).
- Niski poziom wyświetla dodatkowe ostrzeżenie.

US-022 Aktualizacja wykresu po dodaniu/usunięciu wydatku
Opis: Chcę natychmiast zobaczyć wpływ operacji na budżet.
Kryteria akceptacji:
- Wykres odświeża słupek kategorii i sumę globalną.
- Kolor zmienia się, gdy próg jest przekroczony.

US-023 Walidacja daty wydatku
Opis: Chcę otrzymać informację, gdy data jest poza dozwolonym zakresem.
Kryteria akceptacji:
- Data w przyszłości blokuje zapis z komunikatem.
- Data starsza niż limit (np. >60 dni) blokuje zapis.

US-024 Standard waluty i format kwoty
Opis: Chcę mieć spójny format kwot w interfejsie.
Kryteria akceptacji:
- Kwoty wyświetlane z dwoma miejscami po przecinku.
- Wejście akceptuje przecinek lub kropkę (parsowanie do liczby). 

US-025 Ochrona dostępu do danych
Opis: Jako użytkownik chcę mieć pewność, że dane budżetu nie są dostępne bez logowania.
Kryteria akceptacji:
- Próba wejścia na stronę budżetu bez sesji przekierowuje do logowania.
- API odrzuca żądania bez prawidłowego tokenu.

US-026 Odświeżenie sesji
Opis: Chcę, aby moja sesja była utrzymana bez konieczności ponownego logowania.
Kryteria akceptacji:
- Przy wygasaniu tokenu następuje ciche odświeżenie.
- Nie występuje utrata stanu UI w trakcie.

US-027 Monitoring metryk AI
Opis: Chcę móc analizować skuteczność kategoryzacji (dla zespołu operacyjnego).
Kryteria akceptacji:
- System loguje zdarzenia: akceptacja bez korekty / korekta.
- Dostępny dashboard (prosty) lub eksportowe zestawienie w panelu admin (post-MVP – w MVP tylko logi techniczne). 

US-028 Wydajność – szybkie ładowanie
Opis: Jako użytkownik chcę szybko rozpocząć pracę po wejściu na stronę.
Kryteria akceptacji:
- Czas TTFB + inicjalizacja <3s na określonym środowisku testowym.
- Zasoby statyczne cachowane (PWA manifest, service worker).

US-029 Responsywność UI
Opis: Chcę korzystać z aplikacji na telefonie i laptopie.
Kryteria akceptacji:
- Widok budżetu poprawnie skaluje się na szerokość <400px.
- Formularz dodawania dostępny bez poziomego scrolla.

US-030 Komunikaty błędów AI
Opis: Chcę zrozumieć co się stało gdy AI nie kategoryzuje wydatku.
Kryteria akceptacji:
- Przy timeout: komunikat neutralny i zastosowany fallback.
- Przy błędzie serwera AI: komunikat z możliwością ponowienia ręcznej kategoryzacji.

US-031 Import – anulowanie procesu
Opis: Chcę móc przerwać import przed zatwierdzeniem.
Kryteria akceptacji:
- Przycisk Anuluj usuwa wczytane dane robocze (nie dodaje transakcji).
- Powrót do stanu sprzed importu.

US-032 Filtr wydatków po kategorii lub opisie
Opis: Chcę przejrzeć wydatki w jednej kategorii, aby ocenić strukturę.
Kryteria akceptacji:
- Filtr lista kategorii ogranicza widok do wybranej.
- Filtr tekstowy wyszukuje w opisie oraz kategorii (case insensitive, partial match).
- Wyczyść filtr przywraca pełną listę.

US-033 Sortowanie wydatków
Opis: Chcę posortować wydatki po dacie lub kwocie.
Kryteria akceptacji:
- Sortowanie rosnąco/malejąco działa i aktualizuje listę.
- Zmiana sortowania nie resetuje filtra kategorii.

US-034 Edge case: brak wydatków w miesiącu
Opis: Chcę zobaczyć jasny komunikat gdy nie ma jeszcze wydatków.
Kryteria akceptacji:
- Wykres pokazuje limity z zerowym wykorzystaniem.
- Lista wyświetla komunikat Zachęta do dodania pierwszego wydatku.

US-035 Edge case: przekroczenie limitu
Opis: Chcę otrzymać wizualną informację o przekroczeniu kategorii (>100%).
Kryteria akceptacji:
- Słupek czerwony.
- Tooltip informuje o kwocie ponad limit (różnica).

US-036 Edge case: brak connectivity w trakcie dodawania
Opis: Chcę wiedzieć, że zapis się nie udał z powodu utraty sieci.
Kryteria akceptacji:
- Przy braku odpowiedzi API po timeout komunikat o problemie sieci.
- Formularz zachowuje wpisane dane do ponowienia.

US-037 Manualna zmiana miesiąca
Opis: Chcę wybrać miesiąc z selektora.
Kryteria akceptacji:
- Zmiana miesiąca przeładowuje listę i wykres.
- Bieżący miesiąc domyślnie aktywny przy logowaniu.

US-038 Ograniczenie edycji w miesiącach starszych
Opis: Nie chcę przypadkowo modyfikować starych danych.
Kryteria akceptacji:
- Brak przycisków edycji/usuwania dla miesięcy > x-1.
- Próba dostępu do endpointu edycji returnuje 403.

## 6. Metryki sukcesu
6.1 Dokładność AI
- Cel: ≥90% wydatków zaakceptowanych bez korekty (liczone miesiąc-rolling).
- Metoda: licznik transakcji z manualną korektą / ogół transakcji.

6.2 Czas uzupełnienia miesiąca z użyciem CSV
- Cel: <10 minut na wprowadzenie pełnego zestawu poprzez import + ewentualne korekty.
- Metoda: pomiar od rozpoczęcia importu do zatwierdzenia.

6.3 Detekcja duplikatów
- Cel: 100% wykrytych identycznych rekordów (Data+Kwota+Opis).
- Metoda: testy kontrolne + log porównawczy.

6.4 Wydajność PWA
- Cel: <3s do interaktywności (TTI) na referencyjnym urządzeniu mobilnym.
- Metoda: Lighthouse / Web Vitals.

6.5 Czas odpowiedzi AI
- Cel: średnia <2s, 95 percentyl <3s.
- Metoda: logowanie timestamp request/response.

6.6 Stabilność importu
- Cel: ≥95% poprawnych wierszy importowanych bez błędów w typowych plikach użytkowników.
- Metoda: testy QA z zestawem plików próbek.

6.7 Alert wskaźników (operacyjne)
- Cel: Fallback AI <10% wszystkich kategoryzacji miesięcznie.
- Metoda: log agregacji fallback.
