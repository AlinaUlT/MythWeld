import {
  type Computed,
  compute,
  finderOf,
  type LogStamp,
  loadContentIndex,
  removeCondition,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  applyDamage,
  applyHealing,
  EXHAUSTION_CONDITION,
  EXHAUSTION_DEATH_LEVEL,
  exhaustionLevel,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  type fifthEditionEntitySchema,
  fifthEditionModule,
  firstAid,
  isDead,
  isDown,
  isKnockedOut,
  longRest,
  openFifthEditionCharacter,
  openFifthEditionPack,
  revive,
  rollDeathSave,
  setTempHp,
  shortRest,
  stabilize,
} from '../src/index.ts';
import {
  copyOf,
  done,
  FAILURE,
  findIn,
  frozen,
  HP,
  refused,
  stamp as restStamp,
  STABLE,
  SUCCESS,
  TEMP,
  withTrackers,
} from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2014, srd2024 } from './golden/index.ts';

// ENG-19: exhaustion is data in both editions (SPEC §6.3): each SRD's condition entity, no edition
// code. The 2024 one is the golden fixture's (ENG-10). The 2014 one is written here from SRD 5.1's
// table (ENG-19 §8), its numbers only; no golden has it, so the golden pack does not. Each expected
// value was worked out by hand from the table and the goldens before the run: golden A walks 25
// feet and has 12 hit points, golden B walks 30 feet and has 12.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = z.input<typeof fifthEditionEntitySchema>;

const EXHAUSTION_2014 = 'srd-2014:condition/exhaustion';
const EXHAUSTION_2024 = 'srd-2024:condition/exhaustion';
const atLeast = (level: number) => `@conditions.exhaustion.level >= ${level}`;

/** SRD 5.1's exhaustion: each level's effect, and every lower level's. */
const exhaustion2014: Extract<EntityInput, { type: 'condition' }> = {
  id: EXHAUSTION_2014,
  type: 'condition',
  key: 'exhaustion',
  ruleset: '2014',
  name: { en: 'Exhaustion' },
  source: { pack: 'srd-2014' },
  maxLevel: 6,
  effects: [
    // 1: disadvantage on ability checks. 3: on attack rolls and saving throws: roll modes
    // (ENG-34), which change no number of the table.
    { id: 'checks', target: 'roll.check.all', op: 'disadvantage', value: true },
    { id: 'speed-halved', target: 'speed.all.mul', op: 'mul', value: 0.5, when: atLeast(2) },
    {
      id: 'attacks',
      target: 'roll.attack.all',
      op: 'disadvantage',
      value: true,
      when: atLeast(3),
    },
    { id: 'saves', target: 'roll.save.all', op: 'disadvantage', value: true, when: atLeast(3) },
    { id: 'hit-points-halved', target: 'hp.max.mul', op: 'mul', value: 0.5, when: atLeast(4) },
    { id: 'no-speed', target: 'speed.all.mul', op: 'set', value: 0, when: atLeast(5) },
  ],
  // ENG-61: "Finishing a long rest reduces a creature's exhaustion level by 1" (ENG-61 §8).
  recovery: [{ on: 'long', amount: '1' }],
};

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(openFifthEditionPack({ ...srd2014, entities: [...srd2014.entities, exhaustion2014] })),
]).index;
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(openFifthEditionPack(srd2024)),
]).index;

const stamp: LogStamp = {
  id: '3f2b8c1e-7d4a-4e9b-a6c5-0b1d2e3f4a5b',
  at: '2026-10-02T12:00:00.000Z',
  by: { role: 'player', name: 'Test' },
};

/** A golden character with the condition `id` at `level`, or without it at level 0. */
function exhausted(golden: CharacterInput, id: string, level: number) {
  const conditions = level === 0 ? [] : [{ id, level }];
  return opened(openFifthEditionCharacter({ ...golden, state: { ...golden.state, conditions } }));
}

/** The numbers exhaustion changes. */
function numbers(result: Computed<FifthEditionEntity>) {
  return [result.values['speed.walk'], result.values['hp.max'], result.values['d20.all.bonus']];
}

