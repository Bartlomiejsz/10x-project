# API Endpoint Implementation Plan: GET /api/transaction-types/:id

## 1. Przegląd punktu końcowego

Endpoint służy do pobierania szczegółów pojedynczego typu transakcji na podstawie jego unikalnego identyfikatora. Typy transakcji to słownik tylko do odczytu zawierający kategorie wydatków (np. GROCERY, HOME, HEALTH), które są używane do klasyfikacji transakcji w systemie budżetowym.

**Charakterystyka:**
- **Metoda**: GET
- **Ścieżka**: `/api/transaction-types/:id`
- **Autentykacja**: Wymagana (401 dla niezalogowanych użytkowników)
- **Typ zasobu**: Read-only dictionary (słownik systemowy)

## 2. Szczegóły żądania

### Metoda HTTP
GET

### Struktura URL
```
/api/transaction-types/:id
```

### Parametry

**Parametry ścieżki (Path Parameters):**
- **id** (wymagany)
  - Typ: number (integer)
  - Opis: Unikalny identyfikator typu transakcji
  - Walidacja: 
    - Musi być liczbą całkowitą dodatnią (> 0)
    - Musi istnieć w bazie danych
  - Przykład: `/api/transaction-types/5`

**Query Parameters:** Brak

**Request Headers:**
- `Authorization`: Token JWT z Supabase auth (automatycznie obsługiwany przez middleware)

**Request Body:** Brak (metoda GET)

## 3. Wykorzystywane typy

### DTOs

```typescript
/**
 * Transaction Type DTO - read-only category representation
 * Typ już zdefiniowany w src/types.ts
 */
export type TransactionTypeDTO = Omit<Tables<'transaction_types'>, 'created_at' | 'updated_at'>;

// Struktura zwracana:
// {
//   id: number;
//   code: string;
//   name: string;
//   position: number;
// }
```

### Validation Schemas (do stworzenia)

```typescript
// src/lib/schemas/transaction-types.schema.ts
// Dodać nowy schema dla walidacji ID:

export const TransactionTypeIdSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, 'ID must be greater than 0'),
});

export type TransactionTypeIdInput = z.infer<typeof TransactionTypeIdSchema>;
```

### Error Response Type

```typescript
// Już zdefiniowany w src/types.ts
export type APIErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

**Content-Type:** `application/json`

**Body:**
```json
{
  "id": 5,
  "code": "GROCERY",
  "name": "Zakupy spożywcze",
  "position": 1
}
```

**Struktura:**
- `id`: Unikalny identyfikator (SERIAL PRIMARY KEY)
- `code`: Stabilny kod kategorii (np. GROCERY, HOME, HEALTH)
- `name`: Polska nazwa wyświetlana
- `position`: Kolejność wyświetlania (0-199)

### Błędy

#### 400 Bad Request - Nieprawidłowy format ID
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid transaction type ID",
    "details": {
      "id": ["ID must be a positive integer"]
    }
  }
}
```

**Scenariusze:**
- ID nie jest liczbą: `/api/transaction-types/abc`
- ID jest ujemne lub zero: `/api/transaction-types/-5`
- ID zawiera znaki specjalne: `/api/transaction-types/5.5`

#### 401 Unauthorized - Brak autentykacji
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**Scenariusze:**
- Brak tokenu JWT w cookies/headers
- Token wygasł
- Token nieprawidłowy

#### 404 Not Found - Typ transakcji nie istnieje
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Transaction type not found"
  }
}
```

**Scenariusze:**
- Podane ID nie istnieje w bazie danych
- Typ transakcji został usunięty (jeśli soft delete)

#### 500 Internal Server Error - Błąd serwera
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Scenariusze:**
- Błąd połączenia z bazą danych
- Nieoczekiwany błąd w query Supabase
- Problemy z deserializacją danych

## 5. Przepływ danych

### Architektura warstwowa

```
[Client Request]
      ↓
[Astro API Route: /api/transaction-types/[id].ts]
      ↓ (1) Extract & validate ID from params
      ↓ (2) Check authentication (locals.supabase.auth.getUser())
      ↓ (3) Call service layer
      ↓
[TransactionTypesService.getTransactionTypeById()]
      ↓ (4) Build Supabase query
      ↓ (5) Execute query with RLS
      ↓
