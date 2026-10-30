import { expect, type Page, test } from '@playwright/test';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { DB_NAME } from '../src/db/db';
import { en } from '../src/i18n/namespaces';

// SHEET-50: the Gear tab, in Chromium on golden B (SPEC §6.7): a human fighter 1 in chain mail
// (55 lb) with a greatsword (6 lb), AC 17. The character is saved into the app's own database, as
// the sheet spec does, then its Gear tab opens.

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

const number = (page: Page, path: string) => page.locator(`[data-path="${path}"]`);

// A made-up charm that needs attunement and gives +1 AC, and a custom backpack of 5 lb: with
// them golden B carries 55 + 6 + 5 = 66 lb.
const charm = {
  id: 'character:item/charm',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Charm' },
  source: { pack: 'character' },
  category: 'gear',
  magic: { rarity: 'rare', attunement: true },
  effects: [{ id: 'ward', target: 'ac.bonus', op: 'add', value: 1 }],
};
const carrying = {
  ...goldenB,
  localEntities: [charm],
  systemData: {
    ...goldenB.systemData,
    inventory: [
      ...goldenB.systemData.inventory,
      {
        uid: 'a8000000-0000-4000-8000-000000000001',
        itemId: charm.id,
        qty: 1,
        equipped: false,
        attuned: false,
      },
      {
        uid: 'a8000000-0000-4000-8000-000000000002',
        custom: { name: 'Backpack', weight: 5 },
        qty: 1,
        equipped: false,
        attuned: false,
      },
    ],
  },
};

test('SHEET-50 wearing and attuning change the AC at once, and Undo puts it back', async ({
  page,
}) => {
  await saveRows(page, [carrying]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  await expect(number(page, 'ac.total')).toHaveText('17AC');
  await expect(number(page, 'weight.carried')).toHaveText('Carrying66 lb');
  await expect(page.getByText('Attuned 0 of 3')).toBeVisible();

  // Chain mail off: AC 10 + DEX (1) = 11; the toast names it, and Undo wears it again.
  const chain = page.getByRole('button', { name: 'Worn: Chain Mail' });
  await expect(chain).toHaveAttribute('aria-pressed', 'true');
  await chain.tap();
  await expect(chain).toHaveAttribute('aria-pressed', 'false');
  await expect(number(page, 'ac.total')).toHaveText('11AC');
  await expect(page.getByRole('status')).toContainText('Chain Mail put away');
  await page.getByRole('button', { name: en.toast.undo }).tap();
  await expect(chain).toHaveAttribute('aria-pressed', 'true');
  await expect(number(page, 'ac.total')).toHaveText('17AC');

  // The charm: worn alone it adds nothing; attuned too, +1.
  await page.getByRole('button', { name: 'Worn: Charm' }).tap();
  await expect(number(page, 'ac.total')).toHaveText('17AC');
  await page.getByRole('button', { name: 'Attuned: Charm' }).tap();
  await expect(number(page, 'ac.total')).toHaveText('18AC');
  await expect(page.getByText('Attuned 1 of 3')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Charm attuned');

  // It stays after a reload: the change was stored.
  await page.reload();
  await expect(number(page, 'ac.total')).toHaveText('18AC');
  await expect(page.getByRole('button', { name: 'Attuned: Charm' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('SHEET-50 a row goes into a container in edit mode, and the weights follow', async ({
  page,
}, testInfo) => {
  await saveRows(page, [carrying]);
  await page.goto(`characters/${goldenB.id}?tab=gear`);
  // Play mode: no container select.
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await page.getByRole('button', { name: en.sheet.edit }).tap();
  const where = page.getByRole('combobox', { name: 'Where Greatsword is carried' });
  await where.selectOption({ label: 'In Backpack' });
  await expect(number(page, 'weight.in.a8000000-0000-4000-8000-000000000002')).toHaveText(
    'Inside6 lb',
  );
  // The greatsword is still carried once: 55 + 6 + 5.
  await expect(number(page, 'weight.carried')).toHaveText('Carrying66 lb');
  await expect(page.getByRole('status')).toContainText('Greatsword moved');
  await page.getByRole('button', { name: en.toast.undo }).tap();
  await expect(where).toHaveValue('');
  await expect(page.locator('[data-row] [data-row]')).toHaveCount(0);

  // 360 px wide, nothing spills sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('gear.png') });
});
