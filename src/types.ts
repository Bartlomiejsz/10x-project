import type { Enums, Tables, TablesInsert, TablesUpdate } from './db/database.types';

// ============================================================================
// Transaction Types (Read-only dictionary)
// ============================================================================

/**
 * Transaction Type DTO - read-only category representation
 * Used in: GET /api/transaction-types, GET /api/transaction-types/:id
 */
export type TransactionTypeDTO = Omit<Tables<'transaction_types'>, 'created_at' | 'updated_at'>;

// ============================================================================
// Budgets (Monthly planned amounts per category)
// ============================================================================

/**
 * Budget DTO - full budget representation
 * Used in: GET /api/budgets, GET /api/budgets/:month_date/:type_id
 */
export type BudgetDTO = Tables<'budgets'>;

/**
 * Create Budget Command - create or upsert a budget
 * Used in: POST /api/budgets
 */
export type CreateBudgetCommand = Pick<TablesInsert<'budgets'>, 'month_date' | 'type_id' | 'amount'>;

/**
 * Update Budget Command - update budget amount
 * Used in: PUT /api/budgets/:month_date/:type_id
 */
export type UpdateBudgetCommand = Pick<TablesUpdate<'budgets'>, 'amount'>;

// ============================================================================
// Transactions (Primary ledger)
// ============================================================================

/**
 * Transaction DTO - full transaction representation
 * Used in: GET /api/transactions, GET /api/transactions/:id
 */
export type TransactionDTO = Tables<'transactions'>;

/**
 * AI Status enum from database
 */
export type AIStatus = Enums<'ai_status'>;

/**
 * Create Transaction Command - create a single transaction
 * Used in: POST /api/transactions (single entry)
 * Note: user_id is extracted from auth context, not provided by client
 */
export type CreateTransactionCommand = Pick<
    TablesInsert<'transactions'>,
    'type_id' | 'amount' | 'description' | 'date'
> & {
    import_hash?: string | null;
    is_manual_override?: boolean;
};

/**
 * Create Transactions Batch Command - batch import multiple transactions
 * Used in: POST /api/transactions (batch mode)
 */
export interface CreateTransactionsBatchCommand {
    transactions: CreateTransactionCommand[];
}

/**
 * Update Transaction Command - full replace of transaction (PUT)
 * Used in: PUT /api/transactions/:id
 * Allows updating all mutable fields including AI-related metadata
 */
export type UpdateTransactionCommand = Pick<
    TablesUpdate<'transactions'>,
    'type_id' | 'amount' | 'description' | 'date' | 'is_manual_override'
> & {
    ai_status?: AIStatus | null;
    ai_confidence?: number | null;
    import_hash?: string | null;
};

/**
 * Patch Transaction Command - partial update (PATCH)
 * Used in: PATCH /api/transactions/:id
 */
export type PatchTransactionCommand = Partial<UpdateTransactionCommand>;

// ============================================================================
// Pagination & Filtering
// ============================================================================

/**
 * Paginated Response - generic wrapper for list endpoints with cursor pagination
 */
export interface PaginatedResponse<T> {
    data: T[];
    next_cursor?: string | null;
    count?: number;
}

/**
 * Transaction Filters - query parameters for filtering transactions
 * Used in: GET /api/transactions
 */
export interface TransactionFilters {
    limit?: number;
    cursor?: string;
    order?: 'date.asc' | 'date.desc';
    month?: string; // YYYY-MM
    type_id?: number;
    min_amount?: number;
    max_amount?: number;
    q?: string; // full-text search on description
    is_manual_override?: boolean;
    import_hash?: string;
    page?: number; // offset fallback
    pageSize?: number; // offset fallback
    fields?: string; // comma-separated projection
}

/**
 * Budget Filters - query parameters for filtering budgets
 * Used in: GET /api/budgets
 */
export interface BudgetFilters {
    month?: string; // YYYY-MM
    month_date?: string; // YYYY-MM-01
    type_id?: number;
    order?:
        | 'month_date.asc'
        | 'month_date.desc'
        | 'type_id.asc'
        | 'type_id.desc'
        | 'created_at.asc'
        | 'created_at.desc';
}

/**
 * Transaction Type Filters - query parameters for transaction types
 * Used in: GET /api/transaction-types
 */
export interface TransactionTypeFilters {
    q?: string; // search by name or code
    order?: 'position.asc' | 'position.desc';
}

// ============================================================================
// Batch Import Results
// ============================================================================

/**
 * Batch Import Item Result - status of a single transaction in batch import
 */
export type BatchImportItemResult =
    | {
          status: 'created';
          data: TransactionDTO;
      }
    | {
          status: 'skipped';
          reason: 'duplicate';
          import_hash: string;
      }
    | {
          status: 'error';
          error: string;
      };

/**
 * Batch Import Result - complete response for batch transaction import
 * Used in: POST /api/transactions (batch mode) - 207 Multi-Status response
 */
export interface BatchImportResult {
    results: BatchImportItemResult[];
    summary: {
        created: number;
        skipped: number;
        errors: number;
    };
}

// ============================================================================
// Reports (Derived/Aggregated data)
// ============================================================================

/**
 * Monthly Report Item - single category summary in monthly report
 */
export interface MonthlyReportItemDTO {
    type_id: number;
    type_name: string;
    budget: number | null;
    spend: number;
    transactions_count: number;
    shares: MonthlyReportShareDTO[];
}

/**
 * Monthly Report Share - aggregated spend per user in a given month
 */
export interface MonthlyReportShareDTO {
    user_id: string;
    spend: number;
    transactions_count: number;
}

/**
 * Monthly Report DTO - aggregated monthly expenses vs budgets
 * Used in: GET /api/reports/monthly
 */
export interface MonthlyReportDTO {
    month: string; // YYYY-MM
    summary: MonthlyReportItemDTO[];
    totals: {
        budget: number;
        spend: number;
    };
}

// ============================================================================
// UI Messaging
// ============================================================================

export interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    description?: string;
}

// ============================================================================
// Error Response
// ============================================================================

/**
 * API Error Response - standardized error structure
 */
export interface APIErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}
