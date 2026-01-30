# Podsumowanie konwersacji dotyczącej architektury UI dla HomeBudget MVP

## Decyzje podjęte przez użytkownika

1. **Dashboard jako zintegrowany widok budżetu** - Ekran główny będzie jednocześnie widokiem budżetu bieżącego miesiąca z wykresem słupkowym, paskiem postępu, udziałem osób i szybkim dostępem do dodawania wydatku.

2. **Optymistyczne UI dla kategoryzacji AI** - Natychmiastowe dodanie wydatku z kategorią "Inne" i wskaźnikiem ładowania, z aktualizacją po otrzymaniu odpowiedzi AI. Toast notification o zakończeniu kategoryzacji.

3. **Infinite scroll z cursor-based pagination** - Lista transakcji będzie używać infinite scroll z limitem 50 transakcji na żądanie, z opcją "scroll to top" i wskaźnikiem liczby elementów.

4. **Import CSV jako osobna strona** - Multi-step proces (upload → podgląd/edycja → potwierdzenie → raport) na dedykowanej stronie `/import`.

5. **Inline editing limitów budżetowych** - Bezpośrednia edycja w komponencie wykresu z debouncing 500ms przed wywołaniem API.

6. **System kolorowych badge'y dla statusów AI** - Zielony (AI ✓), żółty (AI ~), pomarańczowy (Słowa kluczowe), czerwony (Wymaga weryfikacji) z ikoną "edit" przy każdej transakcji.

7. **Sticky header z selektorem miesiąca** - Zawsze widoczny dropdown z ostatnimi 6 miesiącami i wizualną ikoną kłódki dla miesięcy read-only.

8. **Brak Service Worker w MVP** - Implementacja cache-first strategy i offline scenarios odroczona do kolejnej wersji. W MVP wymagane połączenie online z opcją zapisania formularza lokalnie.

9. **Bottom navigation bar (mobile-first)** - 3 sekcje: Dashboard, Transakcje, Import (bez ikony Profil/Ustawienia).

10. **Walidacja formularzy z Zod** - Share schemas między backendem a frontendem, wykorzystanie react-hook-form z walidacją on-blur i on-submit.

11. **Brak onboardingu** - Aplikacja używana wewnętrznie w wąskim gronie, brak potrzeby procesu onboardingu.

12. **Zustand do state management** - Z persist middleware dla minimalnego boilerplate i integracji z React 19. Struktura: budgetStore, authStore, uiStore.

13. **Brak real-time updates** - Odświeżanie po scrollu z góry (pull-to-refresh) zamiast polling lub WebSocket.

14. **FAB + modal dla dodawania wydatku** - Floating Action Button w prawym dolnym rogu na mobile, modal z formularzem, shortcut Cmd/Ctrl + N.

15. **Skeleton loader dla kategoryzacji AI** - Animowany puls z tekstem "AI analizuje...", smooth transition do badge z micro-animation.

16. **Inline editable tabela importu CSV** - Dropdown w kolumnie kategorii, read-only dla innych pól, sticky header + virtual scrolling dla >100 wierszy.

17. **Truncate długich opisów** - Do 50 znaków z ellipsis, tooltip na hover/focus, tap na mobile rozwija accordion.

18. **Hybrid approach dla selektora miesiąca** - Dropdown na desktop (ostatnie 6 + calendar picker), horizontal swipeable carousel na mobile.

19. **Multi-stage validation dla kwoty** - onChange (format), onBlur (business rules), onSubmit (final + server-side).

20. **Deep linking z query params** - URL structure: `/`, `/?month=2024-01`, `/transactions/:id`, `/import`, `/import/:jobId`. View Transitions API dla smooth navigation.

## Dopasowane rekomendacje

1. **Dashboard jako zintegrowany widok** - Eliminuje dodatkowy krok nawigacji i realizuje cel szybkiego monitorowania stanu budżetu.

