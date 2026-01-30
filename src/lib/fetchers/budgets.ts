import { z } from 'zod';

import { BudgetSchema } from '@/lib/schemas/dashboard.schema';
import type { BudgetDTO, CreateBudgetCommand } from '@/types';

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

export const upsertBudget = async (command: CreateBudgetCommand, signal?: AbortSignal): Promise<BudgetDTO> => {
    return fetchJson('/api/budgets', BudgetSchema as unknown as z.ZodType<BudgetDTO>, {
        method: 'POST',
        body: JSON.stringify(command),
        signal,
    });
};

// updateBudget pozostawimy do kolejnych kroków, gdy będzie potrzebny PUT.
