import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionAttacks,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenB4, srd2014, srd2024 } from './golden/index.ts';

// SHEET-44: the attacks the Combat tab lists. Golden B (SPEC §6.7, a 2024 fighter 1) wields a
// greatsword (2d6 slashing, mastery Graze: +5 to hit, +3 damage); golden A (2014, a cleric 1) a
// warhammer (1d8 bludgeoning: +3 to hit, +1 damage). Golden B4 (fighter 4) has +6 and +4 (ENG-16).

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

function attacksOf(golden: typeof goldenA | typeof goldenB) {
  const character = opened(openFifthEditionCharacter(golden));
  const index = (golden.ruleset === '2014' ? index2014 : index2024).index;
  const computed = compute(character, index, fifthEditionModule);
  return { computed, shown: fifthEditionAttacks(computed) };
}

describe('SHEET-44 the attacks of the Combat tab', () => {
  it("lists golden B's greatsword with its dice, type, bonus paths and mastery Graze", () => {
    const { computed, shown } = attacksOf(goldenB);
    expect(shown).toEqual([
      {
        item: 'srd-2024:item/greatsword',
        key: 'greatsword',
        kind: 'melee',
        hit: 'attacks.greatsword.hit',
        damage: { path: 'attacks.greatsword.damage', dice: '2d6', type: 'slashing' },
        mastery: { key: 'graze', uses: true },
      },
    ]);
    expect(computed.values['attacks.greatsword.hit']).toBe(5);
    expect(computed.values['attacks.greatsword.damage']).toBe(3);
  });

  it("lists golden A's warhammer, which has no mastery in the 2014 rules", () => {
    const { computed, shown } = attacksOf(goldenA);
    expect(shown).toEqual([
      {
        item: 'srd-2014:item/warhammer',
        key: 'warhammer',
        kind: 'melee',
        hit: 'attacks.warhammer.hit',
        damage: { path: 'attacks.warhammer.damage', dice: '1d8', type: 'bludgeoning' },
      },
    ]);
    expect(computed.values['attacks.warhammer.hit']).toBe(3);
    expect(computed.values['attacks.warhammer.damage']).toBe(1);
  });

  it('lists the attack of a weapon only while it is equipped', () => {
    const put = (equipped: boolean) =>
      attacksOf({
        ...goldenB,
        systemData: {
          ...goldenB.systemData,
          inventory: goldenB.systemData.inventory.map((row) =>
            row.itemId === 'srd-2024:item/greatsword' ? { ...row, equipped } : row,
          ),
        },
      }).shown;
    expect(put(true)).toHaveLength(1);
    expect(put(false)).toEqual([]);
  });

  it('reads the numbers of a higher level: golden B4 is +6 to hit and +4 to damage', () => {
    const character = opened(openFifthEditionCharacter(goldenB4));
    const computed = compute(character, index2024.index, fifthEditionModule);
    expect(fifthEditionAttacks(computed)[0]?.hit).toBe('attacks.greatsword.hit');
    expect(computed.values['attacks.greatsword.hit']).toBe(6);
    expect(computed.values['attacks.greatsword.damage']).toBe(4);
  });
});
