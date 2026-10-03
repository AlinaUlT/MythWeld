import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionModule,
  type HitDieAsk,
  longRest,
  shortRest,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  copyOf,
  done,
  FAILURE,
  frozen,
  HP,
  hexer,
  hitDice,
  indexOf,
  ownSpell,
  PACT,
  refused,
  resource,
  STABLE,
  SUCCESS,
  slot,
  stamp,
  TEMP,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB, goldenB4, goldenC2014, goldenC2024 } from './golden/index.ts';

// ENG-21: the rests. Golden A (2014): cleric 1, one d8, CON +3, hit points 12, two level 1 slots.
// Golden B (2024): fighter 1, one d10, CON +2, hit points 12, Second Wind 2. B4: fighter 4, four
// d10, hit points 36, Second Wind 3. Golden C: wizard 3 (d6) and paladin 3 (d10), CON +1, hit
// points 38. The hexer, the spells and the feat `character:` are made up. Every value was worked
// out by hand in ENG-21 §3.
// ENG-64: golden B's Resourceful gives 1 inspiration on a long rest, and a rest's outcome says how
// much was lost. Where a long rest here compares its changes, a golden 2024 human holds its maximum
// of 1 (`INSPIRED`), so the gain is lost and the changes are ENG-21 §3's.

const BLESS = 'srd-2014:spell/bless';
/** The inspiration a golden holds at its maximum of 1 (ENG-64). */
const INSPIRED = { inspiration: 1 };
const SECOND_WIND = 'secondWind';
const GLIMMER = ownSpell('glimmer', 1, true);

/** A made-up feat: uses back 1 on a short rest only, uses back only at dawn, a formula missing. */
const RALLY: FifthEditionCharacter['localEntities'][number] = {
  id: 'character:feat/rally',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Rally' },
  source: { pack: 'character' },
  grants: [
    {
      id: 'rally',
      kind: 'resource',
      key: 'rally',
      label: { en: 'Rally' },
      uses: { max: '3', recovery: [{ on: 'short', amount: '1' }] },
    },
    {
      id: 'glow',
      kind: 'resource',
      key: 'glow',
      label: { en: 'Glow' },
      uses: { max: '2', recovery: [{ on: 'dawn', amount: 'all' }] },
    },
    {
      id: 'odd',
      kind: 'resource',
      key: 'odd',
      label: { en: 'Odd' },
      uses: { max: '2', recovery: [{ on: 'long', amount: '@nope' }] },
    },
  ],
};

/** Golden B with the feat Rally, given by hand. */
const rallying = (trackers: Parameters<typeof withTrackers>[1]) =>
  withTrackers(
    goldenB,
    { ...INSPIRED, ...trackers },
    {
      localEntities: [RALLY],
      systemData: { ...goldenB.systemData, feats: [{ id: RALLY.id }] },
    },
  );

/**
 * Golden B as hexer 3: two pact slots of level 2, at its hit point maximum: the d8's 8, 1 and 1,
 * and CON +2 at 3 levels, 16.
 */
const pactCaster = (pactSlotsSpent: number) =>
  withTrackers(
    goldenB,
    { ...INSPIRED, pactSlotsSpent, current: 16 },
    {
      localEntities: [hexer],
      systemData: {
        ...goldenB.systemData,
        classes: [{ id: 'character:class/hexer', level: 3, hp: ['max', 1, 1] }],
      },
    },
  );

/** A golden character with a base CON of 4, its trackers set. */
const frail = (golden: CharacterInput, current: number) =>
  withTrackers(golden, { current }, { abilities: { base: { ...golden.abilities.base, con: 4 } } });

/** A golden character whose hit point maximum is overridden to `max`. */
const overridden = (golden: CharacterInput, max: number, current: number) =>
  withTrackers(golden, { current }, { overrides: [{ path: 'hp.max', value: max }] });

/** A short rest on `character` spending `dice`. */
const short = (character: FifthEditionCharacter, dice: HitDieAsk[] = []) =>
  shortRest(character, indexOf(character), { hitDice: dice }, stamp);

/** A long rest on `character`. */
const long = (character: FifthEditionCharacter) => longRest(character, indexOf(character), stamp);

/** A d10 rolling `roll`. */
const d10 = (roll: number): HitDieAsk => ({ die: 10, roll });

