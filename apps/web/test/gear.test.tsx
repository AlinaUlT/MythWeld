import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { db } from '../src/db/db';
import '../src/i18n';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { KILOGRAMS_PER_POUND, shownWeight } from '../src/settings/units';
import { currentToast, hideToast } from '../src/shared/undo';
import { changeSheet } from '../src/sheet/change';
import { gearRows, gearWarnings, placesFor } from '../src/sheet/gear';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { Items } from '../src/sheet/sections/Items';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-50: the Gear tab of golden B (SPEC §6.7): chain mail (55 lb) and a greatsword (6 lb), both
// worn, AC 17. The weights are the built-in pack's own; the expected texts were written by hand
// from the ticket's §6, never copied from a run.

const packs = installBuiltInPacks().packs;
const t = i18n.getFixedT('en', 'gear');
const CHAIN_MAIL = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';
const GREATSWORD = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d';

type Inventory = AppCharacter['systemData']['inventory'];

/** Golden B with `inventory` instead of its own rows. */
function carrying(inventory: Inventory, editing = false): SheetValue {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...goldenB,
    systemData: { ...goldenB.systemData, inventory },
  });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const computed = compute(character, content.index, system.module);
  return { character, content, computed, system, editing, roll: () => {}, breakdown: () => {} };
}

const own = goldenB.systemData.inventory;
const draw = (sheet: SheetValue) =>
  renderToStaticMarkup(
    <SheetContext value={sheet}>
      <Items />
    </SheetContext>,
  );
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A custom row, `n` of them, attuned as given. */
function trinket(n: number, attuned: boolean, fields: object = {}): Inventory[number] {
  return {
    uid: `e5000000-0000-4000-8000-00000000000${n}`,
    custom: { name: `Trinket ${n}` },
    qty: 1,
    equipped: false,
    attuned,
    ...fields,
  } as Inventory[number];
}

describe('SHEET-50 the Gear tab', () => {
  it('lists golden B: both items worn, weights, and 61 lb carried', () => {
    const html = draw(carrying(own));
    expect(text(html)).toBe('Items Chain Mail 55 lb Worn Greatsword 6 lb Worn Carried 61 lb');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html).not.toContain('Attuned');
    expect(html).not.toContain('role="alert"');
  });

  it('shows a switch off, a count above 1, and no weight for a row that has none', () => {
    const html = draw(
      carrying([
        { ...own[0], equipped: false } as Inventory[number],
        trinket(1, false, { qty: 3 }),
      ]),
    );
    expect(text(html)).toBe('Items Chain Mail 55 lb Worn Trinket 1 ×3 Worn Attuned Carried 55 lb');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
  });

  it('draws the Attuned switch for an item that needs it, and for a custom row', () => {
    const html = draw(carrying([trinket(1, false)]));
    expect(html).toContain('>Attuned<');
  });

  it('says an empty inventory', () => {
    expect(text(draw(carrying([])))).toBe('Items Nothing carried yet. Carried 0 lb');
  });

  it('names a missing item and still lets it be worn and cleared', () => {
    const html = draw(
      carrying([
        {
          uid: 'e5000000-0000-4000-8000-000000000031',
          itemId: 'character:item/lost',
          qty: 1,
          equipped: true,
          attuned: true,
        },
      ]),
    );
    expect(text(html)).toBe('Items Missing: character:item/lost Worn Attuned Carried 0 lb');
  });

  it('warns of a fourth attuned item, with the numbers', () => {
    const html = draw(
      carrying([trinket(1, true), trinket(2, true), trinket(3, true), trinket(4, true)]),
    );
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain('Attuned to 4 items; at most 3 at a time.');
  });

  it('warns of two copies of one item by its name, and of two armors worn together', () => {
    const sheet = carrying([
      ...own,
      { ...own[0], uid: 'e5000000-0000-4000-8000-000000000041', attuned: true },
      { ...own[0], uid: 'e5000000-0000-4000-8000-000000000042', attuned: true },
    ] as Inventory);
    const said = text(draw(sheet));
    expect(said).toContain('Attuned to 2 copies of Chain Mail; one copy at most.');
    expect(said).toContain('Chain Mail is worn with Chain Mail; only one counts at a time.');
  });

  it('puts a row under its container, one step in, and lets edit mode move it', () => {
    const bag = trinket(1, false);
    const rows: Inventory = [
      { ...own[1], container: bag.uid } as Inventory[number],
      bag,
      { ...own[0], container: bag.uid } as Inventory[number],
    ];
    const sheet = carrying(rows);
    const html = draw(sheet);
    expect(text(html)).toContain('Trinket 1 Holds 2');
    expect(html.indexOf('Trinket 1')).toBeLessThan(html.indexOf('Greatsword'));
    expect(html.match(/ml-4/g)).toHaveLength(2);
    expect(html).not.toContain('<select');

    const editing = draw(carrying(rows, true));
    expect(editing.match(/<select/g)).toHaveLength(3);
    expect(editing).toContain('Nowhere (carried)');
  });

  it('offers every row but the row itself and the rows inside it', () => {
    const outer = trinket(1, false);
    const inner = trinket(2, false, { container: outer.uid });
    const sheet = carrying([outer, inner, trinket(3, false)]);
    const rows = gearRows(
      sheet.character,
      (id) => {
        const found = sheet.content.index.get(id);
        return found.ok ? found.entity : undefined;
      },
      sheet.system.inventory,
    );
    expect(placesFor(outer.uid, rows).map(({ row }) => row.custom?.name)).toEqual(['Trinket 3']);
    expect(placesFor(inner.uid, rows).map(({ row }) => row.custom?.name)).toEqual([
      'Trinket 1',
      'Trinket 3',
    ]);
  });

  it('reads only its own warnings, each once', () => {
    expect(
      gearWarnings([
        {
          code: 'characterRule',
          rule: 'attunementLimit',
          data: { attuned: 4, limit: 3 },
          message: '',
        },
        { code: 'characterRule', rule: 'other', data: { n: 1 }, message: '' },
        {
          code: 'stepRule',
          path: 'a',
          rule: 'oneAtATime',
          data: { item: 'x', worn: 'y' },
          message: '',
        },
        {
          code: 'stepRule',
          path: 'b',
          rule: 'oneAtATime',
          data: { item: 'x', worn: 'y' },
          message: '',
        },
      ]),
    ).toEqual([
      { key: 'attunementLimit', attuned: 4, limit: 3 },
      { key: 'oneAtATime', item: 'x', worn: 'y' },
    ]);
  });
});

