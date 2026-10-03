import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_RULES,
  type FifthEditionCharacter,
  gainInspiration,
  isDead,
  spendInspiration,
} from '../src/index.ts';
import {
  type CharacterInput,
  copyOf,
  done,
  findIn,
  frozen,
  INSPIRATION,
  refused,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// ENG-59: inspiration gained or spent, one at a time, up to the house rules' maximum. Golden A
// (2014) and golden B (2024) are stored with a maximum of 1 and none held; the owner's house rule
// is 3. Every value was worked out by hand in ENG-59's ticket, never copied from a run.

const GOLDENS = [goldenA, goldenB];

/** The golden holding `inspiration`, with its own maximum or the owner's house rule's. */
function holding(
  golden: CharacterInput,
  inspiration: number,
  owners = false,
): FifthEditionCharacter {
  const houseRules = owners ? DEFAULT_HOUSE_RULES : golden.systemData.houseRules;
  return withTrackers(
    golden,
    { inspiration },
    { systemData: { ...golden.systemData, houseRules } },
  );
}

/** The one change an action made to the inspiration held. */
const change = (before: number, after: number) => [{ path: INSPIRATION, before, after }];

describe('ENG-59 inspiration', () => {
  it('gains one up to the golden maximum of 1, in both editions', () => {
    for (const golden of GOLDENS) {
      const before = holding(golden, 0);
      expect(before.systemData.houseRules.inspirationMax).toBe(1);
      const gained = done(before, gainInspiration(before, stamp));
      expect(gained.entry).toMatchObject({ action: 'gainInspiration', subject: 'inspiration' });
      expect(gained.entry.label).toBeUndefined();
      expect(gained.entry.changes).toEqual(change(0, 1));
      expect(gained.character.systemData.state.inspiration).toBe(1);

      expect(refused(gainInspiration(gained.character, stamp))).toEqual({ code: 'atMax', max: 1 });
    }
  });

  it("gains one at a time up to the owner's 3, then refuses", () => {
    expect(DEFAULT_HOUSE_RULES.inspirationMax).toBe(3);
    for (const golden of GOLDENS) {
      for (const held of [0, 1, 2]) {
        const before = holding(golden, held, true);
        expect(done(before, gainInspiration(before, stamp)).entry.changes).toEqual(
          change(held, held + 1),
        );
      }
      const full = holding(golden, 3, true);
      expect(refused(gainInspiration(full, stamp))).toEqual({ code: 'atMax', max: 3 });
    }
  });

  it('spends one, and refuses when none is held', () => {
    for (const golden of GOLDENS) {
      const one = holding(golden, 1);
      const spent = done(one, spendInspiration(one, stamp));
      expect(spent.entry).toMatchObject({ action: 'spendInspiration', subject: 'inspiration' });
      expect(spent.entry.label).toBeUndefined();
      expect(spent.entry.changes).toEqual(change(1, 0));

      const three = holding(golden, 3, true);
      expect(done(three, spendInspiration(three, stamp)).entry.changes).toEqual(change(3, 2));

      expect(refused(spendInspiration(spent.character, stamp))).toEqual({
        code: 'noInspiration',
      });
    }
  });

  it('gains and spends for a dead character as for any other', () => {
    const dead = withTrackers(goldenA, { current: 0, failure: 3, inspiration: 0 });
    expect(isDead(dead, findIn(dead))).toBe(true);
    const gained = done(dead, gainInspiration(dead, stamp));
    expect(gained.entry.changes).toEqual(change(0, 1));
    const spent = done(gained.character, spendInspiration(gained.character, stamp));
    expect(spent.entry.changes).toEqual(change(1, 0));
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = holding(goldenB, 1, true);
    const copy = copyOf(character);
    const ice = frozen(character);
    const frozenStamp = frozen(stamp);
    expect(gainInspiration(ice, frozenStamp).ok).toBe(true);
    expect(spendInspiration(ice, frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
    expect(frozenStamp).toEqual(stamp);
  });
});
