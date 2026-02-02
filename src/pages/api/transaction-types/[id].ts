import type { APIRoute } from 'astro';
import { z } from 'zod';

import { requireUser } from '@/lib/api/auth';
import { jsonError, jsonResponse } from '@/lib/api/http';
import { parseParam } from '@/lib/api/params';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';
import { TransactionTypeIdSchema } from '@/lib/schemas/transaction-types.schema';
import { transactionTypesService } from '@/lib/services/transaction-types.service';
import type { TransactionTypeDTO } from '@/types';

export const prerender = false;

/**
 * GET /api/transaction-types/:id
 * Retrieve a single transaction type by ID
 */
export const GET: APIRoute = async ({ params, locals }) => {
    try {
        const idOrResponse = parseParam(
            TransactionTypeIdSchema,
            { id: params.id },
            { message: 'Invalid transaction type ID' }
        );
        if (idOrResponse instanceof Response) return idOrResponse;

        await requireUser({ locals });

        const transactionType: TransactionTypeDTO = await transactionTypesService.getTransactionTypeById(
            idOrResponse.data.id,
            locals.supabase
        );

        return jsonResponse(transactionType, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof NotFoundError) {
            return jsonError(404, 'NOT_FOUND', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request data', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[GET /api/transaction-types/:id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};
