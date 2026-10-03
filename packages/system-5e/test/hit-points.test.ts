import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  applyHealing,
  concentrationDc,
  type FifthEditionCharacter,
  fifthEditionModule,
  isDead,
  isStable,
  revive,
  setTempHp,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  copyOf,
  done,
  FAILURE,
  frozen,
  HP,
  indexOf,
  refused,
  type SpellId,
  STABLE,
  SUCCESS,
  stamp,
  TEMP,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// ENG-20: damage, healing and temporary hit points. Golden A (2014) and golden B (2024) have a hit
// point maximum of 12 (SPEC §6.7). The SRD examples are ENG-20 §8's; every other value was worked
// out by hand in ENG-20 §3, never copied from a run.

const BLESS = 'srd-2014:spell/bless';
const GLIMMER = 'character:spell/glimmer';

/** The damage `amount` on `character`, from its edition's pack. */
const damage = (character: FifthEditionCharacter, amount: number, critical?: boolean) =>
  applyDamage(
    character,
    indexOf(character),
    { amount, ...(critical !== undefined && { critical }) },
    stamp,
  );

/** The healing `amount` on `character`, from its edition's pack. */
const heal = (character: FifthEditionCharacter, amount: number) =>
  applyHealing(character, indexOf(character), { amount }, stamp);

/** The fields that set the hit point maximum to `max`, by a manual override. */
const withMax = (max: number): Partial<CharacterInput> => ({
  overrides: [{ path: 'hp.max', value: max }],
});

