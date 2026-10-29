import {
  type Computed,
  compute,
  finderOf,
  type LogStamp,
  loadContentIndex,
  removeCondition,
  reverseEntry,
  setCondition,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  applyDamage,
  applyHealing,
  applyingFinderOf,
  EXHAUSTION_CONDITION,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  fatalExhaustion,
  type fifthEditionCharacterSchema,
  type fifthEditionEntitySchema,
  fifthEditionModule,
  firstAid,
  isDead,
  isDown,
  isKnockedOut,
  isStable,
  longRest,
  openFifthEditionCharacter,
  openFifthEditionPack,
  revive,
  rollDeathSave,
  setConditionLevel,
  setTempHp,
  shortRest,
  stabilize,
} from '../src/index.ts';
import {
  carrying,
  copyOf,
  done,
  findOf,
  frozen,
  HP,
  refused,
  stamp as restStamp,
  rowsOf,
  unattuned,
  withTrackers,
} from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2014, srd2024 } from './golden/index.ts';
import { UNCONSCIOUS_2024, with2024 } from './unconscious-entries.ts';

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

// ENG-66: SRD 5.2.1's exhaustion loses 1 level when its bearer comes back to life, as its entry's
// `recovery` on `revive` says (ENG-66 §8); SRD 5.1's has no such rule. Dead is 0 hit points with 1
// success and 3 failures (ENG-58's test). Every value was worked out by hand in ENG-66 §3 from the
// tables above.

const DEAD = { current: 0, success: 1, failure: 3 };
const REVIVED = [
  'systemData.state.hp.current',
  'systemData.state.deathSaves.success',
  'systemData.state.deathSaves.failure',
];

/** The 2014 index whose exhaustion a test gives a `revive` recovery, as a house rule would. */
const index2014Revived = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(
    openFifthEditionPack({
      ...srd2014,
      entities: [
        ...srd2014.entities,
        {
          ...exhaustion2014,
          recovery: [
            { on: 'long', amount: '1' },
            { on: 'revive', amount: '1' },
          ],
        },
      ],
    }),
  ),
]).index;

/** `character` brought back to life with `hp`, from `index`, checked by `done`. */
const revived = (
  character: FifthEditionCharacter,
  hp: number | 'max' = 1,
  index = indexFor(character),
) => done(character, revive(character, index, { hp }, restStamp));

/** The paths an entry changes, each joined. */
const paths = (entry: { changes: readonly { path: readonly (string | number)[] }[] }) =>
  entry.changes.map((change) => change.path.join('.'));

