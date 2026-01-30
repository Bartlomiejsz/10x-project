import { useCallback, useRef, useState } from 'react';

import { deleteTransaction } from '@/lib/fetchers/transactions';

export interface UseTransactionMutationsResult {
    isDeleting: boolean;
    deleteError: string | null;
    deleteById: (args: { id: string; onSuccess?: () => void; onError?: (message: string) => void }) => Promise<void>;
}

const toMessage = (err: unknown): string => {
    if (err instanceof Error && err.message.trim()) return err.message;
    return 'Nie udało się wykonać operacji.';
};

export function useTransactionMutations(): UseTransactionMutationsResult {
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const requestIdRef = useRef(0);

    const deleteById = useCallback<UseTransactionMutationsResult['deleteById']>(async ({ id, onSuccess, onError }) => {
        const requestId = ++requestIdRef.current;
        setIsDeleting(true);
        setDeleteError(null);

        try {
            await deleteTransaction(id);

            if (requestId !== requestIdRef.current) return;

            onSuccess?.();
        } catch (err) {
            if (requestId !== requestIdRef.current) return;

            const message = toMessage(err);
            setDeleteError(message);
            onError?.(message);
        } finally {
            if (requestId === requestIdRef.current) {
                setIsDeleting(false);
            }
        }
    }, []);

    return { isDeleting, deleteError, deleteById };
}
