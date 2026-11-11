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

// The tables phases 2 and 3 store into, as the browser lists them (sorted by name).
const TABLES = [
  'blobs',
  'bookmarks',
  'characters',
  'entityIndex',
  'history',
  'packs',
  'rollLog',
  'settings',
];

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

test('CONT-02 the app opens the database at version 3 with the tables of phases 2 and 3', async ({
  page,
}) => {
  await page.goto('./');
  // Dexie stores its version 3 as IndexedDB version 30.
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual({ name: DB_NAME, version: 30 });
  expect(await page.evaluate(readDatabase, DB_NAME)).toEqual({ version: 30, tables: TABLES });
});

test('SHEET-07 a version 1 database from an earlier start upgrades to the current version', async ({
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
    .toEqual({ version: 30, tables: TABLES });
});

test('CONT-02 a version 2 database keeps its rows when it upgrades to version 3', async ({
  page,
}) => {
  await page.route('**/blank', (route) => route.fulfill({ contentType: 'text/html', body: '' }));
  await page.goto('./blank');
  // The database as phase 2 left it (Dexie's version 2 is IndexedDB's 20), with one character.
  await page.evaluate(
    (name) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, 20);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const made = request.result;
          for (const [store, key] of [
            ['characters', 'id'],
            ['packs', 'id'],
            ['settings', 'key'],
            ['rollLog', 'id'],
            ['history', 'id'],
            ['blobs', 'id'],
          ] as const) {
            made.createObjectStore(store, { keyPath: key });
          }
          request.transaction?.objectStore('characters').put({ id: 'kept', name: 'Kept' });
        };
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      }),
    DB_NAME,
  );

  await page.goto('./');
  await expect
    .poll(() => page.evaluate(readDatabase, DB_NAME))
    .toEqual({ version: 30, tables: TABLES });
  const kept = await page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const opened = request.result;
          const all = opened.transaction('characters').objectStore('characters').getAll();
          all.onsuccess = () => {
            opened.close();
            resolve(all.result);
          };
        };
      }),
    DB_NAME,
  );
  expect(kept).toEqual([{ id: 'kept', name: 'Kept' }]);
});
