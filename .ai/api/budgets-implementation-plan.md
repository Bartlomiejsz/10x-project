# API Endpoint Implementation Plan: Budgets (miesięczny planowany budżet per kategoria)

> Zasób: `budgets` — budżet miesięczny per kategoria.
> Klucz główny kompozytowy: `(month_date, type_id)` gdzie `month_date` jest zawsze pierwszym dniem miesiąca (`YYYY-MM-01`).
>
> Decyzje projektowe (zgodne z Twoimi odpowiedziami):
> - Budżety są **globalne** dla całego systemu (bez RLS / bez powiązania z user_id).
> - `GET /api/budgets` domyślnie zwraca **bieżący miesiąc**, ale pozwala filtrować innym miesiącem.
> - Upsert jest realizowany przez `POST /api/budgets`.

---

## 1. Przegląd punktu końcowego

Celem jest wdrożenie kompletnego REST API dla tabeli `budgets`:

- listowanie budżetów (z filtrami: miesiąc, kategoria)
- pobieranie pojedynczego budżetu po kluczu kompozytowym
- tworzenie lub upsert budżetu
- aktualizacja kwoty budżetu
- usuwanie budżetu

Wdrożenie ma być spójne z istniejącymi endpointami w repozytorium (Astro `APIRoute`, walidacja `zod`, serwisy w `src/lib/services`, autoryzacja przez `requireUser`, odpowiedzi przez `jsonResponse/jsonError`, mapowanie błędów wg `src/lib/errors.ts`).

---

## 2. Szczegóły żądania

### 2.1 GET `/api/budgets`

- Metoda HTTP: `GET`
- Struktura URL: `/api/budgets`
- Autoryzacja: wymagana (`requireUser`) — mimo globalności zasobu (gate)

**Query params**
- Opcjonalne:
  - `month` — `YYYY-MM` (np. `2026-01`)
  - `month_date` — `YYYY-MM-01` (np. `2026-01-01`)
  - `type_id` — `int`
  - `order` — np. `month_date.desc` (w praktyce wspieramy ograniczony enum)

**Zasady domyślne**
- Jeśli brak `month` i `month_date`: filtruj po **bieżącym miesiącu** (UTC), tj. `YYYY-MM-01`.
- Jeśli podano `month`: znormalizuj do `month_date = ${month}-01`.
- Jeśli podano `month_date`: znormalizuj do pierwszego dnia miesiąca (`YYYY-MM-01`).

---

### 2.2 GET `/api/budgets/:month_date/:type_id`

- Metoda HTTP: `GET`
- Struktura URL: `/api/budgets/{month_date}/{type_id}`
- Autoryzacja: wymagana (`requireUser`)

**Path params**
- Wymagane:
  - `month_date` — `YYYY-MM-01` (lub data w miesiącu → normalizacja do `YYYY-MM-01`)
  - `type_id` — `int` dodatni

---

### 2.3 POST `/api/budgets` (create/upsert)

- Metoda HTTP: `POST`
- Struktura URL: `/api/budgets`
- Autoryzacja: wymagana (`requireUser`)

**Request body**
```json
{ "month_date": "YYYY-MM-01", "type_id": 1, "amount": 123.45 }
```

**Reguły walidacji**
- `month_date` musi wskazywać pierwszy dzień miesiąca (`YYYY-MM-01`), a serwer ma normalizować
- `amount` numeric `>= 0` oraz `< 1000000000`
- `type_id` musi istnieć w `transaction_types`

**Odpowiedź**
- `201 Created` gdy rekord utworzono
- `200 OK` gdy rekord istniał i został zaktualizowany (upsert)

Uwaga: rozróżnienie 200/201 wymaga detekcji „czy był insert czy update” (szczegóły w sekcji implementacji).

---

### 2.4 PUT `/api/budgets/:month_date/:type_id` (update/replace)

