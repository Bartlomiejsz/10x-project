import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchTransactions } from '@/lib/fetchers/dashboard';
import type { PaginatedResponse, TransactionDTO } from '@/types';
import type { TransactionTypeDTO } from '@/types';
import type { MonthParam, TransactionFilterVM, TransactionListItemVM } from '@/types/dashboard';

export interface UseInfiniteTransactionsResult {
    items: TransactionListItemVM[];
    count?: number;
    hasMore: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: Error | null;
    loadMore: () => void;
    retry: () => void;
    reset: () => void;
}

const toOrder = (sort: TransactionFilterVM['sort']): 'date.asc' | 'date.desc' => {
    if (sort === 'date.asc') return 'date.asc';
    if (sort === 'date.desc') return 'date.desc';

    // API types.ts wspiera tylko order po dacie.
    // Dla amount.* można dodać wsparcie po stronie API; teraz robimy fallback date.desc.
    return 'date.desc';
};

const mapTransactionToVM = (transaction: TransactionDTO, types: TransactionTypeDTO[]): TransactionListItemVM => {
    const type = types.find((t) => t.id === transaction.type_id);

    const confidence = transaction.ai_confidence;
    const level =
        confidence === null || confidence === undefined
            ? 'low'
            : confidence >= 0.8
              ? 'high'
              : confidence >= 0.5
                ? 'medium'
                : 'low';

    return {
        id: transaction.id,
        type: type ?? { id: transaction.type_id, code: 'unknown', name: 'Nieznana kategoria', position: 0 },
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
        ai: {
            status: (transaction.ai_status ?? 'error') as 'success' | 'fallback' | 'error',
            confidence: transaction.ai_confidence,
            level,
        },
        isManual: transaction.is_manual_override ?? false,
    };
};

export const useInfiniteTransactions = ({
    month,
    filters,
    types,
    pageSize = 30,
}: {
    month: MonthParam;
    filters: TransactionFilterVM;
    types: TransactionTypeDTO[];
    pageSize?: number;
}): UseInfiniteTransactionsResult => {
    const [pages, setPages] = useState<PaginatedResponse<TransactionDTO>[]>([]);
    const [count, setCount] = useState<number | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [cursor, setCursor] = useState<string | null | undefined>(undefined);
    const [refetchToken, setRefetchToken] = useState(0);

    const baseQueryKey = useMemo(
        () => `${month.value}|${filters.q ?? ''}|${filters.typeId ?? ''}|${filters.sort}`,
        [month.value, filters.q, filters.typeId, filters.sort]
    );

    const reset = useCallback(() => {
        setPages([]);
        setCursor(undefined);
        setCount(undefined);
    }, []);

    const retry = useCallback(() => {
        setRefetchToken((v) => v + 1);
    }, []);

    useEffect(() => {
        reset();
    }, [baseQueryKey, reset]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const loadFirstPage = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetchTransactions(
                    month.value,
                    {
                        limit: pageSize,
                        order: toOrder(filters.sort),
                        q: filters.q,
                        type_id: filters.typeId,
                        cursor: undefined,
                    },
                    controller.signal
                );

                if (cancelled) return;

                setPages([response]);
                setCursor(response.next_cursor ?? null);
                setCount(response.count ?? undefined);
            } catch (err) {
                if (cancelled) return;
                // eslint-disable-next-line no-console
                console.error(err);
                setError(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadFirstPage();

        return () => {
            cancelled = true;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month.value, baseQueryKey, pageSize, refetchToken]);

    const loadMore = useCallback(() => {
        if (isLoading) return;
        if (isLoadingMore) return;
        if (!cursor) return;

        setIsLoadingMore(true);
        setError(null);

        const controller = new AbortController();

        fetchTransactions(
            month.value,
            {
                limit: pageSize,
                order: toOrder(filters.sort),
                q: filters.q,
                type_id: filters.typeId,
                cursor,
            },
            controller.signal
        )
            .then((response) => {
                setPages((prev) => [...prev, response]);
                setCursor(response.next_cursor ?? null);
                setCount(response.count ?? undefined);
            })
            .catch((err) => {
                // eslint-disable-next-line no-console
                console.error(err);
                setError(err instanceof Error ? err : new Error('Unknown error'));
            })
            .finally(() => {
                setIsLoadingMore(false);
            });

        return () => controller.abort();
    }, [cursor, month.value, pageSize, filters.q, filters.sort, filters.typeId, isLoading, isLoadingMore]);

    const items = useMemo(() => {
        const data = pages.flatMap((p) => p.data);
        return data.map((t) => mapTransactionToVM(t, types));
    }, [pages, types]);

    const hasMore = Boolean(cursor);

    return {
        items,
        count,
        hasMore,
        isLoading,
        isLoadingMore,
        error,
        loadMore,
        retry,
        reset,
    };
};
