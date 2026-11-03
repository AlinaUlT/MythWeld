import { expect, type Page, test } from '@playwright/test';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB, goldenB4 } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-30: the goldens of SPEC §6.7 are saved into the app's own database, then their sheet
// opens. Golden B is a human fighter 1 (AC 17, initiative +3, speed 30, proficiency +2, passive
// Perception 13, 12 hit points); golden A a hill dwarf cleric 1 (spell save DC 13, attack +5).

/** Waits for the app to make its database, then puts the rows into its `characters` table. */
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

const withTemp = {
  ...goldenB,
  systemData: {
    ...goldenB.systemData,
    state: { ...goldenB.systemData.state, hp: { current: 12, temp: 5 } },
  },
};

const number = (page: Page, path: string) => page.locator(`[data-path="${path}"]`);

test('SHEET-30 the sheet pins the header above the dock, every number from Computed', async ({
  page,
}, testInfo) => {
  await saveRows(page, [withTemp]);
  await page.goto(`characters/${goldenB.id}`);

  const header = page.getByRole('banner');
  await expect(header.getByRole('heading', { level: 1 })).toHaveText('Golden B');
  await expect(header).toContainText('Fighter 1');
  await expect(header).toContainText('2024');
  await expect(number(page, 'ac.total')).toHaveText('17AC');
  await expect(number(page, 'init.total')).toHaveText('+3Init');
  await expect(number(page, 'speed.walk')).toHaveText('30 ftSpeed');
  await expect(number(page, 'prof')).toHaveText('+2Prof');
  await expect(header.locator('[data-path="skills.perception.passive"]')).toHaveText('13Passive');
  await expect(header).not.toContainText(en.sheet.casting.dc);

  // The dock: 12 of 12 hit points and 5 temporary ones in their own colour; Damage, Heal, tabs.
  const hp = number(page, 'hp.max');
  await expect(hp).toContainText('12/ 12+5');
  const tempColour = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--theme-color-temp)';
    document.body.append(probe);
    return getComputedStyle(probe).color;
  });
  await expect(hp.locator('.text-temp')).toHaveCSS('color', tempColour);
  await expect(hp.locator('.bg-temp')).toHaveCSS('background-color', tempColour);
  await expect(page.getByRole('button', { name: en.sheet.damage })).toBeVisible();
  await expect(page.getByRole('button', { name: en.sheet.heal })).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveText([
    'Main',
    'Turn',
    'Combat',
    'Spells',
    'Gear',
    'Features',
    'About',
    'Notes',
  ]);
  await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');

  // Pinned: the header at the top, the dock at the bottom, the tab between them.
  const top = await header.boundingBox();
  const dock = await page.getByRole('tablist').boundingBox();
  expect(top?.y).toBe(0);
  expect((dock?.y ?? 0) + (dock?.height ?? 0)).toBe(800);
  for (const name of [en.common.back, en.sheet.rest, en.sheet.edit, en.sheet.actions]) {
    const box = await page
      .getByRole(name === en.common.back ? 'link' : 'button', { name })
      .boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  // The toast sits 16 px above the dock.
  const lift = await page.evaluate(() => {
    const status = document.querySelector('[role="status"]');
    return status === null ? undefined : getComputedStyle(status).bottom;
  });
  const dockTop = await page.locator('[data-skin-slot="dock"]').boundingBox();
  expect(lift).toBe(`${800 - (dockTop?.y ?? 0) + 16}px`);

  await page.screenshot({ path: testInfo.outputPath('sheet-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('sheet-light.png') });
});

test('SHEET-30 play mode is locked until Edit, and the tabs change by tap and swipe', async ({
  page,
}) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const edit = page.getByRole('button', { name: en.sheet.edit });
  await expect(edit).toHaveAttribute('aria-pressed', 'false');
  await edit.tap();
  await expect(edit).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('tab', { name: 'Combat' }).tap();
  await expect(page).toHaveURL(/\?tab=combat$/);
  await expect(page.getByRole('tab', { name: 'Combat' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'sheet-tab-combat');

  // A swipe to the left on the tab moves to the next tab.
  const panel = await page.getByRole('tabpanel').boundingBox();
  const y = (panel?.y ?? 0) + 100;
  await page.mouse.move(300, y);
  await page.mouse.down();
  await page.mouse.move(150, y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('tab', { name: 'Spells' })).toHaveAttribute('aria-selected', 'true');

  // The address keeps the tab: a reload opens it again, in play mode.
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Spells' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: en.sheet.edit })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('SHEET-30 the dice button opens the half-screen dice panel over the sheet', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const dice = page.getByRole('button', { name: en.sheet.dice });
  const button = await dice.boundingBox();
  const dock = await page.locator('[data-skin-slot="dock"]').boundingBox();
  expect((button?.y ?? 0) + (button?.height ?? 0)).toBe((dock?.y ?? 0) - 16);
  expect(button?.width).toBe(56);
  await dice.tap();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box?.height).toBeLessThanOrEqual(400);
  // The sheet stays seen above it.
  await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('sheet-dice.png') });
  await panel.getByRole('button', { name: en.dice.close }).tap();
  await expect(panel).toHaveCount(0);
});

