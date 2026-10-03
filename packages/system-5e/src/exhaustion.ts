import { CONDITION_TYPE, type EntityFinder, maxLevelOf } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// ENG-67: at exhaustion 6 a fifth-edition character is dead (both SRDs, one rule; ENG-67 §8). The
// condition is a pack's entry, found by its key as `@conditions.exhaustion.level` reads it, and
// its level is read from the stored conditions through a finder, so `isDead` reads it inside
// `compute()` (before gathering, for `isDown`) and in every action alike. Nothing is stored.

/** The key of the condition whose 6th level is death (ENG-67 §8). */
export const EXHAUSTION_CONDITION = 'exhaustion';

/** The exhaustion level a creature dies at, in both SRDs. */
export const EXHAUSTION_DEATH_LEVEL = 6;

/**
 * The character's exhaustion level: the highest of its stored conditions whose entry is a
 * condition of the key `exhaustion`, each at its stored level (1 when none) up to its entry's
 * maximum, as gathering reads it; 0 when it has none. A stored id no entry has counts for nothing.
 */
export function exhaustionLevel(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): number {
  let level = 0;
  for (const stored of character.state.conditions) {
    const entity = find(stored.id);
    if (entity?.type !== CONDITION_TYPE || entity.key !== EXHAUSTION_CONDITION) continue;
    level = Math.max(level, Math.min(stored.level ?? 1, maxLevelOf(entity)));
  }
  return level;
}
