import { getThresholdStatus } from '@/lib/format';
import type { BudgetDTO, MonthlyReportDTO, TransactionTypeDTO } from '@/types';
import type { ChartItemVM, TotalProgressVM, TransactionListItemVM } from '@/types/dashboard';

/**
 * Maps monthly report data to chart view model items
 * Calculates percentages, status thresholds, and over-budget amounts
 */
export const mapReportToChartItems = (
    report: MonthlyReportDTO,
    budgetByType: Map<number, number | null>
): ChartItemVM[] => {
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

/**
 * Maps monthly report totals to progress view model
 * Calculates overall budget progress percentage and status
 */
export const mapReportToTotal = (report: MonthlyReportDTO): TotalProgressVM => {
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

/**
 * Transaction input shape for mapping
 */
export interface TransactionInput {
    id: string;
    type_id: number;
    amount: number;
    description: string;
    date: string;
    ai_status: 'success' | 'fallback' | 'error' | null;
    ai_confidence: number | null;
    is_manual_override: boolean;
}

/**
 * Maps raw transaction data to list item view model
 * Determines AI confidence level based on thresholds
 */
export const mapTransactionToVM = (
    transaction: TransactionInput,
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

/**
 * Creates a budget lookup map from budget array
 */
export const createBudgetMap = (budgets: BudgetDTO[]): Map<number, number | null> => {
    const map = new Map<number, number | null>();
    budgets.forEach((b) => map.set(b.type_id, b.amount));
    return map;
};
