import type { EntityId, EntityPartId } from '@grimoire/schema';
import { type EffectWarning, STAT_FIELDS } from './effects';
import { evaluateNumber, type FormulaWarning } from './formula';
import { type EntityFinder, type GatherableEntity, type Gathered, isCoreKind } from './gather';
import { type BreakdownStep, type KeyStep, STAT_TYPE, type Stats } from './stats';

// ENG-28: SPEC §6.1 step 5, the derived values. The core gives the character's level and each
// stat's modifier; the module gives the rest as steps, one per path. A path is computed when it is
// first read, so a step may read any other path, in any order, and each is computed once. A path
// read while it is being computed reads 0 with a warning, so a loop never exhausts the stack.
// ENG-43: a module may also give key paths, whose value is a key (a skill's stat). A step reads
// one through `readKey`; it is finished when first read, in the same loop check as a number.
// ENG-48: a key path given with no key of its own is a choice still to make: it is pending, with
// its keys as the options, and has a key only when an effect or an override sets one.

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
  /** The module's name for the rule that gives `defaultMax`, when one does; its step names it. */
  readonly maxRule?: string;
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

/** Something a step met by a rule of its system: `rule` is the module's name for it (ENG-14). */
export interface RuleWarning {
  readonly rule: string;
  /** What the screen shows with it. */
  readonly data?: Readonly<Record<string, string | number>>;
  readonly message: string;
}

/** A number a step gives, and the steps that made it (SPEC §6.2). */
export interface Derived {
  readonly value: number;
  readonly steps: readonly BreakdownStep[];
  /** What a formula the step evaluated met; each is warned as `stepFormula` (ENG-13). */
  readonly warnings?: readonly FormulaWarning[];
  /** What a rule of its system met; each is warned as `stepRule` (ENG-14). */
  readonly ruleWarnings?: readonly RuleWarning[];
  /**
   * What working out an effect it read met (`appendedNumbers`, `rollModeEffects`); each is warned
   * as it is, once however many paths meet it.
   */
  readonly effectWarnings?: readonly EffectWarning[];
}

/** A computed path's value, computed first when it is not yet. A path nothing gives reads 0. */
export type ValueReader = (path: string) => number;

/** A reader for the formula of one part (`<entityId>#<id>`): a loop it closes names that part. */
export type PartReader = (by: EntityPartId) => ValueReader;

/** A key path's finished key; `undefined` for a path no module gives as a key. */
export type KeyReader = (path: string) => string | undefined;

/**
 * How one path is computed: from other paths, read through `read`. A step that evaluates a pack's
 * formula of an entity part reads through `readBy(part)` instead, so a loop names the part. A key
 * path is read through `readKey`.
 */
export type DerivedStep = (read: ValueReader, readBy: PartReader, readKey: KeyReader) => Derived;

/** What comes after a path's own step: ENG-17's effects and override, each read by its part. */
export type Finish = (path: string, own: Derived, readBy: PartReader) => Derived;

/**
 * A path whose value is a key, not a number (SPEC §5.4 `skills.<key>.ability`), as a module gives
 * it: its own key, the steps that gave it, and the keys an effect or an override may set it to.
 * Without `key`, its own key is a choice not yet made (ENG-48: a species offering two sizes).
 */
export interface KeyPath {
  readonly key?: string;
  readonly steps: readonly KeyStep[];
  readonly keys: readonly string[];
  /** What a rule of its system met in giving it; each is warned as `stepRule` (ENG-48). */
  readonly ruleWarnings?: readonly RuleWarning[];
}

/** A key path's key after its effects and override, and the steps that chose it, the last one's. */
export interface ComputedKey {
  readonly key: string;
  readonly steps: readonly KeyStep[];
}

/** A key path whose own key is a choice not yet made, and the keys it may take (ENG-48). */
export interface PendingKey {
  readonly path: string;
  readonly options: readonly string[];
}

/**
 * What comes after a key path's own key: its effects and override, each read by its part.
 * `undefined` when it has no key of its own and none of them sets one.
 */