describe('ENG-66 coming back to life lowers a condition by its entry', () => {
  it("2024's exhaustion loses a level on `revive`; 2014's keeps `long` alone", () => {
    const of = (index: typeof index2024, id: string) => {
      const found = index.get(id);
      return found.ok && found.entity.type === 'condition' ? found.entity.recovery : undefined;
    };
    expect(of(index2024, EXHAUSTION_2024)).toEqual([
      { on: 'long', amount: '1' },
      { on: 'revive', amount: '1' },
    ]);
    expect(of(index2014, EXHAUSTION_2014)).toEqual([{ on: 'long', amount: '1' }]);
    expect(of(index2014Revived, EXHAUSTION_2014)).toEqual([
      { on: 'long', amount: '1' },
      { on: 'revive', amount: '1' },
    ]);
  });

  it('2024: a revival takes 1 level, and at 0 the condition ends', () => {
    const levels = [1, 2, 3, 4, 5, 6].map((level) => {
      const before = resting(goldenB, DEAD, [{ id: EXHAUSTION_2024, level }]);
      const { character, entry, outcome } = revived(before);
      expect(entry).toMatchObject({ action: 'revive', subject: 'hp' });
      expect(paths(entry), `level ${level}`).toEqual([...REVIVED, CONDITIONS.join('.')]);
      expect(outcome.warnings).toEqual([]);
      const { values } = compute(character, index2024, fifthEditionModule);
      return [level, character.state.conditions, values['speed.walk'], values['d20.all.bonus']];
    });
    expect(levels).toEqual([
      [1, [], 30, 0],
      [2, [{ id: EXHAUSTION_2024, level: 1 }], 25, -2],
      [3, [{ id: EXHAUSTION_2024, level: 2 }], 20, -4],
      [4, [{ id: EXHAUSTION_2024, level: 3 }], 15, -6],
      [5, [{ id: EXHAUSTION_2024, level: 4 }], 10, -8],
      [6, [{ id: EXHAUSTION_2024, level: 5 }], 5, -10],
    ]);
  });

  it('2014: a revival leaves exhaustion; the hit points fill the halved maximum', () => {
    const before = resting(goldenA, DEAD, [{ id: EXHAUSTION_2014, level: 4 }]);
    const { character, entry } = revived(before, 'max');
    expect(entry.changes[0]).toEqual({
      path: ['systemData', 'state', 'hp', 'current'],
      before: 0,
      after: 6,
    });
    expect(paths(entry)).toEqual(REVIVED);
    expect(character.state.conditions).toEqual([{ id: EXHAUSTION_2014, level: 4 }]);
  });

  it('measures the hit points on the maximum before the revival, then lowers the level', () => {
    const before = resting(goldenA, DEAD, [{ id: EXHAUSTION_2014, level: 4 }]);
    const { character, entry } = revived(before, 'max', index2014Revived);
    expect(entry.changes[0]).toMatchObject({ before: 0, after: 6 });
    expect(character.state.conditions).toEqual([{ id: EXHAUSTION_2014, level: 3 }]);
    const after = compute(character, index2014Revived, fifthEditionModule);
    expect([after.values['hp.max'], after.values['speed.walk']]).toEqual([12, 12]);
  });

  it('keeps every other condition as its entry says; a formula warns in the outcome', () => {
    const winded = ownCondition('winded', [{ on: 'long', amount: '1' }], 2);
    const faded = ownCondition('faded', [{ on: 'revive', amount: 'all' }], 3);
    const odd = ownCondition('odd', [{ on: 'revive', amount: '@nope' }]);
    const before = resting(
      goldenB,
      DEAD,
      [
        { id: EXHAUSTION_2024, level: 2 },
        { id: winded.id, level: 2 },
        { id: faded.id, level: 3 },
        { id: odd.id },
      ],
      [winded, faded, odd],
    );
    const { character, outcome } = revived(before);
    expect(character.state.conditions).toEqual([
      { id: EXHAUSTION_2024, level: 1 },
      { id: winded.id, level: 2 },
      { id: odd.id },
    ]);
    expect(outcome.warnings).toMatchObject([
      {
        code: 'conditionRecoveryFormula',
        condition: odd.id,
        warning: { code: 'missingPath', path: 'nope' },
      },
    ]);
    expect(outcome.warnings[0]?.message).toMatch(/nope/);
  });

  it('a refused revival lowers nothing', () => {
    const dying = resting(goldenB, { current: 0, failure: 2 }, [{ id: EXHAUSTION_2024, level: 2 }]);
    expect(refused(revive(dying, index2024, { hp: 1 }, restStamp))).toEqual({ code: 'notDead' });
    const dead = resting(goldenB, DEAD, [{ id: EXHAUSTION_2024, level: 2 }]);
    expect(refused(revive(dead, index2024, { hp: 0 }, restStamp))).toEqual({
      code: 'badAmount',
      amount: 0,
    });
    expect(dying.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 2 }]);
    expect(dead.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 2 }]);
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = resting(goldenB, DEAD, [{ id: EXHAUSTION_2024, level: 2 }]);
    const copy = copyOf(character);
    const ice = frozen(character);
    const ask = frozen({ hp: 1 });
    const result = revive(ice, index2024, ask, frozen(restStamp));
    expect(result.ok && result.character.state.conditions).toEqual([
      { id: EXHAUSTION_2024, level: 1 },
    ]);
    expect(ice).toEqual(copy);
    expect(ask).toEqual({ hp: 1 });
  });
});

// ENG-67: exhaustion at its highest level is death, in both editions (ENG-67 §8): `isDead` reads
// it, so every action refuses as for three failed death saves, and a revival that leaves it there
// is refused. Every value was worked out by hand in ENG-67 §3 from the tables above.

type Trackers = Parameters<typeof withTrackers>[1];

/** How the character finds its entries: its edition's index, with the 2014 exhaustion. */
const findIn = (character: FifthEditionCharacter) => finderOf(character, indexFor(character));

