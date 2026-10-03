import type { EntityFinder, GrantOf } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { characterLevel } from './classes';
import type { FifthEditionEntity } from './entity-types';

// ENG-56: a character's origin has two sides, its species with its lineages, and its background.
// Two bonuses come from one side or the other by edition: ability score increases (ENG-35,
// `ability-bonus.ts`) and starting languages (ENG-56, `languages.ts`). Both look at the sides
// before gathering, through the entities found here.

/** A side of the origin: the species, with its lineages, or the background. */
export type OriginSide = 'species' | 'background';

/** The grants an entity gives the character by the module's other rules (ENG-13). */
export type GrantsBy = (entity: FifthEditionEntity) => readonly GrantOf<FifthEditionEntity>[];

/** The side an entity is on, by its type; none for any other type. */
export function originSideOf(entity: FifthEditionEntity): OriginSide | undefined {
  if (entity.type === 'species' || entity.type === 'lineage') return 'species';
  if (entity.type === 'background') return 'background';
  return undefined;
}

/** The grant applies at the character's level. */
export function reached(grant: GrantOf<FifthEditionEntity>, level: number): boolean {
  return grant.atLevel === undefined || grant.atLevel <= level;
}

/** The entity found for the id, when it is on the side. */
function onSide(
  find: EntityFinder<FifthEditionEntity>,
  id: string | undefined,
  side: OriginSide,
): FifthEditionEntity[] {
  const entity = id === undefined ? undefined : find(id);
  return entity !== undefined && originSideOf(entity) === side ? [entity] : [];
}

/**
 * The entities on each side: the character's species and the lineages the species' `entity`
 * grants give, fixed or chosen; its background. Found as gathering will find them, before
 * gathering.
 */
export function originEntities(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  grantsBy: GrantsBy,
): Record<OriginSide, FifthEditionEntity[]> {
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
  return {
    species: [...species, ...lineages],
    background: onSide(find, background?.id, 'background'),
  };
}
