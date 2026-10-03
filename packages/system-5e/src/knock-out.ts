import {
  type ActionResult,
  type ContentIndex,
  type EntityFinder,
  finderOf,
  type LogStamp,
} from '@grimoire/engine';
import { knockOutEnded, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import { isDead } from './death-saves';
import type { FifthEditionEntity } from './entity-types';

// ENG-65: SRD 5.2.1's knocking out (ENG-65 §8). Damage that would drop a creature to 0 hit points
// with a melee attack may leave it at 1 instead, with the Unconscious condition (`applyDamage`'s
// `knockOut`). At 1 hit point nothing derives the condition, so the knock-out is stored, as
// `state.knockedOut`: `compute()` names the condition from it (`unconscious.ts`). It ends at the
// end of the short rest it started (chapter 1's end, ENG-65 §4), unless damage interrupted that
// rest; when the creature regains any hit points (`knockOutEnded`); and with first aid.

/** Why first aid did not happen. `code` is for the screen. */
export type FirstAidRefusal = { message: string } & ({ code: 'dead' } | { code: 'notKnockedOut' });

/**
 * The character is knocked out, and alive: the dead have no condition (ENG-62), at exhaustion 6
 * too (ENG-67), which `find` gives the entry of.
 */
export function isKnockedOut(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): boolean {
  return character.systemData.state.knockedOut !== undefined && !isDead(character, find);
}

/**
 * The knocked-out character after someone administers first aid to it, a successful DC 10 Wisdom
 * (Medicine) check the screen records, and the entry: the knock-out ends. At 0 hit points the
 * character stays unconscious, for the 0 hit points; their first aid is `stabilize`. Refused for
 * a dead character (exhaustion 6 included, which `index` gives the entry of) and for one that is
 * not knocked out.
 */
export function firstAid(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, FirstAidRefusal | Unchanged> {
  const find = finderOf(character, index);
  if (isDead(character, find)) {
    return { ok: false, code: 'dead', message: 'The character is dead.' };
  }
  if (!isKnockedOut(character, find)) {
    return { ok: false, code: 'notKnockedOut', message: 'The character is not knocked out.' };
  }
  return settled<FirstAidRefusal>(
    character,
    stamp,
    { action: 'firstAid', subject: 'knockedOut', changes: knockOutEnded(character) },
    'The character is not knocked out.',
  );
}
