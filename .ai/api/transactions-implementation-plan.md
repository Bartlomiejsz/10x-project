# API Endpoint Implementation Plan: `/api/transactions` (Astro 5 + TypeScript + Supabase)

## 1. Przegląd punktu końcowego
Celem jest wdrożenie kompletnego REST API dla zasobu **Transactions** (rejestr wydatków) dla **uwierzytelnionego użytkownika**, zgodnie ze specyfikacją:

- `GET /api/transactions` — lista z filtrowaniem, paginacją (cursor + offset fallback) i projekcją pól (`fields`).
- `GET /api/transactions/:id` — pobranie pojedynczej transakcji.
- `POST /api/transactions` — tworzenie pojedynczej transakcji lub wsadowy import (`transactions[]`), z deduplikacją po `import_hash`.
- `PUT /api/transactions/:id` — pełna podmiana (korekta wartości).
- `PATCH /api/transactions/:id` — częściowa aktualizacja.
- `DELETE /api/transactions/:id` — usunięcie.

Wspólne założenia:
- Użytkownik (`user_id`) **nigdy nie przychodzi z klienta** — jest brany z kontekstu auth.
- Walidacja wejścia jest realizowana przez **Zod**.
- Logika domenowa jest wydzielona do warstwy **service** w `src/lib/services`.
- Endpointy są „cienkie”: auth + parse/validate + wywołanie service + mapowanie błędów.

> Ważne: aktualna migracja Supabase ma RLS dla `transactions` otwarte na wszystkich authenticated (`auth.role() = 'authenticated'`) bez warunku `user_id = auth.uid()`. To jest krytyczne ryzyko bezpieczeństwa i musi być poprawione w ramach wdrożenia.

---

## 2. Szczegóły żądania

### 2.1. `GET /api/transactions` — listowanie
**Opis:** zwraca listę transakcji z kontekstu uwierzytelnionego użytkownika.

**Query params**
- Wymagane: brak
- Opcjonalne:
  - `limit` (int) — domyślnie `50`, maks `1000`.
  - `cursor` (string) — nieprzezroczysty (opaque) cursor wskazujący ostatni element z poprzedniej strony.
  - `order` (string) — `date.desc` lub `date.asc` (domyślnie `date.desc`).
  - `start_date` / `end_date` (YYYY-MM-DD).
  - `type_id` (int).
  - `min_amount` / `max_amount` (number).
  - `q` (string) — full-text search na `description` (w implementacji: `ilike`, ewentualnie `textSearch` jeśli w przyszłości dodacie tsvector).
  - `is_manual_override` (boolean).
  - `import_hash` (string).
  - Offset fallback:
    - `page` (int, >=1).
    - `pageSize` (int).
  - `fields` (string) — projekcja: lista pól rozdzielona przecinkami.

**Reguły i rozstrzygnięcia projektowe**
- Priorytet paginacji:
  1) jeśli podano `cursor` → użyj cursor pagination,
  2) w przeciwnym razie jeśli podano `page`/`pageSize` → offset,
  3) w przeciwnym razie domyślnie `limit=50` i pierwsza strona.
- `fields` obsługuj jako whitelistę (patrz §5 Bezpieczeństwo) — odrzuć nieznane pola.

---

### 2.2. `GET /api/transactions/:id` — pobranie pojedynczej transakcji
**Parametry URL**
- Wymagane:
  - `id` (uuid)

---

### 2.3. `POST /api/transactions` — create (single lub batch)
**Tryb single** — jeśli body nie ma klucza `transactions`:
- Wymagane pola:
  - `type_id` (number)
  - `amount` (number)
  - `description` (string)
  - `date` (YYYY-MM-DD)
- Opcjonalne:
  - `import_hash` (string | null)
  - `is_manual_override` (boolean)

**Tryb batch** — jeśli body zawiera `transactions: [...]`:
- Wymagane:
  - `transactions` (array) — min 1 element
- Każdy element ma strukturę jak w trybie single.

**Business logic**
- Wykrywanie batch: obecność `transactions` w body.
- Walidacja każdego elementu.
- Deduplikacja po `import_hash`:
  - Deduplikacja dotyczy wyłącznie rekordów w scope tego samego `user_id`.
  - Single: jeśli duplikat → `409 Conflict`.
  - Batch: elementy-duplikaty → `status: "skipped"`.
