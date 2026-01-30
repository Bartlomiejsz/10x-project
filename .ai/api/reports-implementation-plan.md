1) Kluczowe punkty specyfikacji API
- Endpoint: GET /api/reports/monthly?month=YYYY-MM
- Cel: zwrócić zagregowane wydatki per kategoria (type_id) dla całego gospodarstwa domowego (wszystkie transakcje) i porównać je z budżetami na dany miesiąc.
- Odpowiedź: MonthlyReportDTO
  - month: YYYY-MM
  - summary[]: { type_id, type_name, budget: number|null, spend: number, transactions_count: number, shares: [ { user_id: string, spend: number, transactions_count: number } ] }
  - totals: { budget: number, spend: number }
- Implementacja: agregacje w DB grupowane po `type_id` oraz dodatkowe agregacje per (`type_id`, `user_id`) do zasilenia `summary[].shares`. Join do `transaction_types` (nazwa) i left join do `budgets` (month_date=YYYY-MM-01).

2) Parametry (wymagane/opcjonalne)
- Query:
  - wymagane: month (format YYYY-MM)
  - opcjonalne: brak
- Body: brak
- Auth: wymagany (Supabase session). Endpoint nie przyjmuje user_id jako parametru; raport obejmuje całość danych.

3) Niezbędne typy DTO/Command
- DTO (docelowo w src/types.ts):
  - MonthlyReportDTO
  - MonthlyReportItemDTO (rozszerzony o shares)
  - MonthlyReportShareDTO (NOWE) — udział per user w ramach kategorii
- Command modele: brak (GET).
- Warto dodać typy pomocnicze dla warstwy serwisowej (nie eksportowane publicznie): np. MonthlyReportSummaryRow, MonthlyReportShareRow.

4) Ekstrakcja logiki do service
- Wykorzystać istniejący serwis lub utworzyć: src/lib/services/reports.service.ts
  - metoda: getMonthlyReport(month: string, supabase: SupabaseClient): Promise<MonthlyReportDTO>
  - odpowiedzialność: policzyć zakres dat, wykonać agregacje (summary + shares per kategoria), zmapować typy/liczby, policzyć totals.
- Route ma być cienka: auth + walidacja + wywołanie serwisu + mapowanie błędów do JSON.

5) Walidacja danych wejściowych (Zod)
- Utworzyć schema: src/lib/schemas/reports.schema.ts
  - MonthlyReportQuerySchema: { month: MonthStringSchema }
  - MonthStringSchema: regex ^\d{4}-(0[1-9]|1[0-2])$ + opis błędu
- W route: parse query poprzez Object.fromEntries(url.searchParams.entries()) i .parse()

6) Rejestrowanie błędów w tabeli błędów
- W repo jest src/lib/errors.ts (klasy błędów), brak integracji z "tabelą błędów".
- Plan: logowanie do stderr przez console.error (jak w istniejących endpointach), z prefiksem zakresu.

7) Potencjalne zagrożenia bezpieczeństwa
- Ryzyko ujawnienia danych: endpoint zwraca agregaty dla wszystkich użytkowników gospodarstwa.
  - Wymagane jest jawne założenie productowe: każdy zalogowany użytkownik ma prawo oglądać całość transakcji.
  - Jeśli nie, trzeba wprowadzić model gospodarstwa (household_id) i ograniczyć dostęp.
- Injection/abuse przez month: walidacja Zod + stały format dat.
- DoS przez ciężkie zapytania: indeksy, zakres dat, brak parametrów typu limit.

8) Scenariusze błędów + statusy
- 200: poprawny odczyt
- 400: niepoprawny query param month (ZodError)
- 401: brak sesji / usera (UnauthorizedError)
- 404: raczej nie dotyczy (raport jest zasobem wyliczanym; brak danych = pusty summary i totals=0)
- 500: błąd Supabase/PostgREST/RPC lub nieoczekiwany wyjątek
</analysis>

