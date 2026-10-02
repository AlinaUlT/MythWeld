import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../../src/index.ts';
import { opened, standingIn } from './checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenC2024,
  goldenD,
  srd2014,
  srd2024,
} from './index.ts';

// The golden tests (SPEC §6.7): each value below is SPEC §6.7's, computed by hand there, never
// copied from a run. Each ticket from ENG-13 to ENG-19 adds the lines it makes true; the goldens
// are whole by ENG-19 (BACKLOG). A line no ticket has made true yet is not here.

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** A golden character, computed by fifth edition's module on its edition's pack. */
function computed(
  golden: z.input<typeof fifthEditionCharacterSchema>,
): Computed<FifthEditionEntity> {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = character.ruleset === '2014' ? index2014 : index2024;
  return compute(character, index, standingIn);
}

const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Path → value, for the paths named. */
function valuesOf(result: Computed<FifthEditionEntity>, paths: readonly string[]) {
  return Object.fromEntries(paths.map((path) => [path, result.values[path]]));
}

/** Each path's value, by the key in its middle: `abilities.<key>.mod` → key → value. */
function byKey(
  result: Computed<FifthEditionEntity>,
  pattern: (key: string) => string,
  keys = STATS,
) {
  return Object.fromEntries(keys.map((key) => [key, result.values[pattern(key)]]));
}

describe('ENG-13 goldens: check bonuses', () => {
  const a = computed(goldenA);
  const b = computed(goldenB);
  const b4 = computed(goldenB4);
  const d = computed(goldenD);

  it('golden A: modifiers, saves, skills, passive Perception', () => {
    expect(byKey(a, (key) => `abilities.${key}.mod`)).toEqual({
      str: 1,
      dex: 0,
      con: 3,
      int: -1,
      wis: 3,
      cha: 1,
    });
    // WIS +5, CHA +3, the others equal to their modifier.
    expect(byKey(a, (key) => `abilities.${key}.save`)).toEqual({
      str: 1,
      dex: 0,
      con: 3,
      int: -1,
      wis: 5,
      cha: 3,
    });
    expect(
      valuesOf(a, [
        'skills.insight.total',
        'skills.medicine.total',
        'skills.persuasion.total',
        'skills.religion.total',
        'skills.perception.total',
        'skills.perception.passive',
      ]),
    ).toEqual({
      'skills.insight.total': 5,
      'skills.medicine.total': 5,
      'skills.persuasion.total': 3,
      'skills.religion.total': 1,
      'skills.perception.total': 3,
      'skills.perception.passive': 13,
    });
  });

  it('golden B: modifiers, saves, skills, passive Perception', () => {
    expect(byKey(b, (key) => `abilities.${key}.mod`)).toEqual({
      str: 3,
      dex: 1,
      con: 2,
      int: -1,
      wis: 1,
      cha: 0,
    });
    expect(valuesOf(b, ['abilities.str.save', 'abilities.con.save'])).toEqual({
      'abilities.str.save': 5,
      'abilities.con.save': 4,
    });
    expect(
      valuesOf(b, [
        'skills.athletics.total',
        'skills.intimidation.total',
        'skills.perception.total',
        'skills.survival.total',
        'skills.insight.total',
        'skills.perception.passive',
      ]),
    ).toEqual({
      'skills.athletics.total': 5,
      'skills.intimidation.total': 2,
      'skills.perception.total': 3,
      'skills.survival.total': 3,
      'skills.insight.total': 3,
      'skills.perception.passive': 13,
    });
  });

  it('golden B4: STR 19 (+4), Athletics +6', () => {
    expect(
      valuesOf(b4, ['abilities.str.score', 'abilities.str.mod', 'skills.athletics.total']),
    ).toEqual({ 'abilities.str.score': 19, 'abilities.str.mod': 4, 'skills.athletics.total': 6 });
  });

  it('golden C: proficiency bonus +3, in both editions', () => {
    expect(computed(goldenC2014).values.prof).toBe(3);
    expect(computed(goldenC2024).values.prof).toBe(3);
  });

  it('golden D: Athletics +1, STR save +1; without exhaustion, golden B again', () => {
    expect(valuesOf(d, ['skills.athletics.total', 'abilities.str.save'])).toEqual({
      'skills.athletics.total': 1,
      'abilities.str.save': 1,
    });
    expect(valuesOf(b, ['skills.athletics.total', 'abilities.str.save'])).toEqual({
      'skills.athletics.total': 5,
      'abilities.str.save': 5,
    });
  });

  it('every golden: no warning, and each breakdown adds up to its value', () => {
    const all = [a, b, b4, d, computed(goldenC2014), computed(goldenC2024)];
    for (const result of all) {
      expect(result.warnings).toEqual([]);
      for (const [path, steps] of Object.entries(result.breakdown)) {
        const sum = steps.reduce((total, step) => total + step.change, 0);
        expect([path, sum]).toEqual([path, result.values[path]]);
      }
    }
  });
});

describe('ENG-14 goldens: combat numbers', () => {
  const a = computed(goldenA);
  const b = computed(goldenB);
  const b4 = computed(goldenB4);
  const d = computed(goldenD);
  const combat = ['hp.max', 'ac.total', 'init.total', 'speed.walk'];

  it('golden A: hit points 12, AC 18, speed 25, initiative +0', () => {
    // 12 = 8 + 3 + 1 (Dwarven Toughness); 18 = chain mail 16 + shield 2.
    expect(valuesOf(a, combat)).toEqual({
      'hp.max': 12,
      'ac.total': 18,
      'init.total': 0,
      'speed.walk': 25,
    });
  });

  it('golden B: hit points 12, initiative +3, AC 17, speed 30', () => {
    // +3 = DEX +1, Alert +2; 17 = chain mail 16 + Defense 1.
    expect(valuesOf(b, combat)).toEqual({
      'hp.max': 12,
      'ac.total': 17,
      'init.total': 3,
      'speed.walk': 30,
    });
  });

  it('golden B4: hit points 36 = 12 + 3 × (6 + 2), initiative +3', () => {
    expect(valuesOf(b4, ['hp.max', 'init.total'])).toEqual({ 'hp.max': 36, 'init.total': 3 });
  });

  it('golden D: initiative −1, speed 20; without exhaustion, golden B again', () => {
    expect(valuesOf(d, ['init.total', 'speed.walk'])).toEqual({
      'init.total': -1,
      'speed.walk': 20,
    });
    expect(valuesOf(b, ['init.total', 'speed.walk'])).toEqual({
      'init.total': 3,
      'speed.walk': 30,
    });
  });
});
