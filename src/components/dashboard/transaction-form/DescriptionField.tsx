import { FormField } from './FormField';
import type { UseFormRegister } from 'react-hook-form';

import { Input } from '@/components/ui/input';

import type { TransactionFormInput } from '@/lib/schemas/transaction';

export interface DescriptionFieldProps {
    register: UseFormRegister<TransactionFormInput>;
    disabled?: boolean;
}

export function DescriptionField({ register, disabled }: DescriptionFieldProps) {
    return (
        <FormField label="Opis" hint="Ctrl/⌘ + Enter zapisuje.">
            {(id) => (
                <Input
                    id={id}
                    disabled={disabled}
                    placeholder="np. Biedronka"
                    maxLength={200}
                    {...register('description')}
                />
            )}
        </FormField>
    );
}
