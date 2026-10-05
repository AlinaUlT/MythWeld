import type { DeriveInput, EntityFinder, RuleWarning } from '@grimoire/engine';
import type { FifthEditionCharacter, FifthEditionData } from './character';
import { characterLevel } from './classes';
import type { FifthEditionEntity } from './entity-types';
import { type GrantsBy, originEntities, reached } from './origin';
import type { EditionRules } from './rulesets';

// ENG-35: whose ability score increases a character takes (ADR 014 item 1, from ADR 013 item 10).
// The species' and its lineages' `abilityScore` grants are one side, the background's the other.
// When both sides give some (a 2014 race with a 2024 background), `abilities.bonusSource` picks:
// the side it names applies and the other gives none, or with `both` all apply. When one side
// gives none, there is nothing to pick: the other applies, whatever is stored. A new character
// stores its rules base's source, `rulesOf(character).abilityBonusSource` (ENG-19). ENG-56 moved
// the sides to `origin.ts`.
// ENG-68: `neither` leaves out both sides (ADR 017). Every such mix warns, whatever is stored, so
// the screen shows its sign; it never blocks.

/** A side ability score increases come from: the species, with its lineages, or the background. */
export type BonusSide = EditionRules['abilityBonusSource'];

/**
 * The entities on each side that give the character increases: those of `originEntities` with an
 * `abilityScore` grant that applies at the character's level.
 */
function bonusGivers(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  grantsBy: GrantsBy,
): Record<BonusSide, FifthEditionEntity[]> {
  const level = characterLevel(character);
  const gives = (entity: FifthEditionEntity) =>
    grantsBy(entity).some((grant) => grant.kind === 'abilityScore' && reached(grant, level));
  const sides = originEntities(character, find, grantsBy);
  return { species: sides.species.filter(gives), background: sides.background.filter(gives) };
}

/** The sides `bonusSource` leaves out when both give: none, one, or both for `neither`. */
const LEFT_OUT: Record<FifthEditionData['abilities']['bonusSource'], readonly BonusSide[]> = {
  species: ['background'],
  background: ['species'],
  both: [],
  neither: ['species', 'background'],
};

/**
 * The sides whose increases the character does not take, when both sides give some: those
 * `bonusSource` leaves out. None when a side gives none.
 */
export function leftOutSides(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  grantsBy: GrantsBy,
): readonly BonusSide[] {
  const givers = bonusGivers(character, find, grantsBy);
  if (givers.species.length === 0 || givers.background.length === 0) return [];
  return LEFT_OUT[character.systemData.abilities.bonusSource];
}

/**
 * The warning that both sides give increases, whatever `bonusSource` takes (ADR 017 item 4).
 * `data` names the first entity of each side that gives, and the source stored.
 */
export function abilityBonusWarnings(
  { character, find }: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
  grantsBy: GrantsBy,
): RuleWarning[] {
  const givers = bonusGivers(character, find, grantsBy);
  const species = givers.species[0]?.id;
  const background = givers.background[0]?.id;
  if (species === undefined || background === undefined) return [];
  const source = character.systemData.abilities.bonusSource;
  return [
    {
      rule: 'abilityBonusConflict',
      data: { species, background, source },
      message: `"${species}" and "${background}" both give ability score increases; the bonus source is "${source}".`,
    },
  ];
}
