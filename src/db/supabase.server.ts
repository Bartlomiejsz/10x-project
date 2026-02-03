import type { Database } from './database.types.ts';
import {
    type CookieOptionsWithName,
    createServerClient,
    parseCookieHeader,
    serializeCookieHeader,
} from '@supabase/ssr';
import { SUPABASE_KEY, SUPABASE_URL } from 'astro:env/server';

export const COOKIE_OPTIONS: Omit<CookieOptionsWithName, 'name'> = {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
};

interface CookieToSet {
    name: string;
    value: string;
    options: Omit<CookieOptionsWithName, 'name'>;
}

export function createSupabaseServerClient(request: Request) {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const pendingCookies: CookieToSet[] = [];

    const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
            getAll() {
                return parseCookieHeader(cookieHeader).filter(
                    (c): c is { name: string; value: string } => c.value !== undefined
                );
            },
            setAll(cookiesToSet) {
                for (const { name, value, options } of cookiesToSet) {
                    pendingCookies.push({
                        name,
                        value,
                        options: { ...COOKIE_OPTIONS, ...options },
                    });
                }
            },
        },
    });

    return {
        client,
        applyPendingCookies(response: Response): Response {
            if (pendingCookies.length === 0) {
                return response;
            }

            // Clone headers to make them mutable
            const headers = new Headers(response.headers);
            for (const { name, value, options } of pendingCookies) {
                headers.append('Set-Cookie', serializeCookieHeader(name, value, options));
            }

            // Create new response with the modified headers
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        },
    };
}
