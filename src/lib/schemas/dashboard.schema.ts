import { z } from 'zod';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MonthStringSchema = z.string().regex(MONTH_REGEX, 'Invalid month format (YYYY-MM)');

export const TransactionTypeSchema = z.object({
    id: z.number().int().nonnegative(),
    code: z.string().min(1),
    name: z.string().min(1),
    position: z.number().int(),
});

export const BudgetSchema = z.object({
    amount: z.number(),
    created_at: z.string(),
    month_date: z.string(),
    type_id: z.number().int(),
    updated_at: z.string(),
});

export const TransactionSchema = z.object({
    id: z.string(),
    type_id: z.number().int(),
    amount: z.number(),
    description: z.string(),
    date: z.string(),
    import_hash: z.string().nullable(),
    ai_confidence: z.number().nullable(),
    ai_status: z.enum(['success', 'fallback', 'error']).nullable(),
    is_manual_override: z.boolean(),
});

export const MonthlyReportShareSchema = z.object({
    user_id: z.string(),
    spend: z.number(),
    transactions_count: z.number().int(),
});

export const MonthlyReportItemSchema = z.object({
    type_id: z.number().int(),
    type_name: z.string(),
    budget: z.number().nullable(),
    spend: z.number(),
    transactions_count: z.number().int(),
    shares: z.array(MonthlyReportShareSchema),
});

export const MonthlyReportSchema = z.object({
    month: MonthStringSchema,
    summary: z.array(MonthlyReportItemSchema),
    totals: z.object({
        budget: z.number(),
        spend: z.number(),
    }),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        next_cursor: z.string().nullable().optional(),
        count: z.number().nullable().optional(),
    });