export type FinishKey = (path: string, own: KeyPath, readBy: PartReader) => ComputedKey | undefined;

/** A path on a formula loop. `by` is the part whose formula read it; without it, a step did. */
export interface LoopLink {
  readonly path: string;
  readonly by?: EntityPartId;
}

/** What a module's steps are made from. */
export interface DeriveInput<C, E extends GatherableEntity> {
  readonly character: C;
  /** What the character has (ENG-11). */
  readonly gathered: Gathered<E>;
  /** Each stat the character has, in `byKey`'s order. */
  readonly stats: readonly StatOf<E>[];
  /** Any entity by its id, as the character finds it, had or not (ENG-44). */
  readonly find: EntityFinder<E>;
}

/** Something the derived step met. `code` and its data are for the screen; `message` is for logs. */
export type DerivedWarning =
  | EffectWarning
  | ({ message: string } & (
      | { code: 'modFormula'; key: string; of: 'stat' | 'system'; warning: FormulaWarning }
      | { code: 'resourceFormula'; key: string; part: EntityPartId; warning: FormulaWarning }
      | { code: 'stepFormula'; path: string; warning: FormulaWarning }
      | {
          code: 'stepRule';
          path: string;
          rule: string;
          data?: Readonly<Record<string, string | number>>;
        }
      | { code: 'missingPath'; path: string; for: string }
      | { code: 'cycle'; path: string; for: string; loop: readonly LoopLink[] }
      | { code: 'pathTaken'; path: string }
    ));

/**
 * Each path's value and breakdown, in the order of `computeDerived`; each key path's key, and the
 * key paths still to choose.
 */
export interface DerivedValues {
  values: Record<string, number>;
  breakdown: Record<string, readonly BreakdownStep[]>;
  keys: Record<string, ComputedKey>;
  pendingKeys: PendingKey[];
  warnings: DerivedWarning[];
}

