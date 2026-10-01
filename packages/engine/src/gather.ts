import type { EntityId, EntityPartId, Grant, L10n, UsesDef } from '@grimoire/schema';
import {
  ANY_RULESET,
  type ContentIndex,
  type IndexedEntity,
  type Lookup,
  shareRuleset,
} from './content-index';

// ENG-11: SPEC §6.1 steps 1 and 2. The entities a character has are the ones its module names and
// the conditions in its trackers, then, depth first, what their grants give. The core reads every
// system's entities through structural views, so a module's grant kind passes through with its
// own type (ENG-24 §11). Nothing throws: a missing id, an unmade choice, an item not offered or an
// entity of another edition is a warning or a pending choice (SPEC §8.2, ADR 005 item 3.3).

/** The core's condition type (ENG-03): the type whose keys give `@conditions.<key>.level`. */
const CONDITION_TYPE = 'condition';

/** What names a root entity: the character itself (its module part or its trackers). */
const CHARACTER = 'character';

/** Where an entity was given: by the character, or by one grant of another entity. */
export type Origin = typeof CHARACTER | EntityPartId;

/** One entity to visit: its id, the level its grants count, and where it was given. */
interface Step {
  id: string;
  level: number;
  from: Origin;
}

/** What a filter matches: every field it names (SPEC §5.5 `Choose`). */
export interface ChooseFilter {
  readonly type?: string;
  readonly tag?: string;
  readonly category?: string;
}

/** A choice: `count` items from a list, or from what a filter finds. Every kind's has this shape. */
export interface ChooseView {
  readonly count: number;
  readonly from: readonly string[] | ChooseFilter;
}

/** What the core reads of any grant, a module's kinds included. */
export interface GrantView {
  readonly id: string;
  readonly kind: string;
  readonly atLevel?: number;
  readonly choose?: ChooseView;
}

/** What the core reads of an entity to gather it. Any system's entity union is assignable. */
export interface GatherableEntity extends IndexedEntity {
  readonly tags?: readonly string[];
  readonly grants?: readonly GrantView[];
}

/** One grant of an entity, with the system's own type. */
export type GrantOf<E extends GatherableEntity> = NonNullable<E['grants']>[number];

/** What the core reads of a character: its rules base, choices, conditions and own entities. */
export interface CharacterCore<E extends GatherableEntity> {
  readonly ruleset: string;
  readonly allowMixedRulesets: boolean;
  readonly choices: Readonly<Partial<Record<string, readonly string[]>>>;
  readonly state: {
    readonly conditions: readonly { readonly id: string; readonly level?: number }[];
  };
  readonly localEntities: readonly E[];
}

/** An entity the module's part of a character names; `level` when its grants count their own. */
export interface NamedEntity {
  readonly id: string;
  readonly level?: number;
}

/** An entity the character has: every place that gave it, and the level its grants count. */
export interface HadEntity<E extends GatherableEntity> {
  entity: E;
  level: number;
  from: readonly Origin[];
}

/** A grant that applies, with the items chosen for it (none when it is not a choice). */
export interface ReachedGrant<E extends GatherableEntity> {
  part: EntityPartId;
  source: EntityId;
  level: number;
  grant: GrantOf<E>;
  chosen: readonly string[];
}

/** One key a `proficiency` grant gives. `level` as the grant has it; its default is the system's. */
export interface ProficiencyGiven {
  category: string;
  key: string;
  level?: number;
  from: EntityPartId;
}

/** A resource a `resource` grant gives. Its maximum is computed later (ENG-29). */
export interface ResourceGiven {
  key: string;
  label: L10n;
  uses: UsesDef;
  from: EntityPartId;
}

/** A choice not made, or made with fewer items than it asks for, and what it may still take. */
export interface PendingChoice<E extends GatherableEntity> {
  part: EntityPartId;
  grant: GrantOf<E>;
  chosen: readonly string[];
  options: readonly string[];
}

/** A condition a formula reads as `@conditions.<key>.level`: the entry, and 0 when not had. */
export interface ConditionLevel {
  id: EntityId;
  level: number;
}

