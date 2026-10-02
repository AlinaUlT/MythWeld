import type { Effect, EffectOp, EffectPhase, EntityId, EntityPartId, L10n } from '@grimoire/schema';
import {
  evaluateCondition,
  evaluateNumber,
  type FormulaReader,
  type FormulaWarning,
  type ParsedFormula,
  parseFormula,
} from './formula';
import type { GatherableEntity, HadEntity } from './gather';

// SPEC §6.1 step 3: the effects of every entity a character has, each with where it came from.
// A toggle is the person's switch: what the trackers store, else the toggle's default. A
// situational effect is never applied to a number; the roll that it names shows it. An effect's
// number is worked out here for every phase, so the formula rules are written once.

/** The first step of a stat's paths: `abilities.<key>.score`, `abilities.<key>.max`. */
export const STATS_PATH = 'abilities';

/** The paths of a stat the base phase computes (SPEC §5.4 catalogue). */
export const STAT_FIELDS = ['score', 'max'] as const;
export type StatField = (typeof STAT_FIELDS)[number];

/** The ops that change a number, each with its default priority: Foundry's mode order (§5.4). */
export const NUMBER_OPS = { mul: 10, add: 20, min: 30, max: 40, set: 50 } as const;
export type NumberOp = keyof typeof NUMBER_OPS;

/** An effect that applies: the effect, its entity, and its place as a toggle names it. */
export interface ActiveEffect {
  effect: Effect;
  part: EntityPartId;
  source: EntityId;
  /** What the breakdown calls it: the effect's own label, else its entity's name. */
  label: L10n;
}

/** An effect's number, worked out: what it does to its target, and where it came from. */
export interface EffectNumber {
  op: NumberOp;
  value: number;
  priority: number;
  part: EntityPartId;
  source: EntityId;
  label: L10n;
}

/** Something working out an effect's number met. `code` and its data are for the screen. */
export type EffectWarning = { message: string } & (
  | { code: 'notANumber'; part: EntityPartId; op: EffectOp; target: string }
  | { code: 'notAKey'; part: EntityPartId; op: EffectOp; target: string }
  | { code: 'unknownKey'; part: EntityPartId; target: string; key: string; keys: readonly string[] }
  | { code: 'notInBasePhase'; part: EntityPartId; paths: readonly string[] }
  | { code: 'formula'; part: EntityPartId; field: 'value' | 'when'; warning: FormulaWarning }
);

/** How an effect's formulas are read. */
export interface EffectReader {
  /** A path's value; `undefined` for a path nothing gives. */
  read: FormulaReader;
  /** The base-phase rule (SPEC §5.6): whether a formula may name the path. Any, when absent. */
  allows?: (path: string) => boolean;
}

/** The stat and the field an effect's target names, when it names a stat's score or maximum. */
export function statTargetOf(target: string): { key: string; field: StatField } | undefined {
  const [first, key, field, ...rest] = target.split('.');
  if (first !== STATS_PATH || key === undefined || rest.length > 0) return undefined;
  const found = STAT_FIELDS.find((each) => each === field);
  return found === undefined ? undefined : { key, field: found };
}

/** The phase an effect applies in: its own, else `base` for a stat's score or maximum. */
export function phaseOf(effect: Effect): EffectPhase {
  return effect.phase ?? (statTargetOf(effect.target) === undefined ? 'derived' : 'base');
}

/** Every effect of the entities a character has that is switched on, in the entities' order. */
export function activeEffects<E extends GatherableEntity>(
  entities: readonly HadEntity<E>[],
  toggles: Readonly<Partial<Record<string, boolean>>>,
): ActiveEffect[] {
  const active: ActiveEffect[] = [];
  for (const { entity } of entities) {
    for (const effect of entity.effects ?? []) {
      const part: EntityPartId = `${entity.id}#${effect.id}`;
      if (effect.situational !== undefined) continue;
      if (effect.toggle !== undefined && !(toggles[part] ?? effect.toggle.default)) continue;
      active.push({ effect, part, source: entity.id, label: effect.label ?? entity.name });
    }
  }
  return active;
}

/** An effect's op and value when it can change a number: a number, or a formula's text. */
export function numberChangeOf(
  effect: Effect,
): { op: NumberOp; value: number | string } | undefined {
  switch (effect.op) {
    case 'add':
    case 'mul':
    case 'max':
    case 'min':
      return { op: effect.op, value: effect.value };
    case 'set':
      return typeof effect.value === 'number' ? { op: 'set', value: effect.value } : undefined;
    default:
      return undefined;
  }
}

/** `n` after one op. `-0` is `0`. */
export function applied(op: NumberOp, n: number, value: number): number {
  const next = {
    add: () => n + value,
    mul: () => n * value,
    min: () => Math.min(n, value),
    max: () => Math.max(n, value),
    set: () => value,
  }[op]();
  return next === 0 ? 0 : next;
}