[Supabase PostgreSQL Database]
      ↓ (6) Return single row or null
      ↓
[Service Layer]
      ↓ (7) Transform to DTO or throw NotFound
      ↓
[API Route]
      ↓ (8) Return 200 with JSON or handle errors
      ↓
[Client Response]
```

### Szczegółowy przepływ

1. **Request Reception** (API Route)
   - Astro odbiera żądanie GET na `/api/transaction-types/[id]`
   - Wyciąga parametr `id` z `Astro.params`

2. **Input Validation**
   - Walidacja ID za pomocą Zod schema
   - Konwersja string → number
   - Sprawdzenie czy ID > 0

3. **Authentication Check**
   - Wywołanie `locals.supabase.auth.getUser()`
   - Weryfikacja czy użytkownik jest zalogowany
   - Zwrot 401 jeśli brak autentykacji

4. **Service Layer Call**
   - Wywołanie `transactionTypesService.getTransactionTypeById(id, supabase)`
   - Przekazanie instancji Supabase z `locals`

5. **Database Query**
   - Supabase Query Builder: `.from('transaction_types').select('id, code, name, position').eq('id', id).single()`
   - RLS (Row Level Security) automatycznie filtruje dostęp
   - PostgreSQL zwraca pojedynczy wiersz lub error

6. **Data Transformation**
   - Service sprawdza czy dane istnieją
   - Zwraca DTO lub rzuca błąd NotFound

7. **Response Formation**
   - API Route tworzy Response z JSON
   - Ustawia Content-Type i status code
   - Obsługuje błędy z try-catch

8. **Error Handling**
   - Zod errors → 400
   - Auth errors → 401
   - Not found → 404
   - Other errors → 500

## 6. Względy bezpieczeństwa

### 1. Autentykacja (Authentication)

**Wymaganie:** Użytkownik musi być zalogowany
```typescript
const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

if (authError || !user) {
  return new Response(JSON.stringify({
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
  }), { status: 401 });
}
```

**Mechanizm:**
- Token JWT w cookies (httpOnly, secure)
- Automatyczna weryfikacja przez middleware Astro
- Supabase auth sprawdza ważność tokenu

### 2. Autoryzacja (Authorization)

**Model dostępu:**
- Tabela `transaction_types` to **read-only dictionary**
- Wszyscy zalogowani użytkownicy mogą czytać
- Brak mechanizmu multi-tenancy (dane nie są per-user)
- Nie trzeba sprawdzać ownership

**Row Level Security (RLS):**
```sql
-- Polityka w Supabase (sugerowana):
CREATE POLICY "Allow authenticated users to read transaction types"
ON transaction_types
FOR SELECT
TO authenticated
USING (true);
```

### 3. Input Validation & Sanitization

**Walidacja ID:**
- Zod schema zapewnia type safety
- Regex `/^\d+$/` zapobiega SQL injection
- Transform do number zapobiega type coercion issues
- Refine sprawdza pozytywność

**Bezpieczeństwo Supabase:**
- Query Builder używa parametryzowanych zapytań
- Automatyczna ochrona przed SQL Injection
- `.eq('id', id)` bezpiecznie binduje parametr

### 4. Rate Limiting (opcjonalnie)

**Rekomendacja:**
- Implementacja rate limiting na poziomie middleware
- Limit np. 100 requests/minute per user dla endpointów GET
- Ochrona przed nadużyciami API

### 5. CORS & Headers

**Security Headers:**
```typescript
headers: {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
}
```

### 6. Error Message Security

**Zasada:** Nie ujawniaj szczegółów technicznych
- ❌ `Database connection failed at 192.168.1.5:5432`
- ✅ `An unexpected error occurred`
- Szczegóły tylko w server logs (console.error)

## 7. Obsługa błędów

### Hierarchia obsługi błędów

```typescript
try {
  // 1. Validation errors
  // 2. Authentication errors
  // 3. Not found errors
  // 4. Database errors
  // 5. Unexpected errors
} catch (error) {
  // Centralized error handling
}
```

### 1. Validation Errors (400)

**Trigger:** Zod validation fails
```typescript
catch (error) {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid transaction type ID',
        details: error.flatten().fieldErrors
      }
    }), { status: 400 });
  }
}
```

**Przykłady:**
- ID = "abc" → "ID must be a positive integer"
- ID = "-5" → "ID must be greater than 0"
- ID = "3.14" → "ID must be a positive integer"

### 2. Authentication Errors (401)

**Trigger:** User not authenticated
```typescript
const { data: { user }, error: authError } = await locals.supabase.auth.getUser();

