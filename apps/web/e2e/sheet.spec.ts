import { expect, type Page, test } from '@playwright/test';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB, goldenB4 } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-30: the goldens of SPEC §6.7 are saved into the app's own database, then their sheet
// opens. Golden B is a human fighter 1 (AC 17, initiative +3, speed 30, proficiency +2, passive
// Perception 13, 12 hit points); golden A a hill dwarf cleric 1 (spell save DC 13, attack +5).

/** Waits for the app to make its database, then puts the rows into its `characters` table. */
async function saveRows(page: Page, rows: readonly object[], store = 'characters') {
  await page.goto('./');
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toContainEqual({ name: DB_NAME, version: 20 });
  await page.evaluate(
    ([name, toSave, into]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(into, 'readwrite');
          for (const row of toSave) transaction.objectStore(into).put(row);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    [DB_NAME, rows, store] as const,
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

  // The toast sits 16 px above the dock, and 64 px higher (SHEET-81) so the round buttons are free.
  const lift = await page.evaluate(() => {
    const status = document.querySelector('[role="status"]');
    return status === null ? undefined : getComputedStyle(status).bottom;
  });
  const dockTop = await page.locator('[data-skin-slot="dock"]').boundingBox();
  expect(lift).toBe(`${800 - (dockTop?.y ?? 0) + 16 + 64}px`);

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

test('SHEET-34 a manual edit overrides a number in edit mode; Undo and Remove give the computed one back', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const sheet = page.getByRole('dialog', { name: en.breakdown.title });
  const summary = page.getByTestId('breakdown-summary');
  const strength = number(page, 'abilities.str.score');
  const field = sheet.getByLabel('Number', { exact: true });
  // A tap first: a second context menu on the same number opens nothing until a left press resets
  // the long-press flag (found by this test: BACKLOG row SHEET-78).
  const openStrength = async () => {
    await strength.click();
    await strength.click({ button: 'right' });
  };

  // Play mode locks the structure: the breakdown says how to unlock it and draws no field.
  await openStrength();
  await expect(sheet.getByTestId('override-locked')).toHaveText(
    'Turn on Edit to override this number by hand.',
  );
  await expect(field).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Edit mode: Strength 17 set to 20 by hand with a note.
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await openStrength();
  await expect(field).toHaveValue('17');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await field.fill('abc');
  await expect(sheet.getByRole('alert')).toHaveText('Type a number, like 12 or -1.');
  await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await field.fill('20');
  await sheet.getByLabel('Note', { exact: true }).fill('Belt of power');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(summary).toHaveText('Strength score 20 = Base 15, Soldier +2, Manual edit +3');
  await expect(sheet.locator('[data-manual]')).toBeVisible();
  await expect(sheet).toContainText('Belt of power');
  await expect(page.getByRole('status').filter({ hasText: 'Manual edit saved' })).toBeVisible();
  await sheet.getByRole('heading', { name: 'Override by hand' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('override-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('override-light.png') });

  // Everything that reads Strength follows: modifier floor((20 - 10) / 2) = 5, so the check is +5,
  // the save 5 + 2 = +7 and Athletics 5 + 2 = +7 (golden B has proficiency +2 in both).
  await page.keyboard.press('Escape');
  await expect(number(page, 'checks.str.total')).toHaveText('STR+5');
  await expect(number(page, 'abilities.str.save')).toHaveText('STR+7');
  await expect(number(page, 'skills.athletics.total')).toHaveText('Athletics+7');

  // Undo gives 17 back, and one Remove does too after a new save.
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(number(page, 'abilities.str.score')).toHaveText('Strength score17');
  await expect(number(page, 'skills.athletics.total')).toHaveText('Athletics+5');
  await openStrength();
  await field.fill('8');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(summary).toHaveText('Strength score 8 = Base 15, Soldier +2, Manual edit −9');
  await sheet.getByRole('button', { name: 'Remove manual edit' }).click();
  await expect(summary).toHaveText('Strength score 17 = Base 15, Soldier +2');
  await expect(sheet.getByRole('button', { name: 'Remove manual edit' })).toHaveCount(0);

  // A saved edit is stored: it is there after a reload.
  await field.fill('20');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(summary).toContainText('Manual edit +3');
  await page.reload();
  await expect(number(page, 'abilities.str.score')).toHaveText('Strength score20');
});

test('SHEET-79 a skill’s stat is set by hand from its breakdown; Undo and Remove give the rules’ stat back', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const skillSheet = page.getByRole('dialog', { name: en.breakdown.title });
  const statSheet = page.getByRole('dialog', { name: 'Where this stat comes from' });
  const athletics = number(page, 'skills.athletics.total');
  const openStat = async () => {
    // A tap rolls (and resets the long-press flag, SHEET-78); Escape closes the roll dialog.
    await athletics.click();
    await page.keyboard.press('Escape');
    await athletics.click({ button: 'right' });
    await skillSheet.getByTestId('stat-link').click();
  };

  // Golden B: Athletics is Strength +3 and proficiency +2 = +5. Play mode locks the edit.
  await expect(athletics).toHaveText('Athletics+5');
  await openStat();
  await expect(statSheet.getByTestId('key-summary')).toHaveText('Athletics uses Strength');
  await expect(statSheet.getByTestId('override-locked')).toHaveText(
    'Turn on Edit to set the stat by hand.',
  );
  await expect(statSheet.getByLabel('Stat', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(statSheet).toHaveCount(0);
  await expect(skillSheet).toBeVisible();
  await page.keyboard.press('Escape');

  // Edit mode: Dexterity (+1) for Athletics, with a note. Athletics is then 1 + 2 = +3.
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await openStat();
  const pick = statSheet.getByLabel('Stat', { exact: true });
  await expect(pick).toHaveValue('str');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await pick.selectOption('dex');
  await statSheet.getByLabel('Note', { exact: true }).fill('Agile');
  await page.screenshot({ path: testInfo.outputPath('stat-dark.png') });
  await statSheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(statSheet.getByTestId('key-summary')).toHaveText('Athletics uses Dexterity');
  await expect(statSheet.locator('[data-manual]')).toBeVisible();
  await expect(statSheet).toContainText('Agile');
  await expect(page.getByRole('status').filter({ hasText: 'Manual edit saved' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(skillSheet.getByTestId('breakdown-summary')).toHaveText(
    'Athletics +3 = Dexterity modifier +1, Proficiency bonus +2',
  );
  await page.keyboard.press('Escape');
  await expect(athletics).toHaveText('Athletics+3');

  // Undo gives Strength back; a new save and Remove do too; a saved edit is there after a reload.
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(athletics).toHaveText('Athletics+5');
  await openStat();
  await statSheet.getByLabel('Stat', { exact: true }).selectOption('cha');
  await statSheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(statSheet.getByTestId('key-summary')).toHaveText('Athletics uses Charisma');
  await statSheet.getByRole('button', { name: 'Remove manual edit' }).click();
  await expect(statSheet.getByTestId('key-summary')).toHaveText('Athletics uses Strength');
  await statSheet.getByLabel('Stat', { exact: true }).selectOption('dex');
  await statSheet.getByRole('button', { name: 'Save', exact: true }).click();
  // The reload waits for the save to show: a reload sent first can beat the write.
  await expect(statSheet.getByTestId('key-summary')).toHaveText('Athletics uses Dexterity');
  await page.reload();
  await expect(number(page, 'skills.athletics.total')).toHaveText('Athletics+3');
});

test('SHEET-58 the sheet’s ⋯ menu lists the character’s actions; Export, Copy and Delete run from it', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('button', { name: en.sheet.actions }).click();
  const menu = page.getByRole('dialog', { name: 'Golden B' });
  await expect(menu).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  // ADR 013 item 2, top to bottom; the ones that wait for a later phase are shown, not tappable.
  const rows = menu.getByTestId('sheet-actions').getByRole('button');
  await expect(rows).toHaveText([
    'Level upComing later',
    'Link for the DMComing later',
    'ExportA file of this character',
    'Copy',
    'TransferComing later',
    'Rules optionsComing later',
    'Change historyThe last 50 changes, each with its Undo',
    'DeleteUndo stays available for a moment',
  ]);
  for (const name of [/^Level up/, /^Link for the DM/, /^Transfer/, /^Rules options/]) {
    await expect(menu.getByRole('button', { name })).toBeDisabled();
  }
  await page.screenshot({ path: testInfo.outputPath('sheet-menu-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('sheet-menu-light.png') });

  // Export saves the character file and closes the menu.
  const download = page.waitForEvent('download');
  await menu.getByRole('button', { name: /^Export/ }).click();
  expect((await download).suggestedFilename()).toBe('Golden B.json');
  await expect(menu).toHaveCount(0);

  // Copy stores a copy and stays on the sheet.
  await page.getByRole('button', { name: en.sheet.actions }).click();
  await menu.getByRole('button', { name: /^Copy/ }).click();
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(`characters/${goldenB.id}`);

  // Delete leaves for My characters, where the toast offers Undo.
  await page.getByRole('button', { name: en.sheet.actions }).click();
  await menu.getByRole('button', { name: /^Delete/ }).click();
  await expect(page).toHaveURL(/characters$/);
  const cards = page.getByRole('main').getByRole('link', { name: /Golden/ });
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Golden B (copy)');
  await expect(page.getByRole('status')).toContainText('Golden B deleted');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(cards).toHaveCount(2);
});

test('SHEET-52 edit mode adds a custom item and a custom feature as text, each with Undo', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  const add = page.getByRole('button', { name: 'Add to the sheet' });
  const panel = page.getByRole('dialog', { name: 'Add to the sheet' });
  const tab = page.getByRole('tabpanel');

  // Play mode locks the structure: no "+". Edit mode shows it.
  await expect(add).toHaveCount(0);
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await expect(add).toBeVisible();
  await add.click();
  await expect(panel.getByTestId('add-menu')).toContainText('Custom item');
  await expect(panel.getByTestId('add-menu')).toContainText('Custom feature');
  await page.screenshot({ path: testInfo.outputPath('add-menu-dark.png') });

  // A custom item: a name is needed; a weight must be a number above 0.
  await panel.getByRole('button', { name: /^Custom item/ }).click();
  const form = page.getByRole('dialog', { name: 'Custom item' });
  const addItem = form.getByRole('button', { name: 'Add', exact: true });
  await expect(addItem).toBeDisabled();
  await form.getByLabel('Name', { exact: true }).fill('Rope');
  await expect(addItem).toBeEnabled();
  await form.getByLabel('Weight (lb)').fill('abc');
  await expect(addItem).toBeDisabled();
  await form.getByLabel('Weight (lb)').fill('10');
  await form.getByLabel('How many').fill('2');
  await form.getByLabel('Description').fill('50 feet of hemp');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('add-item-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('add-item-light.png') });
  await addItem.click();
  await expect(form).toHaveCount(0);

  // Chain mail 55 lb + greatsword 6 lb + two ropes of 10 lb = 81 lb.
  const rope = tab.locator('[data-row]').filter({ hasText: /^Rope/ });
  await expect(rope).toContainText('×2 · 20 lb');
  await expect(rope.getByTestId('row-note')).toHaveText('50 feet of hemp');
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 81 lb');
  await expect(page.getByRole('status').filter({ hasText: 'Rope added' })).toBeVisible();
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(rope).toHaveCount(0);
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 61 lb');

  // A custom feature: a name and its words, on the Features tab under the feats.
  await page.goto(`characters/${goldenB.id}?tab=features`);
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await add.click();
  await panel.getByRole('button', { name: /^Custom feature/ }).click();
  const featureForm = page.getByRole('dialog', { name: 'Custom feature' });
  await featureForm.getByLabel('Name', { exact: true }).fill('Keen Eyes');
  await featureForm.getByLabel('Description').fill('You notice what others miss.');
  await featureForm.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(featureForm).toHaveCount(0);
  const keen = tab.locator('[data-feature^="character:feat/"]');
  await expect(keen).toContainText('Keen Eyes');
  await keen
    .getByRole('button', { name: /Keen Eyes/ })
    .first()
    .click();
  await keen.getByRole('button', { name: en.description.seeFull }).click();
  await expect(keen).toContainText('You notice what others miss.');
  await expect(keen).toContainText(en.description.own);
  await expect(page.getByRole('status').filter({ hasText: 'Keen Eyes added' })).toBeVisible();

  // It is stored, and edit mode can take it away, with Undo.
  await page.reload();
  await expect(tab.locator('[data-feature^="character:feat/"]')).toHaveCount(1);
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await page.getByRole('button', { name: 'Remove Keen Eyes' }).click();
  await expect(tab.locator('[data-feature^="character:feat/"]')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Keen Eyes removed' })).toBeVisible();
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(tab.locator('[data-feature^="character:feat/"]')).toHaveCount(1);
});

test('SHEET-80 edit mode changes a custom item and a custom feature after they were added, with Undo', async ({
  page,
}, testInfo) => {
  // Golden B (55 lb + 6 lb carried) with a made-up rope of 10 lb, two of them, and a made-up feat.
  const ROPE = 'e1000000-0000-4000-8000-0000000000aa';
  const FEAT = 'character:feat/custom-1a2b3c4d';
  await saveRows(page, [
    {
      ...goldenB,
      localEntities: [
        {
          id: FEAT,
          type: 'feat',
          ruleset: 'any',
          name: { en: 'Keen Eyes' },
          text: { en: 'You notice what others miss.' },
          source: { pack: 'character' },
        },
      ],
      systemData: {
        ...goldenB.systemData,
        feats: [...goldenB.systemData.feats, { id: FEAT }],
        inventory: [
          ...goldenB.systemData.inventory,
          {
            uid: ROPE,
            custom: { name: 'Rope', weight: 10 },
            qty: 2,
            equipped: false,
            attuned: false,
            note: '50 feet of hemp',
          },
        ],
      },
    },
  ]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  const tab = page.getByRole('tabpanel');
  const rope = tab.locator(`[data-row="${ROPE}"]`);
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 81 lb');

  // Play mode has no Edit button; edit mode has one on the custom row only.
  await expect(page.getByRole('button', { name: 'Edit Rope' })).toHaveCount(0);
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Rope' }).click();
  const form = page.getByRole('dialog', { name: 'Edit item' });
  const save = form.getByRole('button', { name: 'Save', exact: true });
  await expect(form.getByLabel('Name', { exact: true })).toHaveValue('Rope');
  await expect(form.getByLabel('Weight (lb)')).toHaveValue('10');
  await expect(form.getByLabel('Description')).toHaveValue('50 feet of hemp');
  await form.getByLabel('Name', { exact: true }).fill(' ');
  await expect(save).toBeDisabled();
  await form.getByLabel('Name', { exact: true }).fill('Silk rope');
  await form.getByLabel('Weight (lb)').fill('abc');
  await expect(save).toBeDisabled();
  await form.getByLabel('Weight (lb)').fill('5');
  await form.getByLabel('Description').fill('60 feet of silk');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('edit-item-dark.png') });
  await save.click();
  await expect(form).toHaveCount(0);

  // The name and words changed, the count stayed, and 2 ropes of 5 lb make 71 lb.
  await expect(rope).toContainText('Silk rope');
  await expect(rope).toContainText('×2 · 10 lb');
  await expect(rope.getByTestId('row-note')).toHaveText('60 feet of silk');
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 71 lb');
  await expect(page.getByRole('status').filter({ hasText: 'Silk rope changed' })).toBeVisible();
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(rope).toContainText('Rope');
  await expect(rope).toContainText('×2 · 20 lb');
  await expect(rope.getByTestId('row-note')).toHaveText('50 feet of hemp');
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 81 lb');

  // A custom feature: its name and words, on the Features tab; it is stored.
  await page.goto(`characters/${goldenB.id}?tab=features`);
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Keen Eyes' }).click();
  const featureForm = page.getByRole('dialog', { name: 'Edit feature' });
  await expect(featureForm.getByLabel('Name', { exact: true })).toHaveValue('Keen Eyes');
  await expect(featureForm.getByLabel('Weight (lb)')).toHaveCount(0);
  await featureForm.getByLabel('Name', { exact: true }).fill('Keen Sight');
  await featureForm.getByLabel('Description').fill('You notice more.');
  await page.screenshot({ path: testInfo.outputPath('edit-feature-dark.png') });
  await featureForm.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(featureForm).toHaveCount(0);
  const keen = tab.locator(`[data-feature="${FEAT}"]`);
  await expect(keen).toContainText('Keen Sight');
  await expect(page.getByRole('status').filter({ hasText: 'Keen Sight changed' })).toBeVisible();
  await page.reload();
  await expect(tab.locator(`[data-feature="${FEAT}"]`)).toContainText('Keen Sight');
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await page.getByRole('button', { name: 'Edit Keen Sight' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Edit feature' }).getByLabel('Description'),
  ).toHaveValue('You notice more.');
});

test('SHEET-57 a custom section is a tab of the person’s own list; a character saved before them opens', async ({
  page,
}, testInfo) => {
  // A file of the core's version 2 has no `sections`: it opens with none, and saves as version 3.
  const { sections: _none, ...stored } = goldenB;
  await saveRows(page, [{ ...stored, schemaVersion: 2 }]);
  await page.goto(`characters/${goldenB.id}`);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(8);
  const add = page.getByRole('button', { name: 'Add to the sheet' });
  const panel = page.getByRole('dialog', { name: 'Add to the sheet' });
  const body = page.getByRole('tabpanel');

  // A section: its name, then its tab, after the built-in ones, open.
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await add.click();
  await panel.getByRole('button', { name: /^New section/ }).click();
  const sectionForm = page.getByRole('dialog', { name: 'New section' });
  const addSection = sectionForm.getByRole('button', { name: 'Add', exact: true });
  await expect(addSection).toBeDisabled();
  await sectionForm.getByLabel('Name of the list').fill('Mounts');
  await addSection.click();
  await expect(tabs).toHaveCount(9);
  await expect(tabs.last()).toHaveText('Mounts');
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  const section = body.locator('[data-section]');
  await expect(section).toContainText('Mounts');
  await expect(section).toContainText('Nothing here yet.');
  await expect(page.getByRole('status').filter({ hasText: 'Mounts added' })).toBeVisible();

  // An entry from the section's own button: the name and its words.
  await section.getByRole('button', { name: 'Add an entry' }).click();
  const entryForm = page.getByRole('dialog', { name: 'New entry' });
  await expect(entryForm.getByLabel('Section')).toHaveValue(/.+/);
  await expect(entryForm.getByLabel('Section').locator('option:checked')).toHaveText('Mounts');
  await entryForm.getByLabel('Name', { exact: true }).fill('Dapple');
  await entryForm.getByLabel('Stat block or description').fill('Speed 60 ft, 19 hit points');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('section-entry-dark.png') });
  await entryForm.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(entryForm).toHaveCount(0);
  const dapple = section.locator('[data-entry]').filter({ hasText: 'Dapple' });
  await expect(dapple).toContainText('Speed 60 ft, 19 hit points');
  await expect(page.getByRole('status').filter({ hasText: 'Dapple added' })).toBeVisible();
  await expect(section.locator('[data-entry]')).toHaveCount(1);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('section-light.png') });

  // A companion from the panel's list goes to the section picked, and its tab shows.
  await page.getByRole('tab', { name: 'Main' }).click();
  // The toast of the last change sits over the "+" until it goes (5 s): found by this test.
  await expect(page.getByRole('button', { name: en.toast.undo })).toHaveCount(0, {
    timeout: 10_000,
  });
  await add.click();
  await panel.getByRole('button', { name: /^Companion/ }).click();
  await entryForm.getByLabel('Name', { exact: true }).fill('Saddlebags');
  await entryForm.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  await expect(section.locator('[data-entry]')).toHaveCount(2);

  // Stored: a reload keeps the tab, its entries and the tab open; play mode only reads.
  await page.reload();
  await expect(tabs).toHaveCount(9);
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  await expect(section.locator('[data-entry]')).toHaveCount(2);
  await expect(section.getByRole('button')).toHaveCount(0);

  // Edit mode takes an entry away, then the whole section with its tab, each with Undo.
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await section.getByRole('button', { name: 'Remove Saddlebags' }).click();
  await expect(section.locator('[data-entry]')).toHaveCount(1);
  await section.getByRole('button', { name: 'Remove section' }).click();
  await expect(tabs).toHaveCount(8);
  await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(tabs).toHaveCount(9);
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

test('SHEET-36 the choices badge opens every pending choice, each answered from its list', async ({
  page,
}, testInfo) => {
  const undecided = {
    ...goldenB,
    choices: {},
    systemData: { ...goldenB.systemData, species: { id: 'srd-2024:species/human' } },
  };
  await saveRows(page, [undecided]);
  await page.goto(`characters/${goldenB.id}`);
  // Seven grants and the size are pending: golden B's own seven choices, taken out, and the size.
  const badge = page.getByRole('banner').getByRole('button', { name: /choices to make/ });
  await expect(badge).toHaveText('!8');
  await badge.click();
  const panel = page.getByRole('dialog', { name: en.choices.title });
  await expect(panel.getByRole('heading', { level: 3 })).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('choices-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('choices-light.png') });

  // The size: one pick answers it, and the badge counts one fewer.
  await panel.getByRole('button', { name: 'Pick Small' }).click();
  await expect(page.getByRole('status').filter({ hasText: en.toast.done.setChoice })).toBeVisible();
  await expect(panel.getByRole('heading', { level: 3 })).toHaveCount(7);

  // The fighter's two skills: the first pick leaves the choice open with a chip to take it back.
  const fighter = panel.locator('[data-part="srd-2024:class/fighter#skills"]');
  await fighter.getByRole('button', { name: 'Pick Perception' }).click();
  await expect(fighter).toContainText('choose 1 more');
  await expect(fighter.getByRole('button', { name: 'Take back Perception' })).toBeVisible();
  await fighter.getByRole('button', { name: 'Pick Survival' }).click();
  await expect(panel.getByRole('heading', { level: 3 })).toHaveCount(6);

  // The choice is on the sheet: Wisdom 12 gives +1 and, now proficient in Survival, the bonus +2 makes +3.
  await panel.getByRole('button', { name: en.common.close }).first().click();
  await expect(badge).toHaveText('!6');
  await expect(number(page, 'skills.survival.total')).toHaveText('Survival+3');

  // Undo takes the last pick back.
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(number(page, 'skills.survival.total')).toHaveText('Survival+1');
  await expect(badge).toHaveText('!7');
});

test('SHEET-48 the Features tab groups features by source; a use and a switch are changes with Undo', async ({
  page,
}, testInfo) => {
  const furious = {
    id: 'character:feat/furious',
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Furious' },
    source: { pack: 'character' },
    effects: [
      {
        id: 'rage',
        target: 'checks.str.bonus',
        op: 'add',
        value: 1,
        toggle: { label: { en: 'Raging' }, default: false },
      },
    ],
  };
  await saveRows(page, [
    {
      ...goldenB,
      localEntities: [furious],
      systemData: { ...goldenB.systemData, feats: [{ id: furious.id }] },
    },
  ]);
  await page.goto(`characters/${goldenB.id}?tab=features`);
  const tab = page.getByRole('tabpanel');
  await expect(tab.getByRole('heading', { level: 2 })).toHaveText([
    'Human',
    'Fighter',
    'Soldier',
    'Feats',
  ]);
  await expect(tab).toContainText('class · level 1');
  await expect(tab.getByTestId('subclass')).toHaveText('Subclass: chosen at level 3');

  // Second Wind: 2 of 2, "1 back on a short rest, all on a long rest" (SRD 5.2.1).
  const wind = tab.locator('[data-feature="srd-2024:feature/fighter-second-wind"]');
  await expect(wind.getByTestId('uses-left')).toHaveText('2 of 2 left');
  await expect(wind.getByTestId('recovery')).toHaveText(
    /1\s*back on a short rest,\s*all on a long rest/,
  );
  await page.screenshot({ path: testInfo.outputPath('features-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('features-light.png') });

  await wind.getByRole('button', { name: 'Use secondWind' }).click();
  await expect(wind.getByTestId('uses-left')).toHaveText('1 of 2 left');
  await expect(page.getByRole('status').filter({ hasText: /Second Wind used/ })).toBeVisible();
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(wind.getByTestId('uses-left')).toHaveText('2 of 2 left');

  // A feature opens its description in place.
  await wind
    .getByRole('button', { name: /Second Wind/ })
    .first()
    .click();
  await expect(wind.getByRole('button', { name: en.description.seeFull })).toBeVisible();

  // The feat's switch: off by default, on after a tap, with its own toast.
  const feat = tab.locator('[data-feature="character:feat/furious"]');
  const raging = feat.getByRole('switch', { name: 'Raging' });
  await expect(raging).toHaveAttribute('aria-checked', 'false');
  await raging.click();
  await expect(raging).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('status').filter({ hasText: /switched/ })).toBeVisible();
});

test('SHEET-50 the Gear tab equips items: AC and attacks change at once, each change with Undo', async ({
  page,
}, testInfo) => {
  const charm = {
    id: 'character:item/charm-1',
    type: 'item',
    ruleset: 'any',
    name: { en: 'Charm of Ward' },
    source: { pack: 'character' },
    category: 'gear',
    weight: 0.5,
    magic: { rarity: 'rare', attunement: true },
    effects: [{ id: 'ward', target: 'ac.bonus', op: 'add', value: 1, when: '@attuned' }],
  };
  await saveRows(page, [
    {
      ...goldenB,
      localEntities: [charm],
      systemData: {
        ...goldenB.systemData,
        inventory: [
          ...goldenB.systemData.inventory,
          {
            uid: 'e1000000-0000-4000-8000-000000000001',
            itemId: charm.id,
            qty: 1,
            equipped: true,
            attuned: false,
          },
        ],
      },
    },
  ]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  const tab = page.getByRole('tabpanel');
  const chain = tab.locator('[data-row="5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c"]');
  const sword = tab.locator('[data-row="6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d"]');
  const ward = tab.locator('[data-row="e1000000-0000-4000-8000-000000000001"]');
  const armorClass = page.getByRole('banner').locator('[data-path="ac.total"]');

  // Chain mail 55 lb, a greatsword 6 lb and the charm 0.5 lb.
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 61.5 lb');
  await expect(armorClass).toHaveText('17AC');
  await page.screenshot({ path: testInfo.outputPath('gear-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('gear-light.png') });

  // Taking the armor off drops AC 17 to 10 + Dexterity 1 = 11 at once; Undo puts it back.
  await chain.getByRole('switch', { name: 'Worn' }).click();
  await expect(armorClass).toHaveText('11AC');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(armorClass).toHaveText('17AC');

  // Attuned, the charm adds +1 to AC; past three attunements it would warn, never refuse.
  await ward.getByRole('switch', { name: 'Attuned' }).click();
  await expect(armorClass).toHaveText('18AC');

  // How many: the weight follows.
  await ward.getByRole('button', { name: 'One more Charm of Ward' }).click();
  await expect(ward.getByTestId('row-qty')).toHaveText('2');
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 62 lb');

  // Kept in: the greatsword goes inside the chain mail, under it and indented.
  await sword.getByLabel('Kept in').selectOption({ label: 'Chain Mail' });
  await expect(chain).toContainText('1 inside');
  await expect(tab.getByTestId('carried')).toHaveText('Carrying 62 lb');

  // Removing the chain mail takes its AC with it and puts the sword out on its own.
  await chain.getByRole('button', { name: 'Remove Chain Mail' }).click();
  await expect(armorClass).toHaveText('12AC');
  await expect(chain).toHaveCount(0);
  await expect(sword.getByLabel('Kept in')).toHaveValue('');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(armorClass).toHaveText('18AC');
  await expect(chain).toHaveCount(1);
});

test('SHEET-51 the Gear tab changes coins by steps, each change with Undo', async ({
  page,
}, testInfo) => {
  await saveRows(page, [
    {
      ...goldenB,
      systemData: {
        ...goldenB.systemData,
        currency: { cp: 0, sp: 3, ep: 0, gp: 12, pp: 0 },
      },
    },
  ]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  const tab = page.getByRole('tabpanel');
  const gold = tab.locator('[data-coin="gp"]');
  const silver = tab.locator('[data-coin="sp"]');
  const copper = tab.locator('[data-coin="cp"]');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await expect(gold.getByTestId('coin-amount')).toHaveText('12');
  await gold.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('coins-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('coins-light.png') });

  // 12 + 10 = 22, 22 - 1 = 21; one Undo gives back the last step only.
  await gold.getByRole('button', { name: 'Add 10 gold' }).click();
  await expect(gold.getByTestId('coin-amount')).toHaveText('22');
  await expect(page.getByRole('status').filter({ hasText: 'Coins changed' })).toBeVisible();
  await gold.getByRole('button', { name: 'Take 1 gold' }).click();
  await expect(gold.getByTestId('coin-amount')).toHaveText('21');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(gold.getByTestId('coin-amount')).toHaveText('22');

  // 3 silver cannot lose 10 or reach below 0: that button is off; steps of 1 reach 0 and stop.
  await expect(silver.getByRole('button', { name: 'Take 10 silver' })).toBeDisabled();
  for (const left of ['2', '1', '0']) {
    await silver.getByRole('button', { name: 'Take 1 silver' }).click();
    await expect(silver.getByTestId('coin-amount')).toHaveText(left);
  }
  await expect(silver.getByRole('button', { name: 'Take 1 silver' })).toBeDisabled();
  await expect(copper.getByRole('button', { name: 'Take 1 copper' })).toBeDisabled();

  // A count survives a reload: it is stored.
  await page.reload();
  await expect(gold.getByTestId('coin-amount')).toHaveText('22');
  await expect(silver.getByTestId('coin-amount')).toHaveText('0');
});

test('SHEET-59 the change history lists the last changes, each with its own Undo, and keeps one a later change wrote over', async ({
  page,
}, testInfo) => {
  await saveRows(page, [
    {
      ...goldenB,
      systemData: { ...goldenB.systemData, currency: { cp: 0, sp: 3, ep: 0, gp: 12, pp: 0 } },
    },
  ]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  const tab = page.getByRole('tabpanel');
  const gold = tab.locator('[data-coin="gp"]');
  const silver = tab.locator('[data-coin="sp"]');
  const history = page.getByRole('dialog', { name: 'Change history' });
  const rows = history.getByTestId('history').locator('li');

  // Three changes: A takes 1 silver, B adds 1 gold (13), C adds 1 gold (14).
  await silver.getByRole('button', { name: 'Take 1 silver' }).click();
  await gold.getByRole('button', { name: 'Add 1 gold' }).click();
  await gold.getByRole('button', { name: 'Add 1 gold' }).click();
  await expect(gold.getByTestId('coin-amount')).toHaveText('14');
  await expect(silver.getByTestId('coin-amount')).toHaveText('2');

  // The ⋯ menu opens the history: newest first. B's place holds C's number now, so B's Undo is off.
  await page.getByRole('button', { name: en.sheet.actions }).click();
  await page
    .getByRole('dialog', { name: 'Golden B' })
    .getByRole('button', { name: /^Change history/ })
    .click();
  await expect(history).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByRole('button', { name: /^Undo/ })).toBeEnabled();
  await expect(rows.nth(1).getByRole('button', { name: /^Undo/ })).toBeDisabled();
  await expect(rows.nth(1)).toContainText(
    'A later change touched the same place. Undo that one first.',
  );
  await expect(rows.nth(2).getByRole('button', { name: /^Undo/ })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('history-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('history-light.png') });

  // The oldest change is undone while the newer ones stay: silver is back, gold is still 14.
  await rows.nth(2).getByRole('button', { name: /^Undo/ }).click();
  await expect(rows).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(silver.getByTestId('coin-amount')).toHaveText('3');
  await expect(gold.getByTestId('coin-amount')).toHaveText('14');

  // C first, then B is free: gold goes 14, 13, 12, and the list is empty.
  await page.getByRole('button', { name: en.sheet.actions }).click();
  await page
    .getByRole('dialog', { name: 'Golden B' })
    .getByRole('button', { name: /^Change history/ })
    .click();
  await rows.nth(0).getByRole('button', { name: /^Undo/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0).getByRole('button', { name: /^Undo/ })).toBeEnabled();
  await rows.nth(0).getByRole('button', { name: /^Undo/ }).click();
  await expect(history).toContainText('No change has been made yet.');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(gold.getByTestId('coin-amount')).toHaveText('12');

  // What was undone from the list is stored: a reload shows the same numbers.
  await page.reload();
  await expect(gold.getByTestId('coin-amount')).toHaveText('12');
  await expect(silver.getByTestId('coin-amount')).toHaveText('3');
});

test('SHEET-46 the Spells tab shows the slot grid; a tap spends or gives back a slot, with Undo', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenA]);
  await page.goto(`characters/${goldenA.id}?tab=spells`);
  const tab = page.getByRole('tabpanel');

  // Golden A (SPEC §6.7): spell save DC 13, attack +5, two level 1 slots.
  await expect(number(page, 'classes.cleric.spell.dc').last()).toHaveText('Save DC13');
  await expect(number(page, 'classes.cleric.spell.attack').last()).toHaveText('Attack+5');
  const column = tab.locator('[data-slot="1"]');
  await expect(column.locator('[data-left="true"]')).toHaveCount(2);
  await expect(column.getByTestId('slots-left')).toHaveText('2 of 2 left');
  await expect(tab.locator('[data-spell="srd-2014:spell/bless"]')).toContainText(
    'Level 1 · from Life · always prepared',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('spells-dark.png') });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: testInfo.outputPath('spells-light.png') });

  // A tap on a filled circle spends a slot; Undo gives it back.
  await column.getByRole('button', { name: 'Spend a Level 1 slot' }).first().click();
  await expect(column.getByTestId('slots-left')).toHaveText('1 of 2 left');
  await expect(column.locator('[data-left="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(column.getByTestId('slots-left')).toHaveText('2 of 2 left');

  // A tap on a hollow circle gives one back.
  await column.getByRole('button', { name: 'Spend a Level 1 slot' }).first().click();
  await column.getByRole('button', { name: 'Give back a Level 1 slot' }).click();
  await expect(column.getByTestId('slots-left')).toHaveText('2 of 2 left');

  // A spell opens the cast panel (SHEET-47), which holds its description.
  await tab
    .locator('[data-spell="srd-2014:spell/bless"]')
    .getByRole('button', { name: /Bless/ })
    .click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Bless' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: en.description.seeFull }),
  ).toBeVisible();
});

test('SHEET-41 the Combat tab shows the concentration until it ends; Undo brings it back', async ({
  page,
}, testInfo) => {
  const holding = {
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: { ...goldenA.systemData.state, concentration: 'srd-2014:spell/bless' },
    },
  };
  await saveRows(page, [holding]);
  await page.goto(`characters/${goldenA.id}?tab=combat`);
  const card = page.locator('[data-concentration="srd-2014:spell/bless"]');
  await expect(card).toContainText('Concentration');
  await expect(card).toContainText('Bless');
  await expect(card).toContainText('Level 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('concentration-dark.png') });

  // Ending it is one change; the card goes, and Undo brings it back.
  await card.getByRole('button', { name: en.concentration.end }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Concentration ended');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(card).toBeVisible();
});

test('SHEET-42 conditions are set from the sheet: add, raise to death, end, each with Undo', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const tab = page.getByRole('tabpanel');
  await expect(tab).toContainText('No conditions');

  // Add Exhaustion (2024: six levels) from the list.
  await tab.getByRole('button', { name: en.conditions.add, exact: true }).click();
  await page.locator('[data-condition="srd-2024:condition/exhaustion"] button').click();
  await expect(page.getByRole('status')).toContainText('Exhaustion applied');
  const chip = tab.locator('[data-condition="srd-2024:condition/exhaustion"]');
  await expect(chip).toHaveText('Exhaustion 1');

  // Raise it to 3: the chip follows, and the panel marks the level.
  await chip.getByRole('button').click();
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'Set Exhaustion to level 3' }).click();
  await expect(panel.getByRole('button', { name: 'Set Exhaustion to level 3' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(chip).toHaveText('Exhaustion 3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('conditions-panel-dark.png') });

  // Level 6 is death: no number, and the panel says so; Undo goes back to 3.
  await panel.getByRole('button', { name: 'Set Exhaustion to level 6' }).click();
  await expect(chip).toHaveText('Exhaustion · death');
  await expect(panel).toContainText('Exhaustion at this level is death. It gives no number.');
  // The toast shows above the panel (SHEET-71): Undo is tapped with the panel still open.
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(chip).toHaveText('Exhaustion 3');
  await expect(panel).toBeVisible();

  // Remove ends it, with its toast; Undo brings it back.
  await panel.getByRole('button', { name: en.conditions.remove }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(tab).toContainText('No conditions');
  await expect(page.getByRole('status')).toContainText('Exhaustion ended');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(chip).toHaveText('Exhaustion 3');
  await page.screenshot({ path: testInfo.outputPath('conditions-dark.png') });
});

/** The pad's key `key`, tapped in the open pad. */
const key = (page: Page, name: string) =>
  page.getByRole('dialog').getByRole('button', { name, exact: true });
const hitPoints = (page: Page) => page.locator('[data-path="hp.max"]');

test('SHEET-40 the pad takes damage, heals and adds temporary hit points, each with Undo', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 12 of 12, temporary 0/);

  // Damage 5: the pad shows "12 / 12 → 7 / 12" before it applies.
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '5').click();
  await expect(page.getByTestId('pad-summary')).toHaveText('12 / 12 → 7 / 12');
  await expect(page.getByTestId('pad-amount')).toHaveText('5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('pad-dark.png') });
  await key(page, 'Take 5 damage').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 7 of 12/);
  await expect(page.getByRole('status')).toContainText('Damage taken');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 12 of 12/);

  // Heal: from 12 nothing is regained, so the pad will not apply it.
  await page.getByRole('button', { name: en.sheet.heal, exact: true }).click();
  await key(page, '3').click();
  await expect(key(page, 'Heal 3')).toBeDisabled();
  await page.keyboard.press('Escape');

  // Take 6, then heal 4 through the pad (7 → ... 6 then 10).
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '6').click();
  await key(page, 'Take 6 damage').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: en.sheet.heal, exact: true }).click();
  await key(page, '4').click();
  await expect(page.getByTestId('pad-summary')).toHaveText('6 / 12 → 10 / 12');
  await key(page, 'Heal 4').click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 10 of 12/);

  // Temp HP: the digits 1 then 2 make 12; Clear and Delete take them back.
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Temp HP', exact: true }).click();
  await key(page, '1').click();
  await key(page, '2').click();
  await expect(page.getByTestId('pad-amount')).toHaveText('12');
  await key(page, 'Delete the last digit').click();
  await expect(page.getByTestId('pad-amount')).toHaveText('1');
  await key(page, 'Clear').click();
  await expect(page.getByTestId('pad-amount')).toHaveText('0');
  await key(page, '5').click();
  await expect(page.getByTestId('pad-summary')).toHaveText('10 / 12 → 10 / 12+5');
  await key(page, 'Add 5 temporary HP').click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 10 of 12, temporary 5/);

  // Temporary hit points never add up: 3 is lower, so the pad offers to replace them.
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Temp HP', exact: true }).click();
  await key(page, '3').click();
  await expect(page.getByTestId('pad-summary')).toHaveText('10 / 12 → 10 / 12+5');
  await page.getByRole('switch', { name: 'Replace my 5 temporary HP' }).click();
  await expect(page.getByTestId('pad-summary')).toHaveText('10 / 12 → 10 / 12+3');
  await page.keyboard.press('Escape');
});

test('SHEET-40 in 2024 the pad offers a knock-out for damage that would drop to 0', async ({
  page,
}) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '1').click();
  await key(page, '1').click();
  await expect(page.getByRole('switch', { name: /Knock out instead/ })).toHaveCount(0);
  await key(page, 'Delete the last digit').click();
  await key(page, '2').click();
  // 12 damage to 12 hit points: it would drop to 0.
  await expect(page.getByRole('switch', { name: /Knock out instead/ })).toBeVisible();
  await expect(page.getByTestId('pad-summary')).toHaveText('12 / 12 → 0 / 12');
  await page.getByRole('switch', { name: /Knock out instead/ }).click();
  await expect(page.getByTestId('pad-summary')).toHaveText('12 / 12 → 1 / 12');
  await key(page, 'Take 12 damage').click();
  await expect(page.getByTestId('pad-follow')).toContainText('Knocked out at 1 hit point.');
  await key(page, 'Done').click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 1 of 12/);
});

test('SHEET-40 damage to a concentrating character asks for the save; losing it ends the concentration', async ({
  page,
}, testInfo) => {
  const holding = {
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: { ...goldenA.systemData.state, concentration: 'srd-2014:spell/bless' },
    },
  };
  await saveRows(page, [holding]);
  await page.goto(`characters/${goldenA.id}?tab=combat`);
  await expect(page.locator('[data-concentration]')).toBeVisible();

  // 4 damage: the Constitution save is DC 10 (the higher of 10 and half the damage).
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '4').click();
  await key(page, 'Take 4 damage').click();
  const follow = page.getByTestId('pad-follow');
  await expect(follow).toContainText('Constitution save, DC 10, to keep concentrating on Bless.');
  await page.screenshot({ path: testInfo.outputPath('pad-concentration-dark.png') });

  // The save rolls in the roll dialog; the concentration is still held.
  await key(page, 'Roll the save').click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  // One Escape closes the roll dialog only (SHEET-73); the pad stays.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(key(page, 'Lost it: end concentration')).toBeVisible();
  await expect(page.locator('[data-concentration]')).toBeVisible();

  // Losing it ends the concentration: its card goes from the Combat tab.
  await key(page, 'Lost it: end concentration').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-concentration]')).toHaveCount(0);
});

test('SHEET-40 damage that drops a concentrating character to 0 ends the concentration and says so', async ({
  page,
}) => {
  const holding = {
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: { ...goldenA.systemData.state, concentration: 'srd-2014:spell/bless' },
    },
  };
  await saveRows(page, [holding]);
  await page.goto(`characters/${goldenA.id}?tab=combat`);
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '1').click();
  await key(page, '2').click();
  await key(page, 'Take 12 damage').click();
  const follow = page.getByTestId('pad-follow');
  await expect(follow).toContainText('Dropped to 0 hit points.');
  await expect(follow).toContainText('Concentration on Bless ended.');
  await key(page, 'Done').click();
  await expect(page.locator('[data-concentration]')).toHaveCount(0);
});

/** Golden B with its hit points, death saves and knock-out stored as given. */
function downed(patch: {
  hp?: { current: number; temp: number };
  deathSaves?: { success: number; failure: number; stable: boolean };
  knockedOut?: 'resting' | 'interrupted';
  conditions?: { id: string; level?: number }[];
}) {
  const { conditions, ...state } = patch;
  return {
    ...goldenB,
    state: { ...goldenB.state, ...(conditions !== undefined && { conditions }) },
    systemData: {
      ...goldenB.systemData,
      state: { ...goldenB.systemData.state, ...state },
    },
  };
}

test('SHEET-43 a dying character rolls death saves: a natural 1 is two failures, the third is death, a revival brings it back', async ({
  page,
}, testInfo) => {
  // Every die roll gives face 1 while this flag is set (a zero from the secure source).
  await page.addInitScript(() => {
    const real = crypto.getRandomValues.bind(crypto);
    (window as unknown as { zeroDice: boolean }).zeroDice = false;
    crypto.getRandomValues = ((array: ArrayBufferView) => {
      if ((window as unknown as { zeroDice: boolean }).zeroDice) {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
        return array;
      }
      return real(array as never);
    }) as typeof crypto.getRandomValues;
  });
  await saveRows(page, [
    downed({ hp: { current: 0, temp: 0 }, deathSaves: { success: 0, failure: 0, stable: false } }),
  ]);
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  const card = page.locator('[data-death-state]');
  await expect(card).toHaveAttribute('data-death-state', 'dying');
  await expect(card.getByTestId('death-failure')).toHaveAttribute('aria-label', 'Failures: 0 of 3');
  await page.screenshot({ path: testInfo.outputPath('death-dark.png') });

  await page.evaluate(() => {
    (window as unknown as { zeroDice: boolean }).zeroDice = true;
  });
  await card.getByRole('button', { name: 'Roll death save' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('roll-formula')).toHaveText('1d20 (Death save)');
  await dialog.getByRole('button', { name: en.roll.roll, exact: true }).click();
  await expect(dialog.getByTestId('death-outcome')).toHaveText('Natural 1: two failures.');
  await expect(card.getByTestId('death-failure')).toHaveAttribute('aria-label', 'Failures: 2 of 3');

  // The third failure is death.
  await dialog.getByRole('button', { name: en.roll.again, exact: true }).click();
  await expect(dialog.getByTestId('death-outcome')).toContainText(
    'Three failures: the character is dead.',
  );
  await dialog.getByRole('button', { name: en.roll.done, exact: true }).click();
  await expect(card).toHaveAttribute('data-death-state', 'dead');

  // A revival with 1 hit point ends it; Undo brings the death back.
  await card.getByRole('button', { name: 'Revive with 1 hit point' }).click();
  await expect(page.locator('[data-death-state]')).toHaveCount(0);
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 1 of 12/);
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(card).toHaveAttribute('data-death-state', 'dead');
});

test('SHEET-43 stabilizing ends the saves; a stable character regains 1 hit point', async ({
  page,
}) => {
  await saveRows(page, [
    downed({ hp: { current: 0, temp: 0 }, deathSaves: { success: 1, failure: 2, stable: false } }),
  ]);
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  const card = page.locator('[data-death-state]');
  await expect(card.getByTestId('death-success')).toHaveAttribute(
    'aria-label',
    'Successes: 1 of 3',
  );
  await card.getByRole('button', { name: 'Stabilize' }).click();
  await expect(card).toHaveAttribute('data-death-state', 'stable');
  await expect(card).toContainText('It makes no death saves.');
  await expect(card.getByRole('button', { name: 'Roll death save' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Regain 1 hit point' }).click();
  await expect(page.locator('[data-death-state]')).toHaveCount(0);
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 1 of 12/);
});

test('SHEET-43 a knocked-out character at 1 hit point is given first aid', async ({ page }) => {
  await saveRows(page, [downed({ hp: { current: 1, temp: 0 }, knockedOut: 'resting' })]);
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  const card = page.locator('[data-death-state]');
  await expect(card).toHaveAttribute('data-death-state', 'knockedOut');
  await card.getByRole('button', { name: 'First aid given' }).click();
  await expect(page.locator('[data-death-state]')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('First aid given');
});

test('SHEET-43 exhaustion at its highest level is death; a 2024 revival lowers it by one level', async ({
  page,
}) => {
  await saveRows(page, [
    downed({ conditions: [{ id: 'srd-2024:condition/exhaustion', level: 6 }] }),
  ]);
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  const card = page.locator('[data-death-state]');
  const chip = page.locator('[data-condition="srd-2024:condition/exhaustion"]');
  await expect(card).toHaveAttribute('data-death-state', 'dead');
  await expect(chip).toHaveText('Exhaustion · death');
  // SRD 5.2.1: a revived creature comes back with 1 fewer Exhaustion level (ENG-66 §8).
  await card.getByRole('button', { name: 'Revive with 1 hit point' }).click();
  await expect(page.locator('[data-death-state]')).toHaveCount(0);
  await expect(chip).toHaveText('Exhaustion 5');
});

test('SHEET-44 the Combat tab lists the attacks; a tap rolls the attack', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  const row = page.locator('[data-attack="greatsword"]');
  // Golden B (SPEC §6.7): +5 to hit, 2d6 +3 slashing, mastery Graze.
  await expect(row).toContainText('Greatsword');
  await expect(row).toContainText('Melee · Mastery: Graze');
  await expect(row.locator('[data-path="attacks.greatsword.hit"]')).toHaveText('Attack+5');
  await expect(row.locator('[data-path="attacks.greatsword.damage"]')).toHaveText('Damage bonus+3');
  await expect(row).toContainText('2d6');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('attacks-dark.png') });

  // The name opens its description in place.
  await row.getByRole('button', { name: /Greatsword/ }).click();
  await expect(row.getByRole('button', { name: en.description.seeFull })).toBeVisible();

  // A tap rolls the attack through the roll dialog: d20 + 5.
  await row.locator('[data-path="attacks.greatsword.hit"]').click();
  await expect(page.getByTestId('roll-formula')).toContainText('1d20 + 5');
  await page.getByRole('button', { name: en.roll.done, exact: true }).click();
});

test('SHEET-44 the Combat tab says where to equip a weapon when none is equipped', async ({
  page,
}) => {
  const bare = {
    ...goldenB,
    systemData: {
      ...goldenB.systemData,
      inventory: goldenB.systemData.inventory.map((row) => ({ ...row, equipped: false })),
    },
  };
  await saveRows(page, [bare]);
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  await expect(page.getByRole('tabpanel')).toContainText(
    'No attack. Equip a weapon on the Gear tab.',
  );
});

test('SHEET-71 the undo toast shows above an open panel and is tapped there', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const tab = page.getByRole('tabpanel');
  await tab.getByRole('button', { name: en.conditions.add, exact: true }).click();
  await page.locator('[data-condition="srd-2024:condition/exhaustion"] button').click();
  const chip = tab.locator('[data-condition="srd-2024:condition/exhaustion"]');
  await chip.getByRole('button').click();
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'Set Exhaustion to level 2' }).click();
  await expect(chip).toHaveText('Exhaustion 2');

  // The toast is at the top while the panel is open, so the panel's own level buttons stay free.
  const toastBox = await page.getByRole('status').locator('> *').boundingBox();
  const panelBox = await panel.boundingBox();
  expect((toastBox?.y ?? 0) + (toastBox?.height ?? 0)).toBeLessThanOrEqual(panelBox?.y ?? 0);
  // The Undo button is the top element at its own centre: nothing of the panel covers it.
  const undo = page.getByRole('button', { name: en.toast.undo });
  await expect(undo).toBeVisible();
  const covered = await undo.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) !== button;
  });
  expect(covered).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('toast-over-panel-dark.png') });

  await undo.click();
  await expect(chip).toHaveText('Exhaustion 1');
  await expect(panel).toBeVisible();
});

