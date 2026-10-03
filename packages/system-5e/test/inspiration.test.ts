import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_RULES,
  type FifthEditionCharacter,
  gainInspiration,
  spendInspiration,
} from '../src/index.ts';
import {
  type CharacterInput,
  copyOf,
  done,
  frozen,
  INSPIRATION,
  refused,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// ENG-59: inspiration gained and spent. The goldens' house rules hold at most 1, the SRDs' 1; the
// default house rules hold 3, the owner's (ADR 009 item 5). Every value is counted by hand from
// those maximums, never copied from a run.

/** `golden` holding `inspiration`, with the default house rules' maximum of 3 when `owners`. */
const holding = (golden: CharacterInput, inspiration: number, owners = false) =>
  withTrackers(
    golden,
    { inspiration },
    owners ? { systemData: { ...golden.systemData, houseRules: DEFAULT_HOUSE_RULES } } : {},
  );

/** The inspiration `character` holds. */
const held = (character: FifthEditionCharacter) => character.systemData.state.inspiration;

describe('ENG-59 inspiration', () => {
  for (const [name, golden] of [
    ['golden A (2014)', goldenA],
    ['golden B (2024)', goldenB],
  ] as const) {
    it(`gains 1 up to the SRDs' maximum of 1 on ${name}, then loses what it gains`, () => {
      const before = holding(golden, 0);
      const result = done(before, gainInspiration(before, stamp));
      expect(result.entry).toMatchObject({ action: 'gainInspiration', subject: 'inspiration' });
      expect(result.entry.changes).toEqual([{ path: INSPIRATION, before: 0, after: 1 }]);
      expect(refused(gainInspiration(result.character, stamp))).toEqual({ code: 'unchanged' });
    });

    it(`spends 1 down to none on ${name}, then has none to spend`, () => {
      const before = holding(golden, 1);
      const result = done(before, spendInspiration(before, stamp));
      expect(result.entry).toMatchObject({ action: 'spendInspiration', subject: 'inspiration' });
      expect(result.entry.changes).toEqual([{ path: INSPIRATION, before: 1, after: 0 }]);
      expect(refused(spendInspiration(result.character, stamp))).toEqual({ code: 'unchanged' });
    });
  }

  it("gains up to the house rules' maximum of 3, not the SRDs' 1", () => {
    let character = holding(goldenB, 0, true);
    const counts: number[] = [];
    for (let gained = 0; gained < 3; gained += 1) {
      character = done(character, gainInspiration(character, stamp)).character;
      counts.push(held(character));
    }
    expect(counts).toEqual([1, 2, 3]);
    expect(refused(gainInspiration(character, stamp))).toEqual({ code: 'unchanged' });
  });

  it('spends one at a time from 3', () => {
    const before = holding(goldenA, 3, true);
    const result = done(before, spendInspiration(before, stamp));
    expect(result.entry.changes).toEqual([{ path: INSPIRATION, before: 3, after: 2 }]);
  });

  it('changes no input', () => {
    const character = frozen(holding(goldenB, 1, true));
    const copy = copyOf(character);
    gainInspiration(character, stamp);
    spendInspiration(character, stamp);
    expect(character).toEqual(copy);
  });
});
