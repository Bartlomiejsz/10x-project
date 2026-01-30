import type { APIRoute } from 'astro';
import { z } from 'zod';

import { requireUser } from '@/lib/api/auth.ts';
import { jsonError, jsonResponse } from '@/lib/api/http.ts';
import { UnauthorizedError } from '@/lib/errors.ts';
import { MonthlyReportQuerySchema } from '@/lib/schemas/reports.schema.ts';
import { reportsService } from '@/lib/services/reports.service.ts';

export const prerender = false;

/**
 * GET /api/reports/monthly
 * Returns aggregated spending per category for the given month.
 * Note: report covers ALL users (household view) and does not filter by user_id.
 */
export const GET: APIRoute = async ({ request, locals }) => {
    try {
        await requireUser({ locals });

        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const { month } = MonthlyReportQuerySchema.parse(queryParams);

        const result = await reportsService.getMonthlyReport(month, locals.supabase);
        return jsonResponse(result, 200);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return jsonError(401, 'UNAUTHORIZED', error.message);
        }

        if (error instanceof z.ZodError) {
            return jsonError(400, 'VALIDATION_ERROR', 'Invalid query parameters', error.flatten().fieldErrors);
        }

        // eslint-disable-next-line no-console
        console.error('[GET /api/reports/monthly] Unexpected error:', error);
        return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
};
