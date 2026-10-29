import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_BACKGROUND_COLOR, APP_BASE_PATH, APP_NAME, APP_SHORT_NAME } from './src/config/app.ts';
import { FONT_PACKAGES } from './src/config/fonts.ts';

const require = createRequire(import.meta.url);

export default defineConfig({
  base: APP_BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'app-name',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
    },
    {
      // SHEET-06: each shipped font's licence goes out with it, read from its own package.
      name: 'font-licenses',
      apply: 'build',
      generateBundle() {
        for (const font of FONT_PACKAGES) {
          const license = require.resolve(`${font.name}/LICENSE`);
          this.emitFile({ type: 'asset', fileName: font.license, source: readFileSync(license) });
        }
      },
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
        // SHEET-06: the fonts and their licences too, so text keeps its font offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,txt}'],
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
