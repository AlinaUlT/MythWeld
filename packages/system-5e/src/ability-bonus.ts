import type { DeriveInput, EntityFinder, RuleWarning } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { characterLevel } from './classes';
import type { FifthEditionEntity } from './entity-types';
import { type GrantsBy, originEntities, originSideOf, reached } from './origin';
import type { EditionRules } from './rulesets';

// ENG-35: whose ability score increases a character takes (ADR 014 item 1, from ADR 013 item 10).
// The species' and its lineages' `abilityScore` grants are one side, the background's the other.
// When both sides give some (a 2014 race with a 2024 background), `abilities.bonusSource` picks:
// the side it names applies and the other gives none, or with `both` all apply and a warning says
// so, never a block. When one side gives none, there is nothing to pick: the other applies,
// whatever is stored. A new character stores its rules base's source,
// `rulesOf(character).abilityBonusSource` (ENG-19). ENG-56 moved the sides to `origin.ts`.

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

/**
 * The side whose increases the character does not take: the one `bonusSource` does not name, when
 * both sides give some. None with `both`, or when a side gives none.
 */
export function leftOutSide(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  grantsBy: GrantsBy,
): BonusSide | undefined {
  const source = character.systemData.abilities.bonusSource;
  if (source === 'both') return undefined;
  const givers = bonusGivers(character, find, grantsBy);
  if (givers.species.length === 0 || givers.background.length === 0) return undefined;
  return source === 'species' ? 'background' : 'species';
}

/**
 * The warning that increases apply from both sides: with `both` stored, when an entity of each
 * side gave one. `data` names the first of each.
 */
export function abilityBonusWarnings({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): RuleWarning[] {
  if (character.systemData.abilities.bonusSource !== 'both') return [];
  const had = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity]));
  const first: Partial<Record<BonusSide, string>> = {};
  for (const { grant, source } of gathered.grants) {
    const entity = had.get(source);
    const side = entity === undefined ? undefined : originSideOf(entity);
    if (grant.kind === 'abilityScore' && side !== undefined) first[side] ??= source;
  }
  const { species, background } = first;
  if (species === undefined || background === undefined) return [];
  return [
    {
      rule: 'abilityBonusesFromBoth',
      data: { species, background },
      message: `Ability score increases apply from both "${species}" and "${background}": the bonus source is "both".`,
    },
  ];
}