# API Endpoint Implementation Plan: GET `/api/reports/monthly`

## 1. Przegląd punktu końcowego
Endpoint zwraca miesięczny raport wydatków dla gospodarstwa domowego: agreguje **wszystkie** transakcje w zadanym miesiącu per kategoria (`type_id`), dołącza nazwę kategorii z `transaction_types` oraz budżet z `budgets` dla `month_date = YYYY-MM-01`.

Kluczowa różnica w tym wariancie: **podział wydatków per użytkownik (`shares`) jest zwracany w ramach każdej kategorii** (`summary[].shares`).

**Ważne założenie (jawne w implementacji):** aplikacja jest współdzielona przez gospodarstwo domowe, więc każdy zalogowany użytkownik widzi dane zagregowane wszystkich użytkowników.

**Ważne założenie (do potwierdzenia):** czy raport ma obejmować kategorie:
- A) wyłącznie te, które mają transakcje w miesiącu (naturalny efekt agregacji po `transactions`) **lub**
- B) także te z budżetem mimo braku transakcji (wtedy potrzebne jest bazowanie na `budgets`/`transaction_types` i left join do `transactions`).

Rekomendacja dla UI dashboardu: **B** (kategorie z budżetem są istotne nawet przy 0 wydatków). Jeśli nie chcemy zmieniać zakresu na starcie, zacznijmy od **A** i dopiszmy rozszerzenie jako kolejny krok.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- URL: `/api/reports/monthly`
- Query params:
  - Wymagane:
    - `month: string` — format `YYYY-MM` (np. `2025-10`)
  - Opcjonalne: brak
- Request Body: brak
- Uwierzytelnianie:
  - Wymagane: aktywna sesja Supabase
  - Route używa `requireUser({ locals })`.
- Autoryzacja:
  - Endpoint **nie** filtruje po `user_id` i obejmuje wszystkie transakcje.
  - Jeśli w przyszłości pojawi się wymóg izolacji danych, należy wprowadzić koncept `household_id`/`group_id` i filtrować po nim.

## 3. Szczegóły odpowiedzi
### 200 OK
Zwracamy obiekt zgodny z kontraktem, gdzie `shares` są w `summary[]`:

```json
{
  "month": "YYYY-MM",
  "summary": [
    {
      "type_id": 1,
      "type_name": "Food",
      "budget": 1200,
      "spend": 958.5,
      "transactions_count": 42,
      "shares": [
        {
          "user_id": "00000000-0000-0000-0000-000000000000",
          "spend": 500.0,
          "transactions_count": 20
        }
      ]
    }
  ],
  "totals": { "budget": 1200, "spend": 958.5 }
}
```

Semantyka pól:
- `summary[].budget`: `number | null` (brak budżetu dla kategorii w danym miesiącu → `null`)
- `summary[].spend`: suma `transactions.amount` dla kategorii w miesiącu
- `summary[].transactions_count`: liczba transakcji dla kategorii w miesiącu
- `summary[].shares[]`: udział wydatków per `user_id` w ramach danej kategorii (suma i liczba transakcji)

Edge case:
- Jeśli w danej kategorii w miesiącu są transakcje, ale wszystkie od jednego użytkownika → `shares` ma 1 element.
- Jeśli raport uwzględnia kategorie z budżetem, ale bez transakcji (wariant B) → rekomendacja: `spend=0`, `transactions_count=0`, `shares=[]`.

## 3. Wykorzystywane typy
### DTO (w `src/types.ts`)
- `MonthlyReportDTO`:
  - `month: string`
  - `summary: MonthlyReportItemDTO[]`
  - `totals: { budget: number; spend: number }`
- `MonthlyReportItemDTO` (wymaga aktualizacji):
  - `type_id: number`
  - `type_name: string`
  - `budget: number | null`
  - `spend: number`
  - `transactions_count: number`
  - `shares: MonthlyReportShareDTO[]` (NOWE na poziomie itemu)
