import { expect, type Page, test } from '@playwright/test';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-50: the Gear tab of golden B (SPEC §6.7), saved into the app's own database: chain mail and
// a greatsword, both worn, AC 17. Taking the chain mail off leaves AC 10 + DEX +1 = 11; the toast's
// "Undo" brings the 17 back.

const CHAIN_MAIL = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';
const GREATSWORD = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d';

/** Waits for the app to make its database, then puts the rows into its `characters` table. */
async function saveRows(page: Page, rows: readonly object[]) {
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual({ name: DB_NAME, version: 20 });
  await page.evaluate(
    ([name, toSave]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('characters', 'readwrite');
          for (const row of toSave) transaction.objectStore('characters').put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    [DB_NAME, rows] as const,
  );
}

const card = (page: Page, uid: string) => page.locator(`[data-uid="${uid}"]`);
const worn = (page: Page, uid: string) =>
  card(page, uid).getByRole('button', { name: en.gear.worn });

test('SHEET-50 Worn changes the AC at once, and Undo puts it back', async ({ page }, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);

  const ac = page.locator('[data-path="ac.total"]');
  await expect(ac).toHaveText('17AC');
  await expect(card(page, CHAIN_MAIL)).toContainText('Chain Mail');
  await expect(card(page, CHAIN_MAIL)).toContainText('55 lb');
  await expect(card(page, GREATSWORD)).toContainText('6 lb');
  await expect(page.getByText('61 lb')).toBeVisible();
  await expect(worn(page, CHAIN_MAIL)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: en.gear.attuned })).toHaveCount(0);

  // Every switch is at least 44 px high, and the page does not scroll sideways.
  const box = await worn(page, CHAIN_MAIL).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('gear-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('gear-light.png') });

  await worn(page, CHAIN_MAIL).tap();
  await expect(worn(page, CHAIN_MAIL)).toHaveAttribute('aria-pressed', 'false');
  await expect(ac).toHaveText('11AC');
  const toast = page.getByRole('status');
  await expect(toast).toContainText('Chain Mail taken off');
  await page.screenshot({ path: testInfo.outputPath('gear-taken-off.png') });

  await toast.getByRole('button', { name: en.toast.undo }).tap();
  await expect(worn(page, CHAIN_MAIL)).toHaveAttribute('aria-pressed', 'true');
  await expect(ac).toHaveText('17AC');

  // The change is stored: after a reload the chain mail is still worn, the greatsword off.
  await worn(page, GREATSWORD).tap();
  await expect(worn(page, GREATSWORD)).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(worn(page, GREATSWORD)).toHaveAttribute('aria-pressed', 'false');
  await expect(worn(page, CHAIN_MAIL)).toHaveAttribute('aria-pressed', 'true');
});

test('SHEET-50 a row goes into a container only in edit mode, and shows under it', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  await expect(page.getByRole('combobox')).toHaveCount(0);

  await page.getByRole('button', { name: en.sheet.edit }).tap();
  const put = card(page, GREATSWORD).getByRole('combobox', { name: en.gear.putIn });
  await expect(put).toBeVisible();
  await put.selectOption({ label: 'Chain Mail' });

  await expect(card(page, CHAIN_MAIL)).toContainText('Holds 1');
  await expect(card(page, GREATSWORD)).toHaveClass(/ml-4/);
  await expect(page.getByText('61 lb')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('gear-container.png') });

  // The container is not offered a place inside what it holds.
  const outer = card(page, CHAIN_MAIL).getByRole('combobox', { name: en.gear.putIn });
  await expect(outer.locator('option')).toHaveText([en.gear.putInNone]);
});

test('SHEET-50 weights show in kilograms once Settings picks them', async ({ page }) => {
  await saveRows(page, [goldenB]);
  await page.goto('settings');
  await page.getByText(en.settings.units.kg, { exact: true }).tap();
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  await expect(card(page, CHAIN_MAIL)).toContainText('24.9 kg');
  await expect(card(page, GREATSWORD)).toContainText('2.7 kg');
  await expect(page.getByText('27.7 kg')).toBeVisible();
});
