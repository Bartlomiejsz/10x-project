# Plan implementacji widoku Dashboard

## 1. Przegląd
Widok Dashboard prezentuje wykorzystanie budżetu dla wybranego miesiąca (`month=YYYY-MM`), łącząc wykres limit vs wydatki, pasek postępu globalnego, udział osób oraz listę transakcji z filtrami i sortowaniem. Umożliwia dodawanie/edycję wydatku (z badge pewności AI) oraz inline edycję limitów dla bieżącego i poprzedniego miesiąca (x-1). Starsze miesiące są tylko do podglądu. Kolory progów: <80% zielony, 80–100% pomarańczowy, >100% czerwony.

## 2. Routing widoku
- Ścieżka: `/` z opcjonalnym `?month=YYYY-MM`; domyślnie bieżący miesiąc.
- SSR Astro (`src/pages/index.astro`) z guardem autoryzacji (redirect do logowania przy braku sesji).
- Parametr `month` walidowany (format, zakres); fallback do bieżącego na błąd.
- Tryb edycji dostępny tylko dla `current` i `prev (x-1)`; >x-1 blokada (ikona kłódki, disabled).

## 3. Struktura komponentów
- `Layout` (Astro) → `DashboardPage` (React host lub Astro + wyspowe Reacty)
  - `MonthSelector` (sticky, aria-current na aktywnym)
  - `TopBar` (TotalProgress + CTA/FAB anchor)
  - `BudgetChart`
  - `PeopleShare`
  - `TransactionSection`
    - `TransactionToolbar` (filtry, sort, search)
    - `TransactionList` (infinite scroll)
      - `TransactionItem` (ConfidenceBadge, kwota, data, typ, akcje edit/delete, lock state)
    - `EmptyState` / `OverLimitBanner`
  - `FAB` + `TransactionDialog` (add/edit)
  - `ToastArea` (aria-live)

## 4. Szczegóły komponentów
### DashboardPage
- Opis: kontener odpowiedzialny za pobranie danych (budżety, transakcje, typy, udział osób), zarządzanie stanem miesiąca, loading/error boundaries.
- Główne elementy: sekcja nagłówka z MonthSelector, grid z kartami (BudgetChart, PeopleShare, TotalProgress), lista transakcji, FAB.
- Interakcje: zmiana miesiąca, refetch po mutacjach (add/edit/delete, update budget), obsługa błędów globalnych.
- Walidacja: poprawność `month`, blokada edycji dla >x-1.
- Typy: `DashboardDataVM`, `MonthParam`, `ReadonlyFlags`.
- Propsy: none (entry), hook-driven.

### MonthSelector
- Opis: wybór miesiąca (bieżący domyślny) z oznaczeniem aria-current.
- Elementy: listbox / segmented control, strzałki prev/next, sticky na mobile.
- Interakcje: onChange(month), keyboard nav.
- Walidacja: blokada wyboru > bieżącego; zaznaczenie trybu readonly (>x-1).
- Typy: `MonthOption { value: string; label: string; isReadonly: boolean; }`.
- Propsy: `value`, `onChange`, `options`.

### TopBar / TotalProgress
- Opis: globalny pasek postępu suma wydatków vs suma limitów.
- Elementy: progress bar z kolorami progów, kwoty formatowane (PLN, 2 miejsca), badge procentu.
- Interakcje: none.
- Walidacja: kolor wg procentu; gdy brak limitów -> neutralny stan.
- Typy: `TotalProgressVM { spend: number; budget: number; percent: number; status: 'ok'|'warn'|'over'; }`.
- Propsy: `vm: TotalProgressVM`.

### BudgetChart
- Opis: wykres słupkowy per kategoria: limit vs wydatki, kolory progów, tooltip.
- Elementy: bars, legend, tooltip (wydane, limit, procent, nadwyżka).
- Interakcje: hover tooltip, aria-describedby, fokus klawiatury.
- Walidacja: procenty, nadwyżka >0 dla czerwonego; gdy brak danych -> komunikat (US-034).
- Typy: `ChartItemVM { typeId; typeName; budget; spend; percent; status; overAmount; }`.
- Propsy: `items: ChartItemVM[]`.

