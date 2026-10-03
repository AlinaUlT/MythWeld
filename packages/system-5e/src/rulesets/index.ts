import { ANY_RULESET } from '@grimoire/engine';
import type { FifthEditionCharacter } from '../character';
import type { FifthEditionEntity } from '../entity-types';
import { RULES_2014 } from './2014';
import { RULES_2024 } from './2024';
import type { EditionRules } from './edition-rules';

// ENG-15: the rules of a character's edition, found by its rules base: one lookup, so no other
// code tests an edition (ADR 004; SPEC §6.3).

export * from './2014';
export * from './2024';
export * from './edition-rules';

/** Each edition's rules, by its id. */
export const EDITION_RULES: Readonly<Record<FifthEditionCharacter['ruleset'], EditionRules>> = {
  '2014': RULES_2014,
  '2024': RULES_2024,
};

/** The rules of the character's edition: its rules base's, whatever editions its content mixes. */
export function rulesOf(character: Pick<FifthEditionCharacter, 'ruleset'>): EditionRules {
  return EDITION_RULES[character.ruleset];
}

/**
 * ENG-56: the rules an entity was written for: its edition's, or the character's rules base's for
 * an entity of `any`.
 */
export function rulesOfEntity(
  entity: Pick<FifthEditionEntity, 'ruleset'>,
  character: Pick<FifthEditionCharacter, 'ruleset'>,
): EditionRules {
  return EDITION_RULES[entity.ruleset === ANY_RULESET ? character.ruleset : entity.ruleset];
}
