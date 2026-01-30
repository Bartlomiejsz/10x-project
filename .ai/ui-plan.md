# Architektura UI dla HomeBudget

## 1. Przegląd struktury UI
- PWA Astro/React: główny widok typu dashboard łączący budżet, wykresy i listę transakcji; oddzielna strona importu CSV; modalowe dodawanie/edycja transakcji.
- Nawigacja: bottom nav (mobile) / top nav (desktop) z sekcjami: Dashboard, Transakcje, Import; sticky header z selektorem miesiąca i statusem blokady edycji.
- Layouty: wspólny shell z toasts, globalnym loaderem AI i stanami connectivity; widoki reagują na query `month`, filtry i kursory.
- Integracja API: /api/transactions (lista, create, batch), /api/budgets (upsert), /api/transaction-types (dict), /api/reports/monthly (agregaty); zgodność z cursor-based pagination i upsertami budżetów.

## 2. Lista widoków

### Dashboard (budżet bieżącego/pokazanego miesiąca)
- Ścieżka: `/` z `?month=YYYY-MM`
- Cel: szybki wgląd w wykorzystanie budżetu i akcję dodania wydatku.
- Kluczowe informacje: wykres limit vs wydatki z progami kolorów, pasek postępu globalny, udział osób, lista transakcji (bieżący miesiąc domyślnie), statusy AI, komunikaty edge (brak danych, przekroczenie limitu).
- Kluczowe komponenty: `MonthSelector` (sticky), `BudgetChart`, `TotalProgress`, `PeopleShare`, `TransactionList` (infinite scroll, filtry, sort), `FAB` + `TransactionDialog`, `ConfidenceBadge`, toasts.
- UX/a11y/bezpieczeństwo: kolory progów (<80 zielony, 80–100 pomarańcz, >100 czerwony), badge AI z tooltipami, aria-live toasts, aria-current dla aktywnego miesiąca, blokada edycji dla miesięcy > x-1 (ikona kłódki, disabled inputs), autoryzacja przed renderem danych.

### Transakcje (lista/filtry szczegółowe)
- Ścieżka: `/transactions` z query (month, category, search, sort, start_date, end_date).
- Cel: przegląd, filtrowanie i edycja pojedynczych transakcji.
- Kluczowe informacje: tabela/virtual list z datą, kwotą, opisem (truncate + tooltip/accordion), kategorią, badge AI, ikony edit/delete, filtry i sortowanie.
- Kluczowe komponenty: `TransactionList` (cursor 50, pull-to-refresh), `FiltersBar` (Select kategorii, search, zakres dat), `SortControls`, `InlineCategoryEdit`, `DeleteConfirmDialog`, `PaginationStatus` (licznik pobranych).
- UX/a11y/bezpieczeństwo: focusable wiersze, klawiaturowa nawigacja, aria-sort na kolumnach, confirm przed delete, 403/401 toasts, guard na miesiące > x-1 (brak edit/delete), offline banner przy błędzie sieci.

### Import CSV (multi-step)
- Ścieżka: `/import` oraz `/import/:jobId` (raport/progress).
- Cel: masowe dodanie wydatków z walidacją, deduplikacją i korektą kategorii.
- Kluczowe informacje: status uploadu, tabela podglądu (checkbox, data, kwota, opis, kategoria, status, duplikat), licznik poprawnych/błędnych/duplikatów, progress jobu, raport 207.
- Kluczowe komponenty: `UploadZone`, `ImportTable` (sticky header, virtual scroll, inline Select kategorii), `BulkActions` (zaznacz poprawne, odznacz duplikaty), `ImportSummary`, `ProgressBar`, `ReportPanel`.
- UX/a11y/bezpieczeństwo: walidacja on-upload (kolumny, encoding), wyróżnienie błędów (red row), duplikaty odznaczone domyślnie, możliwość anulowania (reset stanu), aria-live dla progress, rozdzielenie kroków (breadcrumb), ograniczenie rozmiaru pliku, komunikaty neutralne przy błędach AI.

### Modal dodawania/edycji wydatku
- Ścieżka: modal z `/` lub `/transactions`; deep-link `/transactions/:id` otwiera modal.
- Cel: szybkie dodanie/edycja pojedynczej transakcji z AI sugestią.
- Kluczowe informacje: pola kwota, opis, data (zakres: bieżący + ostatnie 60 dni), kategoria (suggested), badge confidence, status AI, komunikat o offline.
- Kluczowe komponenty: `TransactionForm` (react-hook-form + Zod), `AmountInput` (multi-stage validation), `DatePicker` z ograniczeniem, `CategorySelect`, `ConfidenceBadge`, `SkeletonLoader` dla AI, `Toast` po kategoryzacji.
- UX/a11y/bezpieczeństwo: auto-focus, Esc zamyka, Cmd/Ctrl+N otwiera, aria-describedby z błędami walidacji, blokada submit przy 401/422, optymistyczny zapis z rollbackiem na błąd, logika months guard (read-only dla historycznych).