describe('ENG-19 exhaustion is data in both editions', () => {
  it('2014: speed halved at 2 and 0 at 5, hit points halved at 4, no roll reduced', () => {
    const levels = [0, 1, 2, 3, 4, 5, 6].map((level) => {
      const result = compute(
        exhausted(goldenA, EXHAUSTION_2014, level),
        index2014,
        fifthEditionModule,
      );
      expect(result.warnings, `level ${level}`).toEqual([]);
      return [level, ...numbers(result)];
    });
    // Speed 25 → 12.5, rounded down; hit points 12 → 6.
    expect(levels).toEqual([
      [0, 25, 12, 0],
      [1, 25, 12, 0],
      [2, 12, 12, 0],
      [3, 12, 12, 0],
      [4, 12, 6, 0],
      [5, 0, 6, 0],
      [6, 0, 6, 0],
    ]);
  });

  it("2014: the halving is each multiplier's effect step, named by its part", () => {
    const result = compute(exhausted(goldenA, EXHAUSTION_2014, 5), index2014, fifthEditionModule);
    const parts = (path: string) =>
      (result.breakdown[path] ?? []).map((step) =>
        step.kind === 'effect' ? `${step.part} ${step.change}` : `${step.kind} ${step.change}`,
      );
    expect(parts('speed.all.mul')).toEqual([
      'rule 1',
      `${EXHAUSTION_2014}#speed-halved -0.5`,
      `${EXHAUSTION_2014}#no-speed -0.5`,
    ]);
    expect(parts('hp.max.mul')).toEqual(['rule 1', `${EXHAUSTION_2014}#hit-points-halved -0.5`]);
  });

  it("2014: removing it gives golden A's values and breakdowns back", () => {
    const tired = exhausted(goldenA, EXHAUSTION_2014, 4);
    const removed = removeCondition(tired, index2014, { id: EXHAUSTION_2014 }, stamp);
    if (!removed.ok) throw new Error(removed.message);
    const after = compute(removed.character, index2014, fifthEditionModule);
    const before = compute(exhausted(goldenA, EXHAUSTION_2014, 0), index2014, fifthEditionModule);
    expect(after.values).toEqual(before.values);
    expect(after.breakdown).toEqual(before.breakdown);
    expect(numbers(after)).toEqual([25, 12, 0]);
  });

  it('2024: every d20 test −2 and every speed −5 a level; hit points kept', () => {
    const levels = [1, 2, 3, 4, 5, 6].map((level) => {
      const result = compute(
        exhausted(goldenB, EXHAUSTION_2024, level),
        index2024,
        fifthEditionModule,
      );
      expect(result.warnings, `level ${level}`).toEqual([]);
      return [level, ...numbers(result)];
    });
    expect(levels).toEqual([
      [1, 25, 12, -2],
      [2, 20, 12, -4],
      [3, 15, 12, -6],
      [4, 10, 12, -8],
      [5, 5, 12, -10],
      [6, 0, 12, -12],
    ]);
  });

  it('2014: disadvantage on every ability check from 1, on attacks and saves from 3 (ENG-34)', () => {
    /** Each kind of d20 test's modes, each kind's distinct values in rising order. */
    const kinds = {
      checks: /^checks\.[^.]+\.mode$/,
      skills: /^skills\.[^.]+\.mode$/,
      init: /^init\.mode$/,
      saves: /^abilities\.[^.]+\.saveMode$/,
      attacks: /^attacks\.[^.]+\.mode$/,
      spellAttacks: /^spell\.attackMode$/,
      deathSave: /^deathSave\.mode$/,
    };
    const levels = [0, 1, 2, 3, 4, 5, 6].map((level) => {
      const result = compute(
        exhausted(goldenA, EXHAUSTION_2014, level),
        index2014,
        fifthEditionModule,
      );
      expect(result.warnings, `level ${level}`).toEqual([]);
      const modes = Object.entries(kinds).map(([kind, pattern]) => {
        const values = Object.entries(result.values).flatMap(([path, value]) =>
          pattern.test(path) ? [Number(value)] : [],
        );
        return `${kind} ${[...new Set(values)].sort((x, y) => x - y).join(',')}`;
      });
      return [level, ...modes];
    });
    // Golden A's Stealth is −1 at every level: its chain mail.
    const none = ['checks 0', 'skills -1,0', 'init 0', 'saves 0', 'attacks 0'];
    const checks = ['checks -1', 'skills -1', 'init -1', 'saves 0', 'attacks 0'];
    const every = ['checks -1', 'skills -1', 'init -1', 'saves -1', 'attacks -1'];
    expect(levels).toEqual([
      [0, ...none, 'spellAttacks 0', 'deathSave 0'],
      [1, ...checks, 'spellAttacks 0', 'deathSave 0'],
      [2, ...checks, 'spellAttacks 0', 'deathSave 0'],
      [3, ...every, 'spellAttacks -1', 'deathSave -1'],
      [4, ...every, 'spellAttacks -1', 'deathSave -1'],
      [5, ...every, 'spellAttacks -1', 'deathSave -1'],
      [6, ...every, 'spellAttacks -1', 'deathSave -1'],
    ]);
    // At 1, Stealth's two disadvantages: the armor's, then the condition's, which moves nothing.
    const one = compute(exhausted(goldenA, EXHAUSTION_2014, 1), index2014, fifthEditionModule);
    expect(
      one.breakdown['skills.stealth.mode']?.map((step) =>
        step.kind === 'effect' ? `${step.part} ${step.change}` : `${step.kind} ${step.change}`,
      ),
    ).toEqual(['entity -1', `${EXHAUSTION_2014}#checks 0`]);
  });
});

