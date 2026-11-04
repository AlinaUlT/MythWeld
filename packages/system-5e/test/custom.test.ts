import { compute, reverseEntry } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  addCustomFeature,
  addCustomItem,
  customFeatureId,
  editCustomFeature,
  editCustomItem,
  fifthEditionCharacterSchema,
  fifthEditionFeatures,
  fifthEditionGear,
  fifthEditionModule,
  removeCustomFeature,
} from '../src/index.ts';
import { findOf, indexOf, open, stamp } from './action-checks.ts';
import { goldenB } from './golden/index.ts';

// SHEET-52: custom items and custom features, free text only, on golden B (SPEC §6.7): chain mail
// 55 lb and a greatsword 6 lb carried, AC 17, 12 hit points. A made-up rope of 10 lb makes 71 lb;
// two of them 81 lb. The made-up feature has a name and text and changes no number.

const b = open(goldenB);
const index = indexOf(b);
const UID = 'e1000000-0000-4000-8000-0000000000aa';
const SLUG = 'custom-1a2b3c4d';
const ID = 'character:feat/custom-1a2b3c4d';

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result).toMatchObject({ ok: true });
  return result as Extract<T, { ok: true }>;
}

const valid = (character: typeof b) => fifthEditionCharacterSchema.safeParse(character).success;

describe('SHEET-52 addCustomItem', () => {
  const ask = { uid: UID, name: '  Rope  ', weight: 10, qty: 1, text: '  50 feet of hemp  ' };

  it('puts a row of free text last, not worn, with its name, weight and words', () => {
    const made = ok(addCustomItem(b, ask, stamp));
    const rows = made.character.systemData.inventory;
    expect(rows).toHaveLength(3);
    expect(rows[2]).toEqual({
      uid: UID,
      custom: { name: 'Rope', weight: 10 },
      qty: 1,
      equipped: false,
      attuned: false,
      note: '50 feet of hemp',
    });
    expect(made.entry).toMatchObject({ action: 'addItem', subject: 'Rope', label: { en: 'Rope' } });
    expect(valid(made.character)).toBe(true);
  });

  it('is carried: the Gear tab lists it by its own name and the weight adds up', () => {
    const made = ok(addCustomItem(b, ask, stamp)).character;
    const gear = fifthEditionGear(made, compute(made, index, fifthEditionModule), findOf(made));
    expect(gear.rows.at(-1)).toMatchObject({ uid: UID, customName: 'Rope', qty: 1, weight: 10 });
    expect(gear.weight).toBe(71);
    const two = ok(addCustomItem(b, { ...ask, qty: 2 }, stamp)).character;
    expect(fifthEditionGear(two, compute(two, index, fifthEditionModule), findOf(two)).weight).toBe(
      81,
    );
  });

  it('keeps every number: AC 17 and 12 hit points stay', () => {
    const made = ok(addCustomItem(b, ask, stamp)).character;
    const { values } = compute(made, index, fifthEditionModule);
    expect(values['ac.total']).toBe(17);
    expect(values['hp.max']).toBe(12);
  });

  it('needs no weight and no words', () => {
    const made = ok(addCustomItem(b, { uid: UID, name: 'Lucky coin', qty: 1 }, stamp));
    expect(made.character.systemData.inventory[2]).toEqual({
      uid: UID,
      custom: { name: 'Lucky coin' },
      qty: 1,
      equipped: false,
      attuned: false,
    });
    expect(valid(made.character)).toBe(true);
  });

  it('refuses a name that shows nothing, a weight that is not above 0, and a count that is not whole', () => {
    expect(addCustomItem(b, { ...ask, name: '   ' }, stamp)).toMatchObject({
      ok: false,
      code: 'noName',
    });
    for (const weight of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(addCustomItem(b, { ...ask, weight }, stamp)).toMatchObject({
        ok: false,
        code: 'badWeight',
      });
    }
    for (const qty of [0, -2, 1.5, Number.NaN]) {
      expect(addCustomItem(b, { ...ask, qty }, stamp)).toMatchObject({
        ok: false,
        code: 'badQuantity',
      });
    }
  });

  it('its entry reverses to the character it came from', () => {
    const made = ok(addCustomItem(b, ask, stamp));
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(b);
  });
});