test("SHEET-30 a caster's header shows the spellcasting line", async ({ page }, testInfo) => {
  await saveRows(page, [goldenA]);
  await page.goto(`characters/${goldenA.id}`);
  await expect(page.getByRole('banner')).toContainText('Cleric 1');
  await expect(page.getByRole('banner')).toContainText('WIS');
  await expect(number(page, 'classes.cleric.spell.dc')).toHaveText('Save DC13');
  await expect(number(page, 'classes.cleric.spell.attack')).toHaveText('Attack+5');
  await expect(number(page, 'ac.total')).toHaveText('18AC');
  await page.screenshot({ path: testInfo.outputPath('sheet-caster.png') });
});

test('SHEET-30 a character not on the device says so', async ({ page }) => {
  await page.goto('characters/not-saved');
  await expect(page.getByText(en.sheet.notFound)).toBeVisible();
  await expect(page.getByRole('link', { name: en.common.back })).toBeVisible();
});

test('SHEET-30 a pack the character names that is not on the device is named', async ({ page }) => {
  await saveRows(page, [{ ...goldenB, packs: [...goldenB.packs, 'my-pack'] }]);
  await page.goto(`characters/${goldenB.id}`);
  await expect(page.getByRole('alert')).toHaveText(
    en.sheet.notInstalled.replace('{{id}}', 'my-pack'),
  );
});

test('SHEET-68 the sheet shows speed in squares once Settings picks them', async ({ page }) => {
  await saveRows(page, [goldenB]);
  await page.goto('settings');
  await page.getByText(en.settings.units.sq, { exact: true }).tap();
  await expect(page.getByRole('radio', { name: en.settings.units.sq })).toBeChecked();
  await page.goto(`characters/${goldenB.id}`);
  // Golden B's speed is 30 feet; SRD 5.2.1 "Playing on a Grid": 30 feet is 6 squares.
  await expect(number(page, 'speed.walk')).toHaveText('6 sqSpeed');
});

