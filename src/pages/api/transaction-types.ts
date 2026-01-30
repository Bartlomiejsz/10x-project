import { requireUser } from '../../lib/api/auth';
import { jsonError, jsonResponse } from '../../lib/api/http';
import { UnauthorizedError } from '../../lib/errors';
import { TransactionTypeFiltersSchema } from '../../lib/schemas/transaction-types.schema';
import { transactionTypesService } from '../../lib/services/transaction-types.service';
import type { APIRoute } from 'astro';
import { z } from 'zod';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
    try {
        await requireUser({ locals });

        const url = new URL(request.url);
        const queryParams = {
            q: url.searchParams.get('q') || undefined,
            order: url.searchParams.get('order') || 'position.asc',
        };

        const filters = TransactionTypeFiltersSchema.parse(queryParams);
        const result = await transactionTypesService.listTransactionTypes(filters, locals.supabase);

        // Frontend expects an array (see fetchTransactionTypes)
        return jsonResponse(result.data, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid query parameters', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[GET /api/transaction-types] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};
