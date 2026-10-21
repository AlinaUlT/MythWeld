import { CONDITION_TYPE, type EntityFinder, maxLevelOf } from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// ENG-67: exhaustion at level 6 is death, in both SRDs (one rule; ENG-67 §8). The rule is the
// module's, as dnd5e's is its code's (`conditionTypes.exhaustion.conditions: { 6: ["dead"] }`):
// the condition is the stored one whose entry has the key `exhaustion`, found through the
// character's finder, and its level is the stored one up to the entry's highest, as gathering
// reads `@conditions.exhaustion.level`. Nothing is stored: `isDead` reads it, so every action that
// refuses the dead refuses it, and undoing the level that killed brings the character back.

/** The key of the condition whose level can kill (ENG-67 §8). */
export const EXHAUSTION_CONDITION = 'exhaustion';

/** The exhaustion level a creature dies at, in both SRDs (ENG-67 §8). */
export const EXHAUSTION_DEATH_LEVEL = 6;

/**
 * The stored condition that kills the character: its entry has the key `exhaustion`, and its level,
 * stored or 1, up to the entry's highest, is 6 or more. `undefined` when none does; a stored id no
 * entry has is none.
 */
export function fatalExhaustion(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): EntityId | undefined {
  for (const { id, level = 1 } of character.state.conditions) {
    const entity = find(id);
    if (entity?.type !== CONDITION_TYPE || entity.key !== EXHAUSTION_CONDITION) continue;
    if (Math.min(level, maxLevelOf(entity)) >= EXHAUSTION_DEATH_LEVEL) return entity.id;
  }
  return undefined;
}
