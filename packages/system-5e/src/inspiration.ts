import { type ActionResult, changeTo, type LogStamp } from '@grimoire/engine';
import { INSPIRATION_PATH, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';

// ENG-59: inspiration is gained or spent one at a time, each one log entry, up to the house
// rules' maximum: the bound the stored shape checks (ENG-33). The edition's own maximum,
// `rulesOf(...).inspiration.max`, is what the screen shows beside it (ADR 009 item 5); what
// spending does to a roll is the screen's, by `inspiration.use`.

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
