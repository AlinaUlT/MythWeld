// SHEET-23: every change a screen makes to a character goes through `changeCharacter`, so the
// "Undo" toast follows each one (SPEC §7.2). The toast holds the change's entry; its "Undo"
// reverses that entry, not whatever change is newest. One toast shows at a time: a new change
// replaces it. The toast store is plain module state, so a screen and the host share it.
import type { LogEntry } from '@grimoire/schema';
import type { GrimoireDb } from '../db/db';
import { type ChangeResult, recordChange, type UndoResult, undoChange } from '../db/history';

/** How long a toast stays, in milliseconds, unless the person's focus is in it. */
export const TOAST_MS = 5000;

/** The toast after a change, with "Undo"; or the one saying an undo was refused, without it. */
export type Toast = { kind: 'changed'; entry: LogEntry } | { kind: 'notUndone'; entry: LogEntry };

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

/** Undoes the toast's change (`undoChange`): the toast goes, or says the undo was refused. */
export async function undoToast(
  toast: Toast,
  now?: string,
  database?: GrimoireDb,
): Promise<UndoResult> {
  const result = await undoChange(toast.entry.id, now, database);
  if (current === toast) show(result.ok ? undefined : { kind: 'notUndone', entry: toast.entry });
  return result;
}
