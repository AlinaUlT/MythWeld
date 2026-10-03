import {
  type ActiveEffect,
  activeEffects,
  type BreakdownStep,
  type Derived,
  type DerivedStep,
  type DeriveInput,
  type EffectWarning,
  type PartReader,
  type RollModeOp,
  rollModeEffects,
} from '@grimoire/engine';
import type { WeaponKind } from './attacks';
import type { FifthEditionCharacter } from './character';
import { RULE_STATS } from './combat';
import type { FifthEditionEntity, ItemDef } from './entity-types';
import { equipmentOf } from './equipment';

// ENG-34: fifth edition's roll modes (SPEC §6.5). Each d20 test has advantage (1), disadvantage
// (−1) or neither (0), from the `advantage` and `disadvantage` effects on the `roll.*` targets it
// reads (SPEC §5.4) and from the module's own rules: the worn armor's Stealth here, a Heavy weapon
// in `attacks.ts`. Any advantage and any disadvantage cancel, however many of each: one rule in
// both editions (ENG-34 §8). A passive value adds 5 × its skill's mode (`checks.ts`).

/** A roll's mode: advantage 1, disadvantage −1, neither 0 (dnd5e's values, ENG-34 §8). */
export type RollMode = -1 | 0 | 1;

/** The sign each op gives a roll's mode. */
export const ROLL_MODE_SIGNS: Readonly<Record<RollModeOp, 1 | -1>> = {
  advantage: 1,
  disadvantage: -1,
};

/** The skill whose checks the worn armor's `stealthDisadvantage` names (ENG-34 §8). */
export const STEALTH_SKILL = 'stealth';

/** The d20 a roll of each mode rolls: two, the higher or the lower kept (§8). */
export const D20_ROLLS = { normal: '1d20', advantage: '2d20kh1', disadvantage: '2d20kl1' } as const;

/**
 * The mode sources of these signs give: advantage when one is above 0, disadvantage when one is
 * below, neither when there are both or none.
 */
export function rollModeOf(signs: readonly number[]): RollMode {
  const advantage = signs.some((sign) => sign > 0);
  const disadvantage = signs.some((sign) => sign < 0);
  if (advantage === disadvantage) return 0;
  return advantage ? 1 : -1;
}

/** The d20 formula of a roll whose mode is `mode`: above 0 advantage, below 0 disadvantage. */
export function d20Formula(mode: number): string {
  if (mode > 0) return D20_ROLLS.advantage;
  if (mode < 0) return D20_ROLLS.disadvantage;
  return D20_ROLLS.normal;
}

/** The `roll.*` targets an ability check of `stat` reads. */
function checkTargets(stat: string): string[] {
  return [`roll.check.${stat}`, 'roll.check.all'];
}

/** The `roll.*` targets a save of `stat` reads. */
function saveTargets(stat: string): string[] {
  return [`roll.save.${stat}`, 'roll.save.all'];
}

/**
 * The `roll.*` targets each d20 test reads (SPEC §5.4, with `roll.check.all`): a skill check and
 * initiative are ability checks of their stat; a death save is a save (ENG-34 §8). The roll dialog
 * matches a situational effect to a test by them.
 */
export const ROLL_TARGETS = {
  check: checkTargets,
  save: saveTargets,
  skill: (key: string, stat: string): string[] => [`roll.skill.${key}`, ...checkTargets(stat)],
  init: (): string[] => ['roll.init', ...checkTargets(RULE_STATS.initiative)],
  weaponAttack: (kind: WeaponKind): string[] => [`roll.attack.weapon.${kind}`, 'roll.attack.all'],
  spellAttack: (): string[] => ['roll.attack.spell', 'roll.attack.all'],
  deathSave: (): string[] => ['roll.deathSave', 'roll.save.all'],
} as const;

