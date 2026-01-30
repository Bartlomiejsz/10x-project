<conversation_summary>
<decisions>
1. Brak tabeli `households` w MVP (jedno wspólne gospodarstwo).
2. Tabela `budgets` z kluczem głównym złożonym (`month_date`, `type_id`) bez sztucznego `id`.
3. Wszystkie tabele otrzymują kolumny `created_at` i `updated_at` (`TIMESTAMPTZ UTC`).
4. Pole `description` w `transactions` maks. 255 znaków (constraint długości).
5. Brak refundów w MVP; `amount` zawsze dodatni (`CHECK amount > 0 AND amount < 1000000`).
6. Kwoty przechowywane jako `NUMERIC(12,2)`.
7. Brak unikalności i deduplikacji wymuszanej constraintem DB (duplikaty obsługiwane aplikacyjnie).
8. Indeksowanie: w `transactions` indeksy `(date, type_id)` oraz `(user_id, date)` + indeks po `import_hash`; brak indeksów częściowych.
9. Generowanie rekordów budżetu on‑demand (UPSERT przy pierwszym użyciu miesiąca).
10. Brak tabeli staging dla importu CSV (logika w pamięci).
11. Zastosowanie kolumny `is_manual_override` w `transactions` zamiast tabeli zdarzeń.
12. Użycie enum PostgreSQL `ai_status` (success|fallback|error).
13. Kolumny AI: `ai_confidence SMALLINT (0–100)`, `ai_status enum`.
14. Dodanie kolumny `import_hash` (md5 z pola Data+Kwota+Opis) bez wymuszania unikalności.
15. Tabela `transaction_types` z polami: `id`, `name`, `code UNIQUE`, `position SMALLINT`, znaczniki czasu.
16. Wszystkie znaczniki czasu w UTC (`TIMESTAMPTZ`), konwersja tylko w warstwie prezentacji.
17. Brak RLS w MVP (kontrola dostępu wyłącznie aplikacyjnie).
18. Rezygnacja z tabeli ustawień progów AI (progi jako stałe w kodzie).
19. Rezygnacja z tabeli audytu zmian kategorii w MVP.
20. Ograniczenie dat transakcji walidowane w kodzie (brak constraintu w DB).
</decisions>

<matched_recommendations>
1. Kompozytowy PK w `budgets` dla prostych UPSERT (zaakceptowane).
2. Dodanie `created_at` / `updated_at` we wszystkich tabelach (zaakceptowane).
3. Kolumna `is_manual_override` dla prostych metryk zamiast tabeli zdarzeń (zaakceptowane).
4. Enum dla `ai_status` (zaakceptowane).
5. Indeksy `(date, type_id)` i `(user_id, date)` w `transactions` (zaakceptowane).
6. `import_hash` + indeks dla wsparcia detekcji duplikatów aplikacyjnie (zaakceptowane).
7. `transaction_types` z `code` i `position` dla stabilnego sortowania (zaakceptowane).
8. Użycie UTC (`TIMESTAMPTZ`) dla spójności (zaakceptowane).
9. Constraint długości `description` (dostosowane do 255) (zaakceptowane).
10. `CHECK (amount > 0 AND amount < 1000000)` dla wczesnej walidacji (zaakceptowane).
</matched_recommendations>

<database_planning_summary>
Główne wymagania: Prosty model dla jednego gospodarstwa domowego, obsługa 11 stałych kategorii, miesięczne limity per kategoria, transakcje z automatyczną kategoryzacją AI i możliwością manualnej korekty, import CSV z detekcją duplikatów (logika aplikacyjna), brak zaawansowanego audytu oraz brak RLS w MVP.

Kluczowe encje:
- `users`: identyfikacja autora transakcji (FK w `transactions`), znaczniki czasu.
- `transaction_types`: słownik kategorii (id, name, code UNIQUE, position SMALLINT, timestamps).
- `budgets`: PK (`month_date DATE`, `type_id FK`), kolumny: `amount NUMERIC(12,2)`, timestamps. Rekordy tworzone on‑demand.
- `transactions`: `id` (UUID lub BIGINT), `user_id FK`, `type_id FK`, `amount NUMERIC(12,2)`, `description VARCHAR(255)`, `date DATE`, AI pola: `ai_status enum`, `ai_confidence SMALLINT CHECK 0–100`, `is_manual_override BOOLEAN`, `import_hash TEXT`, timestamps, `CHECK (amount > 0 AND amount < 1000000)`.
- `ai_keyword_mapping`: seed (statyczne dane fallback; może być tabela lub plik – brak dalszych wymagań).
  Relacje: `transactions.user_id -> users.id`, `transactions.type_id -> transaction_types.id`, `budgets.type_id -> transaction_types.id`. Brak relacji gospodarstw (jedno środowisko współdzielone).

