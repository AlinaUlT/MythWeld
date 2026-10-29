import type { EntityPartId, Prerequisite } from '@grimoire/schema';
import type { ContentIndex } from './content-index';
import {
  type Candidate,
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
  keysOfTypeOf,
  type NamedEntity,
  ownGrants,
} from './gather';
import { type PhaseWarning, phasesOf } from './phases';
import { type PrerequisiteWarning, prerequisiteWarnings } from './prerequisites';
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
   * `abilities.<key>.score`, `.max` and `.mod`, each resource's `resources.<key>.max` and
   * `recoveryPath`s, and each condition's `conditions.<key>.level`. Effects and overrides apply to a step's result (ENG-17).
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
  /**
   * SHEET-61: the entities a rule of the system says have no effect on this character, by id, read
   * from what was computed (a fifth-edition condition the character is immune to). `computed`
   * gives what was had and what was `withheld`. While the ids differ from those the last pass left
   * out, `compute()` runs again without them: gathering leaves each out where it meets it, so
   * neither its effects nor its grants apply. An id of no entity the character meets changes
   * nothing.
   */
  withheldEntities?(character: C, computed: Computed<E>): readonly string[];
  /**
   * SHEET-14: the prerequisites this character must meet to have an entity, when a rule of the
   * system adds to the entity's own (a fifth-edition class of a character with more than one
   * class: its multiclass prerequisites). Without it, an entity's own `prerequisites`. Each one
   * unmet is warned as `unmetPrerequisite`; the entity applies all the same.
   */
  prerequisitesOf?(character: C, entity: E): readonly Prerequisite[];
  /**
   * SHEET-22: the places in the module's part of the character that name an effect by its part (a
   * fifth-edition pinned AC calculation). An action that takes an entity from the character drops
   * each that names one of that entity's effects, as it drops the entity's stored switches.
   */
  storedParts?(character: C): readonly StoredPart[];
}

/** SHEET-22: a place in a character that names an effect by its part, `<entityId>#<effectId>`. */
export interface StoredPart {
  readonly path: readonly string[];
  readonly part: string;
}

/**
 * SHEET-61: the passes ran out before the ids a module withholds settled (two of its rules that
 * undo each other); the last pass is used.
 */
export interface WithheldWarning {
  readonly code: 'withheldUnsettled';
  /** The ids the last pass left out. */
  readonly ids: readonly string[];
  readonly message: string;
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
 * Something computing met: gathering, the base phase, the derived values, the phases, the
 * prerequisites, then the module's rules about the whole character.
 */
export type ComputeWarning =
  | GatherWarning
  | StatWarning
  | DerivedWarning
  | PhaseWarning
  | PrerequisiteWarning
  | CharacterRuleWarning
  | WithheldWarning;

/** What `compute()` gives: what the character has (SPEC §6.1 steps 1–2), then its values. */
export interface Computed<E extends GatherableEntity> extends Omit<Gathered<E>, 'warnings'> {
  /** Computed path → value: what a formula reads and the sheet shows. */
  values: Readonly<Record<string, FormulaValue>>;
  /** Computed path → the steps that made its value (SPEC §6.2). */
  breakdown: Readonly<Record<string, readonly BreakdownStep[]>>;
  /**
   * SHEET-21: computed path → the numbers its value is chosen from, each with its key, value and
   * steps, as its step gave them. A path whose step gives none is not here.
   */
  candidates: Readonly<Record<string, readonly Candidate[]>>;
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

/** The most passes `compute()` runs while the ids a module withholds change (SHEET-61). */
export const MAX_COMPUTE_PASSES = 8;

/** The ids, each once, in a fixed order. */
function idSet(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

/**
 * Computes a character of a system: `index` holds its active packs (`loadContentIndex`), `system`
 * is its system's module. Pure and deterministic: nothing passed in is changed, and the same
 * arguments give an equal result. SHEET-61: when the module withholds entities, it runs again
 * without them until the ids it names are those left out, at most `MAX_COMPUTE_PASSES` times.
 */
export function compute<C extends CharacterCore<E>, E extends GatherableEntity>(
  character: C,
  index: ContentIndex<E>,
  system: SystemModule<C, E>,
): Computed<E> {
  let without: string[] = [];
  let computed = computeOnce(character, index, system, without);
  const withheldEntities = system.withheldEntities;
  if (withheldEntities === undefined) return computed;
  for (let pass = 1; ; pass += 1) {
    const next = idSet(withheldEntities(character, computed));
    if (next.join('\n') === without.join('\n')) return computed;
    if (pass === MAX_COMPUTE_PASSES) {
      const warning: WithheldWarning = {
        code: 'withheldUnsettled',
        ids: without,
        message: `The entities the module leaves out did not settle in ${pass} passes; the last pass is used.`,
      };
      return { ...computed, warnings: [...computed.warnings, warning] };
    }
    without = next;
    computed = computeOnce(character, index, system, without);
  }
}

/** One pass of `compute()`, gathering without the entities `without` names. */
function computeOnce<C extends CharacterCore<E>, E extends GatherableEntity>(
  character: C,
  index: ContentIndex<E>,
  system: SystemModule<C, E>,
  without: readonly string[],
): Computed<E> {
  const level = system.level(character);
  const grantsOf = system.grantsOf;
  const find = finderOf(character, index);
  const findKey = keyFinderOf(character, index);
  const keysOf = keysOfTypeOf(character, index, findKey);
  const had = gather(
    character,
    index,
    level,
    system.entities(character, find, findKey),
    grantsOf === undefined ? ownGrants : (entity) => grantsOf(character, entity, find),
    system.namedIds,
    new Set(without),
  );
  const defaults = system.statDefaults(character);
  // The stats are the stat entities had; suppressing an effect changes none of them.
  const stats = statsOf(had, defaults);
  const gathered = suppressed(
    had,
    system.suppressedEffects?.({ character, gathered: had, stats, find, findKey, keysOf }) ?? [],
  );
  const basePhase: BasePhase = {
    read: (path) => (path === LEVEL_PATH ? level : system.basePath?.(character, path, gathered)),
    defaultMax: defaults.defaultMax,
    ...(defaults.maxRule !== undefined && { maxRule: defaults.maxRule }),
  };
  const base = computeStats(character, gathered, basePhase);
  const input: DeriveInput<C, E> = { character, gathered, stats, find, findKey, keysOf };
  const steps = system.derive(input);
  const keys = system.keys?.(input) ?? {};
  const rules: CharacterRuleWarning[] = (system.ruleWarnings?.(input) ?? []).map(
    ({ rule, data, message }) => ({
      code: 'characterRule',
      rule,
      ...(data && { data }),
      message,
    }),
  );
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
  const prerequisitesOf = system.prerequisitesOf;
  const prerequisites = prerequisiteWarnings({
    entities: gathered.entities,
    proficiencies: gathered.proficiencies,
    values: derived.values,
    prerequisitesOf:
      prerequisitesOf === undefined
        ? (entity) => entity.prerequisites ?? []
        : (entity) => prerequisitesOf(character, entity),
  });
  return {
    ...gathered,
    values: derived.values,
    breakdown: derived.breakdown,
    candidates: derived.candidates,
    keys: derived.keys,
    pendingKeys: derived.pendingKeys,
    warnings: [
      ...gathered.warnings,
      ...base.warnings,
      ...derived.warnings,
      ...phases.end(),
      ...prerequisites,
      ...rules,
    ],
  };
}
