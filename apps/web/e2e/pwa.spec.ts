import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { APP_BACKGROUND_COLOR, APP_NAME, APP_SHORT_NAME } from '../src/config/app';
import en from '../src/locales/en/common.json' with { type: 'json' };

type Icon = { src: string; sizes: string; purpose?: string };

// The service worker controls the page only after it has precached every built file.
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test('SETUP-07 the manifest names the app and its icons', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href ?? '', page.url());
  const manifest = await (await request.get(manifestUrl.href)).json();
  expect(manifest).toMatchObject({
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    display: 'standalone',
    start_url: '/',
    scope: '/',
    background_color: APP_BACKGROUND_COLOR,
    theme_color: APP_BACKGROUND_COLOR,
  });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    APP_BACKGROUND_COLOR,
  );

  const icons: Icon[] = manifest.icons;
  expect(icons.map((icon) => `${icon.sizes} ${icon.purpose ?? 'any'}`)).toEqual(
    expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']),
  );
  for (const icon of icons) {
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, new URL(icon.src, manifestUrl).href);
    expect(size, icon.src).toBe(icon.sizes);
  }
});

test('SETUP-07 the manifest colour is the colour the page renders', async ({ page }) => {
  await page.goto('/');
  // A 1x1 canvas turns the computed oklch() colour into the sRGB bytes the screen shows.
  const rendered = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return 'no canvas';
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((byte) => (byte ?? 0).toString(16).padStart(2, '0')).join('')}`;
  });
  expect(rendered).toBe(APP_BACKGROUND_COLOR);
});

test('SETUP-07 Chrome finds the app installable', async ({ browser, launchOptions, baseURL }) => {
  // The usual test context is incognito, and Chrome never installs from incognito
  // (`in-incognito`). A real profile on disk asks the question a phone would.
  const profile = mkdtempSync(join(tmpdir(), 'grimoire-profile-'));
  const context = await browser.browserType().launchPersistentContext(profile, launchOptions);
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(baseURL ?? '');
    await waitForServiceWorker(page);
    const cdp = await context.newCDPSession(page);
    expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);
    expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

test('SETUP-07 after the first visit the app opens offline', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  const origins = new Set<string>();
  context.on('request', (request) => origins.add(new URL(request.url()).origin));
  await page.goto('/');
  await waitForServiceWorker(page);

  await context.setOffline(true);
  const reloaded = await page.reload();
  expect(reloaded?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.nav.characters);
  await page.screenshot({ path: testInfo.outputPath('offline-characters.png') });

  // A link straight to a tab opens too: the service worker answers every page with index.html.
  await page.goto('/dice');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.nav.dice);
  await page.screenshot({ path: testInfo.outputPath('offline-dice.png') });

  // The page and its service worker asked nothing of any server but the app's own.
  expect([...origins]).toEqual([new URL(baseURL ?? '').origin]);
});
