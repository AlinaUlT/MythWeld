import { type ActionResult, changeTo, type LogStamp } from '@grimoire/engine';
import { entityPartIdSchema } from '@grimoire/schema';
import { settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import { AC_CALC_PATH } from './combat';
import { EQUIPMENT_AC_CALC } from './system';

// SHEET-35: the person's pick of the base AC calculation (ENG-47), as an action the sheet runs:
// the module's own calculation (`EQUIPMENT_AC_CALC`) or an effect's part from the candidates
// `ac.base` lists (SHEET-21), or none, which gives the highest back. One pick is one entry, so one
// Undo reverses it. A pick that applies nowhere is not refused here: `compute()` warns and the
// highest counts (`acCalcNotApplying`), as it does for a pin that stopped applying.

/** What a pin is asked: the calculation, or `undefined` to take the pin away. */
export interface AcCalcAsk {
  readonly calc: string | undefined;
}

/** Why a pin was refused. `code` and its data are for the screen. */
export type AcCalcRefusal = { message: string; code: 'badCalc'; calc: string };

/** The pinned base AC calculation, or `undefined` when none is pinned. */
export function pinnedAcCalc(character: FifthEditionCharacter): string | undefined {
  return character.systemData.acCalc;
}

/** The character with `ask.calc` pinned as its base AC calculation (none: the pin away). */
export function pinAcCalc(
  character: FifthEditionCharacter,
  ask: AcCalcAsk,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, AcCalcRefusal | Unchanged> {
  const { calc } = ask;
  if (
    calc !== undefined &&
    calc !== EQUIPMENT_AC_CALC &&
    !entityPartIdSchema.safeParse(calc).success
  ) {
    return {
      ok: false,
      code: 'badCalc',
      calc,
      message: `"${calc}" is neither the module's own calculation nor an effect's part.`,
    };
  }
  return settled<AcCalcRefusal>(
    character,
    stamp,
    {
      action: 'pinAcCalc',
      subject: 'ac.base',
      changes: [changeTo(character, AC_CALC_PATH, calc)],
    },
    'The base AC calculation stays as it is.',
  );
}