test('SHEET-73 Escape closes the panel on top, one panel for each press', async ({ page }) => {
  const holding = {
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: { ...goldenA.systemData.state, concentration: 'srd-2014:spell/bless' },
    },
  };
  await saveRows(page, [holding]);
  await page.goto(`characters/${goldenA.id}?tab=combat`);
  // The pad, and over it the roll dialog of the concentration save.
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '4').click();
  await key(page, 'Take 4 damage').click();
  await key(page, 'Roll the save').click();
  await expect(page.getByRole('dialog')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByTestId('pad-follow')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The panel left alone is closed by a key as before, and the key does nothing with none open.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

/** Golden B hurt to `current` hit points with `secondWind` uses of Second Wind spent. */
const winded = (current: number, secondWind: number) => ({
  ...goldenB,
  state: { ...goldenB.state, resources: { secondWind } },
  systemData: {
    ...goldenB.systemData,
    state: { ...goldenB.systemData.state, hp: { current, temp: 0 } },
  },
});

test('SHEET-45 the Rest panel: a short rest spends a hit die, a long rest lists what comes back, each with Undo', async ({
  page,
}, testInfo) => {
  // Every die roll gives face 1 while this flag is set (a zero from the secure source).
  await page.addInitScript(() => {
    const real = crypto.getRandomValues.bind(crypto);
    (window as unknown as { zeroDice: boolean }).zeroDice = true;
    crypto.getRandomValues = ((array: ArrayBufferView) => {
      if ((window as unknown as { zeroDice: boolean }).zeroDice) {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
        return array;
      }
      return real(array as never);
    }) as typeof crypto.getRandomValues;
  });
  await saveRows(page, [winded(4, 2)]);
  await page.goto(`characters/${goldenB.id}`);
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 4 of 12/);

  // The board's two cards, each listing what its rest gives back.
  await page.getByRole('button', { name: en.sheet.rest, exact: true }).click();
  const panel = page.getByRole('dialog');
  await expect(panel.locator('[data-rest="short"]')).toContainText(
    'Second Wind: 1 use back, 1 of 2 left',
  );
  await expect(panel.locator('[data-rest="short"]')).toContainText('Spend hit dice to heal');
  await expect(panel.locator('[data-rest="long"]')).toContainText('Hit points back to 12');
  await expect(panel.locator('[data-rest="long"]')).toContainText(
    'Second Wind: 2 uses back, 2 of 2 left',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('rest-cards-dark.png') });

  // The short frame: the d10 rolls 1, plus Constitution +2 is 3 hit points: 4 → 7 of 12.
  await panel.locator('[data-rest="short"]').getByRole('button', { name: 'Short rest' }).click();
  await expect(panel.getByTestId('rest-dice')).toContainText('d10: 1 of 1 left');
  await panel.getByRole('button', { name: 'Spend a d10 hit die' }).click();
  await expect(panel.getByTestId('rest-dice')).toContainText('d10: 0 of 1 left');
  await expect(panel.getByRole('button', { name: 'Spend a d10 hit die' })).toBeDisabled();
  await expect(panel.getByTestId('rest-spent')).toContainText('d10 rolled 1: 3 hit points');
  await expect(panel.getByTestId('rest-lines')).toContainText('Hit points 4 → 7 of 12');
  await expect(panel.getByTestId('rest-lines')).toContainText(
    'Second Wind: 1 use back, 1 of 2 left',
  );
  await expect(panel.getByTestId('rest-food')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('rest-short-dark.png') });

  // A die taken back leaves the list as it was; spending again and confirming is one change.
  await panel.getByRole('button', { name: 'Take back the d10 that rolled 1' }).click();
  await expect(panel.getByTestId('rest-dice')).toContainText('d10: 1 of 1 left');
  await expect(panel.getByTestId('rest-lines')).not.toContainText('Hit points');
  await panel.getByRole('button', { name: 'Spend a d10 hit die' }).click();
  await panel.getByRole('button', { name: en.rest.confirm }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 7 of 12/);
  await expect(page.getByRole('status')).toContainText('Short rest taken');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 4 of 12/);

  // The long frame lists before it confirms; Cancel goes back to the cards.
  await page.getByRole('button', { name: en.sheet.rest, exact: true }).click();
  await panel.locator('[data-rest="long"]').getByRole('button', { name: 'Long rest' }).click();
  await expect(panel.getByTestId('rest-lines')).toContainText('Hit points back to 12');
  await expect(panel.getByTestId('rest-lines')).toContainText(
    'Second Wind: 2 uses back, 2 of 2 left',
  );
  await expect(panel.getByTestId('rest-food')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('rest-long-dark.png') });
  await panel.getByRole('button', { name: en.rest.cancel }).click();
  await expect(panel.locator('[data-rest="short"]')).toBeVisible();
  await panel.locator('[data-rest="long"]').getByRole('button', { name: 'Long rest' }).click();
  await panel.getByRole('button', { name: en.rest.confirm }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 12 of 12/);
  await expect(page.getByRole('status')).toContainText('Long rest taken');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 4 of 12/);
});

