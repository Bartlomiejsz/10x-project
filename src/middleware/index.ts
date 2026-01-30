import { supabaseClient } from '../db/supabase.client.ts';
import { defineMiddleware } from 'astro:middleware';

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

export const onRequest = defineMiddleware(async (context, next) => {
    context.locals.supabase = supabaseClient;

    if (context.request.method === 'GET' && context.url.pathname === GOOGLE_OAUTH_PATH) {
        const redirectTo = buildRedirectTarget(context.url);

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
            const fallback = buildErrorRedirect(context.url, 'generic');
            return Response.redirect(fallback, 302);
        }
    }

    return next();
});
