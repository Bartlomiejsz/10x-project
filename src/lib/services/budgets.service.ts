import type { SupabaseClient } from '../../db/supabase.client';
import type { BudgetDTO, BudgetFilters, CreateBudgetCommand, UpdateBudgetCommand } from '../../types';
import { NotFoundError, ValidationError } from '../errors';
import { getCurrentMonthDateUtc } from '../month';

function assertNever(value: never): never {
    throw new Error(`Unexpected value: ${String(value)}`);
}

export interface UpsertBudgetResult {
    data: BudgetDTO;
    created: boolean;
}

export class BudgetsService {
    private async assertTransactionTypeExists(typeId: number, supabase: SupabaseClient): Promise<void> {
        const { data, error } = await supabase.from('transaction_types').select('id').eq('id', typeId).maybeSingle();

        if (error && error.code !== 'PGRST116') {
            // eslint-disable-next-line no-console
            console.error('[BudgetsService.assertTransactionTypeExists] DB error:', error);
            throw new Error(`Failed to validate transaction type: ${error.message}`);
        }

        if (!data?.id) {
            throw new ValidationError('Unknown transaction type', { type_id: typeId });
        }
    }

    private parseOrder(order?: BudgetFilters['order']): {
        field: 'month_date' | 'type_id' | 'created_at';
        ascending: boolean;
    } {
        const value = (order ?? 'type_id.asc') as string;
        const [field, direction] = value.split('.') as [string, string];

        const ascending = direction === 'asc' ? true : direction === 'desc' ? false : null;
        if (ascending === null) {
            throw new ValidationError('Invalid order direction');
        }

        if (field === 'month_date' || field === 'type_id' || field === 'created_at') {
            return { field, ascending };
        }

        // Should be impossible thanks to Zod enum in route schema.
        assertNever(field as never);
    }

    async listBudgets(filters: BudgetFilters, supabase: SupabaseClient): Promise<{ data: BudgetDTO[] }> {
        // Default month behavior lives here to keep routes thin.
        const month_date = filters.month_date ?? (filters.month ? `${filters.month}-01` : getCurrentMonthDateUtc());

        const { field, ascending } = this.parseOrder(filters.order);

        let query = supabase.from('budgets').select('*').eq('month_date', month_date);

        if (filters.type_id) {
            query = query.eq('type_id', filters.type_id);
        }

        query = query.order(field, { ascending });

        const { data, error } = await query;
        if (error) {
            // eslint-disable-next-line no-console
            console.error('[BudgetsService.listBudgets] DB error:', error);
            throw new Error(`Failed to list budgets: ${error.message}`);
        }

        return { data: (data ?? []) as unknown as BudgetDTO[] };
    }

    async getBudget(key: { month_date: string; type_id: number }, supabase: SupabaseClient): Promise<BudgetDTO> {
        const { data, error } = await supabase
            .from('budgets')
            .select('*')
            .eq('month_date', key.month_date)
            .eq('type_id', key.type_id)
            .single();

        if (error && error.code === 'PGRST116') {
            throw new NotFoundError('Budget not found');
        }

        if (error) {
            // eslint-disable-next-line no-console
            console.error('[BudgetsService.getBudget] DB error:', error);
            throw new Error(`Failed to fetch budget: ${error.message}`);
        }

        if (!data) {
            throw new NotFoundError('Budget not found');
        }

        return data as unknown as BudgetDTO;
    }

    async upsertBudget(cmd: CreateBudgetCommand, supabase: SupabaseClient): Promise<UpsertBudgetResult> {
        await this.assertTransactionTypeExists(cmd.type_id, supabase);

        const { data: existing, error: existingError } = await supabase
            .from('budgets')
            .select('month_date, type_id')
            .eq('month_date', cmd.month_date)
            .eq('type_id', cmd.type_id)
            .maybeSingle();

        if (existingError && existingError.code !== 'PGRST116') {
            // eslint-disable-next-line no-console
            console.error('[BudgetsService.upsertBudget] Precheck DB error:', existingError);
            throw new Error(`Failed to check if budget exists: ${existingError.message}`);
        }

        const created = !existing;

        const { data, error } = await supabase
            .from('budgets')
            .upsert(
                {
                    month_date: cmd.month_date,
                    type_id: cmd.type_id,
                    amount: cmd.amount,
                },
                { onConflict: 'month_date,type_id' }
            )
            .select('*')
            .single();

        if (error) {
            // eslint-disable-next-line no-console
            console.error('[BudgetsService.upsertBudget] DB error:', error);
            throw new Error(`Failed to upsert budget: ${error.message}`);
        }

        return { data: data as unknown as BudgetDTO, created };
    }

    async updateBudget(
        key: { month_date: string; type_id: number },
        cmd: UpdateBudgetCommand,
        supabase: SupabaseClient
    ): Promise<BudgetDTO> {
        await this.assertTransactionTypeExists(key.type_id, supabase);

        const { data, error } = await supabase
            .from('budgets')
            .update({ amount: cmd.amount })
            .eq('month_date', key.month_date)
            .eq('type_id', key.type_id)
            .select('*')
            .single();

        if (error && error.code === 'PGRST116') {
            throw new NotFoundError('Budget not found');
        }

        if (error) {
            // eslint-disable-next-line no-console
            console.error('[BudgetsService.updateBudget] DB error:', error);
            throw new Error(`Failed to update budget: ${error.message}`);
        }

        if (!data) {
            throw new NotFoundError('Budget not found');
        }

        return data as unknown as BudgetDTO;
    }

    async deleteBudget(key: { month_date: string; type_id: number }, supabase: SupabaseClient): Promise<void> {
        const { data, error } = await supabase
            .from('budgets')
            .delete()
            .eq('month_date', key.month_date)
            .eq('type_id', key.type_id)
            .select('month_date, type_id')
            .maybeSingle();

        if (error && error.code === 'PGRST116') {
            throw new NotFoundError('Budget not found');
        }

        if (error) {
            // eslint-disable-next-line no-console
            console.error('[BudgetsService.deleteBudget] DB error:', error);
            throw new Error(`Failed to delete budget: ${error.message}`);
        }

        if (!data) {
            throw new NotFoundError('Budget not found');
        }
    }
}

export const budgetsService = new BudgetsService();
