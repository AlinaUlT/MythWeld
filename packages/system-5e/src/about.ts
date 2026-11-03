import type { Computed } from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { SIZE_PATH } from './size';

// SHEET-53: what the About tab names for a fifth-edition character (ADR 009 item 3, board
// `V3-About`): the species with its lineages, the background, the size, and the languages, armor,
// weapons, tools and skills the character is proficient in. A list holds the keys `compute()`
// gathered from the proficiency grants of every entity the character has, each once, in the order
// they were given; the screen names each by the entry of its type (`byKey`), which needs
// `ABOUT_LISTS`' type, or by its own words where no entry names it (an armor group, a weapon
// category).

/** A list of the About tab. */
export type AboutListName = 'languages' | 'armor' | 'weapons' | 'tools' | 'skills';

/** A list's proficiency category, and the entity type whose entries name its keys. */
export const ABOUT_LISTS: Readonly<Record<AboutListName, { category: string; type: string }>> = {
  languages: { category: 'language', type: 'language' },
  armor: { category: 'armor', type: 'item' },
  weapons: { category: 'weapon', type: 'item' },
  tools: { category: 'tool', type: 'toolKind' },
  skills: { category: 'skill', type: 'skill' },
};

/** The origin details of a character, as the About tab shows them. */
export interface AboutShown {
  species?: EntityId;
  /** The lineages the character has gathered, in the order gathered. */
  lineages: EntityId[];
  background?: EntityId;
  /** The size key `compute()` chose; none while it is a pending choice or there is no species. */
  size?: string;
  lists: Record<AboutListName, string[]>;
}

/** The keys of `category` the character is proficient in, each once, in the order given. */
function keysOf(computed: Computed<FifthEditionEntity>, category: string): string[] {
  const keys = computed.proficiencies
    .filter((each) => each.category === category && (each.level ?? 1) > 0)
    .map(({ key }) => key);
  return [...new Set(keys)];
}

/** The origin details and proficiencies of `character`, from what `compute()` gave. */
export function fifthEditionAbout(
  character: Pick<FifthEditionCharacter, 'systemData'>,
  computed: Computed<FifthEditionEntity>,
): AboutShown {
  const { species, background } = character.systemData;
  const size = computed.keys[SIZE_PATH]?.key;
  const lineages = computed.entities
    .filter(({ entity }) => entity.type === 'lineage')
    .map(({ entity }) => entity.id as EntityId);
  const names = Object.keys(ABOUT_LISTS) as AboutListName[];
  const lists = Object.fromEntries(
    names.map((name) => [name, keysOf(computed, ABOUT_LISTS[name].category)]),
  ) as Record<AboutListName, string[]>;
  return {
    ...(species !== undefined && { species: species.id }),
    lineages,
    ...(background !== undefined && { background: background.id }),
    ...(size !== undefined && { size }),
    lists,
  };
}