// ENG-61: each edition's exhaustion loses 1 level on a long rest, as its entry's `recovery` says
// (ENG-61 §8). The rests are ENG-21's; `restStamp` is the stamp `done` checks. Golden B: 12 hit
// points, one d10, CON +2. Every value was worked out by hand in ENG-61 §3 from the tables above.

const CONDITIONS = ['state', 'conditions'];

type StoredCondition = CharacterInput['state']['conditions'][number];
type OwnEntity = FifthEditionCharacter['localEntities'][number];

/** A golden character with `trackers` set, these stored conditions, and entities of its own. */
function resting(
  golden: CharacterInput,
  trackers: Parameters<typeof withTrackers>[1],
  conditions: StoredCondition[],
  own: OwnEntity[] = [],
): FifthEditionCharacter {
  return withTrackers(golden, trackers, {
    state: { ...golden.state, conditions },
    ...(own.length > 0 && { localEntities: own }),
  });
}

/** The index of the character's edition, with the 2014 exhaustion. */
const indexFor = (character: FifthEditionCharacter) =>
  character.ruleset === '2014' ? index2014 : index2024;

/** A long rest on `character` that happens, checked by `done`. */
const rested = (character: FifthEditionCharacter) =>
  done(character, longRest(character, indexFor(character), restStamp));

/** A made-up condition of the character's own, with these recoveries. */
function ownCondition(slug: string, recovery: StoredRecovery, maxLevel?: number): OwnEntity {
  return {
    id: `character:condition/${slug}`,
    type: 'condition',
    ruleset: 'any',
    name: { en: slug },
    ...(maxLevel !== undefined && { maxLevel }),
    recovery,
    source: { pack: 'character' },
  };
}
type StoredRecovery = NonNullable<Extract<EntityInput, { type: 'condition' }>['recovery']>;

