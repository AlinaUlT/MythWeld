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

test('SHEET-03 the shell draws its slots, and a skin refills one without a component', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  const slots = page.locator('[data-skin-slot]');
  await expect(slots).toHaveCount(3);
  expect(
    await slots.evaluateAll((all) => all.map((el) => el.getAttribute('data-skin-slot'))),
  ).toEqual(['app', 'page', 'dock']);
  const look = await page.evaluate(() => {
    const style = (name: string) =>
      getComputedStyle(document.querySelector(`[data-skin-slot="${name}"]`) as Element);
    return {
      app: style('app').backgroundColor,
      page: style('page').backgroundColor,
      dock: style('dock').backgroundColor,
      shadow: style('dock').boxShadow,
    };
  });
  expect(hex(look.app)).toBe(baseTheme.dark['color-bg']);
  expect(look.page).toBe('rgba(0, 0, 0, 0)');
  expect(hex(look.dock)).toBe(baseTheme.dark['color-surface']);
  expect(look.shadow).toBe('rgba(0, 0, 0, 0.3) 0px -4px 12px 0px');
  await page.screenshot({ path: testInfo.outputPath('slots-dark.png') });

  // A skin fills the same key with a gradient; the shell paints it as it is.
  await page.evaluate(() =>
    document.documentElement.style.setProperty(
      '--theme-slot-app-background',
      'linear-gradient(var(--theme-color-hp), var(--theme-color-temp))',
    ),
  );
  const image = await page
    .locator('[data-skin-slot="app"]')
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(image).toMatch(/^linear-gradient\(/);
  await page.screenshot({ path: testInfo.outputPath('slots-skin.png') });
});
