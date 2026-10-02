import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { waitForServiceWorker } from './service-worker';

// ENG-38: the pack's JSON Schema is a file of the site (SPEC §5.7), the committed one, also for a
// browser whose service worker the app already controls.
const committed = JSON.parse(
  readFileSync(new URL('../public/schema/5e/pack.schema.json', import.meta.url), 'utf8'),
);
const address = 'schema/5e/pack.schema.json';

test('ENG-38 the built app serves the fifth-edition pack schema', async ({ request }) => {
  const response = await request.get(address);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual(committed);
});

test('ENG-38 with the service worker in control, the address opens the file', async ({ page }) => {
  await page.goto('./');
  await waitForServiceWorker(page);
  const response = await page.goto(address);
  expect(response?.headers()['content-type']).toContain('application/json');
  expect(await response?.json()).toEqual(committed);
});
