// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    output: 'server',
    integrations: [react(), sitemap()],
    server: { port: 3000 },
    env: {
        schema: {
            SUPABASE_URL: envField.string({ context: 'server', access: 'secret' }),
            SUPABASE_KEY: envField.string({ context: 'server', access: 'secret' }),
            SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret' }),
        },
    },
    vite: {
        plugins: [tailwindcss()],
    },
    adapter: cloudflare(),
});
