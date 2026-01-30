# REST API Plan

## Overview
This REST API is designed for a home-budget application using Supabase (Postgres), Astro + React frontend, and TypeScript. It exposes resources that map directly to the database schema: transaction_types, budgets, transactions. The API follows best practices: Zod-based input validation, Supabase authentication (JWT), Row Level Security (RLS) compatibility, cursor-based pagination for lists, and explicit handling of business logic described below.

---

## 1. Resources
- transaction_types (table: `transaction_types`)
- budgets (table: `budgets`) — composite primary key: (month_date, type_id)
- transactions (table: `transactions`)
- auth (handled by Supabase Auth; tokens used for protected endpoints)
- reports (derived resource — aggregated endpoints, not persisted)

---

## 2. Endpoints

Notes on conventions:
- All endpoints under `/api` (server endpoints in Astro): e.g. `/api/transactions`
- Use HTTP verbs: GET, POST, PUT, PATCH, DELETE
- Protected endpoints require `Authorization: Bearer <supabase_access_token>` header (Supabase JWT)
- Use `application/json` for request/response bodies
- Validation is performed server-side with Zod and mapped to DB constraints
- Pagination: cursor-based (`limit`, `cursor`, `order`) with fallback `page`/`pageSize` (offset) for simple clients
- All list endpoints support `filter`, `sort`, and `fields` (projection) query parameters

### 2.1 transaction_types
Static dictionary of categories (read-only via API for clients).

- GET /api/transaction-types
  - Description: List available transaction types (categories)
  - Query params:
    - `q` (string) — search by name or code
    - `order` (string) — `position.asc` (default) or `position.desc`
  - Response (200):
    ```json
    { "data": [ { "id": number, "code": string, "name": string, "position": number } ], "count": number }
    ```
  - Errors: 401 (Unauthorized), 500 (Server error)

- GET /api/transaction-types/:id
  - Description: Get single transaction type by id
  - Response (200):
    ```json
    { "id": number, "code": string, "name": string, "position": number }
    ```
  - Errors: 401, 404, 500

Note: No POST/PUT/DELETE supported by API (dictionary is read-only). This aligns with DB RLS policies.

### 2.2 budgets
Monthly planned budget amount per category — composite primary key: `month_date` (YYYY-MM-01) + `type_id`.

- GET /api/budgets
  - Description: List budgets, filterable by month and type
  - Query params:
    - `month` (YYYY-MM) or `month_date` (YYYY-MM-01)
    - `type_id` (int)
    - `order` (e.g. `month_date.desc`)
  - Response (200):
    ```json
    { "data": [ { "month_date": "YYYY-MM-01", "type_id": number, "amount": number, "created_at": string, "updated_at": string } ] }
    ```

- GET /api/budgets/:month_date/:type_id
  - Description: Get specific budget by composite key
  - Response (200): budget object
  - Errors: 401, 404

- POST /api/budgets
  - Description: Create or upsert a budget
  - Request body (201 on create):
    ```json
    { "month_date": "YYYY-MM-01", "type_id": number, "amount": number }
    ```
  - Validation rules:
    - `month_date` must be first day of month (YYYY-MM-01)
    - `amount` numeric >= 0 and < 1_000_000_000 (per DB check)
    - `type_id` must exist in `transaction_types`
  - Responses:
    - 201 Created: created resource
    - 200 OK: if upsert semantics used (existing updated)
    - 400 Validation error, 401 Unauthorized, 409 Conflict

- PUT /api/budgets/:month_date/:type_id
  - Description: Replace/update budget amount
  - Request body:
    ```json
    { "amount": number }
    ```
  - Responses: 200 OK (updated), 400/401/404

- DELETE /api/budgets/:month_date/:type_id
  - Description: Delete budget entry
  - Responses: 204 No Content, 401/403/404

Business rules:
- Upserts allowed; server must normalize month_date to YYYY-MM-01
- Validate amount per DB constraints; reject otherwise with 400

### 2.3 transactions
Primary ledger. Supports creation (single + batch import), updates, deletion, and list queries with paging, filter & sort.

