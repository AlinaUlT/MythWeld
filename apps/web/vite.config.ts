import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { APP_NAME } from './src/config/app';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'app-name',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
    },
  ],
});
