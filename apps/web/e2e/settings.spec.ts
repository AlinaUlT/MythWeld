import { expect, type Page, test } from '@playwright/test';
import { en } from '../src/i18n/namespaces';
import { baseTheme } from '../src/theme/theme';

const s = en.settings;

// The colour the screen shows, as #RRGGBB, so it compares with the theme's hex values.
function hex(rgb: string): string {
  const bytes = rgb.match(/\d+/g)?.slice(0, 3) ?? [];
  return `#${bytes.map((byte) => Number(byte).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor).then(hex);

// The rows of the `settings` store, read from IndexedDB as the app left them.
const storedRows = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown[]>((done, fail) => {
        const open = indexedDB.open('grimoire');
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const read = open.result.transaction('settings').objectStore('settings').getAll();
          read.onsuccess = () => {
            open.result.close();
            done(read.result);
          };
        };
      }),
  );

test('SHEET-13 Settings keep the theme, the motion switch, the units and "I roll myself"', async ({
  page,
}, testInfo) => {
  // At the first frame that draws the app: the class on <html>, the motion switch, and the time.
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      const root = document.getElementById('root');
      if (!root?.firstChild) return;
      observer.disconnect();
      Object.assign(window, {
        firstRender: {
          dark: document.documentElement.classList.contains('dark'),
          motion: document.documentElement.dataset.motion ?? null,
          at: Math.round(performance.now()),
        },
      });
    }).observe(document, { childList: true, subtree: true });
  });
  const firstRender = () =>
    page.evaluate(() => (window as unknown as { firstRender: unknown }).firstRender);

  await page.goto('settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(s.title);
  // The defaults: feet, pounds, the app rolls, dark, motion on.
  await expect(page.getByRole('radio', { name: s.units.ft })).toBeChecked();
  await expect(page.getByRole('radio', { name: s.units.lb })).toBeChecked();
  await expect(page.getByRole('radio', { name: s.theme.dark })).toBeChecked();
  await expect(page.getByRole('switch', { name: s.dice.rollMyself })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: s.theme.stillMotion })).not.toBeChecked();
  await expect(page.locator('html')).toHaveClass('dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-motion');
  expect(await background(page)).toBe(baseTheme.dark['color-bg']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  // Every control is a 44 px target.
  for (const name of [s.units.m, s.units.kg, s.theme.light]) {
    const box = await page
      .locator('label', { has: page.getByRole('radio', { name }) })
      .boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  for (const name of [s.dice.rollMyself, s.theme.stillMotion]) {
    const box = await page
      .locator('label', { has: page.getByRole('switch', { name }) })
      .boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath('settings-dark.png') });

  // Each choice shows at once.
  await page.getByText(s.theme.light, { exact: true }).tap();
  await expect(page.locator('html')).not.toHaveClass('dark');
  expect(await background(page)).toBe(baseTheme.light['color-bg']);
  await page.getByText(s.theme.stillMotion, { exact: true }).tap();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still');
  await page.getByText(s.units.m, { exact: true }).tap();
  await page.getByText(s.units.kg, { exact: true }).tap();
  await page.getByText(s.dice.rollMyself, { exact: true }).tap();
  await expect(page.getByRole('switch', { name: s.dice.rollMyself })).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('settings-light.png') });

  // Each is one row of the `settings` store.
  await expect
    .poll(async () =>
      (await storedRows(page)).sort((a, b) =>
        String((a as { key: string }).key).localeCompare((b as { key: string }).key),
      ),
    )
    .toEqual([
      { key: 'distance', value: 'm' },
      { key: 'rollMyself', value: true },
      { key: 'stillMotion', value: true },
      { key: 'theme', value: 'light' },
      { key: 'weight', value: 'kg' },
    ]);

  // After a reload the choices hold, and the first frame already wears them.
  await page.reload();
  await expect(page.getByRole('radio', { name: s.units.m })).toBeChecked();
  await expect(page.getByRole('radio', { name: s.units.kg })).toBeChecked();
  await expect(page.getByRole('radio', { name: s.theme.light })).toBeChecked();
  await expect(page.getByRole('switch', { name: s.dice.rollMyself })).toBeChecked();
  await expect(page.getByRole('switch', { name: s.theme.stillMotion })).toBeChecked();
  const first = (await firstRender()) as { dark: boolean; motion: string | null; at: number };
  expect({ dark: first.dark, motion: first.motion }).toEqual({ dark: false, motion: 'still' });
  testInfo.annotations.push({
    type: 'SHEET-13 first render',
    description: `first frame of the app at ${first.at} ms after navigation, choices on it`,
  });
  console.log(testInfo.annotations.at(-1)?.description);

  // The start page opens light too, and going back to dark puts the class back.
  await page.goto('./');
  await expect(page.locator('html')).not.toHaveClass('dark');
  await page.screenshot({ path: testInfo.outputPath('start-light.png') });
  await page.goto('settings');
  await page.getByText(s.theme.dark, { exact: true }).tap();
  await expect(page.locator('html')).toHaveClass('dark');
});

test('SHEET-13 a stored value off its list opens as the default', async ({ page }) => {
  await page.goto('settings');
  await expect(page.getByRole('radio', { name: s.theme.dark })).toBeChecked();
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const open = indexedDB.open('grimoire');
        open.onsuccess = () => {
          const tx = open.result.transaction('settings', 'readwrite');
          tx.objectStore('settings').put({ key: 'theme', value: 'sepia' });
          tx.oncomplete = () => {
            open.result.close();
            done();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole('radio', { name: s.theme.dark })).toBeChecked();
  await expect(page.locator('html')).toHaveClass('dark');
  expect(warnings).toEqual([
    'Setting theme holds "sepia", not one of ["dark","light"]; it reads as "dark"',
  ]);
});
