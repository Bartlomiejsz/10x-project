import { FormField } from './FormField';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import type { TransactionFormInput } from '@/lib/schemas/transaction';
import { cn } from '@/lib/utils';

export interface DateFieldProps {
    register: UseFormRegister<TransactionFormInput>;
    errors: FieldErrors<TransactionFormInput>;
    disabled?: boolean;
}

export function DateField({ register, errors, disabled }: DateFieldProps) {
    return (
        <FormField label="Data" error={errors.date?.message}>
            {(id) => (
                <Input
                    id={id}
                    type="date"
                    disabled={disabled}
                    className={cn(errors.date && 'border-red-300 focus-visible:ring-red-400')}
                    {...register('date')}
                />
            )}
        </FormField>
    );
}