2. **Optymistyczne UI** - Użytkownik może kontynuować pracę bez blokowania interfejsu podczas kategoryzacji AI (do 2s + retry).

3. **Infinite scroll** - Lepszy UX na urządzeniach mobilnych (główny use case PWA), cursor-based pagination jest wystarczająca.

4. **Osobna strona importu** - Import jest złożoną operacją wymagającą przestrzeni na tabelę z wieloma wierszami i opcjami.

5. **Inline editing** - Zgodne z wymaganiem "intuicyjne inline edycje" i minimalizuje friction. Debouncing unika nadmiernych requestów API.

6. **System badge'y** - Wyraźne wizualne odróżnienie statusów AI i confidence levels z tooltipami i zachętą do weryfikacji.

7. **Sticky header** - Zawsze dostępny kontekst czasowy jest kluczowy dla aplikacji budżetowej.

8. **Bottom navigation** - Zgodne z wzorcami PWA i ergonomią mobile (kciuk może łatwo sięgnąć dolnej części ekranu).

9. **Shared Zod schemas** - Walidacja on-blur i on-submit z react-hook-form, błędy inline po polsku (zgodnie z PRD).

10. **Zustand** - Minimalny boilerplate, lepsza integracja z React 19, dobrze współgra z Astro SSR.

11. **FAB + modal** - Primary action zgodnie z Material Design patterns, zapewnia focus bez zabierania przestrzeni dashboard.

12. **Skeleton loader** - Visual feedback podczas kategoryzacji AI z smooth transitions i micro-animations.

13. **Inline editable CSV** - Efektywna edycja kategorii bez przełączania kontekstu, virtual scrolling dla wydajności.

14. **Truncate z tooltip** - Zachowuje spójność layoutu, search highlighting dla filtrowanej frazy.

15. **Hybrid selektor** - Desktop dropdown + mobile carousel inspirowany Google Calendar.

16. **Multi-stage validation** - Instant feedback bez error message na onChange, business rules validation na onBlur.

17. **Deep linking** - Proper meta tags dla share links, query params syncowane z URL dla bookmarking.

## Szczegółowe podsumowanie planowania architektury UI

### Kluczowe widoki i ekrany

**1. Dashboard (`/` lub `/?month=YYYY-MM`)**
- Zintegrowany widok budżetu bieżącego miesiąca
- Sticky header z selektorem miesiąca (dropdown: ostatnie 6 miesięcy + "Wszystkie")
- Wykres słupkowy poziomy: limit vs wydatki z kolorystyką progów
    - <80% zielony
    - 80-100% pomarańczowy
    - >100% czerwony
- Sumaryczny pasek postępu (całkowity wydatek vs suma limitów)
- Udział osób w wydatkach (procentowy)
- FAB (Floating Action Button) w prawym dolnym rogu → modal dodawania wydatku
- Lista transakcji z infinite scroll (limit 50, cursor-based pagination)

**2. Lista transakcji**
- Komponenty wiersza:
    - Checkbox dla bulk actions
    - Data (read-only)
    - Kwota (formatowana 2 miejsca po przecinku)
    - Opis (truncated do 50 znaków + tooltip/accordion na mobile)
    - Kategoria badge (kolorowy system statusów AI)
    - Ikona edit (inline editing kategorii)
    - Ikona delete (tylko bieżący miesiąc)
- Filtry: kategoria, opis (search), zakres dat
- Sortowanie: data (asc/desc), kwota
- Pull-to-refresh na mobile dla odświeżania danych

**3. Import CSV (`/import`)**
- Multi-step proces:
    - **Krok 1: Upload** - drag & drop lub file picker
    - **Krok 2: Podgląd/edycja** - tabela z inline editable kategorii
        - Kolumny: Checkbox, Data, Kwota, Opis (truncated), Kategoria (dropdown), Status badge, Akcja (kosz)
        - Sticky header + virtual scrolling (react-window) dla >100 wierszy
        - Bulk actions: "Zaznacz wszystkie poprawne", "Odznacz duplikaty"
    - **Krok 3: Potwierdzenie** - podsumowanie: poprawne/duplikaty/błędne
    - **Krok 4: Raport** - wyniki importu z możliwością powrotu do dashboard

