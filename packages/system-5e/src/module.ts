import {
  type BreakdownStep,
  type DerivedStep,
  type DeriveInput,
  type Gathered,
  type GrantOf,
  ownGrants,
  type StatDefaults,
  type SystemModule,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { checkSteps } from './checks';
import type { ClassDef, FifthEditionEntity } from './entity-types';

// ENG-13: fifth edition's module (ADR 004 item 1), what the core asks of it: the character's
// level, the entities its `systemData` names, a stat's defaults, the grants a class taken after
// the first and a feat taken in place of a grant leave out, and the derived values. ENG-14 to
// ENG-16 add their steps to `derive`.

/** A stat's defaults (SPEC §5.3): the modifier, a save, a highest score of 20 (ENG-13 §8). */
export const FIFTH_EDITION_STAT_DEFAULTS: StatDefaults = {
  defaultMax: 20,
  modFormula: 'floor((@score - 10) / 2)',
  hasSave: true,
};

/** A class's grant only the first class gives: a starting proficiency or item (ENG-13 §8). */
function isStarting(grant: GrantOf<FifthEditionEntity>): boolean {
  return (grant.kind === 'proficiency' || grant.kind === 'item') && (grant.atLevel ?? 1) <= 1;
}

/** Each class the character has that a pack holds, with its level, in the order taken. */
function classesOf(
  character: FifthEditionCharacter,
  gathered: Gathered<FifthEditionEntity>,
): { entity: ClassDef; level: number }[] {
  const had = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity]));
  return character.systemData.classes.flatMap(({ id, level }) => {
    const entity = had.get(id);
    return entity?.type === 'class' ? [{ entity, level }] : [];
  });
}

/** Each class's level, `classes.<key>.level`, and its table's numbers at that level. */
function classSteps({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): Record<string, DerivedStep> {
  const steps: Record<string, DerivedStep> = {};
  for (const { entity, level } of classesOf(character, gathered)) {
    const path = `classes.${entity.key}`;
    steps[`${path}.level`] = () => ({
      value: level,
      steps: [{ kind: 'base', value: level, change: level }],
    });
    const row = entity.levels?.find((each) => each.level === level);
    for (const [column, value] of Object.entries(row?.table ?? {})) {
      if (typeof value !== 'number') continue;
      const step: BreakdownStep = {
        kind: 'entity',
        source: entity.id,
        label: entity.name,
        value,
        change: value,
      };
      steps[`${path}.table.${column}`] = () => ({ value, steps: [step] });
    }
  }
  return steps;
}

/** Fifth edition's module: both editions' rules, as the core runs them. */
export const fifthEditionModule: SystemModule<FifthEditionCharacter, FifthEditionEntity> = {
  level: ({ systemData }) => systemData.classes.reduce((sum, entry) => sum + entry.level, 0),

  entities: ({ systemData: data }) => [
    ...[data.species, data.background].flatMap((entry) => (entry ? [{ id: entry.id }] : [])),
    ...data.classes.flatMap((entry) => [
      { id: entry.id, level: entry.level },
      ...(entry.subclass === undefined ? [] : [{ id: entry.subclass, level: entry.level }]),
    ]),
    ...data.feats.map((feat) => ({ id: feat.id })),
  ],

  statDefaults: FIFTH_EDITION_STAT_DEFAULTS,

  // A base-phase formula reads a class's level (SPEC §5.6).
  basePath: (character, path, gathered) =>
    classesOf(character, gathered).find(({ entity }) => path === `classes.${entity.key}.level`)
      ?.level,

  // A class taken after the first gives its multiclass grants in place of its starting ones; a
  // grant a feat is taken in place of gives nothing (ENG-13 §4).
  grantsOf: ({ systemData }, entity) => {
    let grants = ownGrants(entity);
    if (entity.type === 'class' && systemData.classes.findIndex(({ id }) => id === entity.id) > 0) {
      grants = [
        ...grants.filter((grant) => !isStarting(grant)),
        ...(entity.multiclass?.grants ?? []),
      ];
    }
    const replaced = new Set(systemData.feats.flatMap(({ replaces }) => replaces ?? []));
    return grants.filter((grant) => !replaced.has(`${entity.id}#${grant.id}`));
  },

  derive: (input) => ({ ...classSteps(input), ...checkSteps(input) }),
};
