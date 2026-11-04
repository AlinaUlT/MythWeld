import { type ActionResult, changeTo, type LogStamp } from '@grimoire/engine';
import { settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import { COINS } from './system';

// SHEET-51: the character's money (SPEC §7.2, "coins with quick +/−"): the five coins, each a
// whole count from 0 (`systemData.currency`, ENG-33), changed by a step up or down. A step that
// would take a count below 0 is refused, and nothing is written; no coin is converted into
// another: a person trades by hand. Each step is one
// entry, so one Undo reverses it.

/** One coin of the Gear tab: its key and how many the character holds. */
export interface CoinShown {
  coin: (typeof COINS)[number];
  amount: number;
}

/** The Gear tab's money: the coins from the lowest, and the steps a person takes, smallest first. */
export interface CoinsShown {
  coins: CoinShown[];
  steps: readonly number[];
}

/** The steps the sheet offers beside each coin: a + and a − of each. */
export const COIN_STEPS = [1, 10] as const;

export function fifthEditionCoins(character: FifthEditionCharacter): CoinsShown {
  return {
    coins: COINS.map((coin) => ({ coin, amount: character.systemData.currency[coin] })),
    steps: COIN_STEPS,
  };
}

/** What a coin change is asked: the coin, and the step, up when positive, down when negative. */
export interface CoinAsk {
  readonly coin: (typeof COINS)[number];
  readonly step: number;
}

/** Why a coin change was refused. `code` and its data are for the screen. */
export type CoinRefusal = { message: string } & (
  | { code: 'badStep'; step: number }
  | { code: 'notEnough'; coin: string; held: number; step: number }
);

/** The character with `ask.step` coins more of `ask.coin` (fewer when negative), and the entry. */
export function changeCoin(
  character: FifthEditionCharacter,
  ask: CoinAsk,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, CoinRefusal | Unchanged> {
  if (!Number.isSafeInteger(ask.step)) {
    return {
      ok: false,
      code: 'badStep',
      step: ask.step,
      message: `${ask.step} is not a whole number of coins.`,
    };
  }
  const held = character.systemData.currency[ask.coin];
  const after = held + ask.step;
  if (after < 0) {
    return {
      ok: false,
      code: 'notEnough',
      coin: ask.coin,
      held,
      step: ask.step,
      message: `The character holds ${held} ${ask.coin}: ${-ask.step} cannot be taken.`,
    };
  }
  if (!Number.isSafeInteger(after)) {
    return {
      ok: false,
      code: 'badStep',
      step: ask.step,
      message: `${held} ${ask.coin} and ${ask.step} more is past the largest whole number.`,
    };
  }
  return settled<CoinRefusal>(
    character,
    stamp,
    {
      action: 'changeCoin',
      subject: ask.coin,
      changes: [changeTo(character, ['systemData', 'currency', ask.coin], after)],
    },
    'The coins change nothing.',
  );
}
