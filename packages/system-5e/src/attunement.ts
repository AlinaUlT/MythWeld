import type { DeriveInput, RuleWarning } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// SHEET-18: a creature is attuned to no more than three magic items at a time (SRD 5.1, SRD 5.2.1
// Attunement; one rule in both, SHEET-18 §8). The inventory sets a row's `attuned` by hand, so a
// fourth one warns and is never refused (§8.2). Every attuned row counts once, as death ends every
// one (ENG-63): an item or a custom row, equipped or not, its item found or missing.
// SHEET-63: nor to more than one copy of an item (both SRDs, SHEET-63 §8). Two attuned rows of one
// `itemId` are two copies, found or missing; a custom row names no item, so it is no one's copy.

/** How many magic items a creature can be attuned to at a time. */
export const ATTUNEMENT_LIMIT = 3;

/**
 * The warning that more rows are attuned than the limit allows, then one for each item attuned on
 * more than one row, in the order of its first row.
 */
export function attunementWarnings({
  character,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): RuleWarning[] {
  const rows = character.systemData.inventory.filter((row) => row.attuned);
  const warnings: RuleWarning[] = [];
  if (rows.length > ATTUNEMENT_LIMIT) {
    warnings.push({
      rule: 'attunementLimit',
      data: { attuned: rows.length, limit: ATTUNEMENT_LIMIT },
      message: `The character is attuned to ${rows.length} magic items; no more than ${ATTUNEMENT_LIMIT} at a time.`,
    });
  }
  const copies = new Map<string, number>();
  for (const { itemId } of rows) {
    if (itemId !== undefined) copies.set(itemId, (copies.get(itemId) ?? 0) + 1);
  }
  for (const [itemId, attuned] of copies) {
    if (attuned < 2) continue;
    warnings.push({
      rule: 'attunementCopies',
      data: { itemId, attuned },
      message: `The character is attuned to ${attuned} copies of ${itemId}; no more than one copy of an item.`,
    });
  }
  return warnings;
}
