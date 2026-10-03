import { type ActionResult, changeTo, type LogStamp } from '@grimoire/engine';
import { INSPIRATION_PATH, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';

// ENG-59: inspiration is gained or spent one at a time, each one log entry (ADR 014 item 10). The
// most a character holds is the house rules' `inspirationMax`, the owner's 3 by default (ADR 009
// item 5); the SRDs' 1 is `rulesOf(...).inspiration.max`, which the screen shows next to it.
// Inspiration gained at the maximum is lost (SRD 5.2.1; SRD 5.1 "you can't stockpile", ENG-19 §8),
// so it changes nothing. What spending it does to a roll is `rulesOf(...).inspiration.use`.

/** What gaining or spending inspiration gives: the changed character and its entry, or why not. */
export type InspirationResult = ActionResult<FifthEditionCharacter, Unchanged>;

/** The character holding `count` inspiration, as one entry of `action`. */
function inspired(
  character: FifthEditionCharacter,
  stamp: LogStamp,
  action: string,
  count: number,
  unchanged: string,
): InspirationResult {
  const changes = [changeTo(character, INSPIRATION_PATH, count)];
  return settled<never>(character, stamp, { action, subject: 'inspiration', changes }, unchanged);
}

/**
 * The character with one more inspiration, and the entry. Refused as `unchanged` at the house
 * rules' `inspirationMax`: the inspiration gained is lost.
 */
export function gainInspiration(
  character: FifthEditionCharacter,
  stamp: LogStamp,
): InspirationResult {
  const held = character.systemData.state.inspiration;
  const max = character.systemData.houseRules.inspirationMax;
  return inspired(
    character,
    stamp,
    'gainInspiration',
    Math.max(held, Math.min(max, held + 1)),
    `The character holds its maximum of ${max} inspiration: the one gained is lost.`,
  );
}

/** The character with one inspiration fewer, and the entry. Refused as `unchanged` at none. */
export function spendInspiration(
  character: FifthEditionCharacter,
  stamp: LogStamp,
): InspirationResult {
  const held = character.systemData.state.inspiration;
  return inspired(
    character,
    stamp,
    'spendInspiration',
    Math.max(0, held - 1),
    'The character has no inspiration to spend.',
  );
}
