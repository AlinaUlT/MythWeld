import type { ContentIndex } from './content-index';
import {
  computeDerived,
  type DerivedStep,
  type DerivedWarning,
  type DeriveInput,
  LEVEL_PATH,
  type StatDefaults,
  statsOf,
} from './derived';
import type { FormulaValue } from './formula';
import {
  type CharacterCore,
  type GatherableEntity,
  type Gathered,
  type GatherWarning,
  gather,
  type NamedEntity,
} from './gather';
import { type PhaseWarning, phasesOf } from './phases';
import { type BasePhase, type BreakdownStep, computeStats, type StatWarning } from './stats';

// The compute pipeline (SPEC §6.1, ADR 004 item 1). The core runs the steps; what only a game
// knows comes from its module. Each step's ticket adds what it gives to `Computed`.

/** What the core asks of a system's module about a character `C` whose entities are `E`. */
export interface SystemModule<C, E extends GatherableEntity = GatherableEntity> {
  /** The character's level: what a grant's `atLevel` is measured against. */
  level(character: C): number;
  /**
   * The entities the module's part of the character names, in order (a fifth-edition species,
   * classes, feats; a Tales calling and talents). `level`, when given, is what that entity's
   * grants are measured against instead (a class's own level).
   */
  entities(character: C): readonly NamedEntity[];
  /** What a stat takes when it lacks the field. */
  readonly statDefaults: StatDefaults;
  /**
   * A path a base-phase formula may read besides `level`, with its value for this character:
   * SPEC §5.6 allows levels, class levels and choices (a fifth-edition class's level). Gives
   * `undefined` for a path a base-phase formula may not read.
   */
  basePath?(character: C, path: string): FormulaValue | undefined;
  /**
   * The system's derived values (SPEC §6.1 step 5): computed path → its step. A step reads any
   * other path, the core's or the module's. The core gives `level`, each stat's
   * `abilities.<key>.score`, `.max` and `.mod`, each resource's `resources.<key>.max`, and each
   * condition's `conditions.<key>.level`. Effects and overrides apply to a step's result (ENG-17).
   */
  derive(input: DeriveInput<C, E>): Readonly<Record<string, DerivedStep>>;
}

/** Something computing met: gathering, the base phase, the derived values, then the phases. */
export type ComputeWarning = GatherWarning | StatWarning | DerivedWarning | PhaseWarning;

/** What `compute()` gives: what the character has (SPEC §6.1 steps 1–2), then its values. */
export interface Computed<E extends GatherableEntity> extends Omit<Gathered<E>, 'warnings'> {
  /** Computed path → value: what a formula reads and the sheet shows. */
  values: Readonly<Record<string, FormulaValue>>;
  /** Computed path → the steps that made its value (SPEC §6.2). */
  breakdown: Readonly<Record<string, readonly BreakdownStep[]>>;
  warnings: readonly ComputeWarning[];
}

/**
 * Computes a character of a system: `index` holds its active packs (`loadContentIndex`), `system`
 * is its system's module. Pure and deterministic: nothing passed in is changed, and the same
 * arguments give an equal result.
 */
export function compute<C extends CharacterCore<E>, E extends GatherableEntity>(
  character: C,
  index: ContentIndex<E>,
  system: SystemModule<C, E>,
): Computed<E> {
  const level = system.level(character);
  const gathered = gather(character, index, level, system.entities(character));
  const defaults = system.statDefaults;
  const basePhase: BasePhase = {
    read: (path) => (path === LEVEL_PATH ? level : system.basePath?.(character, path)),
    defaultMax: defaults.defaultMax,
  };
  const base = computeStats(character, gathered, basePhase);
  const stats = statsOf(gathered, defaults);
  const steps = system.derive({ character, gathered, stats });
  const phases = phasesOf(character, gathered, basePhase);
  const finish = phases.finish;
  const derived = computeDerived({ level, gathered, stats, defaults, base, steps, finish });
  return {
    ...gathered,
    values: derived.values,
    breakdown: derived.breakdown,
    warnings: [...gathered.warnings, ...base.warnings, ...derived.warnings, ...phases.end()],
  };
}
