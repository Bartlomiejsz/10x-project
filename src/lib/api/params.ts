import { jsonError } from './http';
import type { ZodTypeAny } from 'zod';

/**
 * parseParam
 * Generic, reusable helper for validating URL params.
 */
export function parseParam<TSchema extends ZodTypeAny>(
    schema: TSchema,
    input: unknown,
    options: {
        message: string;
    }
): { data: ReturnType<TSchema['parse']> } | Response {
    const result = schema.safeParse(input);
    if (result.success) {
        return { data: result.data };
    }

    return jsonError(400, 'VALIDATION_ERROR', options.message, result.error.flatten().fieldErrors);
}
