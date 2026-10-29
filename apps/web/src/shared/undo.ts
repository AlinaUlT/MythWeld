// SHEET-23: every change a screen makes to a character goes through `changeCharacter`, so the
// "Undo" toast follows each one (SPEC §7.2). The toast holds the change's entry; its "Undo"
// reverses that entry, not whatever change is newest. One toast shows at a time: a new change
// replaces it. The toast store is plain module state, so a screen and the host share it.
// SHEET-25: deleting a character shows its own toast; its "Undo" puts back every row it dropped.
import type { LogEntry } from '@grimoire/schema';
import { type DeletedCharacter, deleteCharacter, restoreCharacter } from '../db/characterActions';
import type { NotFound } from '../db/characters';
import type { GrimoireDb } from '../db/db';
import { type ChangeResult, recordChange, type UndoResult, undoChange } from '../db/history';

/** How long a toast stays, in milliseconds, unless the person's focus is in it. */
export const TOAST_MS = 5000;

/**
 * The toast after a change, or after a character was deleted, each with "Undo"; or the one saying
 * an undo was refused, or that a deleted character could not be put back, without it.
 */
export type Toast =
  | { kind: 'changed'; entry: LogEntry }
  | { kind: 'notUndone'; entry: LogEntry }
  | { kind: 'deleted'; name: string; deleted: DeletedCharacter }
  | { kind: 'notRestored'; name: string };

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

/** Deletes the stored character `id` (`deleteCharacter`) and, when it is gone, shows its toast. */
export async function deleteWithUndo(
  id: string,
  name: string,
  database?: GrimoireDb,
): Promise<{ ok: true } | NotFound> {
  const result = await deleteCharacter(id, database);
  if (!result.ok) return result;
  show({ kind: 'deleted', name, deleted: result.deleted });
  return { ok: true };
}

/** What undoing a toast gives: the change's undo, or whether a deleted character came back. */
export type ToastUndoResult = UndoResult | { ok: boolean };

/**
 * Undoes the toast: a change (`undoChange`), or a deletion (`restoreCharacter`). The toast goes,
 * or says the undo was refused or failed. A toast with no "Undo" does nothing.
 */
export async function undoToast(
  toast: Toast,
  now?: string,
  database?: GrimoireDb,
): Promise<ToastUndoResult> {
  if (toast.kind === 'deleted') {
    const ok = await restoreCharacter(toast.deleted, database).then(
      () => true,
      (error: unknown) => {
        console.error(error);
        return false;
      },
    );
    if (current === toast) show(ok ? undefined : { kind: 'notRestored', name: toast.name });
    return { ok };
  }
  if (toast.kind !== 'changed') return { ok: false };
  const result = await undoChange(toast.entry.id, now, database);
  if (current === toast) show(result.ok ? undefined : { kind: 'notUndone', entry: toast.entry });
  return result;
}