describe('ENG-20 hit points', () => {
  it('gives the concentration DC by the edition: half the damage, 10 at least, 30 at most in 2024', () => {
    const dcs = (golden: CharacterInput) =>
      [7, 21, 22, 25, 59, 70].map((amount) => concentrationDc(golden, amount));
    expect(dcs(goldenA)).toEqual([10, 10, 11, 12, 29, 35]);
    expect(dcs(goldenB)).toEqual([10, 10, 11, 12, 29, 30]);
  });

  it('takes the temporary hit points first (the SRD example: 5 temporary, 7 damage)', () => {
    const before = withTrackers(goldenB, { temp: 5 });
    const result = done(before, damage(before, 7));
    expect(result.entry).toMatchObject({ action: 'applyDamage', subject: 'hp' });
    expect(result.entry.label).toBeUndefined();
    expect(result.entry.changes).toEqual([
      { path: TEMP, before: 5, after: 0 },
      { path: HP, before: 12, after: 10 },
    ]);
    expect(result.outcome).toEqual({ temp: 5, hp: 2, status: 'up', failures: 0 });
  });

  it('stops the hit points at 0; what is left below the maximum does not kill', () => {
    const before = withTrackers(goldenA, { current: 6 });
    const result = done(before, damage(before, 17));
    expect(result.entry.changes).toEqual([{ path: HP, before: 6, after: 0 }]);
    expect(result.outcome).toEqual({ temp: 0, hp: 6, status: 'down', failures: 0 });
  });

  it('kills with damage left over equal to the maximum (the SRD example: 12, 6, 18), in both editions', () => {
    for (const golden of [goldenA, goldenB]) {
      const before = withTrackers(golden, { current: 6 });
      const result = done(before, damage(before, 18));
      expect(result.entry.changes).toEqual([
        { path: HP, before: 6, after: 0 },
        { path: FAILURE, before: 0, after: 3 },
      ]);
      expect(result.outcome).toEqual({ temp: 0, hp: 6, status: 'dead', failures: 3 });
      expect(isDead(result.character)).toBe(true);
    }
  });

  it('gives death save failures for damage at 0 hit points: two for a critical hit, never above 3', () => {
    const failures = (failure: number, amount: number, critical?: boolean) => {
      const before = withTrackers(goldenA, { current: 0, failure });
      const result = done(before, damage(before, amount, critical));
      expect(result.entry.changes).toEqual([
        { path: FAILURE, before: failure, after: expect.any(Number) },
      ]);
      return result.outcome;
    };
    expect(failures(0, 3)).toEqual({ temp: 0, hp: 0, status: 'down', failures: 1 });
    expect(failures(0, 3, true)).toEqual({ temp: 0, hp: 0, status: 'down', failures: 2 });
    expect(failures(2, 1)).toEqual({ temp: 0, hp: 0, status: 'dead', failures: 1 });
    expect(failures(2, 1, true)).toEqual({ temp: 0, hp: 0, status: 'dead', failures: 1 });
    expect(failures(0, 12)).toEqual({ temp: 0, hp: 0, status: 'dead', failures: 3 });
    expect(failures(0, 11)).toEqual({ temp: 0, hp: 0, status: 'down', failures: 1 });
  });

  it('lets temporary hit points at 0 take the damage first: only what gets past gives a failure', () => {
    const before = withTrackers(goldenA, { current: 0, temp: 5 });
    const absorbed = done(before, damage(before, 3));
    expect(absorbed.entry.changes).toEqual([{ path: TEMP, before: 5, after: 2 }]);
    expect(absorbed.outcome).toEqual({ temp: 3, hp: 0, status: 'down', failures: 0 });
    const past = done(before, damage(before, 7));
    expect(past.entry.changes).toEqual([
      { path: TEMP, before: 5, after: 0 },
      { path: FAILURE, before: 0, after: 1 },
    ]);
    expect(past.outcome).toEqual({ temp: 5, hp: 0, status: 'down', failures: 1 });
  });

  it("asks for the concentration save with the edition's DC while the character is up", () => {
    const before = withTrackers(goldenB, { concentration: GLIMMER });
    const result = done(before, damage(before, 7));
    expect(result.entry.changes).toEqual([{ path: HP, before: 12, after: 5 }]);
    expect(result.outcome).toEqual({
      temp: 0,
      hp: 7,
      status: 'up',
      failures: 0,
      concentrationDc: 10,
    });
    expect(result.character.systemData.state.concentration).toBe(GLIMMER);

    const big = (golden: CharacterInput, concentration: SpellId) => {
      const strong = withTrackers(golden, { current: 100, concentration }, withMax(100));
      expect(compute(strong, indexOf(strong), fifthEditionModule).values['hp.max']).toBe(100);
      const hit = done(strong, damage(strong, 70));
      expect(hit.entry.changes).toEqual([{ path: HP, before: 100, after: 30 }]);
      return hit.outcome.concentrationDc;
    };
    expect(big(goldenA, BLESS)).toBe(35);
    expect(big(goldenB, GLIMMER)).toBe(30);
  });

  it('ends concentration at 0 hit points, with no save', () => {
    const before = withTrackers(goldenA, { concentration: BLESS });
    const result = done(before, damage(before, 12));
    expect(result.entry.changes).toEqual([
      { path: HP, before: 12, after: 0 },
      { path: CONCENTRATION, before: BLESS },
    ]);
    expect(result.outcome).toEqual({
      temp: 0,
      hp: 12,
      status: 'down',
      failures: 0,
      concentrationEnded: BLESS,
    });
  });

  it('refuses an amount of damage that is not a whole number from 1, and a dead character', () => {
    for (const amount of [0, -1, 1.5]) {
      expect(refused(damage(withTrackers(goldenA, {}), amount))).toEqual({
        code: 'badAmount',
        amount,
      });
    }
    const dead = withTrackers(goldenA, { current: 0, failure: 3 });
    expect(isDead(dead)).toBe(true);
    expect(refused(damage(dead, 1))).toEqual({ code: 'dead' });
  });

  it('heals up to the maximum (the SRD example: 20, 14, 8 regains 6)', () => {
    const ranger = withTrackers(goldenA, { current: 14 }, withMax(20));
    const result = done(ranger, heal(ranger, 8));
    expect(result.entry).toMatchObject({ action: 'applyHealing', subject: 'hp' });
    expect(result.entry.changes).toEqual([{ path: HP, before: 14, after: 20 }]);

    const hurt = withTrackers(goldenA, { current: 5 });
    expect(done(hurt, heal(hurt, 4)).entry.changes).toEqual([{ path: HP, before: 5, after: 9 }]);
    expect(refused(heal(withTrackers(goldenA, {}), 1))).toEqual({ code: 'unchanged' });
  });

  it('never lowers hit points above the maximum', () => {
    const above = withTrackers(goldenA, { current: 12 }, withMax(6));
    expect(refused(heal(above, 1))).toEqual({ code: 'unchanged' });
  });

  it('resets the death saves when it heals from 0', () => {
    const dying = withTrackers(goldenA, { current: 0, success: 1, failure: 2 });
    expect(done(dying, heal(dying, 3)).entry.changes).toEqual([
      { path: HP, before: 0, after: 3 },
      { path: SUCCESS, before: 1, after: 0 },
      { path: FAILURE, before: 2, after: 0 },
    ]);
  });

  it('refuses healing that is not a whole number from 1, and a dead character', () => {
    for (const amount of [0, -1, 1.5]) {
      expect(refused(heal(withTrackers(goldenA, { current: 5 }), amount))).toEqual({
        code: 'badAmount',
        amount,
      });
    }
    expect(refused(heal(withTrackers(goldenA, { current: 0, failure: 3 }), 5))).toEqual({
      code: 'dead',
    });
  });

  it('keeps the larger temporary hit points (the SRD example: 12 or 10, not 22), or the new ones', () => {
    const ten = withTrackers(goldenB, { temp: 10 });
    const gained = done(ten, setTempHp(ten, { amount: 12 }, stamp));
    expect(gained.entry).toMatchObject({ action: 'setTempHp', subject: 'hp' });
    expect(gained.entry.changes).toEqual([{ path: TEMP, before: 10, after: 12 }]);

    const twelve = withTrackers(goldenB, { temp: 12 });
    expect(refused(setTempHp(twelve, { amount: 10 }, stamp))).toEqual({ code: 'unchanged' });
    const replaced = done(twelve, setTempHp(twelve, { amount: 10, replace: true }, stamp));
    expect(replaced.entry.changes).toEqual([{ path: TEMP, before: 12, after: 10 }]);
    const cleared = done(twelve, setTempHp(twelve, { amount: 0, replace: true }, stamp));
    expect(cleared.entry.changes).toEqual([{ path: TEMP, before: 12, after: 0 }]);
  });

  it('gives temporary hit points at 0 hit points without changing anything else', () => {
    const dying = withTrackers(goldenA, { current: 0, failure: 1 });
    const result = done(dying, setTempHp(dying, { amount: 5 }, stamp));
    expect(result.entry.changes).toEqual([{ path: TEMP, before: 0, after: 5 }]);
    expect(result.character.systemData.state).toMatchObject({
      hp: { current: 0, temp: 5 },
      deathSaves: { success: 0, failure: 1 },
    });
  });

  it('refuses temporary hit points that are not a whole number from 0, and a dead character', () => {
    for (const amount of [-1, 1.5]) {
      expect(refused(setTempHp(withTrackers(goldenB, {}), { amount }, stamp))).toEqual({
        code: 'badAmount',
        amount,
      });
    }
    const dead = withTrackers(goldenB, { current: 0, failure: 3 });
    expect(refused(setTempHp(dead, { amount: 5 }, stamp))).toEqual({ code: 'dead' });
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = withTrackers(goldenA, { current: 6, temp: 2, concentration: BLESS });
    const copy = copyOf(character);
    const ice = frozen(character);
    const index = indexOf(character);
    const ask = frozen({ amount: 5 });
    const frozenStamp = frozen(stamp);
    expect(applyDamage(ice, index, ask, frozenStamp).ok).toBe(true);
    expect(applyHealing(ice, index, ask, frozenStamp).ok).toBe(true);
    expect(setTempHp(ice, ask, frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
    expect(ask).toEqual({ amount: 5 });
  });
});

describe('ENG-58 stable and hit points', () => {
  /** The golden at 0 hit points, stable, with `temp` temporary hit points. */
  const stable = (golden: CharacterInput, temp = 0) =>
    withTrackers(golden, { current: 0, temp, stable: true });

  /** The golden dead: at 0 hit points with 1 success and 3 failures. */
  const dead = (golden: CharacterInput, more: Partial<CharacterInput> = {}) =>
    withTrackers(golden, { current: 0, success: 1, failure: 3 }, more);

  /** `character` revived with `hp`, from its edition's pack. */
  const back = (character: FifthEditionCharacter, hp: number | 'max') =>
    revive(character, indexOf(character), { hp }, stamp);

  it('ends stable with damage at 0: a failure, two from a critical hit, death from the maximum', () => {
    for (const golden of [goldenA, goldenB]) {
      const before = stable(golden);
      const hit = done(before, damage(before, 3));
      expect(hit.entry.changes).toEqual([
        { path: FAILURE, before: 0, after: 1 },
        { path: STABLE, before: true, after: false },
      ]);
      expect(hit.outcome).toEqual({ temp: 0, hp: 0, status: 'down', failures: 1 });
      expect(isStable(hit.character)).toBe(false);
      expect(done(before, damage(before, 3, true)).entry.changes).toEqual([
        { path: FAILURE, before: 0, after: 2 },
        { path: STABLE, before: true, after: false },
      ]);
      const killed = done(before, damage(before, 12));
      expect(killed.entry.changes).toEqual([
        { path: FAILURE, before: 0, after: 3 },
        { path: STABLE, before: true, after: false },
      ]);
      expect(killed.outcome).toEqual({ temp: 0, hp: 0, status: 'dead', failures: 3 });
    }
  });

  it('keeps stable when the temporary hit points take the damage whole', () => {
    const before = stable(goldenA, 5);
    const absorbed = done(before, damage(before, 3));
    expect(absorbed.entry.changes).toEqual([{ path: TEMP, before: 5, after: 2 }]);
    expect(isStable(absorbed.character)).toBe(true);
    expect(done(before, damage(before, 7)).entry.changes).toEqual([
      { path: TEMP, before: 5, after: 0 },
      { path: FAILURE, before: 0, after: 1 },
      { path: STABLE, before: true, after: false },
    ]);
  });

  it('ends stable with healing from 0; temporary hit points keep it', () => {
    const before = stable(goldenA);
    expect(done(before, heal(before, 3)).entry.changes).toEqual([
      { path: HP, before: 0, after: 3 },
      { path: STABLE, before: true, after: false },
    ]);
    const temp = done(before, setTempHp(before, { amount: 5 }, stamp));
    expect(temp.entry.changes).toEqual([{ path: TEMP, before: 0, after: 5 }]);
    expect(isStable(temp.character)).toBe(true);
  });

  it('brings a dead character back with the hit points its revival gives, at most the maximum', () => {
    for (const golden of [goldenA, goldenB]) {
      const before = dead(golden);
      const one = done(before, back(before, 1));
      expect(one.entry).toMatchObject({ action: 'revive', subject: 'hp' });
      expect(one.entry.changes).toEqual([
        { path: HP, before: 0, after: 1 },
        { path: SUCCESS, before: 1, after: 0 },
        { path: FAILURE, before: 3, after: 0 },
      ]);
      expect(isDead(one.character)).toBe(false);
      for (const hp of ['max', 20] as const) {
        expect(done(before, back(before, hp)).entry.changes[0]).toEqual({
          path: HP,
          before: 0,
          after: 12,
        });
      }
    }
    const twenty = dead(goldenA, withMax(20));
    expect(done(twenty, back(twenty, 'max')).entry.changes[0]).toEqual({
      path: HP,
      before: 0,
      after: 20,
    });
  });

  it('refuses a revival of hit points that are not a whole number from 1, and of the living', () => {
    for (const hp of [0, -1, 1.5]) {
      expect(refused(back(dead(goldenA), hp))).toEqual({ code: 'badAmount', amount: hp });
    }
    expect(refused(back(withTrackers(goldenA, { current: 5 }), 1))).toEqual({ code: 'notDead' });
    expect(refused(back(withTrackers(goldenA, { current: 0, failure: 2 }), 1))).toEqual({
      code: 'notDead',
    });
  });

  it('changes nothing it is given when it revives: frozen inputs', () => {
    const character = dead(goldenB);
    const copy = copyOf(character);
    const ice = frozen(character);
    const ask = frozen({ hp: 'max' as const });
    expect(revive(ice, indexOf(character), ask, frozen(stamp)).ok).toBe(true);
    expect(ice).toEqual(copy);
    expect(ask).toEqual({ hp: 'max' });
  });
});
