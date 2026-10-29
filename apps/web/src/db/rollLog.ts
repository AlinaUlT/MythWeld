// SHEET-37: the roll log keeps the last 100 rolls of each character (SPEC §6.5), and the last 100
// made off a sheet. Logging a roll drops the oldest past 100 in the same transaction. A row opens
// through the migration frame as it is read, and one the app refuses (newer, invalid) is left as
// it is and named, not thrown (SPEC §8.2).
import { openRollLogRow, type RollRecord, rollLogRowOf } from '@grimoire/schema';
import Dexie from 'dexie';
import { db, type RollLogRow } from './db';

/** How many rolls the log keeps for one character, and for the rolls made off a sheet. */
export const ROLL_LOG_LIMIT = 100;

type RollLogTable = typeof db.rollLog;

/** A row the log holds but does not open, and why: the frame's code and its message. */
export interface RefusedRoll {
  id: string;
  code: 'newer' | 'invalid';
  message: string;
}

/** What logging gives: the record as logged, or why nothing was stored. */
export type LoggedRoll =
  | { ok: true; record: RollRecord }
  | { ok: false; code: 'invalid'; message: string };

/** The rolls of one character, newest first, and the rows that did not open. */
export interface RollLog {
  rolls: RollRecord[];
  refused: RefusedRoll[];
}

/** The rows of `characterId`, or of the rolls made off a sheet, oldest first. */
export function rowsOf(
  characterId: string | undefined,
  table: RollLogTable,
): Promise<RollLogRow[]> {
  // Dexie leaves a row with no `characterId` out of the compound index, so those are filtered.
  if (characterId === undefined) {
    return table.filter((row) => row.characterId === undefined).sortBy('rolledAt');
  }
  return table
    .where('[characterId+rolledAt]')
    .between([characterId, Dexie.minKey], [characterId, Dexie.maxKey])
    .toArray();
}

/**
 * Stores `record` in the log, under its roller's `actorId`, and drops that character's oldest
 * rows past `ROLL_LOG_LIMIT`. A record the schema refuses is not stored.
 */
export async function logRoll(record: RollRecord, table = db.rollLog): Promise<LoggedRoll> {
  const opened = openRollLogRow(rollLogRowOf(record));
  if (!opened.ok) return { ok: false, code: 'invalid', message: opened.message };
  const row = opened.value;
  await table.db.transaction('rw', table, async () => {
    await table.put(row);
    const rows = await rowsOf(row.characterId, table);
    const past = rows.slice(0, Math.max(0, rows.length - ROLL_LOG_LIMIT));
    await table.bulkDelete(past.map(({ id }) => id));
  });
  return { ok: true, record: row.record };
}

/** The last `ROLL_LOG_LIMIT` rolls of `characterId`, or of the rolls made off a sheet. */
export async function readRollLog(
  characterId: string | undefined,
  table = db.rollLog,
): Promise<RollLog> {
  const rows = (await rowsOf(characterId, table)).reverse().slice(0, ROLL_LOG_LIMIT);
  const log: RollLog = { rolls: [], refused: [] };
  for (const row of rows) {
    const opened = openRollLogRow(row);
    if (opened.ok) log.rolls.push(opened.value.record);
    else log.refused.push({ id: row.id, code: opened.code, message: opened.message });
  }
  return log;
}
