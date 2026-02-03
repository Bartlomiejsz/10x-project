import { useCallback, useMemo, useRef, useState } from 'react';

import { useClickOutside } from '../hooks/useClickOutside';
import { InlineBudgetEditor } from './InlineBudgetEditor';

import { formatCurrency, formatPercent, getStatusColors } from '@/lib/format';
import { mapUserIdToUserName } from '@/lib/mappers/userName.ts';
import { cn } from '@/lib/utils';
import type { ChartItemVM } from '@/types/dashboard';

export interface BudgetChartProps {
    items: ChartItemVM[];
    className?: string;
    canEditBudgets?: boolean;
    monthDate?: string; // YYYY-MM-01
    isSavingBudget?: boolean;
    budgetSaveError?: string | null;
    onUpdateBudget?: (args: { typeId: number; nextAmount: number }) => void;
}

export const BudgetChart = ({
    items,
    className,
    canEditBudgets = false,
    monthDate,
    isSavingBudget,
    budgetSaveError,
    onUpdateBudget,
}: BudgetChartProps) => {
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const maxValue = useMemo(() => {
        return Math.max(...items.map((item) => Math.max(item.spend, item.budget ?? 0)), 1);
    }, [items]);

    const isEditorEnabled = canEditBudgets && Boolean(monthDate) && Boolean(onUpdateBudget);

    const toggleEditor = useCallback((typeId: number) => {
        setEditingTypeId((prev) => (prev === typeId ? null : typeId));
    }, []);

    const closeEditor = useCallback(() => setEditingTypeId(null), []);

    const clickOutsideOptions = useMemo(
        () => ({
            closeOnEscape: true,
            closeOnInsideClickOutsideAllowed: true,
            allowedSelectors: editingTypeId
                ? [`#budget-editor-${editingTypeId}`, `[aria-controls="budget-editor-${editingTypeId}"]`]
                : [],
        }),
        [editingTypeId]
    );

    useClickOutside(containerRef, closeEditor, Boolean(editingTypeId), clickOutsideOptions);

    if (items.length === 0) {
        return (
            <div className={cn('rounded-xl border border-slate-200 bg-white p-6 shadow-sm', className)}>
                <h2 className="mb-4 text-sm font-semibold text-slate-600">Wydatki według kategorii</h2>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-slate-500">Brak danych dla tego miesiąca</p>
                    <p className="mt-2 text-xs text-slate-400">
                        Dodaj transakcje lub ustaw budżety, aby zobaczyć wykres
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={cn('rounded-xl border border-slate-200 bg-white p-6 shadow-sm', className)}>
            <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-600">Wydatki według kategorii</h2>
                    {!canEditBudgets && (
                        <p className="mt-1 text-xs text-slate-500">
                            Budżety są tylko do podglądu dla starszych miesięcy.
                        </p>
                    )}
                    {isEditorEnabled && (
                        <p className="mt-1 text-xs text-slate-500">Kliknij pasek kategorii, aby edytować budżet.</p>
                    )}
                </div>
            </div>

            <div className="space-y-4" role="list">
                {items.map((item) => {
                    const colors = getStatusColors(item.status);
                    const spendWidth = Math.min(item.spend / (item.budget || maxValue), 1) * 100;
                    const isHovered = hoveredId === item.typeId;
                    const isEditing = editingTypeId === item.typeId;

                    return (
                        <div
                            key={item.typeId}
                            className="group relative"
                            onMouseEnter={() => setHoveredId(item.typeId)}
                            onMouseLeave={() => setHoveredId(null)}
                            role="listitem"
                            aria-label={`${item.typeName}: wydano ${formatCurrency(item.spend)}${
                                item.budget ? ` z ${formatCurrency(item.budget)}` : ''
                            }`}
                        >
                            <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-700">{item.typeName}</span>
                                <button
                                    type="button"
                                    className={cn(
                                        'text-xs font-semibold',
                                        colors.text,
                                        isEditorEnabled &&
                                            'underline decoration-dotted underline-offset-2 cursor-pointer'
                                    )}
                                    onClick={() => {
                                        if (!isEditorEnabled) return;
                                        toggleEditor(item.typeId);
                                    }}
                                    aria-expanded={isEditing}
                                    aria-controls={`budget-editor-${item.typeId}`}
                                >
                                    {formatCurrency(item.spend)}
                                    {item.budget ? ` / ${formatCurrency(item.budget)}` : ''}
                                </button>
                            </div>

                            <div className="relative h-8 w-full">
                                {item.budget && (
                                    <div className="absolute inset-y-0 left-0 w-full rounded-md bg-slate-100" />
                                )}

                                <button
                                    type="button"
                                    className={cn(
                                        'absolute inset-y-0 left-0 rounded-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2',
                                        colors.progress,
                                        isHovered && 'opacity-90',
                                        !isEditorEnabled && 'cursor-default'
                                    )}
                                    style={{ width: `${spendWidth}%` }}
                                    onClick={() => {
                                        if (!isEditorEnabled) return;
                                        toggleEditor(item.typeId);
                                    }}
                                    onKeyDown={(e) => {
                                        if (!isEditorEnabled) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleEditor(item.typeId);
                                        }
                                    }}
                                    aria-label={
                                        isEditorEnabled
                                            ? `Edytuj budżet: ${item.typeName}`
                                            : `Budżet tylko do podglądu: ${item.typeName}`
                                    }
                                    aria-expanded={isEditing}
                                    aria-controls={`budget-editor-${item.typeId}`}
                                    disabled={!isEditorEnabled}
                                />

                                {isHovered && (
                                    <div className="absolute -top-16 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                                        <p className="whitespace-nowrap text-xs font-medium text-slate-700">
                                            {item.typeName}
                                        </p>
                                        <p className="mt-1 whitespace-nowrap text-xs text-slate-600">
                                            Wydano: {formatCurrency(item.spend)}
                                        </p>
                                        {item.budget && (
                                            <>
                                                <p className="whitespace-nowrap text-xs text-slate-600">
                                                    Budżet: {formatCurrency(item.budget)}
                                                </p>
                                                <p
                                                    className={cn(
                                                        'whitespace-nowrap text-xs font-semibold',
                                                        colors.text
                                                    )}
                                                >
                                                    {formatPercent(item.percent)}
                                                    {item.overAmount > 0 &&
                                                        ` (nadwyżka: ${formatCurrency(item.overAmount)})`}
                                                </p>
                                            </>
                                        )}

                                        {item.shares && item.shares.length > 0 && (
                                            <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                                                {item.shares.map((s) => (
                                                    <p
                                                        key={s.userId}
                                                        className="whitespace-nowrap text-xs text-slate-600"
                                                    >
                                                        {mapUserIdToUserName(s.userId)}: {formatCurrency(s.amount)}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {monthDate && isEditing && (
                                <div id={`budget-editor-${item.typeId}`}>
                                    <InlineBudgetEditor
                                        value={item.budget}
                                        spend={item.spend}
                                        monthDate={monthDate}
                                        typeId={item.typeId}
                                        canEdit={isEditorEnabled}
                                        isSaving={isSavingBudget}
                                        errorMessage={budgetSaveError}
                                        onCommit={(nextAmount) => {
                                            onUpdateBudget?.({ typeId: item.typeId, nextAmount });
                                            setEditingTypeId(null);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-green-300" />
                    <span>&lt;80%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-amber-500" />
                    <span>80-100%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-red-500" />
                    <span>&gt;100%</span>
                </div>
            </div>
        </div>
    );
};
