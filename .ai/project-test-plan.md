# Plan Testów - HomeBudget

## 1. Wprowadzenie i cele testowania

### 1.1 Wprowadzenie

Niniejszy dokument przedstawia plan testów dla aplikacji HomeBudget - systemu zarządzania budżetem domowym. Aplikacja umożliwia użytkownikom śledzenie transakcji, zarządzanie budżetami kategoryzowanymi oraz generowanie raportów miesięcznych. System został zbudowany w oparciu o stos technologiczny Astro 5, React 19, TypeScript 5, Tailwind CSS 4 oraz Supabase jako backend.

### 1.2 Cele testowania

1. **Walidacja funkcjonalności biznesowych** - Weryfikacja poprawności operacji CRUD na transakcjach, budżetach i typach transakcji
2. **Weryfikacja integralności danych** - Testowanie walidacji schematów Zod, constraintów bazodanowych oraz spójności danych
3. **Zapewnienie jakości UX** - Weryfikacja interaktywności komponentów React oraz obsługi błędów

---

## 2. Zakres testów

### 2.1 Elementy objęte testami

| Obszar | Komponenty | Priorytet |
|--------|------------|-----------|
| **API Endpoints** | `/api/budgets`, `/api/transactions`, `/api/transaction-types`, `/api/reports/monthly` | Krytyczny |
| **Serwisy biznesowe** | BudgetsService, TransactionsService, TransactionTypesService, ReportsService | Krytyczny |
| **Walidacja danych** | Schematy Zod (budgets, transactions, transaction-types, reports) | Wysoki |
| **Autoryzacja** | Middleware, requireUser(), RLS policies | Krytyczny |
| **Komponenty UI** | DashboardPage, TransactionDialog, BudgetChart, MonthSelector | Wysoki |
| **Custom Hooks** | useDashboardData, useBudgetMutations, useTransactionMutations, useInfiniteTransactions | Wysoki |
| **Integracja Supabase** | Klient Supabase, obsługa sesji, OAuth | Krytyczny |

### 2.2 Elementy wyłączone z testów

- Infrastruktura CI/CD (GitHub Actions, DigitalOcean)
- Konfiguracja Tailwind CSS i stylowanie
- Dokumentacja projektu
- Zewnętrzne usługi (Openrouter.ai - planowane)

---

## 3. Typy testów do przeprowadzenia

### 3.1 Testy jednostkowe (Unit Tests)

**Cel:** Weryfikacja poprawności izolowanych jednostek kodu

**Zakres:**
- Funkcje pomocnicze (`src/lib/format.ts`, `src/lib/month.ts`)
- Schematy walidacji Zod (`src/lib/schemas/*.ts`)
- Logika biznesowa w serwisach (mockowanie Supabase)
- Custom hooks React (z wykorzystaniem React Testing Library)

**Narzędzia:** Vitest, React Testing Library, MSW (Mock Service Worker)

### 3.2 Testy End-to-End (E2E)

**Cel:** Weryfikacja pełnych ścieżek użytkownika

**Zakres:**
- Logowanie przez Google OAuth
- CRUD transakcji przez interfejs użytkownika
- Edycja budżetów inline
- Nawigacja między miesiącami
- Infinite scroll listy transakcji

**Narzędzia:** Playwright

---

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1 Moduł Transakcji

#### TC-TR-001: Tworzenie pojedynczej transakcji
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | POST `/api/transactions` z prawidłowymi danymi | Status 201, zwrócony TransactionDTO |
| 2 | Weryfikacja import_hash | Hash MD5 wygenerowany automatycznie |
| 3 | Pobranie transakcji GET `/api/transactions/:id` | Dane zgodne z utworzonymi |

#### TC-TR-002: Deduplikacja transakcji importowanych
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | POST transakcji z unikalnymi danymi | Status 201 |
| 2 | POST identycznej transakcji (ten sam date+amount+description) | Status 409 ConflictError |
| 3 | Weryfikacja, że transakcja nie została zduplikowana | Tylko 1 rekord w bazie |

#### TC-TR-003: Batch import transakcji
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | POST `/api/transactions` z tablicą 5 transakcji | Status 207 Multi-Status |
| 2 | Weryfikacja odpowiedzi | BatchImportResult z summary |
| 3 | Sprawdzenie statusów poszczególnych elementów | created/skipped/error dla każdego |

