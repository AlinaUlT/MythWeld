import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionModule,
  fifthEditionRestDice,
  fifthEditionRestLines,
  type HitDieAsk,
  longRest,
  restNeedsFood,
  shortRest,
} from '../src/index.ts';
import { hexer, indexOf, stamp, withTrackers } from './action-checks.ts';
import { goldenA, goldenB, goldenB4, goldenC2014 } from './golden/index.ts';

// SHEET-45: what the Rest panel lists. Golden A (2014): cleric 1, one d8, CON +3, hit points 12,
// two level 1 slots. Golden B (2024): fighter 1, one d10, CON +2, hit points 12, Second Wind 2
// uses, one back on a short rest and all on a long rest. B4: fighter 4, four d10. Golden C (2014):
// wizard 3 (d6) and paladin 3 (d10). Every expected value was worked out by hand from those facts
// (the rests' own rules are ENG-21's and are tested there).

const SECOND_WIND = 'secondWind';
const EXHAUSTION = 'srd-2024:condition/exhaustion' as const;

const computedOf = (character: FifthEditionCharacter) =>
  compute(character, indexOf(character), fifthEditionModule);

/** The lines of a short rest of `character` spending `dice`. */
function afterShort(character: FifthEditionCharacter, dice: HitDieAsk[] = []) {
  const result = shortRest(character, indexOf(character), { hitDice: dice }, stamp);
  if (!result.ok) throw new Error(result.message);
  return fifthEditionRestLines(character, computedOf(character), result);
}

/** The lines of a long rest of `character`. */
function afterLong(character: FifthEditionCharacter) {
  const result = longRest(character, indexOf(character), stamp);
  if (!result.ok) throw new Error(result.message);
  return fifthEditionRestLines(character, computedOf(character), result);
}

describe('SHEET-45 the hit dice a short rest can spend', () => {
  it('lists each size the character has, the largest first, with the ones left', () => {
    expect(fifthEditionRestDice(goldenOf(goldenB, {}), computedOf(goldenOf(goldenB, {})))).toEqual([
      { die: 10, max: 1, left: 1 },
    ]);
    const b4 = goldenOf(goldenB4, { hitDiceSpent: { d10: 1 } });
    expect(fifthEditionRestDice(b4, computedOf(b4))).toEqual([{ die: 10, max: 4, left: 3 }]);
    const c = goldenOf(goldenC2014, { hitDiceSpent: { d6: 3 } });
    expect(fifthEditionRestDice(c, computedOf(c))).toEqual([
      { die: 10, max: 3, left: 3 },
      { die: 6, max: 3, left: 0 },
    ]);
  });

  it('says whether the edition asks for food and drink for exhaustion', () => {
    // SRD 5.1 asks for it; SRD 5.2.1 does not (ENG-61 §8).
    expect(restNeedsFood(goldenOf(goldenA, {}))).toBe(true);
    expect(restNeedsFood(goldenOf(goldenB, {}))).toBe(false);
  });
});