- Jeśli `import_hash` nie podano: serwer liczy `md5(date+amount+description)`.
- Jeśli `is_manual_override` nie jest ustawione oraz import sugeruje AI klasyfikację:
  - ustaw początkowo `ai_status=null`.
  - klasyfikację AI uruchom asynchronicznie (poza ścieżką requestu) i zaktualizuj później (`ai_status`, `ai_confidence`).

**Transakcyjność batch**
- Wymóg: „procesuj w jednej transakcji DB”.
- Rekomendacja implementacyjna:
  - użyj funkcji SQL (RPC) w Supabase do batch insert (jedna transakcja w PL/pgSQL).
  - zachowanie: *best-effort w obrębie jednej transakcji* (błędy per-item łapane i raportowane, a udane inserty pozostają). To umożliwia wymagany `207 Multi-Status`.
  - jeśli zespół wymaga "all-or-nothing" → dodaj opcjonalny tryb `atomic=true` powodujący rollback całego batcha i odpowiedź 400/500; ale to zmienia semantykę 207 (trzeba ustalić w zespole).

---

### 2.4. `PUT /api/transactions/:id` — replace
**Parametry URL**
- Wymagane: `id` (uuid)

**Body**
- Wymagane: pełny zestaw pól modyfikowalnych (w praktyce: `type_id`, `amount`, `description`, `date`, `is_manual_override?` + opcjonalne AI metadane wg specyfikacji typów).

**Business logic**
- Jeżeli klient zmieni `type_id` względem wartości AI-sugerowanej, serwer:
  - ustawia `is_manual_override=true`,
  - zachowuje poprzednie pola AI (`ai_status`, `ai_confidence`) bez kasowania.

---

### 2.5. `PATCH /api/transactions/:id` — partial
**Parametry URL**
- Wymagane: `id` (uuid)

**Body**
- Dowolny podzbiór pól modyfikowalnych.

**Business logic**
- Jeśli `type_id` się zmienia i `is_manual_override` nie jest `true` → ustaw `is_manual_override=true`.

---

### 2.6. `DELETE /api/transactions/:id`
**Parametry URL**
- Wymagane: `id` (uuid)

---

## 3. Wykorzystywane typy
Bazujemy na istniejących typach w `src/types.ts`:

### 3.1. DTO
- `TransactionDTO` — `Tables<'transactions'>`.
- `PaginatedResponse<T>`.
- `BatchImportResult` / `BatchImportItemResult`.
- `APIErrorResponse`.

### 3.2. Command modele
- `CreateTransactionCommand`.
- `CreateTransactionsBatchCommand`.
- `UpdateTransactionCommand`.
- `PatchTransactionCommand`.

### 3.3. Dodatkowe typy/schematy (do dodania jako Zod, bez konieczności w `src/types.ts`)
- `TransactionIdSchema` (uuid).
- `TransactionsListQuerySchema`.
- `CreateTransactionSchema`.
- `CreateTransactionsBatchSchema`.
- `UpdateTransactionPutSchema` (PUT wymusza wymagane pola).
- `PatchTransactionSchema`.

> Jeśli zespół chce mieć typowane `fields`, można dodać `type TransactionSelectableField = ...` w `src/types.ts`, ale wystarczy też runtime whitelist w schema.

---

## 4. Przepływ danych

### 4.1. Warstwy i odpowiedzialności
1) **Route handlers** (`src/pages/api/transactions*.ts`):
   - parse URL/body,
   - walidacja (Zod),
   - uwierzytelnienie (Supabase auth) i pozyskanie `user.id`,
   - wywołanie serwisu,
   - mapowanie błędów → HTTP.

2) **Service layer** (`src/lib/services/transactions.service.ts`):
   - budowanie zapytań Supabase (select/insert/update/delete),
   - scoping po `user_id`,
   - deduplikacja `import_hash` (single) oraz delegacja batch do RPC,
   - implementacja reguł `is_manual_override`.

3) **DB / Supabase**:
   - tabela `transactions`,
   - indeksy (są),
   - RLS polityki (do poprawy),
   - (nowe) RPC do batch insert i ewentualnie do cursor pagination.

4) **Asynchroniczna klasyfikacja AI** (stub/plan):
   - minimalnie: zapis transakcji z `ai_status=null`.
   - później: worker/cron/webhook, który klasyfikuje i aktualizuje rekord.

### 4.2. Sequencje

#### GET list
- Route: walidacja query → auth → `transactionsService.list(...)` → odpowiedź 200 z `data` i `next_cursor`.

