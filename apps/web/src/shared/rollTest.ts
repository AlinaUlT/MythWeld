// SHEET-39: the roll dialog's parts that hold no screen: a d20 test or a damage roll as a record
// with two entries (the dice, then what the sheet adds, read from its computed path), and the
// natural face an attack reads its outcome from. The die and the clock are the caller's (ENG-26).
import {
  type DieSource,
  type FormulaReader,
  type ParsedRoll,
  parseRoll,
  type RollPartWarning,
  recordRoll,
} from '@grimoire/engine';
import type { EntityId, RollRecord } from '@grimoire/schema';
import { type DiceField, diceFields, type Roller } from './dice';

/** A roll made, its record, what making it met, and the natural d20 face when it has one. */
export interface MadeRoll {
  record: RollRecord;
  warnings: readonly RollPartWarning[];
  natural: number | undefined;
}

/** The first die kept of the first entry that rolled any: the natural face of a d20 roll. */
export function naturalOf(record: RollRecord): number | undefined {
  const term = record.breakdown[0]?.dice[0];
  if (term === undefined) return undefined;
  const at = term.kept.findIndex(Boolean);
  return at < 0 ? undefined : term.results[at];
}

export interface TestRollInput {
  /** The record's label: what was rolled, shown in the log. */
  label: string;
  /** The number's path: what the roll adds is read there, and the record names it. */
  path: string;
  /** The dice to roll: a roll formula's text, or one already parsed. */
  dice: string | ParsedRoll;
  diceLabel: string;
  /** What the roll adds: the value at this computed path. */
  addLabel: string;
  addPath: string;
  sourceId?: EntityId;
  read: FormulaReader;
  die: DieSource;
  roller: Roller;
  id: string;
  now: Date;
}

/** Rolls the dice, then adds the number at `addPath`, into one record for the log. */
export function rollTestWith(input: TestRollInput): MadeRoll {
  const { record, warnings } = recordRoll(
    {
      id: input.id,
      rolledAt: input.now.toISOString(),
      by: {
        role: 'player',
        name: input.roller.name,
        ...(input.roller.actorId !== undefined && { actorId: input.roller.actorId }),
      },
      label: input.label,
      path: input.path,
      visibility: 'public',
      parts: [
        { label: input.diceLabel, formula: input.dice },
        {
          label: input.addLabel,
          formula: `@${input.addPath}`,
          ...(input.sourceId !== undefined && { sourceId: input.sourceId }),
        },
      ],
      modifiers: [],
    },
    input.read,
    input.die,
  );
  return { record, warnings, natural: naturalOf(record) };
}

/** One field of "I roll myself" per die of `formula`, in the order written; none if it is no roll. */
export function fieldsOfFormula(formula: string | ParsedRoll): DiceField[] {
  const parsed = typeof formula === 'string' ? parseRoll(formula) : { ok: true as const, formula };
  return parsed.ok ? diceFields(parsed.formula) : [];
}

/**
 * The dice of a damage roll: the weapon's own, or, on a critical hit, each dice term doubled
 * (`critical`, ENG-34). A formula that cannot be doubled is rolled as it is, with its warning.
 */
export function damageDiceOf(
  formula: string,
  critical: boolean,
  doubled: (formula: string) => ReturnType<typeof parseRoll>,
): string | ParsedRoll {
  if (!critical) return formula;
  const result = doubled(formula);
  return result.ok ? result.formula : formula;
}
