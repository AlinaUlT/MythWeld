import type { ContentIndex } from './content-index';
import {
  type ComputedKey,
  computeDerived,
  type DerivedStep,
  type DerivedWarning,
  type DeriveInput,
  type KeyPath,
  LEVEL_PATH,
  type PendingKey,
  type StatDefaults,
  statsOf,
} from './derived';
import type { FormulaValue } from './formula';
import {
  type CharacterCore,
  type EntityFinder,
  finderOf,
  type GatherableEntity,
  type Gathered,
  type GatherWarning,
  type GrantOf,
  gather,
  type NamedEntity,
  ownGrants,
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
   * grants are measured against instead (a class's own level); `paths`, values its own effects read
   * first (ENG-14: a fifth-edition item's `@equipped`); `dormant`, when the character has it only
   * in part (ENG-44). `find` looks an id up as gathering will (ENG-44: an item's category).
   */
  entities(character: C, find: EntityFinder<E>): readonly NamedEntity[];
  /** What a stat takes when it lacks the field. */
  readonly statDefaults: StatDefaults;
  /**
   * A path a base-phase formula may read besides `level`, with its value for this character:
   * SPEC §5.6 allows levels, class levels and choices (a fifth-edition class's level). Gives
   * `undefined` for a path a base-phase formula may not read. `gathered` is what it has.
   */
  basePath?(character: C, path: string, gathered: Gathered<E>): FormulaValue | undefined;
  /**
   * The grants an entity gives this character, when a rule of the system leaves some of its own
   * out or adds others (ENG-13: a fifth-edition class taken after the first). Gathering reads
   * every entity's grants through it, once each; without it, an entity gives its own `grants`.
   * A grant's part is `<entityId>#<grantId>` either way.
   */
  grantsOf?(character: C, entity: E): readonly GrantOf<E>[];
  /**
   * The system's derived values (SPEC §6.1 step 5): computed path → its step. A step reads any
   * other path, the core's or the module's; a pack's formula of an entity part is read through
   * `readBy(part)`, so a loop it closes names the part. The core gives `level`, each stat's
   * `abilities.<key>.score`, `.max` and `.mod`, each resource's `resources.<key>.max`, and each
   * condition's `conditions.<key>.level`. Effects and overrides apply to a step's result (ENG-17).
   */
  derive(input: DeriveInput<C, E>): Readonly<Record<string, DerivedStep>>;
  /**
   * The system's key paths (ENG-43): computed path → its own key, its steps, and the keys it may
   * take (a fifth-edition skill's stat, SPEC §5.4 `skills.<key>.ability`). A step reads one with
   * `readKey`. An effect's `set` naming one of its keys changes it, in the order a number's
   * effects apply; an override naming one wins. One given with no own key is a choice the
   * character has not made (ENG-48: a fifth-edition species' size), listed in `pendingKeys`.
   */
  keys?(input: DeriveInput<C, E>): Readonly<Record<string, KeyPath>>;
}

/** Something computing met: gathering, the base phase, the derived values, then the phases. */
export type ComputeWarning = GatherWarning | StatWarning | DerivedWarning | PhaseWarning;

/** What `compute()` gives: what the character has (SPEC §6.1 steps 1–2), then its values. */
export interface Computed<E extends GatherableEntity> extends Omit<Gathered<E>, 'warnings'> {
  /** Computed path → value: what a formula reads and the sheet shows. */
  values: Readonly<Record<string, FormulaValue>>;
  /** Computed path → the steps that made its value (SPEC §6.2). */
  breakdown: Readonly<Record<string, readonly BreakdownStep[]>>;
  /** Key path → its key and the steps that chose it. A path with no key is not here. */
  keys: Readonly<Record<string, ComputedKey>>;
  /**
   * The key paths whose own key is a choice not yet made, each with its keys as the options: the
   * pending choices (SPEC §6.1 step 8) a module's part of the character holds, beside the grants'
   * `pendingChoices`.
   */
  pendingKeys: readonly PendingKey[];
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
  const grantsOf = system.grantsOf;
  const find = finderOf(character, index);
  const gathered = gather(
    character,
    index,
    level,
    system.entities(character, find),
    grantsOf === undefined ? ownGrants : (entity) => grantsOf(character, entity),
  );
  const defaults = system.statDefaults;
  const basePhase: BasePhase = {
    read: (path) => (path === LEVEL_PATH ? level : system.basePath?.(character, path, gathered)),
    defaultMax: defaults.defaultMax,
  };
  const base = computeStats(character, gathered, basePhase);
  const stats = statsOf(gathered, defaults);
  const steps = system.derive({ character, gathered, stats, find });
  const keys = system.keys?.({ character, gathered, stats, find }) ?? {};
  const phases = phasesOf(character, gathered, basePhase);
  const { finish, finishKey } = phases;
  const derived = computeDerived({
    level,
    gathered,
    stats,
    defaults,
    base,
    steps,
    finish,
    keys,
    finishKey,
  });
  return {
    ...gathered,
    values: derived.values,
    breakdown: derived.breakdown,
    keys: derived.keys,
    pendingKeys: derived.pendingKeys,
    warnings: [...gathered.warnings, ...base.warnings, ...derived.warnings, ...phases.end()],
  };
}
