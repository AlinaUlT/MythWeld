import { criticalDamage } from '@grimoire/system-5e';
import { describe, expect, it } from 'vitest';
import { diceFields } from '../src/shared/dice';
import {
  bonusFormula,
  d20Parts,
  damageFormula,
  fieldsOfParts,
  keptFace,
  type Switches,
  signsOf,
  withBonus,
} from '../src/shared/rollSheet';
import type { Situational } from '../src/systems';

// SHEET-39: the roll dialog's parts that hold no screen. The modes follow ENG-34: any advantage and
// any disadvantage cancel, however many of each. The values are small enough to work out by hand.

const none: Switches = { inspiration: false, situational: new Set() };
const bless: Situational = {
  part: 'character:feat/charm#bless',
  source: 'character:feat/charm',
  label: { en: 'Charm' },
  text: { en: 'While it lasts' },
  op: 'add',
  value: '1d4',
};
const flat: Situational = { ...bless, part: 'character:feat/charm#flat', value: -2 };
const adv: Situational = { ...bless, part: 'character:feat/charm#adv', op: 'advantage' };
const dis: Situational = { ...bless, part: 'character:feat/charm#dis', op: 'disadvantage' };

describe('SHEET-39 signsOf', () => {
  it('keeps the rules sources and adds one sign per switch that is on', () => {
    expect(signsOf([-1], none, [])).toEqual([-1]);
    expect(signsOf([], { ...none, manual: 'advantage' }, [])).toEqual([1]);
    expect(signsOf([], { ...none, manual: 'disadvantage' }, [])).toEqual([-1]);
    expect(signsOf([], { ...none, inspiration: true }, [])).toEqual([1]);
    expect(signsOf([-1], { ...none, manual: 'advantage', inspiration: true }, [])).toEqual([
      -1, 1, 1,
    ]);
  });

  it('counts a situational advantage or disadvantage only while it is on', () => {
    const offered = [adv, dis, bless];
    expect(signsOf([], none, offered)).toEqual([]);
    expect(signsOf([], { ...none, situational: new Set([adv.part]) }, offered)).toEqual([1]);
    expect(signsOf([], { ...none, situational: new Set([dis.part, bless.part]) }, offered)).toEqual(
      [-1],
    );
  });
});

describe('SHEET-39 the parts of a d20 test', () => {
  const label = { d20: 'd20', bonus: 'Initiative' };
  const nameOf = (found: Situational) => found.label.en ?? '';

  it('writes a bonus as the end of a formula', () => {
    expect(bonusFormula(5)).toBe('+ 5');
    expect(bonusFormula(0)).toBe('+ 0');
    expect(bonusFormula(-1)).toBe('- 1');
    expect(withBonus('1d8', 3)).toBe('1d8 + 3');
    expect(withBonus('1d8', 0)).toBe('1d8');
    expect(withBonus('2d6', -1)).toBe('2d6 - 1');
  });

  it('is the d20 and its bonus as one part', () => {
    expect(d20Parts({ d20: '1d20', bonus: 3, label, offered: [], switches: none, nameOf })).toEqual(
      [{ label: 'd20', formula: '1d20 + 3' }],
    );
    expect(
      d20Parts({ d20: '2d20kl1', bonus: -1, label, offered: [], switches: none, nameOf }),
    ).toEqual([{ label: 'd20', formula: '2d20kl1 - 1' }]);
    expect(
      d20Parts({ d20: '1d20', bonus: 0, label, offered: [], switches: none, nameOf })[0]?.formula,
    ).toBe('1d20');
  });

  it('adds each situational add that is on as a part of its own, with its source', () => {
    const switches = { ...none, situational: new Set([bless.part, flat.part, adv.part]) };
    expect(
      d20Parts({ d20: '1d20', bonus: 3, label, offered: [bless, flat, adv], switches, nameOf }),
    ).toEqual([
      { label: 'd20', formula: '1d20 + 3' },
      { label: 'Charm', formula: '1d4', sourceId: 'character:feat/charm' },
      { label: 'Charm', formula: '-2', sourceId: 'character:feat/charm' },
    ]);
    expect(
      d20Parts({ d20: '1d20', bonus: 3, label, offered: [bless], switches: none, nameOf }),
    ).toHaveLength(1);
  });
});

describe('SHEET-39 the faces of a roll', () => {
  it("reads the d20 that counted: the first term's kept die", () => {
    const record = (kept: boolean[], results: number[]) =>
      ({ breakdown: [{ dice: [{ kept, results }] }] }) as unknown as Parameters<typeof keptFace>[0];
    expect(keptFace(record([true], [14]))).toBe(14);
    expect(keptFace(record([false, true], [3, 17]))).toBe(17);
    expect(keptFace(record([true, false], [18, 2]))).toBe(18);
    expect(keptFace(record([false], [3]))).toBeUndefined();
    expect(
      keptFace({ breakdown: [] } as unknown as Parameters<typeof keptFace>[0]),
    ).toBeUndefined();
    expect(
      keptFace({ breakdown: [{ dice: [] }] } as unknown as Parameters<typeof keptFace>[0]),
    ).toBeUndefined();
  });

  it('lists one field per die of every part, in order, keyed by the part', () => {
    const fields = fieldsOfParts([
      { label: 'd20', formula: '2d20kh1 + 3' },
      { label: 'Charm', formula: '1d4' },
      { label: 'Flat', formula: '-2' },
      { label: 'Bad', formula: '2d' },
    ]);
    expect(fields.map(({ key, faces, term, n }) => [key, faces, term, n])).toEqual([
      ['0:0:1', 20, '2d20kh1', 1],
      ['0:0:2', 20, '2d20kh1', 2],
      ['1:0:1', 4, '1d4', 1],
    ]);
    expect(diceFields).toBeTypeOf('function');
  });
});

describe("SHEET-39 a weapon's damage roll", () => {
  const text = (dice: string, bonus: number, critical: boolean) => {
    const made = damageFormula(dice, bonus, critical, criticalDamage);
    return made.ok ? made.formula.text : made.error.code;
  };

  it('is the dice and the bonus, and on a critical hit the dice twice and the bonus once', () => {
    expect(text('2d6', 3, false)).toBe('2d6 + 3');
    expect(text('2d6', 3, true)).toBe('4d6 + 3');
    expect(text('1d8', 0, true)).toBe('2d8');
    expect(text('1d8', -1, true)).toBe('2d8 - 1');
  });

  it("gives the formula's error for dice it cannot read", () => {
    expect(damageFormula('2d', 0, false, criticalDamage).ok).toBe(false);
    expect(damageFormula('2d', 0, true, criticalDamage).ok).toBe(false);
  });
});
