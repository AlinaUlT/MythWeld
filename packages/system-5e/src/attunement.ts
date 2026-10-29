import type { DeriveInput, RuleWarning } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// SHEET-18: a creature is attuned to no more than three magic items at a time (SRD 5.1, SRD 5.2.1
// Attunement; one rule in both, SHEET-18 §8). The inventory sets a row's `attuned` by hand, so a
// fourth one warns and is never refused (§8.2). Every attuned row counts once, as death ends every
// one (ENG-63): an item or a custom row, equipped or not, its item found or missing.

/** How many magic items a creature can be attuned to at a time. */
export const ATTUNEMENT_LIMIT = 3;

/** The warning that more rows are attuned than the limit allows. */
export function attunementWarnings({
  character,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): RuleWarning[] {
  const attuned = character.systemData.inventory.filter((row) => row.attuned).length;
  if (attuned <= ATTUNEMENT_LIMIT) return [];
  return [
    {
      rule: 'attunementLimit',
      data: { attuned, limit: ATTUNEMENT_LIMIT },
      message: `The character is attuned to ${attuned} magic items; no more than ${ATTUNEMENT_LIMIT} at a time.`,
    },
  ];
}
