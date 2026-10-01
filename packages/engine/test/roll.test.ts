import {
  type DieSource,
  type FormulaReader,
  fairDie,
  type ParsedRoll,
  parseRoll,
  type RandomSource,
  type RollPart,
  type RollRequest,
  recordRoll,
} from '@grimoire/engine';
import { rollRecordSchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';

// A made-up game's rolls (ADR 004 item 4). The faces are scripted, and each expected value is
// summed by hand from them and the made-up paths below, not taken from this code.
const values: Record<string, unknown> = { 'skills.sneak.total': 7, level: 5, 'gear.worn': true };
const read: FormulaReader = (path) => (Object.hasOwn(values, path) ? values[path] : undefined);

/** A die that gives `faces` in order and records the faces it was asked for. */
function script(...faces: number[]) {
  const asked: number[] = [];
  const die: DieSource = (sides) => {
    asked.push(sides);
    return faces[asked.length - 1] ?? 1;
  };
  return { die, asked };
}

function parsedRoll(text: string): ParsedRoll {
  const result = parseRoll(text);
  if (!result.ok) throw new Error(`"${text}" did not parse: ${result.error.message}`);
  return result.formula;
}

/** Wren's sneak, with a lucky charm's 1d4 as their own modifier: ENG-26's item 4. */
const sneak: RollRequest = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  rolledAt: '2026-10-01T18:30:00.000Z',
  by: { role: 'player', name: 'Wren', actorId: '0f8fad5b-d9cb-469f-a165-70867728950e' },
  label: 'Sneak',
  path: 'skills.sneak.total',
  visibility: 'secret',
  parts: [{ label: 'Sneak', formula: '1d20 + @skills.sneak.total' }],
  modifiers: [{ label: 'Lucky charm', formula: '1d4', sourceId: 'character:talent/lucky-charm' }],
};

/** A game master's roll with no path and no actor, and the given parts. */
function gmRoll(parts: RollRequest['parts'], modifiers: readonly RollPart[] = []): RollRequest {
  return {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    rolledAt: '2026-10-01T18:31:00Z',
    by: { role: 'gm', name: 'The table' },
    label: 'Weather',
    visibility: 'hidden',
    parts,
    modifiers,
  };
}

/** Every object and array inside `value`, `value` included. */
function objectsIn(value: unknown): object[] {
  if (typeof value !== 'object' || value === null) return [];
  return [value, ...Object.values(value).flatMap(objectsIn)];
}