describe('ENG-61 a rest lowers a condition by its entry', () => {
  it("takes only fifth edition's recovery events in a condition's `recovery`", () => {
    const easedOn = (on: string) =>
      openFifthEditionPack({
        ...srd2014,
        entities: [...srd2014.entities, { ...exhaustion2014, recovery: [{ on, amount: '1' }] }],
      });
    expect(easedOn('long').ok).toBe(true);
    const scene = easedOn('scene');
    expect(scene.ok).toBe(false);
    if (scene.ok || scene.code !== 'invalid') throw new Error('The pack opened.');
    expect(scene.error.issues.map((issue) => issue.path.join('.'))).toEqual([
      `entities.${srd2014.entities.length}.recovery.0.on`,
    ]);
  });

  it('2024: a long rest takes 1 level, and at 0 the condition ends', () => {
    const levels = [1, 2, 3, 4, 5].map((level) => {
      const before = resting(goldenB, {}, [{ id: EXHAUSTION_2024, level }]);
      const { character, entry } = rested(before);
      expect(entry.changes.map((change) => change.path)).toEqual([CONDITIONS]);
      const { values } = compute(character, index2024, fifthEditionModule);
      return [level, character.state.conditions, values['speed.walk'], values['d20.all.bonus']];
    });
    expect(levels).toEqual([
      [1, [], 30, 0],
      [2, [{ id: EXHAUSTION_2024, level: 1 }], 25, -2],
      [3, [{ id: EXHAUSTION_2024, level: 2 }], 20, -4],
      [4, [{ id: EXHAUSTION_2024, level: 3 }], 15, -6],
      [5, [{ id: EXHAUSTION_2024, level: 4 }], 10, -8],
    ]);
  });

  it('2024: the hit points and the level change in one entry', () => {
    const before = resting(goldenB, { current: 3 }, [{ id: EXHAUSTION_2024, level: 2 }]);
    const { character, entry } = rested(before);
    expect(character.systemData.state.hp.current).toBe(12);
    expect(character.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 1 }]);
    expect(entry.changes.map((change) => change.path.join('.'))).toEqual([
      'systemData.state.hp.current',
      'state.conditions',
    ]);
  });

  it('2014: the hit points fill the maximum before the rest, then the level goes down', () => {
    const halved = rested(resting(goldenA, { current: 3 }, [{ id: EXHAUSTION_2014, level: 4 }]));
    expect(halved.character.systemData.state.hp.current).toBe(6);
    expect(halved.character.state.conditions).toEqual([{ id: EXHAUSTION_2014, level: 3 }]);
    const after = compute(halved.character, index2014, fifthEditionModule);
    expect([after.values['hp.max'], after.values['speed.walk']]).toEqual([12, 12]);

    const once = rested(resting(goldenA, {}, [{ id: EXHAUSTION_2014, level: 1 }]));
    expect(once.character.state.conditions).toEqual([]);
    expect(numbers(compute(once.character, index2014, fifthEditionModule))).toEqual([25, 12, 0]);
  });

  it('a short rest leaves exhaustion', () => {
    const before = resting(goldenB, { current: 3 }, [{ id: EXHAUSTION_2024, level: 2 }]);
    const result = done(
      before,
      shortRest(before, index2024, { hitDice: [{ die: 10, roll: 6 }] }, restStamp),
    );
    expect(result.character.systemData.state.hp.current).toBe(11);
    expect(result.character.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 2 }]);
    expect(result.entry.changes.map((change) => change.path)).not.toContainEqual(CONDITIONS);
  });

  it("a condition's own events: `short` on both rests; a formula's warning in the outcome", () => {
    const winded = ownCondition('winded', [{ on: 'short', amount: '1' }], 2);
    const odd = ownCondition('odd', [{ on: 'long', amount: '@nope' }]);
    const before = resting(
      goldenB,
      {},
      [{ id: winded.id, level: 2 }, { id: odd.id }],
      [winded, odd],
    );
    const short = done(before, shortRest(before, index2024, {}, restStamp));
    expect(short.character.state.conditions).toEqual([{ id: winded.id, level: 1 }, { id: odd.id }]);
    expect(short.outcome.warnings).toEqual([]);
    const long = rested(before);
    expect(long.character.state.conditions).toEqual([{ id: winded.id, level: 1 }, { id: odd.id }]);
    expect(long.outcome.warnings).toMatchObject([
      {
        code: 'conditionRecoveryFormula',
        condition: odd.id,
        warning: { code: 'missingPath', path: 'nope' },
      },
    ]);
  });

  it('a refused rest lowers nothing', () => {
    const down = resting(goldenB, { current: 0 }, [{ id: EXHAUSTION_2024, level: 2 }]);
    expect(refused(longRest(down, index2024, restStamp))).toEqual({
      code: 'tooFewHitPoints',
      hp: 0,
      min: 1,
    });
    expect(down.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 2 }]);
  });
});