### PeopleShare
- Opis: udział wydatków per osoba (procenty, kwoty).
- Elementy: list/mini-chart, kolory spójne z resztą.
- Interakcje: none.
- Walidacja: suma 100% (tolerancja), fallback gdy jeden user.
- Typy: `PeopleShareItem { userId; name; percent; amount; }`.
- Propsy: `items: PeopleShareItem[]`.

### TransactionSection
- Opis: wrapper dla filtrów/sortowania i listy.
- Elementy: `TransactionToolbar`, `TransactionList`, `EmptyState`.
- Interakcje: ustawianie filtra kategorii/opisu, sort (data/kwota asc/desc), clear filters.
- Walidacja: filtry lokalne; zapisy do query state.
- Typy: `TransactionFiltersState`.
- Propsy: `month`, `readonly`, handlers.

### TransactionToolbar
- Opis: UI do filtrów (kategoria select, search text), sort toggle, info o liczbie wyników.
- Elementy: select kategorii (z GET /api/transaction-types), input search, sort buttons.
- Interakcje: onFilterChange, onSortChange, onReset.
- Walidacja: `q` trim, debouncing; `type_id` must be number; sort w dozwolonym zestawie.
- Typy: `TransactionFilterVM { q?: string; typeId?: number; sort: 'date.desc'|'date.asc'|'amount.desc'|'amount.asc'; }`.
- Propsy: `value`, `onChange`, `options` (transaction types).

### TransactionList
- Opis: infinite scroll lista transakcji bieżącego miesiąca.
- Elementy: wiersze `TransactionItem`, loader sentinel, komunikaty brak danych / koniec.
- Interakcje: scroll load more, click edit/delete (gdy dozwolone), focus states.
- Walidacja: blokada akcji w readonly miesiącach; format kwot; data w zakresie.
- Typy: `TransactionListItemVM` (patrz Typy).
- Propsy: `items`, `hasMore`, `onLoadMore`, `readonly`, `onEdit`, `onDelete`.

### TransactionItem
- Opis: pojedynczy wiersz transakcji z kategorią, opisem, datą, kwotą, statusami AI.
- Elementy: opis, typ, kwota (kolor zależny od over-limit? – informacja), `ConfidenceBadge`, akcje edit/delete (ikona kłódki gdy readonly), tooltip AI.
- Interakcje: edit/delete click, hover tooltip.
- Walidacja: date format, kwota format (US-024), AI badge thresholds.
- Typy: `TransactionListItemVM`.
- Propsy: `item`, `readonly`, `onEdit`, `onDelete`.

### ConfidenceBadge
- Opis: badge pokazujący status AI (success/fallback/error) + confidence (wysoki/średni/niski).
- Elementy: kolorystyka, tooltip z detalami (status, score, fallback info).
- Interakcje: hover/focus tooltip.
- Walidacja: progowe mapowanie confidence (placeholder w config); fallback/error stany.
- Typy: `ConfidenceVM { status: 'success'|'fallback'|'error'; confidence?: number; level: 'high'|'medium'|'low'; }`.
- Propsy: `value: ConfidenceVM`.

### FAB + TransactionDialog
- Opis: przycisk dodawania wydatku (float) + modal dialog z formularzem.
- Elementy: fields: kwota, opis, data (zakres bieżący/x-1?), kategoria select (z suggestion), toggle is_manual_override.
- Interakcje: open/close, submit, cancel; prefill suggestion; keyboard a11y.
- Walidacja: kwota >0, 2 miejsca po przecinku, data w dozwolonym zakresie (≤ today, ≥ now-60d tbd), opis max 200 (TBD), kategoria wymagana, month constraint (must match selected month).
- Typy: `TransactionFormValues`, `CreateTransactionCommand` (z `is_manual_override`).
- Propsy: `open`, `onClose`, `onSubmit`, `defaultMonth`, `suggestedType?: TransactionTypeDTO`.

### EmptyState / OverLimitBanner
- Opis: komunikaty brzegowe (brak transakcji w miesiącu, przekroczenie limitu).
- Elementy: tekst + CTA (dodaj wydatek), ikony, kolory.
- Interakcje: CTA -> otwarcie dialogu.
- Walidacja: wyświetlać gdy spend=0 lub percent>100.
- Typy: proste string/percent.
- Propsy: `state`, `onCta`.