describe('ENG-26 a roll is recorded', () => {
  it("records the parts, then the person's own modifiers, with their sum as the total", () => {
    const { die, asked } = script(14, 3);
    const { record, warnings } = recordRoll(sneak, read, die);
    expect(record).toStrictEqual({
      id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      rolledAt: '2026-10-01T18:30:00.000Z',
      by: { role: 'player', name: 'Wren', actorId: '0f8fad5b-d9cb-469f-a165-70867728950e' },
      label: 'Sneak',
      path: 'skills.sneak.total',
      visibility: 'secret',
      total: 24,
      breakdown: [
        {
          label: 'Sneak',
          formula: '1d20 + @skills.sneak.total',
          value: 21,
          dice: [
            { at: 0, text: '1d20', count: 1, faces: 20, results: [14], kept: [true], total: 14 },
          ],
          own: false,
        },
        {
          label: 'Lucky charm',
          formula: '1d4',
          value: 3,
          dice: [{ at: 0, text: '1d4', count: 1, faces: 4, results: [3], kept: [true], total: 3 }],
          sourceId: 'character:talent/lucky-charm',
          own: true,
        },
      ],
    });
    expect(warnings).toEqual([]);
    expect(asked).toEqual([20, 4]);
    expect(rollRecordSchema.parse(record)).toStrictEqual(record);
  });

  it('records many parts and modifiers in order, each with its own dice', () => {
    // 2d20kh1 with 7 and 15 keeps 15; 3; then the person's +2 and -1d4 with 4: 15 + 3 + 2 - 4.
    const { die, asked } = script(7, 15, 4);
    const { record } = recordRoll(
      gmRoll(
        [
          { label: 'Two dice, the higher', formula: parsedRoll('2d20kh1') },
          { label: 'Wind', formula: '3', sourceId: 'tales-core:talent/weather-eye' },
        ],
        [
          { label: 'Bonus', formula: '2' },
          { label: 'Fog', formula: '-1d4' },
        ],
      ),
      read,
      die,
    );
    expect(asked).toEqual([20, 20, 4]);
    expect(record.total).toBe(16);
    expect(record.breakdown.map(({ label, value, own }) => [label, value, own])).toEqual([
      ['Two dice, the higher', 15, false],
      ['Wind', 3, false],
      ['Bonus', 2, true],
      ['Fog', -4, true],
    ]);
    expect(record.breakdown[0]?.formula).toBe('2d20kh1');
    expect(record.breakdown[0]?.dice).toEqual([
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
    ]);
    expect(record.breakdown[1]?.sourceId).toBe('tales-core:talent/weather-eye');
    expect(record.breakdown[3]?.dice[0]?.at).toBe(1);
    expect(rollRecordSchema.safeParse(record).success).toBe(true);
  });

  it('leaves out a path and an actor the request does not have', () => {
    const { record } = recordRoll(
      gmRoll([{ label: 'Weather', formula: '1d6' }]),
      read,
      script(5).die,
    );
    expect(Object.keys(record)).toEqual([
      'id',
      'rolledAt',
      'by',
      'label',
      'visibility',
      'total',
      'breakdown',
    ]);
    expect(Object.keys(record.by)).toEqual(['role', 'name']);
    expect(Object.keys(record.breakdown[0] ?? {})).toEqual([
      'label',
      'formula',
      'value',
      'dice',
      'own',
    ]);
    expect(record.total).toBe(5);
    expect(rollRecordSchema.safeParse(record).success).toBe(true);
  });

  it("gives a broken part's value with its warnings at its entry's index", () => {
    // Entry 0 does not parse (0); entry 1 reads a missing path (0 + 2); entry 2's die gives 9 on
    // a d6, no face (0); entry 3 rolls 6.
    const { die, asked } = script(9, 6);
    const { record, warnings } = recordRoll(
      gmRoll(
        [
          { label: 'Broken', formula: '1d20 +' },
          { label: 'Missing', formula: '@luck + 2' },
        ],
        [
          { label: 'Bad face', formula: '1d6' },
          { label: 'Good', formula: '1d6' },
        ],
      ),
      read,
      die,
    );
    expect(asked).toEqual([6, 6]);
    expect(record.breakdown.map((entry) => entry.value)).toEqual([0, 2, 0, 6]);
    expect(record.total).toBe(8);
    expect(record.breakdown[0]?.dice).toEqual([]);
    expect(record.breakdown[2]?.dice[0]?.results).toEqual([0]);
    expect(warnings.map(({ entry, warning }) => [entry, warning.code])).toEqual([
      [0, 'unexpected'],
      [1, 'missingPath'],
      [2, 'badFace'],
    ]);
    expect(rollRecordSchema.safeParse(record).success).toBe(true);
  });

  it('gives 0 with a warning for a value that would take the total past a finite number', () => {
    // A 308-digit number is 1e308; two of them sum to Infinity, which no record holds.
    const big = '9'.repeat(308);
    const { record, warnings } = recordRoll(
      gmRoll([{ label: 'Huge', formula: big }], [{ label: 'Huge again', formula: big }]),
      read,
      script().die,
    );
    expect(record.breakdown.map((entry) => entry.value)).toEqual([1e308, 0]);
    expect(record.total).toBe(1e308);
    expect(warnings).toEqual([
      {
        entry: 1,
        warning: { code: 'notFinite', at: 0, message: expect.stringContaining('entry 1') },
      },
    ]);
    expect(rollRecordSchema.safeParse(record).success).toBe(true);
  });

  it('shares no object with the request or the parsed formula', () => {
    // The lowest three of 3, 4, 1, 1 are 5; the lucky charm's 1d4 gives 2.
    const formula = parsedRoll('4d6kl3');
    const request: RollRequest = {
      ...sneak,
      by: { ...sneak.by },
      parts: [{ label: 'Four dice, the lower three', formula }],
    };
    const { record } = recordRoll(request, read, script(3, 4, 1, 1, 2).die);
    expect(record.total).toBe(7);
    const inside = objectsIn(record);
    expect(inside.filter((object) => Object.isFrozen(object))).toEqual([]);
    expect(inside).not.toContain(request.by);
    request.by.name = 'Someone else';
    expect(record.by.name).toBe('Wren');
  });

  it('never throws, and every record passes the schema and adds up', () => {
    // Seeded, so every run tries the same rolls: 500 requests of 1 to 3 parts and 0 to 3
    // modifiers, from texts that roll, read paths, or do not parse.
    let seed = 26;
    const next = (below: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor(seed / 65536) % below;
    };
    const random: RandomSource = () => next(65536) * 65536 + next(65536);
    const texts = [
      '1d20 + @skills.sneak.total',
      '2к20kh1',
      '4d6kl3 * 2',
      '@gear.worn ? 1d6 : 1d8',
      'max(1, 1d4 - 3)',
      '-1d4',
      '3',
      '1d6 / 2',
      '@level',
      '@luck',
      '1d20 +',
      '0d6',
      'd',
    ];
    const partsOf = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        label: `Part ${index + 1}`,
        formula: texts[next(texts.length)] as string,
        ...(next(2) === 0 && { sourceId: 'tales-core:talent/quick-step' as const }),
      }));
    let entries = 0;
    let warned = 0;
    for (let i = 0; i < 500; i++) {
      const [first, ...rest] = partsOf(1 + next(3));
      const request = gmRoll([first as RollPart, ...rest], partsOf(next(4)));
      const { record, warnings } = recordRoll(request, read, fairDie(random));
      const parsed = rollRecordSchema.safeParse(record);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(record.breakdown).toHaveLength(request.parts.length + request.modifiers.length);
      expect(record.breakdown.filter((entry) => entry.own)).toHaveLength(request.modifiers.length);
      expect(record.total).toBe(record.breakdown.reduce((sum, entry) => sum + entry.value, 0));
      entries += record.breakdown.length;
      warned += warnings.length;
    }
    expect(entries).toBeGreaterThan(1000);
    expect(warned).toBeGreaterThan(0);
  });
});
