import {
  baseOf,
  entityIdOf,
  type Importer,
  type ImportInput,
  type SourceEntry,
  slugOf,
  textOf,
} from './frame.ts';
import { keyOf } from './smallTypes.ts';

// CONT-12: the equipment of both SRDs: armor, weapons, gear, tools, packs, mounts and vehicles, as
// `item` entities. A weapon and an armor get the block the schema asks of its category; a pack
// gives its contents; a shield gives its armor class as an effect, as SPEC §5.3 writes it. What
// the item schema cannot hold (CONT-12 §8) is left out and named in §11.

/** A link to another entry of the source. */
interface Ref {
  index: string;
}

/** The categories of `Equipment-Categories`, by the index of each entry they list. */
type Listed = ReadonlyMap<string, ReadonlySet<string>>;

function listedOf(input: ImportInput): Listed {
  const listed = new Map<string, Set<string>>();
  for (const category of input.files['Equipment-Categories'] ?? []) {
    for (const item of (category.equipment as Ref[] | undefined) ?? []) {
      listed.set(item.index, (listed.get(item.index) ?? new Set()).add(category.index));
    }
  }
  return listed;
}

/**
 * The categories an entry is in, by index: those it lists itself and those `Equipment-Categories`
 * lists it in. SRD 5.2.1's two lists differ for 6 items (CONT-12 §8), so either one counts.
 */
function categoriesOf(entry: SourceEntry, listed: Listed): Set<string> {
  const own = ((entry.equipment_categories as Ref[] | undefined) ?? []).map((c) => c.index);
  return new Set([...own, ...(listed.get(entry.index) ?? [])]);
}

/** The kinds of proficiency in `Proficiencies` that are tools, as CONT-14 reads them. */
const TOOL_PROFICIENCIES: ReadonlySet<string> = new Set([
  "Artisan's Tools",
  'Gaming Sets',
  'Musical Instruments',
  'Other',
  'Tools',
]);

/**
 * The indexes of the items a tool proficiency is of. SRD 5.1 puts four of them (the disguise,
 * forgery, herbalism and poisoner's kits) in the gear category "Kits", though they are tools
 * (CONT-12 §8); a proficiency in them is a `tool` kind (CONT-14), so they are `tool` items.
 */
function toolIndexesOf(input: ImportInput): Set<string> {
  return new Set(
    (input.files.Proficiencies ?? [])
      .filter((entry) => TOOL_PROFICIENCIES.has(String(entry.type)))
      .map((entry) => (entry.reference as Ref).index),
  );
}

const FOCUS_CATEGORIES = ['holy-symbols', 'arcane-foci', 'druidic-foci'];

/** The item category (`ItemDef.category`), from the source's categories. The first that fits. */
function categoryOf(
  categories: ReadonlySet<string>,
  hasContents: boolean,
  isTool: boolean,
): string {
  if (hasContents || categories.has('equipment-packs')) return 'pack';
  if (categories.has('weapon') || categories.has('weapons')) return 'weapon';
  if (categories.has('shields')) return 'shield';
  if (categories.has('armor')) return 'armor';
  if (categories.has('tools') || isTool) return 'tool';
  if (categories.has('mounts-and-vehicles')) return 'transport';
  if (categories.has('ammunition')) return 'ammunition';
  if (FOCUS_CATEGORIES.some((focus) => categories.has(focus))) return 'focus';
  return 'gear';
}

// --- Weapons and armor

interface Damage {
  damage_dice: string;
  damage_type: Ref;
}

/** A weapon's block. Its kind and group are in its categories, in both SRDs. */
function weaponOf(entry: SourceEntry, categories: ReadonlySet<string>) {
  const damage = entry.damage as Damage | undefined;
  const versatile = entry.two_handed_damage as Damage | undefined;
  const range = entry.range as { normal: number; long?: number } | undefined;
  const properties = ((entry.properties as Ref[] | undefined) ?? []).map((p) => keyOf(p.index));
  const mastery = entry.mastery as Ref | undefined;
  return {
    group: categories.has('martial-weapons') ? 'martial' : 'simple',
    kind: categories.has('ranged-weapons') ? 'ranged' : 'melee',
    ...(damage !== undefined && {
      damage: { formula: damage.damage_dice, type: keyOf(damage.damage_type.index) },
    }),
    ...(versatile !== undefined && { versatile: versatile.damage_dice }),
    ...(properties.length > 0 && { properties }),
    ...(range !== undefined && { range }),
    ...(mastery !== undefined && { mastery: keyOf(mastery.index) }),
  };
}

