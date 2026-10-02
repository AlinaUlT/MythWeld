import type { EntityId, EntityPartId, L10n } from '@grimoire/schema';
import {
  activeEffects,
  applied,
  type EffectNumber,
  type EffectWarning,
  effectNumber,
  type NumberOp,
  phaseOf,
  STATS_PATH,
  type StatField,
  statTargetOf,
} from './effects';
import type { FormulaValue } from './formula';
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
  /** An effect's value: what its op did, or the candidate an `append` gave that was chosen (ENG-14). */
  | { kind: 'effect'; part: EntityPartId; source: EntityId; label: L10n; op: NumberOp | 'append' }
  | { kind: 'cap' }
  /** The character's level, as its module counts it. */
  | { kind: 'level' }
  /** A formula's result: the stat's own, a skill's own, or its system's default. */
  | { kind: 'formula'; formula: string; of: 'stat' | 'skill' | 'system' }
  /** A number an entity gives by one of its own fields, not by a grant or an effect (ENG-13). */
  | { kind: 'entity'; source: EntityId; label: L10n }
  /** Another computed path: `value` is that path's, `change` what it adds here. */
  | { kind: 'path'; path: string }
  /** A number a rule of the system gives; `rule` is the module's name for it. */
  | { kind: 'rule'; rule: string }
  /** A condition's level, as the trackers store it (ENG-17). */
  | { kind: 'condition'; source: EntityId; label: L10n }
  /** A number changed by hand (SPEC §6.1 step 7): it replaces the value; `note` is the person's. */
  | { kind: 'override'; note?: string }
);

/**
 * One step of how a key path got its key: the key an entity gives by one of its own
 * fields (a skill's stat), an effect's `set`, or an override. The last step's `key` is the path's.
 */
export type KeyStep = { key: string } & (
  | { kind: 'entity'; source: EntityId; label: L10n }
  /** An effect's `set`. */
  | { kind: 'effect'; part: EntityPartId; source: EntityId; label: L10n }
  /** A key chosen by hand (SPEC §6.1 step 7); `note` is the person's. */
  | { kind: 'override'; note?: string }
);

/** Something the base phase met. `code` and its data are for the screen; `message` is for logs. */
export type StatWarning =
  | EffectWarning
  | ({ message: string } & (
      | { code: 'noBaseScore'; key: string }
      | { code: 'noStat'; key: string; from: Origin }
    ));

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
interface StatEffect extends EffectNumber {
  key: string;
  field: StatField;
}

/**
 * Applies effects in the order given to a number whose steps so far add up to `total`; each one
 * is a step. Gives the number after them.
 */
export function applyEffects(
  steps: BreakdownStep[],
  total: number,
  effects: readonly EffectNumber[],
): number {
  let n = total;
  for (const { op, value, part, source, label } of effects) {
    const next = applied(op, n, value);
    steps.push({ kind: 'effect', part, source, label, op, value, change: next - n });
    n = next;
  }
  return n;
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
  const reader = { read: base.read, allows: (path: string) => base.read(path) !== undefined };
  for (const active of activeEffects(gathered.entities, character.state.toggles)) {
    const target = statTargetOf(active.effect.target);
    if (target === undefined || phaseOf(active.effect) !== 'base') continue;
    if (!isStat.has(target.key)) {
      noStat(target.key, active.part);
      continue;
    }
    const number = effectNumber(active, reader, (warning) => warnings.push(warning));
    if (number !== undefined) effects.push({ ...target, ...number });
  }

  /** Applies the effects on one path, in order of priority, after the steps it starts with. */
  function withEffects(steps: BreakdownStep[], key: string, field: StatField): number {
    const total = steps.reduce((sum, step) => sum + step.change, 0);
    const own = effects
      .filter((each) => each.key === key && each.field === field)
      .sort((a, b) => a.priority - b.priority);
    return applyEffects(steps, total, own);
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
