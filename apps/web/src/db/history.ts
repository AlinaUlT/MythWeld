// SHEET-23: a change to a character is its log entry (ENG-30), applied to the stored character and
// kept in the history, in one transaction; the history keeps each character's last 50 (SPEC §7.2).
// The entry applies to the character as stored, not to a screen's copy of it, so a change made
// over a newer one is refused, not written. Undoing reverses the entry the same way, and the
// change leaves the history. Each write counts one revision on and sets `updatedAt`.
import { applyEntry, type EntryRefusal, reverseEntry } from '@grimoire/engine';
import { historyRowOf, type LogEntry, openHistoryRow } from '@grimoire/schema';
import Dexie from 'dexie';
import type { AppCharacter } from '../systems';
import { type OpenedCharacter, openCharacter, saveCharacter } from './characters';
import { db, type GrimoireDb, type HistoryRow } from './db';

/** How many changes the history keeps for one character. */
export const HISTORY_LIMIT = 50;

/** An entry the history does not take or does not open, and why. */
export interface BadEntry {
  ok: false;
  code: 'badEntry';
  message: string;
}

/** No change is kept with this id. */
export interface NoEntry {
  ok: false;
  code: 'noEntry';
  id: string;
  message: string;
}

/**
 * What a change or its undo gives: the character as stored after it, and the entry; or why
 * nothing was written: the character did not open, a place no longer holds what the entry says,
 * the result failed the character's schema, or the entry is not one the history takes.
 */
export type ChangeResult =
  | { ok: true; character: AppCharacter; entry: LogEntry }
  | Exclude<OpenedCharacter, { ok: true }>
  | ({ ok: false } & EntryRefusal)
  | BadEntry;

/** What undoing gives: a change's result, or no change kept with that id. */
export type UndoResult = ChangeResult | NoEntry;

/** A change kept in the history that does not open, and why: the frame's code and its message. */
export interface RefusedChange {
  id: string;
  code: 'newer' | 'invalid';
  message: string;
}

/** The changes of one character, newest first, and the rows that did not open. */
export interface History {
  entries: LogEntry[];
  refused: RefusedChange[];
}

/** The history rows of `characterId`, oldest first. */
function rowsOf(characterId: string, table: GrimoireDb['history']): Promise<HistoryRow[]> {
  return table
    .where('[characterId+at]')
    .between([characterId, Dexie.minKey], [characterId, Dexie.maxKey])
    .toArray();
}

/** `character` one revision on, updated at `now`. */
export function revised(character: AppCharacter, now: string): AppCharacter {
  return { ...character, rev: character.rev + 1, updatedAt: now };
}

/**
 * Applies `entry` to the stored character `characterId`, stores the result one revision on, keeps
 * the entry in the history and drops that character's oldest changes past `HISTORY_LIMIT`. When
 * any step refuses, nothing is written.
 */
export async function recordChange(
  characterId: string,
  entry: LogEntry,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<ChangeResult> {
  const opened = openHistoryRow(historyRowOf(characterId, entry));
  if (!opened.ok) return { ok: false, code: 'badEntry', message: opened.message };
  const row = opened.value;
  return database.transaction('rw', database.characters, database.history, async () => {
    const stored = await openCharacter(characterId, database.characters);
    if (!stored.ok) return stored;
    const applied = applyEntry(stored.value, row.entry);
    if (!applied.ok) return applied;
    const saved = await saveCharacter(revised(applied.character, now), database.characters);
    if (!saved.ok) return saved;
    await database.history.put(row);
    const rows = await rowsOf(characterId, database.history);
    const past = rows.slice(0, Math.max(0, rows.length - HISTORY_LIMIT));
    await database.history.bulkDelete(past.map(({ id }) => id));
    return { ok: true, character: saved.value, entry: row.entry };
  });
}

/**
 * Reverses the kept change `entryId` on its stored character, stores the result one revision on,
 * and drops the change from the history. When any step refuses, nothing is written.
 */
export async function undoChange(
  entryId: string,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<UndoResult> {
  return database.transaction('rw', database.characters, database.history, async () => {
    const kept = await database.history.get(entryId);
    if (kept === undefined) {
      return {
        ok: false,
        code: 'noEntry',
        id: entryId,
        message: `No change is kept with id ${entryId}.`,
      };
    }
    const opened = openHistoryRow(kept);
    if (!opened.ok) return { ok: false, code: 'badEntry', message: opened.message };
    const { characterId, entry } = opened.value;
    const stored = await openCharacter(characterId, database.characters);
    if (!stored.ok) return stored;
    const reversed = reverseEntry(stored.value, entry);
    if (!reversed.ok) return reversed;
    const saved = await saveCharacter(revised(reversed.character, now), database.characters);
    if (!saved.ok) return saved;
    await database.history.delete(entryId);
    return { ok: true, character: saved.value, entry };
  });
}

/** The last `HISTORY_LIMIT` changes of `characterId`, newest first. */
export async function readHistory(
  characterId: string,
  database: GrimoireDb = db,
): Promise<History> {
  const rows = (await rowsOf(characterId, database.history)).reverse().slice(0, HISTORY_LIMIT);
  const history: History = { entries: [], refused: [] };
  for (const row of rows) {
    const opened = openHistoryRow(row);
    if (opened.ok) history.entries.push(opened.value.entry);
    else history.refused.push({ id: row.id, code: opened.code, message: opened.message });
  }
  return history;
}
