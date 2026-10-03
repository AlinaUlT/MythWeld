import {
  type Computed,
  compute,
  type LogStamp,
  loadContentIndex,
  removeCondition,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  type fifthEditionEntitySchema,
  fifthEditionModule,
  longRest,
  openFifthEditionCharacter,
  openFifthEditionPack,
  shortRest,
} from '../src/index.ts';
import { done, refused, stamp as restStamp, withTrackers } from './action-checks.ts';
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
// ENG-64: golden B's Resourceful gives 1 inspiration on a long rest. A character resting here holds
// its maximum of 1, so the gain is lost and the rest changes only what ENG-61 §3 says.

const CONDITIONS = ['state', 'conditions'];

type StoredCondition = CharacterInput['state']['conditions'][number];
type OwnEntity = FifthEditionCharacter['localEntities'][number];

/**
 * A golden character with `trackers` set, these stored conditions, and entities of its own. It
 * holds 1 inspiration, the goldens' maximum, unless `trackers` says otherwise.
 */
function resting(
  golden: CharacterInput,
  trackers: Parameters<typeof withTrackers>[1],
  conditions: StoredCondition[],
  own: OwnEntity[] = [],
): FifthEditionCharacter {
  return withTrackers(
    golden,
    { inspiration: 1, ...trackers },
    {
      state: { ...golden.state, conditions },
      ...(own.length > 0 && { localEntities: own }),
    },
  );
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
