import { STAT_TYPE } from '@grimoire/engine';
import { SIZE_PATH } from './size';

// SHEET-36: what the sheet's "What needs choosing" list needs of the fifth-edition module: where
// the answer to a key path that is not chosen yet is stored (ENG-48: a size is stored in the
// species, not in a character's `choices`), and which entity type holds the entries a proficiency
// category's keys name, so the list shows each option by its entry's name.

/** Where the answer to the pending key path `path` is stored in the character; none if unknown. */
export function fifthEditionKeyAnswer(path: string): readonly string[] | undefined {
  return path === SIZE_PATH ? ['systemData', 'species', 'size'] : undefined;
}

/** The entity type each proficiency category's keys, and the key path `size`'s, are entries of. */
const KEY_TYPES: Readonly<Record<string, string>> = {
  skill: 'skill',
  language: 'language',
  save: STAT_TYPE,
  weapon: 'item',
  armor: 'item',
  tool: 'item',
  mastery: 'item',
  [SIZE_PATH]: 'size',
};

/** The entity types to look a key up in; none for a proficiency category or key path it lacks. */
export function fifthEditionKeyTypes(category: string): readonly string[] {
  const type = Object.hasOwn(KEY_TYPES, category) ? KEY_TYPES[category] : undefined;
  return type === undefined ? [] : [type];
}