/** Golden B with the 2024 exhaustion at `level`, and `trackers` set. */
const tired = (level: number, trackers: Trackers = {}) =>
  resting(goldenB, trackers, [{ id: EXHAUSTION_2024, level }]);

/** Golden A with the 2014 exhaustion at `level`, and `trackers` set. */
const tired2014 = (level: number, trackers: Trackers = {}) =>
  resting(goldenA, trackers, [{ id: EXHAUSTION_2014, level }]);

const OWN_EXHAUSTION = 'character:condition/exhaustion';

/** A made-up exhaustion of the character's own, with `maxLevel` when given. */
function ownExhaustion(maxLevel?: number): OwnEntity {
  return {
    id: OWN_EXHAUSTION,
    type: 'condition',
    key: EXHAUSTION_CONDITION,
    ruleset: 'any',
    name: { en: 'exhaustion' },
    ...(maxLevel !== undefined && { maxLevel }),
    source: { pack: 'character' },
  };
}

describe('ENG-67 exhaustion at its highest level is death', () => {
  it("is fatal at its entry's highest level, in both editions", () => {
    expect(EXHAUSTION_CONDITION).toBe('exhaustion');
    const fatal = (character: FifthEditionCharacter) =>
      fatalExhaustion(character, findIn(character));
    expect([1, 2, 3, 4, 5, 6, 7].map((level) => fatal(tired(level)))).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      EXHAUSTION_2024,
      EXHAUSTION_2024,
    ]);
    expect(fatal(resting(goldenB, {}, [{ id: EXHAUSTION_2024 }]))).toBeUndefined();
    expect([fatal(tired2014(5)), fatal(tired2014(6))]).toEqual([undefined, EXHAUSTION_2014]);
  });

  it('takes the highest level from the entry, never a number of its own', () => {
    const own = (maxLevel: number | undefined, level?: number) => {
      const entry = ownExhaustion(maxLevel);
      const stored = { id: entry.id, ...(level !== undefined && { level }) };
      const character = resting(goldenA, {}, [stored], [entry]);
      return fatalExhaustion(character, findOf(character));
    };
    expect([own(3, 2), own(3, 3), own(10, 6), own(10, 10), own(undefined)]).toEqual([
      undefined,
      OWN_EXHAUSTION,
      undefined,
      OWN_EXHAUSTION,
      undefined,
    ]);
  });

  it('is no other condition at its highest, and no missing one', () => {
    const winded = ownCondition('winded', [{ on: 'long', amount: '1' }], 2);
    const character = resting(
      goldenB,
      {},
      [{ id: winded.id, level: 2 }, { id: 'srd-2024:condition/gone' }],
      [winded],
    );
    expect(fatalExhaustion(character, findIn(character))).toBeUndefined();
    expect(isDead(character, findIn(character))).toBe(false);
  });

  it('is dead at any hit points, beside three failed death saves', () => {
    const dead = (character: FifthEditionCharacter) => isDead(character, findIn(character));
    expect([12, 6, 1, 0].map((current) => dead(tired(6, { current })))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(dead(tired(5, { current: 6 }))).toBe(false);
    expect(dead(withTrackers(goldenB, { current: 0, failure: 3 }))).toBe(true);
  });

  it('is neither stable, down nor knocked out', () => {
    const states = (level: number) => {
      const stable = tired(level, { current: 0, stable: true });
      const down = tired(level, { current: 0 });
      const out = tired(level, { current: 1, knockedOut: 'resting' });
      return [
        isStable(stable, findIn(stable)),
        isDown(down, findIn(down)),
        isKnockedOut(out, findIn(out)),
      ];
    };
    expect(states(6)).toEqual([false, false, false]);
    expect(states(5)).toEqual([true, true, true]);
  });

  it('names no Unconscious condition, and warns of none', () => {
    const unconsciousOf = (character: FifthEditionCharacter) => {
      const result = compute(character, with2024, fifthEditionModule);
      const had = result.entities.some(({ entity }) => entity.id === UNCONSCIOUS_2024);
      return [result.values['conditions.unconscious.level'], had];
    };
    expect(unconsciousOf(tired(6, { current: 0 }))).toEqual([0, false]);
    expect(unconsciousOf(tired(6, { current: 1, knockedOut: 'resting' }))).toEqual([0, false]);
    expect(unconsciousOf(tired(5, { current: 0 }))).toEqual([1, true]);
    expect(unconsciousOf(tired(5, { current: 1, knockedOut: 'resting' }))).toEqual([1, true]);

    const rules = (level: number) =>
      compute(tired(level, { current: 0 }), index2024, fifthEditionModule).warnings.flatMap(
        (warning) => (warning.code === 'characterRule' ? [warning.rule] : []),
      );
    expect(rules(6)).toEqual([]);
    expect(rules(5)).toEqual(['noUnconsciousCondition']);
  });

  it('refuses every action the dead are refused, in both editions', () => {
    const up = tired(6, { current: 6 });
    const down = tired(6, { current: 0 });
    const out = tired(6, { current: 1, knockedOut: 'resting' });
    const refusals = [
      refused(applyDamage(up, index2024, { amount: 5 }, restStamp)),
      refused(applyHealing(up, index2024, { amount: 5 }, restStamp)),
      refused(setTempHp(up, index2024, { amount: 5 }, restStamp)),
      refused(shortRest(up, index2024, {}, restStamp)),
      refused(longRest(up, index2024, restStamp)),
      refused(rollDeathSave(down, index2024, { natural: 10 }, restStamp)),
      refused(stabilize(down, index2024, restStamp)),
      refused(firstAid(out, index2024, restStamp)),
    ];
    expect(refusals).toEqual(Array.from({ length: 8 }, () => ({ code: 'dead' })));
    const a = tired2014(6, { current: 6 });
    expect(refused(longRest(a, index2014, restStamp))).toEqual({ code: 'dead' });
  });

  it('leaves exhaustion 5 alive', () => {
    const five = tired(5, { current: 6 });
    const hit = done(five, applyDamage(five, index2024, { amount: 5 }, restStamp));
    expect(hit.entry.changes).toEqual([{ path: HP, before: 6, after: 1 }]);
    const { character, entry } = rested(five);
    expect(paths(entry)).toEqual([HP.join('.'), CONDITIONS.join('.')]);
    expect(entry.changes[0]).toEqual({ path: HP, before: 6, after: 12 });
    expect(character.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 4 }]);
  });

  it('2024: a revival takes it to 5, alive', () => {
    const six = tired(6, { current: 6 });
    const { character, entry, outcome } = revived(six);
    expect(entry.changes).toEqual([
      { path: HP, before: 6, after: 1 },
      {
        path: CONDITIONS,
        before: [{ id: EXHAUSTION_2024, level: 6 }],
        after: [{ id: EXHAUSTION_2024, level: 5 }],
      },
    ]);
    expect(outcome.warnings).toEqual([]);
    expect(isDead(character, findIn(character))).toBe(false);
    const { values } = compute(character, index2024, fifthEditionModule);
    expect([values['speed.walk'], values['d20.all.bonus']]).toEqual([5, -10]);
    expect(revived(six, 'max').entry.changes[0]).toEqual({ path: HP, before: 6, after: 12 });
  });

  it('2014: a revival that leaves it at 6 is refused, the character still dead', () => {
    for (const trackers of [{ current: 6 }, { current: 1 }, DEAD]) {
      const before = tired2014(6, trackers);
      expect(refused(revive(before, index2014, { hp: 1 }, restStamp))).toEqual({
        code: 'stillDead',
        condition: EXHAUSTION_2014,
      });
    }
    const dead = tired2014(6, DEAD);
    const { character, entry } = revived(dead, 'max', index2014Revived);
    expect(entry.changes[0]).toEqual({ path: HP, before: 0, after: 6 });
    expect(character.state.conditions).toEqual([{ id: EXHAUSTION_2014, level: 5 }]);
    expect(isDead(character, finderOf(character, index2014Revived))).toBe(false);
  });

  it('stores nothing: the level decides, and undo brings the character back', () => {
    const fresh = withTrackers(goldenB, {});
    const find = findIn(fresh);
    expect(isDead(fresh, find)).toBe(false);
    const six = setCondition(fresh, index2024, { id: EXHAUSTION_2024, level: 6 }, restStamp);
    if (!six.ok) throw new Error(six.message);
    expect(isDead(six.character, find)).toBe(true);
    const back = reverseEntry(six.character, six.entry);
    if (!back.ok) throw new Error(back.message);
    expect(isDead(back.character, find)).toBe(false);
    const five = setCondition(
      six.character,
      index2024,
      { id: EXHAUSTION_2024, level: 5 },
      restStamp,
    );
    if (!five.ok) throw new Error(five.message);
    expect(isDead(five.character, find)).toBe(false);
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = tired2014(6, { current: 6 });
    const copy = copyOf(character);
    const ice = frozen(character);
    const ask = frozen({ hp: 1 });
    expect(fatalExhaustion(ice, findIn(ice))).toBe(EXHAUSTION_2014);
    expect(isDead(ice, findIn(ice))).toBe(true);
    expect(revive(ice, index2014, ask, frozen(restStamp)).ok).toBe(false);
    expect(ice).toEqual(copy);
    expect(ask).toEqual({ hp: 1 });
  });
});

