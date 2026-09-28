import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import { App } from './App';
import { db } from './db/db';
import { requestPersistentStorage } from './db/persist';

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
