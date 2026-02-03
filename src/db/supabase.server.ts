import type { Database } from './database.types.ts';
import { type CookieOptionsWithName, createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { SUPABASE_KEY, SUPABASE_URL } from 'astro:env/server';

export const COOKIE_OPTIONS: Omit<CookieOptionsWithName, 'name'> = {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
};

export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
    const cookieHeader = request.headers.get('cookie') ?? '';

    return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
            getAll() {
                return parseCookieHeader(cookieHeader).filter(
                    (c): c is { name: string; value: string } => c.value !== undefined
                );
            },
            setAll(cookiesToSet) {
                for (const { name, value, options } of cookiesToSet) {
                    cookies.set(name, value, {
                        ...COOKIE_OPTIONS,
                        ...options,
                    });
                }
            },
        },
    });
}
