import {
  ANY_RULESET,
  type DeriveInput,
  type EntityFinder,
  type GrantOf,
  type RuleWarning,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { characterLevel } from './classes';
import type { FifthEditionEntity } from './entity-types';
import { type GrantsBy, type OriginSide, originEntities, originSideOf, reached } from './origin';
import { rulesOfEntity } from './rulesets';

// ENG-56: where a character's starting languages come from (ADR 005 item 3.4: a bonus of one kind
// counts once). SRD 5.1 gives them from the race; SRD 5.2.1 in the origin step, which a 2024
// background holds in data (ENG-56 §8). An entity's `language` grants are starting languages when
// the entity is on the side its own edition gives them from (`languageSource`; an entity of `any`
// follows the rules base); every other language grant, a 2014 background's included, adds to
// them. When both sides give starting languages (a 2014 race with a 2024 background),
// `systemData.languageSource` picks one and the other's give none; when one side gives, it applies
// whatever is stored. A mix of editions whose origin gives none warns, never blocks.

/** The proficiency category of languages. */
export const LANGUAGE_PROFICIENCY = 'language';

/** The grant gives languages. */
export function isLanguageGrant(grant: GrantOf<FifthEditionEntity>): boolean {
  return grant.kind === 'proficiency' && grant.category === LANGUAGE_PROFICIENCY;
}

/**
 * The side whose starting languages the entity's language grants are: its own side, when its
 * edition gives them from there; else none, and they add to the starting ones.
 */
export function startingLanguageSideOf(
  character: Pick<FifthEditionCharacter, 'ruleset'>,
  entity: FifthEditionEntity,
): OriginSide | undefined {
  const side = originSideOf(entity);
  return side !== undefined && rulesOfEntity(entity, character).languageSource === side
    ? side
    : undefined;
}

/**
 * The side whose starting languages the character does not take: the one `languageSource` does
 * not name, when each side has an entity whose starting languages apply at the character's level.
 * None when a side gives none.
 */
export function leftOutLanguageSide(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  grantsBy: GrantsBy,
): OriginSide | undefined {
  const level = characterLevel(character);
  const gives = (entity: FifthEditionEntity) =>
    startingLanguageSideOf(character, entity) !== undefined &&
    grantsBy(entity).some((grant) => isLanguageGrant(grant) && reached(grant, level));
  const sides = originEntities(character, find, grantsBy);
  if (!sides.species.some(gives) || !sides.background.some(gives)) return undefined;
  return character.systemData.languageSource === 'species' ? 'background' : 'species';
}

/**
 * The warning that a mix of editions leaves the character no starting languages: none was
 * gathered, and a species, lineage or background is of the edition the rules base is not. `data`
 * names the first such entity.
 */
export function languageWarnings({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): RuleWarning[] {
  const had = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity]));
  const given = gathered.grants.some(({ grant, source }) => {
    const entity = had.get(source);
    return (
      entity !== undefined &&
      isLanguageGrant(grant) &&
      startingLanguageSideOf(character, entity) !== undefined
    );
  });
  if (given) return [];
  const other = gathered.entities.find(
    ({ entity }) =>
      originSideOf(entity) !== undefined &&
      entity.ruleset !== ANY_RULESET &&
      entity.ruleset !== character.ruleset,
  );
  if (other === undefined) return [];
  const entity = other.entity.id;
  return [
    {
      rule: 'noStartingLanguages',
      data: { entity },
      message: `No species, lineage or background gives starting languages by its edition's rules; "${entity}" is of another edition.`,
    },
  ];
}
