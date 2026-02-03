import { useEffect, useMemo } from 'react';

import { AmountField } from './AmountField';
import { CategorySelect } from './CategorySelect';
import { DateField } from './DateField';
import { DescriptionField } from './DescriptionField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useKeyboardShortcut } from '@/components/hooks/useKeyboardShortcut';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

import { type TransactionFormInput, parseAmount, transactionFormSchema } from '@/lib/schemas/transaction';
import type { TransactionTypeDTO } from '@/types';
import type { TransactionDialogMode, TransactionFormValues } from '@/types/dashboard';

export interface TransactionFormSubmitValues {
    amount: number;
    description: string;
    date: string;
    type_id: number;
    is_manual_override?: boolean;
}

export interface TransactionFormProps {
    mode: TransactionDialogMode;
    types: TransactionTypeDTO[];
    transactionId?: string;
    initial?: Partial<TransactionFormValues>;
    isReadonly?: boolean;
    isSaving?: boolean;
    error?: string | null;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (values: TransactionFormSubmitValues) => void;
}

const toIsoDate = (value: Date) => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export function TransactionForm({
    mode,
    types,
    initial,
    isReadonly,
    isSaving,
    error,
    isOpen,
    onClose,
    onSubmit,
}: TransactionFormProps) {
    const today = useMemo(() => toIsoDate(new Date()), []);

    const defaultValues = useMemo<TransactionFormInput>(
        () => ({
            amount: initial?.amount ?? '',
            description: initial?.description ?? '',
            date: initial?.date ?? today,
            type_id: initial?.type_id ?? types[0]?.id ?? 0,
            is_manual_override: initial?.is_manual_override ?? false,
        }),
        [initial, today, types]
    );

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<TransactionFormInput>({
        resolver: zodResolver(transactionFormSchema),
        defaultValues,
    });

    // Reset form when dialog opens with new values
    useEffect(() => {
        if (isOpen) {
            reset(defaultValues);
        }
    }, [isOpen, defaultValues, reset]);

    const isDisabled = Boolean(isReadonly) || Boolean(isSaving);

    const onFormSubmit = handleSubmit((data) => {
        if (isReadonly) return;

        const amount = parseAmount(data.amount);
        if (amount === null) return; // Should never happen due to zod validation

        onSubmit({
            amount,
            description: data.description.trim(),
            date: data.date,
            type_id: data.type_id,
            is_manual_override: data.is_manual_override,
        });
    });

    // Handle Ctrl/Cmd + Enter shortcut
    useKeyboardShortcut({ key: 'Enter', ctrlKey: true, metaKey: true }, onFormSubmit, { enabled: isOpen });

    return (
        <form onSubmit={onFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AmountField register={register} errors={errors} disabled={isDisabled} />
                <DateField register={register} errors={errors} disabled={isDisabled} />
            </div>

            <CategorySelect types={types} watch={watch} setValue={setValue} errors={errors} disabled={isDisabled} />

            <DescriptionField register={register} disabled={isDisabled} />

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>
            )}

            {isReadonly && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Ten miesiąc jest tylko do podglądu.
                </div>
            )}

            <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                    Anuluj
                </Button>
                <Button type="submit" disabled={isDisabled}>
                    {isSaving ? 'Zapisywanie…' : mode === 'create' ? 'Dodaj' : 'Zapisz'}
                </Button>
            </DialogFooter>
        </form>
    );
}
