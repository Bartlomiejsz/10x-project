# Schemat bazy danych – HomeBudget (MVP)

## 1. Tabele, kolumny, typy i ograniczenia (DDL proponowane)

> Konwencje:
> - Wszystkie znaczniki czasu w UTC (`TIMESTAMPTZ`).
> - `created_at` / `updated_at` z domyślną wartością `now()`. `updated_at` aktualizowane triggerem.
> - Kwoty w `NUMERIC(12,2)` (zakres do ~100 tys PLN z 2 miejscami po przecinku).
> - Identyfikatory główne: `UUID` (Supabase/pgcrypto: `gen_random_uuid()`).
> - Brak tabeli `households` w MVP – wszyscy uwierzytelnieni użytkownicy współdzielą dane (jeden kontekst gospodarstwa). Projekt przygotowany do łatwego dodania `household_id` w przyszłości.

### 1.1 Typy zdefiniowane w DB
```sql
-- Status klasyfikacji AI
CREATE TYPE ai_status AS ENUM ('success', 'fallback', 'error');
```

### 1.2 Funkcja i trigger do aktualizacji `updated_at`
```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;
```

### 1.3 Tabela: users
Tabela zarządzana przez Supabase Auth.
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (position('@' IN email) > 1),
  display_name TEXT, -- opcjonalna nazwa wyświetlana
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_set_updated
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 1.4 Tabela: transaction_types (słownik kategorii)
Stałe 11 kategorii seedowane podczas migracji startowej.
```sql
CREATE TABLE transaction_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,      -- stabilny kod (np. GROCERY, HOME, HEALTH ...)
  name TEXT NOT NULL,             -- etykieta PL
  position SMALLINT NOT NULL,     -- kolejność wyświetlania
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (position >= 0 AND position < 200)
);
CREATE INDEX idx_transaction_types_position ON transaction_types(position);
CREATE TRIGGER trg_transaction_types_set_updated
  BEFORE UPDATE ON transaction_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

#### Seed (przykładowy – wykonywany osobno):
```sql
INSERT INTO transaction_types (code, name, position) VALUES
 ('GROCERY','Spożywcze',1),
 ('HOME','Dom',2),
 ('HEALTH_BEAUTY','Zdrowie i Uroda',3),
 ('CAR','Samochód',4),
 ('FASHION','Moda',5),
 ('ENTERTAINMENT','Rozrywka i Okazje',6),
 ('BILLS','Rachunki',7),
 ('FIXED','Stałe wydatki',8),
 ('UNPLANNED','Nieplanowane',9),
 ('INVEST','Inwestycje',10);
 ('OTHER','Inne',11),
```

### 1.5 Tabela: budgets
Budżet miesięczny per kategoria. Klucz główny kompozytowy – brak sztucznego ID. `month_date` reprezentuje pierwszy dzień miesiąca (YYYY-MM-01) dla łatwego zakresowego filtrowania i potencjalnego partycjonowania w przyszłości.
```sql
CREATE TABLE budgets (
  month_date DATE NOT NULL,                     -- pierwszy dzień miesiąca (np. 2025-10-01)
  type_id INT NOT NULL REFERENCES transaction_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0 AND amount < 1000000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month_date, type_id)
);
CREATE TRIGGER trg_budgets_set_updated
  BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 1.6 Tabela: transactions
Rejestr wydatków. 
Decyzja: `UUID` jako PK dla wygody frontendu i integracji z Supabase; pozwala na klient-side generowanie ID przy optymistycznym UI.
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  type_id INT NOT NULL REFERENCES transaction_types(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0 AND amount < 100000),
  description VARCHAR(255) NOT NULL CHECK (char_length(description) <= 255),
  date DATE NOT NULL, -- data transakcji (UTC, przechowujemy bez strefy bo dzienne agregacje)
  ai_status ai_status,           -- null gdy brak klasyfikacji (np. manualnie bez AI), w przeciwnym razie status
  ai_confidence SMALLINT CHECK (ai_confidence BETWEEN 0 AND 100),
  is_manual_override BOOLEAN NOT NULL DEFAULT false, -- true jeśli użytkownik zmienił kategorię zasugerowaną
  import_hash TEXT,               -- md5(Data+Kwota+Opis) (brak unikalności – detekcja aplikacyjna)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date >= DATE '2000-01-01') -- sanity check
);
CREATE INDEX idx_transactions_date_type ON transactions(date, type_id);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_import_hash ON transactions(import_hash);
CREATE INDEX idx_transactions_type ON transactions(type_id);
CREATE INDEX idx_transactions_date ON transactions(date);
-- (Opcjonalne pokrywające w przyszłości: (date, type_id, amount) przy wzroście wolumenu)
CREATE TRIGGER trg_transactions_set_updated
  BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 1.7 (Opcjonalne na przyszłość – nie wdrażane teraz) Tabela: ai_keyword_mapping (fallback – statyczny seed)
