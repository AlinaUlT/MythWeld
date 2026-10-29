import 'fake-indexeddb/auto';
import { type DieSource, type ParsedRoll, parseRoll } from '@grimoire/engine';
import { rollRecordSchema } from '@grimoire/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_DICE_KEY, readCustomDice, saveCustomDice } from '../src/db/customDice';
import { GrimoireDb } from '../src/db/db';
import { facesOf, warningKeyOf } from '../src/shared/DicePanel';
import {
  builtFormula,
  diceFields,
  panelDie,
  readNothing,
  rollWith,
  STANDARD_DICE,
  typedDie,
} from '../src/shared/dice';

const ID = '00000000-0000-4000-8000-000000000038';
const ACTOR = '0f8fad5b-d9cb-469f-a165-70867728950e';
const NOW = new Date(Date.UTC(2026, 9, 29, 18, 0, 0));

function parsed(text: string): ParsedRoll {
  const result = parseRoll(text);
  if (!result.ok) throw new Error(result.error.message);
  return result.formula;
}

/** A die that shows the faces given, in order, then 1. */
function script(...faces: number[]): DieSource {
  let next = 0;
  return () => faces[next++] ?? 1;
}

const roll = (text: string, die: DieSource, actorId?: string) =>
  rollWith({
    formula: parsed(text),
    read: readNothing,
    die,
    roller: { name: 'Player', ...(actorId !== undefined && { actorId }) },
    id: ID,
    now: NOW,
  });

describe('SHEET-38 the formula the picker builds', () => {
  it('offers the standard dice', () => {
    expect(STANDARD_DICE).toEqual([4, 6, 8, 10, 12, 20, 100]);
  });

  it('writes the count, the die and the modifier with its sign', () => {
    expect(builtFormula(37, 6, 3)).toBe('37d6 + 3');
    expect(builtFormula(1, 20, -1)).toBe('1d20 - 1');
    expect(builtFormula(2, 8, 0)).toBe('2d8');
    expect(builtFormula(1, 7, 0)).toBe('1d7');
  });
});

describe('SHEET-38 a roll of the panel', () => {
  it('records 37d6 + 3 as one entry, its total the faces plus 3', () => {
    const { record, warnings } = roll('37d6 + 3', () => 4);
    expect(warnings).toEqual([]);
    expect(rollRecordSchema.safeParse(record).success).toBe(true);
    expect(record).toMatchObject({
      id: ID,
      rolledAt: '2026-10-29T18:00:00.000Z',
      by: { role: 'player', name: 'Player' },
      label: '37d6 + 3',
      visibility: 'public',
      total: 151,
    });
    expect(record.by).not.toHaveProperty('actorId');
    expect(record.breakdown).toHaveLength(1);
    expect(record.breakdown[0]?.dice[0]?.results).toEqual(new Array(37).fill(4));
  });

  it("names the sheet's character as the roller", () => {
    expect(roll('1d20', script(9), ACTOR).record.by).toEqual({
      role: 'player',
      name: 'Player',
      actorId: ACTOR,
    });
  });

  it('reads к as d', () => {
    expect(roll('2к6+1', script(3, 5)).record.total).toBe(9);
  });

  it('shows each face, the dropped ones not kept', () => {
    const { record } = roll('2d20kh1 + 1d4', script(7, 15, 2));
    expect(record.total).toBe(17);
    expect(facesOf(record)).toEqual([
      { key: '0:0:0', face: 7, kept: false },
      { key: '0:0:1', face: 15, kept: true },
      { key: '0:10:0', face: 2, kept: true },
    ]);
  });

  it('counts a path the dice page cannot read as 0, with a warning', () => {
    const { record, warnings } = roll('1d4 + @level', script(3));
    expect(record.total).toBe(3);
    expect(warnings.map(({ warning }) => warning.code)).toEqual(['missingPath']);
    expect(warningKeyOf('missingPath')).toBe('missingPath');
    expect(warningKeyOf('notExact')).toBe('other');
    expect(warningKeyOf('other')).toBe('other');
  });
});

describe('SHEET-38 I roll myself', () => {
  it('asks one field per die, in the order written', () => {
    expect(diceFields(parsed('2d6 + 1d20'))).toEqual([
      { key: '0:1', term: '2d6', faces: 6, n: 1 },
      { key: '0:2', term: '2d6', faces: 6, n: 2 },
      { key: '6:1', term: '1d20', faces: 20, n: 1 },
    ]);
    expect(diceFields(parsed('3 + 2'))).toEqual([]);
  });

  it('counts the typed faces: 1d20 + 2 with 14 is 16', () => {
    expect(roll('1d20 + 2', typedDie([14])).record.total).toBe(16);
  });

  it('gives the faces in order, then 0', () => {
    const die = typedDie([5, 2]);
    expect([die(6), die(6), die(6)]).toEqual([5, 2, 0]);
  });
});

describe('SHEET-38 the panel rolls fairly', () => {
  it('draws from the platform’s secure numbers', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    const face = panelDie()(6);
    expect(spy).toHaveBeenCalled();
    expect(face).toBeGreaterThanOrEqual(1);
    expect(face).toBeLessThanOrEqual(6);
    spy.mockRestore();
  });

  it('passes the chi-square test of a d7 at p = 10^-9', () => {
    // The threshold is packages/engine/test/dice.test.ts's: scipy chi2.ppf(1 - 1e-9, 6) = 53.34.
    const die = panelDie();
    const faces = 7;
    const rolls = 70000;
    const counts = new Array<number>(faces + 1).fill(0);
    for (let i = 0; i < rolls; i++) {
      const face = die(faces);
      counts[face] = (counts[face] as number) + 1;
    }
    expect(counts[0]).toBe(0);
    const expected = rolls / faces;
    const chiSquare = counts
      .slice(1)
      .reduce((sum, seen) => sum + (seen - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(53.34);
  });
});

describe('SHEET-38 the custom dice', () => {
  let database: GrimoireDb;
  let count = 0;

  beforeEach(async () => {
    count += 1;
    database = new GrimoireDb(`sheet-38-${count}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('reads none before any is saved', async () => {
    expect(await readCustomDice(database.settings)).toEqual({ faces: [], refused: [] });
  });

  it('keeps each new die once, smallest first', async () => {
    await saveCustomDice([7, 3, 7, 6, 1001, 1, 2.5], database.settings);
    expect(await database.settings.get(CUSTOM_DICE_KEY)).toEqual({
      key: CUSTOM_DICE_KEY,
      value: [3, 7],
    });
    expect(await readCustomDice(database.settings)).toEqual({ faces: [3, 7], refused: [] });
  });

  it('drops and names what is not a new die', async () => {
    await database.settings.put({ key: CUSTOM_DICE_KEY, value: [9, 'a', 6, 3] });
    const read = await readCustomDice(database.settings);
    expect(read.faces).toEqual([3, 9]);
    expect(read.refused).toHaveLength(2);
    await database.settings.put({ key: CUSTOM_DICE_KEY, value: 'd7' });
    expect(await readCustomDice(database.settings)).toEqual({
      faces: [],
      refused: ['Setting customDice holds "d7", not a list'],
    });
  });
});