test('SHEET-45 the 2014 long rest says food and drink for exhaustion', async ({ page }) => {
  const hurt = {
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: { ...goldenA.systemData.state, hp: { current: 5, temp: 0 } },
    },
  };
  await saveRows(page, [hurt]);
  await page.goto(`characters/${goldenA.id}`);
  await page.getByRole('button', { name: en.sheet.rest, exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.locator('[data-rest="long"]').getByRole('button', { name: 'Long rest' }).click();
  await expect(panel.getByTestId('rest-food')).toHaveText(en.rest.food);
  await expect(panel.getByTestId('rest-food')).toContainText(
    'only if the character also ate and drank',
  );
});

/** A made-up spell that needs concentration, to replace Bless. */
const haze = {
  id: 'character:spell/haze',
  type: 'spell',
  ruleset: 'any',
  name: { en: 'Haze' },
  source: { pack: 'character' },
  level: 1,
  school: 'illusion',
  castingTime: { value: 1, unit: 'action' },
  range: { kind: 'self' },
  components: { v: true, s: true },
  duration: { kind: 'timed', value: 1, unit: 'minute' },
  concentration: true,
  ritual: false,
  classes: ['wizard'],
};

/** Golden C (SPEC §6.7: wizard 3, paladin 3, slots 4 and 3) with spells prepared, holding `held`. */
const caster = (held?: string) => ({
  ...goldenC2014,
  localEntities: [haze],
  systemData: {
    ...goldenC2014.systemData,
    spells: {
      'srd-2014:class/wizard': { prepared: [haze.id] },
      'srd-2014:class/paladin': {
        prepared: ['srd-2014:spell/cure-wounds', 'srd-2014:spell/bless'],
      },
    },
    state: {
      ...goldenC2014.systemData.state,
      ...(held !== undefined && { concentration: held }),
    },
  },
});

const spellRow = (page: Page, id: string) =>
  page.getByRole('tabpanel').locator(`[data-spell="${id}"]`).getByRole('button').first();

test('SHEET-47 the cast panel shows the dice at the slot picked and casts with it, with Undo', async ({
  page,
}, testInfo) => {
  await saveRows(page, [caster()]);
  await page.goto(`characters/${goldenC2014.id}?tab=spells`);
  const tab = page.getByRole('tabpanel');
  await spellRow(page, 'srd-2014:spell/cure-wounds').click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByRole('heading', { name: 'Cure Wounds' })).toBeVisible();
  await expect(panel.getByTestId('cast-line')).toHaveText(
    'Level 1 · Evocation · Slots left: Level 1 4 of 4 · Level 2 3 of 3',
  );

  // 1d8 + Charisma +2 at a level 1 slot; a level 2 slot adds 1d8 (SRD 5.1).
  await expect(panel.getByTestId('cast-healing')).toHaveText('Healing: 1d8 + 2');
  await panel.getByRole('button', { name: 'Level 2', exact: true }).click();
  await expect(panel.getByTestId('cast-healing')).toHaveText('Healing: 2d8 + 2');
  await panel.getByRole('button', { name: en.cast.rollHealing, exact: true }).click();
  await expect(panel.getByTestId('cast-rolled')).toContainText('Rolled:');
  await panel.getByRole('button', { name: en.description.seeFull }).click();
  // Cast stays in view over the long text.
  await expect(panel.getByRole('button', { name: en.cast.cast, exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('cast-dark.png') });

  // Cast spends the level 2 slot: one change with its toast.
  await panel.getByRole('button', { name: en.cast.cast, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(tab.locator('[data-slot="2"]').getByTestId('slots-left')).toHaveText('2 of 3 left');
  await expect(tab.locator('[data-slot="1"]').getByTestId('slots-left')).toHaveText('4 of 4 left');
  await expect(page.getByRole('status')).toContainText('Cure Wounds cast');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(tab.locator('[data-slot="2"]').getByTestId('slots-left')).toHaveText('3 of 3 left');

  // "Don't use a spell slot" casts for free: nothing is spent, so there is nothing to store.
  await spellRow(page, 'srd-2014:spell/cure-wounds').click();
  await panel.getByRole('switch', { name: en.cast.noSlot }).click();
  await expect(panel.getByRole('button', { name: 'Level 1', exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: en.cast.cast, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(tab.locator('[data-slot="1"]').getByTestId('slots-left')).toHaveText('4 of 4 left');
});

test('SHEET-47 a new concentration ends the old one only after a confirmation', async ({
  page,
}, testInfo) => {
  await saveRows(page, [caster('srd-2014:spell/bless')]);
  await page.goto(`characters/${goldenC2014.id}?tab=combat`);
  await expect(page.locator('[data-concentration]')).toContainText('Bless');
  await page.getByRole('tab', { name: 'Spells' }).click();
  await spellRow(page, haze.id).click();
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: en.cast.cast, exact: true }).click();

  // Nothing is cast yet: the panel asks, and Back leaves the concentration as it was.
  await expect(panel.getByTestId('cast-confirm')).toContainText(
    'Casting Haze ends your concentration on Bless.',
  );
  await page.screenshot({ path: testInfo.outputPath('cast-confirm-dark.png') });
  await panel.getByRole('button', { name: en.cast.concentration.back }).click();
  await expect(panel.getByTestId('cast-confirm')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Combat' }).click();
  await expect(page.locator('[data-concentration]')).toContainText('Bless');

  // Confirmed: Haze is held, and Undo brings Bless back.
  await page.getByRole('tab', { name: 'Spells' }).click();
  await spellRow(page, haze.id).click();
  await panel.getByRole('button', { name: en.cast.cast, exact: true }).click();
  await panel.getByRole('button', { name: en.cast.concentration.ok }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Combat' }).click();
  await expect(page.locator('[data-concentration]')).toContainText('Haze');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(page.locator('[data-concentration]')).toContainText('Bless');
});

test('SHEET-49 the Turn tab lists the attack and the features by timing, each opening in place', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=turn`);
  const tab = page.getByRole('tabpanel');
  await expect(tab.getByRole('heading', { name: en.turn.title })).toBeVisible();
  await expect(tab).toContainText('a reminder, from your features');

  // Golden B (SPEC §6.7): the greatsword is +5 to hit, 2d6 +3 slashing, mastery Graze.
  const attack = tab.locator('[data-turn-attack="greatsword"]');
  await expect(attack).toContainText('Attack: Greatsword');
  await expect(attack.locator('[data-path="attacks.greatsword.hit"]')).toHaveText('+5to hit');
  await expect(attack).toContainText('2d6');
  await expect(attack).toContainText('Mastery: Graze');

  // Second Wind is a Bonus Action with 2 uses (SRD 5.2.1, Fighter).
  const bonus = tab.locator('[data-timing="bonus"]');
  await expect(bonus.getByRole('heading', { name: en.turn.group.bonus })).toBeVisible();
  const wind = bonus.locator('[data-turn-feature="srd-2024:feature/fighter-second-wind"]');
  await expect(wind).toContainText('Fighter · 2 of 2 left');
  await expect(wind.getByTestId('recovery')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('turn-dark.png') });

  // A name opens its description in place; the attack's bonus still rolls.
  await wind.getByRole('button', { name: /Second Wind/ }).click();
  await expect(wind.getByRole('button', { name: en.description.seeFull })).toBeVisible();
  await attack.locator('[data-path="attacks.greatsword.hit"]').click();
  await expect(page.getByTestId('roll-formula')).toContainText('1d20 + 5');
});

test('SHEET-82 a toast goes after its time once the toast before it was undone', async ({
  page,
}) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  const gold = page.getByRole('tabpanel').locator('[data-coin="gp"]');
  const undo = page.getByRole('button', { name: en.toast.undo });
  await gold.getByRole('button', { name: 'Add 1 gold' }).click();
  await expect(undo).toBeVisible();
  // The tap on "Undo" removes the button that has the focus; the next toast still goes in 5 s.
  await undo.click();
  await expect(undo).toBeHidden();
  await gold.getByRole('button', { name: 'Add 1 gold' }).click();
  await expect(undo).toBeVisible();
  await expect(undo).toBeHidden({ timeout: 7000 });
});

test('SHEET-81 the toast sits above the dice button and the "+", which stay tappable', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  const add = page.getByRole('button', { name: 'Add to the sheet' });
  const dice = page.getByRole('button', { name: en.sheet.dice });
  const gold = page.getByRole('tabpanel').locator('[data-coin="gp"]');
  await gold.getByRole('button', { name: 'Add 1 gold' }).click();
  await expect(page.getByRole('button', { name: en.toast.undo })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('toast-over-buttons-dark.png') });

  // The toast's bottom edge is above both buttons' top edges; neither button is covered.
  const toast = await page.getByRole('status').boundingBox();
  const addBox = await add.boundingBox();
  const diceBox = await dice.boundingBox();
  if (!toast || !addBox || !diceBox) throw new Error('a box is missing');
  expect(toast.y + toast.height).toBeLessThanOrEqual(Math.min(addBox.y, diceBox.y));
  expect(toast.width).toBe(360 - 32);

  // A tap on each works at once, while the toast shows.
  await dice.click({ timeout: 1000 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await add.click({ timeout: 1000 });
  await expect(page.getByRole('dialog', { name: 'Add to the sheet' })).toBeVisible();
});

test('SHEET-78 a second context menu on the same number opens its breakdown again', async ({
  page,
}) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const sheet = page.getByRole('dialog', { name: en.breakdown.title });
  const strength = number(page, 'abilities.str.score');
  for (const _ of [1, 2, 3]) {
    await strength.click({ button: 'right' });
    await expect(page.getByTestId('breakdown-summary')).toHaveText(
      'Strength score 17 = Base 15, Soldier +2',
    );
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  }
});

test('SHEET-77 a disabled button is fainter than an enabled one, from a theme token', async ({
  page,
}, testInfo) => {
  await saveRows(page, [
    {
      ...goldenB,
      systemData: { ...goldenB.systemData, currency: { cp: 0, sp: 0, ep: 0, gp: 12, pp: 0 } },
    },
  ]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  const tab = page.getByRole('tabpanel');
  const style = (name: string) =>
    tab.getByRole('button', { name, exact: true }).evaluate((node) => ({
      opacity: getComputedStyle(node).opacity,
      cursor: getComputedStyle(node).cursor,
    }));
  // 12 gold can lose 10 or 1; 0 copper can lose nothing; the token is 0.5.
  await expect(tab.getByRole('button', { name: 'Take 1 copper' })).toBeDisabled();
  expect(await style('Take 1 copper')).toEqual({ opacity: '0.5', cursor: 'not-allowed' });
  expect(await style('Take 10 gold')).toEqual({ opacity: '1', cursor: 'default' });
  // The token is the one place: a skin that sets it to 0.2 changes every disabled button.
  await page.evaluate(() =>
    document.documentElement.style.setProperty('--theme-opacity-disabled', '0.2'),
  );
  expect((await style('Take 1 copper')).opacity).toBe('0.2');
  await page.evaluate(() =>
    document.documentElement.style.removeProperty('--theme-opacity-disabled'),
  );
  await tab.locator('[data-coin="cp"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('disabled-dark.png') });
});

test('SHEET-75 the attribution line in a full description wraps inside the card', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}?tab=features`);
  const row = page.locator('[data-feature="srd-2024:feature/fighter-second-wind"]');
  await row
    .getByRole('button', { name: /Second Wind/ })
    .first()
    .click();
  await row.getByRole('button', { name: en.description.seeFull }).click();
  const lines = row.getByRole('paragraph');
  const attribution = lines.filter({ hasText: 'creativecommons.org/licenses/by/4.0/legalcode' });
  await expect(attribution).toBeVisible();
  // No line of the full text is wider than its box, and the page is 360 px wide.
  const overflow = await lines.evaluateAll((nodes) =>
    nodes.map((node) => node.scrollWidth - node.clientWidth),
  );
  expect(overflow.every((extra) => extra <= 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await attribution.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('attribution-dark.png') });
});

test('SHEET-70 the header keeps the class line whole beside the choices badge', async ({
  page,
}, testInfo) => {
  const undecided = {
    ...goldenB,
    choices: {},
    systemData: { ...goldenB.systemData, species: { id: 'srd-2024:species/human' } },
  };
  await saveRows(page, [undecided]);
  await page.goto(`characters/${goldenB.id}`);
  const header = page.getByRole('banner');
  const badge = header.getByRole('button', { name: /choices to make/ });
  await expect(badge).toHaveText('!8');
  const classLine = header.getByText('Fighter 1', { exact: true });
  await expect(classLine).toBeVisible();
  // The class line is not cut, and nothing in the header's text column is cut or overlaps a button.
  const cut = await classLine.evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(cut).toBeLessThanOrEqual(0);
  const rest = await header.getByRole('button', { name: en.sheet.rest }).boundingBox();
  const shown = await badge.boundingBox();
  if (!rest || !shown) throw new Error('a box is missing');
  expect(shown.x + shown.width).toBeLessThanOrEqual(rest.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({
    path: testInfo.outputPath('header-badge-dark.png'),
    clip: { x: 0, y: 0, width: 360, height: 220 },
  });
  // The badge answers as before.
  await badge.click();
  await expect(page.getByRole('dialog', { name: en.choices.title })).toBeVisible();
});

test('SHEET-70 with no choices badge the header’s first row stays 64 px', async ({ page }) => {
  await saveRows(page, [goldenB]);
  await page.goto(`characters/${goldenB.id}`);
  const header = page.getByRole('banner');
  await expect(header.getByText('Fighter 1', { exact: true })).toBeVisible();
  await expect(header.getByRole('button', { name: /choices to make/ })).toHaveCount(0);
  const row = await header
    .getByRole('heading', { level: 1 })
    .evaluate((node) => node.parentElement?.parentElement?.getBoundingClientRect().height);
  expect(row).toBe(64);
});

test('SHEET-35 the AC breakdown pins its base calculation, with Undo', async ({
  page,
}, testInfo) => {
  // Golden B: chain mail 16, Defense +1, so 17. A feat of its own appends 13 + DEX 1 = 14 (+1 = 15).
  await saveRows(page, [
    {
      ...goldenB,
      localEntities: [
        {
          id: 'character:feat/plated',
          type: 'feat',
          ruleset: 'any',
          name: { en: 'Plated' },
          source: { pack: 'character' },
          effects: [
            { id: 'plated', target: 'ac.formulas', op: 'append', value: '13 + @abilities.dex.mod' },
          ],
        },
      ],
      systemData: { ...goldenB.systemData, feats: [{ id: 'character:feat/plated' }] },
    },
  ]);
  await page.goto(`characters/${goldenB.id}`);
  const sheet = page.getByRole('dialog', { name: en.breakdown.title });
  const choice = sheet.getByTestId('base-choice');
  const radio = (name: string | RegExp) => choice.getByRole('radio', { name });
  const ac = number(page, 'ac.total');
  await expect(ac).toContainText('17');

  // Play mode shows the calculations and says how to unlock them.
  await ac.click({ button: 'right' });
  await expect(radio(/^Highest/)).toHaveAttribute('aria-checked', 'true');
  await expect(radio(/^Chain Mail/)).toBeDisabled();
  await expect(choice.getByTestId('base-locked')).toBeVisible();
  await page.keyboard.press('Escape');

  // Edit mode: pick the lower one. The number, the breakdown and the toast follow.
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await ac.click({ button: 'right' });
  await expect(radio(/^Chain Mail/)).toContainText('16');
  await expect(radio(/^Plated/)).toContainText('14');
  await page.screenshot({ path: testInfo.outputPath('base-choice-dark.png') });
  await radio(/^Plated/).click();
  await expect(radio(/^Plated/)).toHaveAttribute('aria-checked', 'true');
  await expect(sheet.getByTestId('breakdown-summary')).toHaveText(
    'AC 15 = AC base 14, AC bonus +1',
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'Base AC calculation changed' }),
  ).toBeVisible();

  // It is stored: a reload keeps it. Undo takes it back to the highest, 17.
  await page.reload();
  await expect(ac).toContainText('15');
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  await ac.click({ button: 'right' });
  await expect(radio(/^Plated/)).toHaveAttribute('aria-checked', 'true');
  await radio(/^Highest/).click();
  await expect(radio(/^Highest/)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(ac).toContainText('17');
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(ac).toContainText('15');
});

test('SHEET-69 with "I roll myself" on, the roll dialog counts the d20 and the damage dice typed', async ({
  page,
}, testInfo) => {
  await saveRows(page, [goldenB]);
  await saveRows(page, [{ key: 'rollMyself', value: true }], 'settings');
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  await page.locator('[data-attack="greatsword"] [data-path="attacks.greatsword.hit"]').click();

  const dialog = page.getByRole('dialog', { name: en.roll.title });
  const roll = dialog.getByRole('button', { name: en.roll.roll, exact: true });
  const d20 = dialog.getByRole('spinbutton', { name: '1d20, die 1' });
  await expect(roll).toBeDisabled();
  await d20.fill('21');
  await expect(roll).toBeDisabled();
  await d20.fill('20');
  await expect(roll).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('roll-typed-before.png') });
  await roll.click();

  // A natural 20 is a critical hit; the typed face is the die, +5 is the sheet's.
  await expect(page.getByTestId('roll-total')).toHaveText('25');
  await expect(dialog.getByText(en.roll.outcome.criticalHit)).toBeVisible();
  expect(await facesOf(page)).toEqual([{ face: 20, kept: true }]);

  // The critical damage is 4d6 + 3: four typed faces, and the button waits for them.
  const damage = dialog.getByRole('button', { name: en.roll.rollCritical });
  await expect(damage).toBeDisabled();
  for (const [n, face] of ['6', '5', '4', '7'].entries()) {
    await dialog.getByRole('spinbutton', { name: `4d6, die ${n + 1}` }).fill(face);
  }
  await expect(damage).toBeDisabled();
  await dialog.getByRole('spinbutton', { name: '4d6, die 4' }).fill('3');
  await expect(damage).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('roll-typed-damage.png') });
  await damage.click();
  await expect(page.getByTestId('damage-total')).toHaveText('Damage 21');

  // A new roll asks for its own face: the typed ones are spent.
  await expect(dialog.getByRole('button', { name: en.roll.again })).toBeDisabled();
});

