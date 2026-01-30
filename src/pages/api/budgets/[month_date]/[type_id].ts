import type { APIRoute } from 'astro';
import { z } from 'zod';

import { requireUser } from '@/lib/api/auth';
import { jsonError, jsonResponse } from '@/lib/api/http';
import { parseParam } from '@/lib/api/params';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { BudgetKeyParamsSchema, UpdateBudgetSchema } from '@/lib/schemas/budgets.schema';
import { budgetsService } from '@/lib/services/budgets.service';

export const prerender = false;

/**
 * GET /api/budgets/:month_date/:type_id
 */
export const GET: APIRoute = async ({ params, locals }) => {
    try {
        const keyOrResponse = parseParam(
            BudgetKeyParamsSchema,
            { month_date: params.month_date, type_id: params.type_id },
            { message: 'Invalid budget key' }
        );
        if (keyOrResponse instanceof Response) return keyOrResponse;

        await requireUser({ locals });

        const budget = await budgetsService.getBudget(
            { month_date: keyOrResponse.data.month_date, type_id: keyOrResponse.data.type_id },
            locals.supabase
        );

        return jsonResponse(budget, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof NotFoundError) {
            return jsonError(404, 'NOT_FOUND', error.message);
        }

        if (error instanceof ValidationError) {
            return jsonError(400, 'VALIDATION_ERROR', error.message, (error.details ?? undefined) as any);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request data', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[Budgets API] [GET /api/budgets/:month_date/:type_id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};

/**
 * PUT /api/budgets/:month_date/:type_id
 * Update budget amount. Does NOT create; use POST /api/budgets for upsert.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
    try {
        const keyOrResponse = parseParam(
            BudgetKeyParamsSchema,
            { month_date: params.month_date, type_id: params.type_id },
            { message: 'Invalid budget key' }
        );
        if (keyOrResponse instanceof Response) return keyOrResponse;

        await requireUser({ locals });

        const body = await request.json().catch(() => null);
        if (!body) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid JSON body');
        }

        const command = UpdateBudgetSchema.parse(body);

        const updated = await budgetsService.updateBudget(
            { month_date: keyOrResponse.data.month_date, type_id: keyOrResponse.data.type_id },
            command,
            locals.supabase
        );

        return jsonResponse(updated, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof NotFoundError) {
            return jsonError(404, 'NOT_FOUND', error.message);
        }

        if (error instanceof ValidationError) {
            return jsonError(400, 'VALIDATION_ERROR', error.message, (error.details ?? undefined) as any);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request body', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[Budgets API] [PUT /api/budgets/:month_date/:type_id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};

/**
 * DELETE /api/budgets/:month_date/:type_id
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
    try {
        const keyOrResponse = parseParam(
            BudgetKeyParamsSchema,
            { month_date: params.month_date, type_id: params.type_id },
            { message: 'Invalid budget key' }
        );
        if (keyOrResponse instanceof Response) return keyOrResponse;

        await requireUser({ locals });

        await budgetsService.deleteBudget(
            { month_date: keyOrResponse.data.month_date, type_id: keyOrResponse.data.type_id },
            locals.supabase
        );

        return new Response(null, { status: 204 });
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof NotFoundError) {
            return jsonError(404, 'NOT_FOUND', error.message);
        }

        if (error instanceof ValidationError) {
            return jsonError(400, 'VALIDATION_ERROR', error.message, (error.details ?? undefined) as any);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request data', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[Budgets API] [DELETE /api/budgets/:month_date/:type_id] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};
