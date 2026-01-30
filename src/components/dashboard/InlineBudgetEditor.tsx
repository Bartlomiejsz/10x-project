import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { Check, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface InlineBudgetEditorProps {
    value: number | null;
    spend: number;
    monthDate: string; // YYYY-MM-01
    typeId: number;
    canEdit: boolean;
    onCommit: (nextAmount: number) => void;
    isSaving?: boolean;
    errorMessage?: string | null;
}

const normalizeAmountInput = (raw: string): string => raw.replace(',', '.').replace(/\s/g, '');

const parseAmount = (raw: string): number | null => {
    const normalized = normalizeAmountInput(raw);
    if (!normalized) return null;

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return null;

    // budżet może być 0
    if (parsed < 0) return null;
    if (parsed > 1_000_000_000) return null;

    // maks 2 miejsca po przecinku
    return Math.round(parsed * 100) / 100;
};

export const InlineBudgetEditor = ({
    value,
    spend,
    monthDate,
    typeId,
    canEdit,
    onCommit,
    isSaving,
    errorMessage,
}: InlineBudgetEditorProps) => {
    const inputId = useId();

    const initialText = useMemo(() => {
        if (value === null) return '';
        return String(value);
    }, [value]);

    const [text, setText] = useState(initialText);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        // jeśli przychodzi nowa wartość z zewnątrz, aktualizujemy input i zdejmujemy 'dirty'
        setText(initialText);
        setIsDirty(false);
    }, [initialText]);

    const parsedAmount = useMemo(() => parseAmount(text), [text]);

    const hasValidationError = useMemo(() => {
        if (!isDirty) return false;
        if (text.trim() === '') return false; // pozwalamy na wpisywanie
        return parsedAmount === null;
    }, [isDirty, text, parsedAmount]);

    const helperText = useMemo(() => {
        if (!canEdit) return 'Edycja zablokowana dla starszych miesięcy.';
        if (errorMessage) return errorMessage;
        if (hasValidationError) return 'Podaj poprawną kwotę (>= 0, max 2 miejsca po przecinku).';
        return `Wydano: ${formatCurrency(spend)}`;
    }, [canEdit, errorMessage, hasValidationError, spend]);

    const handleCommit = useCallback(() => {
        if (!canEdit) return;
        const next = parseAmount(text);
        if (next === null) return;

        // brak zmian
        const current = value ?? null;
        if (current !== null && Math.abs(current - next) < 0.00001) {
            setIsDirty(false);
            return;
        }

        onCommit(next);
    }, [canEdit, onCommit, text, value]);

    const handleBlur = useCallback(() => {
        if (!isDirty) return;
        handleCommit();
    }, [isDirty, handleCommit]);

    return (
        <div className="mt-2">
            <div className="flex items-center gap-2">
                <div className="flex-1">
                    <label htmlFor={inputId} className="sr-only">
                        Budżet dla kategorii {typeId} w miesiącu {monthDate}
                    </label>
                    <Input
                        id={inputId}
                        inputMode="decimal"
                        placeholder={value === null ? 'Ustaw budżet…' : 'Budżet…'}
                        value={text}
                        disabled={!canEdit || isSaving}
                        onChange={(e) => {
                            setText(e.target.value);
                            setIsDirty(true);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCommit();
                            }
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                setText(initialText);
                                setIsDirty(false);
                            }
                        }}
                        onBlur={handleBlur}
                        className={cn(hasValidationError && 'border-red-300 focus-visible:ring-red-400')}
                    />
                </div>

                {!canEdit ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        Readonly
                    </span>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCommit}
                        disabled={isSaving || parsedAmount === null || !isDirty}
                        aria-label="Zapisz budżet"
                    >
                        <Check className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <p
                className={cn('mt-1 text-xs', errorMessage || hasValidationError ? 'text-red-700' : 'text-slate-500')}
                aria-live="polite"
            >
                {helperText}
            </p>
        </div>
    );
};
