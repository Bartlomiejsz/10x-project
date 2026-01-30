import { supabaseClient } from '../../db/supabase.client';
import { type APIRoute } from 'astro';

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

    cookies.set('sb-access-token', access_token, {
        path: '/',
    });
    cookies.set('sb-refresh-token', refresh_token, {
        path: '/',
    });

    return redirect('/');
};
