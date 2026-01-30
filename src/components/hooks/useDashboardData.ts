import { useCallback, useEffect, useState } from 'react';

import {
    fetchBudgetsByMonth,
    fetchMonthlyReport,
    fetchTransactionTypes,
    fetchTransactions,
} from '@/lib/fetchers/dashboard';
import { getThresholdStatus } from '@/lib/format';
import type { BudgetDTO, MonthlyReportDTO, TransactionTypeDTO } from '@/types';
import type {
    ChartItemVM,
    DashboardDataVM,
    MonthParam,
    TotalProgressVM,
    TransactionListItemVM,
} from '@/types/dashboard';

interface UseDashboardDataResult {
    data: (DashboardDataVM & { types: TransactionTypeDTO[]; budgets: BudgetDTO[] }) | null;
    isLoading: boolean;
    isLoadingAggregates: boolean;
    isLoadingRest: boolean;
    error: Error | null;
    errorAggregates: Error | null;
    errorRest: Error | null;
    refetch: () => void;
    refetchAggregates: () => void;
    refetchTransactions: () => void;
    setOptimisticBudget: (budget: BudgetDTO) => void;
    rollbackOptimisticBudget: (budget: BudgetDTO | null | undefined) => void;
}

const mapReportToChartItems = (report: MonthlyReportDTO, budgetByType: Map<number, number | null>): ChartItemVM[] => {
    return report.summary.map((item) => {
        const budget = budgetByType.get(item.type_id) ?? item.budget ?? null;
        const visibleBudget = budget ?? 0;

        const percent = visibleBudget > 0 ? (item.spend / visibleBudget) * 100 : 0;
        const status = visibleBudget > 0 ? getThresholdStatus(percent) : 'ok';
        const overAmount = Math.max(0, item.spend - visibleBudget);

        const shares = (item.shares ?? [])
            .map((s) => ({ userId: s.user_id, amount: s.spend }))
            .filter((s) => s.amount > 0)
            .sort((a, b) => b.amount - a.amount);

        return {
            typeId: item.type_id,
            typeName: item.type_name,
            budget,
            spend: item.spend,
            percent,
            status,
            overAmount,
            shares,
        };
    });
};

const mapReportToTotal = (report: MonthlyReportDTO): TotalProgressVM => {
    const { budget, spend } = report.totals;
    const percent = budget > 0 ? (spend / budget) * 100 : 0;
    const status = budget > 0 ? getThresholdStatus(percent) : 'ok';

    return {
        budget,
        spend,
        percent,
        status,
    };
};

const mapTransactionToVM = (
    transaction: {
        id: string;
        type_id: number;
        amount: number;
        description: string;
        date: string;
        ai_status: 'success' | 'fallback' | 'error' | null;
        ai_confidence: number | null;
        is_manual_override: boolean;
    },
    types: TransactionTypeDTO[]
): TransactionListItemVM => {
    const type = types.find((t) => t.id === transaction.type_id);

    return {
        id: transaction.id,
        type: type ?? { id: transaction.type_id, code: 'unknown', name: 'Nieznana kategoria', position: 0 },
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
        ai: {
            status: transaction.ai_status ?? 'error',
            confidence: transaction.ai_confidence,
            level:
                transaction.ai_confidence === null
                    ? 'low'
                    : transaction.ai_confidence >= 0.8
                      ? 'high'
                      : transaction.ai_confidence >= 0.5
                        ? 'medium'
                        : 'low',
        },
        isManual: transaction.is_manual_override,
    };
};

