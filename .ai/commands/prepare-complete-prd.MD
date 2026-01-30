Jesteś doświadczonym menedżerem produktu, którego zadaniem jest stworzenie kompleksowego dokumentu wymagań produktu (PRD) w oparciu o poniższe opisy:

<project_description>
## Główny problem
Zarządzanie budżetem domowym jest czasochłonne.
Dzięki wykorzystaniu AI w tej aplikacji możesz szybko kategoryzować wydatki i monitorować miesięczny budżet.

## Najmniejszy zestaw funkcjonalności
- Prosty system kont użytkowników (logowanie przez social media)
- Dodawanie i kategoryzowanie wydatków za pomocą AI
- Podgląd miesięcznego budżetu i wydatków w formie wykresu
- Możliwość weryfikacji budżetu z minionych miesięcy

## Co NIE wchodzi w zakres MVP
- Stałe opłaty miesięczne (kredyty, subskrypcje)
- Zaawansowane raporty i analizy wydatków
- Integracja z bankami i automatyczne pobieranie transakcji

## Kryteria sukcesu
- 90% wprowadzonych wydatków jest poprawnie kategoryzowanych przez AI
</project_description>

<project_details>
<conversation_summary>
<decisions>
Budżet miesięczny: per kategoria, bez podziału na osoby, domyślnie uzupełniony wartościami, z możliwością edycji inline.
Model: każdy użytkownik ma własne konto i pełny dostęp do wspólnego budżetu oraz wydatków (jedno gospodarstwo w MVP).
Kategoria Stałe wydatki pozostaje w MVP jako zwykła kategoria; dedykowane miejsce i specjalne traktowanie post-MVP.
CSV import: minimalny bazowy schemat teraz (Data, Kwota, Opis, opcjonalnie Osoba, opcjonalnie Kategoria); pełna specyfikacja później po próbkach z banku.
Fallback AI: przygotowanie podstawowego mapowania słów kluczowych.
Usuwanie wydatków: w MVP delete, w przyszłości soft delete z możliwością przywrócenia jako element post-MVP.
Brak potrzeby teraz definiowania docelowych progów wydajnościowych poza ogólnymi metrykami już określonymi.
Audyt (log zmian / wersjonowanie) zaakceptowany jako element post-MVP.
Waluta: PLN, język interfejsu: PL; brak wsparcia wielowalutowego/wielojęzycznego w MVP.
UI dla niskiej pewności AI: akceptacja (badge pewności + sugestie); do wdrożenia w MVP.
Regularny formalny przegląd ryzyk (risk cadence) odrzucony na tym etapie.
</decisions>

<matched_recommendations>
Definicja pierwotnej persony (rodzina 2 osoby) - przyjęta.
Ograniczenie liczby kategorii dla zwiększenia trafności AI - zastosowane (lista 11 kategorii: Spożywcze, Dom, Zdrowie i Uroda, Samochód, Moda, Rozrywka i Okazje, Rachunki, Stałe wydatki, Nieplanowane, Inne, Inwestycje).
Pomiar dokładności przez user correction rate + per kategoria - przyjęty.
Confidence threshold i ręczny wybór kategorii przy niskiej pewności - przyjęty.
Bootstrap zbioru treningowego (ręczne korekty + import CSV) - implicite zaakceptowane.
Minimalna specyfikacja CSV teraz, pełna później - zaakceptowane.
Fallback keyword mapping dla podstawowych słów kluczowych - zaakceptowane.
Architektura z Household przygotowana pod wielość gospodarstw w przyszłości - zaakceptowane.
Audyt zmian (soft delete / wersjonowanie) przesunięty post-MVP.
Miesięczny formalny risk register odrzucony. </matched_recommendations>
<prd_planning_summary> A. Wymagania funkcjonalne: OAuth social login; automatyczne przypisanie do domyślnego Household; wspólne limity budżetowe per kategoria (11 kategorii); ręczne dodawanie wydatków (kwota, opis, data z ograniczeniem zakresu, osoba); opcjonalna kategoryzacja przez OpenAI; możliwość ręcznego nadpisania kategorii; import CSV (minimalny format, detekcja duplikatów przez data+kwota+opis, podgląd i edycja przed zatwierdzeniem); wizualizacja: bar chart limit vs wydatki z kodowaniem kolorystycznym progów oraz udział procentowy osób; historia miesięcy: bieżący pełna edycja, x-1 edytowalny, x-2 i starsze read-only; edycja limitów wpływa natychmiast; brak mechanizmu „zamykania miesiąca”; brak potrzeby usuwania danych historycznych. Integracja AI: OpenAI API, fallback keyword mapping, domyślna kategoria Inne przy braku dopasowania, retry i timeout. PWA jako platforma; brak monetyzacji.
B. Kluczowe historie użytkownika i ścieżki: Rejestracja/Logowanie (US1); Dodanie pojedynczego wydatku z sugestią AI (US2); Dodanie wydatku współmałżonka (US3); Import CSV z automatyczną kategoryzacją i podglądem (US4, US5); Ustawienie budżetu per kategoria (US6); Monitorowanie stanu budżetu (US7); Analiza udziału osób (US8); Dodanie zaległego wydatku w dopuszczalnym zakresie dat (US9); Przegląd historycznych miesięcy (US10); Korekta limitów w trakcie miesiąca (US11). Flow’y: onboarding (ustawienie limitów → pierwszy wydatek), ręczne dodawanie, import, edycja limitów, przegląd historii.
C. Kryteria sukcesu i pomiar: 90% trafność AI (metryka: procent wydatków zaakceptowanych bez korekty); czas pełnego miesięcznego uzupełnienia przy użyciu CSV < 10 minut; 100% detekcji duplikatów przy identycznym zestawie pól; czas ładowania PWA < 3s (instrumentacja performance); czas odpowiedzi API AI < 2s (logowanie metryk); onboarding: pierwszy wydatek dodany < 2 min (czas od pierwszego zalogowania do zapisu pierwszego wydatku); czytelność wykresu oceniana >4/5 (badanie jakościowe); subiektywna oszczędność czasu potwierdzona w ankiecie użytkowników. Dodatkowe operacyjne: logowanie korekt dla analizy accuracy trendu.
D. Nierozwiązane lub doprecyzowania (poniżej) wskazują obszary do zamknięcia przed finalnym PRD.
E. Architektura: Astro SSR + React dla interaktywnych komponentów; Supabase (Auth, DB); modele: Users, Transactions (z import_hash), Budget, TransactionTypes (enum lub tabela). Fallback logic i retry polityka dla AI jasno zdefiniowana.
F. Zakres i granice: Brak integracji z bankowym API (tylko ręczny CSV); brak zaawansowanych raportów; brak eksportu/backup w MVP; brak wielowalutowości; brak powiadomień progowych (post-MVP); brak rozbudowanych ról uprawnień (wszyscy pełne prawa); brak formalnego systemu ryzyk (na ten moment).
G. Mechanizmy jakości: Walidacja zakresu dat; duplikaty przy imporcie; kolorystyczne progi (<80%, 80-100%, >100%). Fallback ścieżka przy błędzie AI zapewnia ciągłość dodawania wydatków.
</prd_planning_summary>
<unresolved_issues>
Dokładne parametry CSV (separator, encoding, format daty, separator dziesiętny) - oczekuje na próbkę.
Nazwa aplikacji i branding (wymagane dla domeny i konfiguracji OAuth).
Walidacja pola kwota: minimalna/maksymalna wartość, obsługa ujemnych (zwroty) lub 0.
Strefa czasowa (ustalenie jednej referencyjnej dla dat i granic miesięcy).
Czy rejestrować korekty AI w MVP (obecnie niepewne vs potrzebne do poprawy modelu).
Sposób prezentacji confidence (konkretne progi procentowe lub skala) - wymaga doprecyzowania.
Obsługa zwrotów/refundów (osobna kategoria vs ujemne wartości) - brak decyzji.
Polityka błędów przy imporcie częściowo niepoprawnych wierszy (skip vs blokada całości).
</unresolved_issues>
</conversation_summary>
</project_details>

