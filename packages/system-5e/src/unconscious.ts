import {
  CONDITION_TYPE,
  type DeriveInput,
  type EntityFinder,
  type KeyFinder,
  type NamedEntity,
  type RuleWarning,
} from '@grimoire/engine';
import { DEATH_SAVES, type FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fatalExhaustion } from './exhaustion';

// ENG-62: at 0 hit points and alive, a fifth-edition character has the Unconscious condition, until
// it regains hit points; a stable one keeps it (both SRDs, one rule; ENG-62 §8). The condition is
// a pack's entry, found by its key as `@conditions.unconscious.level` reads it, and `compute()`
// gives it from the stored hit points: no action stores it, so every change of the hit points
// (damage, healing, a rest, a revival, undo) keeps it right. With no entry in reach, a warning.
// ENG-65: a knocked-out character has it too, at 1 hit point, from its stored mark (`knock-out.ts`).
// ENG-67: a character dead of exhaustion has neither (`isDead`).
// SHEET-64: exhaustion the character is immune to kills no one, so `isDead` reads the stored
// conditions through a finder that does not find what `compute()` withholds (`applyingFinder`):
// inside `compute()`, the ids its pass leaves out; in an action, those of a full `compute()`
// (`dead.ts`). `isDead` and `isKnockedOut` live here, beside the module's reading of them, so the
// module imports no action.

/**
 * How `isDead` finds the character's entries that apply: as `find` does, but an id `withheld`
 * names is not found, as a condition the character is immune to has no effect (SHEET-61).
 */
export function applyingFinder(
  find: EntityFinder<FifthEditionEntity>,
  withheld: ReadonlySet<string>,
): EntityFinder<FifthEditionEntity> {
  return withheld.size === 0 ? find : (id) => (withheld.has(id) ? undefined : find(id));
}

/**
 * The character is dead: at 0 hit points with 3 death save failures (ENG-20), or with exhaustion
 * at its highest level, whatever its hit points (ENG-67). `find` looks its stored conditions up:
 * an action's `applyingFinderOf` leaves out exhaustion the character is immune to (SHEET-64).
 */
export function isDead(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): boolean {
  const { hp, deathSaves } = character.systemData.state;
  return (
    (hp.current === 0 && deathSaves.failure >= DEATH_SAVES) ||
    fatalExhaustion(character, find) !== undefined
  );
}

/** The character is knocked out, and alive: the dead have no condition (ENG-62, ENG-65). */
export function isKnockedOut(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): boolean {
  return character.systemData.state.knockedOut !== undefined && !isDead(character, find);
}

/** The key of the condition a character at 0 hit points has (ENG-62 §8). */
export const UNCONSCIOUS_CONDITION = 'unconscious';

/** The character is down: at 0 hit points and alive, dying or stable. */
export function isDown(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): boolean {
  return character.systemData.state.hp.current === 0 && !isDead(character, find);
}

/** The character has the Unconscious condition by a rule: down, or knocked out. */
function ruledUnconscious(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): boolean {
  return isDown(character, find) || isKnockedOut(character, find);
}

/**
 * The Unconscious condition's entry while a rule gives it, when the character can use one.
 * `without` is what this pass of `compute()` leaves out (SHEET-64).
 */
export function unconsciousNamed(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  findKey: KeyFinder<FifthEditionEntity>,
  without: ReadonlySet<string>,
): NamedEntity[] {
  if (!ruledUnconscious(character, applyingFinder(find, without))) return [];
  const entry = findKey(CONDITION_TYPE, UNCONSCIOUS_CONDITION);
  return entry === undefined ? [] : [{ id: entry.id }];
}

/**
 * The warning that a rule gives the Unconscious condition, and no entry is there to give. An entry
 * left out because the character is immune to it is there (SHEET-61): it warns that instead.
 */
export function unconsciousWarnings({
  character,
  gathered,
  find,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): RuleWarning[] {
  const left = (gathered.withheld ?? []).map(({ entity }) => entity);
  const withheld = left.some(
    ({ type, key }) => type === CONDITION_TYPE && key === UNCONSCIOUS_CONDITION,
  );
  if (
    !ruledUnconscious(character, applyingFinder(find, new Set(left.map(({ id }) => id)))) ||
    withheld ||
    (gathered.conditions[UNCONSCIOUS_CONDITION]?.level ?? 0) > 0
  ) {
    return [];
  }
  return [
    {
      rule: 'noUnconsciousCondition',
      data: { key: UNCONSCIOUS_CONDITION },
      message: `The character is unconscious (at 0 hit points, or knocked out), but no condition it can use has the key "${UNCONSCIOUS_CONDITION}".`,
    },
  ];
}
