// SHEET-50: a section changes the open character by running one of its system's actions: the stamp
// is made here (a new id, the time, the person as the character), the action's entry is written
// through `changeCharacter` (SHEET-23), so the "Undo" toast follows. An action that refuses, or an
// entry that does not write, is logged and changes nothing (SPEC §8.2).
import type { LogStamp } from '@grimoire/engine';
import type { LogEntry } from '@grimoire/schema';
import { changeCharacter } from '../shared/undo';
import type { AppCharacter } from '../systems';

/** The stamp of a change `character`'s person makes now. */
export function stampOf(character: AppCharacter): LogStamp {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    by: { role: 'player', name: character.name, actorId: character.id },
  };
}

/** What an action gives, as far as the sheet reads it. */
type Made = { ok: true; entry: LogEntry } | { ok: false; code: string; message: string };

/** Runs `act` with a new stamp, and writes its entry; whether it was written. */
export async function changeSheet(
  character: AppCharacter,
  act: (stamp: LogStamp) => Made,
): Promise<boolean> {
  const made = act(stampOf(character));
  if (!made.ok) {
    console.warn(`${made.code}: ${made.message}`);
    return false;
  }
  const saved = await changeCharacter(character.id, made.entry).catch((error: unknown) => {
    console.error(error);
    return undefined;
  });
  if (saved === undefined) return false;
  if (!saved.ok) console.warn(`${saved.code}: ${saved.message}`);
  return saved.ok;
}