#### POST single
- Route: parse body → rozpoznanie trybu → walidacja → auth → serwis:
  - uzupełnij `import_hash` (jeśli brak),
  - sprawdź duplikat (jeśli import_hash),
  - insert z `user_id=user.id` → 201.

#### POST batch
- Route: parse body → walidacja (zebrane błędy per-item jeśli wymagane na wejściu) → auth → `supabase.rpc('import_transactions_batch', ...)` → 207.

#### PUT/PATCH
- Route: walidacja id+body → auth → serwis pobiera bieżący rekord (w scope user) → aplikuje reguły `is_manual_override` → update → 200.

#### DELETE
- Route: walidacja id → auth → delete w scope user → 204.

---

## 5. Względy bezpieczeństwa

### 5.1. Uwierzytelnianie (401)
- Każdy endpoint wymaga zalogowanego użytkownika.
- W handlerach: `await locals.supabase.auth.getUser()` i guard clause na brak usera.

**Ryzyko w obecnym kodzie**
- `src/middleware/index.ts` ustawia `context.locals.supabase = supabaseClient` (globalny klient z anon key).
- Samo `auth.getUser()` będzie działać poprawnie tylko jeśli Supabase klient ma właściwy kontekst sesji/requestu.

**Plan naprawy**
- Zespół powinien ustandaryzować sposób otrzymywania sesji w backendzie Astro:
  - utworzyć klienta Supabase per-request, wstrzykując token z cookies/Authorization,
  - albo korzystać z oficjalnego podejścia Supabase dla SSR (jeśli używane w projekcie).
- Niezależnie od tego, krytyczne jest RLS ograniczające dostęp po `user_id=auth.uid()`.

### 5.2. Autoryzacja (scoping danych)
- Wszystkie zapytania do `transactions` muszą filtrować `user_id = user.id`.
- Dodatkowo (obowiązkowo) poprawić RLS policies w DB:
  - SELECT/UPDATE/DELETE: `using (user_id = auth.uid())`
  - INSERT: `with check (user_id = auth.uid())`

### 5.3. Ochrona przed „fields injection”
- `fields` musi być whitelistą kolumn.
- Zabroń selekcji pól spoza listy oraz potencjalnych ekspresji/relacji.

Proponowana whitelist (zgodnie ze specyfikacją odpowiedzi):
- `id`, `user_id`, `type_id`, `amount`, `description`, `date`, `ai_status`, `ai_confidence`, `is_manual_override`, `import_hash`, `created_at`, `updated_at`.

### 5.4. Input hardening
- Limity:
  - `limit` max 1000 (zgodnie ze specyfikacją).
  - batch `transactions.length` — ustaw górny limit (np. 500/1000) dla ochrony DB.
- Walidacja dat/kwot/description na wejściu (Zod) zgodnie z constraints tabeli.

### 5.5. PII / dane w logach
- Unikaj logowania pełnych payloadów transakcji (szczególnie description) w error logach bez potrzeby.
- Jeśli tworzona będzie tabela błędów, zapisuj `details` ostrożnie (np. zredagowane).

---

## 6. Obsługa błędów

