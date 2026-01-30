import { useMemo } from 'react';

import { computeReadonlyFlags, formatMonth, formatMonthLabel, getCurrentMonth } from '@/lib/month';
import type { MonthOption, MonthParam } from '@/types/dashboard';

/**
 * Generate list of month options for the selector
 * @param count - Number of months to generate (default: 12)
 * @returns Array of month options with readonly flags
 */
export const useMonthOptions = (count = 12): MonthOption[] => {
    return useMemo(() => {
        const current = getCurrentMonth();
        const options: MonthOption[] = [];

        for (let i = 0; i < count; i++) {
            const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - i, 1));
            const value = formatMonth(date);
            const monthParam: MonthParam = { value, date };
            const readonly = computeReadonlyFlags(monthParam);

            options.push({
                value,
                label: formatMonthLabel(date),
                isReadonly: readonly.isReadonly,
            });
        }

        return options;
    }, [count]);
};

/**
 * Find current month option from list
 */
export const findCurrentOption = (options: MonthOption[], current: MonthParam): MonthOption | undefined => {
    return options.find((opt) => opt.value === current.value);
};
