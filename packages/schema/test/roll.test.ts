import { type RollRecord, rollEntrySchema, rollRecordSchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

// A made-up game's roll (ADR 004 item 4): Wren sneaks with a bonus of 7 and adds a lucky charm's
// 1d4 as their own modifier. The faces are written by hand, and each sum from them.
const sneak = {
  label: 'Sneak',
  formula: '1d20 + @skills.sneak.total',
  value: 21,
  dice: [{ at: 0, text: '1d20', count: 1, faces: 20, results: [14], kept: [true], total: 14 }],
  own: false,
};
const charm = {
  label: 'Lucky charm',
  formula: '1d4',
  value: 3,
  dice: [{ at: 0, text: '1d4', count: 1, faces: 4, results: [3], kept: [true], total: 3 }],
  sourceId: 'character:talent/lucky-charm',
  own: true,
};
/** Every field a record can have. */
const record = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  rolledAt: '2026-10-01T18:30:00.000Z',
  by: { role: 'player', name: 'Wren', actorId: '0f8fad5b-d9cb-469f-a165-70867728950e' },
  label: 'Sneak',
  path: 'skills.sneak.total',
  visibility: 'secret',
  total: 24,
  breakdown: [sneak, charm],
};
/** Only the fields a record must have: the game master rolls 2d20 and keeps the highest. */
const minimal = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  rolledAt: '2026-10-01T18:31:00Z',
  by: { role: 'gm', name: 'The table' },
  label: 'Weather',
  visibility: 'hidden',
  total: 15,
  breakdown: [
    {
      label: 'Weather',
      formula: '2d20kh1',
      value: 15,
      dice: [
        {
          at: 0,
          text: '2d20kh1',
          count: 2,
          faces: 20,
          keep: { which: 'highest', count: 1 },
          results: [7, 15],
          kept: [false, true],
          total: 15,
        },
      ],
      own: false,
    },
  ],
};

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

/** The paths of every issue when `record` with `change` is parsed. */
function refused(change: Record<string, unknown>): string[] {
  return issuePaths(rollRecordSchema, { ...record, ...change });
}

/** `sneak`'s one term with `change`, in an entry, refused at these paths of the term. */
function termRefused(change: Record<string, unknown>): string[] {
  const term = { ...sneak.dice[0], ...change };
  return issuePaths(rollEntrySchema, { ...sneak, dice: [term] });
}

describe('ENG-26 the roll record', () => {
  it('parses a full record and a minimal one to equal objects', () => {
    expect(rollRecordSchema.parse(record)).toEqual(record);
    expect(rollRecordSchema.parse(minimal)).toEqual(minimal);
    const typed: RollRecord = rollRecordSchema.parse(record);
    expect(typed.breakdown.map((entry) => entry.own)).toEqual([false, true]);
  });

  it('refuses a total that is not the sum of the breakdown', () => {
    expect(refused({ total: 25 })).toEqual(['total']);
    expect(refused({ total: 21, breakdown: [sneak] })).toEqual([]);
    expect(refused({ total: 3, breakdown: [sneak] })).toEqual(['total']);
    expect(refused({ breakdown: [] })).toEqual(['breakdown', 'total']);
  });

  it('refuses a term that does not add up', () => {
    expect(termRefused({})).toEqual([]);
    expect(termRefused({ results: [14, 2] })).toEqual(['dice.0.results']);
    expect(termRefused({ kept: [true, true] })).toEqual(['dice.0.kept', 'dice.0.kept']);
    expect(termRefused({ results: [21], total: 21 })).toEqual(['dice.0.results.0']);
    expect(termRefused({ results: [-1], total: -1 })).toEqual(['dice.0.results.0', 'dice.0.total']);
    expect(termRefused({ kept: [false], total: 0 })).toEqual(['dice.0.kept']);
    expect(termRefused({ total: 13 })).toEqual(['dice.0.total']);
    // A die that gave no face is 0 (ENG-08), and still adds up.
    expect(termRefused({ results: [0], total: 0 })).toEqual([]);
  });

  it('refuses a term that keeps other than its keep count', () => {
    const [weather] = minimal.breakdown;
    const term = weather?.dice[0];
    const entryWith = (change: Record<string, unknown>) =>
      issuePaths(rollEntrySchema, { ...weather, dice: [{ ...term, ...change }] });
    expect(entryWith({})).toEqual([]);
    expect(entryWith({ kept: [true, true], total: 22 })).toEqual(['dice.0.kept']);
    expect(entryWith({ keep: { which: 'lowest', count: 3 } })).toEqual(['dice.0.kept']);
    expect(entryWith({ keep: { which: 'highest', count: 0 } })).toEqual([
      'dice.0.keep.count',
      'dice.0.kept',
    ]);
  });

  it("refuses a term whose text is not at its place in the entry's formula", () => {
    expect(termRefused({ at: 1 })).toEqual(['dice.0.text']);
    expect(termRefused({ text: '1d2' })).toEqual([]);
    expect(termRefused({ text: '1D20' })).toEqual(['dice.0.text']);
    expect(termRefused({ at: 40 })).toEqual(['dice.0.text']);
    const [term] = sneak.dice;
    const late = { ...sneak, formula: '@skills.sneak.total + 1d20', dice: [{ ...term, at: 22 }] };
    expect(issuePaths(rollEntrySchema, late)).toEqual([]);
  });

  it('refuses a secret roll by the game master and a hidden one by a player', () => {
    const gm = { role: 'gm', name: 'The table' };
    expect(refused({ visibility: 'public' })).toEqual([]);
    expect(refused({ visibility: 'hidden' })).toEqual(['visibility']);
    expect(refused({ by: gm, visibility: 'secret' })).toEqual(['visibility']);
    expect(refused({ by: gm, visibility: 'hidden' })).toEqual([]);
    expect(refused({ by: gm, visibility: 'public' })).toEqual([]);
    expect(refused({ visibility: 'private' })).toEqual(['visibility']);
    expect(refused({ by: { ...gm, role: 'dm' } })).toEqual(['by.role']);
  });

  it('refuses an unknown field anywhere, and a field of the wrong form', () => {
    expect(refused({ extra: 1 })).toEqual(['']);
    expect(refused({ by: { ...record.by, seat: 2 } })).toEqual(['by']);
    expect(refused({ breakdown: [{ ...sneak, note: 'x' }, charm] })).toEqual(['breakdown.0']);
    const term = { ...sneak.dice[0], sides: 20 };
    expect(refused({ breakdown: [{ ...sneak, dice: [term] }, charm] })).toEqual([
      'breakdown.0.dice.0',
    ]);
    expect(refused({ id: 'roll-1' })).toEqual(['id']);
    expect(refused({ rolledAt: '1 October' })).toEqual(['rolledAt']);
    expect(refused({ by: { ...record.by, name: ' ' } })).toEqual(['by.name']);
    expect(refused({ by: { ...record.by, actorId: 'wren' } })).toEqual(['by.actorId']);
    expect(refused({ label: '' })).toEqual(['label']);
    expect(refused({ path: '@skills.sneak.total' })).toEqual(['path']);
    expect(refused({ breakdown: [sneak, { ...charm, sourceId: 'charm' }] })).toEqual([
      'breakdown.1.sourceId',
    ]);
    expect(refused({ breakdown: [sneak, { ...charm, own: 'yes' }] })).toEqual(['breakdown.1.own']);
    expect(refused({ total: Number.POSITIVE_INFINITY })).toEqual(['total']);
  });
});