// ENG-69: a level that kills, set through fifth edition's `setConditionLevel`, ends every
// attunement in the same entry, as ENG-63's deaths do; any other level gives the core's
// `setCondition` as it is. The charm and the stone are ENG-63's (`action-checks.ts`). Every value
// was worked out by hand in ENG-69 §3 from the tables above.

/** `golden` carrying the charm and the stone, attuned as given, with these conditions stored. */
const carryingWith = (
  golden: CharacterInput,
  conditions: StoredCondition[],
  trackers: Trackers = {},
  attuned = true,
  own: OwnEntity[] = [],
) =>
  carrying(golden, trackers, attuned, {
    state: { ...golden.state, conditions },
    localEntities: own,
  });

/** The module's action on `character`, from its edition's index, and the core's. */
const setBoth = (character: FifthEditionCharacter, ask: { id: string; level?: number }) => {
  const index = indexFor(character);
  return {
    module: setConditionLevel(character, index, ask, restStamp),
    core: setCondition(character, index, ask, restStamp),
  };
};

/** The module's action on `character` that happens, checked by `done`. */
const setLevel = (character: FifthEditionCharacter, id: string, level: number) =>
  done(character, setConditionLevel(character, indexFor(character), { id, level }, restStamp));

/** The change to the stored conditions from one level of `id` to another; 0 is none. */
const conditionChange = (id: string, before: number, after: number) => ({
  path: CONDITIONS,
  before: before === 0 ? [] : [{ id, level: before }],
  after: after === 0 ? [] : [{ id, level: after }],
});