#### TC-TR-004: Filtrowanie transakcji
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | GET `/api/transactions?start_date=2025-01-01&end_date=2025-01-31` | Tylko transakcje z stycznia |
| 2 | GET `/api/transactions?type_id=1` | Tylko transakcje kategorii 1 |
| 3 | GET `/api/transactions?q=zakupy` | Transakcje z "zakupy" w opisie |
| 4 | GET `/api/transactions?min_amount=100&max_amount=500` | Transakcje w zakresie kwot |

#### TC-TR-005: Paginacja cursor-based
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | GET `/api/transactions?limit=10` | 10 transakcji + next_cursor |
| 2 | GET `/api/transactions?limit=10&cursor={next_cursor}` | Kolejne 10 transakcji |
| 3 | Weryfikacja braku duplikatów | Unikalne ID między stronami |

#### TC-TR-006: Ochrona metadanych AI
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | PUT transakcji z `ai_status` bez `is_manual_override=true` | Status 400, aktualizacja odrzucona |
| 2 | PUT transakcji z `ai_status` i `is_manual_override=true` | Status 200, aktualizacja zaakceptowana |

### 4.2 Moduł Budżetów

#### TC-BG-001: Upsert budżetu
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | POST `/api/budgets` dla nowej kombinacji (month_date, type_id) | Status 201, created=true |
| 2 | POST `/api/budgets` dla istniejącej kombinacji | Status 200, created=false |
| 3 | Weryfikacja normalizacji daty | month_date zawsze jako YYYY-MM-01 |

#### TC-BG-002: Walidacja typu transakcji
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | POST `/api/budgets` z nieistniejącym type_id | Status 400, błąd walidacji |
| 2 | POST `/api/budgets` z istniejącym type_id | Status 201 |

#### TC-BG-003: Aktualizacja budżetu
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | PUT `/api/budgets/:month_date/:type_id` z nową kwotą | Status 200, zaktualizowana kwota |
| 2 | PUT dla nieistniejącego budżetu | Status 404 NotFoundError |

### 4.3 Moduł Raportów

#### TC-RP-001: Generowanie raportu miesięcznego
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | GET `/api/reports/monthly?month=2025-01` | MonthlyReportDTO |
| 2 | Weryfikacja agregacji | spend = suma transakcji per kategoria |
| 3 | Weryfikacja domyślnych budżetów | Kategorie bez budżetu mają default 1000 |

#### TC-RP-002: Podział wydatków (shares)
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | Utworzenie transakcji przez różnych użytkowników | - |
| 2 | GET `/api/reports/monthly` | shares zawiera podział per user_id |

### 4.4 Moduł Autoryzacji

#### TC-AU-001: Wymaganie autoryzacji
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | GET `/api/transactions` bez tokenu | Status 401 UnauthorizedError |
| 2 | GET `/api/transactions` z prawidłowym tokenem | Status 200 |

#### TC-AU-002: Google OAuth flow
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | GET `/auth/oauth/google` | Redirect do Supabase OAuth |
| 2 | Callback po autoryzacji | Sesja utworzona, redirect do `/` |
| 3 | Błąd autoryzacji | Redirect do `/auth/login?authError=reason` |

#### TC-AU-003: Row Level Security
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | Użytkownik A tworzy transakcję | Transakcja z user_id = A |
| 2 | Użytkownik B próbuje usunąć transakcję A | Dozwolone (shared household) |
| 3 | Niezautentykowany użytkownik | Brak dostępu do żadnych danych |

### 4.5 Interfejs użytkownika (UI)

#### TC-UI-001: Dashboard - ładowanie danych
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | Otwarcie dashboardu | Loading state widoczny |
| 2 | Załadowanie agregatów | BudgetChart wyświetla dane |
| 3 | Załadowanie transakcji | TransactionList wypełniona |

#### TC-UI-002: Optimistic update budżetu
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | Edycja budżetu inline | Natychmiastowa aktualizacja UI |
| 2 | Sukces API | Stan UI bez zmian |
| 3 | Błąd API | Rollback do poprzedniej wartości, toast error |

