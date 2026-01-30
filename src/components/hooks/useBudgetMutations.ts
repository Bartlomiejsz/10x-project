import { useCallback, useRef, useState } from 'react';

import { upsertBudget } from '@/lib/fetchers/budgets';
import type { BudgetDTO, CreateBudgetCommand } from '@/types';

export interface UseBudgetMutationsResult {
    isSaving: boolean;
    error: string | null;
    upsertOptimistic: (args: {
        month_date: string;
        type_id: number;
        amount: number;
        previous?: BudgetDTO | null;
        onOptimistic: (next: BudgetDTO) => void;
        onRollback: (previous: BudgetDTO | null | undefined) => void;
        onSuccess?: (saved: BudgetDTO) => void;
    }) => Promise<void>;
}

const tryParseApiError = async (err: unknown): Promise<string | null> => {
    if (!(err instanceof Error)) return null;
    return err.message;
};

export function useBudgetMutations(): UseBudgetMutationsResult {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestIdRef = useRef(0);

    const upsertOptimistic = useCallback<UseBudgetMutationsResult['upsertOptimistic']>(
        async ({ month_date, type_id, amount, previous, onOptimistic, onRollback, onSuccess }) => {
            const requestId = ++requestIdRef.current;
            setIsSaving(true);
            setError(null);

            const optimistic: BudgetDTO = {
                month_date,
                type_id,
                amount,
                created_at: previous?.created_at ?? new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as BudgetDTO;

            onOptimistic(optimistic);

            try {
                const cmd: CreateBudgetCommand = { month_date, type_id, amount };
                const saved = await upsertBudget(cmd);

                if (requestId !== requestIdRef.current) return;

                onOptimistic(saved);
                onSuccess?.(saved);
            } catch (err) {
                if (requestId !== requestIdRef.current) return;

                const message = (await tryParseApiError(err)) ?? 'Nie udało się zapisać budżetu.';
                setError(message);
                onRollback(previous);
            } finally {
                if (requestId === requestIdRef.current) {
                    setIsSaving(false);
                }
            }
        },
        []
    );

    return { isSaving, error, upsertOptimistic };
}