**4. Modal dodawania/edycji wydatku**
- Pola formularza:
    - Kwota (PLN) - multi-stage validation
    - Opis (max 255 znaków)
    - Data (date picker z ograniczeniem: ostatnie 60 dni + bieżący miesiąc)
    - Kategoria (dropdown lub AI suggestion z skeleton loader)
    - Badge pewności AI (kolorowy + tooltip)
- Shortcut klawiszowy: Cmd/Ctrl + N
- Walidacja: onChange (format), onBlur (business rules), onSubmit (final)
- Auto-formatting kwoty na blur (np. "10.5" → "10.50 PLN")

**5. Szczegóły transakcji (`/transactions/:id`)**
- Modal overlay z background dashboard
- Pełny opis transakcji
- Historia zmian kategorii (jeśli dostępne)
- Opcje: edycja, usunięcie

### Przepływy użytkownika

**Przepływ 1: Dodanie wydatku z AI kategoryzacją**
1. Użytkownik klika FAB lub Cmd/Ctrl + N
2. Modal z formularzem
3. Wypełnia kwotę, opis, datę
4. Po wpisaniu opisu → skeleton loader "AI analizuje..."
5. Po 0-2s → smooth transition do badge z kategorią + micro-animation
6. Użytkownik może zaakceptować lub zmienić kategorię
7. Submit → optymistyczne UI (natychmiastowe dodanie z kategorią "Inne")
8. Po otrzymaniu odpowiedzi AI → aktualizacja kategorii i badge
9. Toast notification o zakończeniu kategoryzacji
10. Dashboard aktualizuje wykres i listę

**Przepływ 2: Import CSV**
1. Użytkownik przechodzi do `/import` (bottom navigation)
2. Upload pliku (drag & drop lub file picker)
3. Walidacja formatu i kolumn
4. Podgląd tabeli z propozycjami kategorii AI (skeleton loader dla każdego wiersza)
5. Użytkownik edytuje kategorie inline (dropdown)
6. Duplikaty automatycznie odznaczone
7. Bulk actions: zaznaczenie poprawnych, odznaczenie duplikatów
8. Potwierdzenie → POST /api/transactions (batch)
9. Asynchroniczne przetwarzanie z progress bar
10. Raport końcowy: liczba dodanych, duplikatów, błędnych
11. Powrót do dashboard z zaktualizowanym wykresem

**Przepływ 3: Edycja limitu budżetowego**
1. Użytkownik klika na słupek kategorii w wykresie
2. Inline editable input (focus)
3. Wpisuje nową wartość
4. Blur/Enter → debouncing 500ms → PUT /api/budgets/:month_date/:type_id
5. Wykres aktualizuje procent wykorzystania i kolor (real-time)
6. Toast notification o zapisaniu

**Przepływ 4: Przeglądanie historii miesięcy**
1. Użytkownik klika selektor miesiąca (sticky header)
2. Desktop: dropdown z ostatnimi 6 miesiącami + "Więcej..." → calendar picker
3. Mobile: horizontal swipeable carousel (previous/next arrows)
4. Wybiera miesiąc → URL aktualizuje query param `?month=YYYY-MM`
5. Dashboard ładuje dane miesiąca (lista + wykres)
6. Miesiące starsze niż x-1: read-only (brak przycisków edycji/usuwania, ikona kłódki)
7. Miesiąc x-1: edycja limitów dozwolona

### Strategia integracji z API i zarządzania stanem

**State Management: Zustand**

