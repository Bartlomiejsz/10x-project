import { type APIRoute } from 'astro';
import { ALLOWED_EMAILS } from 'astro:env/server';

import { createSupabaseServerClient } from '@/db/supabase.server';

function parseAllowedEmails(envValue: string): string[] {
    return envValue
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

export const GET: APIRoute = async ({ cookies, redirect, request, url }) => {
    const authCode = url.searchParams.get('code');

    if (!authCode) {
        return redirect('/auth/login?authError=no-code');
    }

    const supabase = createSupabaseServerClient(request, cookies);

    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

    if (error) {
        return redirect('/auth/login?authError=exchange-failed');
    }

    const userEmail = data.session?.user?.email?.toLowerCase();
    const allowedEmails = parseAllowedEmails(ALLOWED_EMAILS);

    if (!userEmail || !allowedEmails.includes(userEmail)) {
        await supabase.auth.signOut();

        return redirect('/auth/login?authError=unauthorized-email');
    }

    return redirect('/');
};
