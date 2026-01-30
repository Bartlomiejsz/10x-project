import type { APIRoute } from 'astro';
import { z } from 'zod';

import { requireUser } from '@/lib/api/auth';
import { jsonError, jsonResponse } from '@/lib/api/http';
import { UnauthorizedError, ValidationError } from '@/lib/errors';
import { BudgetsListQuerySchema, CreateBudgetSchema } from '@/lib/schemas/budgets.schema';
import { budgetsService } from '@/lib/services/budgets.service';

export const prerender = false;

/**
 * GET /api/budgets
 *
 * List budgets for a month (defaults to current month in UTC).
 */
export const GET: APIRoute = async ({ request, locals }) => {
    try {
        await requireUser({ locals });

        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const filters = BudgetsListQuerySchema.parse(queryParams);

        const result = await budgetsService.listBudgets(
            {
                month: filters.month,
                month_date: filters.month_date,
                type_id: filters.type_id,
                order: filters.order,
            },
            locals.supabase
        );

        // Uspójnienie z pozostałym API/fetcherami: list endpointy zwracają bez wrappera.
        return jsonResponse(result.data, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof ValidationError) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return jsonError(400, 'VALIDATION_ERROR', error.message, (error.details ?? undefined) as any);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid query parameters', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[Budgets API] [GET /api/budgets] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};

/**
 * POST /api/budgets
 * Create or upsert a budget.
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        await requireUser({ locals });

        const body = await request.json().catch(() => null);
        if (!body) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid JSON body');
        }

        const command = CreateBudgetSchema.parse(body);

        const { data, created } = await budgetsService.upsertBudget(command, locals.supabase);

        return jsonResponse(data, created ? 201 : 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof ValidationError) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return jsonError(400, 'VALIDATION_ERROR', error.message, (error.details ?? undefined) as any);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid request body', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[Budgets API] [POST /api/budgets] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};