- Metoda HTTP: `PUT`
- Struktura URL: `/api/budgets/{month_date}/{type_id}`
- Autoryzacja: wymagana (`requireUser`)

**Request body**
```json
{ "amount": 100 }
```

**Semantyka**
- Aktualizuje `amount` istniejącego rekordu.
- Jeśli rekord nie istnieje → `404 Not Found` (wymuszamy użycie `POST` dla create/upsert).

---

### 2.5 DELETE `/api/budgets/:month_date/:type_id`

- Metoda HTTP: `DELETE`
- Struktura URL: `/api/budgets/{month_date}/{type_id}`
- Autoryzacja: wymagana (`requireUser`)

**Semantyka**
- Usuwa rekord.
- Jeśli rekord nie istnieje → `404 Not Found`.
- Jeśli usunięto → `204 No Content` (zgodnie ze specyfikacją route).

---

## 3. Wykorzystywane typy

### 3.1 Istniejące typy (już w repo)
W `src/types.ts` już są:
- `BudgetDTO`
- `CreateBudgetCommand`
- `UpdateBudgetCommand`
- `BudgetFilters`

To wystarcza dla kontraktu API.

### 3.2 Dodatkowe typy (opcjonalne, ale zalecane)
Aby czytelnie mapować odpowiedzi listowania (zgodnie ze specyfikacją route):
- `BudgetsListResponse = { data: BudgetDTO[] }`

Jeśli frontend już oczekuje innego kształtu, dostosować do aktualnych fetcherów. W specyfikacji response dla `GET /api/budgets` jest wrapper `{ data: [...] }`.

---

## 4. Przepływ danych

### 4.1 Warstwy i odpowiedzialności

1) **Route handler** (`src/pages/api/...`)
- egzekwuje autoryzację (`requireUser`)
- parsuje i waliduje dane wejściowe przez Zod
- mapuje wyjątki / błędy do `jsonError`
- deleguje logikę do serwisu

2) **Service** (`src/lib/services/budgets.service.ts`)
- wykonuje zapytania do Supabase/PostgREST
- stosuje walidacje semantyczne (np. istnienie `type_id` w DB)
- centralizuje logowanie błędów DB
- implementuje upsert / update / delete, mapuje “not found” na `NotFoundError`

3) **DB** (Postgres przez Supabase)
- FK `budgets.type_id -> transaction_types.id` wymusza spójność
- CHECK na `amount` (>=0 i <1e9) wymusza constraints
- trigger `updated_at`

### 4.2 Normalizacja `month_date`

**Kontrakt**: niezależnie od tego, czy klient poda `YYYY-MM` (query), `YYYY-MM-01`, czy nawet `YYYY-MM-DD`, system ma operować na canonical `YYYY-MM-01`.

Reguły:
- jeśli `month` → `month_date = ${month}-01`
- jeśli `month_date` → sprawdź poprawność daty i ustaw dzień na `01`

Ważne: normalizacja powinna dziać się **przed** zapytaniami DB, żeby klucz kompozytowy był spójny.

### 4.3 Domyślny miesiąc

Dla `GET /api/budgets`:
- jeżeli brak `month` i `month_date`, ustaw domyślnie bieżący miesiąc (UTC).
- definicja “bieżącego miesiąca”: `new Date()` → wyliczenie `YYYY-MM-01` (UTC) żeby uniknąć różnic stref.

---

## 5. Względy bezpieczeństwa

### 5.1 Uwierzytelnianie
- Wszystkie endpointy `/api/budgets...` wymagają `requireUser`.
- Pomimo globalności budżetów, gate auth to minimalna ochrona przed anonimowym spamem/odczytem.

### 5.2 Autoryzacja (brak RLS)
- Skoro `budgets` są globalne i nie planujemy RLS, to jedyna kontrola to “czy user jest zalogowany”.
- Ryzyko: dowolny zalogowany user może modyfikować budżety globalne.

