# API Endpoint Implementation Plan: GET /api/transaction-types

## 1. Przegląd punktu końcowego

Endpoint `GET /api/transaction-types` udostępnia listę predefiniowanych kategorii transakcji (słownik read-only). Jest to zasób bazowy używany w całej aplikacji do kategoryzacji wydatków. Endpoint wspiera filtrowanie po nazwie/kodzie oraz sortowanie według pozycji.

**Cele:**
- Dostarczenie listy dostępnych kategorii transakcji dla UI (dropdown, filtry)
- Umożliwienie wyszukiwania kategorii po nazwie lub kodzie
- Zapewnienie stabilnej kolejności wyświetlania (position)

**Charakterystyka:**
- Read-only (brak możliwości modyfikacji przez API)
- Chroniony autentykacją (JWT Supabase)
- Niskie obciążenie (statyczny słownik 11 rekordów)
- Brak paginacji (mały zestaw danych)

---

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
GET /api/transaction-types
```

### Parametry zapytania (Query Parameters)

| Parametr | Typ | Wymagany | Domyślny | Opis |
|----------|-----|----------|----------|------|
| `q` | string | Nie | - | Wyszukiwanie po nazwie lub kodzie (case-insensitive) |
| `order` | enum | Nie | `position.asc` | Kierunek sortowania: `position.asc` \| `position.desc` |

### Nagłówki (Headers)

| Nagłówek | Wymagany | Opis |
|----------|----------|------|
| `Authorization` | **Tak** | Bearer token JWT z Supabase Auth: `Bearer <access_token>` |
| `Content-Type` | Nie | `application/json` (domyślnie obsługiwany) |

### Request Body
Brak (GET endpoint)

---

## 3. Wykorzystywane typy

### Typy istniejące (z `src/types.ts`)

```typescript
// DTO dla odpowiedzi
export type TransactionTypeDTO = Omit<Tables<'transaction_types'>, 'created_at' | 'updated_at'>;
// Struktura: { id: number, code: string, name: string, position: number }

// Filtry query params
export type TransactionTypeFilters = {
  q?: string;
  order?: 'position.asc' | 'position.desc';
};

// Struktura odpowiedzi
export type TransactionTypesResponse = {
  data: TransactionTypeDTO[];
  count: number;
};

// Błędy
export type APIErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

### Nowe typy do stworzenia

**Schemat walidacji Zod** (w `src/lib/schemas/transaction-types.schema.ts`):
```typescript
import { z } from 'zod';

export const TransactionTypeFiltersSchema = z.object({
  q: z.string().trim().optional(),
  order: z.enum(['position.asc', 'position.desc']).default('position.asc'),
});
```

---

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "code": "GROCERY",
      "name": "Spożywcze",
      "position": 1
    },
    {
      "id": 2,
      "code": "HOME",
      "name": "Dom",
      "position": 2
    }
  ],
  "count": 11
}
```

**Struktura:**
- `data`: Array obiektów `TransactionTypeDTO`
- `count`: Liczba zwróconych rekordów (total bez paginacji, gdyż zestaw jest mały)

### Błędy

#### 400 Bad Request
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "order": "Must be one of: position.asc, position.desc"
    }
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 500 Server Error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## 5. Przepływ danych

### Diagram przepływu

```
Client Request (GET /api/transaction-types?q=spo&order=position.asc)
    ↓
Astro Middleware (src/middleware/index.ts)
    ↓ (weryfikacja JWT, inicjalizacja context.locals.supabase)
Endpoint Handler (src/pages/api/transaction-types.ts)
    ↓
1. Parsowanie i walidacja query params (Zod)
    ↓ (jeśli błąd → 400)
2. Weryfikacja autentykacji (context.locals.supabase.auth.getUser())
    ↓ (jeśli brak/nieważny token → 401)
3. Wywołanie service (transactionTypesService.listTransactionTypes)
    ↓
