import { formatCurrency, formatPercent, getStatusColors } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TotalProgressVM } from '@/types/dashboard';

export interface TotalProgressProps {
    vm: TotalProgressVM;
    className?: string;
}

export const TotalProgress = ({ vm, className }: TotalProgressProps) => {
    const colors = getStatusColors(vm.status);
    const hasNoBudget = vm.budget === 0;

    return (
        <div className={cn('rounded-xl border bg-white p-6 shadow-sm', className)}>
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-medium text-slate-600">Całkowity postęp budżetu</h2>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(vm.spend)}</p>
                    {!hasNoBudget && (
                        <p className="mt-1 text-sm text-slate-500">z {formatCurrency(vm.budget)} zaplanowanych</p>
                    )}
                </div>
                {!hasNoBudget && (
                    <div
                        className={cn(
                            'flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold',
                            colors.bg,
                            colors.text
                        )}
                    >
                        {formatPercent(vm.percent)}
                    </div>
                )}
            </div>

            {!hasNoBudget && (
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                        className={cn('h-full transition-all duration-300', colors.progress)}
                        style={{ width: `${Math.min(vm.percent, 100)}%` }}
                        role="progressbar"
                        aria-valuenow={vm.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Wykorzystano ${formatPercent(vm.percent)} budżetu`}
                    />
                </div>
            )}

            {hasNoBudget && (
                <p className="text-sm text-slate-500">
                    Nie ustawiono budżetów dla tego miesiąca. Dodaj limity, aby śledzić wydatki.
                </p>
            )}

            {vm.status === 'over' && (
                <p className={cn('mt-3 text-sm font-medium', colors.text)}>
                    Przekroczono budżet o {formatCurrency(vm.spend - vm.budget)}
                </p>
            )}
        </div>
    );
};
