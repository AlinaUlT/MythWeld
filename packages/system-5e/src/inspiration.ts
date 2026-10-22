import {
  type ActionResult,
  changeTo,
  type DerivedStep,
  type FormulaValue,
  type LogStamp,
} from '@grimoire/engine';
import type { LogChange } from '@grimoire/schema';
import { INSPIRATION_PATH, settled, type Unchanged, whole } from './actions';
import type { FifthEditionCharacter } from './character';
import { zeroStep } from './checks';

// ENG-59: inspiration is gained or spent one at a time, each one log entry, up to the house
// rules' maximum: the bound the stored shape checks (ENG-33). The edition's own maximum,
// `rulesOf(...).inspiration.max`, is what the screen shows beside it (ADR 009 item 5); what
// spending does to a roll is the screen's, by `inspiration.use`.
// ENG-64: a long rest gives the inspiration `inspiration.longRest` holds, a target for effects
// every character has, 0 until one adds to it: SRD 5.2.1's human, Resourceful, "You gain Heroic
// Inspiration whenever you finish a Long Rest", is one `add 1`. Rounded down, never below 0, up to
// the house rules' maximum; what goes past it is counted for the screen, which says the rule's
// words ("it's lost unless you give it to a player character who lacks it"). The rules are ENG-64
// §8's.

/** The inspiration a long rest gives (ENG-64): 0 until an effect adds to it. */
export const INSPIRATION_LONG_REST_PATH = 'inspiration.longRest';

/** `inspiration.longRest`: 0 until an effect changes it. */
export function inspirationSteps(): Record<string, DerivedStep> {
  return { [INSPIRATION_LONG_REST_PATH]: zeroStep };
}

/**
 * What a rest gives of inspiration: the change to the inspiration held, and the count that goes
 * past the maximum.
 */
export interface InspirationGiven {
  changes: LogChange[];
  over: number;
}

/**
 * The inspiration `given` adds to what the character holds, rounded down and never below 0, up to
 * the house rules' maximum (`houseRules.inspirationMax`); `over` is what does not fit.
 */
export function inspirationGiven(
  character: FifthEditionCharacter,
  given: FormulaValue | undefined,
): InspirationGiven {
  const { houseRules, state } = character.systemData;
  const offered = state.inspiration + whole(given);
  const after = Math.min(houseRules.inspirationMax, offered);
  return { changes: [changeTo(character, INSPIRATION_PATH, after)], over: offered - after };
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
