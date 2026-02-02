import { type APIRoute } from 'astro';

import { supabaseClient } from '@/db/supabase.client';

export const COOKIE_OPTIONS = {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 365,
};

export const GET: APIRoute = async (props) => {
    const { cookies, redirect, url } = props;
    const authCode = url.searchParams.get('code');

    if (!authCode) {
        return new Response('No code provided', { status: 400 });
    }

    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(authCode);

    if (error) {
        return new Response(error.message, { status: 500 });
    }

    const { access_token, refresh_token } = data.session;

    cookies.set('sb-access-token', access_token, COOKIE_OPTIONS);
    cookies.set('sb-refresh-token', refresh_token, COOKIE_OPTIONS);

    return redirect('/');
};