describe('ENG-21 rests', () => {
  it('computes the hit dice of each size from the classes', () => {
    const hitDiceOf = (character: FifthEditionCharacter) => {
      const { values, breakdown } = compute(character, indexOf(character), fifthEditionModule);
      return Object.fromEntries(
        [6, 8, 10, 12].map((die) => {
          const path = `hitDice.d${die}.max`;
          return [die, { value: values[path], steps: breakdown[path] }];
        }),
      );
    };
    const step = (source: string, name: string, level: number) => ({
      kind: 'entity',
      source,
      label: { en: name },
      value: level,
      change: level,
    });
    const none = { value: 0, steps: [] };
    expect(hitDiceOf(withTrackers(goldenA, {}))).toEqual({
      6: none,
      8: { value: 1, steps: [step('srd-2014:class/cleric', 'Cleric', 1)] },
      10: none,
      12: none,
    });
    expect(hitDiceOf(withTrackers(goldenB, {}))[10]).toEqual({
      value: 1,
      steps: [step('srd-2024:class/fighter', 'Fighter', 1)],
    });
    expect(hitDiceOf(withTrackers(goldenB4, {}))[10]?.value).toBe(4);
    expect(hitDiceOf(withTrackers(goldenC2014, {}))).toEqual({
      6: { value: 3, steps: [step('srd-2014:class/wizard', 'Wizard', 3)] },
      8: none,
      10: { value: 3, steps: [step('srd-2014:class/paladin', 'Paladin', 3)] },
      12: none,
    });
    expect(hitDiceOf(withTrackers(goldenC2024, {}))[6]?.value).toBe(3);
    const pinned = withTrackers(
      goldenB,
      {},
      { overrides: [{ path: 'hitDice.d10.max', value: 2 }] },
    );
    expect(hitDiceOf(pinned)[10]?.value).toBe(2);
  });

  it('gives each hit die spent its roll plus the Constitution modifier', () => {
    const b = withTrackers(goldenB, { current: 3 });
    const rest = done(b, short(b, [d10(6)]));
    expect(rest.entry).toMatchObject({ action: 'shortRest', subject: 'rest' });
    expect(rest.entry.label).toBeUndefined();
    expect(rest.entry.changes).toEqual([
      { path: HP, before: 3, after: 11 },
      { path: hitDice(10), after: 1 },
    ]);
    expect(rest.outcome).toEqual({
      hitDice: [{ die: 10, roll: 6, hp: 8 }],
      warnings: [],
      inspirationLost: 0,
    });
  });

  it('stops the hit points at the maximum, and never lowers them', () => {
    const near = withTrackers(goldenB, { current: 10 });
    expect(done(near, short(near, [d10(6)])).entry.changes).toEqual([
      { path: HP, before: 10, after: 12 },
      { path: hitDice(10), after: 1 },
    ]);
    const full = withTrackers(goldenB, {});
    expect(done(full, short(full, [d10(6)])).entry.changes).toEqual([
      { path: hitDice(10), after: 1 },
    ]);
    const above = overridden(goldenB, 6, 12);
    expect(done(above, short(above, [d10(6)])).entry.changes).toEqual([
      { path: hitDice(10), after: 1 },
    ]);
  });

  it('spends several hit dice, of each size the classes give', () => {
    const b4 = withTrackers(goldenB4, { current: 10 });
    const rest = done(b4, short(b4, [d10(4), d10(7), d10(10)]));
    expect(rest.entry.changes).toEqual([
      { path: HP, before: 10, after: 36 },
      { path: hitDice(10), after: 3 },
    ]);
    expect(rest.outcome.hitDice.map(({ hp }) => hp)).toEqual([6, 9, 12]);
    const c = withTrackers(goldenC2024, { current: 20 });
    expect(done(c, short(c, [{ die: 6, roll: 3 }, d10(5)])).entry.changes).toEqual([
      { path: HP, before: 20, after: 30 },
      { path: hitDice(6), after: 1 },
      { path: hitDice(10), after: 1 },
    ]);
  });

  it("gives a hit die at least the edition's minimum", () => {
    const a = frail(goldenA, 3);
    const low = done(a, short(a, [{ die: 8, roll: 1 }]));
    expect(low.entry.changes).toEqual([{ path: hitDice(8), after: 1 }]);
    expect(low.outcome.hitDice).toEqual([{ die: 8, roll: 1, hp: 0 }]);
    expect(done(a, short(a, [{ die: 8, roll: 3 }])).entry.changes[0]).toEqual({
      path: HP,
      before: 3,
      after: 4,
    });
    const b = frail(goldenB, 3);
    const one = done(b, short(b, [d10(1)]));
    expect(one.entry.changes[0]).toEqual({ path: HP, before: 3, after: 4 });
    expect(one.outcome.hitDice).toEqual([{ die: 10, roll: 1, hp: 1 }]);
    expect(done(b, short(b, [d10(5)])).entry.changes[0]).toEqual({
      path: HP,
      before: 3,
      after: 5,
    });
  });

  it('refuses a hit die the character has not got, and a roll the die cannot show', () => {
    const b = withTrackers(goldenB, { current: 3 });
    expect(refused(short(b, [d10(6), d10(6)]))).toEqual({
      code: 'noHitDieLeft',
      die: 10,
      left: 1,
      count: 2,
    });
    expect(refused(short(b, [{ die: 8, roll: 4 }]))).toEqual({
      code: 'noHitDieLeft',
      die: 8,
      left: 0,
      count: 1,
    });
    const spent = withTrackers(goldenB, { current: 3, hitDiceSpent: { d10: 1 } });
    expect(refused(short(spent, [d10(6)]))).toEqual({
      code: 'noHitDieLeft',
      die: 10,
      left: 0,
      count: 1,
    });
    for (const roll of [0, 11, 1.5]) {
      expect(refused(short(b, [d10(roll)]))).toEqual({ code: 'badRoll', die: 10, roll });
    }
    for (const die of [4, 20]) {
      expect(refused(short(b, [{ die, roll: 1 }]))).toEqual({ code: 'badDie', die });
    }
  });

  it('gives back the uses and the pact slots that come back on a short rest', () => {
    const two = withTrackers(goldenB, { resources: { [SECOND_WIND]: 2 } });
    expect(done(two, short(two)).entry.changes).toEqual([
      { path: resource(SECOND_WIND), before: 2, after: 1 },
    ]);
    const one = withTrackers(goldenB, { resources: { [SECOND_WIND]: 1 } });
    expect(done(one, short(one)).entry.changes).toEqual([
      { path: resource(SECOND_WIND), before: 1, after: 0 },
    ]);
    const hexed = pactCaster(2);
    expect(done(hexed, short(hexed)).entry.changes).toEqual([{ path: PACT, before: 2, after: 0 }]);
    const a = withTrackers(goldenA, { slotsSpent: { 1: 2 } });
    expect(refused(short(a))).toEqual({ code: 'unchanged' });
    expect(refused(short(withTrackers(goldenB, {})))).toEqual({ code: 'unchanged' });
  });

  it("starts a short rest at the edition's fewest hit points, and never for the dead", () => {
    expect(refused(short(withTrackers(goldenB, { current: 0 }), [d10(6)]))).toEqual({
      code: 'tooFewHitPoints',
      hp: 0,
      min: 1,
    });
    const down = withTrackers(goldenA, { current: 0, success: 1, failure: 1 });
    expect(done(down, short(down, [{ die: 8, roll: 5 }])).entry.changes).toEqual([
      { path: HP, before: 0, after: 8 },
      { path: SUCCESS, before: 1, after: 0 },
      { path: FAILURE, before: 1, after: 0 },
      { path: hitDice(8), after: 1 },
    ]);
    for (const golden of [goldenA, goldenB]) {
      const dead = withTrackers(golden, { current: 0, failure: 3 });
      expect(refused(short(dead))).toEqual({ code: 'dead' });
      expect(refused(long(dead))).toEqual({ code: 'dead' });
    }
  });

  it('gives back every hit point, slot and the 2014 share of the hit dice', () => {
    const a = withTrackers(goldenA, {
      current: 3,
      temp: 4,
      slotsSpent: { 1: 2 },
      hitDiceSpent: { d8: 1 },
      concentration: BLESS,
    });
    const rest = done(a, long(a));
    expect(rest.entry).toMatchObject({ action: 'longRest', subject: 'rest' });
    expect(rest.entry.changes).toEqual([
      { path: HP, before: 3, after: 12 },
      { path: TEMP, before: 4, after: 0 },
      { path: hitDice(8), before: 1, after: 0 },
      { path: slot(1), before: 2, after: 0 },
    ]);
    expect(rest.character.systemData.state.concentration).toBe(BLESS);
    expect(rest.outcome).toEqual({ hitDice: [], warnings: [], inspirationLost: 0 });
  });

  it('gives back every hit die and use in 2024, and ends concentration', () => {
    const b = withTrackers(
      goldenB,
      {
        ...INSPIRED,
        current: 3,
        temp: 5,
        hitDiceSpent: { d10: 1 },
        resources: { [SECOND_WIND]: 2 },
        concentration: 'character:spell/glimmer',
      },
      { localEntities: [GLIMMER] },
    );
    expect(done(b, long(b)).entry.changes).toEqual([
      { path: HP, before: 3, after: 12 },
      { path: TEMP, before: 5, after: 0 },
      { path: hitDice(10), before: 1, after: 0 },
      { path: resource(SECOND_WIND), before: 2, after: 0 },
      { path: CONCENTRATION, before: 'character:spell/glimmer' },
    ]);
  });

  it("gives back the edition's share of the hit dice, the largest first", () => {
    const c2014 = (hitDiceSpent: Record<string, number>) =>
      withTrackers(goldenC2014, { hitDiceSpent });
    const all = c2014({ d6: 3, d10: 3 });
    expect(done(all, long(all)).entry.changes).toEqual([
      { path: HP, before: 30, after: 38 },
      { path: hitDice(10), before: 3, after: 0 },
    ]);
    const some = c2014({ d6: 3, d10: 1 });
    expect(done(some, long(some)).entry.changes).toEqual([
      { path: HP, before: 30, after: 38 },
      { path: hitDice(10), before: 1, after: 0 },
      { path: hitDice(6), before: 3, after: 1 },
    ]);
    const c2024 = withTrackers(goldenC2024, { hitDiceSpent: { d6: 3, d10: 3 } });
    expect(done(c2024, long(c2024)).entry.changes).toEqual([
      { path: HP, before: 30, after: 38 },
      { path: hitDice(10), before: 3, after: 0 },
      { path: hitDice(6), before: 3, after: 0 },
    ]);
  });

  it('gives back every spell slot, pact slot and use', () => {
    const c = withTrackers(goldenC2014, { current: 38, slotsSpent: { 1: 4, 2: 3 } });
    expect(done(c, long(c)).entry.changes).toEqual([
      { path: slot(1), before: 4, after: 0 },
      { path: slot(2), before: 3, after: 0 },
    ]);
    const hexed = pactCaster(2);
    expect(done(hexed, long(hexed)).entry.changes).toEqual([{ path: PACT, before: 2, after: 0 }]);
    const b4 = withTrackers(goldenB4, { ...INSPIRED, resources: { [SECOND_WIND]: 3 } });
    expect(done(b4, long(b4)).entry.changes).toEqual([
      { path: resource(SECOND_WIND), before: 3, after: 0 },
    ]);
  });

  it('gives a use back on a long rest by its short rest recovery when it has no long one', () => {
    const b = rallying({ resources: { rally: 3, glow: 2 } });
    expect(done(b, long(b)).entry.changes).toEqual([
      { path: resource('rally'), before: 3, after: 2 },
    ]);
    expect(done(b, short(b)).entry.changes).toEqual([
      { path: resource('rally'), before: 3, after: 2 },
    ]);
    const odd = rallying({ resources: { odd: 2 }, current: 3 });
    const rest = done(odd, long(odd));
    expect(rest.entry.changes).toEqual([{ path: HP, before: 3, after: 12 }]);
    expect(rest.outcome.warnings).toMatchObject([
      {
        code: 'recoveryFormula',
        key: 'odd',
        part: 'character:feat/rally#odd',
        warning: { code: 'missingPath', path: 'nope' },
      },
    ]);
  });

  it('keeps hit points above the maximum, and refuses a rest with nothing to give back', () => {
    const above = overridden(goldenA, 6, 12);
    const withSlots = withTrackers(
      goldenA,
      { current: 12, slotsSpent: { 1: 1 } },
      { overrides: [{ path: 'hp.max', value: 6 }] },
    );
    expect(done(withSlots, long(withSlots)).entry.changes).toEqual([
      { path: slot(1), before: 1, after: 0 },
    ]);
    expect(refused(long(above))).toEqual({ code: 'unchanged' });
    expect(refused(long(withTrackers(goldenB, INSPIRED)))).toEqual({ code: 'unchanged' });
  });

  it('starts a long rest at 1 hit point in both editions', () => {
    for (const golden of [goldenA, goldenB]) {
      expect(refused(long(withTrackers(golden, { current: 0 })))).toEqual({
        code: 'tooFewHitPoints',
        hp: 0,
        min: 1,
      });
    }
  });

  it('changes nothing it is given', () => {
    const b = withTrackers(goldenB, {
      current: 3,
      temp: 5,
      hitDiceSpent: { d10: 1 },
      resources: { [SECOND_WIND]: 2 },
    });
    const character = frozen(b);
    const ask = frozen({ hitDice: [d10(6)] });
    const theStamp = frozen(stamp);
    expect(shortRest(character, indexOf(b), ask, theStamp).ok).toBe(false);
    const fresh = frozen(withTrackers(goldenB, { current: 3 }));
    expect(shortRest(fresh, indexOf(b), ask, theStamp).ok).toBe(true);
    expect(longRest(character, indexOf(b), theStamp).ok).toBe(true);
    expect(character).toEqual(copyOf(b));
    expect(ask).toEqual({ hitDice: [d10(6)] });
  });
});

describe('ENG-58 a short rest ends stable', () => {
  it('ends stable when the 2014 short rest raises the hit points from 0', () => {
    const down = withTrackers(goldenA, { current: 0, stable: true });
    expect(done(down, short(down, [{ die: 8, roll: 5 }])).entry.changes).toEqual([
      { path: HP, before: 0, after: 8 },
      { path: STABLE, before: true, after: false },
      { path: hitDice(8), after: 1 },
    ]);
  });
});
