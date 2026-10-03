import {
  CONDITION_TYPE,
  type DeriveInput,
  type KeyFinder,
  type NamedEntity,
  type RuleWarning,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { isDead } from './death-saves';
import type { FifthEditionEntity } from './entity-types';

// ENG-62: at 0 hit points and alive, a fifth-edition character has the Unconscious condition, until
// it regains hit points; a stable one keeps it (both SRDs, one rule; ENG-62 §8). The condition is
// a pack's entry, found by its key as `@conditions.unconscious.level` reads it, and `compute()`
// gives it from the stored hit points: no action stores it, so every change of the hit points
// (damage, healing, a rest, a revival, undo) keeps it right. With no entry in reach, a warning.

/** The key of the condition a character at 0 hit points has (ENG-62 §8). */
export const UNCONSCIOUS_CONDITION = 'unconscious';

/** The character is down: at 0 hit points and alive, dying or stable. */
export function isDown(character: FifthEditionCharacter): boolean {
  return character.systemData.state.hp.current === 0 && !isDead(character);
}

/** The Unconscious condition's entry while the character is down, when it can use one. */
export function unconsciousNamed(
  character: FifthEditionCharacter,
  findKey: KeyFinder<FifthEditionEntity>,
): NamedEntity[] {
  if (!isDown(character)) return [];
  const entry = findKey(CONDITION_TYPE, UNCONSCIOUS_CONDITION);
  return entry === undefined ? [] : [{ id: entry.id }];
}

/** The warning that the character is down with no Unconscious condition to give it. */
export function unconsciousWarnings({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): RuleWarning[] {
  if (!isDown(character) || (gathered.conditions[UNCONSCIOUS_CONDITION]?.level ?? 0) > 0) {
    return [];
  }
  return [
    {
      rule: 'noUnconsciousCondition',
      data: { key: UNCONSCIOUS_CONDITION },
      message: `At 0 hit points the character is unconscious, but no condition it can use has the key "${UNCONSCIOUS_CONDITION}".`,
    },
  ];
}