export const useDashboardData = (month: MonthParam): UseDashboardDataResult => {
    const [data, setData] = useState<(DashboardDataVM & { types: TransactionTypeDTO[]; budgets: BudgetDTO[] }) | null>(
        null
    );

    const [isLoadingAggregates, setIsLoadingAggregates] = useState(true);
    const [isLoadingRest, setIsLoadingRest] = useState(true);

    const [errorAggregates, setErrorAggregates] = useState<Error | null>(null);
    const [errorRest, setErrorRest] = useState<Error | null>(null);

    const [refetchTrigger, setRefetchTrigger] = useState(0);
    const [aggregatesTrigger, setAggregatesTrigger] = useState(0);

    const isLoading = isLoadingAggregates || isLoadingRest;
    const error = errorAggregates ?? errorRest;

    const refetch = useCallback(() => {
        setRefetchTrigger((prev) => prev + 1);
        setAggregatesTrigger((prev) => prev + 1);
    }, []);

    const refetchAggregates = useCallback(() => {
        setAggregatesTrigger((prev) => prev + 1);
    }, []);

    const refetchTransactions = useCallback(() => {
        setRefetchTrigger((prev) => prev + 1);
    }, []);

    const setOptimisticBudget = useCallback((budget: BudgetDTO) => {
        setData((prev) => {
            if (!prev) return prev;

            const nextBudgets = [...prev.budgets.filter((b) => b.type_id !== budget.type_id), budget];
            const budgetByType = new Map<number, number | null>();
            nextBudgets.forEach((b) => budgetByType.set(b.type_id, b.amount));

            const syntheticReport: MonthlyReportDTO = {
                month: prev.month.value,
                summary: prev.chart.map((c) => ({
                    type_id: c.typeId,
                    type_name: c.typeName,
                    budget: c.budget,
                    spend: c.spend,
                    transactions_count: 0,
                    shares: [],
                })),
                totals: {
                    budget: prev.total.budget,
                    spend: prev.total.spend,
                },
            };

            return {
                ...prev,
                budgets: nextBudgets,
                chart: mapReportToChartItems(syntheticReport, budgetByType),
            };
        });
    }, []);

    const rollbackOptimisticBudget = useCallback((budget: BudgetDTO | null | undefined) => {
        setData((prev) => {
            if (!prev) return prev;
            if (!budget) return prev;

            const nextBudgets = [...prev.budgets.filter((b) => b.type_id !== budget.type_id), budget];
            return { ...prev, budgets: nextBudgets };
        });
    }, []);

    // 1) Agregaty (report + budgets)
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const loadAggregates = async () => {
            setIsLoadingAggregates(true);
            setErrorAggregates(null);

            try {
                const [report, budgets] = await Promise.all([
                    fetchMonthlyReport(month.value, controller.signal),
                    fetchBudgetsByMonth(month.value, controller.signal),
                ]);

                if (cancelled) return;

                const budgetByType = new Map<number, number | null>();
                budgets.forEach((b) => budgetByType.set(b.type_id, b.amount));

                const chart = mapReportToChartItems(report, budgetByType);
                const total = mapReportToTotal(report);

                setData((prev) => {
                    if (!prev) {
                        return {
                            chart,
                            total,
                            transactions: { data: [], next_cursor: null },
                            month,
                            readonly: {
                                isReadonly: false,
                                canEditBudgets: true,
                                canEditTransactions: true,
                            },
                            types: [],
                            budgets,
                        };
                    }

                    return {
                        ...prev,
                        chart,
                        total,
                        month,
                        budgets,
                    };
                });
            } catch (err) {
                if (cancelled) return;
                setErrorAggregates(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                if (!cancelled) {
                    setIsLoadingAggregates(false);
                }
            }
        };

        loadAggregates();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [month, aggregatesTrigger]);

    // 2) Reszta danych widoku (types + transactions)
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const loadRest = async () => {
            setIsLoadingRest(true);
            setErrorRest(null);

            try {
                const [types, transactionsResponse] = await Promise.all([
                    fetchTransactionTypes(undefined, controller.signal),
                    fetchTransactions(month.value, { limit: 30, order: 'date.desc' }, controller.signal),
                ]);

                if (cancelled) return;

                const transactions = {
                    data: transactionsResponse.data.map((t) => mapTransactionToVM(t, types)),
                    next_cursor: transactionsResponse.next_cursor ?? null,
                    count: transactionsResponse.count ?? undefined,
                };

                setData((prev) => {
                    if (!prev) {
                        return {
                            chart: [],
                            total: {
                                budget: 0,
                                spend: 0,
                                percent: 0,
                                status: 'ok',
                            },
                            transactions,
                            month,
                            readonly: {
                                isReadonly: false,
                                canEditBudgets: true,
                                canEditTransactions: true,
                            },
                            types,
                            budgets: [],
                        };
                    }

                    return {
                        ...prev,
                        types,
                        transactions,
                    };
                });
            } catch (err) {
                if (cancelled) return;
                setErrorRest(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                if (!cancelled) {
                    setIsLoadingRest(false);
                }
            }
        };

        loadRest();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [month, refetchTrigger]);

    return {
        data,
        isLoading,
        isLoadingAggregates,
        isLoadingRest,
        error,
        errorAggregates,
        errorRest,
        refetch,
        refetchAggregates,
        refetchTransactions,
        setOptimisticBudget,
        rollbackOptimisticBudget,
    };
};