describe('SHEET-52 addCustomFeature and removeCustomFeature', () => {
  const ask = { slug: SLUG, name: ' Keen Eyes ', text: 'You notice what others miss.' };

  it('writes a feat of its own with its text and names it among the feats', () => {
    const made = ok(addCustomFeature(b, ask, stamp));
    expect(customFeatureId(SLUG)).toBe(ID);
    expect(made.character.localEntities.at(-1)).toEqual({
      id: ID,
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Keen Eyes' },
      text: { en: 'You notice what others miss.' },
      source: { pack: 'character' },
    });
    expect(made.character.systemData.feats.at(-1)).toEqual({ id: ID });
    expect(made.entry).toMatchObject({ action: 'addFeature', subject: ID });
    expect(made.entry.changes.map(({ path }) => path.join('.'))).toEqual([
      'localEntities',
      'systemData.feats',
    ]);
    expect(valid(made.character)).toBe(true);
  });

  it('shows on the Features tab under the feats, and changes no number or warning', () => {
    const made = ok(addCustomFeature(b, ask, stamp)).character;
    const computed = compute(made, index, fifthEditionModule);
    const feats = fifthEditionFeatures(made, computed).find(({ kind }) => kind === 'feats');
    expect(feats?.rows.map(({ id }) => id)).toContain(ID);
    expect(computed.values['ac.total']).toBe(17);
    expect(computed.warnings).toEqual(compute(b, index, fifthEditionModule).warnings);
  });

  it('needs no words', () => {
    const made = ok(addCustomFeature(b, { slug: SLUG, name: 'Lucky' }, stamp));
    expect(made.character.localEntities.at(-1)).not.toHaveProperty('text');
  });

  it('refuses a name that shows nothing, a slug that is no id, and an id the character has', () => {
    expect(addCustomFeature(b, { ...ask, name: ' ' }, stamp)).toMatchObject({
      ok: false,
      code: 'noName',
    });
    expect(addCustomFeature(b, { ...ask, slug: 'Not Kebab' }, stamp)).toMatchObject({
      ok: false,
      code: 'badId',
    });
    const made = ok(addCustomFeature(b, ask, stamp)).character;
    expect(addCustomFeature(made, ask, stamp)).toMatchObject({ ok: false, code: 'idUsed' });
  });

  it('removes it from both lists, back to the character it was added to', () => {
    const added = ok(addCustomFeature(b, ask, stamp)).character;
    const removed = ok(removeCustomFeature(added, index, { id: ID }, stamp));
    expect(removed.character.localEntities).toEqual(b.localEntities);
    expect(removed.character.systemData.feats).toEqual(b.systemData.feats);
    expect(removed.entry).toMatchObject({
      action: 'removeFeature',
      subject: ID,
      label: { en: 'Keen Eyes' },
    });
    expect(ok(reverseEntry(removed.character, removed.entry)).character).toEqual(added);
  });

  it('refuses to remove what is not a feat of its own', () => {
    expect(removeCustomFeature(b, index, { id: ID }, stamp)).toMatchObject({
      ok: false,
      code: 'noFeature',
    });
    expect(
      removeCustomFeature(b, index, { id: 'srd-2024:feat/savage-attacker' }, stamp),
    ).toMatchObject({ ok: false, code: 'noFeature' });
  });

  it('its add entry reverses to the character it came from', () => {
    const made = ok(addCustomFeature(b, ask, stamp));
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(b);
  });
});

