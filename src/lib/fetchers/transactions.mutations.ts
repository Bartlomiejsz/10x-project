import { z } from 'zod';

import { TransactionSchema } from '@/lib/schemas/dashboard.schema';
import type { CreateTransactionCommand, TransactionDTO, UpdateTransactionCommand } from '@/types';

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

export const createTransaction = async (
    command: CreateTransactionCommand,
    signal?: AbortSignal
): Promise<TransactionDTO> => {
    return fetchJson('/api/transactions', TransactionSchema as unknown as z.ZodType<TransactionDTO>, {
        method: 'POST',
        body: JSON.stringify(command),
        signal,
    });
};

export const updateTransaction = async (
    id: string,
    command: UpdateTransactionCommand,
    signal?: AbortSignal
): Promise<TransactionDTO> => {
    return fetchJson(
        `/api/transactions/${encodeURIComponent(id)}`,
        TransactionSchema as unknown as z.ZodType<TransactionDTO>,
        {
            method: 'PUT',
            body: JSON.stringify(command),
            signal,
        }
    );
};
