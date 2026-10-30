import { type GrantOf, STAT_TYPE } from '@grimoire/engine';
import type { FifthEditionEntity } from './entity-types';
import { SIZE_PATH } from './size';

// SHEET-36: what the sheet's choices list needs of fifth edition (SPEC §7.2, "What needs choosing").
// A pending choice offers keys; the entity type those keys are entries of names them on screen.
// A key path not chosen (ENG-48's size) is answered in the character's own part, not in `choices`.

/** The entity type the keys of each proficiency category are entries of. */
const PROFICIENCY_KEY_TYPES: Readonly<Record<string, string>> = {
  skill: 'skill',
  save: STAT_TYPE,
  language: 'language',
  tool: 'toolKind',
  // ENG-16: a weapon, an armor and a mastery proficiency name items by their key.
  weapon: 'item',
  armor: 'item',
  mastery: 'item',
};

/**
 * The entity type a grant's offered keys are entries of, so the screen can show each entry's
 * name; none for a grant that offers entities by id.
 */
export function fifthEditionOptionType(grant: GrantOf<FifthEditionEntity>): string | undefined {
  if (grant.kind === 'abilityScore') return STAT_TYPE;
  if (grant.kind !== 'proficiency') return undefined;
  return Object.hasOwn(PROFICIENCY_KEY_TYPES, grant.category)
    ? PROFICIENCY_KEY_TYPES[grant.category]
    : undefined;
}

/** How the screen answers a key path not chosen: the entity type of its keys, and where it is stored. */
export interface PendingKeyAnswer {
  type: string;
  /** The place in the stored character that holds the key. */
  place: readonly string[];
}

/** The key paths a person answers, by path (ENG-48: the species' size). */
export const FIFTH_EDITION_PENDING_KEYS: Readonly<Record<string, PendingKeyAnswer>> = {
  [SIZE_PATH]: { type: 'size', place: ['systemData', 'species', 'size'] },
};
