import { z } from 'zod';

export const TransactionTypeFiltersSchema = z.object({
    q: z.string().trim().optional(),
    order: z.enum(['position.asc', 'position.desc']).default('position.asc'),
});

export type TransactionTypeFiltersInput = z.infer<typeof TransactionTypeFiltersSchema>;

/**
 * Schema for validating transaction type ID from URL params
 * Ensures ID is a positive integer
 */
export const TransactionTypeIdSchema = z.object({
    id: z
        .string()
        .regex(/^\d+$/, 'ID must be a positive integer')
        .transform((val) => parseInt(val, 10))
        .refine((val) => val > 0, 'ID must be greater than 0'),
});

export type TransactionTypeIdInput = z.infer<typeof TransactionTypeIdSchema>;
