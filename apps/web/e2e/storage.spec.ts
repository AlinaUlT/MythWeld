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
  await page.goto('/');

  // Dexie stores its version 1 as IndexedDB version 10.
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual({ name: DB_NAME, version: 10 });
  // Headless Chromium says "not persistent" at first, so the app goes on to ask.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Spied).storageCalls))
    .toEqual(['persisted', 'persist']);
});
