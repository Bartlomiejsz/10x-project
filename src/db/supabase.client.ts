import type { Database } from '../db/database.types.ts';
import { type SupabaseClient as SupabaseClientType, createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from 'astro:env/server';

export const supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        flowType: 'pkce',
    },
});

export type SupabaseClient = SupabaseClientType<Database>;