/** A warning of one of an effect's formulas; `skipped` when the effect is not applied for it. */
function formulaWarner(part: EntityPartId, warn: (warning: EffectWarning) => void) {
  return (field: 'value' | 'when', warning: FormulaWarning, skipped = false) =>
    warn({
      code: 'formula',
      part,
      field,
      warning,
      message: `${warning.message} (the ${field} of "${part}")${skipped ? '; it is not applied' : ''}.`,
    });
}

/**
 * Parses an effect's `when` and its `value` formula, when it has one, checks the base-phase rule
 * against every path they name, then evaluates `when`. Gives the parsed `value` formula when the
 * effect applies; `undefined` when a formula does not parse, the rule refuses a path (each
 * warned), or its `when` is false. A number and a key apply by the same checks.
 */
function applies(
  { effect, part }: ActiveEffect,
  value: string | undefined,
  reader: EffectReader,
  warn: (warning: EffectWarning) => void,
): { value?: ParsedFormula } | undefined {
  const formulaWarning = formulaWarner(part, warn);
  const texts: ['value' | 'when', string][] = [];
  if (effect.when !== undefined) texts.push(['when', effect.when]);
  if (value !== undefined) texts.push(['value', value]);
  const parsed = new Map<'value' | 'when', ParsedFormula>();
  for (const [field, text] of texts) {
    const result = parseFormula(text);
    if (result.ok) parsed.set(field, result.formula);
    else formulaWarning(field, result.error, true);
  }
  if (parsed.size < texts.length) return undefined;
  const allows = reader.allows;
  if (allows !== undefined) {
    const named = new Set([...parsed.values()].flatMap((formula) => formula.paths));
    const refused = [...named].filter((path) => !allows(path));
    if (refused.length > 0) {
      warn({
        code: 'notInBasePhase',
        part,
        paths: refused,
        message: `"${part}" applies in the base phase, whose formulas read only levels and what the system allows; it names ${refused.map((path) => `@${path}`).join(', ')}, so it is not applied.`,
      });
      return undefined;
    }
  }
  const when = parsed.get('when');
  if (when !== undefined) {
    const result = evaluateCondition(when, reader.read);
    for (const warning of result.warnings) formulaWarning('when', warning);
    if (!result.value) return undefined;
  }
  const formula = parsed.get('value');
  return formula === undefined ? {} : { value: formula };
}

/**
 * Works out the number an active effect applies, reading its formulas through `reader`.
 * `undefined` when it does not apply: it gives no number, a formula does not parse, the base-phase
 * rule refuses a path its text names (each warned), or its `when` is false.
 */
export function effectNumber(
  active: ActiveEffect,
  reader: EffectReader,
  warn: (warning: EffectWarning) => void,
): EffectNumber | undefined {
  const { effect, part, source, label } = active;
  const change = numberChangeOf(effect);
  if (change === undefined) {
    warn({
      code: 'notANumber',
      part,
      op: effect.op,
      target: effect.target,
      message: `"${part}" (${effect.op}) gives no number, so it does not change ${effect.target}.`,
    });
    return undefined;
  }
  const text = typeof change.value === 'string' ? change.value : undefined;
  const parsed = applies(active, text, reader, warn);
  if (parsed === undefined) return undefined;
  let value: number;
  if (parsed.value === undefined) {
    value = change.value as number;
  } else {
    const result = evaluateNumber(parsed.value, reader.read);
    for (const warning of result.warnings) formulaWarner(part, warn)('value', warning);
    value = result.value;
  }
  const priority = effect.priority ?? NUMBER_OPS[change.op];
  return { op: change.op, value, priority, part, source, label };
}

/** The key a `set` with a text gives a key path, and where it came from. */
export interface EffectKey {
  key: string;
  priority: number;
  part: EntityPartId;
  source: EntityId;
  label: L10n;
}

/**
 * Works out the key an active effect sets on a key path whose keys are `keys`, reading its `when`
 * through `reader`. `undefined` when it does not apply: its op is not a `set` with a text, its
 * text is none of `keys` (each warned), or `applies` says no.
 */
export function effectKey(
  active: ActiveEffect,
  keys: readonly string[],
  reader: EffectReader,
  warn: (warning: EffectWarning) => void,
): EffectKey | undefined {
  const { effect, part, source, label } = active;
  const { target } = effect;
  if (effect.op !== 'set' || typeof effect.value !== 'string') {
    warn({
      code: 'notAKey',
      part,
      op: effect.op,
      target,
      message: `"${part}" (${effect.op} ${JSON.stringify(effect.value)}) sets no key, so it does not change ${target}.`,
    });
    return undefined;
  }
  const key = effect.value;
  if (!keys.includes(key)) {
    warn({
      code: 'unknownKey',
      part,
      target,
      key,
      keys,
      message: `"${part}" sets ${target} to "${key}", which is none of its keys (${keys.join(', ')}); it is not applied.`,
    });
    return undefined;
  }
  if (applies(active, undefined, reader, warn) === undefined) return undefined;
  const priority = effect.priority ?? NUMBER_OPS.set;
  return { key, priority, part, source, label };
}