**Mitigacje (rekomendacje)**
- (Opcja A) Dodać rolę “admin” w przyszłości i ograniczyć `POST/PUT/DELETE`.
- (Opcja B) Przenieść writes na serwis server-side z dodatkową kontrolą (np. allowlist user IDs).

### 5.3 Walidacja wejścia (ochrona przed nadużyciami)
- Zod po stronie route:
  - ogranicza format dat i typy
  - ogranicza `order` do whitelisty
  - ogranicza zakres `amount`
- Service robi dodatkową walidację istnienia `type_id`.

### 5.4 Iniekcje / abuse
- `order` nie może być dowolnym stringiem → tylko enum (np. `month_date.asc|desc`, `type_id.asc|desc`, `created_at.asc|desc`).
- Brak interpolacji surowych wartości w SQL (używamy supabase query builder).

---

## 6. Obsługa błędów

### 6.1 Ustandaryzowane odpowiedzi błędów
Używamy `jsonError(status, code, message, details?)`.

### 6.2 Mapowanie błędów → status code

| Scenariusz | Status | code | Uwagi |
|---|---:|---|---|
| Brak sesji / user | 401 | `UNAUTHORIZED` | `requireUser` rzuca `UnauthorizedError` |
| Błędny query/body/params (Zod) | 400 | `VALIDATION_ERROR` | `error.flatten().fieldErrors` |
| `type_id` nie istnieje w `transaction_types` | 400 | `VALIDATION_ERROR` | komunikat: „Unknown transaction type” |
| Budżet nie istnieje (GET by key, PUT, DELETE) | 404 | `NOT_FOUND` | `NotFoundError` lub `PGRST116` |
| Konflikt (rzadkie) | 409 | `CONFLICT` | np. jeśli wybierzemy PUT create-if-missing i constraint fail; standardowo niepotrzebne |
| Nieoczekiwany błąd DB/serwera | 500 | `INTERNAL_ERROR` | log `console.error` |

### 6.3 Rejestrowanie błędów w tabeli błędów
W repo nie widać obecnie “tabeli błędów” ani helpera do logowania do DB; aktualny standard to `console.error` w route i czasem w serwisach.

Plan:
- utrzymujemy spójność: logujemy do `console.error` z tagiem endpointu
- opcjonalnie: dodać w przyszłości centralny logger i/lub persystencję (poza zakresem tego endpointu)

---

## 7. Wydajność

- `GET /api/budgets` domyślnie filtruje po jednym miesiącu, więc dataset jest mały (max ~11 kategorii).
- Indeks/PK na `(month_date, type_id)` zapewnia szybkie lookupy.
- Walidacja istnienia `type_id`:
  - 1 dodatkowe zapytanie `transaction_types` przy POST/PUT.
  - Alternatywnie polegać tylko na FK i mapować błąd FK → 400, ale wtedy komunikat jest gorszy.

Opcjonalne mikrooptymalizacje:
- przy `POST` można nie sprawdzać istnienia `type_id` jeśli i tak łapiemy FK violation i mapujemy ją na 400; ale to wymaga pewnego mapowania kodów błędu supabase.

---

## 8. Kroki implementacji

> Poniżej plan zmian w kodzie z konkretnymi plikami oraz kontraktami.

### 8.1 Dodać schematy Zod: `src/lib/schemas/budgets.schema.ts`

**Cele**
- jedna prawda o walidacji i normalizacji `month/month_date`
- whitelist dla `order`

**Schematy (propozycja)**
1) `MonthStringSchema` – można zre-użyć z `reports.schema.ts` przez import, albo skopiować (prefer: re-use).
2) `BudgetMonthDateSchema`:
- input: string
- validate: `YYYY-MM-DD` (regex) + poprawność daty
- transform: canonical `YYYY-MM-01` (pierwszy dzień miesiąca)

3) `BudgetKeyParamsSchema`:
- `{ month_date: BudgetMonthDateSchema, type_id: z.string()...transform(parseInt)...refine(>0) }`