if (authError || !user) {
  return new Response(JSON.stringify({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    }
  }), { status: 401 });
}
```

**Logging:** Nie logować (to normalna sytuacja)

### 3. Not Found Errors (404)

**Trigger:** Transaction type doesn't exist
```typescript
// W service:
const { data, error } = await supabase
  .from('transaction_types')
  .select('id, code, name, position')
  .eq('id', id)
  .single();

if (error && error.code === 'PGRST116') { // PostgREST "not found" code
  throw new NotFoundError('Transaction type not found');
}

// W route:
catch (error) {
  if (error instanceof NotFoundError) {
    return new Response(JSON.stringify({
      error: {
        code: 'NOT_FOUND',
        message: error.message
      }
    }), { status: 404 });
  }
}
```

**Logging:** Opcjonalne (info level)

### 4. Database Errors (500)

**Trigger:** Supabase query fails
```typescript
if (error && error.code !== 'PGRST116') {
  console.error('[TransactionTypesService] Database error:', error);
  throw new Error(`Failed to fetch transaction type: ${error.message}`);
}
```

**Logging:** Zawsze logować z pełnymi szczegółami

### 5. Unexpected Errors (500)

**Trigger:** Any other error
```typescript
catch (error) {
  console.error('[GET /api/transaction-types/:id] Unexpected error:', error);
  
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }), { status: 500 });
}
```

**Logging:** Zawsze logować z stack trace

### Custom Error Classes (do stworzenia)

```typescript
// src/lib/errors.ts (jeśli nie istnieje)

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

## 8. Rozważania dotyczące wydajności

### 1. Database Query Optimization

**Index Usage:**
```sql
-- Istniejący PRIMARY KEY automatycznie tworzy index na 'id'
-- Query: WHERE id = ? korzysta z PRIMARY KEY index
-- Koszt: O(log n) - bardzo szybkie wyszukiwanie
```

**Query Efficiency:**
- `.single()` - zwraca max 1 wiersz, nie potrzebuje LIMIT
- Projekcja pól: `select('id, code, name, position')` - tylko potrzebne kolumny
- Brak JOINów - tabela standalone

**Szacowany czas odpowiedzi:**
- Database query: < 5ms
- Total request: < 50ms (including auth)

### 2. Caching Strategy

**Rekomendacje:**

**A. HTTP Cache Headers (nie dla MVP, ale do rozważenia)**
```typescript
headers: {
  'Cache-Control': 'private, max-age=300', // 5 minut
  'ETag': generateETag(transactionType)
}
```

**Uzasadnienie:**
- Transaction types są quasi-statyczne (rzadko się zmieniają)
- Cache po stronie klienta redukuje liczbę requestów
- `private` - cache tylko w przeglądarce użytkownika

**B. Server-side caching (opcjonalne)**
```typescript
// In-memory cache z TTL
const cache = new Map<number, { data: TransactionTypeDTO, expires: number }>();
```

**Trade-offs:**
- ✅ Szybsze odpowiedzi (< 1ms)
- ❌ Dodatkowa złożoność
- ❌ Invalidation przy update'ach
- **Rekomendacja:** Nie implementować w MVP, dane są już szybkie

### 3. Connection Pooling

**Supabase handling:**
- Supabase automatycznie zarządza connection pooling
- PgBouncer w transaction mode
- Brak akcji po stronie aplikacji

### 4. Payload Size Optimization

**Rozmiar odpowiedzi:**
```json
{
  "id": 5,
  "code": "GROCERY",
  "name": "Zakupy spożywcze",
  "position": 1
}
```
- Średnio ~80-120 bytes
- Minimalistyczna struktura DTO (bez `created_at`, `updated_at`)
- Brak potrzeby kompresji (gzip za duży overhead dla małych payloadów)

### 5. Monitoring & Metrics

**Metryki do śledzenia:**
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Requests per minute
- Database query time

**Narzędzia:**
- Supabase Dashboard (query performance)
- Application logs (timing info)
- Opcjonalnie: Sentry, Datadog, New Relic