- GET /api/transactions
  - Description: List transactions for the authenticated context
  - Query params (common):
    - `limit` (int) — default 50, max 1000
    - `cursor` (string) — opaque cursor referencing last item
    - `order` (string) — `date.desc` or `date.asc` (default: date.desc)
    - `start_date` / `end_date` (YYYY-MM-DD)
    - `type_id` (int)
    - `min_amount` / `max_amount`
    - `q` (string) — full-text search on description
    - `is_manual_override` (boolean)
    - `import_hash` (string) — filter by import hash
    - `page` / `pageSize` (offset fallback)
    - `fields` (comma-separated projection)
  - Response (200):
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "user_id": "uuid",
          "type_id": number,
          "amount": number,
          "description": string,
          "date": "YYYY-MM-DD",
          "ai_status": "success|fallback|error|null",
          "ai_confidence": number | null,
          "is_manual_override": boolean,
          "import_hash": string | null,
          "created_at": string,
          "updated_at": string
        }
      ],
      "next_cursor": string | null
    }
    ```
  - Errors: 401, 400, 500

- GET /api/transactions/:id
  - Description: Get transaction by id
  - Response: transaction object (200)
  - Errors: 401, 404

- POST /api/transactions
  - Description: Create one or more transactions (supports both single entry and batch import)
  - Request body (single transaction):
    ```json
    {
      "type_id": number,
      "amount": number,
      "description": string,
      "date": "YYYY-MM-DD",
      "import_hash": string | null (optional),
      "is_manual_override": boolean (optional)
    }
    ```
  - Request body (multiple transactions):
    ```json
    {
      "transactions": [
        {
          "type_id": number,
          "amount": number,
          "description": string,
          "date": "YYYY-MM-DD",
          "import_hash": string | null (optional),
          "is_manual_override": boolean (optional)
        }
      ]
    }
    ```
  - Server behavior/business logic:
    - Detect batch mode by presence of `transactions` array in request body
    - Validate all fields for each transaction (see Validation section)
    - For batch operations, process all transactions within a single database transaction (atomic)
    - If `import_hash` provided, check existing transactions with same import_hash and deduplicate per policy (skip by default, return status per item)
    - If created without manual override and import source suggests AI classification, call AI classification service (async) and update `ai_status` and `ai_confidence` later. The initial row may have `ai_status=null`.
    - Compute `import_hash` on server if client doesn't provide it (md5(date+amount+description))
    - For batch operations, continue processing valid transactions even if some fail validation (collect errors per item)
  - Responses (single transaction):
    - 201 Created with created object
    - 409 Conflict if duplicate import detected
    - 400 Validation errors
  - Responses (batch):
    - 207 Multi-Status with per-item results:
      ```json
      {
        "results": [
          { "status": "created", "data": { ...transaction } },
          { "status": "skipped", "reason": "duplicate", "import_hash": "..." },
          { "status": "error", "error": "validation message" }
        ],
        "summary": { "created": number, "skipped": number, "errors": number }
      }
      ```
    - 400 Bad Request if entire batch is malformed

- PUT /api/transactions/:id
  - Description: Replace a transaction. Use to correct values.
  - Request body: full transaction DTO
  - Behavior: If client changes `type_id` from AI-suggested value, server sets `is_manual_override=true` and preserves previous AI fields.
  - Responses: 200 OK with updated resource, 400/401/404

- PATCH /api/transactions/:id
  - Description: Partial update (e.g. change description or type)
  - Behavior: if `type_id` changed and `is_manual_override` is not true, set `is_manual_override=true`
  - Responses: 200 OK

- DELETE /api/transactions/:id
  - Description: Delete transaction
  - Responses: 204 No Content, 401, 403, 404

### 2.4 Reports (derived)
- GET /api/reports/monthly?month=YYYY-MM
  - Description: Return aggregated expenses per category, compare to budgets
  - Response:
    ```json
    { "month": "YYYY-MM", "summary": [ { "type_id": number, "type_name": string, "budget": number | null, "spend": number, "transactions_count": number } ], "totals": { "budget": number, "spend": number } }
    ```
  - Implementation: Use DB aggregations grouped by `type_id`, join with budgets for the month

---

## 3. Authentication & Authorization
- Use Supabase Auth (JWT) for all protected endpoints. The API will expect `Authorization: Bearer <access_token>` header.
- On server (Astro) endpoints, access supabase client from `context.locals.supabase` (per project convention) and validate user via `auth.getUser()` or by verifying token — prefer the server-side approach that leverages RLS.
- RLS in DB is configured so that only `authenticated` role can select/insert/update/delete on application tables — the API must pass the JWT to Supabase queries so RLS applies.
- Role mapping:
  - anon: no access to protected resources (matches DB policies)
  - authenticated: full CRUD on `transactions` and `budgets`, read-only on `transaction_types`
- Additional authorization rules:
  - Deleting or modifying historic data might require additional app-level checks (e.g., owner context) — assuming single household shared ledger, authenticated users share access; if multi-tenant introduced later, enforce `household_id` checks.

Security measures:
- Rate limiting: implement per-user rate limits via middleware (e.g., `src/middleware/index.ts`) — suggested default: 10 req/s, 5k req/day per user. For heavy endpoints (import), stricter quotas.
- Input sanitization: use Zod and avoid raw SQL concatenation. Use parameterized queries via Supabase client.
- Webhook security: HMAC signature or shared secret + timestamp
- Logging & monitoring: log unusual activity and classification errors

---

## 4. Validation & Business Logic Mapping

General validation rules (mapped from DB constraints):
- `transaction_types.position`: integer >= 0 and < 200
- `budgets.amount`: numeric >= 0 and < 1_000_000_000
- `transactions.amount`: numeric > 0 and < 100_000
- `transactions.description`: non-empty, max length 255
- `transactions.date`: date >= '2000-01-01'
- `transactions.ai_confidence`: integer between 0 and 100
- `transactions.import_hash`: optional; used for duplicate detection
- `budgets.month_date`: normalized to first day of month (YYYY-MM-01)

Zod schemas (conceptual examples):
- TransactionCreateZod:
  - type_id: z.number().int().positive()
  - amount: z.number().min(0.01).max(99999.99)
  - description: z.string().max(255)
  - date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) and date >= 2000-01-01
  - import_hash: z.string().optional()

Business rules mapped to endpoints:
1. Duplicate import prevention
   - On POST /api/transactions (and import jobs) compute/require `import_hash` (md5(date+amount+description)). If an existing transaction with the same `import_hash` exists, behavior depends on client param `deduplicate`: return 409 (error), skip, or merge. Default: skip and return per-item status in import job result.
2. AI classification
   - On create: enqueue transaction for AI classification if `is_manual_override` is false. AI worker updates `ai_status` and `ai_confidence` through `POST /api/ai/callback`. If user edits `type_id`, set `is_manual_override=true` to prevent future automatic overwrites.
3. Upserts for budgets
   - POST /api/budgets performs insert-or-update: if the composite key exists, update `amount` and return 200.
4. Reports
   - `GET /api/reports/monthly` performs DB aggregation using indexes on `transactions.date` and `transactions.type_id` for performance.

Performance considerations:
- Leverage DB indexes: queries filtering by `user_id` and `date` should use `idx_transactions_user_date` and `idx_transactions_date`.
- Use pagination to avoid large payloads; encourage client to request ranges (start_date/end_date) to limit scanned rows.
- Use background jobs for heavy imports and AI classification.

---

## 5. Error codes and responses
Common error shape:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "description", "details": { ... } } }
```
Mapping:
- 200 OK — success
- 201 Created — created resource
- 202 Accepted — request accepted for async processing
- 204 No Content — successful deletion
- 400 Bad Request — validation failure
- 401 Unauthorized — missing/invalid auth
- 403 Forbidden — operation not permitted (e.g., manual override prevents AI reclassify without force)
- 404 Not Found — resource missing
- 409 Conflict — duplicate import or conflicting state
- 422 Unprocessable Entity — semantic validation (e.g., date out-of-range)
- 500 Server Error — unexpected errors

---

## 6. Implementation Notes & Recommendations
- Implement server endpoints in `src/pages/api/*` (Astro server endpoints) using TypeScript.
- Use Zod schemas per-endpoint in `src/lib/schemas/*` and share types in `src/types.ts`.
- Use Supabase client from `context.locals.supabase` to ensure RLS is applied.
- Use middleware `src/middleware/index.ts` to implement rate limiting, logging, and auth extraction.
- For AI tasks and imports, use an async job queue (Redis + worker) or serverless function — expose job status endpoints: `/api/imports/:jobId`, `/api/ai/jobs/:jobId`.
- Add unit tests for endpoints focusing on validation and business rules (e.g., duplicate detection, manual override logic).

---

## 7. Assumptions (explicit)
- PRD was not provided in the workspace; assumptions made:
  - App is a single-household shared ledger (authenticated users share transactions). If multi-tenancy is needed later, add `household_id` and tenant checks.
  - Users authenticate with Supabase Auth; JWT is provided by client.
  - AI classification is asynchronous and optional; worker updates results via secure webhook.
  - Imports can be large; prefer asynchronous import jobs.

If you want, I can now generate endpoint skeletons (Astro server endpoints + Zod schemas + small tests) following this plan; tell me which resource to scaffold first.

