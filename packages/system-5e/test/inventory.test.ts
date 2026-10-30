import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionModule,
  moveItem,
  setAttuned,
  setEquipped,
} from '../src/index.ts';
import {
  type CharacterInput,
  done,
  findOf,
  frozen,
  INVENTORY,
  indexOf,
  open,
  refused,
  stamp,
} from './action-checks.ts';
import { goldenB } from './golden/index.ts';

// SHEET-50: wearing, attuning and moving an inventory row. Golden B (2024) wears chain mail (AC
// base 16, total 17, SPEC §6.7) and a greatsword; a made-up charm (+1 AC, needs attunement) and
// two custom rows are added. Each value was worked out by hand in the ticket, never copied from a
// run.

type Row = CharacterInput['systemData']['inventory'][number];

const uid = (n: number) => `a6000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const CHAIN_MAIL = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';

const charm = {
  id: 'character:item/charm',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Charm' },
  source: { pack: 'character' },
  category: 'gear',
  magic: { rarity: 'rare', attunement: true },
  effects: [{ id: 'ward', target: 'ac.bonus', op: 'add', value: 1 }],
} satisfies FifthEditionCharacter['localEntities'][number];

const rows: Row[] = [
  { uid: uid(1), itemId: charm.id, qty: 1, equipped: false, attuned: false },
  { uid: uid(2), custom: { name: 'Backpack' }, qty: 1, equipped: false, attuned: false },
  { uid: uid(3), custom: { name: 'Pouch' }, qty: 1, equipped: false, attuned: false },
];

const golden: CharacterInput = {
  ...goldenB,
  localEntities: [charm],
  systemData: { ...goldenB.systemData, inventory: [...goldenB.systemData.inventory, ...rows] },
};

const character = frozen(open(golden));
const find = findOf(character);
const ac = (each: FifthEditionCharacter) =>
  compute(each, indexOf(each), fifthEditionModule).values['ac.total'];
const rowOf = (each: FifthEditionCharacter, id: string) =>
  each.systemData.inventory.find((row) => row.uid === id);

describe('SHEET-50 wearing and attuning a row', () => {
  it('wears the charm and attunes it: AC 17 only once both are done', () => {
    expect(ac(character)).toBe(17);
    const worn = done(character, setEquipped(character, find, uid(1), true, stamp));
    expect(worn.entry).toMatchObject({
      action: 'equipItem',
      subject: charm.id,
      label: { en: 'Charm' },
      changes: [{ path: INVENTORY }],
    });
    expect(rowOf(worn.character, uid(1))).toMatchObject({ equipped: true, attuned: false });
    // Worn but not attuned: its magic does not work (ENG-44).
    expect(ac(worn.character)).toBe(17);
    const attuned = done(worn.character, setAttuned(worn.character, find, uid(1), true, stamp));
    expect(attuned.entry.action).toBe('attuneItem');
    expect(ac(attuned.character)).toBe(18);
    // Every other row, and the order, is kept.
    expect(attuned.character.systemData.inventory.map((row) => row.uid)).toEqual(
      character.systemData.inventory.map((row) => row.uid),
    );
  });

  it('puts the chain mail away and the AC goes to 10 + DEX; ends attunement on its own entry', () => {
    const off = done(character, setEquipped(character, find, CHAIN_MAIL, false, stamp));
    expect(off.entry).toMatchObject({ action: 'unequipItem', label: { en: 'Chain Mail' } });
    // DEX 13 (+1) and the Defense style needs armor: 10 + 1 = 11.
    expect(ac(off.character)).toBe(11);
    const attuned = setAttuned(character, find, uid(1), true, stamp);
    const loose = done(character, attuned);
    const ended = done(loose.character, setAttuned(loose.character, find, uid(1), false, stamp));
    expect(ended.entry.action).toBe('endAttunement');
  });

  it('names a custom row by its own name, and a row no pack has by its id', () => {
    const backpack = done(character, setEquipped(character, find, uid(2), true, stamp));
    expect(backpack.entry).toMatchObject({ subject: uid(2), label: { en: 'Backpack' } });
  });

  it('never refuses a fourth attuned row: it only warns', () => {
    let at = character;
    for (const id of [uid(1), uid(2), uid(3), CHAIN_MAIL]) {
      at = done(at, setAttuned(at, find, id, true, stamp)).character;
    }
    expect(at.systemData.inventory.filter((row) => row.attuned)).toHaveLength(4);
    const warnings = compute(at, indexOf(at), fifthEditionModule).warnings;
    expect(warnings.some((w) => w.code === 'characterRule' && w.rule === 'attunementLimit')).toBe(
      true,
    );
  });

  it('refuses a row no one has, and a change that changes nothing', () => {
    expect(refused(setEquipped(character, find, uid(9), true, stamp))).toEqual({
      code: 'noRow',
      uid: uid(9),
    });
    expect(refused(setEquipped(character, find, CHAIN_MAIL, true, stamp))).toEqual({
      code: 'unchanged',
    });
    expect(refused(setAttuned(character, find, uid(1), false, stamp))).toEqual({
      code: 'unchanged',
    });
  });
});

describe('SHEET-50 moving a row into a container', () => {
  it('puts the pouch in the backpack, then the charm in the pouch, then both out', () => {
    const first = done(character, moveItem(character, find, uid(3), uid(2), stamp));
    expect(first.entry).toMatchObject({ action: 'moveItem', label: { en: 'Pouch' } });
    expect(rowOf(first.character, uid(3))?.container).toBe(uid(2));
    const second = done(first.character, moveItem(first.character, find, uid(1), uid(3), stamp));
    expect(rowOf(second.character, uid(1))?.container).toBe(uid(3));
    const out = done(second.character, moveItem(second.character, find, uid(3), undefined, stamp));
    expect(Object.hasOwn(rowOf(out.character, uid(3)) ?? {}, 'container')).toBe(false);
    // The charm stays in the pouch; the pouch's own place changed alone.
    expect(rowOf(out.character, uid(1))?.container).toBe(uid(3));
  });

  it('refuses a row inside itself or inside what it holds', () => {
    const inside = done(character, moveItem(character, find, uid(3), uid(2), stamp)).character;
    expect(refused(moveItem(inside, find, uid(2), uid(2), stamp))).toEqual({
      code: 'insideItself',
      uid: uid(2),
      container: uid(2),
    });
    expect(refused(moveItem(inside, find, uid(2), uid(3), stamp))).toEqual({
      code: 'insideItself',
      uid: uid(2),
      container: uid(3),
    });
  });

  it('refuses a container no row has, a row no one has, and the place it already is in', () => {
    expect(refused(moveItem(character, find, uid(3), uid(9), stamp))).toEqual({
      code: 'noContainer',
      uid: uid(3),
      container: uid(9),
    });
    expect(refused(moveItem(character, find, uid(9), uid(2), stamp))).toEqual({
      code: 'noRow',
      uid: uid(9),
    });
    expect(refused(moveItem(character, find, uid(3), undefined, stamp))).toEqual({
      code: 'unchanged',
    });
  });
});
