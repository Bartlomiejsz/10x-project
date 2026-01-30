import { z } from 'zod';

export const deleteTransaction = async (id: string, signal?: AbortSignal): Promise<{ ok: true }> => {
    const response = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        signal,
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Request failed (${response.status}): ${message || response.statusText}`);
    }

    const data = await response.json();
    return z.object({ ok: z.literal(true) }).parse(data);
};
