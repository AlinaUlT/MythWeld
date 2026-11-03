import { applyEntry, compute, reverseEntry } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionGear,
  fifthEditionModule,
  removeRow,
  setRowAttuned,
  setRowContainer,
  setRowEquipped,
  setRowQuantity,
} from '../src/index.ts';
import { findOf, indexOf, open, stamp } from './action-checks.ts';
import { goldenB } from './golden/index.ts';

// SHEET-50: the inventory actions and the Gear tab's view, on golden B (SPEC §6.7): chain mail and a
// greatsword, both equipped. SRD 5.2.1 gives the chain mail 55 lb and the greatsword 6 lb, 16 AC
// with no Dexterity bonus; with the armor off, golden B's AC is 10 + Dexterity 1 = 11 (SPEC §6.7),
// and with it on, 16 + Defense 1 = 17. The made-up charm needs attunement.

type Row = FifthEditionCharacter['systemData']['inventory'][number];

const CHAIN = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';
const SWORD = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d';
const b = open(goldenB);
const index = indexOf(b);
const acOf = (character: typeof b) =>
  compute(character, index, fifthEditionModule).values['ac.total'];

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

describe('SHEET-50 the Gear tab’s view', () => {
  const computed = compute(b, index, fifthEditionModule);
  const gear = fifthEditionGear(b, computed, findOf(b));

  it('lists the rows in the order kept, each with its weight, and what is carried', () => {
    expect(
      gear.rows.map(({ uid, itemId, weight, equipped }) => [uid, itemId, weight, equipped]),
    ).toEqual([
      [CHAIN, 'srd-2024:item/chain-mail', 55, true],
      [SWORD, 'srd-2024:item/greatsword', 6, true],
    ]);
    expect(gear.weight).toBe(61);
    expect(gear.warnings).toEqual([]);
    expect(gear.rows.every(({ asksAttunement, depth }) => !asksAttunement && depth === 0)).toBe(
      true,
    );
  });

  it('weighs a row by its quantity, and a custom row by its own weight', () => {
    const more = open({
      ...goldenB,
      systemData: {
        ...goldenB.systemData,
        inventory: [
          ...goldenB.systemData.inventory.map((row) => ({ ...row, qty: 2 })),
          {
            uid: 'e1000000-0000-4000-8000-000000000001',
            custom: { name: 'Odd stone', weight: 0.5 },
            qty: 3,
            equipped: false,
            attuned: false,
          },
        ],
      },
    });
    const shown = fifthEditionGear(more, compute(more, index, fifthEditionModule), findOf(more));
    // 2 × 55 + 2 × 6 + 3 × 0.5.
    expect(shown.weight).toBe(123.5);
    expect(shown.rows[2]).toMatchObject({ customName: 'Odd stone', weight: 0.5, qty: 3 });
  });

  it('puts a row under the row it is inside, and carries a row whose container is gone alone', () => {
    const nested = open({
      ...goldenB,
      systemData: {
        ...goldenB.systemData,
        inventory: goldenB.systemData.inventory.map((row) =>
          row.uid === SWORD ? { ...row, container: CHAIN } : row,
        ),
      },
    });
    const shown = fifthEditionGear(
      nested,
      compute(nested, index, fifthEditionModule),
      findOf(nested),
    );
    expect(shown.rows.map(({ uid, depth, inside }) => [uid, depth, inside])).toEqual([
      [CHAIN, 0, 1],
      [SWORD, 1, 0],
    ]);
    expect(shown.weight).toBe(61);
  });

  it('names the rules the equipment breaks: a fourth attunement, a second armor worn', () => {
    const charm = (n: number) =>
      ({
        id: `character:item/charm-${n}`,
        type: 'item',
        ruleset: 'any',
        name: { en: `Charm ${n}` },
        source: { pack: 'character' },
        category: 'gear',
        magic: { rarity: 'rare', attunement: true },
      }) satisfies FifthEditionCharacter['localEntities'][number];
    const charmRow = (n: number): Row => ({
      uid: `e1000000-0000-4000-8000-00000000000${n}`,
      itemId: charm(n).id,
      qty: 1,
      equipped: true,
      attuned: true,
    });
    const many = open({
      ...goldenB,
      localEntities: [1, 2, 3, 4].map(charm),
      systemData: {
        ...goldenB.systemData,
        inventory: [
          ...goldenB.systemData.inventory,
          ...[1, 2, 3, 4].map(charmRow),
          {
            uid: 'e2000000-0000-4000-8000-000000000001',
            itemId: 'srd-2024:item/chain-mail',
            qty: 1,
            equipped: true,
            attuned: false,
          },
        ],
      },
    });
    const shown = fifthEditionGear(many, compute(many, index, fifthEditionModule), findOf(many));
    expect(shown.warnings.map(({ rule }) => rule)).toEqual(['oneAtATime', 'attunementLimit']);
    expect(shown.warnings[0]?.data).toEqual({
      item: 'srd-2024:item/chain-mail',
      worn: 'srd-2024:item/chain-mail',
    });
    expect(shown.warnings[1]?.data).toEqual({ attuned: 4, limit: 3 });
    expect(shown.rows.filter(({ asksAttunement }) => asksAttunement)).toHaveLength(4);
  });
});