test('SHEET-74 with "I roll myself" on, a short rest’s hit die counts the face typed', async ({
  page,
}, testInfo) => {
  await saveRows(page, [winded(4, 2)]);
  await saveRows(page, [{ key: 'rollMyself', value: true }], 'settings');
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('button', { name: en.sheet.rest, exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.locator('[data-rest="short"]').getByRole('button', { name: 'Short rest' }).click();

  // The d10 has a field; the spend waits for a face from 1 to 10.
  const spend = panel.getByRole('button', { name: 'Spend a d10 hit die' });
  const die = panel.getByRole('spinbutton', { name: '1d10, die 1' });
  await expect(spend).toBeDisabled();
  await die.fill('11');
  await expect(spend).toBeDisabled();
  await die.fill('0');
  await expect(spend).toBeDisabled();
  await die.fill('5');
  await expect(spend).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('rest-typed-dark.png') });

  // 5 + Constitution +2 is 7 hit points: 4 → 11 of 12 (SPEC §6.7 golden B).
  await spend.click();
  await expect(panel.getByTestId('rest-spent')).toContainText('d10 rolled 5: 7 hit points');
  await expect(panel.getByTestId('rest-lines')).toContainText('Hit points 4 → 11 of 12');
  await expect(panel.getByTestId('rest-dice')).toContainText('d10: 0 of 1 left');
  // The typed face is spent; taking the die back asks for a face again.
  await panel.getByRole('button', { name: 'Take back the d10 that rolled 5' }).click();
  await expect(spend).toBeDisabled();
  await expect(die).toHaveValue('');
});

