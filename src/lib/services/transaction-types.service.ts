import type { Database } from '../../db/database.types';
import type { TransactionTypeDTO, TransactionTypeFilters } from '../../types';
import { NotFoundError } from '../errors';
import type { SupabaseClient } from '@supabase/supabase-js';

export class TransactionTypesService {
    async listTransactionTypes(
        filters: TransactionTypeFilters,
        supabase: SupabaseClient<Database>
    ): Promise<{ data: TransactionTypeDTO[]; count: number }> {
        let query = supabase.from('transaction_types').select('id, code, name, position', { count: 'exact' });

        // Filtr wyszukiwania
        if (filters.q) {
            const searchTerm = `%${filters.q}%`;
            query = query.or(`name.ilike.${searchTerm},code.ilike.${searchTerm}`);
        }

        // Sortowanie
        const [field, direction] = (filters.order || 'position.asc').split('.');
        query = query.order(field, { ascending: direction === 'asc' });

        const { data, count, error } = await query;

        if (error) {
            throw new Error(`Failed to fetch transaction types: ${error.message}`);
        }

        return {
            data: data || [],
            count: count || 0,
        };
    }

    /**
     * Get a single transaction type by ID
     * @param id - Transaction type ID
     * @param supabase - Supabase client instance
     * @returns Transaction type DTO
     * @throws NotFoundError if transaction type doesn't exist
     * @throws Error for other database errors
     */
    async getTransactionTypeById(id: number, supabase: SupabaseClient<Database>): Promise<TransactionTypeDTO> {
        const { data, error } = await supabase
            .from('transaction_types')
            .select('id, code, name, position')
            .eq('id', id)
            .single();

        // Obsługa błędu "not found" (PostgREST code PGRST116)
        if (error && error.code === 'PGRST116') {
            throw new NotFoundError('Transaction type not found');
        }

        // Inne błędy bazy danych
        if (error) {
            throw new Error(`Failed to fetch transaction type: ${error.message}`);
        }

        // Dodatkowa ochrona (nie powinno się zdarzyć)
        if (!data) {
            throw new NotFoundError('Transaction type not found');
        }

        return data;
    }
}

export const transactionTypesService = new TransactionTypesService();
