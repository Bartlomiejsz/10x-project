import { useCallback, useEffect, useState } from 'react';

import {
    fetchBudgetsByMonth,
    fetchMonthlyReport,
    fetchTransactionTypes,
    fetchTransactions,
} from '@/lib/fetchers/dashboard';
import { createBudgetMap, mapReportToChartItems, mapReportToTotal, mapTransactionToVM } from '@/lib/mappers/dashboard';
import type { BudgetDTO, MonthlyReportDTO, TransactionTypeDTO } from '@/types';
import type { DashboardDataVM, MonthParam } from '@/types/dashboard';

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
            const budgetByType = createBudgetMap(nextBudgets);

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

                const budgetByType = createBudgetMap(budgets);
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