*Odpowiedź przygotuj w języku polskim.*

Wykonaj następujące kroki, aby stworzyć kompleksowy i dobrze zorganizowany dokument:

1. Podziel PRD na następujące sekcje:
   a. Przegląd projektu
   b. Problem użytkownika
   c. Wymagania funkcjonalne
   d. Granice projektu
   e. Historie użytkownika
   f. Metryki sukcesu

2. W każdej sekcji należy podać szczegółowe i istotne informacje w oparciu o opis projektu i odpowiedzi na pytania wyjaśniające. Upewnij się, że:
    - Używasz jasnego i zwięzłego języka
    - W razie potrzeby podajesz konkretne szczegóły i dane
    - Zachowujesz spójność w całym dokumencie
    - Odnosisz się do wszystkich punktów wymienionych w każdej sekcji

3. Podczas tworzenia historyjek użytkownika i kryteriów akceptacji
    - Wymień WSZYSTKIE niezbędne historyjki użytkownika, w tym scenariusze podstawowe, alternatywne i skrajne.
    - Przypisz unikalny identyfikator wymagań (np. US-001) do każdej historyjki użytkownika w celu bezpośredniej identyfikowalności.
    - Uwzględnij co najmniej jedną historię użytkownika specjalnie dla bezpiecznego dostępu lub uwierzytelniania, jeśli aplikacja wymaga identyfikacji użytkownika lub ograniczeń dostępu.
    - Upewnij się, że żadna potencjalna interakcja użytkownika nie została pominięta.
    - Upewnij się, że każda historia użytkownika jest testowalna.

Użyj następującej struktury dla każdej historii użytkownika:
- ID
- Tytuł
- Opis
- Kryteria akceptacji

4. Po ukończeniu PRD przejrzyj go pod kątem tej listy kontrolnej:
    - Czy każdą historię użytkownika można przetestować?
    - Czy kryteria akceptacji są jasne i konkretne?
    - Czy mamy wystarczająco dużo historyjek użytkownika, aby zbudować w pełni funkcjonalną aplikację?
    - Czy uwzględniliśmy wymagania dotyczące uwierzytelniania i autoryzacji (jeśli dotyczy)?

5. Formatowanie PRD:
    - Zachowaj spójne formatowanie i numerację.
    - Nie używaj pogrubionego formatowania w markdown ( ** ).
    - Wymień WSZYSTKIE historyjki użytkownika.
    - Sformatuj PRD w poprawnym markdown.

Przygotuj PRD z następującą strukturą:

```markdown
# Dokument wymagań produktu (PRD) - {{app-name}}
## 1. Przegląd produktu
## 2. Problem użytkownika
## 3. Wymagania funkcjonalne
## 4. Granice produktu
## 5. Historyjki użytkowników
## 6. Metryki sukcesu
```

Pamiętaj, aby wypełnić każdą sekcję szczegółowymi, istotnymi informacjami w oparciu o opis projektu i nasze pytania wyjaśniające. Upewnij się, że PRD jest wyczerpujący, jasny i zawiera wszystkie istotne informacje potrzebne do dalszej pracy nad produktem.

Ostateczny wynik powinien składać się wyłącznie z PRD zgodnego ze wskazanym formatem w markdown, który zapiszesz w pliku .ai/prd.md