### 6. Potential Bottlenecks

**Identyfikacja:**
1. ✅ **Database query** - Zoptymalizowane (PRIMARY KEY index)
2. ✅ **Network latency** - Minimalne (single row)
3. ⚠️ **Authentication check** - Dodaje ~20-30ms
4. ✅ **JSON serialization** - Negligible dla małego payloadu
5. ⚠️ **Cold start** (serverless) - Jeśli deploy na edge functions

**Mitigacje:**
- Authentication: Cache user session in middleware
- Cold start: Implement warming strategy lub use dedicated server

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie środowiska

**1.1. Sprawdź istniejącą strukturę**
```bash
# Weryfikacja plików
ls -la src/pages/api/
ls -la src/lib/services/
ls -la src/lib/schemas/
```

**1.2. Upewnij się że środowisko działa**
```bash
npm install
npm run dev
```

**1.3. Sprawdź połączenie z Supabase**
- Zweryfikuj `SUPABASE_URL` i `SUPABASE_ANON_KEY` w `.env`
- Przetestuj endpoint GET `/api/transaction-types` (istniejący)

---

### Krok 2: Rozszerzenie validation schema

**Plik:** `src/lib/schemas/transaction-types.schema.ts`

**Zadanie:** Dodać schema dla walidacji ID

```typescript
// Dodaj na końcu pliku:

export const TransactionTypeIdSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, 'ID must be greater than 0'),
});

export type TransactionTypeIdInput = z.infer<typeof TransactionTypeIdSchema>;
```

**Weryfikacja:**
```typescript
// Test case (opcjonalny)
const valid = TransactionTypeIdSchema.parse({ id: '5' }); // ✓ { id: 5 }
const invalid = TransactionTypeIdSchema.parse({ id: 'abc' }); // ✗ ZodError
```

---

### Krok 3: Stworzenie custom error classes

**Plik:** `src/lib/errors.ts` (nowy plik)

**Zadanie:** Zdefiniować custom errors

```typescript
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

**Cel:** Ułatwienie typowania i obsługi błędów w całej aplikacji

---

### Krok 4: Rozszerzenie service layer

**Plik:** `src/lib/services/transaction-types.service.ts`

**Zadanie:** Dodać metodę `getTransactionTypeById`

```typescript
// Dodaj import
import { NotFoundError } from '../errors';

// Dodaj metodę w klasie TransactionTypesService:

async getTransactionTypeById(
  id: number,
  supabase: SupabaseClient<Database>
): Promise<TransactionTypeDTO> {
  const { data, error } = await supabase
    .from('transaction_types')
    .select('id, code, name, position')
    .eq('id', id)
    .single();

  // Obsługa błędu "not found" (PostgREST code PGRST116)
  if (error && error.code === 'PGRST116') {
    throw new NotFoundError('Transaction type not found');
  }

  // Inne błędy bazy danych
  if (error) {
    console.error('[TransactionTypesService] Database error:', error);
    throw new Error(`Failed to fetch transaction type: ${error.message}`);
  }

  // Dodatkowa ochrona (nie powinno się zdarzyć)
  if (!data) {
    throw new NotFoundError('Transaction type not found');
  }

  return data;
}
```

**Weryfikacja:**
- Metoda zwraca `TransactionTypeDTO` dla istniejącego ID
- Rzuca `NotFoundError` dla nieistniejącego ID
- Rzuca `Error` dla błędów bazy danych

---

### Krok 5: Utworzenie dynamic route

**Plik:** `src/pages/api/transaction-types/[id].ts` (nowy plik)

**Zadanie:** Zaimplementować endpoint GET

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { TransactionTypeIdSchema } from '../../../lib/schemas/transaction-types.schema';
import { transactionTypesService } from '../../../lib/services/transaction-types.service';
import { NotFoundError } from '../../../lib/errors';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Walidacja parametru ID
    const { id } = TransactionTypeIdSchema.parse(params);

    // 2. Weryfikacja autentykacji
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

    // 3. Wywołanie service
    const transactionType = await transactionTypesService.getTransactionTypeById(
      id,
      locals.supabase
    );

    // 4. Zwrócenie odpowiedzi
    return new Response(JSON.stringify(transactionType), {
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
            message: 'Invalid transaction type ID',
            details: error.flatten().fieldErrors,
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Obsługa błędu "not found"
    if (error instanceof NotFoundError) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Błąd serwera
    console.error('[GET /api/transaction-types/:id] Unexpected error:', error);

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

**Struktura pliku:**
1. Imports
2. `prerender = false` (SSR wymagany)
3. GET handler z pełną obsługą błędów

---

### Krok 6: Konfiguracja Row Level Security (RLS) w Supabase

**Lokalizacja:** Supabase Dashboard → Authentication → Policies

**Zadanie:** Upewnij się że polityki RLS są skonfigurowane

```sql
-- 1. Włącz RLS na tabeli (jeśli jeszcze nie włączono)
ALTER TABLE transaction_types ENABLE ROW LEVEL SECURITY;

