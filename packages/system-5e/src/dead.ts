import { type ContentIndex, compute, type EntityFinder, finderOf } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';
import { applyingFinder } from './unconscious';

// SHEET-64: exhaustion the character is immune to does not kill (SHEET-61 §8: immunity "doesn't
// affect you in any way"). Whether it is immune comes from `compute()`, so an action that refuses
// the dead reads them through the finder of one `compute()`: it does not find what was withheld.

/**
 * How an action finds the character's entries when it asks whether the character is dead, down
 * or knocked out (`isDead`): as `finderOf` does, but an entry `compute()` withholds is not found.
 */
export function applyingFinderOf(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
): EntityFinder<FifthEditionEntity> {
  const { withheld = [] } = compute(character, index, fifthEditionModule);
  return applyingFinder(
    finderOf(character, index),
    new Set(withheld.map(({ entity }) => entity.id)),
  );
}