### Szczegóły transakcji
- Ścieżka: `/transactions/:id` (modal overlay).
- Cel: podgląd pełnych danych i historii kategorii; akcje edycji/usunięcia (jeśli dozwolone).
- Kluczowe informacje: opis pełny, data, kwota, kategoria, status AI, ai_confidence, import_hash, manual override, (opcjonalnie) log zmian.
- Kluczowe komponenty: `TransactionDetailCard`, `HistoryList` (jeśli log korekt dostępny), `ActionButtons` (edit/delete), `StatusBadge`.
- UX/a11y/bezpieczeństwo: rolę dialog, trap focus, disable akcji dla miesięcy > x-1, confirm delete, 404 toast przy braku id.

### Historyczne miesiące (read-only)
- Ścieżka: `/` lub `/transactions` z `month` starszym niż x-1.
- Cel: podgląd danych bez edycji.
- Kluczowe informacje: wykres i lista w trybie read-only, ikonki kłódki, komunikat o ograniczeniu edycji.
- Kluczowe komponenty: te same co Dashboard/Transakcje z flagą readOnly.
- UX/a11y/bezpieczeństwo: wyłączone pola, aria-disabled, 403 przy próbie edycji via URL.

### Autoryzacja / Logowanie (entry gate)
- Ścieżka: `/login` (lub modal guard), redirect z chronionych ścieżek.
- Cel: zapewnić dostęp wyłącznie zalogowanym.
- Kluczowe informacje: CTA „Zaloguj przez Google”, info o współdzielonym gospodarstwie.
- Kluczowe komponenty: `OAuthButton`, `AuthGuard` wrapper, `SessionRefresh` handler.
- UX/a11y/bezpieczeństwo: aria-label na przycisku, obsługa błędów logowania bez utraty stanu, redirect back.

## 3. Mapa podróży użytkownika
- Dodanie wydatku (US-004/005/006/007/011/021/022/023/030/036): FAB/Cmd+N → modal → onChange/onBlur/onSubmit walidacja → optymistyczny zapis (AI skeleton → badge) → toast o kategoryzacji → lista/wykres auto-refresh; błędy sieci pokazują toast + zachowanie danych w formularzu.
- Import CSV (US-014/015/016/017/018/019/031): bottom nav → `/import` → upload + walidacja kolumn → podgląd z kategoriami AI (skeleton) i duplikatami off → inline korekty → potwierdzenie → POST batch → progress (jobId) → raport 207 → CTA powrót do dashboard; błędne wiersze nie blokują (skip + raport).
- Edycja limitu (US-008/013/022/035): klik słupek/kwotę → inline input → debounce 500ms PUT /api/budgets → optymistyczny update wykresu → toast; dla miesięcy > x-1 disabled.
- Przegląd historii (US-012/037/038): sticky/hybrid MonthSelector → zmiana query `month` → fetch reports + transactions → tryb read-only gdy wymagane.
- Przegląd/sort/filtr transakcji (US-032/033/034): filtry/search/sort → GET /api/transactions z parametrami → update listy; brak wyników pokazuje zachętę do dodania.

## 3a. Szkice przepływów (high-level)
- Dodanie wydatku: stan Idle → modal otwarty → walidacja onChange/onBlur → optymistyczny POST /api/transactions (kategoria Inne) → stan AI pending (skeleton) → callback AI aktualizuje kategorię/badge → toast sukces/błąd → odświeżenie listy/wykresu.
- Edycja limitu: klik słupek → pole inline → debounce 500ms → PUT /api/budgets/:month_date/:type_id → optymistyczny update wykresu → toast; w razie 4xx/5xx rollback wartości i komunikat.
- Import CSV: `/import` → upload pliku → walidacja schematu/encoding → tabela podglądu z kategoriami AI (pending) → użytkownik edytuje/odznacza duplikaty → potwierdzenie → POST /api/transactions batch (jobId) → ekran progress (poll job) → raport 207 → CTA powrót do dashboard.
- Przegląd historii miesiąca: zmiana `month` w selektorze → GET /api/reports/monthly + /api/transactions z parametrami → render read-only dla miesięcy > x-1 (disable akcji) → możliwość powrotu do bieżącego miesiąca.
- Obsługa braku sieci podczas dodawania: modal wypełniony → submit → błąd sieci → toast + zachowanie danych lokalnie (UIStore) → po odzyskaniu sieci banner „dodaj ponownie” → retry POST.

