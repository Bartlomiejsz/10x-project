import { MonthStringSchema } from './reports.schema';
import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
    if (!ISO_DATE_REGEX.test(value)) return false;

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return false;

    // Ensure the date round-trips (rejects e.g. 2025-02-31).
    return date.toISOString().slice(0, 10) === value;
}

/**
 * BudgetMonthDateSchema
 *
 * Accepts any ISO date (YYYY-MM-DD) within the month.
 * Normalizes it to the canonical first day of the month: YYYY-MM-01.
 */
export const BudgetMonthDateSchema = z
    .string()
    .regex(ISO_DATE_REGEX, 'Invalid date format, expected YYYY-MM-DD')
    .refine(isValidIsoDate, 'Invalid date')
    .transform((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        const year = parsed.getUTCFullYear();
        const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
        return `${year}-${month}-01`;
    });

const coerceOptionalInt = () =>
    z
        .union([z.string(), z.number()])
        .optional()
        .transform((v) => {
            if (v === undefined) return undefined;
            const parsed = typeof v === 'number' ? v : Number.parseInt(v, 10);
            return Number.isFinite(parsed) ? parsed : undefined;
        });

/**
 * Zasób budgets ma klucz kompozytowy: (month_date, type_id)
 */
export const BudgetKeyParamsSchema = z.object({
    month_date: BudgetMonthDateSchema,
    type_id: z
        .union([z.string(), z.number()])
        .transform((v) => (typeof v === 'number' ? v : Number.parseInt(v, 10)))
        .refine((v) => Number.isFinite(v) && Number.isInteger(v) && v > 0, 'type_id must be a positive integer'),
});

export const BudgetsOrderSchema = z.enum([
    'month_date.asc',
    'month_date.desc',
    'type_id.asc',
    'type_id.desc',
    'created_at.asc',
    'created_at.desc',
]);

/**
 * Query params schema for GET /api/budgets
 */
export const BudgetsListQuerySchema = z
    .object({
        month: MonthStringSchema.optional(),
        month_date: BudgetMonthDateSchema.optional(),
        type_id: coerceOptionalInt(),
        order: BudgetsOrderSchema.default('type_id.asc'),
    })
    .superRefine((data, ctx) => {
        if (data.month && data.month_date) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['month_date'],
                message: 'Provide either month or month_date, not both',
            });
        }

        if (data.type_id !== undefined && (!Number.isInteger(data.type_id) || data.type_id <= 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['type_id'],
                message: 'type_id must be a positive integer',
            });
        }
    });

/**
 * Request body schema for POST /api/budgets (create/upsert)
 */
export const CreateBudgetSchema = z.object({
    month_date: BudgetMonthDateSchema,
    type_id: z.number().int().positive(),
    amount: z.number().finite().min(0).lt(1_000_000_000),
});

/**
 * Request body schema for PUT /api/budgets/:month_date/:type_id
 */
export const UpdateBudgetSchema = z.object({
    amount: z.number().finite().min(0).lt(1_000_000_000),
});

export type BudgetsListQuery = z.infer<typeof BudgetsListQuerySchema>;
export type BudgetKeyParams = z.infer<typeof BudgetKeyParamsSchema>;
