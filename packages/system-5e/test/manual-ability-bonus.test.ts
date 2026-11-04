import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionModule,
  type ManualCharacterAsk,
  madeByHand,
  manualAbilityBonus,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenB, srd2014, srd2024 } from './golden/index.ts';

// SHEET-29: the window for ability score increases from two editions, on golden F's mix (ADR 017):
// the 2014 Dwarf, whose `con +2` is `srd-2014.ts`'s, with the 2024 Soldier, whose `[2, 1]` or
// `[1, 1, 1]` over Strength, Dexterity and Constitution is `srd-2024.ts`'s. A character takes the
// species' increase, the background's, both or neither. The Soldier's pick is a choice the form
// leaves pending, so what moves a score here is the Dwarf's +2 Constitution only. Golden B's
// stored base Constitution is 14 (SPEC §6.7).

const packs = [srd2014, srd2024].map((file) => opened(openFifthEditionPack(file)));
const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, packs);

const ask = (extra: Partial<ManualCharacterAsk> = {}): ManualCharacterAsk => ({
  id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
  at: '2026-11-04T12:00:00.000Z',
  ruleset: '2024',
  allowMixedRulesets: true,
  name: 'Mixed',
  packs: packs.map(({ id }) => id),
  species: 'srd-2014:species/dwarf',
  background: 'srd-2024:background/soldier',
  classes: [{ id: 'srd-2024:class/fighter', level: 1 }],
  scores: goldenB.abilities.base,
  ...extra,
});

const con = (made: ReturnType<typeof madeByHand>) => made.computed.values['abilities.con.score'];

describe('SHEET-29 the window’s content', () => {
  it('names each side’s givers and what they give: the Dwarf’s +2 Constitution, the Soldier’s pattern', () => {
    const made = madeByHand(ask(), index);
    const shown = manualAbilityBonus(made.character, index);
    expect(shown?.sides.species).toEqual([
      {
        id: 'srd-2014:species/dwarf',
        name: { en: 'Dwarf' },
        ruleset: '2014',
        fixed: [{ stat: 'con', amount: 2 }],
        spread: [],
      },
    ]);
    expect(shown?.sides.background).toEqual([
      {
        id: 'srd-2024:background/soldier',
        name: { en: 'Soldier' },
        ruleset: '2024',
        fixed: [],
        spread: [
          {
            from: ['str', 'dex', 'con'],
            patterns: [
              [2, 1],
              [1, 1, 1],
            ],
          },
        ],
      },
    ]);
  });

  it('shows nothing unless both sides give increases', () => {
    const noBackground = madeByHand(ask({ background: undefined }), index);
    expect(manualAbilityBonus(noBackground.character, index)).toBeUndefined();
    const noSpecies = madeByHand(ask({ species: undefined }), index);
    expect(manualAbilityBonus(noSpecies.character, index)).toBeUndefined();
  });
});

describe('SHEET-29 the source the form stores', () => {
  it('starts with the rules base’s: the background’s for 2024, the species’ for 2014', () => {
    const made2024 = madeByHand(ask(), index);
    expect(manualAbilityBonus(made2024.character, index)?.source).toBe('background');
    const made2014 = madeByHand(ask({ ruleset: '2014' }), index);
    expect(manualAbilityBonus(made2014.character, index)?.source).toBe('species');
  });

  it('stores the pick, and each of the four moves Constitution as the rule says', () => {
    // Base 14. Only the species gives a number the form can count: +2.
    const expected = {
      species: 16,
      background: 14,
      both: 16,
      neither: 14,
    } as const;
    for (const [source, score] of Object.entries(expected)) {
      const made = madeByHand(ask({ bonusSource: source as keyof typeof expected }), index);
      expect(made.character.systemData.abilities.bonusSource).toBe(source);
      expect(manualAbilityBonus(made.character, index)?.source).toBe(source);
      expect(con(made)).toBe(score);
    }
  });

  it('keeps the warning whatever is picked, and never blocks (ADR 017 items 3 and 4)', () => {
    for (const bonusSource of ['species', 'background', 'both', 'neither'] as const) {
      const made = madeByHand(ask({ bonusSource }), index);
      const warned = made.computed.warnings.filter(
        (warning) => warning.code === 'characterRule' && warning.rule === 'abilityBonusConflict',
      );
      expect(warned).toHaveLength(1);
      expect(compute(made.character, index, fifthEditionModule).values['hp.max']).toBeGreaterThan(
        0,
      );
    }
  });
});
