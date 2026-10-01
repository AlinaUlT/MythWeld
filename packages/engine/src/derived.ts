import type { EntityId, EntityPartId } from '@grimoire/schema';
import { STAT_FIELDS } from './effects';
import { evaluateNumber, type FormulaWarning } from './formula';
import { type GatherableEntity, type Gathered, isCoreKind } from './gather';
import { type BreakdownStep, STAT_TYPE, type Stats } from './stats';

// ENG-28: SPEC §6.1 step 5, the derived values. The core gives the character's level and each
// stat's modifier; the module gives the rest as steps, one per path. A path is computed when it is
// first read, so a step may read any other path, in any order, and each is computed once. A path
// read while it is being computed reads 0 with a warning, so a loop never exhausts the stack.

/** The path of the character's level (SPEC §5.6 `@level`). */
export const LEVEL_PATH = 'level';

/** The path a modifier formula reads as the stat's own score (SPEC §5.6 `@score`). */
const SCORE_PATH = 'score';

/** The first step of a condition's level, `conditions.<key>.level` (SPEC §5.6). */
const CONDITIONS_PATH = 'conditions';

/** What a stat takes from its system when it lacks the field (SPEC §5.3). */
export interface StatDefaults {
  /** The highest a score can be: what a stat without its own `defaultMax` takes. */
  readonly defaultMax: number;
  /** The modifier of a stat without its own `modFormula`; `@score` reads the stat's score. */
  readonly modFormula: string;
  /** Whether a stat without its own `hasSave` has a save. */
  readonly hasSave: boolean;
}

/** A stat the character has, its defaults filled in: what a module's steps read of it. */
export interface StatOf<E extends GatherableEntity> {
  readonly key: string;
  readonly entity: E;
  readonly hasSave: boolean;
}

/** A number a step gives, and the steps that made it (SPEC §6.2). */
export interface Derived {
  readonly value: number;
  readonly steps: readonly BreakdownStep[];
}

/** A computed path's value, computed first when it is not yet. A path nothing gives reads 0. */
export type ValueReader = (path: string) => number;

/** How one path is computed: from other paths, read through `read`. */
export type DerivedStep = (read: ValueReader) => Derived;

/** What comes after a path's own step: ENG-17's effects and override. `read` gives other paths. */
export type Finish = (path: string, own: Derived, read: ValueReader) => Derived;

/** What a module's steps are made from. */
export interface DeriveInput<C, E extends GatherableEntity> {
  readonly character: C;
  /** What the character has (ENG-11). */
  readonly gathered: Gathered<E>;
  /** Each stat the character has, in `byKey`'s order. */
  readonly stats: readonly StatOf<E>[];
}

/** Something the derived step met. `code` and its data are for the screen; `message` is for logs. */
export type DerivedWarning = { message: string } & (
  | { code: 'modFormula'; key: string; of: 'stat' | 'system'; warning: FormulaWarning }
  | { code: 'resourceFormula'; key: string; part: EntityPartId; warning: FormulaWarning }
  | { code: 'missingPath'; path: string; for: string }
  | { code: 'cycle'; path: string; for: string }
  | { code: 'pathTaken'; path: string }
);

/** Each path's value and breakdown, in the order of `computeDerived`. */
export interface DerivedValues {
  values: Record<string, number>;
  breakdown: Record<string, readonly BreakdownStep[]>;
  warnings: DerivedWarning[];
}

/** A stat's own field, read structurally: any system's stat type has the core's fields. */
function ownField(stat: GatherableEntity, field: 'modFormula' | 'hasSave'): unknown {
  return (stat as { readonly modFormula?: unknown; readonly hasSave?: unknown })[field];
}

/** The stats a character has (`byKey`'s `ability` entries), each with its system's defaults. */
export function statsOf<E extends GatherableEntity>(
  gathered: Gathered<E>,
  defaults: StatDefaults,
): StatOf<E>[] {
  return Object.entries(gathered.byKey[STAT_TYPE] ?? {}).map(([key, entity]) => {
    const own = ownField(entity, 'hasSave');
    return { key, entity, hasSave: typeof own === 'boolean' ? own : defaults.hasSave };
  });
}

/**
 * Computes the derived values: `level`, each stat's score and maximum (the base phase's, `base`),
 * its `abilities.<key>.mod`, each resource's `resources.<key>.max`, each condition's
 * `conditions.<key>.level`, then each path the module's `steps` give. `finish` runs on each path
 * but `level` after its own step (ENG-17); without it, a path is its step's. Pure.
 */
