import { expect, type Page, test } from '@playwright/test';
import { en } from '../src/i18n/namespaces';

const d = en.dice;

// The rows of one IndexedDB store, as the app left them.
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

/** The last roll's faces, and which are kept. */
const faces = (page: Page) =>
  page
    .locator('[data-face]')
    .evaluateAll((spans) =>
      spans.map((span) => [Number(span.getAttribute('data-face')), span.dataset.kept === 'true']),
    );

const total = (page: Page) => page.getByTestId('dice-total').textContent().then(Number);

const formula = (page: Page) => page.getByRole('textbox', { name: d.formula });
const rollButton = (page: Page) => page.getByRole('button', { name: /^(Roll|Count) / });

test('SHEET-38 the dice page rolls any count, any formula, and custom dice', async ({
  page,
}, testInfo) => {
  await page.goto('player');
  await page.getByRole('link', { name: /Dice roll/ }).click();
  await expect(page).toHaveURL(/\/dice$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.title);
  await expect(page.getByText(d.noRolls)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('dice-empty.png') });

  // The picker builds 37d6 + 3.
  await page.getByRole('button', { name: 'd6', exact: true }).click();
  await page.getByRole('spinbutton', { name: d.howMany }).fill('37');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: d.modifierUp }).click();
  await expect(formula(page)).toHaveValue('37d6 + 3');
  await expect(rollButton(page)).toHaveText('Roll 37d6 + 3');

  await rollButton(page).click();
  const rolled = await faces(page);
  expect(rolled).toHaveLength(37);
  for (const [face, kept] of rolled) {
    expect(face).toBeGreaterThanOrEqual(1);
    expect(face).toBeLessThanOrEqual(6);
    expect(kept).toBe(true);
  }
  expect(await total(page)).toBe(rolled.reduce((sum, [face]) => sum + Number(face), 0) + 3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('dice-37d6.png'), fullPage: true });

  // Any formula, in d or к; a dropped die is shown as not kept.
  await formula(page).fill('2к20kh1 + 1');
  await expect(rollButton(page)).toHaveText('Roll 2к20kh1 + 1');
  await rollButton(page).click();
  const kept = await faces(page);
  expect(kept.map(([, k]) => k).sort()).toEqual([false, true]);
  const best = Math.max(...kept.map(([face]) => Number(face)));
  expect(await total(page)).toBe(best + 1);
  await expect(page.getByRole('heading', { name: d.history })).toBeVisible();
  await expect(page.getByText('37d6 + 3', { exact: true })).toBeVisible();

  // Both rolls are in the log, made off a sheet.
  const log = await storedRows(page, 'rollLog');
  expect(log).toHaveLength(2);
  for (const row of log) expect(row).not.toHaveProperty('characterId');

  // A formula that does not parse says why, and does not roll.
  await formula(page).fill('2d');
  await expect(formula(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/does not read as a formula/)).toBeVisible();
  await expect(rollButton(page)).toBeDisabled();

  // A custom d7 is kept on the device.
  await page.getByRole('button', { name: d.edit }).click();
  await page.getByRole('spinbutton', { name: d.newFaces }).fill('7');
  await page.getByRole('button', { name: d.addDie }).click();
  await expect(page.getByRole('button', { name: 'd7', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: d.newFaces }).fill('6');
  await expect(page.getByRole('button', { name: d.addDie })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('dice-edit.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: 'd7', exact: true }).click();
  await expect(formula(page)).toHaveValue('1d7');
  await page.getByRole('button', { name: d.edit }).click();
  await page.getByRole('button', { name: 'Remove d7' }).click();
  await expect(page.getByRole('button', { name: 'd7', exact: true })).toHaveCount(0);
  await expect(page.getByText(d.noCustom)).toBeVisible();
});

test('SHEET-38 "I roll myself" counts the faces typed', async ({ page }, testInfo) => {
  await page.goto('settings');
  await page.getByText(en.settings.dice.rollMyself, { exact: true }).tap();
  await page.getByText(en.settings.theme.light, { exact: true }).tap();
  // Both choices are stored before the page is opened again.
  await expect.poll(async () => (await storedRows(page, 'settings')).length).toBe(2);
  await page.goto('dice');
  await formula(page).fill('1d20 + 2');
  await expect(rollButton(page)).toHaveText('Count 1d20 + 2');
  await expect(rollButton(page)).toBeDisabled();
  const die = page.getByRole('spinbutton', { name: '1d20, die 1' });
  await die.fill('21');
  await expect(rollButton(page)).toBeDisabled();
  await die.fill('14');
  await expect(rollButton(page)).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('dice-typed-light.png'), fullPage: true });
  await rollButton(page).click();
  expect(await faces(page)).toEqual([[14, true]]);
  expect(await total(page)).toBe(16);
  expect(await storedRows(page, 'rollLog')).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath('dice-typed-rolled-light.png') });
});
