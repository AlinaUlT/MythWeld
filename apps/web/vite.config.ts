import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_BACKGROUND_COLOR, APP_BASE_PATH, APP_NAME, APP_SHORT_NAME } from './src/config/app.ts';

export default defineConfig({
  base: APP_BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'app-name',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
    },
    // SETUP-07: the manifest makes the app installable; the service worker precaches every built
    // file, so the app opens offline after the first visit. start_url and scope follow `base`.
    VitePWA({
      // A new version takes over once downloaded; main.tsx reloads the page once when it does.
      registerType: 'autoUpdate',
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true },
      workbox: {
        // The plugin adds manifest.webmanifest itself; listing it here too makes Workbox refuse
        // to precache anything (add-to-cache-list-conflicting-entries).
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // ENG-38: a published pack schema is a file, not a page of the app. Without this, a
        // browser the worker controls gets index.html at the file's address.
        navigateFallbackDenylist: [new RegExp(`^${APP_BASE_PATH}schema/`)],
        // The plugin sets these two only when it injects its own register script; main.tsx
        // registers instead. Without them a new version waits until every tab of the app closes.
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
        lang: 'en',
        display: 'standalone',
        background_color: APP_BACKGROUND_COLOR,
        theme_color: APP_BACKGROUND_COLOR,
      },
    }),
  ],
});
