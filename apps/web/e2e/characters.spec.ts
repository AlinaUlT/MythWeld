import { FIFTH_EDITION_SCHEMA_VERSION } from '@grimoire/system-5e';
import { expect, type Locator, type Page, test } from '@playwright/test';
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

// SHEET-25: a card's swipe and its "⋯" open the character's Actions; Copy, Export and Delete with
// Undo run in Chromium against the app's own database.

/** Whether `locator`'s element is shown and is what a tap at its middle reaches, not a card. */
async function onTop(locator: Locator): Promise<boolean> {
  // A closed card's actions are hidden, so not even found.
  if ((await locator.count()) === 0) return false;
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && element.contains(hit);
  });
}

/** A point on the card `name`: its middle, or, when it is open and slid left, its part on screen. */
async function pointOn(page: Page, name: RegExp) {
  const card = page.getByRole('link', { name });
  // A card still sliding is measured once it has stopped.
  await card.evaluate((element) =>
    Promise.all(element.parentElement?.getAnimations().map(({ finished }) => finished) ?? []),
  );
  const box = await card.boundingBox();
  if (box === null) throw new Error(`No card ${name}`);
  return { x: Math.max(box.x + box.width / 2, 24), y: box.y + box.height / 2 };
}

/** Drags the card `name` sideways by `dx` pixels with the pointer. */
async function swipe(page: Page, name: RegExp, dx: number) {
  const { x, y } = await pointOn(page, name);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) await page.mouse.move(x + (dx * step) / 10, y);
  await page.mouse.up();
}

test('SHEET-25 a swipe opens a card over Copy, DM link, Delete and More; Copy adds a copy', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto('characters');
  await expect(cards(page)).toHaveCount(1);
  const copy = page.getByRole('button', { name: en.actions.swipe.copy, exact: true });
  // Closed, the actions under the card are out of reach.
  expect(await onTop(copy)).toBe(false);

  await swipe(page, /Golden B/, -150);
  await expect(page).toHaveURL(/characters$/);
  for (const name of Object.values(en.actions.swipe)) {
    await expect.poll(() => onTop(page.getByRole('button', { name, exact: true }))).toBe(true);
  }
  await expect(page.getByRole('button', { name: en.actions.swipe.dmLink })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('characters-swiped.png') });

  // A swipe back closes it; a tap on the open card closes it and opens nothing.
  await swipe(page, /Golden B/, 150);
  await expect.poll(() => onTop(copy)).toBe(false);
  await swipe(page, /Golden B/, -150);
  await expect.poll(() => onTop(copy)).toBe(true);
  const { x, y } = await pointOn(page, /Golden B/);
  await page.mouse.click(x, y);
  await expect(page).toHaveURL(/characters$/);
  await expect.poll(() => onTop(copy)).toBe(false);

  await swipe(page, /Golden B/, -150);
  await expect.poll(() => onTop(copy)).toBe(true);
  await copy.click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).nth(0)).toContainText('Golden B (copy)');
  await expect(cards(page).nth(0)).toContainText('Human · Fighter 1');
  await cards(page).nth(0).click();
  await expect(page).not.toHaveURL(`characters/${goldenB.id}`);
  await expect(page).toHaveURL(/characters\/[0-9a-f-]{36}$/);
});

test('SHEET-25 the card’s ⋯ opens Actions; Export saves the file, Delete has Undo', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto('characters');
  const more = page.getByRole('button', { name: en.actions.title, exact: true });
  const box = await more.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await more.click();
  const dialog = page.getByRole('dialog', { name: 'Golden B' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Human · Fighter 1');
  await expect(dialog.getByRole('button', { name: new RegExp(en.actions.dmLink) })).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: new RegExp(en.actions.transfer) }),
  ).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('characters-actions.png') });

  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: new RegExp(`^${en.actions.export}`) }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('Golden B.json');
  const path = await file.path();
  const { readFile } = await import('node:fs/promises');
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(goldenB);
  await expect(dialog).toHaveCount(0);

  await more.click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${en.actions.delete}`) })
    .click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText(en.characters.empty)).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Golden B deleted');
  await page.screenshot({ path: testInfo.outputPath('characters-deleted.png') });
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('Golden B');
  await cards(page).first().click();
  await expect(page).toHaveURL(`characters/${goldenB.id}`);
});