// ENG-67: exhaustion 6 is death in both SRDs (ENG-67 §8). `isDead` reads the stored exhaustion,
// found by its key, so every action that refuses the dead refuses it. Golden A and golden B have
// 12 hit points; golden B's d10 of 6 gives 8 (ENG-21). Every value was worked out by hand in
// ENG-67 §3.

/** Each golden with its edition's exhaustion. */
const EDITIONS: { golden: CharacterInput; id: StoredCondition['id'] }[] = [
  { golden: goldenA, id: EXHAUSTION_2014 },
  { golden: goldenB, id: EXHAUSTION_2024 },
];

/** How the character finds an entry in the index of its edition, with the 2014 exhaustion. */
const findFor = (character: FifthEditionCharacter) => finderOf(character, indexFor(character));

/** The 2024 golden pack with an Unconscious entry (ENG-62's, its speed set to 0). */
const index2024Unconscious = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(
    openFifthEditionPack({
      ...srd2024,
      entities: [
        ...srd2024.entities,
        {
          id: 'srd-2024:condition/unconscious',
          type: 'condition',
          key: 'unconscious',
          ruleset: '2024',
          name: { en: 'Unconscious' },
          source: { pack: 'srd-2024' },
          effects: [{ id: 'speed-0', target: 'speed.all.mul', op: 'set', value: 0 }],
        },
      ],
    }),
  ),
]).index;