4) `BudgetsListQuerySchema`:
- `{ month?: MonthStringSchema, month_date?: BudgetMonthDateSchema, type_id?: coerceOptionalInt(), order?: enum([...]).default('type_id.asc') }`
- `.superRefine`: nie pozwól podać naraz `month` i `month_date` (albo zdefiniuj priorytet; prefer: 400).

5) `CreateBudgetSchema`:
- `{ month_date: BudgetMonthDateSchema, type_id: z.number().int().positive(), amount: z.number().finite().min(0).lt(1_000_000_000) }`

6) `UpdateBudgetSchema`:
- `{ amount: z.number().finite().min(0).lt(1_000_000_000) }`

**Edge cases**
- `month_date` typu `2025-02-31` ma być odrzucone.
- `month_date` z dniem != `01`: ma być znormalizowane do `01`.

---

### 8.2 Dodać serwis: `src/lib/services/budgets.service.ts`

**Kontrakt metod (propozycja)**
- `listBudgets(filters: BudgetFilters & { month_date?: string }, supabase): Promise<{ data: BudgetDTO[] }>`
- `getBudget(key: { month_date: string; type_id: number }, supabase): Promise<BudgetDTO>`
- `upsertBudget(cmd: CreateBudgetCommand, supabase): Promise<{ data: BudgetDTO; created: boolean }>`
- `updateBudget(key, cmd: UpdateBudgetCommand, supabase): Promise<BudgetDTO>`
- `deleteBudget(key, supabase): Promise<void>`

**Implementacyjne szczegóły**
1) **Sprawdzenie `type_id` istnieje**
- private helper `assertTransactionTypeExists(typeId)`
- query: `supabase.from('transaction_types').select('id').eq('id', typeId).maybeSingle()`
- jeśli brak → rzucić `ValidationError('Unknown transaction type')`

2) **Listowanie**
- base: `supabase.from('budgets').select('*')`
- filtry:
  - jeśli `month_date` ustawione → `.eq('month_date', month_date)`
  - jeśli `type_id` → `.eq('type_id', type_id)`
- sort:
  - parse `order` na `[field, direction]` i `.order(field, { ascending })`
  - field z whitelisty

3) **Get by composite key**
- `.eq('month_date', month_date).eq('type_id', type_id).single()`
- jeśli `PGRST116` lub `!data` → `NotFoundError('Budget not found')`

4) **Upsert**
- `insert(...).select('*').single()` z `upsert`:
  - Supabase JS: `.upsert(row, { onConflict: 'month_date,type_id' })`
- Detekcja created vs updated:
  - (najprościej) zrobić pre-check `.select('month_date').eq(...).maybeSingle()` i na tej podstawie zwrócić `created`.
  - ryzyko race-condition jest akceptowalne (globalne i niski ruch). Jeśli chcemy być perfekcyjni: zrobić RPC lub użyć `Prefer: resolution=merge-duplicates, return=representation` + analiza statusu (zwykle niedostępne w fetch wrapperze).

5) **PUT update**
- najpierw sprawdzić istnienie (get lub `update...select...single()` i obsłużyć `PGRST116` jako 404)
- `.update({ amount }).eq('month_date', ...).eq('type_id', ...)`

6) **DELETE**
- `.delete().eq('month_date', ...).eq('type_id', ...)`
- żeby móc zwrócić 404, potrzebujemy wiedzieć czy cokolwiek usunięto:
  - opcja A: `select` przed `delete` (proste)
  - opcja B: `delete().select('month_date')` i sprawdzić czy `data` puste

---

### 8.3 Dodać endpoint list/upsert: `src/pages/api/budgets.ts`

**GET**
- `await requireUser({ locals })`
- `const queryParams = Object.fromEntries(new URL(request.url).searchParams.entries())`
- `const filters = BudgetsListQuerySchema.parse(queryParams)`
- wylicz canonical `month_date`:
  - jeśli `filters.month_date` → użyj
  - else if `filters.month` → `${filters.month}-01`
  - else → bieżący miesiąc UTC (helper `getCurrentMonthDateUtc()`)
