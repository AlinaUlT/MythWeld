// SHEET-54: a change the sheet makes is a log entry (ENG-30) from the player, so it joins the
// history and shows its "Undo" toast (`changeCharacter`, SHEET-23). `playerEntry` builds that entry
// for a place the stored character holds now.
// SHEET-55: `perform` runs a module's action (ENG-59 and the rest) the same way: the action's
// entry, stamped by the player, is stored and shown. Later rows of the sheet use the two.
import type { ActionResult, LogStamp } from '@grimoire/engine';
import type { LogChange, LogEntry, Roller } from '@grimoire/schema';
import type { GrimoireDb } from '../db/db';
import type { ChangeResult } from '../db/history';
import { changeCharacter } from '../shared/undo';
import type { AppCharacter } from '../systems';

/** The character's player, as the one who made a change. */
function playerOf(character: AppCharacter): Roller {
  return { role: 'player', name: character.player ?? character.name, actorId: character.id };
}

/**
 * A change made by the character's player: `action` is the toast's key, `subject` what it was
 * done to, `changes` each place with its value before and after.
 */
export function playerEntry(
  character: AppCharacter,
  action: string,
  subject: string,
  changes: readonly LogChange[],
  now = new Date().toISOString(),
): LogEntry {
  return {
    id: crypto.randomUUID(),
    at: now,
    by: playerOf(character),
    action,
    subject,
    changes: [...changes],
  };
}

/** The stamp an action takes: a new entry id, the time, and the character's player. */
export function playerStamp(character: AppCharacter, now = new Date().toISOString()): LogStamp {
  return { id: crypto.randomUUID(), at: now, by: playerOf(character) };
}

/**
 * Runs `action` on the stored character as its player and, when it gives a change, stores it with
 * its toast (`changeCharacter`). A refusal comes back as it is; nothing is written.
 */
export async function perform(
  character: AppCharacter,
  action: (stamp: LogStamp) => ActionResult<AppCharacter, { code: string; message: string }>,
  database?: GrimoireDb,
): Promise<ChangeResult | { ok: false; code: string; message: string }> {
  const made = action(playerStamp(character));
  if (!made.ok) return made;
  return changeCharacter(character.id, made.entry, undefined, database);
}

/** The key of the Notes tab's own note (SHEET-54). */
export const FREE_NOTE = 'free';

/**
 * The change that makes the stored note `key` the text `text`; none when it already is. Text with
 * no visible character is no note: the key is removed (`notes` holds visible text only).
 * SHEET-53: the About tab keeps the character's alignment as the note `alignment`.
 */
export function noteEntry(
  character: AppCharacter,
  text: string,
  now?: string,
  key = FREE_NOTE,
): LogEntry | undefined {
  const stored = character.notes[key];
  const after = /\S/.test(text) ? text : undefined;
  if (after === stored) return undefined;
  return playerEntry(
    character,
    'setNote',
    key,
    [
      {
        path: ['notes', key],
        ...(stored !== undefined && { before: stored }),
        ...(after !== undefined && { after }),
      },
    ],
    now,
  );
}
