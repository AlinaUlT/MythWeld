import { expect, type Page, test } from '@playwright/test';
import { APP_BASE_PATH, APP_NAME } from '../src/config/app';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// Every page but the start page: its path, its title, and where its back arrow goes.
const pages = [
  { path: 'player', title: en.player.title, back: '' },
  { path: 'characters', title: en.characters.title, back: 'player' },
  { path: 'characters/new', title: en.create.title, back: 'characters' },
  { path: 'characters/golden-b', title: en.sheet.title, back: 'characters' },
  { path: 'dice', title: en.dice.title, back: 'player' },
  { path: 'settings', title: en.settings.title, back: '' },
];

const back = (page: Page) => page.getByRole('link', { name: en.common.back });
const gear = (page: Page) => page.getByRole('link', { name: en.common.settings });

async function expectControlSize(page: Page, name: string) {
  const box = await page.getByRole('main').getByLabel(name).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
}

test('SHEET-11 the start page shows Player and DM, and no bottom bar', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await expect(page).toHaveURL(APP_BASE_PATH);
  await expect(page.locator('html')).toHaveClass('dark');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
  await expect(page.getByText(en.start.system)).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(back(page)).toHaveCount(0);
  await expectControlSize(page, en.common.settings);

  const player = page.getByRole('link', { name: en.start.player.title });
  await expect(player).toHaveAttribute('href', `${APP_BASE_PATH}player`);
  await expect(player).toContainText(en.start.player.hint);
  // The DM side is shown as coming later, and opens nothing.
  await expect(page.getByText(en.start.dm.title, { exact: true })).toBeVisible();
  await expect(page.getByText(en.common.comingLater)).toBeVisible();
  await expect(page.getByRole('link')).toHaveCount(2);

  // Nothing is wider than the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('start-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('start-light.png') });

  // The start page shows on every start (ADR 008 "Still open").
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
});

test('SHEET-11 Player opens the player page, and its back arrow returns', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await page.getByRole('link', { name: en.start.player.title }).tap();
  await expect(page).toHaveURL('player');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.player.title);
  await expectControlSize(page, en.common.back);
  await expectControlSize(page, en.common.settings);
  await page.screenshot({ path: testInfo.outputPath('player.png') });
  await back(page).tap();
  await expect(page).toHaveURL(APP_BASE_PATH);
});

test('SHEET-11 every screen has its route, its title and a back arrow', async ({ page }) => {
  for (const { path, title, back: to } of pages) {
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(back(page)).toHaveAttribute('href', `${APP_BASE_PATH}${to}`);
    await expectControlSize(page, en.common.back);
  }
});

test('SHEET-11 the gear opens Settings, whose back arrow returns where it came from', async ({
  page,
}, testInfo) => {
  await page.goto('player');
  await gear(page).tap();
  await expect(page).toHaveURL('settings');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.settings.title);
  await page.screenshot({ path: testInfo.outputPath('settings.png') });
  await page.getByRole('button', { name: en.common.back }).tap();
  await expect(page).toHaveURL('player');
});

test('SHEET-11 an unknown path opens the start page', async ({ page }) => {
  await page.goto('no-such-page');
  await expect(page).toHaveURL(APP_BASE_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
});

/** Puts rows into the characters table without Dexie; the page counts any row. */
function putCharacters({ name, ids }: { name: string; ids: string[] }) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const opened = request.result;
      const transaction = opened.transaction('characters', 'readwrite');
      for (const id of ids) transaction.objectStore('characters').put({ id, name: id });
      transaction.oncomplete = () => {
        opened.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

test('SHEET-12 the player page shows its six sections', async ({ page }, testInfo) => {
  await page.goto('player');
  const main = page.getByRole('main');
  const titles = [
    en.player.characters.title,
    en.player.sources.title,
    en.player.library.title,
    en.player.dice.title,
    en.player.quickRules.title,
    en.player.bookmarks.title,
  ];
  for (const title of titles) {
    const tile = main.getByText(title, { exact: true });
    await expect(tile).toBeVisible();
    expect((await tile.locator('..').boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  // Characters and Dice roll open (SHEET-38); the other four are coming later.
  await expect(page.getByRole('link')).toHaveCount(4);
  await expect(main.getByText(en.common.comingLater)).toHaveCount(4);
  await expect(page.getByRole('link', { name: en.player.dice.title })).toHaveAttribute(
    'href',
    `${APP_BASE_PATH}dice`,
  );
  const characters = page.getByRole('link', { name: en.player.characters.title });
  await expect(characters).toHaveAttribute('href', `${APP_BASE_PATH}characters`);
  await expect(characters).toContainText('No characters yet');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  await page.evaluate(putCharacters, { name: DB_NAME, ids: ['first', 'second'] });
  await page.reload();
  await expect(characters).toContainText('2 characters');
  await page.screenshot({ path: testInfo.outputPath('player-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('player-light.png') });

  await characters.tap();
  await expect(page).toHaveURL('characters');
});
