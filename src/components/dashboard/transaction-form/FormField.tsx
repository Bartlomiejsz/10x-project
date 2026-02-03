import { type ReactNode, useId } from 'react';

import { cn } from '@/lib/utils';

export interface FormFieldProps {
    label: string;
    error?: string;
    hint?: string;
    className?: string;
    children: (id: string) => ReactNode;
}

/**
 * Generic form field wrapper that handles:
 * - Accessible ID generation via useId()
 * - Label rendering
 * - Error message display
 * - Optional hint text
 */
export function FormField({ label, error, hint, className, children }: FormFieldProps) {
    const id = useId();

    return (
        <div className={className}>
            <label htmlFor={id} className="text-xs font-medium text-slate-600">
                {label}
            </label>
            {children(id)}
            {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
            {hint && !error && <p className={cn('mt-1 text-xs text-slate-500')}>{hint}</p>}
        </div>
    );
}