/** The path of each d20 test's mode; a weapon attack's is `attacks.<key>.mode` (`attacks.ts`). */
export const ROLL_MODE_PATHS = {
  check: (stat: string) => `checks.${stat}.mode`,
  save: (stat: string) => `abilities.${stat}.saveMode`,
  skill: (key: string) => `skills.${key}.mode`,
  init: 'init.mode',
  spellAttack: 'spell.attackMode',
  deathSave: 'deathSave.mode',
} as const;

/** The effects of the character that apply, read by every mode. */
export function modeEffectsOf({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): ActiveEffect[] {
  return activeEffects(gathered.entities, character.state.toggles);
}

/**
 * A test's mode: its rule `sources`, each a step whose `value` is its sign, then each effect on
 * `targets` that applies, in the effects' order, each `when` read through `readBy(part)`. Every
 * step is a source: its `value` is its sign and its `change` what it moved the mode, so the
 * changes add up to the mode and the values are what `rollModeOf` reads.
 */
export function modeOf(
  effects: readonly ActiveEffect[],
  targets: readonly string[],
  sources: readonly BreakdownStep[],
  readBy: PartReader,
): Derived {
  const effectWarnings: EffectWarning[] = [];
  const given = rollModeEffects(
    effects,
    targets,
    (active) => ({ read: readBy(active.part) }),
    (warning) => effectWarnings.push(warning),
  );
  const all: BreakdownStep[] = [
    ...sources,
    ...given.map(({ op, part, source, label }): BreakdownStep => {
      const value = ROLL_MODE_SIGNS[op];
      return { kind: 'effect', part, source, label, op, value, change: 0 };
    }),
  ];
  const signs: number[] = [];
  let mode: RollMode = 0;
  const steps = all.map((step): BreakdownStep => {
    signs.push(step.value);
    const next = rollModeOf(signs);
    const change = next - mode;
    mode = next;
    return { ...step, change };
  });
  return effectWarnings.length === 0
    ? { value: mode, steps }
    : { value: mode, steps, effectWarnings };
}

/** The worn armor's disadvantage on Stealth, when the armor has `stealthDisadvantage` (§8). */
function stealthSources(armor: ItemDef | undefined): BreakdownStep[] {
  if (armor?.armor?.stealthDisadvantage !== true) return [];
  const { id: source, name: label } = armor;
  return [{ kind: 'entity', source, label, value: -1, change: 0 }];
}

/**
 * The roll modes of a character but its weapon attacks': each stat's check and, with a save, its
 * save; each skill's, by the stat its key path gives; initiative's; every spell attack's; the death
 * save's.
 */
export function rollModeSteps(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): Record<string, DerivedStep> {
  const effects = modeEffectsOf(input);
  const step =
    (targets: readonly string[]): DerivedStep =>
    (_, readBy) =>
      modeOf(effects, targets, [], readBy);

  const steps: Record<string, DerivedStep> = {};
  for (const { key, hasSave } of input.stats) {
    steps[ROLL_MODE_PATHS.check(key)] = step(ROLL_TARGETS.check(key));
    if (hasSave) steps[ROLL_MODE_PATHS.save(key)] = step(ROLL_TARGETS.save(key));
  }
  const stealth = stealthSources(equipmentOf(input.character, input.find).armor?.item);
  for (const [key, skill] of Object.entries(input.gathered.byKey.skill ?? {})) {
    if (skill.type !== 'skill') continue;
    const sources = key === STEALTH_SKILL ? stealth : [];
    steps[ROLL_MODE_PATHS.skill(key)] = (_, readBy, readKey) => {
      const stat = readKey(`skills.${key}.ability`) ?? skill.ability;
      return modeOf(effects, ROLL_TARGETS.skill(key, stat), sources, readBy);
    };
  }
  steps[ROLL_MODE_PATHS.init] = step(ROLL_TARGETS.init());
  steps[ROLL_MODE_PATHS.spellAttack] = step(ROLL_TARGETS.spellAttack());
  steps[ROLL_MODE_PATHS.deathSave] = step(ROLL_TARGETS.deathSave());
  return steps;
}