const deadOf = (character: FifthEditionCharacter) => isDead(character, findIn(character));

describe('ENG-69 dying of exhaustion ends attunement', () => {
  it("gives the core's result for a level that does not kill", () => {
    const winded = ownCondition('winded', [{ on: 'long', amount: '1' }], 2);
    const cases: [FifthEditionCharacter, string, number, ReturnType<typeof conditionChange>][] = [
      [carryingWith(goldenB, []), EXHAUSTION_2024, 1, conditionChange(EXHAUSTION_2024, 0, 1)],
      [
        carryingWith(goldenB, [{ id: EXHAUSTION_2024, level: 4 }]),
        EXHAUSTION_2024,
        5,
        conditionChange(EXHAUSTION_2024, 4, 5),
      ],
      [
        carryingWith(goldenB, [{ id: winded.id, level: 1 }], {}, true, [winded]),
        winded.id,
        2,
        conditionChange(winded.id, 1, 2),
      ],
      [
        carryingWith(goldenA, [{ id: OWN_EXHAUSTION, level: 5 }], {}, true, [ownExhaustion(10)]),
        OWN_EXHAUSTION,
        6,
        conditionChange(OWN_EXHAUSTION, 5, 6),
      ],
    ];
    for (const [character, id, level, change] of cases) {
      const { module, core } = setBoth(character, { id, level });
      const set = done(character, module);
      expect(set).toEqual(core);
      expect(set.entry.changes).toEqual([change]);
      expect(deadOf(set.character)).toBe(false);
      expect(set.character.systemData.inventory).toEqual(character.systemData.inventory);
    }
  });

  it('ends every attunement when the level kills, in the same entry', () => {
    const five = carryingWith(goldenB, [{ id: EXHAUSTION_2024, level: 5 }], { current: 6 });
    const six = setLevel(five, EXHAUSTION_2024, 6);
    expect(six.entry).toMatchObject({
      action: 'setCondition',
      subject: EXHAUSTION_2024,
      label: { en: 'Exhaustion' },
    });
    expect(six.entry.changes).toEqual([conditionChange(EXHAUSTION_2024, 5, 6), unattuned(goldenB)]);
    expect(deadOf(six.character)).toBe(true);
    expect(six.character.systemData.inventory).toEqual(rowsOf(goldenB, false));

    const back = reverseEntry(six.character, six.entry);
    if (!back.ok) throw new Error(back.message);
    expect(back.character).toEqual(five);
    expect(back.character.systemData.inventory).toEqual(rowsOf(goldenB, true));
    expect(deadOf(back.character)).toBe(false);
  });

  it('kills from no exhaustion, and at 0 hit points, the death saves kept', () => {
    const none = carryingWith(goldenB, [], { current: 6 });
    expect(setLevel(none, EXHAUSTION_2024, 6).entry.changes).toEqual([
      conditionChange(EXHAUSTION_2024, 0, 6),
      unattuned(goldenB),
    ]);
    const dying = carryingWith(goldenB, [{ id: EXHAUSTION_2024, level: 5 }], {
      current: 0,
      failure: 2,
    });
    const six = setLevel(dying, EXHAUSTION_2024, 6);
    expect(six.entry.changes).toEqual([conditionChange(EXHAUSTION_2024, 5, 6), unattuned(goldenB)]);
    expect(six.character.systemData.state.deathSaves).toEqual({
      success: 0,
      failure: 2,
      stable: false,
    });
  });

  it("kills at each entry's highest level: 2014's, and one of the character's own", () => {
    const five = carryingWith(goldenA, [{ id: EXHAUSTION_2014, level: 5 }], { current: 6 });
    expect(setLevel(five, EXHAUSTION_2014, 6).entry.changes).toEqual([
      conditionChange(EXHAUSTION_2014, 5, 6),
      unattuned(goldenA),
    ]);
    const own = carryingWith(goldenA, [{ id: OWN_EXHAUSTION, level: 2 }], {}, true, [
      ownExhaustion(3),
    ]);
    expect(setLevel(own, OWN_EXHAUSTION, 3).entry.changes).toEqual([
      conditionChange(OWN_EXHAUSTION, 2, 3),
      unattuned(goldenA),
    ]);
  });

  it('ends attunement only in the act that kills', () => {
    const failed = carryingWith(goldenB, [], DEAD);
    const { module: onDead, core: coreOnDead } = setBoth(failed, { id: EXHAUSTION_2024, level: 6 });
    const deadTwice = done(failed, onDead);
    expect(deadTwice).toEqual(coreOnDead);
    expect(deadTwice.entry.changes).toEqual([conditionChange(EXHAUSTION_2024, 0, 6)]);
    expect(deadTwice.character.systemData.inventory).toEqual(rowsOf(goldenB, true));

    const fatal = carryingWith(goldenB, [{ id: EXHAUSTION_2024, level: 6 }], { current: 6 }, false);
    const { module: back, core: coreBack } = setBoth(fatal, { id: EXHAUSTION_2024, level: 5 });
    const alive = done(fatal, back);
    expect(alive).toEqual(coreBack);
    expect(alive.entry.changes).toEqual([conditionChange(EXHAUSTION_2024, 6, 5)]);
    expect(deadOf(alive.character)).toBe(false);
    expect(alive.character.systemData.inventory).toEqual(rowsOf(goldenB, false));

    const bare = resting(goldenB, { current: 6 }, [{ id: EXHAUSTION_2024, level: 5 }]);
    const { module: plain, core: corePlain } = setBoth(bare, { id: EXHAUSTION_2024, level: 6 });
    const dead = done(bare, plain);
    expect(dead).toEqual(corePlain);
    expect(dead.entry.changes).toEqual([conditionChange(EXHAUSTION_2024, 5, 6)]);
    expect(deadOf(dead.character)).toBe(true);
  });

  it("refuses as the core's action refuses", () => {
    const five = carryingWith(goldenB, [{ id: EXHAUSTION_2024, level: 5 }]);
    const asks = [
      { id: 'character:condition/gone' },
      { id: EXHAUSTION_2024, level: 7 },
      { id: EXHAUSTION_2024, level: 0 },
      { id: EXHAUSTION_2024, level: 5 },
      { id: 'srd-2024:item/greatsword' },
    ];
    const results = asks.map((ask) => setBoth(five, ask));
    for (const { module, core } of results) expect(module).toEqual(core);
    expect(results.map(({ module }) => refused(module))).toEqual([
      { code: 'missing', id: 'character:condition/gone' },
      { code: 'badLevel', id: EXHAUSTION_2024, level: 7, max: 6 },
      { code: 'badLevel', id: EXHAUSTION_2024, level: 0, max: 6 },
      { code: 'unchanged' },
      { code: 'notACondition', id: 'srd-2024:item/greatsword', type: 'item' },
    ]);
  });

  it('2024: a revival after it gives no attunement back', () => {
    const five = carryingWith(goldenB, [{ id: EXHAUSTION_2024, level: 5 }], { current: 6 });
    const { character, entry } = revived(setLevel(five, EXHAUSTION_2024, 6).character);
    expect(entry.changes).toEqual([
      { path: HP, before: 6, after: 1 },
      conditionChange(EXHAUSTION_2024, 6, 5),
    ]);
    expect(deadOf(character)).toBe(false);
    expect(character.systemData.inventory).toEqual(rowsOf(goldenB, false));
  });

  it('2014: refused a revival, it comes back by a lower level, its attunement still ended', () => {
    const five = carryingWith(goldenA, [{ id: EXHAUSTION_2014, level: 5 }], { current: 6 });
    const dead = setLevel(five, EXHAUSTION_2014, 6).character;
    expect(refused(revive(dead, index2014, { hp: 1 }, restStamp))).toEqual({
      code: 'stillDead',
      condition: EXHAUSTION_2014,
    });
    const { module, core } = setBoth(dead, { id: EXHAUSTION_2014, level: 5 });
    const lowered = done(dead, module);
    expect(lowered).toEqual(core);
    expect(lowered.entry.changes).toEqual([conditionChange(EXHAUSTION_2014, 6, 5)]);
    expect(deadOf(lowered.character)).toBe(false);
    expect(lowered.character.systemData.inventory).toEqual(rowsOf(goldenA, false));
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = carryingWith(goldenB, [{ id: EXHAUSTION_2024, level: 5 }]);
    const copy = copyOf(character);
    const ice = frozen(character);
    const ask = frozen({ id: EXHAUSTION_2024, level: 6 });
    const result = setConditionLevel(ice, index2024, ask, frozen(restStamp));
    expect(result.ok && result.entry.changes.length).toBe(2);
    expect(ice).toEqual(copy);
    expect(ask).toEqual({ id: EXHAUSTION_2024, level: 6 });
  });
});