-- 2. Dodaj politykę dla odczytu (SELECT)
CREATE POLICY "Allow authenticated users to read transaction types"
ON transaction_types
FOR SELECT
TO authenticated
USING (true);

-- 3. Opcjonalnie: Zablokuj wszystkie inne operacje
CREATE POLICY "Deny insert for all users"
ON transaction_types
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny update for all users"
ON transaction_types
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Deny delete for all users"
ON transaction_types
FOR DELETE
TO authenticated
USING (false);
```

**Alternatywa:** Dodać do migration w `supabase/migrations/`

**Cel:** Zagwarantować że tylko zalogowani użytkownicy mogą czytać typy transakcji

---

### Krok 7: Testowanie manualne

**7.1. Test sukcesu (200)**
```bash
# Załóżmy że ID=1 istnieje w bazie
curl -X GET http://localhost:4321/api/transaction-types/1 \
  -H "Cookie: your-auth-cookie" \
  -H "Content-Type: application/json"

# Oczekiwana odpowiedź:
# {
#   "id": 1,
#   "code": "GROCERY",
#   "name": "Zakupy spożywcze",
#   "position": 1
# }
```

**7.2. Test walidacji (400)**
```bash
# Nieprawidłowy format ID
curl -X GET http://localhost:4321/api/transaction-types/abc

# Oczekiwana odpowiedź:
# {
#   "error": {
#     "code": "VALIDATION_ERROR",
#     "message": "Invalid transaction type ID",
#     "details": { ... }
#   }
# }
```

**7.3. Test autentykacji (401)**
```bash
# Bez cookie/tokenu
curl -X GET http://localhost:4321/api/transaction-types/1

# Oczekiwana odpowiedź:
# {
#   "error": {
#     "code": "UNAUTHORIZED",
#     "message": "Authentication required"
#   }
# }
```

**7.4. Test not found (404)**
```bash
# Nieistniejące ID (np. 999999)
curl -X GET http://localhost:4321/api/transaction-types/999999 \
  -H "Cookie: your-auth-cookie"

# Oczekiwana odpowiedź:
# {
#   "error": {
#     "code": "NOT_FOUND",
#     "message": "Transaction type not found"
#   }
# }
```

**7.5. Test przez przeglądarkę**
- Otwórz DevTools → Network
- Zaloguj się do aplikacji
- Wywołaj endpoint przez fetch lub adres URL
- Sprawdź response status i body

---

### Krok 8: Testy jednostkowe (opcjonalne, ale rekomendowane)

**8.1. Setup test framework (jeśli nie istnieje)**
```bash
npm install -D vitest @vitest/ui
```

**8.2. Plik testowy:** `src/lib/services/transaction-types.service.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TransactionTypesService } from './transaction-types.service';
import { NotFoundError } from '../errors';