/** Something gathering met. `code` and its data are for the screen; `message` is for logs. */
export type GatherWarning = { message: string } & (
  | { code: 'missing'; id: string; from: Origin }
  | { code: 'otherRuleset'; entity: EntityId; ruleset: string; mixingAllowed: boolean }
  | { code: 'notAnOption'; part: EntityPartId; item: string }
  | { code: 'tooManyChosen'; part: EntityPartId; count: number; chosen: number }
  | { code: 'fewOptions'; part: EntityPartId; needed: number; found: number }
  | { code: 'conditionLevel'; entity: EntityId; level: number; max: number }
  | { code: 'repeatedKey'; type: string; key: string; entity: EntityId; kept: EntityId }
);

/** What a character has, what it still has to choose, and what gathering met. */
export interface Gathered<E extends GatherableEntity> {
  /** Each entity once: the module's, then the conditions', each followed by what it gives. */
  entities: readonly HadEntity<E>[];
  /** Every grant that applies, in the order of `entities`. */
  grants: readonly ReachedGrant<E>[];
  proficiencies: readonly ProficiencyGiven[];
  resources: readonly ResourceGiven[];
  pendingChoices: readonly PendingChoice<E>[];
  /** Type → key → the entry a formula path names (ADR 014 item 2). */
  byKey: Readonly<Record<string, Readonly<Record<string, E>>>>;
  /** Condition key → its entry and level. A condition without a key has no path. */
  conditions: Readonly<Record<string, ConditionLevel>>;
  warnings: readonly GatherWarning[];
}

type CoreGrant<K extends Grant['kind']> = Extract<Grant, { kind: K }>;

/**
 * A grant of one of the core's kinds, read with that kind's fields. ENG-24 refuses a module kind
 * whose name is a core kind's, so the name decides the shape.
 */
function isCoreKind<K extends Grant['kind']>(
  grant: GrantView,
  kind: K,
): grant is GrantView & CoreGrant<K> {
  return grant.kind === kind;
}

/** A filter, not a list. */
function isFilter(from: ChooseView['from']): from is ChooseFilter {
  return !Array.isArray(from);
}

/** The entry has every field the filter names. `category` is a module type's own field. */
function matches(entity: GatherableEntity, filter: ChooseFilter): boolean {
  const category = (entity as { readonly category?: unknown }).category;
  return (
    (filter.type === undefined || entity.type === filter.type) &&
    (filter.tag === undefined || (entity.tags ?? []).includes(filter.tag)) &&
    (filter.category === undefined || category === filter.category)
  );
}

/** The warning for an id looked up and not found, with where it was given. */
function missing(id: string, from: Origin): GatherWarning {
  return { code: 'missing', id, from, message: `Missing: ${id} (given by ${from}).` };
}

/** A condition's highest level: its `maxLevel`, or 1 when it has no levels. */
function maxLevelOf(entity: GatherableEntity): number {
  const max = (entity as { readonly maxLevel?: unknown }).maxLevel;
  return typeof max === 'number' ? max : 1;
}

/**
 * Gathers what a character has (SPEC §6.1 steps 1–2). `level` is the character's level, which a
 * grant's `atLevel` is measured against; `named` are the entities its module part names, each
 * with its own level when its grants count one. Pure: nothing passed in is changed.
 */