// SHEET-64: exhaustion the character is immune to does not kill (SHEET-61 §8: immunity "doesn't
// affect you in any way"; ENG-67 §8: level 6 is death). Golden B (12 hit points) with a feat of
// its own immune to exhaustion, made up, no text of a book. Every value was worked out by hand in
// SHEET-64's ticket from golden B and the 2024 table.

const TIRELESS = 'character:feat/tireless';

/** A made-up feat: immune to the condition `exhaustion`. */
const tireless: OwnEntity = {
  id: TIRELESS,
  type: 'feat',
  ruleset: 'any',
  name: { en: 'tireless' },
  source: { pack: 'character' },
  effects: [
    {
      id: 'no-exhaustion',
      target: 'defenses.conditionImmune',
      op: 'append',
      value: EXHAUSTION_CONDITION,
    },
  ],
} as OwnEntity;

/** Golden B taking `tireless`; with `ended`, its immunity overridden to 0. */
const tirelessB = (ended = false): CharacterInput => ({
  ...goldenB,
  systemData: { ...goldenB.systemData, feats: [{ id: TIRELESS }] },
  overrides: ended ? [{ path: 'defenses.conditionImmune.exhaustion', value: 0 }] : [],
});

/** Golden B taking `tireless`, the 2024 exhaustion at 6, and `trackers` set. */
const immune = (trackers: Trackers = {}, ended = false) =>
  resting(tirelessB(ended), trackers, [{ id: EXHAUSTION_2024, level: 6 }], [tireless]);

