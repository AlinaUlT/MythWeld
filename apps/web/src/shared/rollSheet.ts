// SHEET-39: the roll dialog's parts that hold no screen: the parts a d20 test and its damage roll,
// the d20 face a record kept, and the mode the person's switches give. The rules themselves come
// from the sheet's system (`SheetRolls`); nothing here names a game.
import {
  diceOf,
  type ParsedRoll,
  type ParseResult,
  parseRoll,
  type RollPart,
} from '@grimoire/engine';
import type { RollRecord } from '@grimoire/schema';
import type { Situational } from '../systems';
import { type DiceField, diceFields } from './dice';

/** What the person switched on for one roll. */
export interface Switches {
  /** The person's own advantage or disadvantage; neither is the default. */
  manual?: 'advantage' | 'disadvantage';
  /** Spending inspiration for advantage (2014). */
  inspiration: boolean;
  /** The situational effects switched on, by their part. */
  situational: ReadonlySet<string>;
}

/** The signs that give a roll its mode: the rules' sources, then each switch that is on. */
export function signsOf(
  rule: readonly number[],
  { manual, inspiration, situational }: Switches,
  offered: readonly Situational[],
): number[] {
  const signs = [...rule];
  if (manual === 'advantage') signs.push(1);
  if (manual === 'disadvantage') signs.push(-1);
  if (inspiration) signs.push(1);
  for (const { part, op } of offered) {
    if (!situational.has(part)) continue;
    if (op === 'advantage') signs.push(1);
    if (op === 'disadvantage') signs.push(-1);
  }
  return signs;
}

/** A bonus written as the end of a formula: `+ 5`, `- 1`. */
export function bonusFormula(bonus: number): string {
  return bonus < 0 ? `- ${-bonus}` : `+ ${bonus}`;
}

export interface D20Parts {
  /** The d20 formula of the mode. */
  d20: string;
  /** The bonus added to it. */
  bonus: number;
  label: { d20: string; bonus: string };
  offered: readonly Situational[];
  switches: Switches;
  /** A situational effect's label, in the language shown. */
  nameOf: (situational: Situational) => string;
}

/**
 * The parts of a d20 test: the d20 and its bonus as one formula, so the total counts them together,
 * then each situational `add` the person switched on, with its own label.
 */
export function d20Parts({
  d20,
  bonus,
  label,
  offered,
  switches,
  nameOf,
}: D20Parts): [RollPart, ...RollPart[]] {
  const first: RollPart = {
    label: label.d20,
    formula: bonus === 0 ? d20 : `${d20} ${bonusFormula(bonus)}`,
  };
  const added = offered
    .filter(
      ({ part, op, value }) =>
        op === 'add' && value !== undefined && switches.situational.has(part),
    )
    .map(
      (found): RollPart => ({
        label: nameOf(found),
        formula: String(found.value),
        sourceId: found.source,
      }),
    );
  return [first, ...added];
}

/** The d20 face that counted: the first d20 term's kept die, or `undefined` when it has none. */
export function keptFace(record: RollRecord): number | undefined {
  const term = record.breakdown[0]?.dice[0];
  if (term === undefined) return undefined;
  const at = term.kept.findIndex((kept) => kept);
  return at < 0 ? undefined : term.results[at];
}

/** The text of a formula with `bonus` added: `2d6 + 3`, `1d8`, `1d8 - 1`. */
export function withBonus(dice: string, bonus: number): string {
  return bonus === 0 ? dice : `${dice} ${bonusFormula(bonus)}`;
}

/** The dice a list of parts roll, in order, as the fields of "I roll myself". */
export function fieldsOfParts(parts: readonly RollPart[]): DiceField[] {
  return parts.flatMap(({ formula }, at) => {
    const parsed: ParsedRoll | undefined =
      typeof formula === 'string' ? okOf(parseRoll(formula)) : formula;
    if (parsed === undefined || diceOf(parsed).length === 0) return [];
    return diceFields(parsed).map((field) => ({ ...field, key: `${at}:${field.key}` }));
  });
}

function okOf(parsed: ReturnType<typeof parseRoll>): ParsedRoll | undefined {
  return parsed.ok ? parsed.formula : undefined;
}

/**
 * A weapon's damage roll: its dice and the bonus it adds, with each dice term rolled twice on a
 * critical hit by the system's own rule (`doubled`), the bonus as it is.
 */
export function damageFormula(
  dice: string,
  bonus: number,
  critical: boolean,
  doubled: (formula: string) => ParseResult<ParsedRoll>,
): ParseResult<ParsedRoll> {
  const plain = withBonus(dice, bonus);
  return critical ? doubled(plain) : parseRoll(plain);
}
