import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  attuneItem,
  carriedWeight,
  equipItem,
  type FifthEditionCharacter,
  fifthEditionModule,
  moveItem,
} from '../src/index.ts';
import {
  type CharacterInput,
  carrying,
  copyOf,
  done,
  findOf,
  frozen,
  INVENTORY,
  indexOf,
  open,
  refused,
  stamp,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// SHEET-50: worn, attuned and which row holds which. Golden B (SPEC §6.7, 2024): chain mail (55 lb,
// base 16, no Dexterity) and a greatsword (6 lb), both equipped, DEX +1, Defense +1 while armor is
// worn, so AC 17 worn and 10 + 1 = 11 without the armor. The weights are the pack's own. Every
// value was worked out by hand in SHEET-50's ticket, never copied from a run.

type Row = CharacterInput['systemData']['inventory'][number];

const CHAIN_MAIL = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';
const GREATSWORD = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d';
const CHARM_ROW = 'd4000000-0000-4000-8000-000000000001';
const STONE_ROW = 'd4000000-0000-4000-8000-000000000002';

const ward = {
  id: 'character:item/ward-stone',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Ward stone' },
  source: { pack: 'character' },
  category: 'gear',
  weight: 2,
  effects: [{ id: 'ward', target: 'ac.formulas', op: 'append', value: '12 + @abilities.dex.mod' }],
} satisfies FifthEditionCharacter['localEntities'][number];

const B = open(goldenB);
const run = (character: FifthEditionCharacter) =>
  compute(character, indexOf(character), fifthEditionModule);
const acOf = (character: FifthEditionCharacter) => run(character).values['ac.total'];

/** Rows `n` of one made-up custom thing each, attuned as given. */
function customRow(n: number, attuned: boolean, fields: Partial<Row> = {}): Row {
  return {
    uid: `e5000000-0000-4000-8000-00000000000${n}`,
    custom: { name: `Trinket ${n}` },
    qty: 1,
    equipped: false,
    attuned,
    ...fields,
  } as Row;
}

/** Golden B with its own rows, then `more`. */
function carryingMore(more: Row[], entities: FifthEditionCharacter['localEntities'] = []) {
  return open({
    ...goldenB,
    localEntities: entities,
    systemData: {
      ...goldenB.systemData,
      inventory: [...goldenB.systemData.inventory, ...more],
    },
  });
}

describe('SHEET-50 the inventory actions', () => {
  it('takes the chain mail off and puts it back: AC 17, 11, 17', () => {
    expect(acOf(B)).toBe(17);
    const off = done(B, equipItem(B, indexOf(B), { uid: CHAIN_MAIL, equipped: false }, stamp));
    expect(off.entry).toMatchObject({
      action: 'unequipItem',
      subject: 'srd-2024:item/chain-mail',
      label: { en: 'Chain Mail' },
    });
    expect(off.entry.changes).toEqual([
      {
        path: INVENTORY,
        before: goldenB.systemData.inventory,
        after: [
          { ...goldenB.systemData.inventory[0], equipped: false },
          goldenB.systemData.inventory[1],
        ],
      },
    ]);
    expect(acOf(off.character)).toBe(11);
    const on = done(
      off.character,
      equipItem(off.character, indexOf(B), { uid: CHAIN_MAIL, equipped: true }, stamp),
    );
    expect(on.entry.action).toBe('equipItem');
    expect(on.character.systemData.inventory).toEqual(goldenB.systemData.inventory);
    expect(acOf(on.character)).toBe(17);
  });

  it('puts a greatsword away without touching the AC', () => {
    const off = done(B, equipItem(B, indexOf(B), { uid: GREATSWORD, equipped: false }, stamp));
    expect(off.character.systemData.inventory.map(({ equipped }) => equipped)).toEqual([
      true,
      false,
    ]);
    expect(acOf(off.character)).toBe(17);
  });

  it('attunes and unattunes a row of an item and a custom row, named in the entry', () => {
    const cold = carrying(goldenB, {}, false);
    const attuned = done(
      cold,
      attuneItem(cold, indexOf(cold), { uid: CHARM_ROW, attuned: true }, stamp),
    );
    expect(attuned.entry).toMatchObject({
      action: 'attuneItem',
      subject: 'character:item/charm',
      label: { en: 'Charm' },
    });
    expect(attuned.character.systemData.inventory.map(({ attuned: on }) => on)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    const hot = carrying(goldenB, {}, true);
    const freed = done(
      hot,
      attuneItem(hot, indexOf(hot), { uid: STONE_ROW, attuned: false }, stamp),
    );
    expect(freed.entry).toMatchObject({
      action: 'unattuneItem',
      subject: 'Lucky stone',
      label: { en: 'Lucky stone' },
    });
    expect(freed.character.systemData.inventory.map(({ attuned: on }) => on)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('allows a fourth attuned row and warns of it (SHEET-18)', () => {
    const three = carryingMore([customRow(1, true), customRow(2, true), customRow(3, true)]);
    expect(run(three).warnings.some(({ code }) => code === 'characterRule')).toBe(false);
    const four = carryingMore([
      customRow(1, true),
      customRow(2, true),
      customRow(3, true),
      customRow(4, false),
    ]);
    const result = done(
      four,
      attuneItem(four, indexOf(four), { uid: customRow(4, false).uid, attuned: true }, stamp),
    );
    expect(
      run(result.character).warnings.filter(({ code }) => code === 'characterRule'),
    ).toMatchObject([{ rule: 'attunementLimit', data: { attuned: 4, limit: 3 } }]);
  });

  it('refuses a row that is not there, and an action that changes nothing', () => {
    const uid = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const index = indexOf(B);
    expect(refused(equipItem(B, index, { uid, equipped: false }, stamp))).toEqual({
      code: 'noRow',
      uid,
    });
    expect(refused(attuneItem(B, index, { uid, attuned: true }, stamp))).toEqual({
      code: 'noRow',
      uid,
    });
    expect(refused(moveItem(B, index, { uid }, stamp))).toEqual({ code: 'noRow', uid });
    expect(refused(equipItem(B, index, { uid: CHAIN_MAIL, equipped: true }, stamp))).toEqual({
      code: 'unchanged',
    });
    expect(refused(attuneItem(B, index, { uid: CHAIN_MAIL, attuned: false }, stamp))).toEqual({
      code: 'unchanged',
    });
    expect(refused(moveItem(B, index, { uid: CHAIN_MAIL }, stamp))).toEqual({
      code: 'unchanged',
    });
  });

  it('drops the pin of an effect the unequipped item no longer gives (SHEET-22)', () => {
    const WARD = 'character:item/ward-stone#ward';
    const stone: Row = {
      uid: 'd4000000-0000-4000-8000-000000000009',
      itemId: ward.id,
      qty: 1,
      equipped: true,
      attuned: false,
    };
    const pinned = open({
      ...goldenB,
      localEntities: [ward],
      systemData: {
        ...goldenB.systemData,
        acCalc: WARD,
        inventory: [...goldenB.systemData.inventory, stone],
      },
    });
    const off = done(
      pinned,
      equipItem(pinned, indexOf(pinned), { uid: stone.uid, equipped: false }, stamp),
    );
    expect(off.entry.changes.map(({ path }) => path)).toEqual([
      INVENTORY,
      ['systemData', 'acCalc'],
    ]);
    expect(off.entry.changes[1]).toEqual({ path: ['systemData', 'acCalc'], before: WARD });
    expect(off.character.systemData.acCalc).toBeUndefined();
    expect(acOf(off.character)).toBe(17);
  });

  it('puts a row inside another and out again; the order and other fields stay', () => {
    const bag = customRow(1, false);
    const character = carryingMore([bag]);
    const index = indexOf(character);
    const inside = done(
      character,
      moveItem(character, index, { uid: GREATSWORD, container: bag.uid }, stamp),
    );
    expect(inside.entry).toMatchObject({
      action: 'moveItem',
      subject: 'srd-2024:item/greatsword',
      label: { en: 'Greatsword' },
    });
    expect(
      inside.character.systemData.inventory.map(({ uid, container }) => [uid, container]),
    ).toEqual([
      [CHAIN_MAIL, undefined],
      [GREATSWORD, bag.uid],
      [bag.uid, undefined],
    ]);
    expect(inside.character.systemData.inventory[1]).toMatchObject({ equipped: true, qty: 1 });
    const out = done(
      inside.character,
      moveItem(inside.character, index, { uid: GREATSWORD }, stamp),
    );
    expect(out.character.systemData.inventory).toEqual(character.systemData.inventory);
    expect('container' in (out.character.systemData.inventory[1] ?? {})).toBe(false);
  });

  it('refuses a container no row has, a row in itself, and a row in a row inside it', () => {
    const outer = customRow(1, false);
    const inner = customRow(2, false, { container: outer.uid });
    const character = carryingMore([outer, inner]);
    const index = indexOf(character);
    const lost = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    expect(refused(moveItem(character, index, { uid: outer.uid, container: lost }, stamp))).toEqual(
      {
        code: 'noContainer',
        uid: outer.uid,
        container: lost,
      },
    );
    expect(
      refused(moveItem(character, index, { uid: outer.uid, container: outer.uid }, stamp)),
    ).toEqual({ code: 'insideItself', uid: outer.uid, container: outer.uid });
    expect(
      refused(moveItem(character, index, { uid: outer.uid, container: inner.uid }, stamp)),
    ).toEqual({ code: 'insideItself', uid: outer.uid, container: inner.uid });
  });

  it('changes nothing it is given: a frozen character and ask', () => {
    const cold = frozen(carrying(goldenB, {}, false));
    const ask = frozen({ uid: CHARM_ROW, attuned: true });
    const result = attuneItem(cold, indexOf(cold), ask, frozen(stamp));
    expect(result.ok).toBe(true);
    expect(cold).toEqual(copyOf(carrying(goldenB, {}, false)));
  });
});

describe('SHEET-50 what the character carries', () => {
  it("adds golden B's chain mail and greatsword: 55 + 6 = 61 lb", () => {
    expect(carriedWeight(B, findOf(B))).toEqual({
      total: 61,
      rows: { [CHAIN_MAIL]: 55, [GREATSWORD]: 6 },
      missing: [],
    });
  });

  it('counts the quantity, a custom weight, no weight, and a missing item once each', () => {
    const lost = 'character:item/lost' as const;
    const stones: Row = {
      uid: 'e5000000-0000-4000-8000-000000000011',
      itemId: ward.id,
      qty: 3,
      equipped: false,
      attuned: false,
    };
    const lump = customRow(2, false, { custom: { name: 'Lump', weight: 1.5 }, qty: 2 });
    const bag = customRow(1, false);
    const gone = (n: number): Row => ({
      uid: `e5000000-0000-4000-8000-00000000002${n}`,
      itemId: lost,
      qty: 1,
      equipped: false,
      attuned: false,
    });
    const character = carryingMore(
      [stones, lump, bag, gone(1), gone(2), { ...customRow(3, false), container: bag.uid }],
      [ward],
    );
    const weight = carriedWeight(character, findOf(character));
    expect(weight.rows[stones.uid]).toBe(6);
    expect(weight.rows[lump.uid]).toBe(3);
    expect(weight.rows[bag.uid]).toBe(0);
    expect(weight.missing).toEqual([lost]);
    expect(weight.total).toBe(61 + 6 + 3);
  });

  it("adds golden A's chain mail, shield and warhammer from the 2014 pack: 55 + 6 + 2 = 63 lb", () => {
    const A = open(goldenA);
    expect(carriedWeight(A, findOf(A)).total).toBe(63);
  });
});