/** The refusal codes of every action the dead are refused, on the immune character. */
function deadRefusals(ended: boolean) {
  const code = (result: { ok: boolean; code?: string }) => (result.ok ? 'done' : result.code);
  const up = immune({ current: 6 }, ended);
  const down = immune({ current: 0 }, ended);
  const out = immune({ current: 1, knockedOut: 'resting' }, ended);
  return [
    code(applyDamage(up, with2024, { amount: 5 }, restStamp)),
    code(applyHealing(up, with2024, { amount: 5 }, restStamp)),
    code(setTempHp(up, with2024, { amount: 5 }, restStamp)),
    code(shortRest(up, with2024, {}, restStamp)),
    code(longRest(up, with2024, restStamp)),
    code(rollDeathSave(down, with2024, { natural: 10 }, restStamp)),
    code(stabilize(down, with2024, restStamp)),
    code(firstAid(out, with2024, restStamp)),
  ];
}

describe('SHEET-64 exhaustion the character is immune to does not kill', () => {
  it('is not dead through what applies; the stored level is unchanged', () => {
    const character = immune({ current: 6 });
    expect(character.state.conditions).toEqual([{ id: EXHAUSTION_2024, level: 6 }]);
    expect(isDead(character, applyingFinderOf(character, with2024))).toBe(false);
    expect(isDead(character, findIn(character))).toBe(true);
    expect(fatalExhaustion(character, applyingFinderOf(character, with2024))).toBeUndefined();
  });

  it('is unconscious at 0 hit points, the exhaustion at level 0', () => {
    const result = compute(immune({ current: 0 }), with2024, fifthEditionModule);
    expect(result.values['conditions.unconscious.level']).toBe(1);
    expect(result.values['conditions.exhaustion.level']).toBe(0);
    expect(result.entities.some(({ entity }) => entity.id === UNCONSCIOUS_2024)).toBe(true);
    expect(result.withheld?.map(({ entity }) => entity.id)).toEqual([EXHAUSTION_2024]);

    // Without an Unconscious entry in reach, it warns of none, beside the immunity.
    const rules = compute(immune({ current: 0 }), index2024, fifthEditionModule).warnings.flatMap(
      (warning) => (warning.code === 'characterRule' ? [warning.rule] : []),
    );
    expect(rules).toEqual(['noUnconsciousCondition', 'immuneCondition']);
  });

  it('takes damage, death saves, first aid and rests as the living do', () => {
    // A short rest that spends no Hit Die changes nothing: refused as `unchanged`, never `dead`.
    expect(deadRefusals(false)).toEqual([
      'done',
      'done',
      'done',
      'unchanged',
      'done',
      'done',
      'done',
      'done',
    ]);
    const up = immune({ current: 6 });
    const hit = done(up, applyDamage(up, with2024, { amount: 5 }, restStamp));
    expect(hit.entry.changes).toEqual([{ path: HP, before: 6, after: 1 }]);
    const down = immune({ current: 0 });
    const save = done(down, rollDeathSave(down, with2024, { natural: 10 }, restStamp));
    expect(save.outcome).toEqual({ successes: 1, failures: 0, hp: 0, status: 'dying' });
    expect(refused(revive(up, with2024, { hp: 1 }, restStamp))).toEqual({ code: 'notDead' });
  });

  it('setting it to 6 ends no attunement', () => {
    const golden = tirelessB();
    const five = carryingWith(golden, [{ id: EXHAUSTION_2024, level: 5 }], { current: 6 }, true, [
      tireless,
    ]);
    const ask = { id: EXHAUSTION_2024, level: 6 };
    const set = done(five, setConditionLevel(five, index2024, ask, restStamp));
    expect(set).toEqual(setCondition(five, index2024, ask, restStamp));
    expect(set.entry.changes).toEqual([conditionChange(EXHAUSTION_2024, 5, 6)]);
    expect(set.character.systemData.inventory).toEqual(rowsOf(golden, true));
  });

  it('kills again once the immunity ends', () => {
    const character = immune({ current: 6 }, true);
    expect(isDead(character, applyingFinderOf(character, with2024))).toBe(true);
    expect(deadRefusals(true)).toEqual(Array.from({ length: 8 }, () => 'dead'));
    const result = compute(immune({ current: 0 }, true), with2024, fifthEditionModule);
    expect(result.values['conditions.unconscious.level']).toBe(0);
    expect(result).not.toHaveProperty('withheld');
  });
});
