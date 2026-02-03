import { ConflictError, NotFoundError } from '../errors';
import { TRANSACTION_SELECTABLE_FIELDS, type TransactionsListQuery } from '../schemas/transactions.schema';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/db/database.types';
import type {
    BatchImportItemResult,
    BatchImportResult,
    CreateTransactionCommand,
    PaginatedResponse,
    TransactionDTO,
} from '@/types';

const DEFAULT_LIMIT = 50;

async function computeImportHash(input: { date: string; amount: number; description: string }): Promise<string> {
    const data = new TextEncoder().encode(`${input.date}|${input.amount}|${input.description}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseFields(fields?: string): string | undefined {
    if (!fields) return undefined;

    const parts = fields
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

    if (parts.length === 0) return undefined;

    // Runtime hardening (schema already whitelists)
    const unknown = parts.filter((p) => !(TRANSACTION_SELECTABLE_FIELDS as readonly string[]).includes(p));
    if (unknown.length > 0) {
        // Throwing generic Error here is fine – route handler will map to 400 via Zod.
        // This is just a defense-in-depth guard when service is reused elsewhere.
        throw new Error(`Unknown fields: ${unknown.join(', ')}`);
    }

    return parts.join(',');
}

function base64UrlDecode(str: string): string {
    // Convert base64url to standard base64
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(padded);
}

function base64UrlEncode(str: string): string {
    // Convert standard base64 to base64url
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor: string): { date: string; id: string } {
    // Cursor is opaque base64url(json)
    const raw = base64UrlDecode(cursor);
    const parsed = JSON.parse(raw) as { date?: unknown; id?: unknown };

    if (typeof parsed.date !== 'string' || typeof parsed.id !== 'string') {
        throw new Error('Invalid cursor');
    }

    return { date: parsed.date, id: parsed.id };
}

function encodeCursor(row: Pick<TransactionDTO, 'date' | 'id'>): string {
    const json = JSON.stringify({ date: row.date, id: row.id });
    return base64UrlEncode(json);
}

export class TransactionsService {
    async listTransactions(
        filters: TransactionsListQuery,
        supabase: SupabaseClient<Database>
    ): Promise<PaginatedResponse<TransactionDTO>> {
        const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, 1000);

        // projection
        const select = parseFields(filters.fields) ?? '*';

        let query = supabase.from('transactions').select(select, { count: 'exact' });

        // filters - month range is always present (derived from month parameter)
        query = query.gte('date', filters.start_date).lte('date', filters.end_date);
        if (filters.type_id) query = query.eq('type_id', filters.type_id);
        if (filters.min_amount !== undefined) query = query.gte('amount', filters.min_amount);
        if (filters.max_amount !== undefined) query = query.lte('amount', filters.max_amount);
        if (filters.is_manual_override !== undefined) {
            query = query.eq('is_manual_override', filters.is_manual_override);
        }
        if (filters.import_hash) query = query.eq('import_hash', filters.import_hash);
        if (filters.q) query = query.ilike('description', `%${filters.q}%`);

        const [field, direction] = (filters.order || 'date.desc').split('.') as ['date', 'asc' | 'desc'];
        const ascending = direction === 'asc';

        // Prefer cursor pagination when cursor is provided; we implement a stable cursor using (date, id).
        // Note: PostgREST cursor pagination is limited; here we do a best-effort approach using filtering.
        if (filters.cursor) {
            const { date, id } = decodeCursor(filters.cursor);

            // Sort by date then id for stability
            query = query.order('date', { ascending }).order('id', { ascending });

            // Apply cursor boundary
            // For descending: fetch records strictly "before" (date,id)
            // For ascending: fetch records strictly "after" (date,id)
            const op = ascending ? 'gt' : 'lt';
            query = query.or(`date.${op}.${date},and(date.eq.${date},id.${op}.${id})`);

            query = query.limit(limit);

            const { data, error, count } = await query;
            if (error) {
                // eslint-disable-next-line no-console
                console.error('[TransactionsService.listTransactions] Database error:', error);
                throw new Error(`Failed to list transactions: ${error.message}`);
            }

            const rows = (data ?? []) as unknown as TransactionDTO[];
            const last = rows.at(-1);

            return {
                data: rows,
                count: count ?? undefined,
                next_cursor: rows.length === limit && last ? encodeCursor({ id: last.id, date: last.date }) : null,
            };
        }

        // Offset fallback
        const page = filters.page ?? 1;
        const pageSize = Math.min(filters.pageSize ?? limit, 1000);
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        query = query.order(field, { ascending }).order('id', { ascending }).range(from, to);

        const { data, error, count } = await query;

        if (error) {
            // eslint-disable-next-line no-console
            console.error('[TransactionsService.listTransactions] Database error:', error);
            throw new Error(`Failed to list transactions: ${error.message}`);
        }

        const rows = (data ?? []) as unknown as TransactionDTO[];
        const last = rows.at(-1);

        return {
            data: rows,
            count: count ?? undefined,
            next_cursor: rows.length === pageSize && last ? encodeCursor({ id: last.id, date: last.date }) : null,
        };
    }

    async getTransactionById(id: string, supabase: SupabaseClient<Database>): Promise<TransactionDTO> {
        const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();

        if (error && error.code === 'PGRST116') {
            throw new NotFoundError('Transaction not found');
        }

        if (error) {
            // eslint-disable-next-line no-console
            console.error('[TransactionsService.getTransactionById] Database error:', error);
            throw new Error(`Failed to fetch transaction: ${error.message}`);
        }

        if (!data) {
            throw new NotFoundError('Transaction not found');
        }

        return data as unknown as TransactionDTO;
    }

    async createTransaction(
        cmd: CreateTransactionCommand,
        supabase: SupabaseClient<Database>,
        userId: string
    ): Promise<TransactionDTO> {
        const importHash =
            cmd.import_hash ??
            (await computeImportHash({
                date: cmd.date,
                amount: cmd.amount,
                description: cmd.description,
            }));

        // Dedup only if we have an import hash to compare
        if (importHash) {
            const { data: existing, error: existingError } = await supabase
                .from('transactions')
                .select('id')
                .eq('import_hash', importHash)
                .maybeSingle();

            if (existingError && existingError.code !== 'PGRST116') {
                // eslint-disable-next-line no-console
                console.error('[TransactionsService.createTransaction] Dedup check error:', existingError);
                throw new Error(`Failed to check transaction duplication: ${existingError.message}`);
            }

            if (existing?.id) {
                throw new ConflictError('Transaction with the same import_hash already exists');
            }
        }

        const { data, error } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type_id: cmd.type_id,
                amount: cmd.amount,
                description: cmd.description,
                date: cmd.date,
                import_hash: importHash,
                is_manual_override: cmd.is_manual_override ?? false,
            })
            .select('*')
            .single();

        if (error) {
            // eslint-disable-next-line no-console
            console.error('[TransactionsService.createTransaction] Database error:', error);
            throw new Error(`Failed to create transaction: ${error.message}`);
        }

        return data as unknown as TransactionDTO;
    }

    async createTransactionsBatch(
        cmd: { transactions: CreateTransactionCommand[] },
        supabase: SupabaseClient<Database>,
        userId: string
    ): Promise<BatchImportResult> {
        // Placeholder implementation until RPC lands.
        // Processes sequentially; route handler should still return 207.
        const results: BatchImportItemResult[] = [];

        for (const item of cmd.transactions) {
            try {
                const created = await this.createTransaction(item, supabase, userId);
                results.push({ status: 'created', data: created });
            } catch (e) {
                if (e instanceof ConflictError) {
                    const import_hash =
                        item.import_hash ??
                        (await computeImportHash({
                            date: item.date,
                            amount: item.amount,
                            description: item.description,
                        }));
                    results.push({ status: 'skipped', reason: 'duplicate', import_hash });
                    continue;
                }

                const message = e instanceof Error ? e.message : 'Unknown error';
                results.push({ status: 'error', error: message });
            }
        }

        const summary = results.reduce(
            (acc, r) => {
                if (r.status === 'created') acc.created += 1;
                if (r.status === 'skipped') acc.skipped += 1;
                if (r.status === 'error') acc.errors += 1;
                return acc;
            },
            { created: 0, skipped: 0, errors: 0 }
        );

        return { results, summary };
    }
}

export const transactionsService = new TransactionsService();