Może być utrzymywana jako dane referencyjne. Nie używa FK (luźna konfiguracja). 
```sql
-- CREATE TABLE ai_keyword_mapping (
--   id SERIAL PRIMARY KEY,
--   keyword TEXT NOT NULL,
--   type_id INT NOT NULL REFERENCES transaction_types(id) ON UPDATE CASCADE ON DELETE CASCADE,
--   weight SMALLINT NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 100),
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   UNIQUE (keyword, type_id)
-- );
-- CREATE INDEX idx_ai_keyword_mapping_keyword ON ai_keyword_mapping(keyword);
-- CREATE TRIGGER trg_ai_keyword_mapping_set_updated
--   BEFORE UPDATE ON ai_keyword_mapping FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 1.8 (Opcjonalne na przyszłość – nie wdrażane teraz) Tabela: category_change_events
Dla audytu zmian i dokładniejszej metryki accuracy – odłożone. (Specyfikacja szkicowa.)
```sql
-- CREATE TABLE category_change_events (
--   id BIGSERIAL PRIMARY KEY,
--   transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
--   old_type_id INT REFERENCES transaction_types(id) ON DELETE SET NULL,
--   new_type_id INT NOT NULL REFERENCES transaction_types(id),
--   changed_by UUID NOT NULL REFERENCES users(id),
--   reason TEXT,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
-- CREATE INDEX idx_category_change_events_tx ON category_change_events(transaction_id);
```

## 2. Relacje między tabelami

| Relacja | Kardynalność | Opis |
|---------|--------------|------|
| users (1) — (N) transactions | 1:N | Użytkownik jest autorem wielu transakcji. |
| transaction_types (1) — (N) transactions | 1:N | Każda transakcja ma jedną kategorię. |
| transaction_types (1) — (N) budgets | 1:N | Budżet per kategoria w danym miesiącu. |

Brak relacji households (single-tenant logiczny). Wszystkie dane są globalne dla uwierzytelnionych użytkowników.

## 3. Indeksy (podsumowanie)

| Tabela | Indeks | Typ | Cel |
|--------|--------|-----|-----|
| transaction_types | idx_transaction_types_position(position) | BTREE | Sortowanie list kategorii. |
| budgets | PK(month_date,type_id) | BTREE | UPSERT, pobranie limitu dla miesiąca i kategorii. |
| transactions | PK(id) | BTREE | Dostęp po ID. |
| transactions | (date, type_id) | BTREE | Agregacje per kategoria i miesiąc (wykres / budżet). |
| transactions | (user_id, date) | BTREE | Udział osób, filtrowanie listy użytkownika. |
| transactions | import_hash | BTREE | Szybkie wyszukiwanie potencjalnych duplikatów przy imporcie. |
| transactions | type_id | BTREE | Filtrowanie po kategorii (UI filtry). |
| transactions | date | BTREE | Zakresy dat (historia miesięcy). |

Uwaga: Wszystkie indeksy są klasyczne BTREE – brak potrzeby GIN/GIN trigram w MVP (brak pełnotekstowego wyszukiwania). Monitorować ewentualną potrzebę złożonego indeksu pokrywającego `(date, type_id, amount)` przy rosnących agregacjach.

## 4. Zasady PostgreSQL / RLS

Chociaż w planowaniu rozważano brak RLS, aby spełnić wymagania kontroli dostępu (tylko uwierzytelnieni), rekomendowane jest WŁĄCZENIE RLS i proste polityki dopuszczające wszystkich zalogowanych (multi-household doda dalsze warunki w przyszłości).

### 4.1 Aktywacja RLS
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
```

### 4.2 Polityki (Supabase style)
Z uwagi na pojedynczy wspólny kontekst gospodarstwa – polityki są permissive dla roli `authenticated`.
```sql
-- Użytkownicy mogą czytać i pisać swoje konto (read/write self) – zapis ograniczony do własnego rekordu.
CREATE POLICY users_select_all ON users
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY users_update_self ON users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- (opcjonalnie INSERT blokowany – rekord tworzony przez backend service role)

-- Słowniki i mapowania: tylko odczyt dla zalogowanych.
CREATE POLICY transaction_types_read ON transaction_types
  FOR SELECT USING (auth.role() = 'authenticated');

-- Budżety: pełen dostęp (SELECT/INSERT/UPDATE) dla zalogowanych (wspólne gospodarstwo).
CREATE POLICY budgets_rw ON budgets
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Transakcje: pełen dostęp dla zalogowanych (wspólna przestrzeń). Gdyby była potrzeba ograniczenia do autora – dodać warunek auth.uid() = user_id.
CREATE POLICY transactions_rw ON transactions
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
```

Jeżeli w przyszłości pojawi się multi-household:
- Dodać kolumnę `household_id UUID` do (users, transactions, budgets, ai_keyword_mapping?)
- Dodać tabelę `households` oraz łączącą `household_members(user_id, household_id, role)`
- Polityki: `USING (EXISTS (SELECT 1 FROM household_members hm WHERE hm.user_id = auth.uid() AND hm.household_id = <table>.household_id))`

## 5. Dodatkowe uwagi / decyzje projektowe

1. PK `budgets (month_date, type_id)` minimalizuje nadmiar kolumn i upraszcza UPSERT: `INSERT ... ON CONFLICT (month_date,type_id) DO UPDATE SET amount=EXCLUDED.amount, updated_at=now()`.
2. Brak wymuszonej unikalności `import_hash` – pozwala zaimportować celowo zdublowane transakcje (np. powtórzone realne wydatki) po świadomej decyzji użytkownika; aplikacja oznacza potencjalny duplikat.
3. Ograniczenie dat (np. <= 60 dni wstecz, brak przyszłości) walidowane wyżej w warstwie aplikacyjnej dla elastyczności. Można dodać constraint CHECK po ustaleniu stałej (np. `date >= (current_date - INTERVAL '60 days')`).
4. `NUMERIC(12,2)` zamiast integer groszy – prostsza pierwsza implementacja; potencjalna migracja do `BIGINT` jeśli: wolumen > dziesiątki milionów rekordów lub wymagania wydajnościowe przy intensywnych agregacjach.
5. `ai_confidence` do 100 jako SMALLINT; wartości progowe (low/medium/high) są logiką aplikacji – brak dodatkowej tabeli konfiguracji.
6. Przy rosnącej ilości danych miesięcznych można rozważyć partycjonowanie `transactions` po `date` (LIST lub RANGE na miesiąc). Aktualny schemat to umożliwia bez zmian w kluczach obcych.
7. Brak soft delete (twarde usuwanie) – upraszcza raportowanie. Dodanie soft delete wymaga kolumny `deleted_at` plus filtry w widokach/indeksach częściowych.
8. Potencjalne rozszerzenia obserwowalności: materializowany widok miesięcznych agregatów `(month_date, type_id, total_amount)` odświeżany periodycznie – odroczone do momentu gdy realne obciążenie wskaże wąskie gardła.
9. Migracja do multi-household: dodać `household_id` i zaktualizować wszystkie klucze i indeksy (prefiks `household_id` w złożonych indeksach), następnie zmienić RLS.
10. Bezpieczeństwo: włączenie RLS zapobiega publicznemu dostępowi przez `anon`. Service role (serwer) zachowuje pełne uprawnienia.
11. Długość opisu 255 znaków – spójna z większością interfejsów UI; dłuższe opisy mogą być skracane lub wymuszana walidacja po stronie klienta.
12. Ewentualne raporty accuracy AI mogą być obliczone z: `COUNT(*) FILTER (WHERE is_manual_override)` / `COUNT(*)` w zakresie dat.
13. Dodatkowy indeks `(user_id, type_id, date)` na później, jeśli często wykonywane będą kwerendy filtrujące jednocześnie po użytkowniku i kategorii.
14. `transaction_types` używa `SERIAL` – przy przyszłej migracji do multi‑tenant można zachować globalnie spójny zestaw lub zastąpić enumeracją logiczną.
15. Rozmiar tabeli `budgets` rośnie liniowo z liczbą miesięcy * 11 kategorii – przy 5 latach to 5*12*11 = 660 wierszy (pomijalne).

## 6. Pokrycie wymagań PRD
| Wymaganie | Pokrycie schematu |
|-----------|-------------------|
| 11 predefiniowanych kategorii | `transaction_types` seed |
| Miesięczne limity | `budgets (month_date,type_id,amount)` |
| Dodawanie/edycja/usuwanie wydatków | `transactions` + indeksy czas/kategoria |
| AI kategoryzacja + fallback | Pola `ai_status`, `ai_confidence`, `is_manual_override`, tabela `ai_keyword_mapping` |
| Import CSV + duplikaty | Kolumna `import_hash` + indeks |
| Udział osób w wydatkach | Indeks `(user_id, date)` + `user_id` w `transactions` |
| Historia miesięcy (read-only > x-1) | Brak constraint – kontrola aplikacyjna, indeksy po `date` |
| Wizualizacja budżetu i progi | `(date,type_id)` indeks + dane z `budgets` |
| Dokładność AI / korekty | `is_manual_override` + `ai_status`/`ai_confidence` |
| Bezpieczeństwo dostępu | RLS polityki authenticated |

## 7. Nierozstrzygnięte kwestie (oznaczone do decyzji biznesowej poza schematem)
1. Dokładny limit historyczny dat (placeholder w logice aplikacji).
2. Progi confidence (low/medium/high) – przechowywane w konfiguracji aplikacji.
3. Polityka obsługi częściowo błędnych wierszy importu – implementacja w warstwie biznesowej (schemat neutralny).
4. Format CSV (separator / decimal) – nie wpływa na DB.
5. Ewentualne audytowanie zmian kategorii – odroczona tabela `category_change_events`.

---
**Status:** Schemat gotowy do implementacji migracji początkowej w Supabase / PostgreSQL.

