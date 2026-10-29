// SHEET-38: the person's own dice (ADR 010 item 4), one row of `settings` keyed `customDice`, beside
// the display choices (`readSettings` leaves a key it does not know as it is). A value that is not
// a die is dropped and named as it is read, not thrown (SPEC §8.2).
import { DICE_LIMITS } from '@grimoire/engine';
import { STANDARD_DICE } from '../shared/dice';
import { db } from './db';

export const CUSTOM_DICE_KEY = 'customDice';

export interface StoredDice {
  /** Each die's faces, smallest first. */
  faces: number[];
  /** What was dropped as the row was read. */
  refused: string[];
}

/** Whether `faces` can be a custom die: a whole number in `DICE_LIMITS.faces`, not a standard die. */
export function isCustomDie(faces: number): boolean {
  const { min, max } = DICE_LIMITS.faces;
  return (
    Number.isInteger(faces) &&
    faces >= min &&
    faces <= max &&
    !(STANDARD_DICE as readonly number[]).includes(faces)
  );
}

export async function readCustomDice(table = db.settings): Promise<StoredDice> {
  const row = await table.get(CUSTOM_DICE_KEY);
  const read: StoredDice = { faces: [], refused: [] };
  if (row === undefined) return read;
  if (!Array.isArray(row.value)) {
    read.refused.push(`Setting ${CUSTOM_DICE_KEY} holds ${JSON.stringify(row.value)}, not a list`);
    return read;
  }
  for (const value of row.value as unknown[]) {
    if (typeof value === 'number' && isCustomDie(value) && !read.faces.includes(value)) {
      read.faces.push(value);
    } else {
      read.refused.push(`Setting ${CUSTOM_DICE_KEY} holds ${JSON.stringify(value)}, not a new die`);
    }
  }
  read.faces.sort((a, b) => a - b);
  return read;
}

export async function saveCustomDice(faces: readonly number[], table = db.settings): Promise<void> {
  const kept = [...new Set(faces.filter(isCustomDie))].sort((a, b) => a - b);
  await table.put({ key: CUSTOM_DICE_KEY, value: kept });
}
