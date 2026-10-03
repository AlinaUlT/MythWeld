import {
  type ActionResult,
  applyEntry,
  entryOf,
  type FormulaValue,
  type LogStamp,
  type MadeChanges,
  sameJson,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';

// ENG-20: what fifth edition's tracker actions share: the places in `systemData.state` they
// change, and the one way each ends. An action lists a change for every field it may write; the
// ones that keep their value are dropped, an action left with none is refused as `unchanged` (as
// ENG-30's are), and the rest are one entry, applied.

const STATE = ['systemData', 'state'] as const;

/** The current hit points. */
export const HP_CURRENT_PATH = [...STATE, 'hp', 'current'];

/** The temporary hit points. */
export const HP_TEMP_PATH = [...STATE, 'hp', 'temp'];

/** The death save successes. */
export const DEATH_SUCCESS_PATH = [...STATE, 'deathSaves', 'success'];

/** The death save failures. */
export const DEATH_FAILURE_PATH = [...STATE, 'deathSaves', 'failure'];

/** The spell the character concentrates on. */
export const CONCENTRATION_PATH = [...STATE, 'concentration'];

/** The inspiration the character holds. */
export const INSPIRATION_PATH = [...STATE, 'inspiration'];

/** The pact magic slots spent. */
export const PACT_SPENT_PATH = [...STATE, 'pactSlotsSpent'];

/** ENG-21: the hit dice of one size spent: `hitDiceSpent`'s key is the die, `"d6"` to `"d12"`. */
export function hitDiceSpentPath(die: number): string[] {
  return [...STATE, 'hitDiceSpent', `d${die}`];
}

/** The slots of one spell level spent: `slotsSpent`'s key is the level, `"1"` to `"9"`. */
export function slotSpentPath(level: number): string[] {
  return [...STATE, 'slotsSpent', `${level}`];
}

/** An action's refusal that every action shares: it would change nothing. */
export interface Unchanged {
  code: 'unchanged';
  message: string;
}

/**
 * The character with `made`'s changes that change something, and their entry. Refused as
 * `unchanged`, with `unchanged` as its message, when none does.
 */
export function settled<R extends { code: string; message: string }>(
  character: FifthEditionCharacter,
  stamp: LogStamp,
  made: MadeChanges,
  unchanged: string,
): ActionResult<FifthEditionCharacter, R | Unchanged> {
  const changes = made.changes.filter((change) => !sameJson(change.before, change.after));
  if (changes.length === 0) return { ok: false, code: 'unchanged', message: unchanged };
  const entry = entryOf(stamp, { ...made, changes });
  const applied = applyEntry(character, entry);
  return applied.ok ? { ok: true, character: applied.character, entry } : applied;
}

/** A whole number from `min`. */
export function isWhole(value: number, min: number): boolean {
  return Number.isInteger(value) && value >= min;
}

/** A computed count (slots, hit dice) or a level: a whole number, 0 when it is not a number. */
export function whole(value: FormulaValue | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
