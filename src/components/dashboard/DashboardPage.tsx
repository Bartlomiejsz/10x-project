import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { useDashboardData } from '../hooks/useDashboardData';
import { useInfiniteTransactions } from '../hooks/useInfiniteTransactions';
import { useMonthOptions } from '../hooks/useMonthOptions';
import { useTransactionDialogData } from '../hooks/useTransactionDialogData';
import { useTransactionMutations } from '../hooks/useTransactionMutations';
import { useTransactionUpsert } from '../hooks/useTransactionUpsert';
import { useDashboardState } from '../providers/dashboard-state-provider';
import { useToasts } from '../providers/toast-provider';
import { BudgetChart } from './BudgetChart';
import { MonthSelector } from './MonthSelector';
import { TotalProgress } from './TotalProgress';
import { TransactionDialog } from './TransactionDialog';
import { TransactionSection } from './TransactionSection';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

const DashboardPage = () => {
    const { month, readonly, setMonth, filters, updateFilters, resetFilters, openDialog, closeDialog, dialog } =
        useDashboardState();
    const monthOptions = useMonthOptions(12);
    const {
        data,
        isLoadingAggregates,
        isLoadingRest,
        errorAggregates,
        errorRest,
        refetchAggregates,
        refetchTransactions,
        setOptimisticBudget,
        rollbackOptimisticBudget,
    } = useDashboardData(month);

    const { pushToast } = useToasts();
    const budgetMutation = useBudgetMutations();
    const txMutations = useTransactionMutations();

    const tx = useInfiniteTransactions({ month, filters, types: data?.types ?? [], pageSize: 30 });
    const txUpsert = useTransactionUpsert();
    const dialogData = useTransactionDialogData({
        open: dialog.isOpen,
        mode: dialog.mode,
        transactionId: dialog.transactionId,
    });

    if (errorAggregates) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-sm font-semibold text-red-900">Błąd ładowania danych</p>
                    <p className="mt-2 text-sm text-red-700">{errorAggregates.message}</p>
                </div>
            </div>
        );
    }

    // Pierwsze ładowanie agregatów jest warunkiem startu widoku.
    if (!data || isLoadingAggregates) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-12 rounded-lg bg-slate-200" />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="h-48 rounded-xl bg-slate-200" />
                        <div className="h-48 rounded-xl bg-slate-200" />
                        <div className="h-48 rounded-xl bg-slate-200" />
                    </div>
                </div>
            </div>
        );
    }

    const monthDate = `${month.value}-01`;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            {/* Header with Month Selector */}
            <header className="sticky top-0 z-10 -mx-4 bg-slate-50 px-4 py-4 sm:-mx-6 sm:px-6">
                <MonthSelector value={month.value} options={monthOptions} onChange={setMonth} />
            </header>

            <TotalProgress vm={data.total} />

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <BudgetChart
                    items={data.chart}
                    className="lg:col-span-4"
                    canEditBudgets={readonly.canEditBudgets}
                    monthDate={monthDate}
                    isSavingBudget={budgetMutation.isSaving}
                    budgetSaveError={budgetMutation.error}
                    onUpdateBudget={({ typeId, nextAmount }) => {
                        const previous = data.budgets.find((b) => b.type_id === typeId) ?? null;

                        void budgetMutation.upsertOptimistic({
                            month_date: monthDate,
                            type_id: typeId,
                            amount: nextAmount,
                            previous,
                            onOptimistic: (next) => setOptimisticBudget(next),
                            onRollback: (prev) => rollbackOptimisticBudget(prev),
                            onSuccess: () => {
                                refetchAggregates();
                            },
                        });
                    }}
                />

                <div className="lg:col-span-8">
                    {errorRest && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <p className="font-semibold">Część danych nie została wczytana</p>
                            <p className="mt-1 text-amber-800">{errorRest.message}</p>
                        </div>
                    )}

                    <TransactionSection
                        month={month.value}
                        readonly={readonly.isReadonly}
                        filters={filters}
                        onChangeFilters={updateFilters}
                        onResetFilters={resetFilters}
                        types={data.types}
                        items={tx.items}
                        hasMore={tx.hasMore}
                        isLoadingMore={tx.isLoadingMore}
                        loadError={tx.error?.message ?? null}
                        onLoadMore={tx.loadMore}
                        onRetry={tx.retry}
                        resultsCount={tx.count}
                        onEdit={(id) => openDialog('edit', id)}
                        onDelete={(id) => {
                            if (readonly.isReadonly) {
                                pushToast({
                                    type: 'info',
                                    message: 'To jest starszy miesiąc',
                                    description: 'Edycja i usuwanie transakcji są zablokowane.',
                                });
                                return;
                            }

                            const ok = window.confirm('Usunąć tę transakcję?');
                            if (!ok) return;

                            void txMutations.deleteById({
                                id,
                                onSuccess: () => {
                                    pushToast({ type: 'success', message: 'Usunięto transakcję' });
                                    refetchTransactions();
                                    refetchAggregates();
                                },
                                onError: (message) => {
                                    pushToast({
                                        type: 'error',
                                        message: 'Nie udało się usunąć transakcji',
                                        description: message,
                                    });
                                },
                            });
                        }}
                    />
                </div>
            </section>

            <TransactionDialog
                open={dialog.isOpen}
                mode={dialog.mode}
                types={data.types}
                transactionId={dialog.transactionId}
                isReadonly={readonly.isReadonly}
                isSaving={txUpsert.isSaving || dialogData.isLoading}
                error={txUpsert.error ?? dialogData.error}
                initial={
                    dialog.mode === 'edit' && dialogData.transaction
                        ? {
                              amount: String(dialogData.transaction.amount),
                              description: dialogData.transaction.description ?? '',
                              date: dialogData.transaction.date,
                              type_id: dialogData.transaction.type_id,
                              is_manual_override: dialogData.transaction.is_manual_override ?? false,
                          }
                        : undefined
                }
                onClose={() => {
                    closeDialog();
                }}
                onSubmit={(payload) => {
                    if (readonly.isReadonly) {
                        pushToast({
                            type: 'info',
                            message: 'To jest starszy miesiąc',
                            description: 'Edycja i dodawanie transakcji są zablokowane.',
                        });
                        return;
                    }

                    if (payload.mode === 'create') {
                        void txUpsert.create({
                            command: {
                                type_id: payload.values.type_id,
                                amount: payload.values.amount,
                                description: payload.values.description,
                                date: payload.values.date,
                                is_manual_override: payload.values.is_manual_override,
                            },
                            onSuccess: () => {
                                pushToast({ type: 'success', message: 'Dodano transakcję' });
                                closeDialog();
                                refetchTransactions();
                                refetchAggregates();
                            },
                        });
                        return;
                    }

                    if (!payload.transactionId) {
                        pushToast({ type: 'error', message: 'Brak identyfikatora transakcji' });
                        return;
                    }

                    void txUpsert.update({
                        id: payload.transactionId,
                        command: {
                            type_id: payload.values.type_id,
                            amount: payload.values.amount,
                            description: payload.values.description,
                            date: payload.values.date,
                            is_manual_override: payload.values.is_manual_override ?? false,
                        },
                        onSuccess: () => {
                            pushToast({ type: 'success', message: 'Zapisano zmiany' });
                            closeDialog();
                            refetchTransactions();
                            refetchAggregates();
                        },
                    });
                }}
            />

            {!readonly.isReadonly && (
                <div className="fixed bottom-5 right-5 z-40">
                    <Button
                        type="button"
                        size="icon"
                        className="h-12 w-12 rounded-full shadow-lg cursor-pointer"
                        onClick={() => openDialog('create')}
                        aria-label="Dodaj transakcję"
                    >
                        <Plus className="h-5 w-5" />
                    </Button>
                </div>
            )}

            {isLoadingRest && (
                <p className="text-center text-xs text-slate-500" aria-live="polite">
                    Doczytywanie danych transakcji…
                </p>
            )}
        </div>
    );
};

export default DashboardPage;
