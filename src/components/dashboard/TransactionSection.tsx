import { TransactionList } from './TransactionList';
import { TransactionToolbar } from './TransactionToolbar';

import type { TransactionTypeDTO } from '@/types';
import type { TransactionFilterVM, TransactionListItemVM } from '@/types/dashboard';

export interface TransactionSectionProps {
    month: string;
    readonly: boolean;
    filters: TransactionFilterVM;
    onChangeFilters: (patch: Partial<TransactionFilterVM>) => void;
    onResetFilters: () => void;
    types: TransactionTypeDTO[];
    items: TransactionListItemVM[];
    hasMore: boolean;
    isLoadingMore: boolean;
    loadError: string | null;
    onLoadMore: () => void;
    onRetry: () => void;
    resultsCount?: number;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

export const TransactionSection = ({
    readonly,
    filters,
    onChangeFilters,
    onResetFilters,
    types,
    items,
    hasMore,
    isLoadingMore,
    loadError,
    onLoadMore,
    onRetry,
    resultsCount,
    onEdit,
    onDelete,
}: TransactionSectionProps) => {
    return (
        <section className="space-y-4">
            <TransactionToolbar
                value={filters}
                onChange={onChangeFilters}
                onReset={onResetFilters}
                types={types}
                resultsCount={resultsCount}
            />
            <TransactionList
                items={items}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                loadError={loadError}
                onLoadMore={onLoadMore}
                onRetry={onRetry}
                readonly={readonly}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        </section>
    );
};
