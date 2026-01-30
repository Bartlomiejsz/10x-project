import { z } from 'zod';

const MONTH_STRING_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Month string in format YYYY-MM.
 * Example: 2025-10
 */
export const MonthStringSchema = z.string().regex(MONTH_STRING_REGEX, 'Invalid month format, expected YYYY-MM');

/**
 * Query params schema for GET /api/reports/monthly
 */
export const MonthlyReportQuerySchema = z.object({
    month: MonthStringSchema,
});