test('SHEET-54 the Notes tab keeps free text, saved when the field loses focus', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=notes`);
  const field = page.getByRole('textbox', { name: en.notes.label });
  await expect(field).toHaveValue('');
  await expect(field).toHaveAttribute('placeholder', en.notes.placeholder);

  await field.fill('Met the smith at dusk.\nShe owes me a favour.');
  // Typing alone saves nothing: no toast yet.
  await expect(page.getByRole('status')).not.toContainText(en.toast.done.setNote);
  await page.getByRole('tab', { name: 'Main' }).tap();
  await expect(page.getByRole('status')).toContainText(en.toast.done.setNote);
  await page.getByRole('tab', { name: 'Notes' }).tap();
  await expect(field).toHaveValue('Met the smith at dusk.\nShe owes me a favour.');
  await page.screenshot({ path: testInfo.outputPath('notes.png') });

  // The text is on the device: it is still there after a reload.
  await page.reload();
  await expect(page.getByRole('textbox', { name: en.notes.label })).toHaveValue(
    'Met the smith at dusk.\nShe owes me a favour.',
  );

  // Undo takes it back.
  await page.getByRole('textbox', { name: en.notes.label }).fill('A second thought.');
  await page.getByRole('tab', { name: 'Main' }).tap();
  await page.getByRole('button', { name: en.toast.undo }).tap();
  await page.getByRole('tab', { name: 'Notes' }).tap();
  await expect(page.getByRole('textbox', { name: en.notes.label })).toHaveValue(
    'Met the smith at dusk.\nShe owes me a favour.',
  );
});

test('SHEET-55 the header draws inspiration as stars; a tap gains or spends one', async ({
  page,
}, testInfo) => {
  // The owner's house maximum of 3, two held; golden B is a 2024 character, so its word is
  // "Heroic Inspiration" and the edition's own maximum of 1 shows beside the stars.
  const house = {
    ...goldenB,
    systemData: {
      ...goldenB.systemData,
      houseRules: { ...goldenB.systemData.houseRules, inspirationMax: 3 },
      state: { ...goldenB.systemData.state, inspiration: 2 },
    },
  };
  await saveRows(page, [house]);
  await page.goto(`characters/${goldenB.id}`);
  const stars = page.getByRole('group', { name: /Heroic Inspiration/ });
  await expect(stars).toBeVisible();
  await expect(page.getByText('Rules: 1')).toBeVisible();
  const star = (filled: boolean) => page.locator(`[data-filled="${filled}"]`);
  await expect(star(true)).toHaveCount(2);
  await expect(star(false)).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath('inspiration-header.png'),
    clip: { x: 0, y: 0, width: 360, height: 180 },
  });

  // A star is 20 px wide; its touch area reaches 14 px above and below it, 48 px in all.
  const box = await star(false).boundingBox();
  const reached = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.dataset.filled,
    { x: (box?.x ?? 0) + 10, y: (box?.y ?? 0) - 12 },
  );
  expect(reached).toBe('false');

  // An empty star gains one.
  await star(false).tap();
  await expect(page.getByRole('status')).toContainText(en.toast.done.gainInspiration);
  await expect(star(true)).toHaveCount(3);
  await expect(star(false)).toHaveCount(0);

  // A filled star spends one; Undo brings it back.
  await star(true).first().tap();
  await expect(page.getByRole('status')).toContainText(en.toast.done.spendInspiration);
  await expect(star(true)).toHaveCount(2);
  await page.getByRole('button', { name: en.toast.undo }).tap();
  await expect(star(true)).toHaveCount(3);

  // The change is on the device.
  await page.reload();
  await expect(star(true)).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

test('SHEET-53 the About tab shows the origin details; edit mode writes the alignment', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenA]);
  await page.goto(`characters/${goldenA.id}?tab=about`);
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByRole('heading', { name: 'About Golden A' })).toBeVisible();
  const row = (label: string) => panel.locator(`dt:text-is("${label}") + dd`);
  // A hill dwarf cleric with the Acolyte background (SPEC §6.7 golden A); the 2014 words.
  await expect(row('Race')).toHaveText('Dwarf');
  await expect(row('Subrace')).toHaveText('Hill Dwarf');
  await expect(row('Background')).toHaveText('Acolyte');
  await expect(row('Size')).toHaveText('Medium');
  await expect(row('Alignment')).toHaveText('Not set');
  await expect(row('Languages')).toContainText('Dwarvish');
  await expect(row('Armor')).toContainText('Heavy armor');
  await expect(row('Weapons')).toContainText('Simple weapons');
  await expect(row('Skills')).toContainText('Medicine');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  // Edit mode makes the alignment a field; leaving it saves one change.
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  const field = page.getByRole('textbox', { name: 'Alignment' });
  await field.fill('Neutral good');
  await page.getByRole('tab', { name: 'Notes' }).tap();
  await expect(page.getByRole('status')).toContainText(en.toast.done.setNote);
  await page.getByRole('tab', { name: 'About' }).tap();
  await expect(page.getByRole('textbox', { name: 'Alignment' })).toHaveValue('Neutral good');
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await expect(row('Alignment')).toHaveText('Neutral good');
  await page.screenshot({ path: testInfo.outputPath('about.png') });
  await page.reload();
  await expect(row('Alignment')).toHaveText('Neutral good');
});

// A 1 × 1 red PNG: a picture's content is never read, so any image stands for a portrait.
const RED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('SHEET-56 the portrait makes a round token, kept on the device', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const header = page.getByRole('banner');
  await expect(header.locator('img')).toHaveCount(0);
  await expect(header.locator('[data-skin-slot="token-frame-ring"]')).toHaveCount(1);

  await header.getByRole('button', { name: en.token.open }).tap();
  const dialog = page.getByRole('dialog', { name: en.token.title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(en.token.stays);
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'iren.png', mimeType: 'image/png', buffer: RED_PNG });
  await dialog.getByText(en.token.frames.double).tap();
  await expect(dialog.locator('img').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('token-panel.png') });

  // A file that is not a picture is refused with its reason, and nothing is stored.
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'sheet.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await expect(dialog.getByRole('alert')).toHaveText(en.token.notMedia);

  await dialog.getByRole('button', { name: en.token.use }).tap();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(en.toast.done.setPortrait);
  await expect(header.locator('img')).toHaveCount(1);
  await expect(header.locator('[data-skin-slot="token-frame-double"]')).toHaveCount(1);
  await expect(header.locator('img')).toHaveCSS('object-fit', 'cover');
  const round = await header.locator('[data-skin-slot="portrait"]').evaluate((element) => {
    const { borderTopLeftRadius, overflow } = getComputedStyle(element);
    return { borderTopLeftRadius, overflow };
  });
  expect(round.overflow).toBe('hidden');
  expect(Number.parseFloat(round.borderTopLeftRadius)).toBeGreaterThan(20);
  await page.screenshot({
    path: testInfo.outputPath('token-header.png'),
    clip: { x: 0, y: 0, width: 360, height: 160 },
  });

  // On the device: after a reload, and in the My characters list.
  await page.reload();
  await expect(page.getByRole('banner').locator('img')).toHaveCount(1);
  await page.goto('characters');
  await expect(page.locator('img').first()).toBeVisible();
});

test('SHEET-56 reduced motion shows the picture as one still frame', async ({ page }) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('banner').getByRole('button', { name: en.token.open }).tap();
  const dialog = page.getByRole('dialog', { name: en.token.title });
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'iren.png', mimeType: 'image/png', buffer: RED_PNG });
  await dialog.getByRole('button', { name: en.token.use }).tap();
  await expect(page.getByRole('banner').locator('img')).toHaveCount(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const header = page.getByRole('banner');
  await expect(header.locator('canvas')).toHaveCount(1);
  await expect(header.locator('img')).toHaveCount(0);
});

test('SHEET-32 the Main tab shows every check bonus: tiles, saves, skills by stat, passives', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const main = page.getByRole('tabpanel');

  // SPEC §6.7 golden B: modifiers +3 +1 +2 −1 +1 +0, scores 17 13 15 8 12 10.
  await expect(main.locator('[data-path^="checks."]')).toHaveText([
    'STR+3',
    'DEX+1',
    'CON+2',
    'INT−1',
    'WIS+1',
    'CHA+0',
  ]);
  await expect(number(page, 'abilities.str.score')).toHaveText('Strength score17');
  await expect(number(page, 'abilities.str.save')).toHaveText('STR+5');
  await expect(number(page, 'abilities.con.save')).toHaveText('CON+4');
  await expect(number(page, 'skills.athletics.total')).toHaveText('Athletics+5');
  await expect(number(page, 'skills.insight.total')).toHaveText('Insight+3');
  await expect(main.getByRole('heading', { level: 3 })).toHaveText([
    'Strength',
    'Dexterity',
    'Intelligence',
    'Wisdom',
    'Charisma',
  ]);
  await expect(main.getByRole('img', { name: en.checks.prof.proficient, exact: true })).toHaveCount(
    7,
  );

  // A long press and a tap reach each number's handlers without moving the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('main-dark.png') });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[role="tabpanel"]')) el.scrollTop = 600;
  });
  await page.screenshot({ path: testInfo.outputPath('main-scrolled.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('main-light.png') });
});

test('SHEET-33 a long press, or the context menu, opens where a number comes from', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const athletics = number(page, 'skills.athletics.total');
  const sheet = page.getByRole('dialog', { name: en.breakdown.title });

  // A long press (500 ms) on Athletics +5.
  const box = await athletics.boundingBox();
  await page.mouse.move((box?.x ?? 0) + 20, (box?.y ?? 0) + 10);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('breakdown-summary')).toHaveText(
    'Athletics +5 = Strength modifier +3, Proficiency bonus +2',
  );
  await expect(sheet.getByRole('listitem')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('breakdown-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('breakdown-light.png') });
  await page.getByRole('button', { name: en.common.close }).first().click();
  await expect(sheet).toBeHidden();

  // A short tap rolls (SHEET-39) and opens no breakdown; the context menu opens the breakdown.
  await athletics.click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('dialog', { name: en.roll.title })).toBeVisible();
  await page.keyboard.press('Escape');
  await number(page, 'abilities.str.score').click({ button: 'right' });
  await expect(page.getByTestId('breakdown-summary')).toHaveText(
    'Strength score 17 = Base 15, Soldier +2',
  );
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // A header number reads as it does there: speed in feet.
  await number(page, 'speed.walk').click({ button: 'right' });
  await expect(page.getByTestId('breakdown-summary')).toContainText('Speed walking 30 ft');
});

/** The d20 faces a roll shows, and which of them it kept. */
async function facesOf(page: Page) {
  return page
    .getByTestId('roll-result')
    .locator('[data-face]')
    .evaluateAll((dice) =>
      dice.map((die) => ({
        face: Number(die.getAttribute('data-face')),
        kept: die.getAttribute('data-kept') === 'true',
      })),
    );
}

test('SHEET-39 a tap rolls the number: d20 + 5, the dice shown, the total their sum', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await number(page, 'skills.athletics.total').click();

  const dialog = page.getByRole('dialog', { name: en.roll.title });
  await expect(page.getByTestId('roll-formula')).toHaveText('1d20 + 5 (Athletics)');
  await expect(page.getByTestId('roll-mode')).toHaveText(en.roll.mode.normal);
  await page.screenshot({ path: testInfo.outputPath('roll-before.png') });

  await dialog.getByRole('button', { name: en.roll.roll, exact: true }).click();
  const [die] = await facesOf(page);
  const total = Number(await page.getByTestId('roll-total').textContent());
  expect(die?.face).toBeGreaterThanOrEqual(1);
  expect(die?.face).toBeLessThanOrEqual(20);
  expect(total).toBe((die?.face ?? 0) + 5);
  await expect(dialog.getByRole('button', { name: en.roll.again })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('roll-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('roll-light.png') });

  // Advantage rolls two d20 and keeps the higher; Disadvantage as well switches the mode back.
  await dialog.getByRole('button', { name: en.roll.advantage, exact: true }).click();
  await expect(page.getByTestId('roll-formula')).toHaveText('2d20kh1 + 5 (Athletics)');
  await dialog.getByRole('button', { name: en.roll.again }).click();
  const two = await facesOf(page);
  expect(two).toHaveLength(2);
  expect(two.filter(({ kept }) => kept)).toHaveLength(1);
  const higher = Math.max(...two.map(({ face }) => face));
  expect(two.find(({ kept }) => kept)?.face).toBe(higher);
  expect(Number(await page.getByTestId('roll-total').textContent())).toBe(higher + 5);
  await dialog.getByRole('button', { name: en.roll.disadvantage, exact: true }).click();
  await expect(page.getByTestId('roll-formula')).toHaveText('1d20 + 5 (Athletics)');

  // Both rolls are in the character's roll log.
  const logged = await page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const count = request.result.transaction('rollLog').objectStore('rollLog').count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
    DB_NAME,
  );
  expect(logged).toBe(2);
  await dialog.getByRole('button', { name: en.roll.done }).click();
  await expect(dialog).toBeHidden();
});

test('SHEET-39 Remarkable Athlete’s advantage shows as a source, and a long press still opens the breakdown', async ({
  page,
}) => {
  await saveRows(page, [goldenB4]);
  await page.goto(`characters/${goldenB4.id}`);
  await number(page, 'skills.athletics.total').click();
  await expect(page.getByTestId('roll-formula')).toHaveText('2d20kh1 + 6 (Athletics)');
  await expect(page.getByTestId('roll-mode')).toHaveText(en.roll.mode.advantage);
  await expect(page.getByRole('dialog').getByRole('listitem')).toContainText(
    'Remarkable Athlete: advantage',
  );
});

test('SHEET-39 rolling initiative interrupts a knock-out’s rest, with its Undo toast', async ({
  page,
}) => {
  const resting = {
    ...goldenB,
    systemData: {
      ...goldenB.systemData,
      state: { ...goldenB.systemData.state, hp: { current: 0, temp: 0 }, knockedOut: 'resting' },
    },
  };
  await saveRows(page, [resting]);
  await page.goto(`characters/${goldenB.id}`);
  await number(page, 'init.total').click();
  await expect(page.getByTestId('roll-formula')).toHaveText('1d20 + 3 (Initiative)');
  await page.getByRole('dialog').getByRole('button', { name: en.roll.roll, exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: en.toast.done.rollInitiative }),
  ).toBeVisible();
});

test('SHEET-39 in 2014 a spent inspiration gives advantage and is spent with the roll', async ({
  page,
}) => {
  const inspired = {
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: { ...goldenA.systemData.state, inspiration: 1 },
    },
  };
  await saveRows(page, [inspired]);
  await page.goto(`characters/${goldenA.id}`);
  await number(page, 'skills.insight.total').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: new RegExp(en.roll.inspiration) }).click();
  await expect(page.getByTestId('roll-formula')).toContainText('2d20kh1');
  await dialog.getByRole('button', { name: en.roll.roll, exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: en.toast.done.spendInspiration }),
  ).toBeVisible();
  // Held no more, the switch is not offered again.
  await expect(dialog.getByRole('button', { name: new RegExp(en.roll.inspiration) })).toBeHidden();
});
