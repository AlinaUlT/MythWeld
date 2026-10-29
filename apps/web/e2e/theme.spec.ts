import { expect, test } from '@playwright/test';
import { FONT_PACKAGES } from '../src/config/fonts';
import { basePicks, partStyles, partsTheme } from '../src/theme/parts';
import { baseTheme } from '../src/theme/theme';
import { waitForServiceWorker } from './service-worker';

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

test('SHEET-06 the fonts come from the app itself, Latin and Cyrillic, and stay offline', async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  const fontOrigins = new Set<string>();
  page.on('request', (sent) => {
    if (sent.resourceType() === 'font') fontOrigins.add(new URL(sent.url()).origin);
  });
  await page.goto('./');
  await waitForServiceWorker(page);

  // A sample in each family, through the tokens, with a Latin and a Cyrillic line.
  await page.evaluate(() => {
    const sample = document.createElement('div');
    sample.id = 'font-sample';
    sample.style.cssText =
      'position:fixed;inset:auto 0 0 0;padding:16px;background:var(--theme-color-bg)';
    for (const token of ['--theme-font-heading', '--theme-font-body']) {
      for (const line of ['Hit Points 27 / 31', 'Хиты 27 / 31']) {
        const p = document.createElement('p');
        p.textContent = line;
        p.style.cssText = `font-family:var(${token});font-size:22px;color:var(--theme-color-text)`;
        sample.append(p);
      }
    }
    document.body.append(sample);
  });
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => `${face.family} ${face.unicodeRange.split(',')[0]}`)
      .sort();
  });
  // Each family loads its Latin face and its Cyrillic face, and nothing more.
  expect(loaded).toEqual([
    'EB Garamond U+0-FF',
    'EB Garamond U+301',
    'Inter U+0-FF',
    'Inter U+301',
  ]);
  expect([...fontOrigins]).toEqual([new URL(baseURL ?? '').origin]);
  await page.locator('#font-sample').screenshot({ path: testInfo.outputPath('fonts.png') });

  // The service worker keeps every font file, so text keeps its font offline.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((entry) => entry.url));
    }
    return urls.filter((url) => url.includes('.woff2')).length;
  });
  expect(cached).toBe(8);

  // Each font's licence ships beside it.
  for (const font of FONT_PACKAGES) {
    const response = await request.get(font.license);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(
      'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
    );
  }
});

test('SHEET-04 every part takes its base style in the built app, and a skin re-picks one', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  // No screen draws a part yet, so the test draws each one the way <Part> does: its three keys.
  const names = Object.keys(partStyles);
  const look = await page.evaluate((list) => {
    return Object.fromEntries(
      list.map((name) => {
        const el = document.createElement('div');
        el.style.border = `var(--theme-part-${name}-border)`;
        el.style.borderRadius = `var(--theme-part-${name}-border-radius)`;
        el.style.boxShadow = `var(--theme-part-${name}-box-shadow)`;
        document.body.append(el);
        const style = getComputedStyle(el);
        const drawn = {
          border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
          radius: `${style.borderTopLeftRadius} ${style.borderBottomRightRadius}`,
          shadow: style.boxShadow,
        };
        el.remove();
        return [name, drawn];
      }),
    );
  }, names);
  expect(look).toEqual({
    button: { border: '0px none rgb(28, 29, 32)', radius: '12px 12px', shadow: 'none' },
    'button-secondary': {
      border: '1px solid rgb(94, 98, 105)',
      radius: '12px 12px',
      shadow: 'none',
    },
    'icon-button': { border: '0px none rgb(28, 29, 32)', radius: '12px 12px', shadow: 'none' },
    card: { border: '1px solid rgb(226, 226, 222)', radius: '14px 14px', shadow: 'none' },
    panel: { border: '1px solid rgb(226, 226, 222)', radius: '16px 16px', shadow: 'none' },
    chip: { border: '0px none rgb(28, 29, 32)', radius: '9999px 9999px', shadow: 'none' },
    sheet: {
      border: '0px none rgb(28, 29, 32)',
      radius: '20px 0px',
      shadow: 'rgba(0, 0, 0, 0.18) 0px -8px 24px 0px',
    },
    toast: { border: '0px none rgb(28, 29, 32)', radius: '12px 12px', shadow: 'none' },
  });

  // A skin's pick fills the same keys from another style of the menu; nothing else changes.
  const raised = partsTheme({ ...basePicks, card: 'raised' }).shared ?? {};
  const shadow = await page.evaluate((values) => {
    for (const [key, value] of Object.entries(values))
      document.documentElement.style.setProperty(`--theme-${key}`, value);
    const el = document.createElement('div');
    el.style.boxShadow = 'var(--theme-part-card-box-shadow)';
    document.body.append(el);
    return getComputedStyle(el).boxShadow;
  }, raised);
  expect(shadow).toBe('rgba(0, 0, 0, 0.12) 0px 1px 3px 0px');
});
