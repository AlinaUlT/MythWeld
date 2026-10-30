// SHEET-38: the dice panel's parts that hold no screen: the formula its picker builds, the fair die
// every roll uses, the die of "I roll myself" (SPEC §6.5), and the roll's record for the log.
import {
  type DieSource,
  diceOf,
  type FormulaReader,
  fairDie,
  type ParsedRoll,
  type RollPart,
  type RollPartWarning,
  randomSourceOf,
  recordRoll,
} from '@grimoire/engine';
import type { RollRecord } from '@grimoire/schema';

/** The dice the panel always offers, by their faces. */
export const STANDARD_DICE = [4, 6, 8, 10, 12, 20, 100] as const;

/** The formula the picker builds: `37d6 + 3`, `1d20 - 1`, `2d8`. */
export function builtFormula(count: number, faces: number, modifier: number): string {
  const dice = `${count}d${faces}`;
  if (modifier === 0) return dice;
  return `${dice} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`;
}

/** A fair die over the platform's secure numbers (ENG-08). */
export function panelDie(): DieSource {
  // The engine's batch is a plain `Uint32Array`, never over a shared buffer.
  return fairDie(
    randomSourceOf((into) => crypto.getRandomValues(into as Uint32Array<ArrayBuffer>)),
  );
}

/**
 * The die of "I roll myself": the faces the person typed, handed out in order. The engine's die
 * names only the faces, not the term, so a term in a `?:` branch the roll does not take still
 * holds its place in the list. Past the list it gives 0, which the roll warns about.
 */
export function typedDie(faces: readonly number[]): DieSource {
  let next = 0;
  return () => faces[next++] ?? 0;
}

/** One field of "I roll myself": a die of the formula, its term, and its place in that term. */
export interface DiceField {
  /** The die's own key: its term's place in the text and its place in the term. */
  key: string;
  term: string;
  faces: number;
  /** From 1, the die's place in its term. */
  n: number;
}

/** One field per die of the formula, in the order written. */
export function diceFields(roll: ParsedRoll): DiceField[] {
  return diceOf(roll).flatMap(({ at, text, count, faces }) =>
    Array.from({ length: count }, (_, index) => ({
      key: `${at}:${index + 1}`,
      term: text,
      faces,
      n: index + 1,
    })),
  );
}

/** Who rolls: a sheet's character, or no one on the dice page. */
export interface Roller {
  actorId?: string;
  name: string;
}

export interface PanelRoll {
  formula: ParsedRoll;
  read: FormulaReader;
  die: DieSource;
  roller: Roller;
  id: string;
  now: Date;
}

/** A roll of several labelled parts: a sheet's d20 test, its bonus and what the person switched on. */
export interface PartsRoll extends Omit<PanelRoll, 'formula'> {
  parts: readonly [RollPart, ...RollPart[]];
  label: string;
  /** The computed path of the number rolled, kept in the record (SHEET-37). */
  path?: string;
}

/** The roll of `parts` as its record, one breakdown entry each, and what rolling it met. */
export function rollParts({ parts, label, path, read, die, roller, id, now }: PartsRoll): {
  record: RollRecord;
  warnings: readonly RollPartWarning[];
} {
  return recordRoll(
    {
      id,
      rolledAt: now.toISOString(),
      by: {
        role: 'player',
        name: roller.name,
        ...(roller.actorId !== undefined && { actorId: roller.actorId }),
      },
      label,
      ...(path !== undefined && { path }),
      visibility: 'public',
      parts,
      modifiers: [],
    },
    read,
    die,
  );
}

/** The roll as its record, one breakdown entry for the formula, and what rolling it met. */
export function rollWith({ formula, ...rest }: PanelRoll) {
  return rollParts({ ...rest, parts: [{ label: formula.text, formula }], label: formula.text });
}

/** The dice page reads no character: every path is missing. */
export const readNothing: FormulaReader = () => undefined;