test('SHEET-74 with "I roll myself" on, the cast panel’s healing roll counts the faces typed', async ({
  page,
}, testInfo) => {
  await saveRows(page, [caster()]);
  await saveRows(page, [{ key: 'rollMyself', value: true }], 'settings');
  await page.goto(`characters/${goldenC2014.id}?tab=spells`);
  await spellRow(page, 'srd-2014:spell/cure-wounds').click();
  const panel = page.getByRole('dialog');

  // A level 2 slot: 2d8 + 2 (SRD 5.1), so two fields; the roll waits for both.
  await panel.getByRole('button', { name: 'Level 2', exact: true }).click();
  await expect(panel.getByTestId('cast-healing')).toHaveText('Healing: 2d8 + 2');
  const roll = panel.getByRole('button', { name: en.cast.rollHealing, exact: true });
  await expect(roll).toBeDisabled();
  await panel.getByRole('spinbutton', { name: '2d8, die 1' }).fill('5');
  await expect(roll).toBeDisabled();
  await panel.getByRole('spinbutton', { name: '2d8, die 2' }).fill('9');
  await expect(roll).toBeDisabled();
  await panel.getByRole('spinbutton', { name: '2d8, die 2' }).fill('3');
  await expect(roll).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('cast-typed-dark.png') });

  // 5 + 3 + 2 = 10; the faces are spent after the roll.
  await roll.click();
  await expect(panel.getByTestId('cast-rolled')).toContainText('Rolled: 10');
  await expect(roll).toBeDisabled();
  await expect(panel.getByRole('spinbutton', { name: '2d8, die 1' })).toHaveValue('');
});