- `MonthlyReportShareDTO` (NOWE):
  - `user_id: string`
  - `spend: number`
  - `transactions_count: number`

### Schematy walidacji (Zod)
- `MonthlyReportQuerySchema` (nowe) — walidacja query param `month`

### Typy pomocnicze (wewnętrzne w serwisie)
- `MonthlyReportSummaryRow`
- `MonthlyReportShareRow` (musi zawierać również `type_id`, aby dało się przypisać shares do summary)

Uwaga o typach liczbowych: PostgREST/Supabase dla `NUMERIC` często zwraca `string` → potrzebna kontrolowana konwersja do `number`.

## 4. Przepływ danych
### 4.1. Warstwa route (Astro)
1. `GET` handler w `src/pages/api/reports/monthly.ts`.
2. Guard: `export const prerender = false`.
3. Auth: `await requireUser({ locals })`.
4. Parsowanie query:
   - `const url = new URL(request.url)`
   - `const queryParams = Object.fromEntries(url.searchParams.entries())`
5. Walidacja wejścia:
   - `const { month } = MonthlyReportQuerySchema.parse(queryParams)`
6. Wywołanie serwisu:
   - `const result = await reportsService.getMonthlyReport(month, locals.supabase)`
7. Zwrócenie wyniku:
   - `return jsonResponse(result, 200)`

### 4.2. Warstwa serwisu (agregacja)
W `src/lib/services/reports.service.ts`:
1. Wylicz zakres miesiąca:
   - `startDate = `${month}-01``
   - `nextMonthStartDate = pierwszy dzień następnego miesiąca`
   - Filtr: `date >= startDate AND date < nextMonthStartDate` (zakres półotwarty)
2. Pobierz dane zagregowane per `type_id` do `summary`:
   - join do `transaction_types` → `type_name`
   - left join do `budgets` (`month_date = startDate` i `type_id`) → `budget`
3. Pobierz dane zagregowane per (`type_id`, `user_id`) do `sharesRows`:
   - grupowanie po `transactions.type_id`, `transactions.user_id`
   - pola: `type_id`, `user_id`, `spend`, `transactions_count`
4. Zbuduj mapę `type_id -> shares[]`:
   - np. przez `Map<number, MonthlyReportShareDTO[]>`
5. Połącz dane:
   - dla każdego elementu `summary` przypisz `shares = map.get(type_id) ?? []`
6. Zmapuj i znormalizuj typy:
   - konwersja NUMERIC/string → number
   - brakujące wartości → `0` lub `null` zgodnie z kontraktem
7. Policz `totals`:
   - `totals.spend = sum(summary[].spend)`
   - `totals.budget = sum(summary[].budget ?? 0)`
8. Zwróć `MonthlyReportDTO`.

### 4.3. Implementacja zapytania: rekomendowana opcja
**Preferowana opcja: 2x RPC w Postgres**
- `monthly_report_summary(p_month_date date)` → rows per `type_id`
- `monthly_report_shares(p_month_date date)` → rows per (`type_id`, `user_id`)

Alternatywa: dwa zapytania PostgREST (agregacje), ale RPC daje lepszą kontrolę i stabilność.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie:** zawsze `requireUser`.
- **Model dostępu:** endpoint celowo udostępnia dane zagregowane wszystkich użytkowników.
- **Walidacja inputu:** `month` tylko w formacie `YYYY-MM`.
- **Minimalizacja danych:** brak szczegółów transakcji; tylko agregaty.

## 6. Obsługa błędów
Utrzymujemy wzorzec jak w istniejących endpointach (np. `src/pages/api/transactions.ts`).

