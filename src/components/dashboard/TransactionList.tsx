import { useEffect, useRef } from 'react';

import { TransactionItem } from './TransactionItem';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';
import type { TransactionListItemVM } from '@/types/dashboard';

export interface TransactionListProps {
    items: TransactionListItemVM[];
    hasMore: boolean;
    isLoadingMore: boolean;
    loadError: string | null;
    onLoadMore: () => void;
    onRetry: () => void;
    readonly: boolean;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    className?: string;
}

export const TransactionList = ({
    items,
    hasMore,
    isLoadingMore,
    loadError,
    onLoadMore,
    onRetry,
    readonly,
    onEdit,
    onDelete,
    className,
}: TransactionListProps) => {
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        if (!hasMore) return;
        if (loadError) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) return;
                if (isLoadingMore) return;
                onLoadMore();
            },
            { rootMargin: '240px 0px' }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, onLoadMore, loadError]);

    if (items.length === 0) {
        return (
            <div
                className={cn(
                    'rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-600',
                    className
                )}
            >
                Brak transakcji dla wybranego miesiąca.
            </div>
        );
    }

    return (
        <div className={cn('space-y-3', className)}>
            <ul className="space-y-3">
                {items.map((item) => (
                    <TransactionItem
                        key={item.id}
                        item={item}
                        readonly={readonly}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
            </ul>

            {loadError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    <p className="font-semibold">Nie udało się wczytać kolejnych transakcji.</p>
                    <p className="mt-1 text-red-700">{loadError}</p>
                    <Button className="mt-3" variant="outline" onClick={onRetry}>
                        Spróbuj ponownie
                    </Button>
                </div>
            )}

            {hasMore && !loadError && (
                <div ref={sentinelRef} className="flex items-center justify-center py-4">
                    <p className="text-xs text-slate-500">
                        {isLoadingMore ? 'Ładowanie…' : 'Przewiń, aby wczytać więcej'}
                    </p>
                </div>
            )}

            {!hasMore && items.length > 0 && (
                <p className="py-2 text-center text-xs text-slate-500">To już wszystkie transakcje.</p>
            )}
        </div>
    );
};
