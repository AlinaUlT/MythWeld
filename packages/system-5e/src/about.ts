import type { Computed } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { LANGUAGE_PROFICIENCY } from './languages';
import { originSideOf } from './origin';

// SHEET-53: what the sheet's About tab names for a fifth-edition character (ADR 009 item 3, board
// `V3-About`): its species and lineages, its background, its alignment, its languages, its armor,
// weapon and tool training, and its skills. Every one is read from what `compute()` gathered, so a
// feat or a class that gives a language or a training shows here with no code of its own.

/** The key of the note that holds a character's alignment: free text, shown as the person wrote it. */
export const ALIGNMENT_NOTE = 'alignment';

/** A proficiency category the About tab lists, with the type of the entity its keys name. */
const LISTED = [
  { list: 'languages', category: LANGUAGE_PROFICIENCY, type: 'language' },
  { list: 'skills', category: 'skill', type: 'skill' },
  { list: 'armor', category: 'armor', type: 'item' },
  { list: 'weapons', category: 'weapon', type: 'item' },
  { list: 'tools', category: 'tool', type: 'item' },
] as const;

/** One proficiency: its key, and the entry that key names when the packs have one. */
export interface AboutProficiency {
  key: string;
  /** Absent for a group (`light`, `simple`) or a key no pack has an entry for. */
  entity?: FifthEditionEntity;
}

/** What the About tab shows; each list is in the order the proficiencies were given. */
export interface FifthEditionAbout {
  /** The species, then its lineages. */
  species: FifthEditionEntity[];
  background: FifthEditionEntity[];
  /** The person's own words, absent when none were written. */
  alignment?: string;
  languages: AboutProficiency[];
  skills: AboutProficiency[];
  armor: AboutProficiency[];
  weapons: AboutProficiency[];
  tools: AboutProficiency[];
}

export function fifthEditionAbout(
  character: Pick<FifthEditionCharacter, 'notes'>,
  computed: Computed<FifthEditionEntity>,
): FifthEditionAbout {
  const sided = computed.entities.map(({ entity }) => entity);
  const alignment = character.notes[ALIGNMENT_NOTE]?.trim();
  const about: FifthEditionAbout = {
    species: sided.filter((entity) => originSideOf(entity) === 'species'),
    background: sided.filter((entity) => originSideOf(entity) === 'background'),
    ...(alignment !== undefined && alignment !== '' && { alignment }),
    languages: [],
    skills: [],
    armor: [],
    weapons: [],
    tools: [],
  };
  for (const { list, category, type } of LISTED) {
    const seen = new Set<string>();
    for (const { category: each, key } of computed.proficiencies) {
      if (each !== category || seen.has(key)) continue;
      seen.add(key);
      const entity = computed.byKey[type]?.[key];
      about[list].push(entity === undefined ? { key } : { key, entity });
    }
  }
  return about;
}
