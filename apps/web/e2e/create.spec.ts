import { expect, type Page, test } from '@playwright/test';
import { en } from '../src/i18n/namespaces';

// SHEET-27: the manual form in Chromium at 360×800. Golden B's inputs (SPEC §6.7: a human
// fighter 1 with the Soldier background and the standard array) are typed in; its picks and gear
// are not this form's, so the bar shows the SRD's unarmored numbers: AC 10 + Dex mod 1 = 11,
// hit points 10 + Con mod 2 = 12, initiative = Dex mod +1.

const c = en.create;

/** The pinned bar's three numbers, as text. */
async function barOf(page: Page) {
  return page.getByTestId('live-number').allTextContents();
}

test('SHEET-27 the empty form: 2024 rules, its pack, the live bar, Create on', async ({
  page,
}, testInfo) => {
  await page.goto('characters/new');
  await expect(page.getByRole('heading', { name: c.title })).toBeVisible();
  await expect(page.getByRole('radio', { name: '2024 rules' })).toBeChecked();
  await expect(page.getByRole('radio', { name: c.rules.systems['5e'] })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'SRD 5.2.1' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'SRD 5.1' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: c.rules.myPacks })).toBeDisabled();
  await expect(page.getByLabel(c.origin.species)).toBeVisible();
  await expect(page.getByLabel('Strength')).toHaveValue('10');
  // No class: 0 hit points; AC 10 + Dex mod 0; initiative 0.
  expect(await barOf(page)).toEqual(['10', '0', '0']);
  await expect(page.getByRole('button', { name: c.create })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('create-empty.png') });
});

test('SHEET-27 golden B typed in gives HP 12, AC 11, Init +1, and Create opens its sheet', async ({
  page,
}, testInfo) => {
  await page.goto('characters/new');
  await page.getByLabel(c.name.label).fill('Iren');
  await page.getByLabel(c.origin.species).selectOption({ label: 'Human' });
  await page.getByLabel(c.origin.background).selectOption({ label: 'Soldier' });
  await page.getByLabel(c.classes.first).selectOption({ label: 'Fighter' });
  const scores = { Strength: 15, Dexterity: 13, Constitution: 14, Intelligence: 8, Wisdom: 12 };
  for (const [stat, score] of Object.entries(scores)) {
    await page.getByLabel(stat, { exact: true }).fill(`${score}`);
  }
  expect(await barOf(page)).toEqual(['11', '12', '+1']);
  await expect(page.getByText('Character level 1 of 20')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('create-iren.png'), fullPage: true });

  // A level picked for the fighter raises the hit points: 12 + 3 × (6 + 2) = 36.
  await page.getByLabel(c.classes.level).selectOption('4');
  expect(await barOf(page)).toEqual(['11', '36', '+1']);
  await page.getByLabel(c.classes.level).selectOption('1');

  await page.getByRole('button', { name: c.create }).click();
  await expect(page).toHaveURL(/characters\/[0-9a-f-]{36}$/);
  await page.goto('characters');
  const card = page.getByRole('main').getByRole('link', { name: /Iren/ });
  await expect(card).toContainText('Human · Fighter 1');
  await expect(card).toContainText('2024');
});

test('SHEET-27 a mix that may not fit warns in amber and still creates', async ({
  page,
}, testInfo) => {
  await page.goto('characters/new');
  await page.getByRole('switch', { name: c.rules.mix }).check({ force: true });
  await page.getByRole('checkbox', { name: 'SRD 5.1' }).check();
  await page.getByLabel(c.origin.species).selectOption({ label: 'Dwarf · 2014' });
  await expect(
    page.getByText("From the 2014 rules, not this character's rules base. It may not fit."),
  ).toBeVisible();
  await page.getByLabel(c.classes.first).selectOption({ label: 'Wizard · 2014' });
  await page.getByLabel('Intelligence', { exact: true }).fill('abc');
  await expect(page.getByText('Not a whole number: Intelligence.', { exact: false })).toBeVisible();
  await page.getByLabel(c.origin.species).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('create-warning.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('create-warning-light.png') });

  await page.getByRole('button', { name: c.create }).click();
  await expect(page).toHaveURL(/characters\/[0-9a-f-]{36}$/);
});

test('SHEET-28 the equipment step adds items, counts them and warns for the other edition', async ({
  page,
}, testInfo) => {
  await page.goto('characters/new');
  await page.getByLabel(c.equipment.add).selectOption({ label: 'Chain Mail' });
  await page.getByLabel(c.equipment.add).selectOption({ label: 'Greatsword' });
  await page.getByLabel(c.equipment.add).selectOption({ label: 'Greatsword' });
  await expect(page.getByTestId('item-qty')).toHaveText(['1', '2']);
  await page.getByRole('button', { name: 'One less Greatsword' }).click();
  await expect(page.getByTestId('item-qty')).toHaveText(['1', '1']);
  await page.getByRole('button', { name: 'Remove Chain Mail' }).click();
  await expect(page.getByTestId('item-qty')).toHaveText(['1']);

  // Mixing on, a 2014 item: it shows its edition and warns.
  await page.getByRole('switch', { name: c.rules.mix }).check({ force: true });
  await page.getByRole('checkbox', { name: 'SRD 5.1' }).check();
  await page.getByLabel(c.equipment.add).selectOption({ label: 'Shield · 2014' });
  await expect(page.getByRole('listitem', { name: 'Shield' })).toContainText('Shield · 2014');
  await expect(
    page.getByText("From the 2014 rules, not this character's rules base. It may not fit."),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.getByLabel(c.equipment.add).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('create-equipment.png') });

  await page.getByRole('button', { name: c.create }).click();
  await expect(page).toHaveURL(/characters\/[0-9a-f-]{36}$/);
});

