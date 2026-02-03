import { FormField } from './FormField';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import type { TransactionFormInput } from '@/lib/schemas/transaction';
import { cn } from '@/lib/utils';

export interface AmountFieldProps {
    register: UseFormRegister<TransactionFormInput>;
    errors: FieldErrors<TransactionFormInput>;
    disabled?: boolean;
}

export function AmountField({ register, errors, disabled }: AmountFieldProps) {
    return (
        <FormField label="Kwota" error={errors.amount?.message}>
            {(id) => (
                <Input
                    id={id}
                    inputMode="decimal"
                    disabled={disabled}
                    placeholder="0,00"
                    className={cn(errors.amount && 'border-red-300 focus-visible:ring-red-400')}
                    {...register('amount')}
                />
            )}
        </FormField>
    );
}
