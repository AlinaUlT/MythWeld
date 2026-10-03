import type { EntityPartId } from '@grimoire/schema';
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
  type RuleWarning,
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
  type KeyFinder,
  keyFinderOf,
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
   * in part (ENG-44). `find` looks an id up as gathering will (ENG-44: an item's category);
   * `findKey`, an entry by its type and key (ENG-62: the condition a rule gives by its key).
   */
  entities(character: C, find: EntityFinder<E>, findKey: KeyFinder<E>): readonly NamedEntity[];
  /**
   * What a stat takes when it lacks the field, for this character (ENG-54: a fifth-edition house
   * rule gives its highest score).
   */
  statDefaults(character: C): StatDefaults;
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
   * A grant's part is `<entityId>#<grantId>` either way. `find` looks an id up as gathering will
   * (ENG-35: a fifth-edition background's increases depend on what the species gives).
   */
  grantsOf?(character: C, entity: E, find: EntityFinder<E>): readonly GrantOf<E>[];
  /**
   * ENG-49: the entity ids a grant of the module's own kind names (a fifth-edition `spell`
   * grant's `fixed` spells, an `item` grant's `fixed` items). Gathering asks it of each grant it
   * reaches but an `entity`, `proficiency` or `resource` one, and looks each id up: one not found
   * warns `missing`. They are not gathered, so their effects and grants do nothing. Every
   * grant's chosen ids are looked up whether the module gives this or not.
   */
  namedIds?(grant: GrantOf<E>): readonly string[];
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
  /**
   * ENG-35: what a rule of the system met about the character as a whole, not about one path (a
   * fifth-edition character taking ability increases from both its species and its background).
   * Each is warned as `characterRule`.
   */
  ruleWarnings?(input: DeriveInput<C, E>): readonly RuleWarning[];
  /**
   * ENG-46: the effects a rule of the system switches off once gathering shows what the character
   * has (a fifth-edition shield worn without training in 2024 gives no AC), each by its part,
   * `<entityId>#<effectId>`. None of them applies, in any phase, whatever its `when` or toggle; a
   * part naming no effect of an entity the character has changes nothing.
   */
  suppressedEffects?(input: DeriveInput<C, E>): readonly EntityPartId[];
}

/** A warning a module's `ruleWarnings` gave: `rule` is the module's name for it (ENG-35). */
export interface CharacterRuleWarning {
  readonly code: 'characterRule';
  readonly rule: string;
  /** What the screen shows with it. */
  readonly data?: Readonly<Record<string, string | number>>;
  readonly message: string;
}

/**
 * Something computing met: gathering, the base phase, the derived values, the phases, then the
 * module's rules about the whole character.
 */
export type ComputeWarning =
  | GatherWarning
  | StatWarning
  | DerivedWarning
  | PhaseWarning
  | CharacterRuleWarning;

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
 * ENG-46: `gathered` with each entity marked with the ids of its effects `named` names; the same
 * `gathered` when it names none.
 */
function suppressed<E extends GatherableEntity>(
  gathered: Gathered<E>,
  named: readonly EntityPartId[],
): Gathered<E> {
  const parts = new Set<string>(named);
  if (parts.size === 0) return gathered;
  let marked = false;
  const entities = gathered.entities.map((had) => {
    const ids = (had.entity.effects ?? [])
      .map(({ id }) => id)
      .filter((id) => parts.has(`${had.entity.id}#${id}`));
    if (ids.length === 0) return had;
    marked = true;
    return { ...had, suppressed: ids };
  });
  return marked ? { ...gathered, entities } : gathered;
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
  const had = gather(
    character,
    index,
    level,
    system.entities(character, find, keyFinderOf(character, index)),
    grantsOf === undefined ? ownGrants : (entity) => grantsOf(character, entity, find),
    system.namedIds,
  );
  const defaults = system.statDefaults(character);
  // The stats are the stat entities had; suppressing an effect changes none of them.
  const stats = statsOf(had, defaults);
  const gathered = suppressed(
    had,
    system.suppressedEffects?.({ character, gathered: had, stats, find }) ?? [],
  );
  const basePhase: BasePhase = {
    read: (path) => (path === LEVEL_PATH ? level : system.basePath?.(character, path, gathered)),
    defaultMax: defaults.defaultMax,
    ...(defaults.maxRule !== undefined && { maxRule: defaults.maxRule }),
  };
  const base = computeStats(character, gathered, basePhase);
  const steps = system.derive({ character, gathered, stats, find });
  const keys = system.keys?.({ character, gathered, stats, find }) ?? {};
  const rules: CharacterRuleWarning[] = (
    system.ruleWarnings?.({ character, gathered, stats, find }) ?? []
  ).map(({ rule, data, message }) => ({
    code: 'characterRule',
    rule,
    ...(data && { data }),
    message,
  }));
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
    warnings: [
      ...gathered.warnings,
      ...base.warnings,
      ...derived.warnings,
      ...phases.end(),
      ...rules,
    ],
  };
}