### 6.1. Standard odpowiedzi błędu
Wzoruj się na istniejących endpointach (np. `transaction-types`) i typie `APIErrorResponse`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": { "...": "..." }
  }
}
```

### 6.2. Mapowanie błędów → status
- `400` — walidacja (ZodError, niepoprawne parametry, niespójne zakresy: start>end, min>max).
- `401` — brak / nieważna sesja.
- `404` — zasób nie istnieje (w scope `user_id`).
- `409` — duplikat `import_hash` w trybie single.
- `500` — błędy nieoczekiwane / błędy DB.

> Specyfikacja wspomina też 403 dla DELETE: jeśli RLS blokuje, można mapować `PostgREST` error na 403, ale minimalnie wystarczą 401/404/500 (przy właściwym RLS najczęściej będzie to „no rows” → 404).

### 6.3. Scenariusze błędów per endpoint

#### GET /api/transactions
- 401: brak usera
- 400: invalid `limit/order/date` itd.
- 500: błąd Supabase

#### GET /api/transactions/:id
- 400: invalid uuid
- 401
- 404: brak transakcji lub nie należy do usera

#### POST /api/transactions (single)
- 400: invalid body
- 401
- 409: import_hash duplicate
- 500

#### POST /api/transactions (batch)
- 400: body nie jest JSON / brak tablicy / pusta tablica / elementy niepoprawne w sposób uniemożliwiający przetworzenie
- 401
- 207: mieszane wyniki zgodnie z `BatchImportResult`
- 500

#### PUT/PATCH
- 400: invalid uuid/body
- 401
- 404: brak zasobu
- 500

#### DELETE
- 400: invalid uuid
- 401
- 404
- 500

### 6.4. Logowanie błędów
W repo obecnie stosowane jest `console.error(...)`.

**Jeśli wymagane logowanie do tabeli błędów**: w obecnej migracji nie ma tabeli error logów.
- Propozycja: dodać tabelę `app_errors` (nowa migracja) i helper w serwisie do zapisu.
- Minimalny zakres:
  - `created_at`, `user_id` (nullable), `route`, `method`, `error_code`, `message`, `details jsonb`.

---

## 7. Wydajność

### 7.1. Indeksy
Obecne indeksy dla `transactions`:
- `(date, type_id)`, `(user_id, date)`, `(import_hash)`, `(type_id)`, `(date)`.

Uwagi:
- Dla listowania per-user najczęściej kluczowy jest indeks `(user_id, date)` (jest).
- Dla deduplikacji per-user warto rozważyć indeks złożony:
  - `create index ... on transactions(user_id, import_hash) where import_hash is not null;`
  - (opcjonalnie unikalny, jeśli akceptujecie twarde wymuszenie dedup w DB).

### 7.2. Paginacja
- Cursor-based jest preferowana dla dużych zbiorów.
- Offset fallback jest ok dla małych list i UX, ale skaluje się gorzej.

**Rekomendacja implementacyjna**
- Aby poprawnie obsłużyć cursor w sortowaniu po `date`, rozważcie SQL RPC `list_transactions_cursor` (patrz §8 Kroki implementacji).

### 7.3. Projekcja pól
- `fields` zmniejsza payload.
- Zawsze trzymaj whitelistę i minimalny select dla listy, jeśli UI nie potrzebuje wszystkich pól.

### 7.4. Batch
- Limit rozmiaru batch.
- RPC minimalizuje round-trip i pozwala na przetwarzanie w jednej transakcji.

---

## 8. Kroki implementacji

### 8.1. Ustalenia zespołowe (krótkie decyzje)
1) **Cursor semantics:**
   - rekomendowane: cursor oparty o `(date, id)` i implementowany przez RPC;
   - alternatywa: cursor jako offset (prostsze, mniej „poprawne”).
2) **Batch transactional semantics:**
   - rekomendowane: best-effort z `207` (przechwytuj błędy per item i kontynuuj), w obrębie jednego BEGIN w RPC.

### 8.2. Dodanie schematów walidacji (Zod)
Utwórz `src/lib/schemas/transactions.schema.ts`:
- `TransactionsListQuerySchema`
  - parsowanie string→int/number/bool
  - walidacje: limit 1..1000, order enum, daty YYYY-MM-DD (+ refine), zakresy start<=end, min<=max
  - `fields` → `string[]` + refine whitelist
- `TransactionIdSchema`: `z.string().uuid()`
- `CreateTransactionSchema`
  - `type_id` int>0
  - `amount` number > 0 i < 100000
  - `description` trim 1..255
  - `date` YYYY-MM-DD >= 2000-01-01
  - `import_hash` optional nullable string
  - `is_manual_override` optional boolean
- `CreateTransactionsBatchSchema`: `{ transactions: z.array(CreateTransactionSchema).min(1).max(MAX_BATCH) }`
- `UpdateTransactionPutSchema`: wymagane pola dla PUT
- `PatchTransactionSchema`: partial, ale min 1 klucz

### 8.3. Dodanie/rozszerzenie custom errorów
W `src/lib/errors.ts` są: `NotFoundError`, `ValidationError`, `UnauthorizedError`.

Dodaj (lub zaplanuj dodanie):
- `ConflictError` (dla 409)
- `ForbiddenError` (opcjonalnie)

### 8.4. Implementacja serwisu `TransactionsService`
Utwórz `src/lib/services/transactions.service.ts` (analogicznie do `transaction-types.service.ts`) z metodami:
- `listTransactions(filters, supabase, userId)`
  - buduje query z `.from('transactions')`
  - zawsze `.eq('user_id', userId)`
  - filtry po date range/type_id/amount/q/is_manual_override/import_hash
  - sort
  - paginacja:
    - cursor (preferowane: RPC `list_transactions_cursor`)
    - offset fallback: `.range(from, to)`
  - select:
    - default pełny select lub whitelist
    - jeśli `fields` → `select(fields.join(','))`
  - wyliczenie `next_cursor`:
    - dla cursor: encode ostatniego itemu
    - dla offset: `next_cursor` może być null lub offset-cursor (decyzja zespołu)

- `getTransactionById(id, supabase, userId)`
  - `.eq('id', id).eq('user_id', userId).single()`
  - mapuj PGRST116 → `NotFoundError`

- `createTransaction(cmd, supabase, userId)`
  - uzupełnij `import_hash` jeśli brak (md5)
  - jeśli import_hash istnieje: sprawdź duplikat w scope user
  - insert z `user_id`
  - zwróć rekord (preferowane `select().single()` po insert)

- `createTransactionsBatch(cmd, supabase, userId)`
  - najlepiej: `supabase.rpc('import_transactions_batch', { p_user_id: userId, p_transactions: ... })`
  - zwróć `BatchImportResult`

- `replaceTransaction(id, cmd, supabase, userId)`
  - pobierz current
  - jeśli type_id się zmienia → `is_manual_override=true` (oraz *preserve* AI fields)
  - update

- `patchTransaction(id, cmd, supabase, userId)`
  - pobierz current
  - jeśli cmd.type_id zmienia → set manual override
  - update (Partial)

- `deleteTransaction(id, supabase, userId)`
  - delete w scope user
  - jeśli 0 rows → NotFound

### 8.5. Implementacja route handlerów
Dodaj:
- `src/pages/api/transactions.ts`
  - `export const prerender = false`
  - `GET`: parse query → validate → auth → service.list → 200
  - `POST`:
    - `await request.json()`
    - rozpoznaj single/batch
    - validate
    - auth
    - single → 201 / 409
    - batch → 207

- `src/pages/api/transactions/[id].ts`
  - `GET` → 200
  - `PUT` → 200
  - `PATCH` → 200
  - `DELETE` → 204

Zachowaj styl istniejących endpointów:
- `try/catch` z rozróżnieniem `ZodError`
- stałe nagłówki `Content-Type: application/json`
- `console.error` dla nieoczekiwanych błędów

### 8.6. Zmiany bazy danych (Supabase migrations)
Dodaj nową migrację (np. `supabase/migrations/YYYYMMDDHHMMSS_transactions_security_and_rpc.sql`) zawierającą:

1) **Poprawę RLS dla `transactions`** (krytyczne):
- usuń/zmień polityki `transactions_*_authenticated` tak, aby używały `user_id = auth.uid()`.

2) (Rekomendowane) **indeks dla dedup per-user**:
- `create index if not exists idx_transactions_user_import_hash on transactions(user_id, import_hash) where import_hash is not null;`

3) **RPC do batch import** `import_transactions_batch(...)`:
- wejście: user_id + jsonb array transakcji
- logika:
  - dedup (DB + wewnątrz batch)
  - insert
  - per-item result
  - summary
- zwrot: jsonb, zgodny z `BatchImportResult`

4) (Opcjonalnie) **RPC do cursor listing** `list_transactions_cursor(...)`:
- umożliwia poprawną paginację po `(date, id)` bez hacków w PostgREST.

5) (Opcjonalnie) tabela `app_errors` + RLS, jeśli zespół chce logować błędy do DB.

### 8.7. Testy / weryfikacja
Minimalny pakiet testów/smoke:
- Zod schemas: testy jednostkowe walidacji (jeśli repo ma framework testowy; jeśli nie, przynajmniej skrypt dev do szybkiej walidacji).
- Manual smoke przez HTTP (np. plik `.http` jak w `_szub/google.http`):
  - GET list bez auth → 401
  - GET list z auth → 200
  - POST single → 201
  - POST single duplicate import_hash → 409
  - POST batch z mieszanymi transakcjami → 207
  - PATCH type_id → is_manual_override auto-set
  - DELETE → 204, ponowny DELETE → 404

### 8.8. Checklist „Definition of Done”
- [ ] Endpointy działają i zwracają oczekiwane statusy (200/201/204/207/400/401/404/409/500).
- [ ] Walidacja Zod pokrywa wszystkie parametry ze specyfikacji.
- [ ] Wszystkie operacje na `transactions` są scoped po `user_id`.
- [ ] RLS w Supabase wymusza `user_id = auth.uid()`.
- [ ] `fields` jest bezpieczne (whitelist) i nie pozwala na injection.
- [ ] Batch działa przez RPC i raportuje per-item status.
- [ ] Deduplikacja `import_hash` działa w single i batch.
- [ ] Reguły `is_manual_override` są zgodne ze specyfikacją.