describe('SHEET-50 weights are stored in pounds and shown as chosen', () => {
  it('shows pounds to a hundredth and kilograms to a tenth', () => {
    expect(shownWeight(55, 'lb')).toEqual({ value: 55, unit: 'lb' });
    expect(shownWeight(1.234, 'lb')).toEqual({ value: 1.23, unit: 'lb' });
    expect(shownWeight(55, 'kg')).toEqual({ value: 24.9, unit: 'kg' });
    expect(shownWeight(0, 'kg')).toEqual({ value: 0, unit: 'kg' });
    expect(KILOGRAMS_PER_POUND).toBe(0.45359237);
  });
});

describe('SHEET-50 the switches change the stored character', () => {
  const a = fifthEditionCharacterSchema.parse(goldenB);

  beforeEach(async () => {
    await saveCharacter(a);
  });
  afterEach(async () => {
    await db.characters.clear();
    await db.history.clear();
  });

  const storedRows = async () => {
    const opened = await openCharacter(a.id);
    if (!opened.ok) throw new Error(opened.message);
    return opened.value.systemData.inventory;
  };

  it('takes the chain mail off as one change, with a toast naming it', async () => {
    const sheet = carrying(own);
    const { system, content, character } = sheet;
    const saved = await changeSheet(character, (stamp) =>
      system.inventory.equip(character, content.index, { uid: CHAIN_MAIL, equipped: false }, stamp),
    );
    expect(saved).toBe(true);
    expect((await storedRows()).map(({ equipped }) => equipped)).toEqual([false, true]);
    const toast = currentToast();
    expect(toast).toMatchObject({
      kind: 'changed',
      entry: { action: 'unequipItem', label: { en: 'Chain Mail' }, by: { name: 'Golden B' } },
    });
    expect(en.toast.done.unequipItem).toBe('{{name}} taken off');
    if (toast !== undefined) hideToast(toast);
  });

  it('refuses a switch that changes nothing, writing nothing', async () => {
    const { system, content, character } = carrying(own);
    const saved = await changeSheet(character, (stamp) =>
      system.inventory.equip(character, content.index, { uid: GREATSWORD, equipped: true }, stamp),
    );
    expect(saved).toBe(false);
    expect(await storedRows()).toEqual(own);
  });

  it('has a word for every action the tab makes', () => {
    for (const key of ['equipItem', 'unequipItem', 'attuneItem', 'unattuneItem', 'moveItem']) {
      expect(Object.keys(en.toast.done)).toContain(key);
    }
    expect(t('worn')).toBe('Worn');
  });
});
