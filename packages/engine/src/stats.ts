import type { Effect, EffectOp, EntityId, EntityPartId, L10n } from '@grimoire/schema';
import { activeEffects, phaseOf, STATS_PATH, type StatField, statTargetOf } from './effects';
import {
  evaluateCondition,
  evaluateNumber,
  type FormulaValue,
  type FormulaWarning,
  type ParsedFormula,
  parseFormula,
} from './formula';
import {
  type CharacterCore,
  type GatherableEntity,
  type Gathered,
  isCoreKind,
  type Origin,
  patternOf,
} from './gather';

// ENG-12: SPEC §6.1 step 4, the base phase. A stat's score is its stored base, plus what the
// `abilityScore` grants give, then the base-phase effects on it in order of priority, then at most
// its maximum. Its maximum is its own `defaultMax`, else its system's, then the effects on it. A
// base-phase formula reads only `level` and the paths its module allows (SPEC §5.6), checked
// against every path its text names: a branch not taken today is taken tomorrow.

/** The core's stat type (ENG-03): the entries whose keys are a character's stats. */
export const STAT_TYPE = 'ability';

/** The ops that change a number, each with its default priority: Foundry's mode order (§5.4). */
const NUMBER_OPS = { mul: 10, add: 20, min: 30, max: 40, set: 50 } as const;
export type NumberOp = keyof typeof NUMBER_OPS;

/** One step of how a number was made (SPEC §6.2). The `change`s of a path's steps sum to its value. */
export type BreakdownStep = {
  /** What the step brought: the base score, an increase, an effect's value, a maximum. */
  value: number;
  /** How much the number moved with it. */
  change: number;
} & (
  | { kind: 'base' }
  | { kind: 'default'; of: 'stat' | 'system' }
  /** A grant's number; `formula` when the grant gives it as one (a resource's maximum). */
  | { kind: 'grant'; part: EntityPartId; source: EntityId; label: L10n; formula?: string }
  | { kind: 'effect'; part: EntityPartId; source: EntityId; label: L10n; op: NumberOp }
  | { kind: 'cap' }
  /** The character's level, as its module counts it. */
  | { kind: 'level' }
  /** A formula's result: the stat's own, or its system's default. */
  | { kind: 'formula'; formula: string; of: 'stat' | 'system' }
  /** Another computed path: `value` is that path's, `change` what it adds here. */
  | { kind: 'path'; path: string }
  /** A number a rule of the system gives; `rule` is the module's name for it. */
  | { kind: 'rule'; rule: string }
);

/** Something the base phase met. `code` and its data are for the screen; `message` is for logs. */
export type StatWarning = { message: string } & (
  | { code: 'noBaseScore'; key: string }
  | { code: 'noStat'; key: string; from: Origin }
  | { code: 'notANumber'; part: EntityPartId; op: EffectOp; target: string }
  | { code: 'notInBasePhase'; part: EntityPartId; paths: readonly string[] }
  | { code: 'formula'; part: EntityPartId; field: 'value' | 'when'; warning: FormulaWarning }
);

/** What the base phase reads besides the character. */
export interface BasePhase {
  /** A path's value, or `undefined` when a base-phase formula may not read it. */
  read(path: string): FormulaValue | undefined;
  /** The maximum of a stat without its own `defaultMax`: its system's. */
  defaultMax: number;
}

/** Each stat's score and maximum, as computed paths, with their breakdown. */
export interface Stats {
  values: Record<string, number>;
  breakdown: Record<string, BreakdownStep[]>;
  warnings: StatWarning[];
}

/** An effect on a stat that applies, with its value worked out. */
interface StatEffect {
  key: string;
  field: StatField;
  op: NumberOp;
  value: number;
  priority: number;
  part: EntityPartId;
  source: EntityId;
  label: L10n;
}

