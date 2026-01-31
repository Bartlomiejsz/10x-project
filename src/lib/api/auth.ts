import { UnauthorizedError } from '../errors';
import type { APIContext } from 'astro';

const skipAuth = import.meta.env.SKIP_AUTH || false;

export interface AuthUser {
    id: string;
}

export async function requireUser(context: Pick<APIContext, 'locals'>): Promise<AuthUser> {
    if (skipAuth) {
        return { id: 'skip-auth-user' };
    }

    const {
        data: { user },
        error: authError,
    } = await context.locals.supabase.auth.getUser();

    if (authError || !user) {
        throw new UnauthorizedError('Authentication required');
    }

    return { id: user.id };
}
