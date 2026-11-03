// SHEET-54: a change the sheet makes is a log entry (ENG-30) from the player, so it joins the
// history and shows its "Undo" toast (`changeCharacter`, SHEET-23). This builds that entry for a
// place the stored character holds now; later rows of the sheet build theirs the same way.
import type { LogChange, LogEntry } from '@grimoire/schema';
import type { AppCharacter } from '../systems';

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
    by: { role: 'player', name: character.player ?? character.name, actorId: character.id },
    action,
    subject,
    changes: [...changes],
  };
}