```typescript
// src/lib/store/budgetStore.ts
interface BudgetState {
  budgets: Budget[];
  transactions: Transaction[];
  selectedMonth: string; // YYYY-MM
  filters: {
    category?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  };
  pagination: {
    cursor?: string;
    hasMore: boolean;
  };
  setBudgets: (budgets: Budget[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setSelectedMonth: (month: string) => void;
  setFilters: (filters: Partial<BudgetState['filters']>) => void;
  loadMoreTransactions: () => Promise<void>;
  refreshData: () => Promise<void>;
}

// src/lib/store/authStore.ts
interface AuthState {
  user: User | null;
  session: Session | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
}

// src/lib/store/uiStore.ts
interface UIState {
  isImportModalOpen: boolean;
  toasts: Toast[];
  loadingStates: Record<string, boolean>;
  setImportModalOpen: (open: boolean) => void;
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
  setLoading: (key: string, loading: boolean) => void;
}
```

**Integracja z API**

1. **GET /api/transactions** - Lista transakcji
    - Wywołana przy montowaniu Dashboard
    - Infinite scroll: `loadMoreTransactions()` z `cursor` i `limit=50`
    - Filtry syncowane z query params: `?month=2024-01&category=5&search=kaufland`
    - Pull-to-refresh: `refreshData()` resetuje cursor

2. **POST /api/transactions** - Dodanie wydatku
    - Optymistyczne UI: natychmiastowe dodanie do lokalnego state z kategorią "Inne"
    - Request AI kategoryzacji (async)
    - Callback aktualizuje kategorię i badge w store
    - Toast notification o zakończeniu

3. **POST /api/transactions (batch)** - Import CSV
    - Async job z progress tracking
    - Status job: `/api/imports/:jobId`
    - Raport końcowy: 207 Multi-Status z per-item results

4. **PUT /api/budgets/:month_date/:type_id** - Edycja limitu
    - Debouncing 500ms przed requestem
    - Optymistyczna aktualizacja lokalnego state
    - Rollback w razie błędu

5. **GET /api/reports/monthly?month=YYYY-MM** - Agregacje
    - Wywołana przy zmianie miesiąca
    - Cache w Zustand store (invalidacja przy dodaniu/usunięciu transakcji)

**Walidacja z Zod**

```typescript
// src/lib/schemas/transaction.ts
export const transactionCreateSchema = z.object({
  type_id: z.number().int().positive(),
  amount: z.number().min(0.01).max(99999.99),
  description: z.string().max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (date) => new Date(date) >= new Date('2000-01-01') && new Date(date) <= new Date(),
    { message: "Data musi być z zakresu 2000-01-01 do dziś" }
  ),
  import_hash: z.string().optional(),
  is_manual_override: z.boolean().optional(),
});

// Używane w react-hook-form:
// const form = useForm({
//   resolver: zodResolver(transactionCreateSchema),
// });
```

### Responsywność, dostępność i bezpieczeństwo

**Responsywność**
- Mobile-first approach z breakpoints:
    - Mobile: <640px (sm)
    - Tablet: 640-1024px (md, lg)
    - Desktop: >1024px (xl, 2xl)
- Bottom navigation bar na mobile → top navigation na desktop
- Horizontal swipeable carousel (selektor miesiąca) na mobile → dropdown na desktop
- FAB na mobile → przycisk w top bar na desktop
- Tabela importu CSV: sticky header + virtual scrolling na wszystkich urządzeniach

**Dostępność (WCAG 2.1 Level AA)**
- ARIA landmarks: `main`, `navigation`, `search`
- ARIA roles: `dialog` (modal), `button` (FAB), `listbox` (dropdown)
- `aria-expanded` i `aria-controls` dla selektor miesiąca
- `aria-label` dla FAB ("Dodaj wydatek")
- `aria-live="polite"` dla toast notifications
- `aria-describedby` dla pól formularza z błędami walidacji
- `aria-current="page"` dla aktywnego miesiąca w selektorze
- Keyboard navigation: Tab, Enter, Esc (zamknięcie modala), Cmd/Ctrl + N (dodaj wydatek)
- Focus management: auto-focus na pierwszy input w modalu
- Color contrast: minimalne 4.5:1 dla tekstu, 3:1 dla komponentów UI

