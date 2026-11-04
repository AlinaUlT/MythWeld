import type { Computed } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { rulesOf } from './rulesets';

// SHEET-40: what the number pad asks of a fifth-edition character (SPEC §7.2, ADR 010 item 6,
// ADR 013 item 1). It names two things the pad cannot read from the actions' own results: whether
// a knock-out is on offer for the damage typed (the edition has it, and the damage would drop the
// character to 0; ENG-65), and the Constitution save that keeps concentration (ENG-20: damage gives
// the DC, the screen rolls the save).

/** The computed path of the Constitution saving throw the concentration save is. */
export const CONCENTRATION_SAVE_PATH = 'abilities.con.save';

/** The concentration save's path, or none when the character has no Constitution save. */
export function concentrationSavePath(
  computed: Pick<Computed<FifthEditionEntity>, 'values'>,
): string | undefined {
  return Object.hasOwn(computed.values, CONCENTRATION_SAVE_PATH)
    ? CONCENTRATION_SAVE_PATH
    : undefined;
}

/**
 * Whether the pad offers to knock the character out instead of dropping it to 0: the edition knocks
 * out to 1 hit point (`knockOutToOneHp`), the character is above 0, and `amount` damage past its
 * temporary hit points would drop it to 0 (the rule `applyDamage` refuses a knock-out without).
 */
export function knockOutOffered(
  character: Pick<FifthEditionCharacter, 'ruleset' | 'systemData'>,
  amount: number,
): boolean {
  if (!rulesOf(character).knockOutToOneHp) return false;
  const { current, temp } = character.systemData.state.hp;
  return current > 0 && amount - Math.min(temp, amount) >= current;
}
