import type { EntityId, RollEntry, RollRecord } from '@grimoire/schema';
import type { DieSource } from './dice';
import { type FormulaReader, type FormulaWarning, type ParsedRoll, rollFormula } from './formula';

/** One labelled part of a roll: a roll formula, and the entity it comes from, if one does. */
export interface RollPart {
  readonly label: string;
  readonly formula: string | ParsedRoll;
  readonly sourceId?: EntityId;
}

/** A roll before it is rolled: what its record holds but the numbers, and the parts to roll. */
export interface RollRequest extends Omit<RollRecord, 'total' | 'breakdown'> {
  /** The roll as the rules give it, such as the die and the computed bonus. */
  readonly parts: readonly [RollPart, ...RollPart[]];
  /** The person's own modifiers, added before the roll (ADR 009 item 11). */
  readonly modifiers: readonly RollPart[];
}

/** What rolling one breakdown entry met; `entry` is its index in the breakdown. */
export interface RollPartWarning {
  entry: number;
  warning: FormulaWarning;
}

export interface RecordedRoll {
  record: RollRecord;
  warnings: readonly RollPartWarning[];
}

/**
 * Rolls each part, then each modifier, in order, with `rollFormula`, into a record that
 * `rollRecordSchema` accepts: one breakdown entry each, the modifiers marked `own`, and the sum of
 * their values as the total. Never throws: a part that does not parse or reads a missing path
 * gives its value as `rollFormula` does, with its warnings; a value that would take the total past
 * a finite number gives 0, with a `notFinite` warning, as a formula's does.
 */
export function recordRoll(
  request: RollRequest,
  read: FormulaReader,
  die: DieSource,
): RecordedRoll {
  const warnings: RollPartWarning[] = [];
  const rolled = [
    ...request.parts.map((part) => ({ part, own: false })),
    ...request.modifiers.map((part) => ({ part, own: true })),
  ];
  let total = 0;
  const breakdown = rolled.map(({ part, own }, entry): RollEntry => {
    const result = rollFormula(part.formula, read, die);
    for (const warning of result.warnings) warnings.push({ entry, warning });
    let value = result.value;
    if (!Number.isFinite(total + value)) {
      const message = `The value of entry ${entry} takes the total past a finite number; 0 is used.`;
      warnings.push({ entry, warning: { code: 'notFinite', at: 0, message } });
      value = 0;
    }
    total += value;
    return {
      label: part.label,
      formula: typeof part.formula === 'string' ? part.formula : part.formula.text,
      value,
      dice: result.dice.map(({ keep, results, kept, ...term }) => ({
        ...term,
        ...(keep && { keep: { ...keep } }),
        results: [...results],
        kept: [...kept],
      })),
      ...(part.sourceId !== undefined && { sourceId: part.sourceId }),
      own,
    };
  });
  const { id, rolledAt, by, label, path, visibility } = request;
  const record: RollRecord = {
    id,
    rolledAt,
    by: { role: by.role, name: by.name, ...(by.actorId !== undefined && { actorId: by.actorId }) },
    label,
    ...(path !== undefined && { path }),
    visibility,
    total,
    breakdown,
  };
  return { record, warnings };
}
