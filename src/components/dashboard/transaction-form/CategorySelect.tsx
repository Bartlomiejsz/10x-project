import { FormField } from './FormField';
import type { FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { TransactionFormInput } from '@/lib/schemas/transaction';
import { cn } from '@/lib/utils';
import type { TransactionTypeDTO } from '@/types';

export interface CategorySelectProps {
    types: TransactionTypeDTO[];
    watch: UseFormWatch<TransactionFormInput>;
    setValue: UseFormSetValue<TransactionFormInput>;
    errors: FieldErrors<TransactionFormInput>;
    disabled?: boolean;
}

export function CategorySelect({ types, watch, setValue, errors, disabled }: CategorySelectProps) {
    const typeIdValue = watch('type_id');

    return (
        <FormField label="Kategoria" error={errors.type_id?.message}>
            {(id) => (
                <Select
                    value={String(typeIdValue || '')}
                    onValueChange={(v) => setValue('type_id', Number(v), { shouldValidate: true })}
                    disabled={disabled}
                >
                    <SelectTrigger
                        id={id}
                        className={cn('mt-1', 'w-full', errors.type_id && 'border-red-300 focus-visible:ring-red-400')}
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
            )}
        </FormField>
    );
}