/**
 * Golden B with its own damage types (the packs hold Slashing only) and a feat of its own: it
 * resists fire, is vulnerable to cold and immune to poison.
 */
const guarded = (state: { hp: { current: number; temp: number } }) => ({
  ...downed(state),
  localEntities: [
    ...['fire', 'cold', 'poison'].map((slug) => ({
      id: `character:damageType/${slug}`,
      type: 'damageType',
      key: slug,
      ruleset: 'any',
      name: { en: `${slug.charAt(0).toUpperCase()}${slug.slice(1)}` },
      source: { pack: 'character' },
    })),
    {
      id: 'character:feat/guard',
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Guard' },
      source: { pack: 'character' },
      effects: [
        { id: 'fire', target: 'defenses.resist', op: 'append', value: 'fire' },
        { id: 'cold', target: 'defenses.vuln', op: 'append', value: 'cold' },
        { id: 'poison', target: 'defenses.immune', op: 'append', value: 'poison' },
      ],
    },
  ],
  systemData: {
    ...downed(state).systemData,
    feats: [...goldenB.systemData.feats, { id: 'character:feat/guard' }],
  },
});

test('SHEET-72 the pad takes a damage type and shows what the defenses make of it', async ({
  page,
}, testInfo) => {
  await saveRows(page, [guarded({ hp: { current: 12, temp: 0 } })]);
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '1').click();
  await key(page, '0').click();
  const fire = key(page, 'Fire');
  await expect(fire).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('pad-defended')).toHaveCount(0);
  await expect(page.getByTestId('pad-summary')).toHaveText('12 / 12 → 2 / 12');

  // Resistance halves 10: 5 is taken, 12 → 7.
  await fire.click();
  await expect(fire).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pad-defended')).toHaveText('Resistant to Fire: 10 becomes 5.');
  await expect(page.getByTestId('pad-summary')).toHaveText('12 / 12 → 7 / 12');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('pad-type-dark.png') });

  // Vulnerability doubles it: 20 takes 12 to 0.
  await key(page, 'Cold').click();
  await expect(fire).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('pad-defended')).toHaveText('Vulnerable to Cold: 10 becomes 20.');
  await expect(page.getByTestId('pad-summary')).toHaveText('12 / 12 → 0 / 12');

  // Immunity leaves none: the pad says so and will not apply it.
  await key(page, 'Poison').click();
  await expect(page.getByTestId('pad-defended')).toHaveText('Immune to Poison: 10 becomes 0.');
  await expect(page.getByRole('alert')).toContainText('takes none');
  await expect(key(page, 'Take 10 damage')).toBeDisabled();

  // A tap on the picked type takes it back; then Fire is applied, with Undo.
  await key(page, 'Poison').click();
  await expect(page.getByTestId('pad-summary')).toHaveText('12 / 12 → 2 / 12');
  await fire.click();
  await key(page, 'Take 10 damage').click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 7 of 12/);
  await page.getByRole('button', { name: en.toast.undo }).click();
  await expect(hitPoints(page)).toHaveAttribute('aria-label', /Hit points 12 of 12/);
});