export function computeDerived<E extends GatherableEntity>(input: {
  level: number;
  gathered: Gathered<E>;
  stats: readonly StatOf<E>[];
  defaults: StatDefaults;
  base: Stats;
  steps: Readonly<Record<string, DerivedStep>>;
  finish?: Finish;
}): DerivedValues {
  const { level, gathered, stats, defaults, base } = input;
  const finish: Finish = input.finish ?? ((_, own) => own);
  const warnings: DerivedWarning[] = [];
  const values = new Map<string, number>([[LEVEL_PATH, level]]);
  const breakdown = new Map<string, readonly BreakdownStep[]>([
    [LEVEL_PATH, [{ kind: 'level', value: level, change: level }]],
  ]);

  // The core's steps: each stat's score and maximum as the base phase left them, so later
  // phases reach them; its modifier, from its own formula or its system's.
  const steps = new Map<string, DerivedStep>();
  const order = [LEVEL_PATH];
  for (const { key, entity } of stats) {
    const path = `abilities.${key}`;
    for (const field of STAT_FIELDS) {
      const at = `${path}.${field}`;
      const value = base.values[at] ?? 0;
      const parts = base.breakdown[at] ?? [];
      steps.set(at, () => ({ value, steps: parts }));
    }
    const own = ownField(entity, 'modFormula');
    const formula = typeof own === 'string' ? own : defaults.modFormula;
    const of = typeof own === 'string' ? 'stat' : 'system';
    steps.set(`${path}.mod`, (read) => {
      const result = evaluateNumber(formula, (each) =>
        read(each === SCORE_PATH ? `${path}.score` : each),
      );
      for (const warning of result.warnings) {
        warnings.push({
          code: 'modFormula',
          key,
          of,
          warning,
          message: `${warning.message} (the modifier formula of "${key}").`,
        });
      }
      const value = result.value;
      return { value, steps: [{ kind: 'formula', formula, of, value, change: value }] };
    });
    order.push(`${path}.score`, `${path}.max`, `${path}.mod`);
  }

  // ENG-29: each resource's maximum, from every `resource` grant of its key. A key is one
  // resource, so two grants give the highest of their maximums, whatever their order; each grant
  // is a step, its change what it adds above the highest before it.
  const names = new Map(gathered.entities.map(({ entity }) => [entity.id, entity.name]));
  const byKey = new Map<string, { part: EntityPartId; source: EntityId; formula: string }[]>();
  for (const { part, source, grant } of gathered.grants) {
    if (!isCoreKind(grant, 'resource')) continue;
    const given = byKey.get(grant.key) ?? [];
    byKey.set(grant.key, given);
    given.push({ part, source, formula: grant.uses.max });
  }
  for (const [key, given] of byKey) {
    const path = `resources.${key}.max`;
    steps.set(path, (read) => {
      let max: number | undefined;
      const parts = given.map(({ part, source, formula }): BreakdownStep => {
        const result = evaluateNumber(formula, read);
        for (const warning of result.warnings) {
          warnings.push({
            code: 'resourceFormula',
            key,
            part,
            warning,
            message: `${warning.message} (the maximum of the resource "${key}", given by ${part}).`,
          });
        }
        const value = result.value;
        const change = max === undefined ? value : Math.max(value - max, 0);
        max = max === undefined ? value : Math.max(max, value);
        const label = names.get(source) ?? {};
        return { kind: 'grant', part, source, label, formula, value, change };
      });
      return { value: max ?? 0, steps: parts };
    });
    order.push(path);
  }

  // Each condition's level, as gathering found it (ENG-11): 0, with no step, when not had.
  for (const [key, { id, level: conditionLevel }] of Object.entries(gathered.conditions)) {
    const path = `${CONDITIONS_PATH}.${key}.level`;
    const label = names.get(id) ?? {};
    const parts: BreakdownStep[] =
      conditionLevel === 0
        ? []
        : [{ kind: 'condition', source: id, label, value: conditionLevel, change: conditionLevel }];
    steps.set(path, () => ({ value: conditionLevel, steps: parts }));
    order.push(path);
  }

  // The module's steps, after the core's. A path the core gives stays the core's.
  for (const [path, step] of Object.entries(input.steps)) {
    if (values.has(path) || steps.has(path)) {
      warnings.push({
        code: 'pathTaken',
        path,
        message: `The module gives "${path}", which the core computes; the core's value is used.`,
      });
      continue;
    }
    steps.set(path, step);
    order.push(path);
  }

  // A path's value, computed when first read. `readBy` is the path whose step reads it.
  const computing = new Set<string>();
  function valueAt(path: string, readBy: string): number {
    const known = values.get(path);
    if (known !== undefined) return known;
    const step = steps.get(path);
    if (step === undefined) {
      warnings.push({
        code: 'missingPath',
        path,
        for: readBy,
        message: `Missing: @${path} (read for ${readBy}); 0 is used.`,
      });
      return 0;
    }
    if (computing.has(path)) {
      warnings.push({
        code: 'cycle',
        path,
        for: readBy,
        message: `@${path} is read for ${readBy} while it is being computed; 0 is used.`,
      });
      return 0;
    }
    computing.add(path);
    const read: ValueReader = (each) => valueAt(each, path);
    const result = finish(path, step(read), read);
    computing.delete(path);
    values.set(path, result.value);
    breakdown.set(path, result.steps);
    return result.value;
  }

  const out: DerivedValues = { values: {}, breakdown: {}, warnings };
  for (const path of order) {
    out.values[path] = valueAt(path, path);
    out.breakdown[path] = breakdown.get(path) ?? [];
  }
  return out;
}
