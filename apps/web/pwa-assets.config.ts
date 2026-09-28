import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';
import { APP_BACKGROUND_COLOR } from './src/config/app.ts';

// The PNG icons are made from favicon.svg at build time; none is committed. The maskable and
// Apple icons get a solid background, because Android and iOS fill a transparent one themselves.
const background = { resizeOptions: { background: APP_BACKGROUND_COLOR } };

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...background },
    apple: { ...minimal2023Preset.apple, ...background },
  },
  images: ['public/favicon.svg'],
});
