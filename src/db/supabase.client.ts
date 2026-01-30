import type { Database } from '../db/database.types.ts';
import { type SupabaseClient as SupabaseClientType, createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        flowType: 'pkce',
    },
});

export type SupabaseClient = SupabaseClientType<Database>;
