import { AlertCircle } from 'lucide-react';

import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TotalProgressVM } from '@/types/dashboard';

export interface OverLimitBannerProps {
    total: TotalProgressVM;
    className?: string;
}

export const OverLimitBanner = ({ total, className }: OverLimitBannerProps) => {
    if (total.status !== 'over') {
        return null;
    }

    const overAmount = total.spend - total.budget;

    return (
        <div
            className={cn(
                'flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800',
                className
            )}
            role="alert"
            aria-live="polite"
        >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
                <h3 className="font-semibold text-red-900">Przekroczono budżet</h3>
                <p className="mt-1 text-sm">
                    Wydatki w tym miesiącu przekroczyły zaplanowany budżet o {formatCurrency(overAmount)}.
                </p>
            </div>
        </div>
    );
};
