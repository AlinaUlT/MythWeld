import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  type FifthEditionCharacter,
  isDead,
  revive,
  rollDeathSave,
} from '../src/index.ts';
import {
  carrying,
  copyOf,
  done,
  FAILURE,
  findOf,
  frozen,
  HP,
  indexOf,
  rowsOf,
  STABLE,
  SUCCESS,
  stamp,
  unattuned,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// ENG-63: death ends attunement. The rule is one in both SRDs (ENG-63's ticket quotes both), so
// each case runs on golden A (2014) and golden B (2024), each with a hit point maximum of 12 (SPEC
// §6.7). Every value was worked out by hand in the ticket, never copied from a run. The charm and
// the stone are `action-checks.ts`'s (ENG-69 shares them).

const GOLDENS = [goldenA, goldenB];

/** The death save that kept `natural`. */
const save = (character: FifthEditionCharacter, natural: number) =>
  rollDeathSave(character, indexOf(character), { natural }, stamp);

/** The damage `amount` on `character`, from its edition's pack. */
const damage = (character: FifthEditionCharacter, amount: number) =>
  applyDamage(character, indexOf(character), { amount }, stamp);

describe('ENG-63 death ends attunement', () => {
  it('ends every attunement on the third failure of a death save, in both editions', () => {
    for (const golden of GOLDENS) {
      const twice = carrying(golden, { current: 0, failure: 2 });
      const third = done(twice, save(twice, 5));
      expect(third.entry.changes).toEqual([
        { path: FAILURE, before: 2, after: 3 },
        unattuned(golden),
      ]);
      expect(third.outcome).toEqual({ successes: 0, failures: 1, hp: 0, status: 'dead' });
      expect(isDead(third.character, findOf(third.character))).toBe(true);
      expect(third.character.systemData.inventory).toEqual(rowsOf(golden, false));

      const once = carrying(golden, { current: 0, failure: 1 });
      const one = done(once, save(once, 1));
      expect(one.entry.changes).toEqual([
        { path: FAILURE, before: 1, after: 3 },
        unattuned(golden),
      ]);
      expect(one.outcome.status).toBe('dead');
    }
  });

  it('ends every attunement when damage kills, in both editions', () => {
    for (const golden of GOLDENS) {
      const hurt = carrying(golden, { current: 6 });
      const massive = done(hurt, damage(hurt, 18));
      expect(massive.entry.changes).toEqual([
        { path: HP, before: 6, after: 0 },
        { path: FAILURE, before: 0, after: 3 },
        unattuned(golden),
      ]);
      expect(massive.outcome).toEqual({ temp: 0, hp: 6, status: 'dead', failures: 3 });

      const dying = carrying(golden, { current: 0, failure: 2 });
      const third = done(dying, damage(dying, 1));
      expect(third.entry.changes).toEqual([
        { path: FAILURE, before: 2, after: 3 },
        unattuned(golden),
      ]);
      expect(third.outcome.status).toBe('dead');

      const stable = carrying(golden, { current: 0, stable: true });
      expect(done(stable, damage(stable, 12)).entry.changes).toEqual([
        { path: FAILURE, before: 0, after: 3 },
        { path: STABLE, before: true, after: false },
        unattuned(golden),
      ]);
    }
  });

  it('leaves every row attuned when the character lives', () => {
    for (const golden of GOLDENS) {
      const dying = carrying(golden, { current: 0 });
      const failed = done(dying, save(dying, 5));
      expect(failed.entry.changes).toEqual([{ path: FAILURE, before: 0, after: 1 }]);
      expect(failed.character.systemData.inventory).toEqual(rowsOf(golden, true));

      const hurt = carrying(golden, { current: 6 });
      const down = done(hurt, damage(hurt, 17));
      expect(down.entry.changes).toEqual([{ path: HP, before: 6, after: 0 }]);
      expect(down.character.systemData.inventory).toEqual(rowsOf(golden, true));
    }
  });

  it('gives no attunement back on a revival', () => {
    for (const golden of GOLDENS) {
      const dead = carrying(golden, { current: 0, success: 1, failure: 3 }, false);
      const back = done(dead, revive(dead, indexOf(dead), { hp: 1 }, stamp));
      expect(back.entry.changes).toEqual([
        { path: HP, before: 0, after: 1 },
        { path: SUCCESS, before: 1, after: 0 },
        { path: FAILURE, before: 3, after: 0 },
      ]);
      expect(back.character.systemData.inventory).toEqual(rowsOf(golden, false));
    }
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = carrying(goldenB, { current: 0, failure: 2 });
    const copy = copyOf(character);
    const ice = frozen(character);
    const frozenStamp = frozen(stamp);
    expect(rollDeathSave(ice, indexOf(ice), frozen({ natural: 5 }), frozenStamp).ok).toBe(true);
    expect(applyDamage(ice, indexOf(character), frozen({ amount: 1 }), frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
  });
});
