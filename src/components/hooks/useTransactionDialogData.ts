import { useEffect, useMemo, useState } from 'react';

import { TransactionSchema } from '@/lib/schemas/dashboard.schema';
import type { TransactionDTO } from '@/types';

export interface UseTransactionDialogDataResult {
    transaction: TransactionDTO | null;
    isLoading: boolean;
    error: string | null;
}

const fetchTransactionById = async (id: string, signal?: AbortSignal): Promise<TransactionDTO> => {
    const response = await fetch(`/api/transactions/${encodeURIComponent(id)}`, { signal });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Request failed (${response.status}): ${message || response.statusText}`);
    }

    const data = await response.json();
    return (TransactionSchema as unknown as typeof TransactionSchema).parse(data) as unknown as TransactionDTO;
};

export function useTransactionDialogData(args: { open: boolean; transactionId?: string; mode: 'create' | 'edit' }) {
    const { open, transactionId, mode } = args;

    const shouldLoad = open && mode === 'edit' && Boolean(transactionId);

    const [transaction, setTransaction] = useState<TransactionDTO | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shouldLoad) {
            setTransaction(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setIsLoading(true);
        setError(null);

        fetchTransactionById(transactionId as string, controller.signal)
            .then((t) => {
                setTransaction(t);
            })
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Nie udało się pobrać transakcji.');
            })
            .finally(() => {
                setIsLoading(false);
            });

        return () => controller.abort();
    }, [shouldLoad, transactionId]);

    return useMemo<UseTransactionDialogDataResult>(
        () => ({ transaction, isLoading, error }),
        [transaction, isLoading, error]
    );
}
