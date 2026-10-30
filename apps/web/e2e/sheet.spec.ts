import { expect, type Page, test } from '@playwright/test';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
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
  await expect(number(page, 'skills.perception.passive')).toHaveText('13Passive');
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

// SHEET-36: golden B without its stored choices has seven to make; the badge opens them.
test('SHEET-36 the choices badge opens the list; a choice is made and undone', async ({
  page,
}, testInfo) => {
  await saveRows(page, [{ ...goldenB, choices: {} }]);
  await page.goto(`characters/${goldenB.id}`);
  const badge = page.getByRole('button', { name: /choices to make/ });
  await expect(badge).toHaveText('!7');
  await badge.tap();

  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('listitem')).toHaveCount(7);
  await page.screenshot({ path: testInfo.outputPath('choices-list.png') });

  // The fighter's two skills: Choose waits for the second pick.
  await sheet.getByRole('button', { name: /Skills.*Fighter.*0 of 2/ }).tap();
  const choose = sheet.getByRole('button', { name: en.choices.confirm, exact: true });
  await expect(choose).toBeDisabled();
  await sheet.getByRole('button', { name: 'Perception' }).tap();
  await expect(choose).toBeDisabled();
  await sheet.getByRole('button', { name: 'Survival' }).tap();
  // Two are picked: the others cannot be.
  await expect(sheet.getByRole('button', { name: 'Athletics' })).toBeDisabled();
  await expect(choose).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('choices-skills.png') });
  await choose.tap();

  // It is stored: golden B's passive Perception is 13 with Perception chosen, 11 without.
  await expect(sheet.getByRole('listitem')).toHaveCount(6);
  await expect(badge).toHaveText('!6');
  await expect(page.getByRole('status')).toContainText(en.toast.done.makeChoice);
  await expect(number(page, 'skills.perception.passive')).toHaveText('13Passive');

  // Undo puts the choice back in the list.
  await page.getByRole('button', { name: en.toast.undo }).tap();
  await expect(sheet.getByRole('listitem')).toHaveCount(7);
  await expect(number(page, 'skills.perception.passive')).toHaveText('11Passive');

  // The soldier's ability scores: picked in order, +2 then +1.
  await sheet.getByRole('button', { name: /Ability scores.*Soldier/ }).tap();
  await sheet.getByRole('button', { name: 'Strength' }).tap();
  await sheet.getByRole('button', { name: 'Constitution' }).tap();
  await expect(sheet.getByRole('button', { name: 'Strength' })).toContainText('+2');
  await expect(sheet.getByRole('button', { name: 'Constitution' })).toContainText('+1');
  await page.screenshot({ path: testInfo.outputPath('choices-abilities.png') });
  await sheet.getByRole('button', { name: en.choices.confirm, exact: true }).tap();
  await expect(sheet.getByRole('listitem')).toHaveCount(6);
});

test('SHEET-36 a species size not chosen is answered in the list', async ({ page }) => {
  await saveRows(page, [
    {
      ...goldenB,
      systemData: { ...goldenB.systemData, species: { id: 'srd-2024:species/human' } },
    },
  ]);
  await page.goto(`characters/${goldenB.id}`);
  await page.getByRole('button', { name: '1 choices to make' }).tap();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /Size/ }).tap();
  await sheet.getByRole('button', { name: 'Small', exact: true }).tap();
  await sheet.getByRole('button', { name: en.choices.confirm, exact: true }).tap();
  await expect(sheet.getByText(en.choices.empty)).toBeVisible();
  await expect(page.getByRole('button', { name: /choices to make/ })).toHaveCount(0);
});
