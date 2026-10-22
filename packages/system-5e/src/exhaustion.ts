import { CONDITION_TYPE, type EntityFinder, maxLevelOf } from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// ENG-67: exhaustion's highest level is death, in both SRDs (SRD 5.1's table, "6 - Death"; SRD
// 5.2.1, "You die if your Exhaustion level is 6"; ENG-67 §8). The condition is found by its key,
// as ENG-62's Unconscious is; its highest level is its entry's `maxLevel`, so the number is the
// pack's data, not the code's. Nothing is stored: the stored level decides, so lowering it (a
// revival, a spell, undo) ends the death. `isDead` reads it, so every action refuses as for three
// failed death saves.

/** The key of the condition whose highest level is death (ENG-67 §8). */
export const EXHAUSTION_CONDITION = 'exhaustion';

/**
 * The stored exhaustion at its entry's highest level, by its id: the character died of it.
 * `undefined` when there is none: no stored condition of the key, one whose entry has no levels,
 * one below its highest, or one no entry matches. A level stored above the highest counts as it,
 * as gathering reads it.
 */
export function fatalExhaustion(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): EntityId | undefined {
  for (const stored of character.state.conditions) {
    const entry = find(stored.id);
    if (entry?.type !== CONDITION_TYPE || entry.key !== EXHAUSTION_CONDITION) continue;
    const max = maxLevelOf(entry);
    if (max > 1 && (stored.level ?? 1) >= max) return entry.id;
  }
  return undefined;
}
