import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn } from '@/lib/utils';
import type { TransactionTypeDTO } from '@/types';
import type { TransactionFilterVM } from '@/types/dashboard';

export interface TransactionToolbarProps {
    value: TransactionFilterVM;
    onChange: (patch: Partial<TransactionFilterVM>) => void;
    onReset: () => void;
    types: TransactionTypeDTO[];
    resultsCount?: number;
    className?: string;
}

const SORT_OPTIONS: { value: TransactionFilterVM['sort']; label: string }[] = [
    { value: 'date.desc', label: 'Data: najnowsze' },
    { value: 'date.asc', label: 'Data: najstarsze' },
    { value: 'amount.desc', label: 'Kwota: malejąco' },
    { value: 'amount.asc', label: 'Kwota: rosnąco' },
];

export const TransactionToolbar = ({
    value,
    onChange,
    onReset,
    types,
    resultsCount,
    className,
}: TransactionToolbarProps) => {
    const [search, setSearch] = useState(value.q ?? '');

    useEffect(() => {
        setSearch(value.q ?? '');
    }, [value.q]);

    useEffect(() => {
        const trimmed = search.trim();
        const handle = window.setTimeout(() => {
            onChange({ q: trimmed || undefined });
        }, 250);

        return () => window.clearTimeout(handle);
    }, [search, onChange]);

    const typeOptions = useMemo(() => [{ id: 'all', name: 'Wszystkie kategorie' }, ...types], [types]);

    const handleTypeChange = useCallback(
        (raw: string) => {
            if (raw === 'all') {
                onChange({ typeId: undefined });
                return;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) return;
            onChange({ typeId: parsed });
        },
        [onChange]
    );

    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-end sm:justify-between',
                className
            )}
        >
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <label className="text-xs font-medium text-slate-600" htmlFor="tx-search">
                        Szukaj
                    </label>
                    <Input
                        id="tx-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Opis transakcji…"
                        autoComplete="off"
                    />
                </div>

                <div className="sm:w-[220px]">
                    <label className="text-xs font-medium text-slate-600" htmlFor="tx-type">
                        Kategoria
                    </label>
                    <Select value={value.typeId ? String(value.typeId) : 'all'} onValueChange={handleTypeChange}>
                        <SelectTrigger id="tx-type">
                            <SelectValue placeholder="Wybierz kategorię" />
                        </SelectTrigger>
                        <SelectContent>
                            {typeOptions.map((opt) => (
                                <SelectItem key={String(opt.id)} value={String(opt.id)}>
                                    {opt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="sm:w-[220px]">
                    <label className="text-xs font-medium text-slate-600" htmlFor="tx-sort">
                        Sortowanie
                    </label>
                    <Select
                        value={value.sort}
                        onValueChange={(v) => onChange({ sort: v as TransactionFilterVM['sort'] })}
                    >
                        <SelectTrigger id="tx-sort">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SORT_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <p className="text-xs text-slate-500">{resultsCount !== undefined ? `${resultsCount} wyników` : ' '}</p>
                <Button variant="outline" onClick={onReset}>
                    Wyczyść filtry
                </Button>
            </div>
        </div>
    );
};