### ToastArea
- Opis: aria-live region na toasty sukces/błąd (operacje transakcji/budżetów).
- Interakcje: auto-hide, focus trapping nie dotyczy.
- Walidacja: treści przyjazne, neutralne dla AI błędów.
- Typy: `ToastMessage { type: 'success'|'error'|'info'; message: string; }`.
- Propsy: `messages`.

## 5. Typy
- Reużywane z `src/types.ts`: `TransactionTypeDTO`, `BudgetDTO`, `TransactionDTO`, `AIStatus`, `CreateTransactionCommand`, `UpdateTransactionCommand`, `PatchTransactionCommand`, `PaginatedResponse<T>`, `TransactionFilters`, `BudgetFilters`, `TransactionTypeFilters`.
- Nowe VM/DTO dla widoku:
  - `MonthParam = { value: string; date: Date }`.
  - `ReadonlyFlags = { isReadonly: boolean; canEditBudgets: boolean; canEditTransactions: boolean; }` (na bazie porównania z bieżącym miesiącem/x-1).
  - `ChartItemVM = { typeId: number; typeName: string; budget: number | null; spend: number; percent: number; status: 'ok'|'warn'|'over'; overAmount: number; }`.
  - `TotalProgressVM = { budget: number; spend: number; percent: number; status: 'ok'|'warn'|'over'; }`.
  - `PeopleShareItem = { userId: string; name: string; percent: number; amount: number; }`.
  - `TransactionListItemVM = { id: string; type: TransactionTypeDTO; amount: number; description: string; date: string; ai: ConfidenceVM; isManual: boolean; }`.
  - `DashboardDataVM = { chart: ChartItemVM[]; total: TotalProgressVM; people: PeopleShareItem[]; transactions: PaginatedResponse<TransactionListItemVM>; month: MonthParam; readonly: ReadonlyFlags; }`.
  - `ConfidenceVM = { status: 'success'|'fallback'|'error'; confidence?: number | null; level: 'high'|'medium'|'low'; }`.
  - `TransactionFilterVM` jak w toolbarze.
  - `TransactionFormValues = { amount: string; description: string; date: string; type_id: number; is_manual_override?: boolean; }`.

## 6. Zarządzanie stanem
- Hook `useMonthParam()` do parsowania/ustawiania `month` w query + obliczenie flags readonly.
- Hook `useDashboardData(month, filters)` do pobrania agregatów (budżety, transakcje, people share) z cache + invalidacja po mutacjach (add/edit/delete transaction, update budget). Można oprzeć o `useSWR`/`React Query` lub własny fetch + signals (w Astro wyspy React).
- Hook `useInfiniteTransactions(month, filters)` dla listy (cursor/offset fallback).
- Hook `useBudgetMutations()` do inline edycji limitu (optimistic update + rollback na błąd).
- Local state: filtry/sort, dialog open, editing item, toasty, loading/error flags.
- Global a11y: aria-live messages, focus management po mutacjach.

## 7. Integracja API
- `GET /api/transaction-types` z `order=position.asc` (default) do selektorów; handle 401/500.
- `GET /api/budgets?month=YYYY-MM` do limitów per kategoria; typ `BudgetDTO[]`.
- (Zakładane) `GET /api/transactions?month=YYYY-MM&filters...` zwraca `PaginatedResponse<TransactionDTO>`; map do VM.
- (Zakładane) `POST /api/transactions` do dodania (body `CreateTransactionCommand`), wynik `TransactionDTO` + AI metadata.
- (Zakładane) `PUT/PATCH /api/transactions/:id` do edycji, `DELETE /api/transactions/:id` do usunięcia.
- (Zakładane) endpoint agregatów people share / monthly report; jeśli brak, obliczyć klientem z listy transakcji (perf tradeoff) lub dodać `GET /api/reports/monthly?month=...` (z `MonthlyReportDTO`).
- Headers `Content-Type: application/json`; walidacja odpowiedzi; obsługa 401 (redirect), 400 (validation), 500 (toast + retry CTA).