4. Query do Supabase
   SELECT id, code, name, position FROM transaction_types
   WHERE (q IS NULL OR name ILIKE %q% OR code ILIKE %q%)
   ORDER BY position ASC/DESC
    ↓
5. Mapowanie wyników (DB → DTO)
    ↓
6. Konstruowanie odpowiedzi { data, count }
    ↓
Response (200 OK)
```

### Interakcje z zewnętrznymi systemami

- **Supabase Auth**: Weryfikacja JWT tokenu (automatyczna przez middleware i RLS)
- **Supabase Database**: Query do tabeli `transaction_types` z RLS policy `transaction_types_read`

---

## 6. Względy bezpieczeństwa

### Autentykacja
- **Wymaganie**: Bearer token JWT z Supabase
- **Implementacja**: Token przekazywany w nagłówku `Authorization`
- **Weryfikacja**: Middleware `src/middleware/index.ts` ekstraktuje token i inicjalizuje `context.locals.supabase` z user context
- **Rejection**: Brak tokenu lub token wygasły → zwrócenie 401

### Autoryzacja
- **RLS (Row Level Security)**: Włączona polityka `transaction_types_read`
  ```sql
  CREATE POLICY transaction_types_read ON transaction_types
    FOR SELECT USING (auth.role() = 'authenticated');
  ```
- **Dostęp**: Wszyscy zalogowani użytkownicy mogą czytać (wspólna przestrzeń - single household w MVP)
- **Future-proofing**: Schemat przygotowany do rozszerzenia o `household_id` w przyszłości

### Walidacja danych wejściowych
- **Query params**: Walidowane przez schemat Zod
  - `q`: sanityzowany (trim), ILIKE w Supabase jest bezpieczne przed SQL injection
  - `order`: whitelist enum - tylko `position.asc` lub `position.desc`
- **Injection**: Parametry przekazywane przez Supabase query builder (parametryzowane zapytania)

### Rate Limiting
- **MVP**: Opcjonalne (niski priorytet - endpoint read-only, mały dataset)
- **Future**: Middleware rate limiting (np. 100 req/min per user)

### Headers Security
- Należy ustawić odpowiednie nagłówki CORS w Astro config (tylko trusted origins)
- Content-Security-Policy jeśli potrzebny

---

## 7. Obsługa błędów

### Scenariusze błędów

| Kod | Scenariusz | Przyczyna | Obsługa |
|-----|-----------|-----------|---------|
| **400** | Nieprawidłowe parametry | `order` nie jest w `['position.asc', 'position.desc']` | Walidacja Zod → zwrot szczegółów błędu |
| **401** | Brak autentykacji | Brak tokenu / token wygasły / token nieprawidłowy | Weryfikacja w middleware → early return z błędem |
| **404** | *(nie dotyczy)* | Endpoint zawsze zwraca pustą listę jeśli brak dopasowań | Zwrot `{ data: [], count: 0 }` zamiast 404 |
| **500** | Błąd serwera | Exception w service, błąd połączenia z DB | Try-catch w handler → logowanie + generyczny komunikat |

### Implementacja obsługi błędów

**W endpoint handler:**
```typescript
try {
  // Walidacja
  const filters = TransactionTypeFiltersSchema.parse(queryParams);
  
  // Autentykacja
  const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  
  // Wywołanie service
  const result = await transactionTypesService.listTransactionTypes(filters, context.locals.supabase);
  
  return new Response(JSON.stringify(result), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' }
  });
  
} catch (error) {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: { 
        code: 'VALIDATION_ERROR', 
        message: 'Invalid query parameters',
        details: error.flatten().fieldErrors 
      }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  
  // Log error dla monitoringu
  console.error('[GET /api/transaction-types] Unexpected error:', error);
  
  return new Response(JSON.stringify({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}
```

### Logowanie
- Błędy 500 → console.error z pełnym stack trace
- W przyszłości: integracja z Sentry/LogRocket dla production monitoring

---

## 8. Rozważania dotyczące wydajności

### Charakterystyka obciążenia
- **Dataset**: 11 statycznych rekordów (bardzo mały)
- **Częstotliwość**: Wysokie użycie (każde załadowanie UI z dropdownem kategorii)
- **Read-heavy**: Tylko odczyt, brak write operations

### Optymalizacje

#### Database Level
1. **Indeks**: `idx_transaction_types_position` (już istnieje) - przyspiesza ORDER BY
2. **RLS overhead**: Minimalny (policy sprawdza tylko `auth.role()`)
3. **Query plan**: SELECT z WHERE ILIKE + ORDER BY - Postgres dobrze obsługuje przy małych tabelach

#### Application Level
1. **Brak paginacji**: Nie jest potrzebna (11 rekordów)
2. **Future caching**:
   - Client-side: Cache w React Query / SWR (stale-while-revalidate) z długim TTL (np. 5 min)
   - Server-side: Opcjonalnie Redis cache (overkill w MVP)
3. **Projection**: Endpoint zwraca tylko potrzebne pola (id, code, name, position) - omit timestamps

#### Network
- Gzip compression w Astro (domyślnie włączony)
- Payload size: ~500 bytes dla 11 rekordów (pomijalne)

### Monitoring
- Metryki do śledzenia:
  - Czas odpowiedzi (target: < 100ms)
  - Częstotliwość 401 błędów (potencjalne problemy z auth)
  - Częstotliwość 500 błędów (quality alert)

---

## 9. Etapy wdrożenia

### Krok 1: Utworzenie schematu walidacji Zod
**Plik**: `src/lib/schemas/transaction-types.schema.ts`

```typescript
import { z } from 'zod';

export const TransactionTypeFiltersSchema = z.object({
  q: z.string().trim().optional(),
  order: z.enum(['position.asc', 'position.desc']).default('position.asc'),
});

export type TransactionTypeFiltersInput = z.infer<typeof TransactionTypeFiltersSchema>;
```

**Weryfikacja**: Uruchomić `npm run build` i sprawdzić brak błędów TypeScript

---

### Krok 2: Implementacja service
**Plik**: `src/lib/services/transaction-types.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../db/database.types';
import type { TransactionTypeDTO, TransactionTypeFilters } from '../../types';

export class TransactionTypesService {
  async listTransactionTypes(
    filters: TransactionTypeFilters,
    supabase: SupabaseClient<Database>
  ): Promise<{ data: TransactionTypeDTO[]; count: number }> {
    let query = supabase
      .from('transaction_types')
      .select('id, code, name, position', { count: 'exact' });

    // Filtr wyszukiwania
    if (filters.q) {
      const searchTerm = `%${filters.q}%`;
      query = query.or(`name.ilike.${searchTerm},code.ilike.${searchTerm}`);
    }

    // Sortowanie
    const [field, direction] = (filters.order || 'position.asc').split('.');
    query = query.order(field, { ascending: direction === 'asc' });

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch transaction types: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
    };
  }
}

export const transactionTypesService = new TransactionTypesService();
```

**Weryfikacja**: 
- Test manualny z Supabase client
- Sprawdzić typy TypeScript

---

### Krok 3: Implementacja endpoint handler
**Plik**: `src/pages/api/transaction-types.ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { TransactionTypeFiltersSchema } from '../../lib/schemas/transaction-types.schema';
import { transactionTypesService } from '../../lib/services/transaction-types.service';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Parsowanie query params
    const url = new URL(request.url);
    const queryParams = {
      q: url.searchParams.get('q') || undefined,
      order: url.searchParams.get('order') || 'position.asc',
    };

    // 2. Walidacja
    const filters = TransactionTypeFiltersSchema.parse(queryParams);

    // 3. Weryfikacja autentykacji
    const {
      data: { user },
      error: authError,
    } = await locals.supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Wywołanie service
    const result = await transactionTypesService.listTransactionTypes(
      filters,
      locals.supabase
    );

    // 5. Zwrócenie odpowiedzi
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Obsługa błędów walidacji
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.flatten().fieldErrors,
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Błąd serwera
    console.error('[GET /api/transaction-types] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
```

**Weryfikacja**: `npm run build` bez błędów

---

### Krok 4: Aktualizacja middleware (jeśli nie istnieje)
**Plik**: `src/middleware/index.ts`

Upewnić się, że middleware inicjalizuje `locals.supabase` z user context:

```typescript
import type { MiddlewareHandler } from 'astro';
import { supabaseClient } from '../db/supabase.client';

export const onRequest: MiddlewareHandler = async ({ request, locals }, next) => {
  // Pobranie tokenu z nagłówka
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  // Inicjalizacja Supabase client z tokenem użytkownika
  if (token) {
    locals.supabase = supabaseClient.auth.setSession({ access_token: token });
  } else {
    locals.supabase = supabaseClient;
  }

  return next();
};
```

**Uwaga**: Supabase automatycznie weryfikuje JWT i aplikuje RLS policies.

---

### Krok 5: Testy manualne

#### Test 1: Podstawowe wywołanie (uwierzytelnione)
```bash
curl -X GET "http://localhost:4321/api/transaction-types" \
  -H "Authorization: Bearer <your_supabase_token>"
```

**Oczekiwane**: 200 OK z listą 11 kategorii

#### Test 2: Filtrowanie
```bash
curl -X GET "http://localhost:4321/api/transaction-types?q=spo" \
  -H "Authorization: Bearer <your_token>"
```

**Oczekiwane**: 200 OK z kategorią "Spożywcze" (jeśli w bazie)

#### Test 3: Sortowanie descending
```bash
curl -X GET "http://localhost:4321/api/transaction-types?order=position.desc" \
  -H "Authorization: Bearer <your_token>"
```

**Oczekiwane**: 200 OK, kategorie posortowane od najwyższej pozycji

#### Test 4: Brak autentykacji
```bash
curl -X GET "http://localhost:4321/api/transaction-types"
```

**Oczekiwane**: 401 Unauthorized

#### Test 5: Nieprawidłowy parametr order
```bash
curl -X GET "http://localhost:4321/api/transaction-types?order=invalid" \
  -H "Authorization: Bearer <your_token>"
```

**Oczekiwane**: 400 Bad Request z szczegółami błędu

---

### Krok 6: Testy jednostkowe (opcjonalne w MVP, zalecane)

**Plik**: `src/lib/services/__tests__/transaction-types.service.test.ts`

Framework: Vitest (lub inne zgodnie z setupem projektu)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TransactionTypesService } from '../transaction-types.service';

describe('TransactionTypesService', () => {
  it('should return all transaction types when no filters applied', async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 1, code: 'GROCERY', name: 'Spożywcze', position: 1 }],
            count: 11,
            error: null,
          }),
        }),
      }),
    };

    const service = new TransactionTypesService();
    const result = await service.listTransactionTypes({}, mockSupabase as any);

    expect(result.count).toBe(11);
    expect(result.data).toHaveLength(1);
  });

  it('should filter by search query', async () => {
    // Mock dla filtrowania
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: 1, code: 'GROCERY', name: 'Spożywcze', position: 1 }],
              count: 1,
              error: null,
            }),
          }),
        }),
      }),
    };

    const service = new TransactionTypesService();
    const result = await service.listTransactionTypes(
      { q: 'spo' },
      mockSupabase as any
    );

    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe('Spożywcze');
  });
});
```

**Uruchomienie**: `npm run test`

---

### Krok 7: Weryfikacja w środowisku developerskim

1. Uruchomić aplikację: `npm run dev`
2. Przetestować wszystkie scenariusze z kroku 5
3. Sprawdzić logi w konsoli (brak błędów)
4. Zweryfikować działanie z Supabase Dashboard (RLS policies aplikowane)

---

### Krok 8: Dokumentacja API

Zaktualizować plik dokumentacji API (np. `.ai/api-plan.md` lub OpenAPI spec):

```markdown
### GET /api/transaction-types

**Description**: Lista dostępnych kategorii transakcji

**Authentication**: Required (Bearer token)

**Query Parameters**:
- `q` (string, optional): Wyszukiwanie po nazwie lub kodzie
- `order` (string, optional): `position.asc` (default) | `position.desc`

**Response 200**:
```json
{
  "data": [
    { "id": 1, "code": "GROCERY", "name": "Spożywcze", "position": 1 }
  ],
  "count": 11
}
```

**Errors**: 400, 401, 500
```

---

### Krok 9: Code review checklist

- [ ] Endpoint używa `export const prerender = false`
- [ ] Handler używa uppercase `GET` (zgodnie z konwencją Astro)
- [ ] Walidacja przez Zod schema
- [ ] Logika ekstraktowana do service
- [ ] Service używa `locals.supabase` (nie `supabaseClient`)
- [ ] Obsługa wszystkich scenariuszy błędów (400, 401, 500)
- [ ] Typy TypeScript poprawne (brak `any` bez uzasadnienia)
- [ ] Logowanie błędów 500 dla monitoringu
- [ ] Testy manualne przeszły pomyślnie
- [ ] Dokumentacja zaktualizowana

---

### Krok 10: Deployment

1. Merge do brancha `main` (po review)
2. CI/CD pipeline (GitHub Actions):
   - Build: `npm run build`
   - Linting: `npm run lint`
   - Tests: `npm run test` (jeśli zaimplementowane)
3. Deploy do DigitalOcean (Docker image)
4. Smoke test na production (podstawowe wywołanie endpoint)
5. Monitoring (logi, metryki) przez pierwsze 24h

---

## 10. Potencjalne rozszerzenia przyszłościowe

### Multi-household support
- Dodać kolumnę `household_id` do `transaction_types` (jeśli kategorie będą per household)
- Zaktualizować RLS policy: `USING (household_id = current_household())`
- Parametr `household_id` w filtrach

### Caching
- Redis cache dla listy kategorii (TTL 5 min)
- Invalidacja przy zmianach (jeśli dodane POST/PUT/DELETE)

### Internationalization (i18n)
- Dodać tabelę `transaction_types_translations (type_id, locale, name)`
- Parametr `locale` w query params
- Join w service dla pobrania tłumaczeń

### Advanced Search
- Trigram index dla fuzzy search (`pg_trgm`)
- Full-text search z rankingiem
- Parametr `search_type: 'exact' | 'fuzzy'`

---

## 11. Zależności i wymagania wstępne

### Wymagania techniczne
- Node.js >= 18
- Astro 5.x
- Supabase project skonfigurowany
- Migracja DB z tabelą `transaction_types` wykonana
- Seed z 11 kategoriami wczytany

### Pakiety NPM
- `zod` (^3.x) - walidacja
- `@supabase/supabase-js` (^2.x) - klient DB
- `astro` (^5.x) - framework

### Zmienne środowiskowe
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

---

## 12. Znane ograniczenia i uwagi

1. **Read-only**: Endpoint nie wspiera POST/PUT/DELETE - kategorie zarządzane przez migracje DB
2. **Brak paginacji**: Uzasadnione małym zbiorem danych (11 rekordów)
3. **Rate limiting**: Nie zaimplementowany w MVP - należy dodać w produkcji
4. **Caching**: Brak server-side cache - opcjonalnie dodać Redis w przyszłości
5. **Audit log**: Brak logowania dostępu - rozważyć dla compliance w enterprise
6. **CORS**: Należy skonfigurować dozwolone origins w Astro config dla cross-origin requests

---

**Status implementacji**: Ready for development  
**Priorytet**: High (zasób podstawowy używany w całej aplikacji)  
**Szacowany czas implementacji**: 2-3 godziny (z testami manualnymi)