describe('SHEET-45 what a short rest gives back', () => {
  it('lists the hit points, the die it spent and a use of Second Wind', () => {
    // 3 + (6 + 2) = 11 of 12; Second Wind: 2 spent, one comes back, 1 of 2 left.
    const b = goldenOf(goldenB, { current: 3, resources: { [SECOND_WIND]: 2 } });
    const lines = afterShort(b, [{ die: 10, roll: 6 }]);
    expect(lines).toEqual([
      { kind: 'hitPoints', from: 3, to: 11, max: 12 },
      { kind: 'hitDie', die: 10, roll: 6, hp: 8 },
      { kind: 'uses', key: SECOND_WIND, label: { en: 'Second Wind' }, back: 1, left: 1, max: 2 },
    ]);
  });

  it('has no line for a thing that did not change', () => {
    // Full hit points, nothing spent: a short rest with no die gives nothing, and it is refused.
    const full = goldenOf(goldenB, {});
    expect(shortRest(full, indexOf(full), { hitDice: [] }, stamp).ok).toBe(false);
    const one = goldenOf(goldenB, { resources: { [SECOND_WIND]: 1 } });
    expect(afterShort(one)).toEqual([
      { kind: 'uses', key: SECOND_WIND, label: { en: 'Second Wind' }, back: 1, left: 2, max: 2 },
    ]);
  });

  it('gives the pact slots back, and ends a knock-out the rest finished', () => {
    const pact = withTrackers(
      goldenB,
      { pactSlotsSpent: 2, current: 16 },
      {
        localEntities: [hexer],
        systemData: {
          ...goldenB.systemData,
          classes: [{ id: 'character:class/hexer', level: 3, hp: ['max', 1, 1] }],
        },
      },
    );
    expect(afterShort(pact)).toEqual([{ kind: 'pactSlots', back: 2 }]);
    const knocked = goldenOf(goldenB, { current: 1, knockedOut: 'resting' });
    expect(afterShort(knocked)).toEqual([{ kind: 'knockOutEnds' }]);
  });
});

describe('SHEET-45 what a long rest gives back', () => {
  it('2024: every hit point, the temporary ones end, every hit die, every use', () => {
    const b = goldenOf(goldenB, {
      current: 3,
      temp: 5,
      hitDiceSpent: { d10: 1 },
      resources: { [SECOND_WIND]: 2 },
    });
    expect(afterLong(b)).toEqual([
      { kind: 'hitPoints', from: 3, to: 12, max: 12 },
      { kind: 'tempHitPoints', lost: 5 },
      { kind: 'hitDiceBack', die: 10, back: 1 },
      { kind: 'uses', key: SECOND_WIND, label: { en: 'Second Wind' }, back: 2, left: 2, max: 2 },
    ]);
  });

  it('2014: every slot, and half the hit dice (one of one, at least 1)', () => {
    const a = goldenOf(goldenA, { current: 5, slotsSpent: { '1': 2 }, hitDiceSpent: { d8: 1 } });
    expect(afterLong(a)).toEqual([
      { kind: 'hitPoints', from: 5, to: 12, max: 12 },
      { kind: 'hitDiceBack', die: 8, back: 1 },
      { kind: 'slots', level: 1, back: 2 },
    ]);
  });

  it('lowers a stored exhaustion by one level, and ends it from level 1', () => {
    const three = withTrackers(
      goldenB,
      {},
      { state: stateWith(goldenB, [{ id: EXHAUSTION, level: 3 }]) },
    );
    expect(afterLong(three)).toEqual([{ kind: 'condition', id: EXHAUSTION, from: 3, to: 2 }]);
    const one = withTrackers(
      goldenB,
      {},
      { state: stateWith(goldenB, [{ id: EXHAUSTION, level: 1 }]) },
    );
    expect(afterLong(one)).toEqual([{ kind: 'condition', id: EXHAUSTION, from: 1, to: 0 }]);
  });

  it('ends concentration in 2024 and keeps it in 2014', () => {
    const bless2024 = 'srd-2024:spell/bless';
    const held2024 = goldenOf(goldenB, { current: 5, concentration: bless2024 });
    expect(afterLong(held2024)).toContainEqual({ kind: 'concentrationEnds', id: bless2024 });
    const held2014 = goldenOf(goldenA, { current: 5, concentration: 'srd-2014:spell/bless' });
    expect(afterLong(held2014).map(({ kind }) => kind)).toEqual(['hitPoints']);
  });
});

/** A golden with its trackers set. */
function goldenOf(
  golden: Parameters<typeof withTrackers>[0],
  trackers: Parameters<typeof withTrackers>[1],
) {
  return withTrackers(golden, trackers);
}

/** The core state of a golden with these conditions. */
function stateWith(
  golden: Parameters<typeof withTrackers>[0],
  conditions: { id: typeof EXHAUSTION; level: number }[],
) {
  return { ...golden.state, conditions };
}
