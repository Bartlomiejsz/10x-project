import type { APIRoute } from 'astro';
import { z } from 'zod';

import { requireUser } from '@/lib/api/auth';
import { jsonError, jsonResponse } from '@/lib/api/http';
import { parseParam } from '@/lib/api/params';
import { shouldRejectAiUpdate } from '@/lib/api/transactions.rules';
import { UnauthorizedError } from '@/lib/errors';
import {
    PatchTransactionSchema,
    TransactionIdSchema,
    UpdateTransactionPutSchema,
} from '@/lib/schemas/transactions.schema';
import type { TransactionDTO } from '@/types';

export const prerender = false;

/**
 * GET /api/transactions/:id
 */
export const GET: APIRoute = async ({ params, locals }) => {
    try {
        const idOrResponse = parseParam(TransactionIdSchema, { id: params.id }, { message: 'Invalid transaction id' });
        if (idOrResponse instanceof Response) return idOrResponse;

        const user = await requireUser({ locals });

        const { data, error } = await locals.supabase
            .from('transactions')
            .select('*')
            .eq('id', idOrResponse.data.id)
            .eq('user_id', user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            return jsonError(404, 'NOT_FOUND', 'Transaction not found');
        }

        if (error) {
            throw new Error(`Failed to fetch transaction: ${error.message}`);
        }

        return jsonResponse(data as TransactionDTO, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request data', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[GET /api/transactions/:id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};

/**
 * PUT /api/transactions/:id
 * Full replace.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
    try {
        const idOrResponse = parseParam(TransactionIdSchema, { id: params.id }, { message: 'Invalid transaction id' });
        if (idOrResponse instanceof Response) return idOrResponse;

        const user = await requireUser({ locals });

        const body = await request.json().catch(() => null);
        if (!body) return jsonError(400, 'VALIDATION_ERROR', 'Invalid JSON body');

        const command = UpdateTransactionPutSchema.parse(body);

        if (shouldRejectAiUpdate(command)) {
            return jsonError(
                400,
                'VALIDATION_ERROR',
                'AI metadata can only be updated when is_manual_override is true'
            );
        }

        const { data, error } = await locals.supabase
            .from('transactions')
            .update({
                type_id: command.type_id,
                amount: command.amount,
                description: command.description,
                date: command.date,
                is_manual_override: command.is_manual_override ?? false,
                ai_status: command.ai_status ?? null,
                ai_confidence: command.ai_confidence ?? null,
                import_hash: command.import_hash ?? null,
            })
            .eq('id', idOrResponse.data.id)
            .eq('user_id', user.id)
            .select('*')
            .single();

        if (error && error.code === 'PGRST116') {
            return jsonError(404, 'NOT_FOUND', 'Transaction not found');
        }

        if (error) {
            throw new Error(`Failed to update transaction: ${error.message}`);
        }

        return jsonResponse(data as TransactionDTO, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request body', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[PUT /api/transactions/:id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};

/**
 * PATCH /api/transactions/:id
 * Partial update.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
    try {
        const idOrResponse = parseParam(TransactionIdSchema, { id: params.id }, { message: 'Invalid transaction id' });
        if (idOrResponse instanceof Response) return idOrResponse;

        const user = await requireUser({ locals });

        const body = await request.json().catch(() => null);
        if (!body) return jsonError(400, 'VALIDATION_ERROR', 'Invalid JSON body');

        const command = PatchTransactionSchema.parse(body);

        const wantsAiUpdate = command.ai_status !== undefined || command.ai_confidence !== undefined;

        if (wantsAiUpdate && command.is_manual_override !== true) {
            const { data: current, error: currentError } = await locals.supabase
                .from('transactions')
                .select('is_manual_override')
                .eq('id', idOrResponse.data.id)
                .eq('user_id', user.id)
                .single();

            if (currentError && currentError.code === 'PGRST116') {
                return jsonError(404, 'NOT_FOUND', 'Transaction not found');
            }

            if (currentError) {
                throw new Error(`Failed to fetch transaction: ${currentError.message}`);
            }

            if (!current?.is_manual_override) {
                return jsonError(
                    400,
                    'VALIDATION_ERROR',
                    'AI metadata can only be updated when is_manual_override is true'
                );
            }
        }

        const { data, error } = await locals.supabase
            .from('transactions')
            .update({ ...command })
            .eq('id', idOrResponse.data.id)
            .eq('user_id', user.id)
            .select('*')
            .single();

        if (error && error.code === 'PGRST116') {
            return jsonError(404, 'NOT_FOUND', 'Transaction not found');
        }

        if (error) {
            throw new Error(`Failed to patch transaction: ${error.message}`);
        }

        return jsonResponse(data as TransactionDTO, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request body', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[PATCH /api/transactions/:id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};

/**
 * DELETE /api/transactions/:id
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
    try {
        const idOrResponse = parseParam(TransactionIdSchema, { id: params.id }, { message: 'Invalid transaction id' });
        if (idOrResponse instanceof Response) return idOrResponse;

        const user = await requireUser({ locals });

        const { error } = await locals.supabase
            .from('transactions')
            .delete()
            .eq('id', idOrResponse.data.id)
            .eq('user_id', user.id);

        if (error && error.code === 'PGRST116') {
            return jsonError(404, 'NOT_FOUND', 'Transaction not found');
        }

        if (error) {
            throw new Error(`Failed to delete transaction: ${error.message}`);
        }

        return jsonResponse({ ok: true }, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request data', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[DELETE /api/transactions/:id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};