describe('SHEET-50 worn and attuned', () => {
  it('takes the armor off: AC 17 becomes 11 at once, and Undo puts it back', () => {
    expect(acOf(b)).toBe(17);
    const done = ok(setRowEquipped(b, { uid: CHAIN, equipped: false }, stamp));
    expect(done.character.systemData.inventory[0]?.equipped).toBe(false);
    expect(acOf(done.character)).toBe(11);
    expect(done.entry.action).toBe('setEquipped');
    expect(done.entry.subject).toBe('srd-2024:item/chain-mail');
    const back = reverseEntry(done.character, done.entry);
    expect(back.ok && acOf(back.character)).toBe(17);
  });

  it('carries the toast’s name as the entry’s label', () => {
    const named = ok(
      setRowEquipped(b, { uid: SWORD, equipped: false, label: { en: 'Greatsword' } }, stamp),
    );
    expect(named.entry.label).toEqual({ en: 'Greatsword' });
  });

  it('changes nothing when the row already is so, and refuses a row that is not there', () => {
    expect(setRowEquipped(b, { uid: CHAIN, equipped: true }, stamp)).toMatchObject({
      ok: false,
      code: 'unchanged',
    });
    expect(setRowAttuned(b, { uid: 'nope', attuned: true }, stamp)).toMatchObject({
      ok: false,
      code: 'noRow',
      uid: 'nope',
    });
  });

  it('attunes a row, never refusing a fourth: the limit is a warning', () => {
    const one = ok(setRowAttuned(b, { uid: SWORD, attuned: true }, stamp));
    expect(one.character.systemData.inventory[1]?.attuned).toBe(true);
    expect(one.entry.changes).toHaveLength(1);
    expect(one.entry.changes[0]?.path).toEqual(['systemData', 'inventory']);
  });
});

describe('SHEET-50 how many', () => {
  it('sets a whole number of items from 1, and refuses any other', () => {
    expect(
      ok(setRowQuantity(b, { uid: SWORD, qty: 3 }, stamp)).character.systemData.inventory[1]?.qty,
    ).toBe(3);
    for (const qty of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(setRowQuantity(b, { uid: SWORD, qty }, stamp), `${qty}`).toMatchObject({
        ok: false,
        code: 'badQuantity',
      });
    }
    expect(setRowQuantity(b, { uid: SWORD, qty: 1 }, stamp)).toMatchObject({ code: 'unchanged' });
  });
});

describe('SHEET-50 containers', () => {
  it('puts a row inside another and takes it out again, the weight kept', () => {
    const inside = ok(setRowContainer(b, { uid: SWORD, container: CHAIN }, stamp));
    expect(inside.character.systemData.inventory[1]?.container).toBe(CHAIN);
    const out = ok(setRowContainer(inside.character, { uid: SWORD, container: undefined }, stamp));
    expect(out.character.systemData.inventory[1]).not.toHaveProperty('container');
    expect(out.character.systemData.inventory).toEqual(b.systemData.inventory);
  });

  it('refuses a container that is not there, a row inside itself and inside what it holds', () => {
    expect(setRowContainer(b, { uid: SWORD, container: 'nope' }, stamp)).toMatchObject({
      ok: false,
      code: 'noContainer',
    });
    expect(setRowContainer(b, { uid: SWORD, container: SWORD }, stamp)).toMatchObject({
      ok: false,
      code: 'insideItself',
    });
    const inside = ok(setRowContainer(b, { uid: SWORD, container: CHAIN }, stamp));
    expect(
      setRowContainer(inside.character, { uid: CHAIN, container: SWORD }, stamp),
    ).toMatchObject({
      ok: false,
      code: 'insideItself',
    });
  });

  it('refuses a row that is not there', () => {
    expect(setRowContainer(b, { uid: 'nope', container: CHAIN }, stamp)).toMatchObject({
      ok: false,
      code: 'noRow',
    });
  });
});

describe('SHEET-50 taking a row away', () => {
  it('removes the row and the AC it gave; Undo brings both back', () => {
    const done = ok(removeRow(b, index, { uid: CHAIN }, stamp));
    expect(done.character.systemData.inventory.map(({ uid }) => uid)).toEqual([SWORD]);
    expect(acOf(done.character)).toBe(11);
    const back = reverseEntry(done.character, done.entry);
    expect(back.ok && back.character.systemData.inventory).toEqual(b.systemData.inventory);
    expect(applyEntry(b, done.entry).ok).toBe(true);
  });

  it('puts the rows inside it where it was', () => {
    const inside = ok(setRowContainer(b, { uid: SWORD, container: CHAIN }, stamp));
    const done = ok(removeRow(inside.character, index, { uid: CHAIN }, stamp));
    expect(done.character.systemData.inventory).toHaveLength(1);
    expect(done.character.systemData.inventory[0]).not.toHaveProperty('container');
  });

  it('puts the rows inside a nested row into the row it was inside', () => {
    const rows = goldenB.systemData.inventory;
    const nested = open({
      ...goldenB,
      systemData: {
        ...goldenB.systemData,
        inventory: [
          ...rows.map((row) => (row.uid === SWORD ? { ...row, container: CHAIN } : row)),
          {
            uid: 'e1000000-0000-4000-8000-000000000009',
            itemId: 'srd-2024:item/greataxe',
            qty: 1,
            equipped: false,
            attuned: false,
            container: SWORD,
          },
        ],
      },
    });
    const done = ok(removeRow(nested, index, { uid: SWORD }, stamp));
    expect(
      done.character.systemData.inventory.map(({ uid, container }) => [uid, container]),
    ).toEqual([
      [CHAIN, undefined],
      ['e1000000-0000-4000-8000-000000000009', CHAIN],
    ]);
    expect(removeRow(nested, index, { uid: 'nope' }, stamp)).toMatchObject({ code: 'noRow' });
  });
});
