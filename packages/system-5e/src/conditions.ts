import {
  type ActionResult,
  type ContentIndex,
  finderOf,
  type LogStamp,
  setCondition,
} from '@grimoire/engine';
import { deathChanges, settled } from './actions';
import type { FifthEditionCharacter } from './character';
import { isDead } from './death-saves';
import type { FifthEditionEntity } from './entity-types';

// ENG-69: fifth edition sets a condition's level through the core's `setCondition`, and a level
// that kills (exhaustion at its highest, ENG-67) ends every attunement in the same entry, as
// damage and the third failed death save do (ENG-63). The core runs no module code, so the death
// is the module's to see: alive before the action, dead after it. A level that does not kill gives
// the core's result as it is.

/**
 * Gives the character the condition `ask.id` at `ask.level` (1 when not given), or sets the level
 * of one it has: the core's `setCondition`, with its refusals. When that level kills a character
 * that was alive, the entry also ends every attunement (`deathChanges`).
 */
export function setConditionLevel(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly id: string; readonly level?: number },
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter> {
  const set = setCondition(character, index, ask, stamp);
  if (!set.ok) return set;
  const find = finderOf(character, index);
  if (isDead(character, find) || !isDead(set.character, find)) return set;
  const { action, subject, label, changes } = set.entry;
  return settled(
    character,
    stamp,
    { action, subject, label, changes: [...changes, ...deathChanges(character)] },
    `${action} changes nothing.`,
  );
}
