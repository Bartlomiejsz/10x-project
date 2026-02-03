/// <reference types="astro/client" />

interface ImportMetaEnv {
    readonly SUPABASE_URL: string;
    readonly SUPABASE_KEY: string;
    readonly OPENROUTER_API_KEY: string;
    readonly SKIP_AUTH: boolean;
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare namespace App {
    interface Locals {
        supabase: import('@supabase/supabase-js').SupabaseClient<import('./db/database.types').Database>;
    }
}
