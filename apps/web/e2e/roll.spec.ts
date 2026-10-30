import { expect, type Page, test } from '@playwright/test';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-39: a tap on a number of the sheet opens the roll dialog. Golden B (2024 fighter 1) has
// initiative +3; golden A (2014 hill dwarf cleric 1) has a spell attack of +5 (SPEC §6.7).

const r = en.roll;

/** Waits for the app to make its database, then puts the rows into one of its tables. */
async function saveRows(page: Page, store: string, rows: readonly object[]) {
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual({ name: DB_NAME, version: 20 });
  await page.evaluate(
    ([name, table, toSave]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(table, 'readwrite');
          for (const row of toSave) transaction.objectStore(table).put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    [DB_NAME, store, rows] as const,
  );
}

/** The rows of one IndexedDB store, as the app left them. */
const storedRows = (page: Page, store: string) =>
  page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((done, fail) => {
        const open = indexedDB.open('grimoire');
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const read = open.result.transaction(name).objectStore(name).getAll();
          read.onsuccess = () => {
            open.result.close();
            done(read.result);
          };
        };
      }),
    store,
  );

/** The result card's faces, and which are kept. */
const faces = (page: Page) =>
  page
    .locator('[role="dialog"] [data-face]')
    .evaluateAll((spans) =>
      spans.map((span) => [Number(span.getAttribute('data-face')), span.dataset.kept === 'true']),
    );

const total = (page: Page) => page.getByTestId('roll-total').textContent().then(Number);
const dialog = (page: Page) => page.getByRole('dialog');
const rollButton = (page: Page) => dialog(page).getByRole('button', { name: /^Roll( again)?$/ });

test('SHEET-39 a tap on initiative rolls a d20 with its bonus, and the roll is logged', async ({
  page,
}, testInfo) => {
  await saveRows(page, 'characters', [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await page.locator('[data-path="init.total"]').tap();

  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading', { name: r.titles.init })).toBeVisible();
  await expect(page.getByTestId('roll-formula')).toHaveText('d20 + 3');
  await expect(page.getByTestId('roll-total')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('roll-init-dark.png') });

  await rollButton(page).tap();
  const one = await faces(page);
  expect(one).toHaveLength(1);
  const first = one[0];
  expect(first?.[0]).toBeGreaterThanOrEqual(1);
  expect(first?.[0]).toBeLessThanOrEqual(20);
  expect(await total(page)).toBe(Number(first?.[0]) + 3);

  // Advantage: two d20, the higher kept, the lower struck.
  const advantage = dialog(page).getByRole('button', { name: r.mode.advantage, exact: true });
  await advantage.tap();
  await expect(advantage).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('roll-formula')).toHaveText('2d20, the higher + 3');
  await rollButton(page).tap();
  const two = await faces(page);
  expect(two).toHaveLength(2);
  expect(two.map(([, kept]) => kept).sort()).toEqual([false, true]);
  const best = Math.max(...two.map(([face]) => Number(face)));
  expect(await total(page)).toBe(best + 3);
  await page.screenshot({ path: testInfo.outputPath('roll-advantage-dark.png') });

  // The person's two switches replace each other; a second tap turns the switch off.
  const disadvantage = dialog(page).getByRole('button', { name: r.mode.disadvantage });
  await disadvantage.tap();
  await expect(advantage).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('roll-formula')).toHaveText('2d20, the lower + 3');
  await disadvantage.tap();
  await expect(page.getByTestId('roll-formula')).toHaveText('d20 + 3');

  // Each roll is in the log with the character as its roller and the number it rolled.
  const log = await storedRows(page, 'rollLog');
  expect(log).toHaveLength(2);
  for (const row of log) {
    expect(row).toMatchObject({
      characterId: goldenB.id,
      record: { label: r.titles.init, path: 'init.total', by: { actorId: goldenB.id } },
    });
  }

  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('roll-light.png') });

  await dialog(page).getByRole('button', { name: r.close }).tap();
  await expect(dialog(page)).toHaveCount(0);
  await page.locator('[data-path="init.total"]').tap();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);

  // A number that does not roll opens nothing on a tap.
  await page.locator('[data-path="ac.total"]').tap();
  await expect(dialog(page)).toHaveCount(0);
});

test('SHEET-39 a spell attack counts the faces typed with "I roll myself", a natural 20 is critical', async ({
  page,
}, testInfo) => {
  await saveRows(page, 'characters', [goldenA]);
  await saveRows(page, 'settings', [{ key: 'rollMyself', value: true }]);
  await page.goto(`characters/${goldenA.id}`);
  await page.locator('[data-path="classes.cleric.spell.attack"]').tap();

  await expect(dialog(page).getByRole('heading', { name: 'Cleric spell attack' })).toBeVisible();
  await expect(page.getByTestId('roll-formula')).toHaveText('d20 + 5');
  // The roll asks for the faces first; "Count" counts them.
  await rollButton(page).tap();
  const count = dialog(page).getByRole('button', { name: r.count });
  await expect(count).toBeDisabled();
  const die = dialog(page).getByRole('spinbutton', { name: '1d20, die 1' });
  await die.fill('21');
  await expect(count).toBeDisabled();
  await die.fill('20');
  await expect(count).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('roll-typed-dark.png') });
  await count.tap();

  expect(await faces(page)).toEqual([[20, true]]);
  expect(await total(page)).toBe(25);
  await expect(page.getByTestId('roll-outcome')).toHaveText(r.outcome.criticalHit);

  // A natural 1 misses whatever the total.
  await dialog(page).getByRole('button', { name: r.rollAgain }).tap();
  await dialog(page).getByRole('spinbutton', { name: '1d20, die 1' }).fill('1');
  await dialog(page).getByRole('button', { name: r.count }).tap();
  expect(await total(page)).toBe(6);
  await expect(page.getByTestId('roll-outcome')).toHaveText(r.outcome.automaticMiss);
  expect(await storedRows(page, 'rollLog')).toHaveLength(2);
});
