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
import { isKnockedOut } from './knock-out';

// ENG-62: at 0 hit points and alive, a fifth-edition character has the Unconscious condition, until
// it regains hit points; a stable one keeps it (both SRDs, one rule; ENG-62 §8). The condition is
// a pack's entry, found by its key as `@conditions.unconscious.level` reads it, and `compute()`
// gives it from the stored hit points: no action stores it, so every change of the hit points
// (damage, healing, a rest, a revival, undo) keeps it right. With no entry in reach, a warning.
// ENG-65: a knocked-out character has it too, at 1 hit point, from its stored mark (`knock-out.ts`).

/** The key of the condition a character at 0 hit points has (ENG-62 §8). */
export const UNCONSCIOUS_CONDITION = 'unconscious';

/** The character is down: at 0 hit points and alive, dying or stable. */
export function isDown(character: FifthEditionCharacter): boolean {
  return character.systemData.state.hp.current === 0 && !isDead(character);
}

/** The character has the Unconscious condition by a rule: down, or knocked out. */
function ruledUnconscious(character: FifthEditionCharacter): boolean {
  return isDown(character) || isKnockedOut(character);
}

/** The Unconscious condition's entry while a rule gives it, when the character can use one. */
export function unconsciousNamed(
  character: FifthEditionCharacter,
  findKey: KeyFinder<FifthEditionEntity>,
): NamedEntity[] {
  if (!ruledUnconscious(character)) return [];
  const entry = findKey(CONDITION_TYPE, UNCONSCIOUS_CONDITION);
  return entry === undefined ? [] : [{ id: entry.id }];
}

/** The warning that a rule gives the Unconscious condition, and no entry is there to give. */
export function unconsciousWarnings({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): RuleWarning[] {
  if (
    !ruledUnconscious(character) ||
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
