import { defineConfig, devices } from '@playwright/test';
import { APP_BASE_PATH } from './src/config/app';

const port = 4173;
// The tests open the app under the same path the public site uses; specs use relative paths.
const baseURL = `http://localhost:${port}${APP_BASE_PATH}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL },
  projects: [
    {
      name: 'pixel-7',
      use: {
        ...devices['Pixel 7'],
        // The ticket rules ask for screenshots at 360x800; the rest of the Pixel 7 profile stays.
        viewport: { width: 360, height: 800 },
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
