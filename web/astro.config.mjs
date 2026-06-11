// @ts-check
// Source: https://tailwindcss.com/docs/installation/framework-guides/astro
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.consultoriosanchez.com',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