Indeksowanie:
- `transactions`: PK + `(date, type_id)` dla agregatów miesięcznych i wykresu; `(user_id, date)` dla udziału osób; indeks po `import_hash` (detekcja duplikatów).
- `transaction_types`: indeks po `position` (sortowanie UI).
- `budgets`: PK pokrywa wyszukiwanie po miesiącu i kategorii (brak dodatkowych indeksów).

Integralność i constraints:
- `budgets` kompozytowy PK eliminuje duplikaty.
- Walidacje: `CHECK` na `amount`, `CHECK (char_length(description) <= 255)`, `ai_confidence` zakres 0–100.
- Brak uniqueness dla duplikatów (detekcja logiką aplikacyjną przy imporcie).
- Zakres dat (np. ostatnie X dni) egzekwowany w kodzie (elastyczność).

Bezpieczeństwo:
- Brak RLS (upraszczające MVP); autoryzacja po stronie warstwy API / Supabase Auth.
- Przy przyszłej wielogospodarstwowości dodanie `household_id` we wszystkich tabelach + RLS (zidentyfikowane jako przyszła ścieżka migracji).
- Wszystkie timestamps w UTC (jednolitość + przewidywalność).

Skalowalność i wydajność:
- Wczesne uproszczenie (brak partycjonowania); struktura pozwala później dodać partycjonowanie `transactions` po `date`.
- Indeksy skoncentrowane na najczęstszych zapytaniach (agregaty miesięczne, udział użytkowników, filtrowanie po kategorii i dacie).
- On‑demand generowanie budżetów ogranicza rozrost tabeli.
- Brak materializowanych widoków (agregacje on‑the‑fly z obecnych indeksów).
- `NUMERIC(12,2)` wystarczające; ewentualna migracja do groszowego `BIGINT` dopiero przy bardzo dużych wolumenach.

AI / kategoryzacja:
- Minimalne pola metryczne (`ai_status`, `ai_confidence`, `is_manual_override`) umożliwiają obliczenie accuracy bez tabeli audytu.
- Enum zapewnia spójny zestaw statusów i mniejszy narzut walidacji.

Import:
- Brak tabel staging; `import_hash` przyspiesza oznaczanie potencjalnych duplikatów.
- Decyzja: brak constraintów wymuszających unikalność – pozwala na bardziej elastyczne strategie UI (oznaczanie zamiast blokowania).

Migracyjność przyszła:
- Łatwe dodanie `household_id`.
- Możliwość dołożenia tabeli `transaction_category_events` jeśli wymagane dokładniejsze metryki.
- Możliwość wprowadzenia RLS i partycjonowania bez łamania obecnego schematu.

Observability:
- Brak dedykowanych tabel logów w DB w MVP; metryki techniczne mogą być trzymane poza głównym schematem (np. logowanie aplikacyjne).

</database_planning_summary>

<unresolved_issues>
1. Dokładna wartość limitu zakresu historycznych dat (np. 60 dni) – nieustalone.
2. Definicja progów pewności AI (thresholdy low/medium/high) – do zdefiniowania.
3. Ostateczna polityka obsługi częściowo błędnych wierszy importu (skip vs raport mieszany) – brak formalnej decyzji (implikacja: prawdopodobnie skip, ale nie zatwierdzono).
4. Format CSV (separator, decimal, encoding) – wciąż do potwierdzenia próbką (przyjęte defaulty tymczasowe).
5. Strategia przyszłej migracji do multi‑household (moment aktywacji) – pozostaje planem.
6. Wybór typu klucza głównego dla `transactions` (UUID vs BIGINT) – nie ustalono.
7. Ewentualne potrzeby dodatkowych indeksów pokrywających (np. `(date, type_id, amount)`) przy wzroście wolumenu – monitorowanie.
</unresolved_issues>
</conversation_summary>