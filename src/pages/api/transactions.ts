import type { APIRoute } from 'astro';
import { z } from 'zod';

import { requireUser } from '@/lib/api/auth.ts';
import { jsonError, jsonResponse } from '@/lib/api/http.ts';
import { ConflictError, UnauthorizedError } from '@/lib/errors.ts';
import {
    CreateTransactionSchema,
    CreateTransactionsBatchSchema,
    TransactionsListQuerySchema,
} from '@/lib/schemas/transactions.schema.ts';
import { transactionsService } from '@/lib/services/transactions.service.ts';

export const prerender = false;

/**
 * GET /api/transactions
 * List transactions for the authenticated user.
 */
export const GET: APIRoute = async ({ request, locals }) => {
    try {
        await requireUser({ locals });

        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const filters = TransactionsListQuerySchema.parse(queryParams);

        const result = await transactionsService.listTransactions(filters, locals.supabase);
        return jsonResponse(result, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid query parameters', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[GET /api/transactions] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};

/**
 * POST /api/transactions
 * Create a single transaction OR import a batch of transactions.
 *
 * - Single: { type_id, amount, description, date, ... }
 * - Batch:  { transactions: [...] }
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const user = await requireUser({ locals });

        const body = await request.json().catch(() => null);
        if (!body) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid JSON body');
        }

        if ('transactions' in body) {
            const command = CreateTransactionsBatchSchema.parse(body);
            const result = await transactionsService.createTransactionsBatch(command, locals.supabase, user.id);
            return jsonResponse(result, 207);
        }

        const command = CreateTransactionSchema.parse(body);
        const created = await transactionsService.createTransaction(command, locals.supabase, user.id);
        return jsonResponse(created, 201);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof ConflictError) {
            return jsonError(409, 'CONFLICT', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request body', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[POST /api/transactions] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};
