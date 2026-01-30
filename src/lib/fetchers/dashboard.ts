import {
    BudgetSchema,
    MonthStringSchema,
    MonthlyReportSchema,
    TransactionSchema,
    TransactionTypeSchema,
    paginatedResponseSchema,
} from '../schemas/dashboard.schema';
import { z } from 'zod';

import type { TransactionFilters, TransactionTypeFilters } from '@/types';

const withJsonHeaders = (init?: RequestInit): RequestInit => ({
    ...init,
    headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
    },
});

const fetchJson = async <T>(url: string, schema: z.ZodType<T>, init?: RequestInit) => {
    const response = await fetch(url, withJsonHeaders(init));

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Request failed (${response.status}): ${message || response.statusText}`);
    }

    const data = await response.json();
    return schema.parse(data);
};

const buildTransactionTypeQuery = (filters?: TransactionTypeFilters) => {
    const params = new URLSearchParams();
    if (filters?.q?.trim()) {
        params.set('q', filters.q.trim());
    }
    params.set('order', filters?.order ?? 'position.asc');
    const query = params.toString();
    return query ? `?${query}` : '';
};

const applyTransactionFilters = (params: URLSearchParams, filters?: TransactionFilters) => {
    if (!filters) return;

    const setIfPresent = (key: string, value?: string | number | boolean | null) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
    };

    setIfPresent('limit', filters.limit);
    setIfPresent('cursor', filters.cursor);
    setIfPresent('order', filters.order);
    setIfPresent('start_date', filters.start_date);
    setIfPresent('end_date', filters.end_date);
    setIfPresent('type_id', filters.type_id);
    setIfPresent('min_amount', filters.min_amount);
    setIfPresent('max_amount', filters.max_amount);
    setIfPresent('q', filters.q?.trim());
    setIfPresent('is_manual_override', filters.is_manual_override);
    setIfPresent('import_hash', filters.import_hash);
    setIfPresent('page', filters.page);
    setIfPresent('pageSize', filters.pageSize);
    setIfPresent('fields', filters.fields);
};

export const fetchTransactionTypes = async (filters?: TransactionTypeFilters, signal?: AbortSignal) => {
    const query = buildTransactionTypeQuery(filters);
    return fetchJson(`/api/transaction-types${query}`, z.array(TransactionTypeSchema), { signal });
};

export const fetchBudgetsByMonth = async (month: string, signal?: AbortSignal) => {
    const validatedMonth = MonthStringSchema.parse(month);
    const query = `?month=${encodeURIComponent(validatedMonth)}`;
    return fetchJson(`/api/budgets${query}`, z.array(BudgetSchema), { signal });
};

export const fetchMonthlyReport = async (month: string, signal?: AbortSignal) => {
    const validatedMonth = MonthStringSchema.parse(month);
    const query = `?month=${encodeURIComponent(validatedMonth)}`;
    return fetchJson(`/api/reports/monthly${query}`, MonthlyReportSchema, { signal });
};

export const fetchTransactions = async (month: string, filters?: TransactionFilters, signal?: AbortSignal) => {
    const validatedMonth = MonthStringSchema.parse(month);
    const params = new URLSearchParams();
    params.set('month', validatedMonth);
    applyTransactionFilters(params, filters);

    const url = `/api/transactions?${params.toString()}`;

    const schema = paginatedResponseSchema(TransactionSchema);
    return fetchJson(url, schema, { signal });
};
