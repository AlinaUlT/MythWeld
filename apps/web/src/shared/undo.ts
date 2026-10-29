// SHEET-23: every change a screen makes to a character goes through `changeCharacter`, so the
// "Undo" toast follows each one (SPEC §7.2). The toast holds the change's entry; its "Undo"
// reverses that entry, not whatever change is newest. One toast shows at a time: a new change
// replaces it. The toast store is plain module state, so a screen and the host share it.
// SHEET-25: deleting a character shows its toast too; its "Undo" puts the dropped rows back.
import type { LogEntry } from '@grimoire/schema';
import {
  type DeletedCharacter,
  type DeleteResult,
  deleteCharacter,
  restoreCharacter,
  type Taken,
} from '../db/characterActions';
import type { GrimoireDb } from '../db/db';
import { type ChangeResult, recordChange, type UndoResult, undoChange } from '../db/history';

/** How long a toast stays, in milliseconds, unless the person's focus is in it. */
export const TOAST_MS = 5000;

/** A toast with "Undo": after a change, or after a character is deleted. */
export type UndoableToast =
  | { kind: 'changed'; entry: LogEntry }
  | { kind: 'deleted'; name: string; deleted: DeletedCharacter };

/** A toast with "Undo", or the one saying an undo was refused, without it. */
export type Toast = UndoableToast | { kind: 'notUndone' };

let current: Toast | undefined;
const listeners = new Set<() => void>();

function show(toast: Toast | undefined): void {
  current = toast;
  for (const listener of listeners) listener();
}

/** Calls `listener` each time the toast changes; gives the call that stops it. */
export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The toast showing now, if any. */
export function currentToast(): Toast | undefined {
  return current;
}

/** Hides `toast`, if it is still the one showing. */
export function hideToast(toast: Toast): void {
  if (current === toast) show(undefined);
}

/** Records the change (`recordChange`) and, when it is written, shows its toast. */
export async function changeCharacter(
  characterId: string,
  entry: LogEntry,
  now?: string,
  database?: GrimoireDb,
): Promise<ChangeResult> {
  const result = await recordChange(characterId, entry, now, database);
  if (result.ok) show({ kind: 'changed', entry: result.entry });
  return result;
}

/** Deletes the character (`deleteCharacter`) and, when it is gone, shows its toast. */
export async function removeCharacter(
  id: string,
  name: string,
  database?: GrimoireDb,
): Promise<DeleteResult> {
  const result = await deleteCharacter(id, database);
  if (result.ok) show({ kind: 'deleted', name, deleted: result.deleted });
  return result;
}

/**
 * Undoes the toast's change (`undoChange`) or delete (`restoreCharacter`): the toast goes, or
 * says the undo was refused.
 */
export async function undoToast(
  toast: UndoableToast,
  now?: string,
  database?: GrimoireDb,
): Promise<UndoResult | { ok: true } | Taken> {
  const result =
    toast.kind === 'changed'
      ? await undoChange(toast.entry.id, now, database)
      : await restoreCharacter(toast.deleted, database);
  if (current === toast) show(result.ok ? undefined : { kind: 'notUndone' });
  return result;
}
