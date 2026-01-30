import type { MonthParam, ReadonlyFlags } from '@/types/dashboard';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const startOfMonthUtc = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

export const formatMonth = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
};

export const formatMonthLabel = (date: Date): string => {
    return new Intl.DateTimeFormat('pl-PL', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

export const parseMonthOrNull = (raw?: string): Date | null => {
    if (!raw || !MONTH_REGEX.test(raw)) {
        return null;
    }

    const parsed = startOfMonthUtc(new Date(`${raw}-01T00:00:00.000Z`));
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
};

export const getCurrentMonth = () => startOfMonthUtc(new Date());

export const getPreviousMonth = (date: Date) =>
    startOfMonthUtc(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));

export const isFutureMonth = (date: Date) => date > getCurrentMonth();

const toMonthKey = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();

export const normalizeMonthParam = (raw?: string): MonthParam => {
    const fallback = getCurrentMonth();
    const parsed = parseMonthOrNull(raw);

    if (!parsed || isFutureMonth(parsed)) {
        return { value: formatMonth(fallback), date: fallback };
    }

    return { value: formatMonth(parsed), date: parsed };
};

export const computeReadonlyFlags = (month: MonthParam): ReadonlyFlags => {
    const current = getCurrentMonth();
    const previous = getPreviousMonth(current);

    const monthKey = toMonthKey(month.date);
    const canEdit = monthKey === toMonthKey(current) || monthKey === toMonthKey(previous);

    return {
        isReadonly: !canEdit,
        canEditBudgets: canEdit,
        canEditTransactions: canEdit,
    };
};

export const isSameMonth = (a: MonthParam, b: MonthParam) => toMonthKey(a.date) === toMonthKey(b.date);

/**
 * Returns the current month start in UTC as an ISO date string (YYYY-MM-01).
 * Useful for APIs that use month_date as the first day of the month.
 */
export const getCurrentMonthDateUtc = (): string => {
    const current = getCurrentMonth();
    const year = current.getUTCFullYear();
    const month = `${current.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}-01`;
};
