import { expect, test } from '@playwright/test';
import { baseTheme } from '../src/theme/theme';

// The colour the screen shows, as #RRGGBB, so it compares with the theme's hex values.
function hex(rgb: string): string {
  const bytes = rgb.match(/\d+/g)?.slice(0, 3) ?? [];
  return `#${bytes.map((byte) => Number(byte).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

test('SHEET-01 the page paints with the base theme, dark by default', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await expect(page.locator('style#theme')).toHaveCount(1);
  const dark = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const title = getComputedStyle(document.querySelector('h1') as Element);
    return { bg: body.backgroundColor, text: title.color, font: body.fontFamily };
  });
  expect(hex(dark.bg)).toBe(baseTheme.dark['color-bg']);
  expect(hex(dark.text)).toBe(baseTheme.dark['color-text']);
  expect(dark.font).toBe(baseTheme.shared['font-body']);
  await page.screenshot({ path: testInfo.outputPath('dark.png') });

  // Without the `dark` class the light values apply, the ones the mockups draw.
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(hex(light)).toBe(baseTheme.light['color-bg']);
  await page.screenshot({ path: testInfo.outputPath('light.png') });
});
