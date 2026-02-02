import { supabaseClient } from '../db/supabase.client.ts';
import { defineMiddleware } from 'astro:middleware';

import { COOKIE_OPTIONS } from '@/pages/auth/callback.ts';

const GOOGLE_OAUTH_PATH = '/auth/oauth/google';
const GOOGLE_OAUTH_CALLBACK_PATH = '/auth/callback';
const LOGIN_PAGE_PATH = '/auth/login';

const buildRedirectTarget = (requestUrl: URL) => {
    return new URL(GOOGLE_OAUTH_CALLBACK_PATH, requestUrl.origin).toString();
};

const buildErrorRedirect = (requestUrl: URL, reason: string) => {
    const loginUrl = new URL(LOGIN_PAGE_PATH, requestUrl.origin);
    loginUrl.searchParams.set('authError', reason);
    return loginUrl.toString();
};

export const onRequest = defineMiddleware(async ({ cookies, locals, request, url }, next) => {
    locals.supabase = supabaseClient;

    if (request.method === 'GET' && url.pathname === GOOGLE_OAUTH_PATH) {
        const redirectTo = buildRedirectTarget(url);

        try {
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });

            if (error || !data?.url) {
                throw error ?? new Error('missing-oauth-url');
            }

            return Response.redirect(data.url, 302);
        } catch {
            const fallback = buildErrorRedirect(url, 'generic');
            return Response.redirect(fallback, 302);
        }
    }

    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (refreshToken) {
        const { data, error } = await supabaseClient.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken,
        });

        if (!error && data.session) {
            cookies.set('sb-access-token', data.session.access_token, COOKIE_OPTIONS);
            cookies.set('sb-refresh-token', data.session.refresh_token, COOKIE_OPTIONS);
        }
    }
    return next();
});
