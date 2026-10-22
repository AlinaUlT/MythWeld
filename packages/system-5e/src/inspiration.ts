import { type ActionResult, changeTo, type DerivedStep, type LogStamp } from '@grimoire/engine';
import type { LogChange } from '@grimoire/schema';
import { INSPIRATION_PATH, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import { zeroStep } from './checks';

// ENG-59: inspiration is gained or spent one at a time, each one log entry, up to the house
// rules' maximum: the bound the stored shape checks (ENG-33). The edition's own maximum,
// `rulesOf(...).inspiration.max`, is what the screen shows beside it (ADR 009 item 5); what
// spending does to a roll is the screen's, by `inspiration.use`.
// ENG-64: the inspiration a long rest gives is `inspiration.longRest`, a target for effects every
// character has, 0 until an effect adds to it (SRD 5.2.1's human, Resourceful: 1). The rest gains
// it in its one entry, up to the same maximum; what is over it is lost, as SRD 5.2.1's Heroic
// Inspiration says. The rules are ENG-64 §8's.

/** The inspiration a long rest gives: 0 until an effect changes it. */
export const INSPIRATION_LONG_REST_PATH = 'inspiration.longRest';

/** `inspiration.longRest`: 0 until an effect changes it. */
export function inspirationSteps(): Record<string, DerivedStep> {
  return { [INSPIRATION_LONG_REST_PATH]: zeroStep };
}

/**
 * The change a long rest makes to the inspiration held, given the number `inspiration.longRest`
 * computed: that many more, counted whole, up to the house rules' maximum
 * (`houseRules.inspirationMax`). None when that is no more than the character holds: a rest never
 * takes inspiration away.
 */
export function inspirationRested(character: FifthEditionCharacter, gives: number): LogChange[] {
  const { houseRules, state } = character.systemData;
  const after = Math.min(houseRules.inspirationMax, state.inspiration + Math.floor(gives));
  return after > state.inspiration ? [changeTo(character, INSPIRATION_PATH, after)] : [];
}

/** Why inspiration was not gained or spent. `code` and its data are for the screen. */
export type InspirationRefusal = { message: string } & (
  | { code: 'atMax'; max: number }
  | { code: 'noInspiration' }
);

/** The inspiration change an action makes, as one entry of `action`. */
function inspired(
  character: FifthEditionCharacter,
  stamp: LogStamp,
  action: string,
  after: number,
): ActionResult<FifthEditionCharacter, InspirationRefusal | Unchanged> {
  const changes = [changeTo(character, INSPIRATION_PATH, after)];
  return settled<InspirationRefusal>(
    character,
    stamp,
    { action, subject: 'inspiration', changes },
    'The inspiration changes nothing.',
  );
}

/**
 * The character with one more inspiration, and the entry. Refused at the house rules' maximum
 * (`houseRules.inspirationMax`): what the rules do with inspiration gained then is the screen's
 * to say.
 */
export function gainInspiration(
  character: FifthEditionCharacter,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, InspirationRefusal | Unchanged> {
  const { houseRules, state } = character.systemData;
  const max = houseRules.inspirationMax;
  if (state.inspiration >= max) {
    const message = `The character holds ${state.inspiration} inspiration, the maximum of ${max}.`;
    return { ok: false, code: 'atMax', max, message };
  }
  return inspired(character, stamp, 'gainInspiration', state.inspiration + 1);
}

/** The character with one inspiration spent, and the entry. Refused when it holds none. */
export function spendInspiration(
  character: FifthEditionCharacter,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, InspirationRefusal | Unchanged> {
  const held = character.systemData.state.inspiration;
  if (held === 0) {
    return { ok: false, code: 'noInspiration', message: 'The character holds no inspiration.' };
  }
  return inspired(character, stamp, 'spendInspiration', held - 1);
}
