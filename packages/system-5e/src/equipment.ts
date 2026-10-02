import type { EntityFinder, NamedEntity } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity, ItemDef } from './entity-types';

// ENG-44: what a character's equipped items count as, decided once, for gathering (the module's
// `entities`) and for the combat numbers alike. One armor and one shield at a time (SRD 5.1, SRD
// 5.2.1 "One at a Time"): the first of each, in inventory order, is worn, and another counts for
// nothing. An item that needs attunement, not attuned, gives only its nonmagical benefits (SRD 5.1,
// SRD 5.2.1 Attunement): it is named dormant, so only its effects with a `when` of their own apply.

/** The own paths an equipped item is named with (SPEC §5.6 `@equipped`, `@attuned`). */
export const EQUIPPED_PATH = 'equipped';
export const ATTUNED_PATH = 'attuned';

/** An armor or a shield worn, and whether its magic works: it needs no attunement, or is attuned. */
export interface WornItem {
  readonly item: ItemDef;
  readonly magic: boolean;
}

/** An armor or a shield equipped after the one worn of its category; it counts for nothing. */
export interface ExtraItem {
  readonly item: ItemDef;
  readonly worn: ItemDef;
}

/** What the equipped items count as. */
export interface Equipment {
  /** Each equipped item that counts, in inventory order, with its own paths; dormant or not. */
  readonly named: readonly NamedEntity[];
  readonly armor?: WornItem;
  readonly shield?: WornItem;
  /** Each armor, then each shield, that counts for nothing, in inventory order. */
  readonly extra: { readonly armor: readonly ExtraItem[]; readonly shield: readonly ExtraItem[] };
}

/** The item needs attunement: its `magic.attunement` is `true` or says who may attune (§5.3). */
export function needsAttunement(item: ItemDef): boolean {
  const attunement = item.magic?.attunement;
  return attunement !== undefined && attunement !== false;
}

/**
 * What the character's equipped items count as, each looked up by `find`. An item no pack has, or
 * an id that is not an item, is named as it is, so gathering warns of the one.
 */
export function equipmentOf(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): Equipment {
  const named: NamedEntity[] = [];
  const worn: { armor?: WornItem; shield?: WornItem } = {};
  const extra: { armor: ExtraItem[]; shield: ExtraItem[] } = { armor: [], shield: [] };
  for (const { itemId, equipped, attuned } of character.systemData.inventory) {
    if (!equipped || itemId === undefined) continue;
    const paths = { [EQUIPPED_PATH]: 1, [ATTUNED_PATH]: attuned ? 1 : 0 };
    const entity = find(itemId);
    if (entity?.type !== 'item') {
      named.push({ id: itemId, paths });
      continue;
    }
    const magic = attuned || !needsAttunement(entity);
    const { category } = entity;
    if (category === 'armor' || category === 'shield') {
      const first = worn[category];
      if (first !== undefined) {
        extra[category].push({ item: entity, worn: first.item });
        continue;
      }
      worn[category] = { item: entity, magic };
    }
    named.push({ id: itemId, paths, ...(!magic && { dormant: true }) });
  }
  return { named, ...worn, extra };
}