**Bezpieczeństwo**
- **Authentication**: Supabase Auth (JWT) w header `Authorization: Bearer <token>`
- **Authorization**: RLS w Supabase, server-side walidacja tokenu w Astro middleware
- **Rate limiting**: middleware `src/middleware/index.ts` (10 req/s, 5k req/day per user)
- **Input sanitization**: Zod validation, brak raw SQL concatenation, parameterized queries
- **CSRF protection**: Supabase client automatycznie obsługuje CSRF tokens
- **XSS protection**: React automatyczne escaping, DOMPurify dla user-generated content (opisy)
- **Content Security Policy**: strict CSP headers w Astro config

### Komponenty UI i wzorce interakcji

**Shadcn/ui Components**
- `Button` - FAB, primary actions, submit
- `Input` - pola formularza (kwota, opis)
- `Select` - dropdown kategorii, selektor miesiąca
- `Dialog` - modal dodawania/edycji wydatku
- `Table` - lista transakcji, podgląd importu CSV
- `Badge` - status AI, confidence level
- `Toast` - notifications (success, error, info)
- `Skeleton` - loading state dla kategoryzacji AI
- `Calendar` - date picker w formularzu
- `Progress` - pasek postępu importu CSV
- `Tooltip` - pełny opis transakcji (truncated text)

**Custom Components**
- `BudgetChart` - wykres słupkowy (Canvas API lub Recharts)
- `TransactionList` - lista z infinite scroll (react-window)
- `MonthSelector` - hybrid desktop/mobile selektor
- `FAB` - floating action button
- `ImportTable` - tabela z inline editing (react-window + Shadcn Table)
- `ConfidenceBadge` - badge z kolorystyką i tooltipem
- `PullToRefresh` - pull-to-refresh gesture na mobile

**Wzorce interakcji**
- **Optymistic UI** - natychmiastowa aktualizacja lokalnego state, rollback przy błędzie
- **Debouncing** - inline editing limitów (500ms), search input (300ms)
- **Skeleton loading** - kategoryzacja AI, ładowanie listy
- **Toast notifications** - feedback dla akcji (dodanie, edycja, usunięcie, błędy)
- **Inline editing** - limity budżetowe, kategorie w imporcie CSV
- **Modal overlay** - dodawanie/edycja wydatku, szczegóły transakcji
- **Bulk actions** - import CSV (zaznacz wszystkie, odznacz duplikaty)
- **Pull-to-refresh** - odświeżanie listy transakcji na mobile
- **Infinite scroll** - lista transakcji (cursor-based pagination)

### Strategia buforowania i optymalizacji wydajności

**Brak Service Worker w MVP** - implementacja odroczona do kolejnej wersji

**Client-side caching**
- Zustand persist middleware dla `selectedMonth`, `filters`
- LocalStorage dla formularza offline (gdy brak connectivity)
- Cache wykresu budżetu (invalidacja przy dodaniu/usunięciu transakcji)

**Optymalizacje wydajności**
- Virtual scrolling (react-window) dla list >50 wierszy
- Debouncing dla input fields i inline editing
- React.memo dla komponentów wykres, badge, wiersz transakcji
- useMemo dla kalkulacji sum i procentów
- useCallback dla event handlers
- Lazy loading dla modala importu CSV (React.lazy + Suspense)
- Image optimization (Astro Image integration)
- Code-splitting per route (Astro automatycznie)
- View Transitions API dla smooth navigation

**API optimizations**
- Cursor-based pagination (limit 50)
- Projekcja pól (query param `fields`)
- Indeksy DB: `idx_transactions_user_date`, `idx_transactions_date`
- Agregacje w bazie danych (`GET /api/reports/monthly`)

### Obsługa stanów błędów i wyjątków