- `const result = await budgetsService.listBudgets({ ...filters, month_date }, locals.supabase)`
- response: `jsonResponse(result, 200)` (czyli `{ data: [...] }`)

**POST**
- `await requireUser({ locals })`
- parse JSON body (guard: invalid json → 400)
- `const command = CreateBudgetSchema.parse(body)`
- `const { data, created } = await budgetsService.upsertBudget(command, locals.supabase)`
- status: `created ? 201 : 200`
- response: `jsonResponse(data, status)`

**Obsługa błędów**
- jak w `transactions.ts`:
  - `UnauthorizedError` → 401
  - `z.ZodError` → 400
  - `ValidationError` → 400
  - fallback → 500 + `console.error('[GET|POST /api/budgets] Unexpected error:', error)`

---

### 8.4 Dodać endpoint by key: `src/pages/api/budgets/[month_date]/[type_id].ts`

**GET**
- parse params przez `parseParam(BudgetKeyParamsSchema, params, { message: 'Invalid budget key' })`
- `await requireUser`
- `budgetsService.getBudget(key, locals.supabase)`
- 200

**PUT**
- parse params
- `await requireUser`
- parse JSON body (guard)
- `const command = UpdateBudgetSchema.parse(body)`
- `const updated = await budgetsService.updateBudget(key, command, locals.supabase)`
- 200

**DELETE**
- parse params
- `await requireUser`
- `await budgetsService.deleteBudget(key, locals.supabase)`
- return `new Response(null, { status: 204 })`

**Obsługa błędów**
- analogiczna do innych endpointów

---

### 8.5 Dodać helper do daty bieżącego miesiąca (opcjonalnie)

Aby uniknąć duplikacji, można dodać funkcję w `src/lib/month.ts` (już istnieje w repo) lub w nowym helperze pod `src/lib`.

Proponowany kontrakt:
- `getCurrentMonthDateUtc(): string` → `YYYY-MM-01`

Ważne: stosować UTC.

---

### 8.6 Testy / weryfikacja (minimum)

Repo nie pokazuje frameworka testowego. Minimalny, praktyczny plan weryfikacji:

1) **Typecheck / lint**
- uruchomić `pnpm lint` / `npm run lint` i `pnpm typecheck` / `npm run typecheck` (zgodnie z `package.json`).

2) **Smoke test endpointów**
- uruchomić dev server
- wykonać żądania:
  - `GET /api/budgets` bez query → powinien zwrócić bieżący miesiąc
  - `GET /api/budgets?month=2026-01`
  - `POST /api/budgets` (create) → 201
  - `POST /api/budgets` (repeat, update) → 200
  - `GET /api/budgets/2026-01-01/1`
  - `PUT /api/budgets/2026-01-01/1` → 200
  - `DELETE /api/budgets/2026-01-01/1` → 204

3) **Edge cases**
- `POST amount = -1` → 400
- `POST amount = 1000000000` → 400
- `POST month_date = 2026-13-01` → 400
- `POST type_id = 999999` → 400
- `GET by key` nieistniejący → 404

---

### 8.7 Checklist wdrożeniowy (pod PR)

- [ ] `src/lib/schemas/budgets.schema.ts` dodany + pokrywa wszystkie wejścia (query/body/params)
- [ ] `src/lib/services/budgets.service.ts` dodany + obsługa PGRST116
- [ ] `src/pages/api/budgets.ts` dodany (GET/POST)
- [ ] `src/pages/api/budgets/[month_date]/[type_id].ts` dodany (GET/PUT/DELETE)
- [ ] status codes zgodne ze spec (200/201/204 + 400/401/404/500)
- [ ] `order` jest whitelistą
- [ ] domyślny miesiąc działa w UTC
- [ ] logowanie 500-tek przez `console.error`
- [ ] lint/typecheck przechodzą
