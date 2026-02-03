import { z } from 'zod';

const normalizeAmountInput = (raw: string): string => raw.replace(',', '.').replace(/\s/g, '');

const parseAmount = (raw: string): number | null => {
    const normalized = normalizeAmountInput(raw);
    if (!normalized) return null;

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return null;
    if (parsed <= 0) return null;

    return Math.round(parsed * 100) / 100;
};

export const transactionFormSchema = z.object({
    amount: z
        .string()
        .min(1, 'Podaj kwotę.')
        .refine((val) => parseAmount(val) !== null, { message: 'Podaj poprawną kwotę (> 0).' }),
    description: z.string().max(200),
    date: z.string().min(1, 'Podaj datę.'),
    type_id: z.number().positive('Wybierz kategorię.'),
    is_manual_override: z.boolean(),
});

export type TransactionFormInput = z.infer<typeof transactionFormSchema>;

/** Parse and normalize amount string to number */
export { parseAmount };
