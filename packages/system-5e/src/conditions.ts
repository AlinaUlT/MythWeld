import {
  type ActionResult,
  type ContentIndex,
  finderOf,
  type LogStamp,
  setCondition,
  type TrackerRefusal,
} from '@grimoire/engine';
import { deathChanges, settled } from './actions';
import type { FifthEditionCharacter } from './character';
import { isDead } from './death-saves';
import type { FifthEditionEntity } from './entity-types';

// ENG-69: fifth edition's condition action, around the core's `setCondition`, which names no death.
// A level that kills (exhaustion 6, ENG-67) makes death's other changes (`deathChanges`: the
// concentration and every attunement end) in the one entry that sets the level, so undoing it
// brings all of it back. A fifth-edition character's screen calls this one; the core's stays as
// it is for a system without death.

/**
 * Gives the character the condition `id` at `level` (1 when not given), or sets the level of one
 * it has, as the core's `setCondition` does, in an entry of its action key, subject and label.
 * When the character was alive and the new level kills it (`isDead`), the entry also makes
 * death's other changes (`deathChanges`). Refused as the core's action is.
 */
export function setFifthEditionCondition(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { id: string; level?: number },
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter> {
  const set = setCondition(character, index, ask, stamp);
  if (!set.ok) return set;
  // Setting a condition changes no entity of the character's own: one finder reads both.
  const find = finderOf(character, index);
  if (isDead(character, find) || !isDead(set.character, find)) return set;
  const { action, subject, label, changes } = set.entry;
  return settled<TrackerRefusal>(
    character,
    stamp,
    { action, subject, label, changes: [...changes, ...deathChanges(character)] },
    `${action} changes nothing.`,
  );
}