/** An effect's op and value when it can change a number: a number, or a formula's text. */
function numberEffect(effect: Effect): { op: NumberOp; value: number | string } | undefined {
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
function applied(op: NumberOp, n: number, value: number): number {
  const next = {
    add: () => n + value,
    mul: () => n * value,
    min: () => Math.min(n, value),
    max: () => Math.max(n, value),
    set: () => value,
  }[op]();
  return next === 0 ? 0 : next;
}

/** A stat's own `defaultMax`, read structurally: any system's stat type has the core's field. */
function ownMaxOf(stat: GatherableEntity): number | undefined {
  const max = (stat as { readonly defaultMax?: unknown }).defaultMax;
  return typeof max === 'number' ? max : undefined;
}

/**
 * Computes the score and the maximum of each stat a character has (`abilities.<key>.score`,
 * `abilities.<key>.max`). Its stats are the `ability` entries its keys name (`byKey`). Pure.
 */
export function computeStats<E extends GatherableEntity>(
  character: CharacterCore<E>,
  gathered: Gathered<E>,
  base: BasePhase,
): Stats {
  const warnings: StatWarning[] = [];
  const stats = Object.entries(gathered.byKey[STAT_TYPE] ?? {});
  const isStat = new Set(stats.map(([key]) => key));
  const names = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity.name]));
  const noStat = (key: string, from: Origin) =>
    warnings.push({
      code: 'noStat',
      key,
      from,
      message: `"${key}" is not a stat the character has (named by ${from}); it is not used.`,
    });

  // The stored base scores.
  const baseScores = character.abilities.base;
  for (const [key] of stats) {
    if (baseScores[key] === undefined) {
      warnings.push({
        code: 'noBaseScore',
        key,
        message: `The stat "${key}" has no base score stored; 0 is used.`,
      });
    }
  }
  for (const key of Object.keys(baseScores)) if (!isStat.has(key)) noStat(key, 'character');

  // What the `abilityScore` grants give: fixed values, or a made distribution's pattern.
  const increases = new Map<string, BreakdownStep[]>();
  for (const { part, source, grant, chosen } of gathered.grants) {
    if (!isCoreKind(grant, 'abilityScore')) continue;
    let given: [string, number][] = [];
    if (grant.mode === 'fixed') {
      given = Object.entries(grant.values);
    } else {
      const pattern = patternOf(grant, chosen) ?? [];
      given = pattern.flatMap((value, at) => {
        const key = chosen[at];
        return key === undefined ? [] : [[key, value]];
      });
    }
    for (const [key, value] of given) {
      if (!isStat.has(key)) {
        noStat(key, part);
        continue;
      }
      const label = names.get(source) ?? {};
      const steps = increases.get(key) ?? [];
      increases.set(key, steps);
      steps.push({ kind: 'grant', part, source, label, value, change: value });
    }
  }

  // The base-phase effects on a stat's score or maximum, their formulas checked and evaluated.
  const effects: StatEffect[] = [];
  for (const { effect, part, source, label } of activeEffects(
    gathered.entities,
    character.state.toggles,
  )) {
    const target = statTargetOf(effect.target);
    if (target === undefined || phaseOf(effect) !== 'base') continue;
    if (!isStat.has(target.key)) {
      noStat(target.key, part);
      continue;
    }
    const change = numberEffect(effect);
    if (change === undefined) {
      warnings.push({
        code: 'notANumber',
        part,
        op: effect.op,
        target: effect.target,
        message: `"${part}" (${effect.op}) gives no number, so it does not change ${effect.target}.`,
      });
      continue;
    }
    const formulaWarning = (field: 'value' | 'when', warning: FormulaWarning, skipped = false) =>
      warnings.push({
        code: 'formula',
        part,
        field,
        warning,
        message: `${warning.message} (the ${field} of "${part}")${skipped ? '; it is not applied' : ''}.`,
      });
    const texts: ['value' | 'when', string][] = [];
    if (effect.when !== undefined) texts.push(['when', effect.when]);
    if (typeof change.value === 'string') texts.push(['value', change.value]);
    const parsed = new Map<'value' | 'when', ParsedFormula>();
    for (const [field, text] of texts) {
      const result = parseFormula(text);
      if (result.ok) parsed.set(field, result.formula);
      else formulaWarning(field, result.error, true);
    }
    if (parsed.size < texts.length) continue;
    const named = new Set([...parsed.values()].flatMap((formula) => formula.paths));
    const notBase = [...named].filter((path) => base.read(path) === undefined);
    if (notBase.length > 0) {
      warnings.push({
        code: 'notInBasePhase',
        part,
        paths: notBase,
        message: `"${part}" applies in the base phase, whose formulas read only levels and what the system allows; it names ${notBase.map((path) => `@${path}`).join(', ')}, so it is not applied.`,
      });
      continue;
    }
    const read = (path: string) => base.read(path);
    const when = parsed.get('when');
    if (when !== undefined) {
      const result = evaluateCondition(when, read);
      for (const warning of result.warnings) formulaWarning('when', warning);
      if (!result.value) continue;
    }
    let value: number;
    const formula = parsed.get('value');
    if (formula === undefined) {
      value = change.value as number;
    } else {
      const result = evaluateNumber(formula, read);
      for (const warning of result.warnings) formulaWarning('value', warning);
      value = result.value;
    }
    const priority = effect.priority ?? NUMBER_OPS[change.op];
    effects.push({ ...target, op: change.op, value, priority, part, source, label });
  }

  /** Applies the effects on one path, in order of priority, after the steps it starts with. */
  function withEffects(steps: BreakdownStep[], key: string, field: StatField): number {
    let total = steps.reduce((sum, step) => sum + step.change, 0);
    const own = effects
      .filter((each) => each.key === key && each.field === field)
      .sort((a, b) => a.priority - b.priority);
    for (const { op, value, part, source, label } of own) {
      const next = applied(op, total, value);
      steps.push({ kind: 'effect', part, source, label, op, value, change: next - total });
      total = next;
    }
    return total;
  }

  const values: Record<string, number> = {};
  const breakdown: Record<string, BreakdownStep[]> = {};
  for (const [key, stat] of stats) {
    const ownMax = ownMaxOf(stat);
    const defaultMax = ownMax ?? base.defaultMax;
    const maxSteps: BreakdownStep[] = [
      {
        kind: 'default',
        of: ownMax === undefined ? 'system' : 'stat',
        value: defaultMax,
        change: defaultMax,
      },
    ];
    const max = withEffects(maxSteps, key, 'max');

    const baseScore = baseScores[key] ?? 0;
    const scoreSteps: BreakdownStep[] = [
      { kind: 'base', value: baseScore, change: baseScore },
      ...(increases.get(key) ?? []),
    ];
    let score = withEffects(scoreSteps, key, 'score');
    if (score > max) {
      scoreSteps.push({ kind: 'cap', value: max, change: max - score });
      score = max;
    }

    const path = `${STATS_PATH}.${key}`;
    values[`${path}.score`] = score;
    values[`${path}.max`] = max;
    breakdown[`${path}.score`] = scoreSteps;
    breakdown[`${path}.max`] = maxSteps;
  }
  return { values, breakdown, warnings };
}