## 4. Układ i struktura nawigacji
- Bottom nav (mobile): `Dashboard (/)`, `Transakcje (/transactions)`, `Import (/import)`; ikony + aria-label, aktywny z aria-current.
- Desktop: top nav / sidebar z tymi samymi sekcjami; sticky header zawiera MonthSelector, szybki filtr, przycisk „Dodaj wydatek”.
- Deep linking: query `?month=YYYY-MM` na dashboard/list; `/transactions/:id` otwiera modal na tle poprzedniego widoku; `/import/:jobId` dla raportu jobu.
- View Transitions API dla miękkiej nawigacji między głównymi widokami i stanami modala.

## 5. Kluczowe komponenty (wielokrotnego użycia)
- `MonthSelector` (dropdown + swipe carousel): obsługa read-only miesięcy, aria-controls list/wykres, aktualizacja query param.
- `BudgetChart` + `TotalProgress`: kolory progów, inline edit limitów (debounce), tooltip z różnicą przy >100%.
- `TransactionList` + `TransactionRow`: virtual scroll, truncate opisów, badge AI, inline category select, delete confirm, infinite scroll/pull-to-refresh.
- `TransactionDialog` (add/edit): formularz Zod, skeleton AI, confidence badge, offline banner, optymistyczny zapis.
- `ConfidenceBadge`: kolory wg progów (niski<50, średni 50–80, wysoki>80), ikona ostrzeżenia przy niskim.
- `ImportTable` + `BulkActions` + `ProgressBar` + `ReportPanel`: inline edit kategorii, oznaczenia duplikatów/błędów, raport 207.
- `ToastStack` / `UIStore`: aria-live polite, komunikaty sukces/błąd, sesja wygasła (401), brak sieci.
- `AuthGuard` + `SessionRefresh`: przekierowanie na login przy braku tokenu, ciche odświeżenie.

## Mapowanie wymagań PRD → UI (wybrane)
- US-001/002/025/026: `AuthGuard`, `/login`, redirect + toasts, session refresh.
- US-004/005/006/007/011/021/023/024/030/036: `TransactionDialog`, `ConfidenceBadge`, skeleton AI, guard zakresu dat 60 dni, confirm delete, offline banner, błędy walidacji inline.
- US-008/013/022/035: `BudgetChart` inline edit + debounce, kolor progów, tooltip różnicy.
- US-009/010/012/017/034/037/038: `BudgetChart`, `PeopleShare`, read-only history, brak wydatków komunikat.
- US-014/015/016/017/018/019/031: `ImportTable`, `BulkActions`, raport 207, duplikaty off, błędne wiersze skip.
- US-020: fallback słów kluczowych → badge „Słowa kluczowe”, kategoria „Inne”.
- US-028/029: mobile-first layout, lazy/lite shell, virtual scroll.
- Edge: przekroczenie limitu (czerwony, tooltip różnicy), brak connectivity (banner), brak danych (empty state CTA), próba edycji historycznych (disabled + 403 toast).

## Zgodność z API
- Lista/filtry/sort transakcji używa `/api/transactions` z cursor 50, params start/end/type/q/order; inline edit PATCH/PUT; delete DELETE.
- Dodawanie transakcji (single/batch) POST; import korzysta z batch (207 Multi-Status) + `/import/:jobId` status.
- Budżety: inline edit PUT/POST upsert `/api/budgets/:month_date/:type_id` z normalizacją month_date.
- Słowniki: `/api/transaction-types` dla Select kategorii (cache lokalny, read-only).
- Agregaty: `/api/reports/monthly?month=YYYY-MM` dla wykresów i paska postępu.

## Edge cases i bezpieczeństwo
- Offline: banner + zachowanie formularza w localStorage; blokada submit, możliwość zapisania roboczo.
- Duplikaty importu: oznaczone, domyślnie odznaczone; raport w `/import/:jobId`.
- Brak danych miesiąca: empty states + CTA „Dodaj wydatek”/„Zaimportuj CSV”.
- Przekroczenie limitu: czerwone słupki, tooltip z nadwyżką.
- Sesja wygasła: 401 toast + redirect na login.
- Rate limiting: toasts na 429 (jeśli middleware zwróci); UI retry/pull-to-refresh.
- Dostępność: aria landmarki (`main`, `nav`), role dialog/listbox/button, aria-live dla toasts/progress, focus trap w modalach, klawisze skrótów (Cmd/Ctrl+N, Esc), odpowiedni kontrast.