export function gather<E extends GatherableEntity>(
  character: CharacterCore<E>,
  index: ContentIndex<E>,
  level: number,
  named: readonly NamedEntity[],
): Gathered<E> {
  const warnings: GatherWarning[] = [];
  const ruleset = character.ruleset;
  const mixingAllowed = character.allowMixedRulesets;
  const inRulesBase = (entity: E) => entity.ruleset === ANY_RULESET || entity.ruleset === ruleset;
  const usable = (entity: E) => mixingAllowed || inRulesBase(entity);

  // The character's own entities join the index after its packs (item 3 of §3).
  const own = new Map(character.localEntities.map((entity) => [entity.id as string, entity]));
  const get = (id: string): Lookup<E> => {
    const entity = own.get(id);
    return entity === undefined ? index.get(id) : { ok: true, entity };
  };
  const everyEntry = [...index.entities, ...character.localEntities];
  const ownSoFar: E[] = [];
  for (const entity of character.localEntities) {
    if (entity.key !== undefined) {
      const key = entity.key;
      const kept = [...index.withKey(entity.type, key), ...ownSoFar].find(
        (other) =>
          other.type === entity.type &&
          other.key === key &&
          shareRuleset(other.ruleset, entity.ruleset),
      );
      if (kept !== undefined) {
        warnings.push({
          code: 'repeatedKey',
          type: entity.type,
          key,
          entity: entity.id,
          kept: kept.id,
          message: `"${entity.id}" repeats the ${entity.type} key "${key}" of "${kept.id}" in one ruleset; "${kept.id}" is kept.`,
        });
      }
    }
    ownSoFar.push(entity);
  }

  // The walk: depth first, each entity once, with an explicit stack.
  const had = new Map<string, { entity: E; level: number; from: Origin[] }>();
  const grants: ReachedGrant<E>[] = [];
  const proficiencies: ProficiencyGiven[] = [];
  const resources: ResourceGiven[] = [];
  const unmade: ReachedGrant<E>[] = [];
  const roots: Step[] = [
    ...named.map(
      (entity): Step => ({ id: entity.id, level: entity.level ?? level, from: CHARACTER }),
    ),
    ...character.state.conditions.map(
      (condition): Step => ({ id: condition.id, level, from: CHARACTER }),
    ),
  ];
  const stack = roots.reverse();
  for (let step = stack.pop(); step !== undefined; step = stack.pop()) {
    const { id, from } = step;
    const known = had.get(id);
    if (known !== undefined) {
      if (!known.from.includes(from)) known.from.push(from);
      continue;
    }
    const found = get(id);
    if (!found.ok) {
      warnings.push(missing(id, from));
      continue;
    }
    const entity = found.entity;
    had.set(id, { entity, level: step.level, from: [from] });
    if (!inRulesBase(entity)) {
      warnings.push({
        code: 'otherRuleset',
        entity: entity.id,
        ruleset: entity.ruleset,
        mixingAllowed,
        message: `"${entity.id}" is of the ruleset "${entity.ruleset}", not the character's "${ruleset}".`,
      });
    }

    const given: Step[] = [];
    for (const grant of (entity.grants ?? []) as readonly GrantOf<E>[]) {
      if (grant.atLevel !== undefined && grant.atLevel > step.level) continue;
      const part: EntityPartId = `${entity.id}#${grant.id}`;
      const chosen = chosenFor(grant, part);
      const reached = { part, source: entity.id, level: step.level, grant, chosen };
      grants.push(reached);
      const isDistribute = isCoreKind(grant, 'abilityScore') && grant.mode === 'distribute';
      if (
        (grant.choose !== undefined && chosen.length < grant.choose.count) ||
        (isDistribute && chosen.length === 0)
      ) {
        unmade.push(reached);
      }
      if (isCoreKind(grant, 'entity')) {
        for (const each of [...(grant.fixed ?? []), ...chosen]) {
          given.push({ id: each, level: step.level, from: part });
        }
      } else if (isCoreKind(grant, 'proficiency')) {
        for (const key of [...(grant.fixed ?? []), ...chosen]) {
          const { category, level: profLevel } = grant;
          proficiencies.push({
            category,
            key,
            ...(profLevel !== undefined && { level: profLevel }),
            from: part,
          });
        }
      } else if (isCoreKind(grant, 'resource')) {
        resources.push({ key: grant.key, label: grant.label, uses: grant.uses, from: part });
      }
    }
    stack.push(...given.reverse());
  }

  /**
   * The items stored for a grant that is a choice, as used: at most `count`, each warned when
   * not offered. An item of a choice of ids that is not found gives `missing`, and is dropped.
   */
  function chosenFor(grant: GrantView, part: EntityPartId): string[] {
    const stored = character.choices[part] ?? [];
    if (isCoreKind(grant, 'abilityScore') && grant.mode === 'distribute') return [...stored];
    const choose = grant.choose;
    if (choose === undefined) return [];
    if (stored.length > choose.count) {
      warnings.push({
        code: 'tooManyChosen',
        part,
        count: choose.count,
        chosen: stored.length,
        message: `"${part}" asks for ${choose.count}; ${stored.length} are stored, and the first ${choose.count} are used.`,
      });
    }
    const takesKeys = isCoreKind(grant, 'proficiency');
    const keysFound = isFilter(choose.from) ? keysMatching(choose.from) : undefined;
    const used: string[] = [];
    for (const item of stored.slice(0, choose.count)) {
      let offered: boolean;
      if (!isFilter(choose.from)) {
        offered = choose.from.includes(item);
        if (!takesKeys && !get(item).ok) {
          warnings.push(missing(item, part));
          continue;
        }
      } else if (takesKeys) {
        offered = keysFound?.has(item) ?? false;
      } else {
        const found = get(item);
        if (!found.ok) {
          warnings.push(missing(item, part));
          continue;
        }
        offered = matches(found.entity, choose.from);
      }
      if (!offered) {
        warnings.push({
          code: 'notAnOption',
          part,
          item,
          message: `"${item}" is not among the options of "${part}"; it is used.`,
        });
      }
      used.push(item);
    }
    return used;
  }

  /** The keys of the entries a filter finds among those the character can use. */
  function keysMatching(filter: ChooseFilter): Set<string> {
    const keys = new Set<string>();
    for (const entity of everyEntry) {
      if (entity.key !== undefined && usable(entity) && matches(entity, filter)) {
        keys.add(entity.key);
      }
    }
    return keys;
  }

  // The options of each pending choice, now that every entity the character has is known.
  const pendingChoices: PendingChoice<E>[] = unmade.map(({ part, grant, chosen }) => {
    const choose = grant.choose;
    if (choose === undefined) {
      const from =
        isCoreKind(grant, 'abilityScore') && grant.mode === 'distribute' ? grant.from : [];
      return { part, grant, chosen, options: [...from] };
    }
    const takesKeys = isCoreKind(grant, 'proficiency');
    const givesEntities = isCoreKind(grant, 'entity');
    const offered = (item: string) => !chosen.includes(item) && !(givesEntities && had.has(item));
    let options: string[];
    if (!isFilter(choose.from)) {
      options = choose.from.filter((item) => {
        if (takesKeys) return offered(item);
        if (!get(item).ok) {
          warnings.push(missing(item, part));
          return false;
        }
        return offered(item);
      });
    } else if (takesKeys) {
      options = [...keysMatching(choose.from)].filter(offered);
    } else {
      const filter = choose.from;
      options = everyEntry
        .filter((entity) => usable(entity) && matches(entity, filter) && offered(entity.id))
        .map((entity) => entity.id);
    }
    const needed = choose.count - chosen.length;
    if (options.length < needed) {
      warnings.push({
        code: 'fewOptions',
        part,
        needed,
        found: options.length,
        message: `"${part}" needs ${needed} more; ${options.length} can be offered.`,
      });
    }
    return { part, grant, chosen, options };
  });

  // The entry each type and key names: one the character has in its rules base, else one it
  // has, else the rules base's, else the first (ADR 014 item 2). Packs first, own entities after.
  const candidates = new Map<string, Map<string, E[]>>();
  for (const entity of everyEntry) {
    if (entity.key === undefined || !(usable(entity) || had.has(entity.id))) continue;
    const ofType = candidates.get(entity.type) ?? new Map<string, E[]>();
    candidates.set(entity.type, ofType);
    const same = ofType.get(entity.key) ?? [];
    ofType.set(entity.key, same);
    same.push(entity);
  }
  const byKey: Record<string, Record<string, E>> = {};
  for (const [type, ofType] of candidates) {
    const keyed: Record<string, E> = {};
    for (const [key, entries] of ofType) {
      const pick =
        entries.find((entity) => had.has(entity.id) && inRulesBase(entity)) ??
        entries.find((entity) => had.has(entity.id)) ??
        entries.find(inRulesBase) ??
        entries[0];
      if (pick !== undefined) keyed[key] = pick;
    }
    byKey[type] = keyed;
  }

  // Each condition key's level: 0 when not had; the stored level, else 1, up to its maximum.
  const stored = new Map(character.state.conditions.map((condition) => [condition.id, condition]));
  const conditions: Record<string, ConditionLevel> = {};
  for (const [key, entity] of Object.entries(byKey[CONDITION_TYPE] ?? {})) {
    let conditionLevel = 0;
    if (had.has(entity.id)) {
      const max = maxLevelOf(entity);
      conditionLevel = stored.get(entity.id)?.level ?? 1;
      if (conditionLevel > max) {
        warnings.push({
          code: 'conditionLevel',
          entity: entity.id,
          level: conditionLevel,
          max,
          message: `"${entity.id}" is stored at level ${conditionLevel}; its highest is ${max}, which is used.`,
        });
        conditionLevel = max;
      }
    }
    conditions[key] = { id: entity.id, level: conditionLevel };
  }

  return {
    entities: [...had.values()],
    grants,
    proficiencies,
    resources,
    pendingChoices,
    byKey,
    conditions,
    warnings,
  };
}
