import { useCallback, useRef, useState } from 'react';

import { createTransaction, updateTransaction } from '@/lib/fetchers/transactions.mutations';
import type { CreateTransactionCommand, TransactionDTO, UpdateTransactionCommand } from '@/types';

export interface UseTransactionUpsertResult {
    isSaving: boolean;
    error: string | null;
    create: (args: { command: CreateTransactionCommand; onSuccess?: (t: TransactionDTO) => void }) => Promise<void>;
    update: (args: {
        id: string;
        command: UpdateTransactionCommand;
        onSuccess?: (t: TransactionDTO) => void;
    }) => Promise<void>;
}

const toMessage = (err: unknown): string => {
    if (err instanceof Error && err.message.trim()) return err.message;
    return 'Nie udało się zapisać transakcji.';
};

export function useTransactionUpsert(): UseTransactionUpsertResult {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestIdRef = useRef(0);

    const create = useCallback<UseTransactionUpsertResult['create']>(async ({ command, onSuccess }) => {
        const requestId = ++requestIdRef.current;
        setIsSaving(true);
        setError(null);

        try {
            const created = await createTransaction(command);
            if (requestId !== requestIdRef.current) return;
            onSuccess?.(created);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            setError(toMessage(err));
        } finally {
            if (requestId === requestIdRef.current) setIsSaving(false);
        }
    }, []);

    const update = useCallback<UseTransactionUpsertResult['update']>(async ({ id, command, onSuccess }) => {
        const requestId = ++requestIdRef.current;
        setIsSaving(true);
        setError(null);

        try {
            const updated = await updateTransaction(id, command);
            if (requestId !== requestIdRef.current) return;
            onSuccess?.(updated);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            setError(toMessage(err));
        } finally {
            if (requestId === requestIdRef.current) setIsSaving(false);
        }
    }, []);

    return { isSaving, error, create, update };
}