test('SHEET-72 a critical hit at 0 hit points gives two death save failures', async ({
  page,
}, testInfo) => {
  await saveRows(page, [downed({ hp: { current: 0, temp: 0 } })]);
  await page.goto(`characters/${goldenB.id}?tab=combat`);
  const card = page.locator('[data-death-state]');
  await expect(card.getByTestId('death-failure')).toHaveAttribute('aria-label', 'Failures: 0 of 3');
  await page.getByRole('button', { name: en.sheet.damage, exact: true }).click();
  await key(page, '3').click();
  const critical = page.getByRole('switch', { name: en.numberPad.critical });
  await expect(critical).toHaveAttribute('aria-checked', 'false');
  await critical.click();
  await expect(critical).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: testInfo.outputPath('pad-critical-dark.png') });
  await key(page, 'Take 3 damage').click();
  await page.getByRole('button', { name: en.numberPad.done }).click();
  await expect(card.getByTestId('death-failure')).toHaveAttribute('aria-label', 'Failures: 2 of 3');
  // Heal and Temp HP offer neither a type nor the switch.
  await page.getByRole('button', { name: en.sheet.heal, exact: true }).click();
  await expect(page.getByRole('switch', { name: en.numberPad.critical })).toHaveCount(0);
  await expect(key(page, 'Fire')).toHaveCount(0);
});
