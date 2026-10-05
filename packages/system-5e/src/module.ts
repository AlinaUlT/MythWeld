import {
  type BreakdownStep,
  type DerivedStep,
  type DeriveInput,
  type EntityFinder,
  type GrantOf,
  ownGrants,
  type StatDefaults,
  type SystemModule,
} from '@grimoire/engine';
import { abilityBonusWarnings, leftOutSides } from './ability-bonus';
import { attackSteps } from './attacks';
import type { FifthEditionCharacter } from './character';
import { checkSteps, skillKeys } from './checks';
import { characterLevel, classesOf } from './classes';
import { combatSteps } from './combat';
import type { FifthEditionEntity } from './entity-types';
import { equipmentOf } from './equipment';
import { hitDiceSteps } from './hit-dice';
import {
  isLanguageGrant,
  languageWarnings,
  leftOutLanguageSide,
  startingLanguageSideOf,
} from './languages';
import { originSideOf } from './origin';
import { rollModeSteps } from './rolls';
import { sizeKeys } from './size';
import { spellDiceSteps } from './spell-dice';
import { spellUsesGrants } from './spell-uses';
import { spellcastingSteps } from './spellcasting';
import { trainingSteps, untrainedEffects } from './training';
import { unconsciousNamed, unconsciousWarnings } from './unconscious';

// ENG-13: fifth edition's module (ADR 004 item 1), what the core asks of it: the character's
// level, the entities its `systemData` names, a stat's defaults, the grants a class taken after
// the first and a feat taken in place of a grant leave out, and the derived values. ENG-14 to
// ENG-16 add their steps to `derive`: ENG-14 the combat steps, ENG-15 the spellcasting steps,
// ENG-16 the attack steps. ENG-50 adds `cantrip.upgrades`.
// ENG-14: each equipped item is named, with its own paths. ENG-44: as `equipmentOf` counts it.
// ENG-48 adds the size to `keys`. ENG-49: a `spell` or `item` grant's own ids are looked up.
// ENG-35: the side of the ability score increases not taken gives none; ENG-68: both sides, with
// `neither`, and every such mix warns.
// ENG-34 adds each d20 test's roll mode to `derive` (`rolls.ts`; a weapon's in `attacks.ts`).
// ENG-54: a stat's highest score is the character's house rule `abilityMax`, 20 by default.
// ENG-21 adds the hit dice by size (`hit-dice.ts`).
// ENG-46 adds armor training's paths to `derive`, and suppresses a 2024 shield's AC without it.
// ENG-56: the side of the starting languages not taken gives none; a mix that gives none warns.
// ENG-57: a spell grant's own uses are a resource, given beside it (`spell-uses.ts`).
// ENG-62: at 0 hit points and alive, the Unconscious condition is named by its key; none warns.
// ENG-65: knocked out too (`knock-out.ts`).

/** A stat's defaults but its highest score (SPEC §5.3): the modifier, a save (ENG-13 §8). */
export const FIFTH_EDITION_STAT_DEFAULTS: Pick<StatDefaults, 'modFormula' | 'hasSave'> = {
  modFormula: 'floor((@score - 10) / 2)',
  hasSave: true,
};

/** A class's grant only the first class gives: a starting proficiency or item (ENG-13 §8). */
function isStarting(grant: GrantOf<FifthEditionEntity>): boolean {
  return (grant.kind === 'proficiency' || grant.kind === 'item') && (grant.atLevel ?? 1) <= 1;
}

/**
 * The grants an entity gives the character by two rules (ENG-13 §4): a class taken after the first
 * gives its multiclass grants in place of its starting ones; a grant a feat is taken in place of
 * gives nothing.
 */
function ruledGrants(
  { systemData }: FifthEditionCharacter,
  entity: FifthEditionEntity,
): readonly GrantOf<FifthEditionEntity>[] {
  let grants = ownGrants(entity);
  if (entity.type === 'class' && systemData.classes.findIndex(({ id }) => id === entity.id) > 0) {
    grants = [
      ...grants.filter((grant) => !isStarting(grant)),
      ...(entity.multiclass?.grants ?? []),
    ];
  }
  const replaced = new Set(systemData.feats.flatMap(({ replaces }) => replaces ?? []));
  return grants.filter((grant) => !replaced.has(`${entity.id}#${grant.id}`));
}

