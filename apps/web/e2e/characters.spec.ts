import { FIFTH_EDITION_SCHEMA_VERSION } from '@grimoire/system-5e';
import { expect, type Page, test } from '@playwright/test';
import { goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { APP_BASE_PATH } from '../src/config/app';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-24: rows are saved into the app's own database in Chromium, then My characters lists
// them. The goldens of SPEC §6.7 are the characters; the built-in packs name their entities.

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

const cards = (page: Page) => page.getByRole('main').getByRole('link', { name: /Golden/ });

test('SHEET-24 with no character, the list says so and offers + and Import file', async ({
  page,
}, testInfo) => {
  await page.goto('characters');
  await expect(page.getByText(en.characters.empty)).toBeVisible();
  const newCharacter = page.getByRole('link', { name: en.characters.new });
  await expect(newCharacter).toHaveCount(2);
  for (const link of await newCharacter.all()) {
    await expect(link).toHaveAttribute('href', `${APP_BASE_PATH}characters/new`);
  }
  // The first is the header's +, the second the empty state's button.
  const box = await newCharacter.first().boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('button', { name: en.characters.import })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('characters-empty.png') });
});

test('SHEET-24 saved characters are listed, newest first, and a card opens its sheet', async ({
  page,
}, testInfo) => {
  const newer = { ...goldenB, updatedAt: '2026-10-03T09:00:00.000Z' };
  const refused = {
    ...goldenC2014,
    id: '6c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5',
    name: 'From a newer app',
    systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION + 1,
  };
  await saveRows(page, [goldenC2014, newer, refused]);
  await page.goto('characters');

  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).nth(0)).toContainText('Golden B');
  await expect(cards(page).nth(0)).toContainText('2024');
  await expect(cards(page).nth(0)).toContainText('Human · Fighter 1');
  await expect(cards(page).nth(0)).toContainText('Created Oct 2, 2026');
  await expect(cards(page).nth(1)).toContainText('Golden C (2014)');
  await expect(cards(page).nth(1)).toContainText('Wizard 3 · Paladin 3');

  // The refused row is named with its reason, and is not a link.
  await expect(page.getByText('From a newer app')).toBeVisible();
  await expect(page.getByText(en.characters.unopened.newer)).toBeVisible();
  await expect(page.getByRole('link', { name: /From a newer app/ })).toHaveCount(0);
  await expect(page.getByText(en.characters.hint)).toBeVisible();
  await expect(page.getByText(en.characters.empty)).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('characters-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('characters-light.png') });

  await cards(page).nth(0).tap();
  await expect(page).toHaveURL(`characters/${goldenB.id}`);
});
