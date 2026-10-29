import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import { App } from './App';
import { startPacks } from './content/packs';
import { db } from './db/db';
import { requestPersistentStorage } from './db/persist';
import { applyTheme, baseTheme } from './theme/theme';

// The tokens are filled before the first render, so no frame shows without them.
applyTheme(baseTheme);

// The built-in packs are in the build, so they open before the first render too. One that does
// not open is a build fault, logged; the app still starts without it (SPEC §8.2).
for (const unopened of startPacks().unopened) console.error(unopened.message);

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Storage never holds up the first render. Nothing reads the database yet, so a failure is only
// logged; the screen that explains it comes with the first data (phase 2).
db.open().catch((error: unknown) => console.error(error));
requestPersistentStorage().catch((error: unknown) => console.error(error));

// The service worker is registered after the first render too. Online, the app works without it.
registerSW({ immediate: true, onRegisterError: (error: unknown) => console.error(error) });
