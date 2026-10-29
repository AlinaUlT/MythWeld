import { type ActionResult, type ContentIndex, changeTo, type LogStamp } from '@grimoire/engine';
import { KNOCKED_OUT_PATH, knockOutEnded, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import { applyingFinderOf } from './dead';
import type { FifthEditionEntity } from './entity-types';
import { isDead, isKnockedOut } from './unconscious';

// ENG-65: SRD 5.2.1's knocking out (ENG-65 §8). Damage that would drop a creature to 0 hit points
// with a melee attack may leave it at 1 instead, with the Unconscious condition (`applyDamage`'s
// `knockOut`). At 1 hit point nothing derives the condition, so the knock-out is stored, as
// `state.knockedOut`: `compute()` names the condition from it (`unconscious.ts`). It ends at the
// end of the short rest it started (chapter 1's end, ENG-65 §4), unless damage interrupted that
// rest; when the creature regains any hit points (`knockOutEnded`); and with first aid.
// SHEET-19: rolling initiative interrupts that rest too (`rollInitiative`), as damage does.

/** Why first aid did not happen. `code` is for the screen. */
export type FirstAidRefusal = { message: string } & ({ code: 'dead' } | { code: 'notKnockedOut' });

/**
 * The knocked-out character after someone administers first aid to it, a successful DC 10 Wisdom
 * (Medicine) check the screen records, and the entry: the knock-out ends. At 0 hit points the
 * character stays unconscious, for the 0 hit points; their first aid is `stabilize`. Refused for
 * a dead character and for one that is not knocked out.
 */
export function firstAid(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, FirstAidRefusal | Unchanged> {
  const find = applyingFinderOf(character, index);
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

/** Why rolling initiative was not recorded. `code` is for the screen. */
export type InitiativeRefusal = { message: string; code: 'dead' };

/**
 * The character after it rolls initiative, and the entry: a knock-out's short rest is interrupted
 * (SRD 5.2.1, Short Rest: "Rolling Initiative"), so only hit points or first aid end it. The roll
 * itself is the roll log's; the roll dialog calls this after every initiative roll. Refused for a
 * dead character, and as `unchanged` when no knock-out is resting.
 */
export function rollInitiative(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, InitiativeRefusal | Unchanged> {
  if (isDead(character, applyingFinderOf(character, index))) {
    return { ok: false, code: 'dead', message: 'The character is dead.' };
  }
  const mark = character.systemData.state.knockedOut;
  const after = mark === 'resting' ? 'interrupted' : mark;
  return settled<InitiativeRefusal>(
    character,
    stamp,
    {
      action: 'rollInitiative',
      subject: 'knockedOut',
      changes: [changeTo(character, KNOCKED_OUT_PATH, after)],
    },
    'No knock-out is resting.',
  );
}