**Błędy API**
- **401 Unauthorized** - redirect do logowania, toast "Sesja wygasła"
- **403 Forbidden** - toast "Brak uprawnień", disable action
- **404 Not Found** - toast "Nie znaleziono zasobu"
- **409 Conflict** - duplikat importu, wyświetl w raporcie
- **422 Unprocessable Entity** - walidacja semantyczna, inline error message
- **500 Server Error** - toast "Błąd serwera, spróbuj ponownie"

**Błędy walidacji**
- Inline error messages pod polami formularza (red border + icon + text)
- Disable submit button gdy istnieją błędy
- Multi-stage validation: onChange (format), onBlur (business rules), onSubmit (final)

**Błędy AI kategoryzacji**
- Timeout (>2s): fallback mapping słów kluczowych, orange badge "Słowa kluczowe"
- Error: red badge "Wymaga weryfikacji", kategoria "Inne"
- Toast neutralny: "Nie udało się automatycznie skategoryzować wydatku"

**Błędy importu CSV**
- Niepoprawny format: toast "Nieprawidłowy format pliku, sprawdź kolumny"
- Błędne wiersze: oznaczenie w tabeli (red border), raport z przyczyną
- Duplikaty: automatyczne odznaczenie, możliwość ręcznego zaznaczenia
- Polityka częściowo błędnych: skip pojedynczych, raport końcowy

**Offline scenarios**
- Próba dodania wydatku offline: komunikat "Wymagane połączenie internetowe"
- Zapisanie formularza lokalnie (localStorage): przycisk "Zapisz roboczo"
- Po powrocie online: banner "Masz niezapisane wydatki" z opcją szybkiego dodania
- Pull-to-refresh: spinner + komunikat przy braku connectivity

## Nierozwiązane kwestie

1. **Dokładny format CSV** - separator (przecinek vs średnik), decimal separator (kropka vs przecinek), encoding (UTF-8 vs Windows-1250), format daty (YYYY-MM-DD vs DD.MM.YYYY). **Rekomendacja**: safe default UTF-8, auto-detekcja separatora, YYYY-MM-DD.

2. **Nazwa i branding produktu** - wpływ na domenę, konfiguracje OAuth, meta tags. Tymczasowa nazwa "HomeBudget" może wymagać zmiany.

3. **Rejestrowanie korekt AI** - czy włączyć event log korekt kategorii w MVP dla analizy accuracy? **Rekomendacja**: włączyć basic logging (timestamp, old_category, new_category) bez UI dashboard w MVP.

4. **Progi confidence** - dokładne wartości dla niski/średni/wysoki (placeholder: <50 / 50-80 / >80). **Rekomendacja**: testy A/B z rzeczywistymi danymi użytkowników.

5. **Zwroty/refundy** - osobna kategoria "Zwroty" czy ujemne wartości kwot? **Rekomendacja**: osobna kategoria dla klarowności raportów.

6. **Polityka częściowo błędnych wierszy przy imporcie** - skip pojedynczych z raportem vs blokada całości? **Decyzja**: skip pojedynczych (zgodnie z API plan 207 Multi-Status).

7. **Zakres dat dla zaległych wydatków** - ostatnie 60 dni czy inny okres? **Rekomendacja**: konfigurowalne w `.env` (default 60 dni).

8. **Threshold niskiej pewności AI** - jaki % wymusza wizualne ostrzeżenie? **Rekomendacja**: <50% czerwony badge, 50-80% żółty badge z tooltipem.

9. **Definicja referencyjnego urządzenia** - dla metryki <3s ładowanie. **Rekomendacja**: iPhone SE 2020 (A13 Bionic) z throttling "Slow 3G" w Chrome DevTools.

10. **Multi-tenancy** - obecnie single household, w przyszłości dodanie `household_id` i tenant checks? **Rekomendacja**: architektura powinna uwzględniać tę możliwość (dodaj `household_id` do `users` tabeli już w MVP, ale bez UI).
