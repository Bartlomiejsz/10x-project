import { useCallback, useMemo } from 'react';

import { Lock, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TransactionListItemVM } from '@/types/dashboard';

export interface TransactionItemProps {
    item: TransactionListItemVM;
    readonly: boolean;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
}

const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
};

export const TransactionItem = ({ item, readonly, onEdit, onDelete }: TransactionItemProps) => {
    const dateLabel = useMemo(() => formatDate(item.date), [item.date]);

    const handleEdit = useCallback(() => {
        if (readonly) return;
        onEdit(item.id);
    }, [readonly, onEdit, item.id]);

    const handleDelete = useCallback(() => {
        if (readonly) return;
        onDelete(item.id);
    }, [readonly, onDelete, item.id]);

    const actions = readonly ? (
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Zablokowane
        </span>
    ) : (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleEdit} aria-label="Edytuj transakcję">
                <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Usuń transakcję">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );

    return (
        <li className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.type.name}</p>
                    {/*TODO: enable when AI confidence is available*/}
                    {/*<ConfidenceBadge value={item.ai} />*/}
                    {item.isManual && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                            Ręcznie
                        </span>
                    )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.description || '—'}</p>
                <p className="mt-2 text-xs text-slate-500">{dateLabel}</p>
            </div>

            <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                <p className={cn('text-sm font-semibold', 'text-slate-900')}>{formatCurrency(item.amount)}</p>
                {actions}
            </div>
        </li>
    );
};
