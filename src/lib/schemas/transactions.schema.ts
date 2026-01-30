import type { AIStatus } from '../../types';
import { z } from 'zod';

// Keep this list in sync with what we allow clients to project via ?fields=
export const TRANSACTION_SELECTABLE_FIELDS = [
    'id',
    'user_id',
    'type_id',
    'amount',
    'description',
    'date',
    'ai_status',
    'ai_confidence',
    'is_manual_override',
    'import_hash',
    'created_at',
    'updated_at',
] as const;

export type TransactionSelectableField = (typeof TRANSACTION_SELECTABLE_FIELDS)[number];

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const IsoDateSchema = z
    .string()
    .regex(ISO_DATE_REGEX, 'Invalid date format, expected YYYY-MM-DD')
    .refine((value) => {
        // Basic runtime check to avoid accepting impossible dates like 2025-99-99
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime())) return false;
        return date.toISOString().slice(0, 10) === value;
    }, 'Invalid date');

const coerceOptionalInt = () =>
    z
        .union([z.string(), z.number()])
        .optional()
        .transform((v) => {
            if (v === undefined) return undefined;
            const parsed = typeof v === 'number' ? v : Number.parseInt(v, 10);
            return Number.isFinite(parsed) ? parsed : undefined;
        });

const coerceOptionalNumber = () =>
    z
        .union([z.string(), z.number()])
        .optional()
        .transform((v) => {
            if (v === undefined) return undefined;
            const parsed = typeof v === 'number' ? v : Number.parseFloat(v);
            return Number.isFinite(parsed) ? parsed : undefined;
        });

const coerceOptionalBool = () =>
    z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => {
            if (v === undefined) return undefined;
            if (typeof v === 'boolean') return v;
            if (v === 'true') return true;
            if (v === 'false') return false;
            return undefined;
        });

export const TransactionIdSchema = z.object({
    id: z.string().uuid('Invalid transaction id'),
});

export const TransactionsListQuerySchema = z
    .object({
        limit: coerceOptionalInt(),
        cursor: z.string().trim().min(1).optional(),
        order: z.enum(['date.asc', 'date.desc']).default('date.desc'),
        start_date: IsoDateSchema.optional(),
        end_date: IsoDateSchema.optional(),
        type_id: coerceOptionalInt(),
        min_amount: coerceOptionalNumber(),
        max_amount: coerceOptionalNumber(),
        q: z.string().trim().min(1).optional(),
        is_manual_override: coerceOptionalBool(),
        import_hash: z.string().trim().min(1).optional(),
        page: coerceOptionalInt(),
        pageSize: coerceOptionalInt(),
        fields: z.string().trim().min(1).optional(),
    })
    .transform((data) => {
        return {
            ...data,
            limit: data.limit ?? 50,
        };
    })
    .superRefine((data, ctx) => {
        // limit bounds
        if (data.limit !== undefined && (data.limit < 1 || data.limit > 1000)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['limit'],
                message: 'limit must be between 1 and 1000',
            });
        }

        // offset fallback params
        if (data.page !== undefined && data.page < 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['page'],
                message: 'page must be >= 1',
            });
        }

        if (data.pageSize !== undefined && (data.pageSize < 1 || data.pageSize > 1000)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['pageSize'],
                message: 'pageSize must be between 1 and 1000',
            });
        }

        // date range consistency
        if (data.start_date && data.end_date && data.start_date > data.end_date) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['start_date'],
                message: 'start_date must be <= end_date',
            });
        }

        // amount range consistency
        if (data.min_amount !== undefined && data.max_amount !== undefined && data.min_amount > data.max_amount) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['min_amount'],
                message: 'min_amount must be <= max_amount',
            });
        }

        // fields must be a whitelist
        if (data.fields) {
            const fields = data.fields
                .split(',')
                .map((f) => f.trim())
                .filter(Boolean);

            const unknown = fields.filter((f) => !(TRANSACTION_SELECTABLE_FIELDS as readonly string[]).includes(f));

            if (unknown.length > 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['fields'],
                    message: `Unknown fields: ${unknown.join(', ')}`,
                });
            }
        }
    });

export type TransactionsListQueryInput = z.input<typeof TransactionsListQuerySchema>;
export type TransactionsListQuery = z.infer<typeof TransactionsListQuerySchema>;

export const CreateTransactionSchema = z.object({
    type_id: z.number().int().positive(),
    amount: z.number().finite().gt(0).lt(100_000),
    description: z.string().trim().min(1).max(255),
    date: IsoDateSchema.refine((val) => val >= '2000-01-01', 'date must be >= 2000-01-01'),
    import_hash: z.string().trim().min(1).max(255).nullable().optional(),
    is_manual_override: z.boolean().optional(),
});

export const CreateTransactionsBatchSchema = z.object({
    transactions: z.array(CreateTransactionSchema).min(1).max(1000),
});

const AIStatusSchema = z.enum(['success', 'fallback', 'error'] as const satisfies readonly AIStatus[]);

export const UpdateTransactionPutSchema = z.object({
    type_id: z.number().int().positive(),
    amount: z.number().finite().gt(0).lt(100_000),
    description: z.string().trim().min(1).max(255),
    date: IsoDateSchema.refine((val) => val >= '2000-01-01', 'date must be >= 2000-01-01'),
    is_manual_override: z.boolean().optional(),
    ai_status: AIStatusSchema.nullable().optional(),
    ai_confidence: z.number().finite().min(0).max(1).nullable().optional(),
    import_hash: z.string().trim().min(1).max(255).nullable().optional(),
});

export const PatchTransactionSchema = UpdateTransactionPutSchema.partial().refine(
    (obj) => Object.keys(obj).length > 0,
    'At least one field must be provided'
);
