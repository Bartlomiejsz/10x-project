import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn } from '@/lib/utils';
import type { TransactionTypeDTO } from '@/types';
import type { TransactionDialogMode, TransactionFormValues } from '@/types/dashboard';

export interface TransactionDialogSubmitPayload {
    mode: TransactionDialogMode;
    transactionId?: string;
    values: { amount: number; description: string; date: string; type_id: number; is_manual_override?: boolean };
}

export interface TransactionDialogProps {
    open: boolean;
    mode: TransactionDialogMode;
    month: string; // YYYY-MM
    types: TransactionTypeDTO[];
    transactionId?: string;
    initial?: Partial<TransactionFormValues>;
    isReadonly?: boolean;
    isSaving?: boolean;
    error?: string | null;
    onClose: () => void;
    onSubmit: (payload: TransactionDialogSubmitPayload) => void;
}

const normalizeAmountInput = (raw: string): string => raw.replace(',', '.').replace(/\s/g, '');

const parseAmount = (raw: string): number | null => {
    const normalized = normalizeAmountInput(raw);
    if (!normalized) return null;

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return null;
    if (parsed <= 0) return null;

    return Math.round(parsed * 100) / 100;
};

const toIsoDate = (value: Date) => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const TransactionDialog = ({
    open,
    mode,
    types,
    transactionId,
    initial,
    isReadonly,
    isSaving,
    error,
    onClose,
    onSubmit,
}: TransactionDialogProps) => {
    const titleId = useId();
    const descriptionId = useId();
    const amountId = useId();
    const dateId = useId();
    const typeId = useId();
    const descriptionFieldId = useId();

    const today = useMemo(() => toIsoDate(new Date()), []);

    const defaultValues = useMemo<TransactionFormValues>(() => {
        return {
            amount: initial?.amount ?? '',
            description: initial?.description ?? '',
            date: initial?.date ?? today,
            type_id: initial?.type_id ?? types[0]?.id ?? 0,
            is_manual_override: initial?.is_manual_override ?? false,
        };
    }, [initial, today, types]);

    const [values, setValues] = useState<TransactionFormValues>(defaultValues);
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!open) return;
        setValues(defaultValues);
        setTouched({});
    }, [open, defaultValues]);

    const validation = useMemo(() => {
        const amount = parseAmount(values.amount);
        const dateOk = Boolean(values.date);
        const typeOk = Number.isFinite(values.type_id) && values.type_id > 0;

        return {
            amount,
            amountError: touched.amount && amount === null ? 'Podaj poprawną kwotę (> 0).' : null,
            dateError: touched.date && !dateOk ? 'Podaj datę.' : null,
            typeError: touched.type_id && !typeOk ? 'Wybierz kategorię.' : null,
            canSubmit: amount !== null && dateOk && typeOk && !isReadonly && !isSaving,
        };
    }, [values, touched, isReadonly, isSaving]);

    const handleSubmit = useCallback(() => {
        if (!open) return;
        if (isReadonly) return;

        setTouched({ amount: true, date: true, type_id: true });

        const amount = parseAmount(values.amount);
        if (amount === null) return;
        if (!values.date) return;
        if (!values.type_id) return;

        onSubmit({
            mode,
            transactionId,
            values: {
                amount,
                description: values.description.trim(),
                date: values.date,
                type_id: values.type_id,
                is_manual_override: values.is_manual_override,
            },
        });
    }, [open, isReadonly, values, onSubmit, mode, transactionId]);

    useEffect(() => {
        if (!open) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
            }
        };

        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose, handleSubmit]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} aria-hidden="true" />
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={descriptionId}
                    className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                                {mode === 'create' ? 'Dodaj transakcję' : 'Edytuj transakcję'}
                            </h2>
                            <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                                {mode === 'create'
                                    ? 'Wprowadź szczegóły wydatku dla wybranego miesiąca.'
                                    : 'Zmień szczegóły transakcji.'}
                            </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Zamknij">
                            ×
                        </Button>
                    </div>

                    <div className="mt-5 space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor={amountId} className="text-xs font-medium text-slate-600">
                                    Kwota
                                </label>
                                <Input
                                    id={amountId}
                                    inputMode="decimal"
                                    value={values.amount}
                                    disabled={Boolean(isReadonly) || Boolean(isSaving)}
                                    onChange={(e) => {
                                        setValues((prev) => ({ ...prev, amount: e.target.value }));
                                        setTouched((t) => ({ ...t, amount: true }));
                                    }}
                                    placeholder="0,00"
                                    className={cn(
                                        validation.amountError && 'border-red-300 focus-visible:ring-red-400'
                                    )}
                                />
                                {validation.amountError && (
                                    <p className="mt-1 text-xs text-red-700">{validation.amountError}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor={dateId} className="text-xs font-medium text-slate-600">
                                    Data
                                </label>
                                <Input
                                    id={dateId}
                                    type="date"
                                    value={values.date}
                                    disabled={Boolean(isReadonly) || Boolean(isSaving)}
                                    onChange={(e) => {
                                        setValues((prev) => ({ ...prev, date: e.target.value }));
                                        setTouched((t) => ({ ...t, date: true }));
                                    }}
                                    className={cn(validation.dateError && 'border-red-300 focus-visible:ring-red-400')}
                                />
                                {validation.dateError && (
                                    <p className="mt-1 text-xs text-red-700">{validation.dateError}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor={typeId} className="text-xs font-medium text-slate-600">
                                Kategoria
                            </label>
                            <Select
                                // SelectTrigger będzie miał id (label-has-associated-control)
                                value={String(values.type_id || '')}
                                onValueChange={(v) => {
                                    const next = Number(v);
                                    setValues((prev) => ({ ...prev, type_id: next }));
                                    setTouched((t) => ({ ...t, type_id: true }));
                                }}
                                disabled={Boolean(isReadonly) || Boolean(isSaving)}
                            >
                                <SelectTrigger
                                    id={typeId}
                                    className={cn(
                                        'mt-1',
                                        validation.typeError && 'border-red-300 focus-visible:ring-red-400'
                                    )}
                                >
                                    <SelectValue placeholder="Wybierz…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {types.map((t) => (
                                        <SelectItem key={t.id} value={String(t.id)}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {validation.typeError && (
                                <p className="mt-1 text-xs text-red-700">{validation.typeError}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor={descriptionFieldId} className="text-xs font-medium text-slate-600">
                                Opis
                            </label>
                            <Input
                                id={descriptionFieldId}
                                value={values.description}
                                disabled={Boolean(isReadonly) || Boolean(isSaving)}
                                onChange={(e) => setValues((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="np. Biedronka"
                                maxLength={200}
                            />
                            <p className="mt-1 text-xs text-slate-500">Ctrl/⌘ + Enter zapisuje.</p>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                                {error}
                            </div>
                        )}

                        {isReadonly && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                Ten miesiąc jest tylko do podglądu.
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Anuluj
                            </Button>
                            <Button type="button" onClick={handleSubmit} disabled={!validation.canSubmit}>
                                {isSaving ? 'Zapisywanie…' : mode === 'create' ? 'Dodaj' : 'Zapisz'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
