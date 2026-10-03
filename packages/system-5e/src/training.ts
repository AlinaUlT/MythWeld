import type { BreakdownStep, DerivedStep, DeriveInput, RuleWarning } from '@grimoire/engine';
import type { EntityPartId } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import { proficiencySources } from './checks';
import type { FifthEditionEntity, ItemDef } from './entity-types';
import { equipmentOf, type WornItem } from './equipment';
import { rulesOf, type UntrainedShieldPenalty } from './rulesets';

// ENG-46: armor worn without its training (SRD 5.1 Armor Proficiency, SRD 5.2.1 Armor Training;
// ENG-46 §8). The armor and the shield worn are `equipmentOf`'s; each has its training when an
// `armor` proficiency names its group (`light`, `medium`, `heavy`), for a shield `shield`, or its
// own key (ENG-09 §4). What lacking it does is its edition's `untrained` (`rulesets/`):
// disadvantage on each d20 test of Strength or Dexterity (`rolls.ts`, `attacks.ts`), no spells
// (`spell.cannotCast`), or none of a shield's AC: its effects on `ac.*` targets are suppressed
// (the module's `suppressedEffects`) and its magic bonus is not added (`combat.ts`).

/** The proficiency category whose keys are armor groups, `shield` or an item's key (ENG-09 §4). */
export const ARMOR_PROFICIENCY = 'armor';

/** The key of a shield's training in an `armor` proficiency: its category (ENG-09 §4). */
export const SHIELD_TRAINING = 'shield';

/** The stats whose d20 tests an item worn without training may give disadvantage (§8). */
export const UNTRAINED_STATS: readonly string[] = ['str', 'dex'];

/** What an effect's target starts with when it changes the Armor Class (SPEC §5.4). */
export const AC_TARGET_PREFIX = 'ac.';

/** The path that is 1 while a rule stops the character casting spells. */
export const CANNOT_CAST_PATH = 'spell.cannotCast';

/** The items worn that need training: one armor, one shield (ENG-44). */
export type WornKind = 'armor' | 'shield';

/** The path of each kind that is 1 while the item worn lacks its training. */
export const UNTRAINED_PATHS: Readonly<Record<WornKind, string>> = {
  armor: 'armor.untrained',
  shield: 'shield.untrained',
};

/** The rule each kind's penalties are named by, in a breakdown and in a warning. */
export const UNTRAINED_RULES: Readonly<Record<WornKind, string>> = {
  armor: 'untrainedArmor',
  shield: 'untrainedShield',
};

/** An item worn without its training: its kind, the item, what its edition says that does. */
export interface Untrained {
  readonly kind: WornKind;
  readonly item: ItemDef;
  readonly penalties: readonly UntrainedShieldPenalty[];
}

/** The keys that give an item worn its training: its group, or `shield`; its own key. */
function trainingKeys(kind: WornKind, item: ItemDef): string[] {
  const named = kind === 'shield' ? SHIELD_TRAINING : item.armor?.group;
  return [named, item.key].filter((key) => key !== undefined);
}

/**
 * The armor worn, then the shield worn, each when no `armor` proficiency the character has names
 * one of its keys, with its edition's penalties.
 */
export function untrainedOf(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): Untrained[] {
  const sources = proficiencySources(input.gathered);
  const { armor, shield } = equipmentOf(input.character, input.find);
  const penalties = rulesOf(input.character).untrained;
  const worn: [WornKind, WornItem | undefined][] = [
    ['armor', armor],
    ['shield', shield],
  ];
  return worn.flatMap(([kind, each]): Untrained[] => {
    if (each === undefined) return [];
    const { item } = each;
    const trained = trainingKeys(kind, item).some(
      (key) => sources(ARMOR_PROFICIENCY, key).length > 0,
    );
    return trained ? [] : [{ kind, item, penalties: penalties[kind] }];
  });
}

/**
 * The rule sources of a d20 test of `stat`: one, of value −1, for each item worn without training
 * whose penalties hold `disadvantage`; none for a stat the rule does not name.
 */
export function trainingSources(untrained: readonly Untrained[], stat: string): BreakdownStep[] {
  if (!UNTRAINED_STATS.includes(stat)) return [];
  return untrained
    .filter(({ penalties }) => penalties.includes('disadvantage'))
    .map(({ kind }) => ({ kind: 'rule', rule: UNTRAINED_RULES[kind], value: -1, change: 0 }));
}

/** The shield worn without training whose penalties take its AC away, if there is one. */
export function shieldWithoutAC(untrained: readonly Untrained[]): Untrained | undefined {
  return untrained.find(
    ({ kind, penalties }) => kind === 'shield' && penalties.includes('noArmorClass'),
  );
}

/**
 * The module's `suppressedEffects`: the effects on `ac.*` targets of the shield worn without
 * training, when its edition takes its AC away. Its other effects still apply.
 */
export function untrainedEffects(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): EntityPartId[] {
  const shield = shieldWithoutAC(untrainedOf(input))?.item;
  if (shield === undefined) return [];
  return (shield.effects ?? [])
    .filter(({ target }) => target.startsWith(AC_TARGET_PREFIX))
    .map(({ id }): EntityPartId => `${shield.id}#${id}`);
}

/** A kind's path: 1 with a step naming the item, and a warning, while it lacks training; else 0. */
function untrainedPath(kind: WornKind, found: Untrained | undefined): DerivedStep {
  if (found === undefined) return () => ({ value: 0, steps: [] });
  const { item, penalties } = found;
  const step: BreakdownStep = {
    kind: 'entity',
    source: item.id,
    label: item.name,
    value: 1,
    change: 1,
  };
  const ruleWarnings: RuleWarning[] = [
    {
      rule: UNTRAINED_RULES[kind],
      data: { item: item.id },
      message: `"${item.id}" is worn without training: ${penalties.join(', ')}.`,
    },
  ];
  return () => ({ value: 1, steps: [step], ruleWarnings });
}

/**
 * The training steps of a character: `armor.untrained`, `shield.untrained`, and
 * `spell.cannotCast`, 1 with a rule step for each item worn without training whose penalties hold
 * `noSpells` (the first changing it by 1), else 0.
 */
export function trainingSteps(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): Record<string, DerivedStep> {
  const untrained = untrainedOf(input);
  const of = (kind: WornKind) => untrained.find((each) => each.kind === kind);
  const noSpells = untrained
    .filter(({ penalties }) => penalties.includes('noSpells'))
    .map(({ kind }, at): BreakdownStep => {
      const change = at === 0 ? 1 : 0;
      return { kind: 'rule', rule: UNTRAINED_RULES[kind], value: 1, change };
    });
  const cannotCast = noSpells.length === 0 ? 0 : 1;
  return {
    [UNTRAINED_PATHS.armor]: untrainedPath('armor', of('armor')),
    [UNTRAINED_PATHS.shield]: untrainedPath('shield', of('shield')),
    [CANNOT_CAST_PATH]: () => ({ value: cannotCast, steps: noSpells }),
  };
}
