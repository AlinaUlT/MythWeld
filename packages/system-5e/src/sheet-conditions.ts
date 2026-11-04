import {
  CONDITION_TYPE,
  type Computed,
  type ContentIndex,
  type EntityFinder,
  maxLevelOf,
} from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { EXHAUSTION_CONDITION } from './exhaustion';

// SHEET-42: what the sheet names of a fifth-edition character's conditions (SPEC §7.2): the ones it
// stores (the person sets or ends them) and the ones it has without storing them (a rule or another
// entry gives them: Unconscious at 0 hit points, a condition a feature grants). A stored condition
// whose entry no pack holds is "missing", and one `compute()` withholds (the character is immune to
// it) has no effect (SHEET-61); both can still be ended. Exhaustion at its highest level is death
// in both editions (ENG-67): it gives no number, and the row says so.

/** A condition the character has, or stores. */
export interface ConditionShown {
  id: EntityId;
  /** The level it has: 1 for a condition with no levels. */
  level: number;
  /** Its highest level; 1 for a condition with no levels. */
  max: number;
  /** The person set it, so the person can change or end it. */
  stored: boolean;
  /** The entries that give it, when it is not stored; none when a rule of the module does. */
  givenBy: readonly EntityId[];
  /** `compute()` leaves it out: the character is immune to it, so it has no effect (SHEET-61). */
  withheld: boolean;
  /** The level it has is death (ENG-67). */
  fatal: boolean;
}

export interface ConditionsShown {
  /** The conditions the character has now: the stored ones in their order, then the given ones. */
  had: readonly ConditionShown[];
  /** The stored conditions no pack or own entry holds. */
  missing: readonly EntityId[];
}

/** A condition's level at which it is death: exhaustion's highest; none for any other. */
export function fatalLevelOf(entity: FifthEditionEntity): number | undefined {
  const max = maxLevelOf(entity);
  return entity.type === CONDITION_TYPE && entity.key === EXHAUSTION_CONDITION && max > 1
    ? max
    : undefined;
}

/**
 * Each condition the character has, read from `compute()`: the stored ones first, in the order
 * they are stored, then the ones given. `find` is the character's finder (its own entries first).
 */
export function fifthEditionConditions(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
  find: EntityFinder<FifthEditionEntity>,
): ConditionsShown {
  const stored = character.state.conditions;
  const had = new Map<string, (typeof computed.entities)[number]>(
    computed.entities.map((one) => [one.entity.id, one]),
  );
  const withheld = new Set((computed.withheld ?? []).map(({ entity }) => entity.id));
  const shown: ConditionShown[] = [];
  const missing: EntityId[] = [];
  const shownOf = (
    entity: FifthEditionEntity,
    level: number,
    isStored: boolean,
    givenBy: readonly EntityId[],
  ): ConditionShown => {
    const max = maxLevelOf(entity);
    const at = Math.min(Math.max(level, 1), max);
    const out = withheld.has(entity.id);
    return {
      id: entity.id,
      level: at,
      max,
      stored: isStored,
      givenBy,
      withheld: out,
      fatal: !out && fatalLevelOf(entity) === at,
    };
  };
  for (const { id, level } of stored) {
    const entity = find(id);
    if (entity === undefined || entity.type !== CONDITION_TYPE) {
      missing.push(id);
      continue;
    }
    shown.push(shownOf(entity, level ?? 1, true, []));
  }
  const storedIds = new Set(stored.map(({ id }) => id));
  for (const { entity, from } of had.values()) {
    if (entity.type !== CONDITION_TYPE || storedIds.has(entity.id)) continue;
    const key = entity.key;
    const level = key === undefined ? 1 : (computed.conditions[key]?.level ?? 1);
    // An origin is the character's own, or `<entity id>#<part>`: what gives it is a had entity.
    const givenBy = from.flatMap((origin) => {
      const owner = had.get(origin.split('#')[0] ?? '')?.entity.id;
      return owner === undefined || owner === entity.id ? [] : [owner];
    });
    shown.push(shownOf(entity, level, false, [...new Set(givenBy)]));
  }
  return { had: shown, missing };
}

/**
 * The conditions the person can add: every condition entry of the packs and of the character's
 * own entries that it does not store yet, own entries first, then the packs' in load order.
 */
export function conditionsToAdd(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
): FifthEditionEntity[] {
  const stored = new Set(character.state.conditions.map(({ id }) => id));
  const own = character.localEntities.filter((entity) => entity.type === CONDITION_TYPE);
  const ownIds = new Set(own.map(({ id }) => id));
  const packs = index.entities.filter(
    (entity) => entity.type === CONDITION_TYPE && !ownIds.has(entity.id),
  );
  return [...own, ...packs].filter(({ id }) => !stored.has(id));
}
