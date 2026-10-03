import {
  type ActionResult,
  applyEntry,
  changeTo,
  entryOf,
  type FormulaValue,
  type LogStamp,
  type MadeChanges,
  sameJson,
} from '@grimoire/engine';
import type { LogChange } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';

// ENG-20: what fifth edition's tracker actions share: the places in `systemData.state` they
// change, and the one way each ends. An action lists a change for every field it may write; the
// ones that keep their value are dropped, an action left with none is refused as `unchanged` (as
// ENG-30's are), and the rest are one entry, applied.
// ENG-58: every action that ends a run of death saves (hit points regained, stable, revived)
// writes it through `deathSavesReset`, so `stable` is never left behind.
// ENG-63: every action that kills (the third failure, from damage or a death save) adds
// `deathChanges`, so no row of the inventory stays attuned (both SRDs; ENG-58 §11).

const STATE = ['systemData', 'state'] as const;

/** The current hit points. */
export const HP_CURRENT_PATH = [...STATE, 'hp', 'current'];

/** The temporary hit points. */
export const HP_TEMP_PATH = [...STATE, 'hp', 'temp'];

/** The death save successes. */
export const DEATH_SUCCESS_PATH = [...STATE, 'deathSaves', 'success'];

/** The death save failures. */
export const DEATH_FAILURE_PATH = [...STATE, 'deathSaves', 'failure'];

/** ENG-58: whether the character, at 0 hit points, is stable. */
export const DEATH_STABLE_PATH = [...STATE, 'deathSaves', 'stable'];

/** The spell the character concentrates on. */
export const CONCENTRATION_PATH = [...STATE, 'concentration'];

/** The pact magic slots spent. */
export const PACT_SPENT_PATH = [...STATE, 'pactSlotsSpent'];

/** The inspiration the character holds. */
export const INSPIRATION_PATH = [...STATE, 'inspiration'];

/**
 * ENG-63: the inventory's rows. A change writes the whole list: a log path steps only through
 * objects, never into a list.
 */
export const INVENTORY_PATH = ['systemData', 'inventory'];

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

/**
 * The changes that end a run of death saves: both counts back to 0 (both SRDs: "reset to zero when
 * you regain any hit points or become stable"), and `stable` as given.
 */
export function deathSavesReset(character: FifthEditionCharacter, stable = false): LogChange[] {
  return [
    changeTo(character, DEATH_SUCCESS_PATH, 0),
    changeTo(character, DEATH_FAILURE_PATH, 0),
    changeTo(character, DEATH_STABLE_PATH, stable),
  ];
}

/**
 * The changes death makes beside the third failure: every row of the inventory no longer attuned
 * (SRD 5.1 "if the creature dies"; SRD 5.2.1, Dead, "it is no longer attuned to them"), each
 * other field and the order kept. With no attuned row it changes nothing.
 */
export function deathChanges(character: FifthEditionCharacter): LogChange[] {
  const rows = character.systemData.inventory.map((row) => ({ ...row, attuned: false }));
  return [changeTo(character, INVENTORY_PATH, rows)];
}

/** A whole number from `min`. */
export function isWhole(value: number, min: number): boolean {
  return Number.isInteger(value) && value >= min;
}

/** A computed count (slots, hit dice) or a level: a whole number, 0 when it is not a number. */
export function whole(value: FormulaValue | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
