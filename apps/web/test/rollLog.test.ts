import 'fake-indexeddb/auto';
import { type RollRecord, rollLogRowOf } from '@grimoire/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GrimoireDb } from '../src/db/db';
import { logRoll, ROLL_LOG_LIMIT, readRollLog } from '../src/db/rollLog';

// A made-up game's rolls (ADR 004 item 4): Wren and Ash sneak, and the dice page rolls for no
// one. Roll n is made n seconds after 18:00, so its id and its time both name its place.

const WREN = '0f8fad5b-d9cb-469f-a165-70867728950e';
const ASH = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';

/** The uuid of roll `n`. */
function idOf(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Roll `n` of `actorId`, or of no one: a d20 that gave 14. */
function roll(n: number, actorId?: string, rolledAt?: string): RollRecord {
  return {
    id: idOf(n),
    rolledAt: rolledAt ?? new Date(Date.UTC(2026, 9, 1, 18, 0, n)).toISOString(),
    by: { role: 'player', name: 'Wren', ...(actorId !== undefined && { actorId }) },
    label: 'Sneak',
    visibility: 'public',
    total: 14,
    breakdown: [
      {
        label: 'Sneak',
        formula: '1d20',
        value: 14,
        dice: [
          { at: 0, text: '1d20', count: 1, faces: 20, results: [14], kept: [true], total: 14 },
        ],
        own: false,
      },
    ],
  };
}

/** The ids of the log's rolls, newest first. */
async function idsIn(characterId: string | undefined): Promise<string[]> {
  return (await readRollLog(characterId, database.rollLog)).rolls.map(({ id }) => id);
}

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-37-${count}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

describe('SHEET-37 the roll log', () => {
  it('keeps a roll as it was rolled, at the log version', async () => {
    const wren = roll(1, WREN);
    expect(await logRoll(wren, database.rollLog)).toEqual({ ok: true, record: wren });
    expect(await database.rollLog.get(idOf(1))).toEqual({
      schemaVersion: 1,
      id: idOf(1),
      characterId: WREN,
      rolledAt: '2026-10-01T18:00:01.000Z',
      record: wren,
    });
    expect(await readRollLog(WREN, database.rollLog)).toEqual({ rolls: [wren], refused: [] });
  });

  it("keeps a character's last 100 rolls, newest first", async () => {
    expect(ROLL_LOG_LIMIT).toBe(100);
    for (let n = 1; n <= 101; n += 1) await logRoll(roll(n, WREN), database.rollLog);
    const ids = await idsIn(WREN);
    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe(idOf(101));
    expect(ids[99]).toBe(idOf(2));
    expect(await database.rollLog.get(idOf(1))).toBeUndefined();
    expect(await database.rollLog.count()).toBe(100);
  });

  it('drops a roll older than the last 100 as it is logged', async () => {
    for (let n = 2; n <= 101; n += 1) await logRoll(roll(n, WREN), database.rollLog);
    expect(await logRoll(roll(1, WREN), database.rollLog)).toMatchObject({ ok: true });
    expect(await database.rollLog.get(idOf(1))).toBeUndefined();
    expect(await database.rollLog.count()).toBe(100);
  });

  it("drops only the character's own rolls", async () => {
    for (let n = 1; n <= 100; n += 1) await logRoll(roll(n, WREN), database.rollLog);
    for (let n = 201; n <= 203; n += 1) await logRoll(roll(n), database.rollLog);
    await logRoll(roll(301, ASH), database.rollLog);
    await logRoll(roll(101, WREN), database.rollLog);
    expect(await idsIn(WREN)).toHaveLength(100);
    expect(await idsIn(undefined)).toEqual([idOf(203), idOf(202), idOf(201)]);
    expect(await idsIn(ASH)).toEqual([idOf(301)]);
    expect(await database.rollLog.count()).toBe(104);
  });

  it('keeps the last 100 rolls made off a sheet', async () => {
    for (let n = 1; n <= 101; n += 1) await logRoll(roll(n), database.rollLog);
    const ids = await idsIn(undefined);
    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe(idOf(101));
    expect(ids[99]).toBe(idOf(2));
    expect(await database.rollLog.count()).toBe(100);
    expect(await idsIn(WREN)).toEqual([]);
  });

  it('orders by the time rolled, not by the order logged or the text of the time', async () => {
    await logRoll(roll(2, WREN, '2026-10-01T18:00:00.500Z'), database.rollLog);
    await logRoll(roll(1, WREN, '2026-10-01T18:00:00Z'), database.rollLog);
    await logRoll(roll(3, WREN, '2026-10-01T18:00:01Z'), database.rollLog);
    expect(await idsIn(WREN)).toEqual([idOf(3), idOf(2), idOf(1)]);
  });

  it('stores nothing for a record that does not add up', async () => {
    const result = await logRoll({ ...roll(1, WREN), total: 15 }, database.rollLog);
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    expect(await database.rollLog.count()).toBe(0);
  });

  it('names a row it does not open, and leaves it as it was', async () => {
    await logRoll(roll(1, WREN), database.rollLog);
    const newer = { ...rollLogRowOf(roll(2, WREN)), schemaVersion: 2 };
    const broken = { ...rollLogRowOf(roll(3, WREN)), record: { ...roll(3, WREN), total: 15 } };
    await database.rollLog.bulkPut([newer, broken]);
    const log = await readRollLog(WREN, database.rollLog);
    expect(log.rolls.map(({ id }) => id)).toEqual([idOf(1)]);
    expect(log.refused.map(({ id, code }) => ({ id, code }))).toEqual([
      { id: idOf(3), code: 'invalid' },
      { id: idOf(2), code: 'newer' },
    ]);
    expect(await database.rollLog.get(idOf(2))).toEqual(newer);
    expect(await database.rollLog.count()).toBe(3);
  });
});