/** A loop as a log names it: each path, and the part whose formula read it. */
function loopText(loop: readonly LoopLink[]): string {
  return loop
    .map(({ path, by }) => `@${path}${by === undefined ? '' : ` (read by "${by}")`}`)
    .join(' → ');
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
 * but `level` after its own step (ENG-17); without it, a path is its step's. Then each of the
 * module's `keys`, `finishKey` after its own key; one with no own key is pending. Pure.
 */
export function computeDerived<E extends GatherableEntity>(input: {
  level: number;
  gathered: Gathered<E>;
  stats: readonly StatOf<E>[];
  defaults: StatDefaults;
  base: Stats;
  steps: Readonly<Record<string, DerivedStep>>;
  finish?: Finish;
  keys?: Readonly<Record<string, KeyPath>>;
  finishKey?: FinishKey;
}): DerivedValues {
  const { level, gathered, stats, defaults, base } = input;
  const finish: Finish = input.finish ?? ((_, own) => own);
  const finishKey: FinishKey = input.finishKey ?? ((_, own) => ownKey(own));
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
    steps.set(path, (_, readBy) => {
      let max: number | undefined;
      const parts = given.map(({ part, source, formula }): BreakdownStep => {
        const result = evaluateNumber(formula, readBy(part));
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

  // The module's key paths. A path it gives as a number too stays a number.
  const keyPaths = new Map<string, KeyPath>();
  for (const [path, keyPath] of Object.entries(input.keys ?? {})) {
    if (values.has(path) || steps.has(path)) {
      warnings.push({
        code: 'pathTaken',
        path,
        message: `The module gives "${path}" as a key, and it is a number; the number is used.`,
      });
      continue;
    }
    keyPaths.set(path, keyPath);
  }

  // A path's value, computed when first read. `readFor` is the path whose computing reads it, `by`
  // the part whose formula does. ENG-18: the paths in progress, in the order they began, each with
  // what read it; a path read again closes a loop, named from that path to the read that closed it.
  const computing = new Map<string, LoopLink>();
  const warnedEffects = new Set<string>();

  /** Whether reading `path` now closes a loop; if it does, the loop is warned, `used` in it. */
  function closesLoop(path: string, readFor: string, link: LoopLink, used: string): boolean {
    if (!computing.has(path)) return false;
    const links = [...computing.values()];
    const loop = [
      { path },
      ...links.slice(links.findIndex((each) => each.path === path) + 1),
      link,
    ];
    warnings.push({
      code: 'cycle',
      path,
      for: readFor,
      loop,
      message: `@${path} is read for ${readFor} while it is being computed; ${used} is used. The loop: ${loopText(loop)}.`,
    });
    return true;
  }

  function valueAt(path: string, readFor: string, by?: EntityPartId): number {
    const known = values.get(path);
    if (known !== undefined) return known;
    const step = steps.get(path);
    if (step === undefined) {
      warnings.push({
        code: 'missingPath',
        path,
        for: readFor,
        message: `Missing: @${path} (read for ${readFor}); 0 is used.`,
      });
      return 0;
    }
    const link: LoopLink = by === undefined ? { path } : { path, by };
    if (closesLoop(path, readFor, link, '0')) return 0;
    computing.set(path, link);
    const read: ValueReader = (each) => valueAt(each, path);
    const readBy: PartReader = (part) => (each) => valueAt(each, path, part);
    const readKey: KeyReader = (each) => keyAt(each, path)?.key;
    const own = step(read, readBy, readKey);
    for (const warning of own.warnings ?? []) {
      warnings.push({
        code: 'stepFormula',
        path,
        warning,
        message: `${warning.message} (a formula computing ${path}).`,
      });
    }
    for (const { rule, data, message } of own.ruleWarnings ?? []) {
      warnings.push({ code: 'stepRule', path, rule, ...(data && { data }), message });
    }
    // ENG-34: one effect may be read by several paths (a roll target by every test it reaches);
    // each of its warnings is warned once.
    for (const warning of own.effectWarnings ?? []) {
      const key = JSON.stringify(warning);
      if (warnedEffects.has(key)) continue;
      warnedEffects.add(key);
      warnings.push(warning);
    }
    const result = finish(path, own, readBy);
    computing.delete(path);
    values.set(path, result.value);
    breakdown.set(path, result.steps);
    return result.value;
  }

  // A key path's key, finished when first read; in a loop, its own key, unfinished. A finished
  // path with no key is kept as `undefined`, so it is finished once.
  const keys = new Map<string, ComputedKey | undefined>();
  function keyAt(path: string, readFor: string): ComputedKey | undefined {
    if (keys.has(path)) return keys.get(path);
    const own = keyPaths.get(path);
    if (own === undefined) return undefined;
    const used = own.key === undefined ? 'no key' : `its own key "${own.key}"`;
    if (closesLoop(path, readFor, { path }, used)) return ownKey(own);
    computing.set(path, { path });
    for (const { rule, data, message } of own.ruleWarnings ?? []) {
      warnings.push({ code: 'stepRule', path, rule, ...(data && { data }), message });
    }
    const readBy: PartReader = (part) => (each) => valueAt(each, path, part);
    const result = finishKey(path, own, readBy);
    computing.delete(path);
    keys.set(path, result);
    return result;
  }

  const out: DerivedValues = { values: {}, breakdown: {}, keys: {}, pendingKeys: [], warnings };
  for (const path of order) {
    out.values[path] = valueAt(path, path);
    out.breakdown[path] = breakdown.get(path) ?? [];
  }
  for (const [path, own] of keyPaths) {
    const key = keyAt(path, path);
    if (key !== undefined) out.keys[path] = key;
    if (own.key === undefined) out.pendingKeys.push({ path, options: own.keys });
  }
  return out;
}

/** A key path's own key and steps, before its effects and override; none when it has no key. */
function ownKey(own: KeyPath): ComputedKey | undefined {
  return own.key === undefined ? undefined : { key: own.key, steps: own.steps };
}
