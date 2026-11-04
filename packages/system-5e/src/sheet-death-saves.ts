import type { Computed, EntityFinder } from '@grimoire/engine';
import { DEATH_SAVES, type FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { ROLL_MODE_PATHS } from './rolls';
import { applyingFinder, isDead, isKnockedOut } from './unconscious';

// SHEET-43: what the Combat tab's death saves name for a fifth-edition character (SPEC §7.2, §6.4):
// where it stands, which the one rule of both SRDs gives (ENG-58): above 0 hit points it makes no
// death saves, unless a knock-out (ENG-65) is on it; at 0 it is dying, or stable once it has made
// three successes or been stabilized; with three failures, or with exhaustion at its highest level
// (ENG-67), it is dead. The counts are the stored ones. The roll itself is the roll dialog's, on
// the path of the death save's mode.

/** Where the character stands: the tracker shows for every state but `up`. */
export type DeathState = 'up' | 'knockedOut' | 'dying' | 'stable' | 'dead';

/** The path a death save rolls by: its mode (ENG-34), the number the dialog is opened with. */
export const DEATH_SAVE_PATH = ROLL_MODE_PATHS.deathSave;

export interface DeathSavesShown {
  state: DeathState;
  /** The successes and failures made, each up to `max`. */
  success: number;
  failure: number;
  /** The count that ends a run: three in both editions. */
  max: number;
}

/**
 * The character's death saves, read from the stored hit points, counts and mark, through the
 * finder of what `compute()` left in (exhaustion the character is immune to kills no one, SHEET-64).
 */
export function fifthEditionDeathSaves(
  character: FifthEditionCharacter,
  computed: Pick<Computed<FifthEditionEntity>, 'withheld'>,
  find: EntityFinder<FifthEditionEntity>,
): DeathSavesShown {
  const withheld = new Set((computed.withheld ?? []).map(({ entity }) => entity.id));
  const applying = applyingFinder(find, withheld);
  const { hp, deathSaves } = character.systemData.state;
  const { success, failure, stable } = deathSaves;
  let state: DeathState = 'up';
  if (isDead(character, applying)) state = 'dead';
  else if (hp.current === 0) state = stable ? 'stable' : 'dying';
  else if (isKnockedOut(character, applying)) state = 'knockedOut';
  return { state, success, failure, max: DEATH_SAVES };
}