#### TC-UI-003: Infinite scroll transakcji
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | Scroll do końca listy | Loader widoczny |
| 2 | Załadowanie kolejnej strony | Nowe transakcje dodane |
| 3 | Brak więcej danych | hasMore=false, brak loadera |

#### TC-UI-004: Dialog transakcji - walidacja
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | Otwarcie dialogu "Nowa transakcja" | Formularz z pustymi polami |
| 2 | Submit bez wymaganych pól | Błędy walidacji wyświetlone |
| 3 | Submit z prawidłowymi danymi | Dialog zamknięty, toast sukcesu |

#### TC-UI-005: Readonly mode dla historycznych miesięcy
| Krok | Akcja | Oczekiwany rezultat |
|------|-------|---------------------|
| 1 | Wybór miesiąca z przeszłości | readonly=true |
| 2 | Próba edycji budżetu | Edycja zablokowana |
| 3 | Próba dodania transakcji | FAB ukryty lub disabled |

---

## 5. Środowisko testowe

### 5.1 Środowiska

| Środowisko | Przeznaczenie | Baza danych | Konfiguracja |
|------------|---------------|-------------|--------------|
| **Local** | Testy jednostkowe, rozwój | Supabase Local (Docker) | `.env.local` |
| **CI** | Testy automatyczne | Supabase Local (GitHub Actions) | `.env.test` |
| **Staging** | Testy E2E, UAT | Supabase Cloud (projekt testowy) | `.env.staging` |

### 5.2 Wymagania infrastrukturalne

```yaml
# docker-compose.test.yml
services:
  supabase-db:
    image: supabase/postgres:15.1.0.117
    ports:
      - "54322:5432"
    environment:
      POSTGRES_PASSWORD: postgres

  supabase-auth:
    image: supabase/gotrue:v2.99.0
    depends_on:
      - supabase-db

  supabase-rest:
    image: postgrest/postgrest:v11.2.2
    depends_on:
      - supabase-db
```

### 5.3 Dane testowe

```typescript
// fixtures/transactions.ts
export const testTransactions = [
  { type_id: 1, amount: 150.00, description: "Zakupy spożywcze", date: "2025-01-15" },
  { type_id: 2, amount: 500.00, description: "Czynsz", date: "2025-01-01" },
  // ...
];

// fixtures/budgets.ts
export const testBudgets = [
  { month_date: "2025-01-01", type_id: 1, amount: 800.00 },
  { month_date: "2025-01-01", type_id: 2, amount: 2000.00 },
  // ...
];
```

---

## 6. Narzędzia do testowania

### 6.1 Stos testowy

| Narzędzie | Wersja | Zastosowanie |
|-----------|--------|--------------|
| **Vitest** | ^2.0.0 | Test runner, testy jednostkowe |
| **React Testing Library** | ^16.0.0 | Testowanie komponentów React |
| **MSW** | ^2.0.0 | Mockowanie API w testach frontendu |
| **Playwright** | ^1.40.0 | Testy E2E, cross-browser |
| **@faker-js/faker** | latest | Generowanie danych testowych |
| **@testing-library/user-event** | latest | Symulacja interakcji użytkownika |

