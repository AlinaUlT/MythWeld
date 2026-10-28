import { expect, test } from '@playwright/test';
import { DB_NAME } from '../src/db/db';

type Spied = Window & { storageCalls: string[] };

test('SETUP-06 the database opens and persistent storage is asked for', async ({ page }) => {
  // Record the Storage API calls the app makes; the browser still gives its real answers.
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as Spied).storageCalls = calls;
    const proto = StorageManager.prototype;
    const { persist, persisted } = proto;
    proto.persist = function () {
      calls.push('persist');
      return persist.call(this);
    };
    proto.persisted = function () {
      calls.push('persisted');
      return persisted.call(this);
    };
  });
  await page.goto('./');

  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual(expect.objectContaining({ name: DB_NAME }));
  // Headless Chromium says "not persistent" at first, so the app goes on to ask.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Spied).storageCalls))
    .toEqual(['persisted', 'persist']);
});

// The tables phase 2 stores into, as the browser lists them (sorted by name).
const PHASE_2_TABLES = ['blobs', 'characters', 'history', 'packs', 'rollLog', 'settings'];

/** The database's IndexedDB version and its tables, read without Dexie. */
function readDatabase(name: string) {
  return new Promise<{ version: number; tables: string[] }>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const opened = request.result;
      resolve({ version: opened.version, tables: [...opened.objectStoreNames] });
      opened.close();
    };
  });
}

test('SHEET-07 the app opens the database at version 2 with the phase 2 tables', async ({
  page,
}) => {
  await page.goto('./');
  // Dexie stores its version 2 as IndexedDB version 20.
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual({ name: DB_NAME, version: 20 });
  expect(await page.evaluate(readDatabase, DB_NAME)).toEqual({
    version: 20,
    tables: PHASE_2_TABLES,
  });
});

test('SHEET-07 a version 1 database from an earlier start upgrades to version 2', async ({
  page,
}) => {
  // A blank page of the app's origin leaves the database alone while version 1 is made.
  await page.route('**/blank', (route) => route.fulfill({ contentType: 'text/html', body: '' }));
  await page.goto('./blank');
  await page.evaluate(
    (name) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, 10);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      }),
    DB_NAME,
  );
  expect(await page.evaluate(readDatabase, DB_NAME)).toEqual({ version: 10, tables: [] });

  await page.goto('./');
  await expect
    .poll(() => page.evaluate(readDatabase, DB_NAME))
    .toEqual({ version: 20, tables: PHASE_2_TABLES });
});
