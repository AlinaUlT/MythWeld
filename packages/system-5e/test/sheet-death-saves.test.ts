import { compute, finderOf, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  DEATH_SAVE_PATH,
  FIFTH_EDITION_SYSTEM,
  fifthEditionDeathSaves,
  fifthEditionModule,
  fifthEditionRollTest,
  openFifthEditionPack,
  ROLL_TARGETS,
} from '../src/index.ts';
import { withTrackers } from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenB, srd2024 } from './golden/index.ts';

// SHEET-43: where a character stands for the death saves tracker, on golden B (SPEC §6.7, a 2024
// fighter 1, 12 hit points). The states follow ENG-58 §8's rule, which both SRDs share: at 0 hit
// points a character is dying until three successes (stable) or three failures (dead); above 0 it
// makes no saves, but a knock-out (ENG-65) is on it; exhaustion 6 is death at any hit points (ENG-67).

const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

function shown(character: ReturnType<typeof withTrackers>) {
  const computed = compute(character, index, fifthEditionModule);
  return fifthEditionDeathSaves(character, computed, finderOf(character, index));
}

describe('SHEET-43 where the character stands', () => {
  it('makes no death saves above 0 hit points', () => {
    expect(shown(withTrackers(goldenB, {}))).toEqual({
      state: 'up',
      success: 0,
      failure: 0,
      max: 3,
    });
  });

  it('is dying at 0 hit points, with the counts stored', () => {
    expect(shown(withTrackers(goldenB, { current: 0, success: 2, failure: 1 }))).toEqual({
      state: 'dying',
      success: 2,
      failure: 1,
      max: 3,
    });
  });

  it('is stable at 0 hit points once marked stable', () => {
    expect(shown(withTrackers(goldenB, { current: 0, stable: true })).state).toBe('stable');
  });

  it('is dead at 0 hit points with three failures', () => {
    expect(shown(withTrackers(goldenB, { current: 0, failure: 3 })).state).toBe('dead');
  });

  it('is knocked out at 1 hit point with the mark, and up without it', () => {
    expect(shown(withTrackers(goldenB, { current: 1, knockedOut: 'resting' })).state).toBe(
      'knockedOut',
    );
    expect(shown(withTrackers(goldenB, { current: 1 })).state).toBe('up');
  });

  it('is dead of exhaustion at its highest level, whatever its hit points', () => {
    const at = (level: number) =>
      shown(
        withTrackers(
          goldenB,
          {},
          {
            state: {
              ...goldenB.state,
              conditions: [{ id: 'srd-2024:condition/exhaustion', level }],
            },
          },
        ),
      ).state;
    expect(at(5)).toBe('up');
    expect(at(6)).toBe('dead');
  });
});

describe('SHEET-43 the roll of a death save', () => {
  it('is a d20 test on its mode path with no number added, applied by the save targets', () => {
    const character = withTrackers(goldenB, { current: 0 });
    const computed = compute(character, index, fifthEditionModule);
    expect(DEATH_SAVE_PATH).toBe('deathSave.mode');
    expect(fifthEditionRollTest(computed, DEATH_SAVE_PATH)).toEqual({
      kind: 'deathSave',
      mode: 'deathSave.mode',
      targets: ROLL_TARGETS.deathSave(),
    });
    expect(ROLL_TARGETS.deathSave()).toEqual(['roll.deathSave', 'roll.save.all']);
  });
});
