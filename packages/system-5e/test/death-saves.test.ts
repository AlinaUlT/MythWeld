import { describe, expect, it } from 'vitest';
import {
  DEATH_SAVE_DC,
  DEATH_SAVE_FACES,
  type FifthEditionCharacter,
  isDead,
  isStable,
  rollDeathSave,
  stabilize,
} from '../src/index.ts';
import {
  type CharacterInput,
  copyOf,
  done,
  FAILURE,
  frozen,
  HP,
  refused,
  STABLE,
  SUCCESS,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// ENG-58: death saves, stable. The rules are one in both SRDs (ENG-58 §8), so each runs on
// golden A (2014) and golden B (2024). Every value was worked out by hand in ENG-58 §3, never
// copied from a run.

const GOLDENS = [goldenA, goldenB];

/** The death save that kept `natural`, with `total` when it differs. */
const save = (character: FifthEditionCharacter, natural: number, total?: number) =>
  rollDeathSave(character, { natural, ...(total !== undefined && { total }) }, stamp);

/** The golden at 0 hit points with these death saves, dying. */
const dying = (golden: CharacterInput, success = 0, failure = 0) =>
  withTrackers(golden, { current: 0, success, failure });

describe('ENG-58 death saves', () => {
  it('names its rules: a DC of 10, a 1 and a 20', () => {
    expect(DEATH_SAVE_DC).toBe(10);
    expect(DEATH_SAVE_FACES).toEqual({ twoFailures: 1, hitPoint: 20 });
  });

  it('counts a total of 10 or more a success, below 10 a failure, in both editions', () => {
    for (const golden of GOLDENS) {
      const before = dying(golden);
      const ten = done(before, save(before, 10));
      expect(ten.entry).toMatchObject({ action: 'rollDeathSave', subject: 'deathSaves' });
      expect(ten.entry.label).toBeUndefined();
      expect(ten.entry.changes).toEqual([{ path: SUCCESS, before: 0, after: 1 }]);
      expect(ten.outcome).toEqual({ successes: 1, failures: 0, hp: 0, status: 'dying' });

      const nine = done(before, save(before, 9));
      expect(nine.entry.changes).toEqual([{ path: FAILURE, before: 0, after: 1 }]);
      expect(nine.outcome).toEqual({ successes: 0, failures: 1, hp: 0, status: 'dying' });

      expect(done(before, save(before, 9, 10)).entry.changes).toEqual([
        { path: SUCCESS, before: 0, after: 1 },
      ]);
      expect(done(before, save(before, 12, 9)).entry.changes).toEqual([
        { path: FAILURE, before: 0, after: 1 },
      ]);
    }
  });

  it('counts a 1 as two failures, whatever the total, never past the third', () => {
    for (const golden of GOLDENS) {
      const fresh = dying(golden);
      for (const total of [undefined, 12]) {
        const one = done(fresh, save(fresh, 1, total));
        expect(one.entry.changes).toEqual([{ path: FAILURE, before: 0, after: 2 }]);
        expect(one.outcome).toEqual({ successes: 0, failures: 2, hp: 0, status: 'dying' });
      }
      const once = dying(golden, 0, 1);
      const third = done(once, save(once, 1));
      expect(third.entry.changes).toEqual([{ path: FAILURE, before: 1, after: 3 }]);
      expect(third.outcome).toEqual({ successes: 0, failures: 2, hp: 0, status: 'dead' });

      const twice = dying(golden, 0, 2);
      const capped = done(twice, save(twice, 1));
      expect(capped.entry.changes).toEqual([{ path: FAILURE, before: 2, after: 3 }]);
      expect(capped.outcome).toEqual({ successes: 0, failures: 1, hp: 0, status: 'dead' });
    }
  });

  it('gives 1 hit point back on a 20, whatever the total, and resets both counts', () => {
    for (const golden of GOLDENS) {
      const before = dying(golden, 1, 2);
      for (const total of [undefined, 15]) {
        const twenty = done(before, save(before, 20, total));
        expect(twenty.entry.changes).toEqual([
          { path: HP, before: 0, after: 1 },
          { path: SUCCESS, before: 1, after: 0 },
          { path: FAILURE, before: 2, after: 0 },
        ]);
        expect(twenty.outcome).toEqual({ successes: 0, failures: 0, hp: 1, status: 'up' });
        expect(isStable(twenty.character)).toBe(false);
      }
    }
  });

  it('makes the character stable on the third success, both counts reset', () => {
    for (const golden of GOLDENS) {
      const before = dying(golden, 2, 1);
      const third = done(before, save(before, 15));
      expect(third.entry.changes).toEqual([
        { path: SUCCESS, before: 2, after: 0 },
        { path: FAILURE, before: 1, after: 0 },
        { path: STABLE, before: false, after: true },
      ]);
      expect(third.outcome).toEqual({ successes: 1, failures: 0, hp: 0, status: 'stable' });
      expect(isStable(third.character)).toBe(true);
      expect(isDead(third.character)).toBe(false);
    }
  });

  it('kills on the third failure', () => {
    for (const golden of GOLDENS) {
      const before = dying(golden, 0, 2);
      const third = done(before, save(before, 5));
      expect(third.entry.changes).toEqual([{ path: FAILURE, before: 2, after: 3 }]);
      expect(third.outcome).toEqual({ successes: 0, failures: 1, hp: 0, status: 'dead' });
      expect(isDead(third.character)).toBe(true);
    }
  });

  it('refuses a face or a total a d20 cannot give, the dead, the living, the stable', () => {
    const before = dying(goldenA);
    for (const natural of [0, 21, 1.5]) {
      expect(refused(save(before, natural))).toEqual({ code: 'badFace', natural });
    }
    expect(refused(save(before, 9, 9.5))).toEqual({ code: 'badTotal', total: 9.5 });
    expect(refused(save(dying(goldenA, 0, 3), 15))).toEqual({ code: 'dead' });
    expect(refused(save(withTrackers(goldenA, { current: 5 }), 15))).toEqual({
      code: 'notDying',
      hp: 5,
    });
    const stable = withTrackers(goldenA, { current: 0, stable: true });
    expect(refused(save(stable, 15))).toEqual({ code: 'stable' });
  });

  it('stabilizes a dying character: both counts reset', () => {
    for (const golden of GOLDENS) {
      const before = dying(golden, 1, 2);
      const first = done(before, stabilize(before, stamp));
      expect(first.entry).toMatchObject({ action: 'stabilize', subject: 'deathSaves' });
      expect(first.entry.changes).toEqual([
        { path: SUCCESS, before: 1, after: 0 },
        { path: FAILURE, before: 2, after: 0 },
        { path: STABLE, before: false, after: true },
      ]);
      expect(isStable(first.character)).toBe(true);
      const fresh = dying(golden);
      expect(done(fresh, stabilize(fresh, stamp)).entry.changes).toEqual([
        { path: STABLE, before: false, after: true },
      ]);
    }
  });

  it('refuses to stabilize the dead, the living, the stable', () => {
    expect(refused(stabilize(dying(goldenA, 0, 3), stamp))).toEqual({ code: 'dead' });
    expect(refused(stabilize(withTrackers(goldenA, { current: 5 }), stamp))).toEqual({
      code: 'notDying',
      hp: 5,
    });
    const stable = withTrackers(goldenA, { current: 0, stable: true });
    expect(refused(stabilize(stable, stamp))).toEqual({ code: 'unchanged' });
  });

  it('is stable only at 0 hit points, alive', () => {
    expect(isStable(withTrackers(goldenA, { current: 0, stable: true }))).toBe(true);
    expect(isStable(withTrackers(goldenA, { current: 5, stable: true }))).toBe(false);
    expect(isStable(withTrackers(goldenA, { current: 0 }))).toBe(false);
    expect(isStable(withTrackers(goldenA, { current: 0, failure: 3, stable: true }))).toBe(false);
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = dying(goldenB, 1, 1);
    const copy = copyOf(character);
    const ice = frozen(character);
    const ask = frozen({ natural: 4, total: 11 });
    const frozenStamp = frozen(stamp);
    expect(rollDeathSave(ice, ask, frozenStamp).ok).toBe(true);
    expect(stabilize(ice, frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
    expect(ask).toEqual({ natural: 4, total: 11 });
  });
});
