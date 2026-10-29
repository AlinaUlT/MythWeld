import { expect, type Page, test } from '@playwright/test';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-39: a tap on a number of the sheet opens the roll dialog. Golden B (2024) is a human
// fighter 1 with initiative +3; golden A (2014) a hill dwarf cleric 1 with a spell attack of +5.
// The sums are SPEC §6.7's, worked out by hand; the faces are the die's, so each is checked to
// be a face, and the total to be the kept face plus the number.

const r = en.roll;

/** The rows of one IndexedDB store, as the app left them. */
const storedRows = (page: Page, store: string) =>
  page.evaluate(
    ([name, table]) =>
      new Promise<Record<string, unknown>[]>((done, fail) => {
        const open = indexedDB.open(name);
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const read = open.result.transaction(table).objectStore(table).getAll();
          read.onsuccess = () => {
            open.result.close();
            done(read.result);
          };
        };
      }),
    [DB_NAME, store] as const,
  );

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

const dialog = (page: Page) => page.getByRole('dialog');
const total = (page: Page) => dialog(page).getByTestId('roll-total').textContent().then(Number);
const faces = (page: Page): Promise<[number, boolean][]> =>
  dialog(page)
    .locator('[data-face]')
    .evaluateAll((spans) =>
      spans.map((span): [number, boolean] => [
        Number(span.getAttribute('data-face')),
        (span as HTMLElement).dataset.kept === 'true',
      ]),
    );

test('SHEET-39 a tap on initiative rolls d20 + 3, and advantage rolls two d20', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await page.locator('[data-path="init.total"]').tap();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading', { name: 'Initiative' })).toBeVisible();
  await expect(dialog(page).getByTestId('roll-formula')).toHaveText('1d20 + 3');
  // Nothing is rolled until the person says so, after the choices.
  await expect(dialog(page).getByTestId('roll-total')).toHaveCount(0);
  expect(await storedRows(page, 'rollLog')).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('roll-before.png') });

  await dialog(page).getByRole('button', { name: r.roll, exact: true }).tap();
  const [face = 0, kept = false] = (await faces(page))[0] ?? [];
  expect(kept).toBe(true);
  expect(face).toBeGreaterThanOrEqual(1);
  expect(face).toBeLessThanOrEqual(20);
  expect(await total(page)).toBe(face + 3);
  await expect(dialog(page).getByRole('button', { name: r.rollAgain })).toBeVisible();
  await expect.poll(async () => (await storedRows(page, 'rollLog')).length).toBe(1);
  const [row] = await storedRows(page, 'rollLog');
  expect(row).toMatchObject({ characterId: goldenB.id });

  // Advantage rolls two d20 and keeps the higher; the next roll is logged too.
  await dialog(page).getByRole('button', { name: r.advantage, exact: true }).tap();
  await expect(dialog(page).getByTestId('roll-formula')).toHaveText('2d20kh1 + 3');
  await expect(dialog(page).getByText('Rolling with advantage.')).toBeVisible();
  await dialog(page).getByRole('button', { name: r.rollAgain }).tap();
  const two = await faces(page);
  expect(two).toHaveLength(2);
  const high = Math.max(...two.map(([each]) => each ?? 0));
  expect(two.filter(([, keptFace]) => keptFace)).toHaveLength(1);
  expect(await total(page)).toBe(high + 3);
  await expect.poll(async () => (await storedRows(page, 'rollLog')).length).toBe(2);

  // With both switches on they cancel.
  await dialog(page).getByRole('button', { name: r.disadvantage, exact: true }).tap();
  await expect(dialog(page).getByTestId('roll-formula')).toHaveText('1d20 + 3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('roll-after.png') });

  await dialog(page).getByRole('button', { name: r.done }).tap();
  await expect(dialog(page)).toHaveCount(0);
});

test('SHEET-39 a caster rolls the spell attack, and Escape closes the dialog', async ({ page }) => {
  await saveRows(page, [goldenA]);
  await page.goto(`characters/${goldenA.id}`);
  await page.locator('[data-path="classes.cleric.spell.attack"]').tap();
  await expect(dialog(page).getByRole('heading', { name: 'Spell attack' })).toBeVisible();
  await expect(dialog(page).getByTestId('roll-formula')).toHaveText('1d20 + 5');
  // Golden A holds no inspiration, so none is offered.
  await expect(dialog(page).getByText('Spend inspiration', { exact: false })).toHaveCount(0);
  await dialog(page).getByRole('button', { name: r.roll, exact: true }).tap();
  const [face = 0] = (await faces(page))[0] ?? [];
  expect(await total(page)).toBe(face + 5);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});

test('SHEET-39 2014 inspiration is spent when it gives the roll advantage', async ({
  page,
}, testInfo) => {
  const inspired = {
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: { ...goldenA.systemData.state, inspiration: 1 },
    },
  };
  await saveRows(page, [inspired]);
  await page.goto(`characters/${goldenA.id}`);
  await page.locator('[data-path="init.total"]').tap();
  const spend = dialog(page).getByRole('button', { name: /Spend inspiration for advantage/ });
  await spend.tap();
  await expect(spend).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog(page).getByTestId('roll-formula')).toHaveText(/^2d20kh1 \+ /);
  await dialog(page).getByRole('button', { name: r.roll, exact: true }).tap();
  expect(await faces(page)).toHaveLength(2);
  // It is spent once: the character holds none, the toast says so, and the chip is gone.
  await expect(dialog(page).getByRole('button', { name: /Spend inspiration/ })).toHaveCount(0);
  await expect
    .poll(async () => {
      const [row] = await storedRows(page, 'characters');
      const state = (row as { systemData?: { state?: { inspiration?: number } } }).systemData
        ?.state;
      return state?.inspiration;
    })
    .toBe(0);
  await expect(
    page.getByRole('status').filter({ hasText: en.toast.done.spendInspiration }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('roll-inspiration.png') });
});

test('SHEET-39 "I roll myself" counts the faces typed for the d20', async ({ page }, testInfo) => {
  await page.goto('settings');
  await page.getByText(en.settings.dice.rollMyself, { exact: true }).tap();
  await expect.poll(async () => (await storedRows(page, 'settings')).length).toBe(1);
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await page.locator('[data-path="init.total"]').tap();
  const count = dialog(page).getByRole('button', { name: r.count, exact: true });
  await expect(count).toBeDisabled();
  await dialog(page).getByRole('spinbutton', { name: '1d20, die 1' }).fill('14');
  await count.tap();
  expect(await faces(page)).toEqual([[14, true]]);
  expect(await total(page)).toBe(17);
  await page.screenshot({ path: testInfo.outputPath('roll-typed.png') });
});

test('SHEET-39 a number that does not roll says so', async ({ page }) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  // The armor class is read, not rolled: a tap does nothing, and the dialog never opens.
  await page.locator('[data-path="ac.total"]').tap();
  await expect(dialog(page)).toHaveCount(0);
});