### Mapowanie błędów (route)
- `UnauthorizedError` → `401` + `jsonError(401, 'UNAUTHORIZED', error.message)`
- `z.ZodError` → `400` + `jsonError(400, 'VALIDATION_ERROR', 'Invalid query parameters', error.flatten().fieldErrors)`
- Inne (Supabase error / nieoczekiwany wyjątek) →
  - log: `console.error('[GET /api/reports/monthly] Unexpected error:', error)`
  - response: `500` + `jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred')`

### Scenariusze
- `month` nie pasuje do `YYYY-MM` → `400`
- Brak sesji → `401`
- Błąd DB/Supabase (timeout, brak uprawnień, błąd RPC) → `500`
- Brak danych w miesiącu → `200` z `summary: []`, `totals: { budget: 0, spend: 0 }`

## 7. Wydajność
- **Zakres dat półotwarty** (`>= start` oraz `< nextMonthStart`) pomaga indeksowaniu.
- **Agregacja w DB** minimalizuje transfer danych.
- **Indeksy:**
  - `idx_transactions_date_type (date, type_id)` przyspieszy summary.
  - Dla shares per (`type_id`, `user_id`) w zakresie miesiąca:
    - obecny `idx_transactions_type (type_id)` i `idx_transactions_user_date (user_id, date)` mogą częściowo pomóc, ale nie idealnie.
    - jeśli wolumen wzrośnie, rozważyć indeks pokrywający pod raporty, np. `(date, type_id, user_id)`.
- **Liczba zapytań:** 2 agregacje (summary + sharesRows).

## 8. Kroki implementacji
1. **Zaktualizuj typy współdzielone (DTO)**
   - Plik: `src/types.ts`
   - Dodaj `MonthlyReportShareDTO`.
   - Zaktualizuj `MonthlyReportItemDTO`, dodając `shares: MonthlyReportShareDTO[]`.
   - Upewnij się, że `MonthlyReportDTO` nie ma już pola `shares` na root.
2. **Utwórz schemat walidacji query**
   - Plik: `src/lib/schemas/reports.schema.ts`
   - Dodaj `MonthStringSchema` (regex YYYY-MM) i `MonthlyReportQuerySchema`.
3. **Utwórz / zaktualizuj serwis raportów**
   - Plik: `src/lib/services/reports.service.ts`
   - Implementuj:
     - `getMonthlyReport(month, supabase)`
     - helper do wyliczania `nextMonthStartDate`
     - pobranie `summary` (agregacja po type_id)
     - pobranie `sharesRows` (agregacja po type_id + user_id)
     - zbudowanie mapy type_id → shares[]
     - scalenie danych w `summary[]`
     - mapowanie NUMERIC/string → number (z walidacją `Number.isFinite`)
     - wyliczenie totals
   - Loguj błędy DB w serwisie: `console.error('[ReportsService.getMonthlyReport] Database error:', error)`.
4. **Utwórz route Astro API**
   - Plik: `src/pages/api/reports/monthly.ts`
   - Implementuj:
     - `export const prerender = false`
     - auth + Zod + serwis + `jsonResponse`
     - mapowanie błędów do 400/401/500
5. **(Rekomendowane) Dodaj SQL RPC dla raportu**
   - Nowa migracja w `supabase/migrations/`.
   - Funkcje:
     - `monthly_report_summary(p_month_date date)` → `type_id`, `type_name`, `budget`, `spend`, `transactions_count`
     - `monthly_report_shares(p_month_date date)` → `type_id`, `user_id`, `spend`, `transactions_count`
   - Upewnij się, że funkcje działają z RLS.
6. **Testy / walidacja lokalna**
   - Dymny test endpointu: poprawny `month`, błędny `month`, brak danych.
7. **Code review checklist**
   - Czy `shares` są w `summary[]`, a nie na root?
   - Czy w zapytaniach **nie ma** filtra po `user_id`?
   - Czy `month` jest walidowany?
   - Czy `numeric` jest konwertowany do `number` i czy nie generuje `NaN`?
   - Czy brak danych zwraca 200 z pustym raportem?
