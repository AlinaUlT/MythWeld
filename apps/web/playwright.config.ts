import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}` },
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
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