## 8. Interakcje użytkownika
- Zmiana miesiąca: aktualizacja query, refetch danych, blokada edycji w trybie readonly (>x-1).
- Filtry/sort: natychmiastowe odświeżenie listy; zachowanie parametrów przy scrollu.
- Infinite scroll: ładowanie kolejnych stron; loader w stopce; zatrzymanie przy `hasMore=false`.
- Dodanie transakcji (FAB): otwarcie dialogu, walidacja, submit -> API -> toast sukces/błąd, lista i wykresy się odświeżają (US-022).
- Edycja/usunięcie transakcji: dostępne tylko w edytowalnych miesiącach; po sukcesie invalidacja listy i agregatów.
- Inline edycja limitu: na blur/enter zapis; optimistic update; rollback na błąd; niedostępne w readonly.
- Tooltipy AI (ConfidenceBadge) z komunikatem o statusie i źródle (AI/fallback/error).
- Responsywność: układ kart w kolumnę <640px, MonthSelector sticky, brak poziomego scrolla (US-029).

## 9. Warunki i walidacja
- Parametr `month` format `YYYY-MM`, nie przyszłość; fallback do bieżącego.
- Edycje limitów tylko dla `current` i `x-1`; transakcje analogicznie (US-013, US-038).
- Kwota: >0, dwa miejsca po przecinku w prezentacji; wejście akceptuje kropkę/przecinek, normalizacja (US-024).
- Data transakcji: ≤ dziś, ≥ (today - 60d) TBA; musi należeć do wybranego miesiąca.
- Kategoria: wymagana, pochodzi z listy `transaction_types`.
- Sort: dozwolone wartości; filtry category/search opcjonalne.
- Kolory progów wg procentu (zielony/pomarańczowy/czerwony); overLimitBanner gdy percent>100 (US-035).
- Brak danych: komunikat zachęty (US-034), wykres z zerami.

## 10. Obsługa błędów
- 401: redirect do logowania + komunikat; zabezpieczenie middleware.
- 400 walidacja formularza: pokaż inline errors; nie wysyłaj jeśli lokalna walidacja nie przejdzie.
- 500/timeout: toast neutralny, możliwość ponowienia; zachowaj dane formularza (US-036 analogicznie do sieci offline).
- AI fallback: komunikat neutralny w tooltip; confidence badge niski -> zachęta do korekty.
- Duże opóźnienia/infinite scroll błąd: pokaż retry button w stopce listy.

## 11. Kroki implementacji
1. Dodać stronę `src/pages/index.astro` z guardem auth i przekazaniem parametru `month`; ustawić layout.
2. Zaimplementować hook `useMonthParam` (parsowanie, default, readonly flags) i provider stanu widoku (filters, toasts, dialog state).
3. Zaimplementować fetchery do `GET /api/transaction-types`, `GET /api/budgets?month=...` oraz (jeśli brak) szkic fetchera transakcji/raportu miesięcznego; dodać typy VM mapujące DTO.
4. Zbudować komponent `MonthSelector` (sticky, aria-current) oraz `TopBar/TotalProgress`.
5. Zaimplementować `BudgetChart` z kolorami progów i tooltipami; dodać `OverLimitBanner` i stan pusty.
6. Zaimplementować `PeopleShare` (dane z API lub wyliczone z transakcji) z fallbackiem gdy brak danych.
7. Zaimplementować `TransactionToolbar` (filtry, sort) + `TransactionList` z infinite scroll i `TransactionItem` + `ConfidenceBadge`; uwzględnić readonly/locked akcje.
8. Dodać `FAB + TransactionDialog` z walidacją (kwota, data, opis, kategoria, month constraint) i integracją z API create transaction; po sukcesie invalidacja danych i toast.
9. Dodać inline edycję budżetów (input/slider) z walidacją i optimistic update; blokada w readonly.
10. Dodać toasty (aria-live), komunikaty edge (brak danych, przekroczenie limitu), responsywne layouty Tailwind.
11. Przeprowadzić manualne testy: zmiana miesiąca, add/edit/delete, edycja limitu, filtry/sort, infinite scroll, kolory progów, readonly dla >x-1, format kwot; dodać e2e scenariusze krytyczne.
