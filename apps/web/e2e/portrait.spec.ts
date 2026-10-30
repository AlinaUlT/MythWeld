import { expect, type Page, test } from '@playwright/test';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-56: a person's picture becomes the header's round token. A two-frame GIF is the
// animated picture; a video is a file of that type (the page draws a `<video>` for it whether or
// not this browser can decode the bytes, so its attributes are what is checked).

const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAP8AAAAA/yH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAQABAAACAkQBACH5BAAKAAAALAAAAAABAAEAAAICTAEAOw==',
  'base64',
);

/** Waits for the app to make its database, then puts golden B into its `characters` table. */
async function saveGoldenB(page: Page) {
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual({ name: DB_NAME, version: 20 });
  await page.evaluate(
    ([name, row]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('characters', 'readwrite');
          transaction.objectStore('characters').put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    [DB_NAME, goldenB] as const,
  );
}

/** How many files the app's `blobs` table holds. */
const blobCount = (page: Page) =>
  page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const count = database.transaction('blobs').objectStore('blobs').count();
          count.onsuccess = () => {
            database.close();
            resolve(count.result);
          };
        };
      }),
    DB_NAME,
  );

/** The media type of the file behind the header token's picture. */
const typeOfToken = (page: Page) =>
  page.evaluate(async () => {
    const img = document.querySelector('[data-skin-slot="token-frame-ring"] img');
    if (!(img instanceof HTMLImageElement)) return undefined;
    return (await (await fetch(img.src)).blob()).type;
  });

test('SHEET-56 a picked picture is kept on the device and becomes the round token', async ({
  page,
}, testInfo) => {
  await saveGoldenB(page);
  await page.goto(`characters/${goldenB.id}`);
  const token = page.getByRole('button', { name: en.token.open });
  await expect(token).toContainText('G');
  expect(await blobCount(page)).toBe(0);

  // The panel: the board's text, its button waiting for a file.
  await token.click();
  const panel = page.getByRole('region', { name: en.token.title });
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Portrait');
  await expect(panel).toContainText('Choose an image of Golden B');
  await expect(panel).toContainText(en.token.stays);
  const use = panel.getByRole('button', { name: en.token.use });
  await expect(use).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('panel-empty.png') });

  // Back closes the panel and stays on the sheet.
  await panel.getByRole('button', { name: en.common.back }).click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`characters/${goldenB.id}`));
  await token.click();

  // A file that is no picture is said and not kept.
  const input = panel.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('x'),
  });
  await expect(panel.getByRole('alert')).toHaveText(en.token.notMedia);
  await expect(use).toBeDisabled();

  // The animated picture: chosen, previewed, used.
  await input.setInputFiles({ name: 'iren.gif', mimeType: 'image/gif', buffer: GIF });
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.locator('img')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('panel-chosen.png') });
  await use.click();
  await expect(panel).toHaveCount(0);
  expect(await blobCount(page)).toBe(1);

  // The token is the picture, cut round, in the ring frame; the letter is gone.
  const face = page.locator('[data-skin-slot="token-frame-ring"] [data-skin-slot="portrait"]');
  await expect(face.locator('img')).toHaveCount(1);
  await expect(token).not.toContainText('G');
  const radius = await face.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderRadius));
  expect(radius).toBeGreaterThanOrEqual(21);
  await expect(face).toHaveCSS('overflow', 'hidden');
  const box = await face.boundingBox();
  expect(box?.width).toBe(box?.height);
  expect(await typeOfToken(page)).toBe('image/gif');
  await page.screenshot({ path: testInfo.outputPath('sheet-token.png') });

  // Motion stopped: the same picture stands still as its first frame; motion back: it plays.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => typeOfToken(page)).toBe('image/png');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => typeOfToken(page)).toBe('image/gif');

  // It is still there after a reload, read from the device.
  await page.reload();
  await expect(page.locator('[data-skin-slot="token-frame-ring"] img')).toHaveCount(1);
  expect(await typeOfToken(page)).toBe('image/gif');
});

test('SHEET-56 a video plays muted in a loop, and shows one frame while motion is stopped', async ({
  page,
}) => {
  await saveGoldenB(page);
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('button', { name: en.token.open }).click();
  const panel = page.getByRole('region', { name: en.token.title });
  await panel
    .locator('input[type="file"]')
    .setInputFiles({ name: 'iren.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not decoded') });
  await panel.getByRole('button', { name: en.token.use }).click();

  const video = page.locator('[data-skin-slot="token-frame-ring"] video');
  await expect(video).toHaveCount(1);
  await expect(video).toHaveJSProperty('muted', true);
  await expect(video).toHaveJSProperty('loop', true);
  await expect(video).toHaveJSProperty('autoplay', true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(video).toHaveJSProperty('loop', false);
  await expect(video).toHaveJSProperty('autoplay', false);
});

test('SHEET-56 removing the portrait brings back the letter and drops the file', async ({
  page,
}) => {
  await saveGoldenB(page);
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('button', { name: en.token.open }).click();
  const panel = page.getByRole('region', { name: en.token.title });
  await expect(panel.getByRole('button', { name: en.token.remove })).toHaveCount(0);
  await panel
    .locator('input[type="file"]')
    .setInputFiles({ name: 'iren.gif', mimeType: 'image/gif', buffer: GIF });
  await panel.getByRole('button', { name: en.token.use }).click();
  expect(await blobCount(page)).toBe(1);

  await page.getByRole('button', { name: en.token.open }).click();
  await page
    .getByRole('region', { name: en.token.title })
    .getByRole('button', { name: en.token.remove })
    .click();
  await expect(page.getByRole('button', { name: en.token.open })).toContainText('G');
  expect(await blobCount(page)).toBe(0);
});