test('SHEET-29 two editions that both raise abilities: a warning, and a popup to tick one, both or neither', async ({
  page,
}, testInfo) => {
  await page.goto('characters/new');
  await page.getByRole('switch', { name: c.rules.mix }).check({ force: true });
  await page.getByRole('checkbox', { name: 'SRD 5.1' }).check();
  await page.getByLabel(c.name.label).fill('Mixed');
  await page.getByLabel(c.origin.species).selectOption({ label: 'Dwarf · 2014' });
  // One side only: no choice to make, no warning.
  await expect(page.getByTestId('bonus-conflict')).toHaveCount(0);
  await page.getByLabel(c.origin.background).selectOption({ label: 'Soldier · 2024' });
  await page.getByLabel(c.classes.first).selectOption({ label: 'Fighter · 2024' });
  await page.getByLabel('Constitution', { exact: true }).fill('14');

  // Both sides give increases: the warning, the 2024 rules base's source in use.
  const warning = page.getByTestId('bonus-conflict');
  await expect(warning).toContainText('Two sources raise your abilities');
  await expect(page.getByTestId('bonus-using')).toHaveText('Using: the background bonuses');
  // Hit points are the die's maximum 10 + the Constitution modifier: 14 gives +2.
  expect((await barOf(page))[1]).toBe('12');
  await warning.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('bonus-warning.png') });

  await warning.getByRole('button', { name: 'Choose' }).click();
  const popup = page.getByRole('dialog', { name: 'Two sources raise your abilities' });
  await expect(popup).toContainText(
    'The species and the background both give ability bonuses. Use:',
  );
  const species = popup.getByRole('checkbox', { name: /Species · Dwarf · 2014/ });
  const background = popup.getByRole('checkbox', { name: /Background · Soldier · 2024/ });
  await expect(species).not.toBeChecked();
  await expect(background).toBeChecked();
  await expect(popup).toContainText('CON +2');
  await expect(popup).toContainText('+2 +1 or +1 +1 +1 over STR, DEX, CON');
  await expect(popup).toContainText('In a campaign, the DM decides: one, or both.');

  // Both: the Dwarf's +2 Constitution counts, 16 gives +3; the note says each rules base expects one.
  await species.check();
  await expect(page.getByTestId('bonus-using')).toHaveText('Using: both');
  await expect(popup).toContainText(
    'Both are on. Each ruleset expects only one of them. You can keep both.',
  );
  expect((await barOf(page))[1]).toBe('13');
  await page.screenshot({ path: testInfo.outputPath('bonus-popup-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('bonus-popup-light.png') });

  // The species only: still 16.
  await background.uncheck();
  await expect(page.getByTestId('bonus-using')).toHaveText('Using: the species bonuses');
  expect((await barOf(page))[1]).toBe('13');
  // Neither: 14 again, and the note says so; the warning stays.
  await species.uncheck();
  await expect(page.getByTestId('bonus-using')).toHaveText('Using: neither');
  await expect(popup).toContainText('Neither is on. You can keep it that way.');
  expect((await barOf(page))[1]).toBe('12');
  await expect(warning).toBeVisible();

  // The species' bonuses, applied: Create stays on and the sheet keeps the pick.
  await species.check();
  await popup.getByRole('button', { name: 'Apply' }).click();
  await expect(popup).toHaveCount(0);
  await expect(warning).toBeVisible();
  await page.getByRole('button', { name: c.create }).click();
  await expect(page).toHaveURL(/characters\/[0-9a-f-]{36}$/);
  await expect(page.locator('[data-path="abilities.con.score"]')).toHaveText(
    'Constitution score16',
  );
});
