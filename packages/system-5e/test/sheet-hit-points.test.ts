import { describe, expect, it } from 'vitest';
import { CONCENTRATION_SAVE_PATH, concentrationSavePath, knockOutOffered } from '../src/index.ts';
import { withTrackers } from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// SHEET-40: what the number pad asks of the module. Golden B (2024, 12 hit points) knocks out to
// 1 hit point; golden A (2014) does not (SRD 5.2.1 "Knocking Out a Creature"; ENG-65 §8). The
// amounts below follow the rule by hand: knocking out is offered when the damage past the temporary
// hit points is at least the hit points the character has.

function with5(golden: Parameters<typeof withTrackers>[0], hp: { current: number; temp: number }) {
  return withTrackers(golden, hp);
}

describe('SHEET-40 the pad offers a knock-out', () => {
  it('offers it in 2024 only when the damage would drop the character to 0', () => {
    const b = with5(goldenB, { current: 12, temp: 0 });
    expect(knockOutOffered(b, 11)).toBe(false);
    expect(knockOutOffered(b, 12)).toBe(true);
    expect(knockOutOffered(b, 30)).toBe(true);
  });

  it('counts the damage past the temporary hit points', () => {
    const b = with5(goldenB, { current: 12, temp: 5 });
    expect(knockOutOffered(b, 16)).toBe(false);
    expect(knockOutOffered(b, 17)).toBe(true);
  });

  it('never offers it at 0 hit points, or in 2014', () => {
    expect(knockOutOffered(with5(goldenB, { current: 0, temp: 0 }), 5)).toBe(false);
    expect(knockOutOffered(with5(goldenA, { current: 12, temp: 0 }), 30)).toBe(false);
  });
});

describe('SHEET-40 the concentration save', () => {
  it('is the Constitution saving throw, when the character has one', () => {
    expect(concentrationSavePath({ values: { [CONCENTRATION_SAVE_PATH]: 2 } })).toBe(
      'abilities.con.save',
    );
    expect(concentrationSavePath({ values: {} })).toBeUndefined();
  });
});