describe('SHEET-80 editCustomItem', () => {
  // The rope is kept inside golden B's first row.
  const PACK_ROW = b.systemData.inventory[0]?.uid ?? '';
  const added = ok(
    addCustomItem(b, { uid: UID, name: 'Rope', weight: 10, qty: 2, text: '50 feet' }, stamp),
  ).character;
  const worn = {
    ...added,
    systemData: {
      ...added.systemData,
      inventory: added.systemData.inventory.map((row) =>
        row.uid === UID ? { ...row, container: PACK_ROW } : row,
      ),
    },
  };

  it('changes the name, weight and words, and keeps the count, the place and the uid', () => {
    const made = ok(
      editCustomItem(worn, { uid: UID, name: ' Silk rope ', weight: 5, text: ' 60 feet ' }, stamp),
    );
    const row = made.character.systemData.inventory.find((each) => each.uid === UID);
    expect(row).toEqual({
      uid: UID,
      custom: { name: 'Silk rope', weight: 5 },
      qty: 2,
      equipped: false,
      attuned: false,
      container: PACK_ROW,
      note: '60 feet',
    });
    expect(made.entry).toMatchObject({
      action: 'editItem',
      subject: 'Silk rope',
      label: { en: 'Silk rope' },
    });
    expect(valid(made.character)).toBe(true);
  });

  it('takes the weight and the words away when they are left empty', () => {
    const made = ok(editCustomItem(added, { uid: UID, name: 'Rope' }, stamp));
    const row = made.character.systemData.inventory.find((each) => each.uid === UID);
    expect(row?.custom).toEqual({ name: 'Rope' });
    expect(row).not.toHaveProperty('note');
  });

  it('weighs what it is edited to: 2 ropes of 5 lb on top of the 61 lb of golden B make 71 lb', () => {
    const made = ok(editCustomItem(added, { uid: UID, name: 'Rope', weight: 5 }, stamp)).character;
    const gear = fifthEditionGear(made, compute(made, index, fifthEditionModule), findOf(made));
    expect(gear.weight).toBe(71);
    expect(gear.rows.at(-1)).toMatchObject({ uid: UID, customName: 'Rope', weight: 5 });
  });

  it('refuses a name that shows nothing, a weight of 0 or less, a row that is not there or is a pack’s', () => {
    expect(editCustomItem(added, { uid: UID, name: ' ' }, stamp)).toMatchObject({
      ok: false,
      code: 'noName',
    });
    for (const weight of [0, -1, Number.NaN]) {
      expect(editCustomItem(added, { uid: UID, name: 'Rope', weight }, stamp)).toMatchObject({
        ok: false,
        code: 'badWeight',
      });
    }
    expect(editCustomItem(added, { uid: 'nope', name: 'Rope' }, stamp)).toMatchObject({
      ok: false,
      code: 'noRow',
    });
    const packRow = b.systemData.inventory[0];
    expect(editCustomItem(b, { uid: packRow?.uid ?? '', name: 'Rope' }, stamp)).toMatchObject({
      ok: false,
      code: 'notCustom',
    });
  });

  it('is unchanged when nothing is different, and its entry reverses', () => {
    expect(
      editCustomItem(added, { uid: UID, name: 'Rope', weight: 10, text: '50 feet' }, stamp),
    ).toMatchObject({ ok: false, code: 'unchanged' });
    const made = ok(editCustomItem(added, { uid: UID, name: 'Hemp rope', weight: 9 }, stamp));
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(added);
  });
});

describe('SHEET-80 editCustomFeature', () => {
  const added = ok(
    addCustomFeature(b, { slug: SLUG, name: 'Keen Eyes', text: 'Sharp.' }, stamp),
  ).character;

  it('changes the name and words, and keeps the id in both lists', () => {
    const made = ok(
      editCustomFeature(added, { id: ID, name: ' Keen Sight ', text: 'Sharper.' }, stamp),
    );
    expect(made.character.localEntities.at(-1)).toEqual({
      id: ID,
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Keen Sight' },
      text: { en: 'Sharper.' },
      source: { pack: 'character' },
    });
    expect(made.character.systemData.feats.at(-1)).toEqual({ id: ID });
    expect(made.entry).toMatchObject({ action: 'editFeature', subject: ID });
    expect(made.entry.changes.map(({ path }) => path.join('.'))).toEqual(['localEntities']);
    expect(valid(made.character)).toBe(true);
  });

  it('takes the words away when they are left empty', () => {
    const made = ok(editCustomFeature(added, { id: ID, name: 'Keen Eyes' }, stamp));
    expect(made.character.localEntities.at(-1)).not.toHaveProperty('text');
  });

  it('refuses an empty name and what is not a feat of its own', () => {
    expect(editCustomFeature(added, { id: ID, name: ' ' }, stamp)).toMatchObject({
      ok: false,
      code: 'noName',
    });
    expect(editCustomFeature(b, { id: ID, name: 'X' }, stamp)).toMatchObject({
      ok: false,
      code: 'noFeature',
    });
    expect(
      editCustomFeature(b, { id: 'srd-2024:feat/savage-attacker', name: 'X' }, stamp),
    ).toMatchObject({ ok: false, code: 'noFeature' });
  });

  it('is unchanged when nothing is different, and its entry reverses', () => {
    expect(
      editCustomFeature(added, { id: ID, name: 'Keen Eyes', text: 'Sharp.' }, stamp),
    ).toMatchObject({ ok: false, code: 'unchanged' });
    const made = ok(editCustomFeature(added, { id: ID, name: 'Keen Sight' }, stamp));
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(added);
  });
});
