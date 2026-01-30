/**
 * Format currency amount in PLN
 * @param amount - Amount in PLN
 * @param decimals - Number of decimal places (default: 2)
 */
export const formatCurrency = (amount: number, decimals = 2): string => {
    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(amount);
};

/**
 * Format percentage with optional decimal places
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 0)
 */
export const formatPercent = (value: number, decimals = 0): string => {
    return `${value.toFixed(decimals)}%`;
};

/**
 * Format month date to human-readable format
 * @param date - Date object
 * @returns Formatted month string (e.g., "Styczeń 2026")
 */
export const formatMonthLabel = (date: Date): string => {
    return new Intl.DateTimeFormat('pl-PL', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

/**
 * Get status color classes based on percentage threshold
 * @param percent - Percentage value (0-100)
 * @returns Status indicator: 'ok' | 'warn' | 'over'
 */
export const getThresholdStatus = (percent: number): 'ok' | 'warn' | 'over' => {
    if (percent < 80) return 'ok';
    if (percent <= 100) return 'warn';
    return 'over';
};

/**
 * Get Tailwind color classes for budget status
 * @param status - Budget status
 * @returns Object with bg, text, and border color classes
 */
export const getStatusColors = (status: 'ok' | 'warn' | 'over') => {
    switch (status) {
        case 'ok':
            return {
                bg: 'bg-green-50',
                text: 'text-green-700',
                border: 'border-green-200',
                progress: 'bg-green-300',
            };
        case 'warn':
            return {
                bg: 'bg-amber-50',
                text: 'text-amber-700',
                border: 'border-amber-200',
                progress: 'bg-amber-500',
            };
        case 'over':
            return {
                bg: 'bg-red-50',
                text: 'text-red-700',
                border: 'border-red-200',
                progress: 'bg-red-500',
            };
    }
};