describe('ENG-67 exhaustion 6 is death', () => {
  it('names the key and the level', () => {
    expect(EXHAUSTION_CONDITION).toBe('exhaustion');
    expect(EXHAUSTION_DEATH_LEVEL).toBe(6);
  });

  it('reads the stored level up to its maximum: dead at 6, as at 3 failures', () => {
    for (const { golden, id } of EDITIONS) {
      const levels = [0, 1, 2, 3, 4, 5, 6, 9].map((level) => {
        const character = resting(golden, {}, level === 0 ? [] : [{ id, level }]);
        const find = findFor(character);
        return [level, exhaustionLevel(character, find), isDead(character, find)];
      });
      expect(levels, golden.ruleset).toEqual([
        [0, 0, false],
        [1, 1, false],
        [2, 2, false],
        [3, 3, false],
        [4, 4, false],
        [5, 5, false],
        [6, 6, true],
        [9, 6, true],
      ]);
      const down = resting(golden, { current: 0 }, [{ id, level: 6 }]);
      expect(isDead(down, findFor(down))).toBe(true);
      const failed = resting(golden, { current: 0, failure: 3 }, []);
      expect(isDead(failed, findFor(failed))).toBe(true);
    }
  });

  it('finds the condition by its key, not its id; a missing entry counts for nothing', () => {
    const own = (slug: string, key: string, maxLevel: number): OwnEntity => ({
      id: `character:condition/${slug}`,
      type: 'condition',
      key,
      ruleset: 'any',
      name: { en: slug },
      maxLevel,
      source: { pack: 'character' },
    });
    /** Golden A, its golden pack holding no exhaustion, with `entity` stored at 6. */
    const atSix = (entity: OwnEntity) =>
      resting(goldenA, {}, [{ id: entity.id, level: 6 }], [entity]);
    const read = (character: FifthEditionCharacter) => {
      const find = findIn(character);
      return [exhaustionLevel(character, find), isDead(character, find)];
    };
    expect(read(atSix(own('tired', 'exhaustion', 6)))).toEqual([6, true]);
    expect(read(atSix(own('weary', 'weary', 6)))).toEqual([0, false]);
    expect(read(atSix(own('short', 'exhaustion', 4)))).toEqual([4, false]);
    const gone = resting(goldenA, {}, [{ id: 'srd-2014:condition/gone', level: 6 }]);
    expect(read(gone)).toEqual([0, false]);

    // Stored with no level: 1. Two stored exhaustions: the higher, in either order.
    const tired = own('tired', 'exhaustion', 6);
    expect(read(resting(goldenA, {}, [{ id: tired.id }], [tired]))).toEqual([1, false]);
    const worn = own('worn', 'exhaustion', 6);
    const both = (first: number, second: number) =>
      resting(
        goldenA,
        {},
        [
          { id: tired.id, level: first },
          { id: worn.id, level: second },
        ],
        [tired, worn],
      );
    expect([read(both(2, 6)), read(both(6, 2))]).toEqual([
      [6, true],
      [6, true],
    ]);
    // Only a condition: a skill of the key `exhaustion`, stored by hand, counts for nothing.
    const skill: OwnEntity = {
      id: 'character:skill/exhaustion',
      type: 'skill',
      key: 'exhaustion',
      ability: 'con',
      ruleset: 'any',
      name: { en: 'exhaustion' },
      source: { pack: 'character' },
    };
    expect(read(resting(goldenA, {}, [{ id: skill.id, level: 6 }], [skill]))).toEqual([0, false]);
  });

  it('refuses every action that refuses the dead; the condition stays at 6', () => {
    for (const { golden, id } of EDITIONS) {
      const full = resting(golden, {}, [{ id, level: 6 }]);
      const hurt = resting(golden, { current: 5 }, [{ id, level: 6 }]);
      const down = resting(golden, { current: 0 }, [{ id, level: 6 }]);
      const index = indexFor(full);
      const dead = { code: 'dead' };
      expect(refused(applyDamage(full, index, { amount: 3 }, restStamp))).toEqual(dead);
      expect(refused(setTempHp(full, index, { amount: 5 }, restStamp))).toEqual(dead);
      expect(refused(shortRest(full, index, {}, restStamp))).toEqual(dead);
      expect(refused(longRest(full, index, restStamp))).toEqual(dead);
      expect(refused(applyHealing(hurt, index, { amount: 3 }, restStamp))).toEqual(dead);
      expect(refused(rollDeathSave(down, index, { natural: 10 }, restStamp))).toEqual(dead);
      expect(refused(stabilize(down, index, restStamp))).toEqual(dead);
      expect(refused(firstAid(full, index, restStamp))).toEqual(dead);
      expect(full.state.conditions).toEqual([{ id, level: 6 }]);
    }
  });

  it('at exhaustion 5 the same actions happen', () => {
    const atFive = (trackers: Parameters<typeof withTrackers>[1]) =>
      resting(goldenB, trackers, [{ id: EXHAUSTION_2024, level: 5 }]);
    const full = atFive({});
    const hurt = atFive({ current: 5 });
    const low = atFive({ current: 3 });
    const down = atFive({ current: 0 });
    const changes = (before: FifthEditionCharacter, result: Parameters<typeof done>[1]) =>
      done(before, result).entry.changes;
    expect(changes(full, applyDamage(full, index2024, { amount: 3 }, restStamp))).toEqual([
      { path: HP, before: 12, after: 9 },
    ]);
    expect(changes(full, setTempHp(full, index2024, { amount: 5 }, restStamp))).toEqual([
      { path: TEMP, before: 0, after: 5 },
    ]);
    expect(changes(hurt, applyHealing(hurt, index2024, { amount: 3 }, restStamp))).toEqual([
      { path: HP, before: 5, after: 8 },
    ]);
    const short = done(
      low,
      shortRest(low, index2024, { hitDice: [{ die: 10, roll: 6 }] }, restStamp),
    );
    expect(short.character.systemData.state.hp.current).toBe(11);
    expect(rested(full).character.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 4 }]);
    expect(changes(down, rollDeathSave(down, index2024, { natural: 10 }, restStamp))).toEqual([
      { path: SUCCESS, before: 0, after: 1 },
    ]);
    expect(changes(down, stabilize(down, index2024, restStamp))).toEqual([
      { path: STABLE, before: false, after: true },
    ]);
  });

  it('refuses to revive at exhaustion 6, which the revival leaves; at 5 it revives', () => {
    for (const { golden, id } of EDITIONS) {
      const full = resting(golden, {}, [{ id, level: 6 }]);
      const failed = resting(golden, { current: 0, failure: 3 }, [{ id, level: 6 }]);
      for (const character of [full, failed]) {
        expect(refused(revive(character, indexFor(character), { hp: 1 }, restStamp))).toEqual({
          code: 'exhausted',
          level: 6,
        });
      }
      const five = resting(golden, { current: 0, failure: 3 }, [{ id, level: 5 }]);
      const revived = done(five, revive(five, indexFor(five), { hp: 1 }, restStamp));
      expect(revived.entry.changes).toEqual([
        { path: HP, before: 0, after: 1 },
        { path: FAILURE, before: 3, after: 0 },
      ]);
      expect(revived.character.state.conditions).toEqual([{ id, level: 5 }]);
    }
  });

  it('is dead, not down, at 0 hit points and exhaustion 6: no Unconscious condition, no warning', () => {
    const atZero = (level: number) =>
      resting(goldenB, { current: 0 }, [{ id: EXHAUSTION_2024, level }]);
    const six = atZero(6);
    const five = atZero(5);
    expect(isDown(six, findFor(six))).toBe(false);
    expect(isDown(five, findFor(five))).toBe(true);

    const deadNow = compute(six, index2024, fifthEditionModule);
    expect(deadNow.warnings).toEqual([]);
    expect(deadNow.values['conditions.exhaustion.level']).toBe(6);
    const downNow = compute(five, index2024, fifthEditionModule);
    expect(downNow.warnings).toMatchObject([
      { code: 'characterRule', rule: 'noUnconsciousCondition', data: { key: 'unconscious' } },
    ]);
    expect(downNow.values['conditions.exhaustion.level']).toBe(5);

    const unconscious = (character: FifthEditionCharacter) =>
      compute(character, index2024Unconscious, fifthEditionModule).values[
        'conditions.unconscious.level'
      ];
    expect([unconscious(six), unconscious(five)]).toEqual([0, 1]);

    // Knocked out at 1 hit point (ENG-65): at exhaustion 6, dead, so not knocked out.
    const out = (level: number) =>
      resting(goldenB, { current: 1, knockedOut: 'resting' }, [{ id: EXHAUSTION_2024, level }]);
    const [outSix, outFive] = [out(6), out(5)];
    expect([
      isKnockedOut(outSix, findFor(outSix)),
      isKnockedOut(outFive, findFor(outFive)),
    ]).toEqual([false, true]);
    expect([unconscious(outSix), unconscious(outFive)]).toEqual([0, 1]);
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = resting(goldenB, { current: 0 }, [{ id: EXHAUSTION_2024, level: 6 }]);
    const copy = copyOf(character);
    const ice = frozen(character);
    const frozenStamp = frozen(restStamp);
    const results = [
      applyDamage(ice, index2024, frozen({ amount: 3 }), frozenStamp),
      applyHealing(ice, index2024, frozen({ amount: 3 }), frozenStamp),
      setTempHp(ice, index2024, frozen({ amount: 5 }), frozenStamp),
      shortRest(ice, index2024, frozen({}), frozenStamp),
      longRest(ice, index2024, frozenStamp),
      rollDeathSave(ice, index2024, frozen({ natural: 10 }), frozenStamp),
      stabilize(ice, index2024, frozenStamp),
      revive(ice, index2024, frozen({ hp: 1 }), frozenStamp),
    ];
    expect(results.map((result) => (result.ok ? 'done' : result.code))).toEqual([
      'dead',
      'dead',
      'dead',
      'dead',
      'dead',
      'dead',
      'dead',
      'exhausted',
    ]);
    expect(ice).toEqual(copy);
  });
});
