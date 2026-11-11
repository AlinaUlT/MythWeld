import {
  baseOf,
  type Importer,
  type ImportInput,
  type SourceEntry,
  slugOf,
  textOf,
} from './frame.ts';
import { keyOf } from './smallTypes.ts';

// CONT-13: the magic items of both SRDs, as `item` entities with a `magic` block. The import only:
// what an item does is the mechanics rows' (CONT-39).
//
// A magic weapon or armor has no `weapon` or `armor` block: the source does not say which weapon
// or armor it is (most are "any sword", "any light, medium, or heavy armor"), and the schema asks
// those blocks of the categories `weapon` and `armor`. They are `gear` with the source's category
// as a tag, and CONT-39 gives a block, and so the category, to an item that needs one.

/** A magic item's rarity in the source: a name, or, for an item that comes in several, a list. */
interface Rarity {
  name: string;
}

/** The first paragraph of an item's words, where the source writes its kind and rarity. */
function firstLine(entry: SourceEntry): string {
  return (textOf(entry) ?? '').split('\n')[0] ?? '';
}

// --- Rarity, attunement, bonus

/**
 * The rarity key (`itemRarity`, CONT-14). One rarity is its key; an item that has several (`Uncommon
 * (+1), Rare (+2), or Very Rare (+3)`) or says it varies is `varies`.
 */
function rarityOf(entry: SourceEntry): string {
  const name = (entry.rarity as Rarity).name;
  const names = name
    .replace(/\([^)]*\)/g, '')
    .split(/,|\bor\b/)
    .map((part) => part.trim().replace(/^Rarity /, ''))
    .filter((part) => part !== '');
  const slugs = new Set(names.map((part) => part.toLowerCase().replace(/\s+/g, '-')));
  const [only] = [...slugs];
  return slugs.size === 1 && only !== 'varies' && only !== undefined ? keyOf(only) : 'varies';
}

/**
 * What an item needs to be attuned to. SRD 5.2.1 has a flag and `limited-to` for who may; SRD 5.1
 * writes it in the first line: "(requires attunement)", "(requires attunement by a cleric)".
 * `true` when anyone may, else the words of who may.
 */
function attunementOf(
  input: ImportInput,
  entry: SourceEntry,
): boolean | { en: string } | undefined {
  if (input.ruleset === '2024') {
    const limited = entry['limited-to'];
    if (typeof limited === 'string') return { en: limited };
    return entry.attunement === true ? true : undefined;
  }
  const found = /\(requires attunement(?: (?:by )?([^)]+))?\)/i.exec(firstLine(entry));
  if (found === null) return undefined;
  return found[1] === undefined ? true : { en: found[1] };
}

/** The "+1" of a variant: in its rarity ("Uncommon (+1)") or at the end of its name. */
function bonusOf(entry: SourceEntry): number | undefined {
  if (entry.variant !== true) return undefined;
  const found =
    /\(\+(\d)\)/.exec((entry.rarity as Rarity).name) ?? /,? \+(\d)$/.exec(String(entry.name));
  return found?.[1] === undefined ? undefined : Number(found[1]);
}

// --- Category

/** The source's categories of what is drunk or read. */
const CONSUMABLE_CATEGORIES: ReadonlySet<string> = new Set(['potion', 'potions', 'scroll']);

/**
 * The item category (`ItemDef.category`). Ammunition and shields are told by the first line, a
 * variant by its parent's ("Weapon (Uncommon)" says nothing of what the weapon is).
 */
function categoryOf(entry: SourceEntry, parent: SourceEntry | undefined): string {
  const kind = firstLine(parent ?? entry);
  const source = (entry.equipment_category as { index: string }).index;
  if (CONSUMABLE_CATEGORIES.has(source)) return 'consumable';
  if (source === 'ammunition' || /^Weapon \((?:any )?(?:ammunition|arrow)\b/i.test(kind)) {
    return 'ammunition';
  }
  if (/^Armor \(shield\)/i.test(kind)) return 'shield';
  return 'gear';
}

// --- The items

/**
 * An item's id slug: the source's, except that SRD 5.2.1's magic `shield` (the shield that comes
 * with +1, +2 or +3) has the slug of the equipment's `shield`, and an id is one entity's. It
 * takes `-magic`, and the equipment keeps its slug, which the hand-written packs name.
 */
function slugsOf(entries: readonly SourceEntry[], equipment: readonly SourceEntry[]) {
  const taken = new Set(equipment.map((entry) => slugOf(entry.index)));
  return new Map(
    entries.map((entry) => {
      const slug = slugOf(entry.index);
      return [entry.index, taken.has(slug) ? `${slug}-magic` : slug] as const;
    }),
  );
}

function itemsOf(input: ImportInput) {
  const entries = input.files['Magic-Items'] ?? [];
  const slugs = slugsOf(entries, input.files.Equipment ?? []);
  const idOf = (index: string) => `${input.packId}:item/${slugs.get(index) ?? slugOf(index)}`;
  const byIndex = new Map(entries.map((entry) => [entry.index, entry]));
  const parentOf = new Map<string, SourceEntry>();
  for (const entry of entries) {
    for (const variant of (entry.variants as { index: string }[] | undefined) ?? []) {
      parentOf.set(variant.index, entry);
    }
  }
  return entries.map((entry) => {
    const parent = parentOf.get(entry.index);
    const attunement = attunementOf(input, entry);
    const bonus = bonusOf(entry);
    return {
      ...baseOf(input, 'item', entry),
      id: idOf(entry.index),
      category: categoryOf(entry, parent),
      tags: [(entry.equipment_category as { name: string }).name],
      magic: {
        rarity: rarityOf(entry),
        ...(attunement !== undefined && { attunement }),
        ...(bonus !== undefined && { bonus }),
      },
      ...(parent !== undefined &&
        byIndex.has(parent.index) && { meta: { variantOf: idOf(parent.index) } }),
    };
  });
}

export const magicItems: Importer = {
  types: ['item'],
  files: { '2014': ['Magic-Items', 'Equipment'], '2024': ['Magic-Items', 'Equipment'] },
  run: (input) => itemsOf(input),
};
