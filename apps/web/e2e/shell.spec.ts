import { expect, test } from '@playwright/test';
import en from '../src/locales/en/common.json' with { type: 'json' };

const tabs = [
  { path: '/characters', label: en.nav.characters },
  { path: '/library', label: en.nav.library },
  { path: '/dice', label: en.nav.dice },
  { path: '/settings', label: en.nav.settings },
];

test('SETUP-04 dark by default, / opens Characters', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/characters');
  await expect(page.locator('html')).toHaveClass('dark');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.nav.characters);
});

test('SETUP-04 unknown path opens Characters', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page).toHaveURL('/characters');
});

test('SETUP-04 bottom bar has four tabs of at least 44 px', async ({ page }) => {
  await page.goto('/');
  const links = page.getByRole('navigation').getByRole('link');
  await expect(links).toHaveText(tabs.map((tab) => tab.label));
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    // The bar sits at the bottom of the 800 px viewport.
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(800);
  }
});

test('SETUP-04 tapping each tab opens its page', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const tab of tabs) {
    const link = page.getByRole('navigation').getByRole('link', { name: tab.label });
    await link.tap();
    await expect(page).toHaveURL(tab.path);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tab.label);
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`${tab.path.slice(1)}.png`) });
  }
});
