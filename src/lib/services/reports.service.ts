import type { SupabaseClient } from '../../db/supabase.client';
import type { MonthlyReportDTO, MonthlyReportItemDTO, MonthlyReportShareDTO } from '../../types';

const DEFAULT_BUDGET_AMOUNT_MAPPING: Record<string, number> = {
    GROCERY: 1000,
    HOME: 500,
    HEALTH_BEAUTY: 300,
    CAR: 800,
    FASHION: 200,
    ENTERTAINMENT: 500,
    BILLS: 1000,
    FIXED: 1000,
    UNPLANNED: 200,
    INVEST: 1000,
    OTHER: 500,
    default: 1000,
};

function toFiniteNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

function addOneMonthStart(month: string): string {
    // month is validated as YYYY-MM at the route level
    const [y, m] = month.split('-').map((n) => Number.parseInt(n, 10));
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() + 1);

    const nextYear = d.getUTCFullYear();
    const nextMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${nextYear}-${nextMonth}-01`;
}

export class ReportsService {
    /**
     * Build a monthly report grouped per transaction type.
     *
     * Plan B:
     * - Include all categories (transaction_types), even when there are no transactions.
     * - Include categories without an explicit budget row and return a default budget amount (1000).
     * - Do NOT filter transactions by user_id; report covers the whole household.
     */
    async getMonthlyReport(month: string, supabase: SupabaseClient): Promise<MonthlyReportDTO> {
        if (!month) throw new Error('month is required');

        const monthStart = `${month}-01`;
        const nextMonthStart = addOneMonthStart(month);

        const [{ data: types, error: typesError }, { data: budgets, error: budgetsError }] = await Promise.all([
            supabase
                .from('transaction_types')
                .select('id, code, name, position')
                .order('position', { ascending: true }),
            supabase.from('budgets').select('type_id, amount').eq('month_date', monthStart),
        ]);

        if (typesError) {
            // eslint-disable-next-line no-console
            console.error('[ReportsService.getMonthlyReport] Transaction types query error:', typesError);
            throw new Error(`Failed to build report: ${typesError.message}`);
        }

        if (budgetsError) {
            // eslint-disable-next-line no-console
            console.error('[ReportsService.getMonthlyReport] Budgets query error:', budgetsError);
            throw new Error(`Failed to build report: ${budgetsError.message}`);
        }

        const budgetByTypeId = new Map<number, number | null>(
            (budgets ?? []).map((b) => [b.type_id, b.amount || null])
        );

        // Aggregate transactions for the month (ALL users)
        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('type_id, amount')
            .gte('date', monthStart)
            .lt('date', nextMonthStart);

        if (txError) {
            // eslint-disable-next-line no-console
            console.error('[ReportsService.getMonthlyReport] Transactions query error:', txError);
            throw new Error(`Failed to build report: ${txError.message}`);
        }

        const statsByTypeId = new Map<number, { spend: number; count: number }>();
        for (const tx of transactions ?? []) {
            const current = statsByTypeId.get(tx.type_id) ?? { spend: 0, count: 0 };
            current.spend += toFiniteNumber(tx.amount, 0);
            current.count += 1;
            statsByTypeId.set(tx.type_id, current);
        }

        // Aggregate shares for the month (ALL users)
        const { data: shareTransactions, error: sharesError } = await supabase
            .from('transactions')
            .select('type_id, user_id, amount')
            .gte('date', monthStart)
            .lt('date', nextMonthStart);

        if (sharesError) {
            // eslint-disable-next-line no-console
            console.error('[ReportsService.getMonthlyReport] Shares transactions query error:', sharesError);
            throw new Error(`Failed to build report: ${sharesError.message}`);
        }

        const statsByTypeUserKey = new Map<
            string,
            { type_id: number; user_id: string; spend: number; count: number }
        >();
        for (const tx of shareTransactions ?? []) {
            if (!tx.user_id) continue;
            const key = `${tx.type_id}:${tx.user_id}`;
            const current = statsByTypeUserKey.get(key) ?? {
                type_id: tx.type_id,
                user_id: tx.user_id,
                spend: 0,
                count: 0,
            };
            current.spend += toFiniteNumber(tx.amount, 0);
            current.count += 1;
            statsByTypeUserKey.set(key, current);
        }

        const sharesByTypeId = new Map<number, MonthlyReportShareDTO[]>();
        for (const row of statsByTypeUserKey.values()) {
            const list = sharesByTypeId.get(row.type_id) ?? [];
            list.push({
                user_id: row.user_id,
                spend: row.spend,
                transactions_count: row.count,
            });
            sharesByTypeId.set(row.type_id, list);
        }

        const summary: MonthlyReportItemDTO[] = (types ?? []).map((t) => {
            const stats = statsByTypeId.get(t.id);
            const spend = stats?.spend ?? 0;
            const transactions_count = stats?.count ?? 0;

            const explicitBudget = budgetByTypeId.get(t.id) ?? null;
            const defaultBudget = DEFAULT_BUDGET_AMOUNT_MAPPING[t.code] ?? 1000;
            const budget = explicitBudget ?? defaultBudget;

            return {
                type_id: t.id,
                type_name: t.name,
                budget,
                spend,
                transactions_count,
                shares: sharesByTypeId.get(t.id) ?? [],
            };
        });

        const totals = summary.reduce(
            (acc, item) => {
                acc.spend += item.spend;
                acc.budget += item.budget ?? 0;
                return acc;
            },
            { budget: 0, spend: 0 }
        );

        return { month, summary, totals };
    }
}

export const reportsService = new ReportsService();