interface ArmorClass {
  base: number;
  dex_bonus: boolean;
  max_bonus?: number;
}

/**
 * An armor's block. `dexCap` is the most Dexterity adds: 0 when it adds none, `null` when nothing
 * caps it. The group is the armor's category (`light-armor`, `medium-armor`, `heavy-armor`).
 */
function armorOf(entry: SourceEntry, categories: ReadonlySet<string>, listed: Listed) {
  const armorClass = entry.armor_class as ArmorClass;
  const named = ['light', 'medium', 'heavy'].filter((name) => categories.has(`${name}-armor`));
  // SRD 5.2.1's `hide-armor` lists itself in `light-armor`, and `Equipment-Categories` lists it in
  // `medium-armor` (CONT-12 §8): the file's group decides when the two differ.
  const filed = named.filter((name) => listed.get(entry.index)?.has(`${name}-armor`));
  const group = named.length === 1 ? named[0] : filed.length === 1 ? filed[0] : undefined;
  if (group === undefined) throw new Error(`The armor "${entry.index}" has no one group.`);
  const strength = Number(entry.str_minimum ?? 0);
  return {
    group,
    baseAC: armorClass.base,
    dexCap: armorClass.dex_bonus ? (armorClass.max_bonus ?? null) : 0,
    ...(strength > 0 && { strRequirement: strength }),
    ...(entry.stealth_disadvantage === true && { stealthDisadvantage: true }),
  };
}

// --- The item

/** The words of an entry: its text, then the notes a weapon carries (SRD 5.1 `special`, SRD 5.2.1 `notes`). */
function wordsOf(entry: SourceEntry): { text: { en: string } } | Record<string, never> {
  const notes = [entry.special, entry.notes]
    .flat()
    .filter((n): n is string => typeof n === 'string');
  const text = [textOf(entry), ...notes].filter((part): part is string => part !== undefined);
  return text.length === 0 ? {} : { text: { en: text.join('\n\n') } };
}

function itemOf(
  input: ImportInput,
  entry: SourceEntry,
  listed: Listed,
  tools: ReadonlySet<string>,
) {
  const categories = categoriesOf(entry, listed);
  const category = categoryOf(categories, entry.contents !== undefined, tools.has(entry.index));
  const cost = entry.cost as { quantity: number; unit: string } | undefined;
  const weight = Number(entry.weight ?? 0);
  const contents = entry.contents as { item: Ref; quantity: number }[] | undefined;
  const vehicle = entry.vehicle_category;
  const tags = [
    ...(category === 'weapon' ? [categories.has('ranged-weapons') ? 'ranged' : 'melee'] : []),
    ...(typeof vehicle === 'string' ? [vehicle] : []),
  ];
  const armorClass = entry.armor_class as ArmorClass | undefined;
  return {
    ...baseOf(input, 'item', entry),
    ...wordsOf(entry),
    key: keyOf(slugOf(entry.index)),
    category,
    ...(tags.length > 0 && { tags }),
    ...(weight > 0 && { weight }),
    // A price of 0 (SRD 5.1's seven free items) is no price: an amount is above 0.
    ...(cost !== undefined &&
      cost.quantity > 0 && { cost: { amount: cost.quantity, unit: cost.unit } }),
    ...(category === 'weapon' && { weapon: weaponOf(entry, categories) }),
    ...(category === 'armor' && { armor: armorOf(entry, categories, listed) }),
    // A shield adds its armor class while it is equipped (SPEC §5.3).
    ...(category === 'shield' &&
      armorClass !== undefined && {
        effects: [
          {
            id: 'armor-class',
            target: 'ac.bonus',
            op: 'add',
            value: armorClass.base,
            when: '@equipped',
          },
        ],
      }),
    ...(contents !== undefined && {
      grants: [
        {
          id: 'contents',
          kind: 'item',
          fixed: contents.map((part) => ({
            id: entityIdOf(input.packId, 'item', part.item.index),
            qty: part.quantity,
          })),
        },
      ],
    }),
  };
}

export const equipment: Importer = {
  types: ['item'],
  files: {
    '2014': ['Equipment', 'Equipment-Categories', 'Proficiencies'],
    '2024': ['Equipment', 'Equipment-Categories', 'Proficiencies'],
  },
  run: (input) => {
    const listed = listedOf(input);
    const tools = toolIndexesOf(input);
    return (input.files.Equipment ?? []).map((entry) => itemOf(input, entry, listed, tools));
  },
};