/**
 * The grants of `ruledGrants`, but a species, lineage or background on a side of the ability
 * score increases not taken gives none of them (ENG-35), and one on the side of the starting
 * languages not taken gives none of those (ENG-56).
 */
function sidedGrants(
  character: FifthEditionCharacter,
  entity: FifthEditionEntity,
  find: EntityFinder<FifthEditionEntity>,
): readonly GrantOf<FifthEditionEntity>[] {
  const grants = ruledGrants(character, entity);
  const side = originSideOf(entity);
  if (side === undefined) return grants;
  const ruled = (each: FifthEditionEntity) => ruledGrants(character, each);
  const increases =
    grants.some((grant) => grant.kind === 'abilityScore') &&
    leftOutSides(character, find, ruled).includes(side);
  const languages =
    startingLanguageSideOf(character, entity) === side &&
    grants.some(isLanguageGrant) &&
    leftOutLanguageSide(character, find, ruled) === side;
  if (!increases && !languages) return grants;
  return grants.filter(
    (grant) =>
      !(increases && grant.kind === 'abilityScore') && !(languages && isLanguageGrant(grant)),
  );
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
  level: characterLevel,

  entities: (character, find, findKey) => {
    const data = character.systemData;
    return [
      ...[data.species, data.background].flatMap((entry) => (entry ? [{ id: entry.id }] : [])),
      ...data.classes.flatMap((entry) => [
        { id: entry.id, level: entry.level },
        ...(entry.subclass === undefined ? [] : [{ id: entry.subclass, level: entry.level }]),
      ]),
      ...data.feats.map((feat) => ({ id: feat.id })),
      // Only an equipped item's effects and grants apply (SPEC §5.3), so only those are named,
      // and of those only what the rules let count (ENG-44).
      ...equipmentOf(character, find).named,
      // The condition the 0 hit points, or a knock-out, give (ENG-62, ENG-65).
      ...unconsciousNamed(character, findKey),
    ];
  },

  // A stat without its own maximum stops at the table's highest score (SPEC §8.4).
  statDefaults: ({ systemData }) => ({
    ...FIFTH_EDITION_STAT_DEFAULTS,
    defaultMax: systemData.houseRules.abilityMax,
    maxRule: 'abilityMax',
  }),

  // A base-phase formula reads a class's level (SPEC §5.6).
  basePath: (character, path, gathered) =>
    classesOf(character, gathered).find(({ entity }) => path === `classes.${entity.key}.level`)
      ?.level,

  // The two rules of `ruledGrants` and the sides of `sidedGrants`; then the uses a spell grant
  // gives are a resource (ENG-57).
  grantsOf: (character, entity, find) =>
    spellUsesGrants(entity, sidedGrants(character, entity, find)),

  // A spell grant's spells and an item grant's items are known or carried, not had: gathering
  // looks them up, and warns for one no pack has.
  namedIds: (grant) => {
    if (grant.kind === 'spell') return grant.fixed ?? [];
    if (grant.kind === 'item') return (grant.fixed ?? []).map(({ id }) => id);
    return [];
  },

  derive: (input) => ({
    ...classSteps(input),
    ...checkSteps(input),
    ...combatSteps(input),
    ...hitDiceSteps(input),
    ...spellcastingSteps(input),
    ...attackSteps(input),
    ...rollModeSteps(input),
    ...trainingSteps(input),
    ...spellDiceSteps(),
  }),

  // Each skill's stat, which an effect may set; the character's size.
  keys: (input) => ({ ...skillKeys(input), ...sizeKeys(input) }),

  // Ability score increases given by both the species and the background; a mix that gives no
  // starting languages; a character at 0 hit points, or knocked out, with no Unconscious
  // condition to have.
  ruleWarnings: (input) => [
    ...abilityBonusWarnings(input, (entity) => ruledGrants(input.character, entity)),
    ...languageWarnings(input),
    ...unconsciousWarnings(input),
  ],

  // The AC effects of a shield worn without training, when its edition takes its AC away.
  suppressedEffects: untrainedEffects,
};
