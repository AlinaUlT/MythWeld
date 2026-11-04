import { applyEntry, reverseEntry } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import { COIN_STEPS, changeCoin, fifthEditionCoins } from '../src/index.ts';
import { open, stamp } from './action-checks.ts';
import { goldenB } from './golden/index.ts';

// SHEET-51: the coin actions and the Gear tab's money, on golden B (SPEC §6.7), which holds no
// coins: its `currency` is 0 in each of the five coins (`character-parts.ts`). Every expected
// count here is written by hand from that start and the steps asked.

const b = open(goldenB);
const withGold = (gp: number) => ({
  ...b,
  systemData: { ...b.systemData, currency: { ...b.systemData.currency, gp } },
});

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

describe('SHEET-51 the money shown', () => {
  it('lists the five coins from the lowest, each with its count, and the steps 1 and 10', () => {
    const shown = fifthEditionCoins(withGold(7));
    expect(shown.coins).toEqual([
      { coin: 'cp', amount: 0 },
      { coin: 'sp', amount: 0 },
      { coin: 'ep', amount: 0 },
      { coin: 'gp', amount: 7 },
      { coin: 'pp', amount: 0 },
    ]);
    expect(shown.steps).toEqual([1, 10]);
    expect(COIN_STEPS).toEqual([1, 10]);
  });
});

describe('SHEET-51 changeCoin', () => {
  it('adds a step to one coin and leaves the others, as one entry', () => {
    const made = ok(changeCoin(b, { coin: 'gp', step: 10 }, stamp));
    expect(made.character.systemData.currency).toEqual({ cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 });
    expect(made.entry.action).toBe('changeCoin');
    expect(made.entry.subject).toBe('gp');
    expect(made.entry.changes).toEqual([
      { path: ['systemData', 'currency', 'gp'], before: 0, after: 10 },
    ]);
  });

  it('takes a step off a coin: 12 gold less 1 is 11', () => {
    const made = ok(changeCoin(withGold(12), { coin: 'gp', step: -1 }, stamp));
    expect(made.character.systemData.currency.gp).toBe(11);
  });

  it('may take a coin down to exactly 0', () => {
    const made = ok(changeCoin(withGold(10), { coin: 'gp', step: -10 }, stamp));
    expect(made.character.systemData.currency.gp).toBe(0);
  });

  it('refuses a step below 0 and writes nothing: 7 gold cannot lose 10', () => {
    const refused = changeCoin(withGold(7), { coin: 'gp', step: -10 }, stamp);
    expect(refused).toMatchObject({
      ok: false,
      code: 'notEnough',
      coin: 'gp',
      held: 7,
      step: -10,
    });
  });

  it('refuses a step that is not a whole number, and a step of 0 as unchanged', () => {
    expect(changeCoin(b, { coin: 'gp', step: 1.5 }, stamp)).toMatchObject({
      ok: false,
      code: 'badStep',
    });
    expect(changeCoin(b, { coin: 'gp', step: Number.NaN }, stamp)).toMatchObject({
      ok: false,
      code: 'badStep',
    });
    expect(changeCoin(b, { coin: 'gp', step: 0 }, stamp)).toMatchObject({
      ok: false,
      code: 'unchanged',
    });
  });

  it('refuses a count past the largest whole number', () => {
    const full = withGold(Number.MAX_SAFE_INTEGER);
    expect(changeCoin(full, { coin: 'gp', step: 1 }, stamp)).toMatchObject({
      ok: false,
      code: 'badStep',
    });
  });

  it('its entry applies again and reverses to the character it came from', () => {
    const made = ok(changeCoin(b, { coin: 'cp', step: 1 }, stamp));
    expect(ok(applyEntry(b, made.entry)).character).toEqual(made.character);
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(b);
  });
});