### 6.2 Konfiguracja Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['node_modules', 'tests', '**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
  },
});
```

### 6.3 Konfiguracja Playwright

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 7. Harmonogram testów

### 7.1 Fazy testowania

| Faza | Zakres | Czas trwania |
|------|--------|--------------|
| **Faza 1** | Konfiguracja środowiska, przygotowanie fixtures | 3-5 dni |
| **Faza 2** | Testy jednostkowe (schematy Zod, serwisy, hooki) | 7-10 dni |
| **Faza 3** | Testy E2E (scenariusze krytyczne) | 5-7 dni |
| **Faza 4** | Raport końcowy, stabilizacja | 2-3 dni |

### 7.2 Milestone'y

| Milestone | Kryterium sukcesu |
|-----------|-------------------|
| M1: Setup Complete | Środowisko CI działa, fixtures gotowe |
| M2: Unit Tests | Coverage > 80%, wszystkie testy przechodzą |
| M3: E2E | Scenariusze krytyczne pokryte |
| M4: Release Ready | Wszystkie testy przechodzą, raport gotowy |

---

## 8. Kryteria akceptacji testów

### 8.1 Kryteria wejścia (Entry Criteria)

- [ ] Kod źródłowy skompilowany bez błędów
- [ ] Środowisko testowe skonfigurowane i dostępne
- [ ] Dane testowe (fixtures) przygotowane
- [ ] Dokumentacja API aktualna

### 8.2 Kryteria wyjścia (Exit Criteria)

| Metryka | Wartość minimalna | Wartość docelowa |
|---------|-------------------|------------------|
| **Code Coverage** | 80% | 90% |
| **Testy przechodzące** | 100% | 100% |
| **Krytyczne bugi** | 0 | 0 |
| **Wysokie bugi** | ≤ 3 | 0 |

### 8.3 Kryteria zawieszenia testów

- Więcej niż 20% testów kończy się niepowodzeniem
- Środowisko testowe niedostępne przez > 4h
- Brak stabilnej wersji do testowania

---

## 9. Role i odpowiedzialności

### 9.1 Macierz RACI

| Aktywność | QA Engineer | Developer | Tech Lead |
|-----------|-------------|-----------|-----------|
| Pisanie testów jednostkowych | C | R | A |
| Pisanie testów E2E | R | C | A |
| Wykonywanie testów | R | I | I |
| Raportowanie bugów | R | I | A |
| Naprawa bugów | I | R | A |

**Legenda:** R - Responsible, A - Accountable, C - Consulted, I - Informed

---

## 10. Procedury raportowania błędów

### 10.1 Szablon zgłoszenia błędu

```markdown
## Tytuł
[MODUŁ] Krótki opis problemu

## Środowisko
- Przeglądarka: Chrome 120
- System: macOS 14.2
- Środowisko: Staging

## Priorytet
- [ ] P1 - Krytyczny (blokuje główną funkcjonalność)
- [ ] P2 - Wysoki (poważny problem, istnieje workaround)
- [ ] P3 - Średni (problem funkcjonalny, niski wpływ)
- [ ] P4 - Niski (kosmetyczny)

## Kroki reprodukcji
1. ...
2. ...

## Oczekiwany rezultat
...

## Aktualny rezultat
...

## Załączniki
- Screenshot / logi
```

### 10.2 Klasyfikacja priorytetów

| Priorytet | SLA naprawy | Przykład |
|-----------|-------------|----------|
| **P1** | 4h | Użytkownik nie może się zalogować |
| **P2** | 24h | Transakcja nie zapisuje się |
| **P3** | 72h | Nieprawidłowe sortowanie |
| **P4** | Backlog | Literówka w UI |

### 10.3 Narzędzie do śledzenia błędów

- **GitHub Issues** z etykietami: `bug`, `priority:p1-p4`, `area:api`, `area:ui`

---

## 11. Checklist przed release'em

- [ ] Wszystkie testy jednostkowe przechodzą (CI green)
- [ ] Testy E2E scenariuszy krytycznych przechodzą
- [ ] Code coverage >= 80%
- [ ] Brak defektów P1/P2 otwartych
- [ ] Dokumentacja API aktualna

---

## 12. Plany na przyszłość

Poniższe typy testów są zaplanowane do implementacji w kolejnych fazach rozwoju projektu:

### 12.1 Testy bezpieczeństwa (Security Tests)
- Row Level Security (RLS) - próby dostępu do danych innych użytkowników
- Walidacja inputów (SQL injection, XSS)
- Autoryzacja API endpoints bez tokenu
- Ochrona metadanych AI (`is_manual_override` flag)
- **Narzędzia:** OWASP ZAP, custom test suites

### 12.2 Testy wydajnościowe (Performance Tests)
- Czas odpowiedzi API przy dużej liczbie transakcji
- Wydajność paginacji cursor-based (1000+ rekordów)
- Czas ładowania dashboardu
- Optymistyczne aktualizacje - responsywność UI
- **Narzędzia:** k6, Lighthouse, React Profiler

### 12.3 Testy dostępności (Accessibility Tests)
- Nawigacja klawiaturowa
- Atrybuty ARIA w komponentach interaktywnych
- Kontrast kolorów
- Obsługa czytników ekranowych
- **Narzędzia:** axe-core, Pa11y, Lighthouse

---

*Dokument przygotowany: 2025-01-30*
*Wersja: 1.1*