import type { DeriveInput, EntityFinder, GrantOf, RuleWarning } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { characterLevel } from './classes';
import type { FifthEditionEntity } from './entity-types';
import type { EditionRules } from './rulesets';

// ENG-35: whose ability score increases a character takes (ADR 014 item 1, from ADR 013 item 10).
// The species' and its lineages' `abilityScore` grants are one side, the background's the other.
// When both sides give some (a 2014 race with a 2024 background), `abilities.bonusSource` picks:
// the side it names applies and the other gives none, or with `both` all apply and a warning says
// so, never a block. When one side gives none, there is nothing to pick: the other applies,
// whatever is stored. A new character stores its rules base's source,
// `rulesOf(character).abilityBonusSource` (ENG-19).

/** A side ability score increases come from: the species, with its lineages, or the background. */
export type BonusSide = EditionRules['abilityBonusSource'];

/** The grants an entity gives the character by the module's other rules (ENG-13). */
export type GrantsBy = (entity: FifthEditionEntity) => readonly GrantOf<FifthEditionEntity>[];

/** The side an entity's increases are on, by its type; none for any other type. */
export function bonusSideOf(entity: FifthEditionEntity): BonusSide | undefined {
  if (entity.type === 'species' || entity.type === 'lineage') return 'species';
  if (entity.type === 'background') return 'background';
  return undefined;
}

/** The grant applies at the character's level. */
function reached(grant: GrantOf<FifthEditionEntity>, level: number): boolean {
  return grant.atLevel === undefined || grant.atLevel <= level;
}

/** The entity found for the id, when it is on the side. */
function onSide(
  find: EntityFinder<FifthEditionEntity>,
  id: string | undefined,
  side: BonusSide,
): FifthEditionEntity[] {
  const entity = id === undefined ? undefined : find(id);
  return entity !== undefined && bonusSideOf(entity) === side ? [entity] : [];
}

/**
 * The entities on each side that give the character increases: its species and the lineages the
 * species' `entity` grants give, fixed or chosen; its background. Found as gathering will find
 * them, before gathering.
 */
function bonusGivers(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  grantsBy: GrantsBy,
): Record<BonusSide, FifthEditionEntity[]> {
  const level = characterLevel(character);
  const { species: speciesEntry, background } = character.systemData;
  const species = onSide(find, speciesEntry?.id, 'species');
  const lineages = species.flatMap((entity) =>
    grantsBy(entity).flatMap((grant) => {
      if (grant.kind !== 'entity' || !reached(grant, level)) return [];
      const stored = character.choices[`${entity.id}#${grant.id}`] ?? [];
      const chosen = stored.slice(0, grant.choose?.count ?? 0);
      return [...(grant.fixed ?? []), ...chosen].flatMap((id) => onSide(find, id, 'species'));
    }),
  );
  const gives = (entity: FifthEditionEntity) =>
    grantsBy(entity).some((grant) => grant.kind === 'abilityScore' && reached(grant, level));
  return {
    species: [...species, ...lineages].filter(gives),
    background: onSide(find, background?.id, 'background').filter(gives),
  };
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
    const side = entity === undefined ? undefined : bonusSideOf(entity);
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