describe('TransactionTypesService', () => {
  describe('getTransactionTypeById', () => {
    it('should return transaction type for valid ID', async () => {
      // Mock Supabase client
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: 1, code: 'GROCERY', name: 'Zakupy', position: 1 },
                error: null,
              })),
            })),
          })),
        })),
      };

      const service = new TransactionTypesService();
      const result = await service.getTransactionTypeById(1, mockSupabase as any);

      expect(result).toEqual({
        id: 1,
        code: 'GROCERY',
        name: 'Zakupy',
        position: 1,
      });
    });

    it('should throw NotFoundError for non-existent ID', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: null,
                error: { code: 'PGRST116' },
              })),
            })),
          })),
        })),
      };

      const service = new TransactionTypesService();

      await expect(
        service.getTransactionTypeById(999, mockSupabase as any)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
```

**8.3. Uruchom testy**
```bash
npm run test
```

---

### Krok 9: Dokumentacja API

**Plik:** `README.md` lub osobny `API.md`

**Zadanie:** Dodać dokumentację endpointu

```markdown
## GET /api/transaction-types/:id

Pobiera szczegóły pojedynczego typu transakcji.

### Parametry
- `id` (path, required) - ID typu transakcji (integer)

### Odpowiedzi
- **200 OK**: Zwraca obiekt typu transakcji
- **400 Bad Request**: Nieprawidłowy format ID
- **401 Unauthorized**: Wymagana autentykacja
- **404 Not Found**: Typ transakcji nie istnieje
- **500 Internal Server Error**: Błąd serwera

### Przykład
```bash
curl -X GET https://app.example.com/api/transaction-types/5
```

Response:
```json
{
  "id": 5,
  "code": "GROCERY",
  "name": "Zakupy spożywcze",
  "position": 1
}
```
```

---

### Krok 10: Code review & deployment

**10.1. Self-review checklist:**
- [ ] Kod zgodny z coding guidelines (early returns, error handling)
- [ ] TypeScript bez błędów (`npm run build`)
- [ ] ESLint bez błędów (`npm run lint`)
- [ ] Wszystkie scenariusze błędów obsłużone
- [ ] Walidacja input za pomocą Zod
- [ ] Authentication check zaimplementowany
- [ ] Logging dla błędów 500
- [ ] Dokumentacja API zaktualizowana

**10.2. Peer review:**
- Pull request z opisem zmian
- Code review przez innego developera
- Sprawdzenie security aspects

**10.3. Deployment:**
```bash
# Build
npm run build

# Preview
npm run preview

# Deploy (według konfiguracji projektu)
# np. git push → GitHub Actions → DigitalOcean
```

**10.4. Smoke testing na produkcji:**
- Test endpoint z prawdziwą bazą danych
- Sprawdzenie logów w production
- Monitoring metryk (response time, error rate)

---

### Krok 11: Monitoring & observability

**11.1. Supabase Dashboard:**
- Logs → API logs
- Sprawdź query performance
- Sprawdź error rate

**11.2. Application logs:**
```bash
# Local development
npm run dev

# Production (jeśli Docker)
docker logs <container-id>
```

**11.3. Metryki do monitorowania:**
- Avg response time (target: < 100ms)
- Error rate (target: < 1%)
- P95 response time (target: < 200ms)
- Throughput (requests/minute)

**11.4. Alerting (opcjonalnie):**
- Sentry dla error tracking
- Uptime monitoring (UptimeRobot, Pingdom)
- Performance monitoring (Datadog, New Relic)

---

## Podsumowanie implementacji

### Nowe pliki:
1. ✅ `src/pages/api/transaction-types/[id].ts` - API route
2. ✅ `src/lib/errors.ts` - Custom error classes
3. ✅ `src/lib/services/transaction-types.service.test.ts` - Testy (opcjonalne)

### Zmodyfikowane pliki:
1. ✅ `src/lib/schemas/transaction-types.schema.ts` - Dodany `TransactionTypeIdSchema`
2. ✅ `src/lib/services/transaction-types.service.ts` - Dodana metoda `getTransactionTypeById`

### Konfiguracja Supabase:
1. ✅ RLS policies dla `transaction_types`
2. ✅ Weryfikacja indexów (PRIMARY KEY już istnieje)

### Estimaty czasu:
- Krok 1-3: 15 minut (setup + schemas + errors)
- Krok 4: 20 minut (service layer)
- Krok 5: 30 minut (API route)
- Krok 6: 10 minut (RLS policies)
- Krok 7: 30 minut (testy manualne)
- Krok 8: 45 minut (testy jednostkowe, opcjonalne)
- Krok 9-11: 30 minut (dokumentacja, deployment, monitoring)

**Total: ~3 godziny** (bez testów jednostkowych: ~2 godziny)

### Następne kroki:
Po zaimplementowaniu tego endpointu, warto rozważyć:
1. Implementację podobnych endpointów (GET /api/budgets/:id, GET /api/transactions/:id)
2. Standaryzację error handling w middleware
3. Dodanie cache layer dla słowników
4. Implementację OpenAPI/Swagger dokumentacji
