import type { APIErrorResponse } from '../../types';

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: JSON_HEADERS,
    });
}

export function jsonError(
    status: number,
    code: string,
    message: string,
    details?: APIErrorResponse['error']['details']
): Response {
    const body: APIErrorResponse = {
        error: {
            code,
            message,
            ...(details ? { details } : {}),
        },
    };

    return jsonResponse(body, status);
}
