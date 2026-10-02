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
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  type fifthEditionEntitySchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
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
    // 1: disadvantage on ability checks. 3: on attack rolls and saving throws. Roll modes are
    // ENG-34's; these change no number.
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
});
