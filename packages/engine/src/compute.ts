import type { ContentIndex } from './content-index';
import type { FormulaValue } from './formula';
import {
  type CharacterCore,
  type GatherableEntity,
  type Gathered,
  type GatherWarning,
  gather,
  type NamedEntity,
} from './gather';
import { type BreakdownStep, computeStats, type StatWarning } from './stats';

// The compute pipeline (SPEC §6.1, ADR 004 item 1). The core runs the steps; what only a game
// knows comes from its module. Each step's ticket adds what it gives to `Computed`.

/** The path of the character's level, which a base-phase formula may read (SPEC §5.6). */
const LEVEL_PATH = 'level';

/** What a stat takes from its system when it lacks the field (SPEC §5.3). */
export interface StatDefaults {
  /** The highest a score can be: what a stat without its own `defaultMax` takes. */
  readonly defaultMax: number;
}

/** What the core asks of a system's module about a character `C`. */
export interface SystemModule<C> {
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
}

/** Something computing met: gathering, then the base phase. */
export type ComputeWarning = GatherWarning | StatWarning;

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
  system: SystemModule<C>,
): Computed<E> {
  const level = system.level(character);
  const gathered = gather(character, index, level, system.entities(character));
  const stats = computeStats(character, gathered, {
    read: (path) => (path === LEVEL_PATH ? level : system.basePath?.(character, path)),
    defaultMax: system.statDefaults.defaultMax,
  });
  return {
    ...gathered,
    values: stats.values,
    breakdown: stats.breakdown,
    warnings: [...gathered.warnings, ...stats.warnings],
  };
}
