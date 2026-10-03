import {
  type ActiveEffect,
  type BreakdownStep,
  type DerivedStep,
  type DeriveInput,
  diceOf,
  type FormulaWarning,
  type KeyReader,
  multiplyDice,
  type ParsedRoll,
  type ParseResult,
  parseRoll,
  type RuleWarning,
  type ValueReader,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import {
  D20_BONUS_PATH,
  levelOf,
  proficiencySources,
  type Source,
  sumOf,
  type TotalPart,
  zeroStep,
} from './checks';
import type { FifthEditionEntity, ItemDef } from './entity-types';
import { equipmentOf, type WornItem } from './equipment';
import { modeEffectsOf, modeOf, ROLL_TARGETS } from './rolls';
import { type HeavyWeaponRule, rulesOf } from './rulesets';
import { SIZE_PATH } from './size';

// ENG-16: fifth edition's weapon attacks (SPEC §6.1 step 5). Each equipped weapon is numbers under
// `attacks.<its key>`: whether the character is proficient, the attack bonus, the damage bonus
// added to the item's own dice, and in 2024 whether it uses the weapon's mastery property. What a
// feature or an item adds is its effect on the targets given here (SPEC §5.4): `attack.weapon.*`,
// `damage.weapon.*`, `crit.range`. The rules are ENG-16 §8's; the fixed-damage one is its
// edition's (`rulesets/`).
// ENG-34: each attack's roll mode, `attacks.<key>.mode`, with the Heavy property's disadvantage by
// the edition's `heavyWeapon`; what a natural d20 face does, and a critical hit's damage dice.

/** The lowest d20 face a weapon attack scores a critical hit on, before any feature (§8). */
export const CRITICAL_FACE = 20;

/** The critical range's path (SPEC §5.4): Improved Critical's `min 19`. */
export const CRIT_RANGE_PATH = 'crit.range';

/** The stat a weapon attack uses, by the weapon's kind: melee Strength, ranged Dexterity (§8). */
export const ATTACK_STATS = { melee: 'str', ranged: 'dex' } as const;

/** The weapon property that lets an attack use either stat of `ATTACK_STATS` (§8). */
export const FINESSE = 'finesse';

/** The weapon property that gives disadvantage by the edition's `heavyWeapon` (ENG-34 §8). */
export const HEAVY = 'heavy';

/** How many times a critical hit rolls an attack's damage dice (ENG-34 §8). */
export const CRITICAL_DICE = 2;

/** The proficiency category whose keys are weapons (`simple`, `martial`, a weapon's `key`). */
export const WEAPON_PROFICIENCY = 'weapon';

/** The proficiency category whose keys are the kinds of weapons whose mastery is used (2024). */
export const MASTERY_PROFICIENCY = 'mastery';

/** A weapon's kind: melee or ranged. */
export type WeaponKind = keyof typeof ATTACK_STATS;

/** The weapon kinds, each with its own bonus targets. */
const WEAPON_KINDS = Object.keys(ATTACK_STATS) as WeaponKind[];

/** What every attack with a weapon of `kind` adds (SPEC §5.4: Archery's `ranged`). */
export function attackBonusPath(kind: WeaponKind): string {
  return `attack.weapon.${kind}.bonus`;
}

/** What every damage roll with a weapon of `kind` adds (SPEC §5.4). */
export function damageBonusPath(kind: WeaponKind): string {
  return `damage.weapon.${kind}.bonus`;
}

/** The paths of a weapon's attack: `attacks.<key>`, then `.prof`, `.hit`, `.damage`, `.mastery`. */
export function attackPath(key: string): string {
  return `attacks.${key}`;
}

type Weapon = NonNullable<ItemDef['weapon']>;

/** The stat a weapon attacks with: its kind's, or with finesse the higher, Strength when equal. */
function statOf(weapon: Weapon, read: ValueReader): string {
  const own = ATTACK_STATS[weapon.kind];
  if (!(weapon.properties ?? []).includes(FINESSE)) return own;
  const { melee, ranged } = ATTACK_STATS;
  return read(`abilities.${ranged}.mod`) > read(`abilities.${melee}.mod`) ? ranged : melee;
}

/** The weapon's magic bonus as a part of a total, when its magic works (ENG-44). */
function magicPart({ item, magic }: WornItem): TotalPart[] {
  const bonus = magic ? item.magic?.bonus : undefined;
  if (bonus === undefined) return [];
  return [
    { step: { kind: 'entity', source: item.id, label: item.name, value: bonus, change: bonus } },
  ];
}

/** Whether the item uses its mastery: 1 with the first source's step, else 0 with none. */
function masteryOf(sources: readonly Source[]): DerivedStep {
  const [first] = sources;
  if (first === undefined) return zeroStep;
  return () => ({ value: 1, steps: [{ ...first.step, value: 1, change: 1 }] });
}

/**
 * The Heavy property's disadvantage, when `weapon` has it: by `size`, the character's size is one
 * of the rule's; by `score`, the score of the weapon kind's stat is below the rule's. A size not
 * chosen gives none.
 */
function heavySources(
  weapon: Weapon,
  rule: HeavyWeaponRule,
  read: ValueReader,
  readKey: KeyReader,
): BreakdownStep[] {
  if (!(weapon.properties ?? []).includes(HEAVY)) return [];
  const heavy: BreakdownStep = { kind: 'rule', rule: 'heavyWeapon', value: -1, change: 0 };
  if (rule.by === 'size') {
    const size = readKey(SIZE_PATH);
    return size !== undefined && rule.sizes.includes(size) ? [heavy] : [];
  }
  return read(`abilities.${ATTACK_STATS[weapon.kind]}.score`) < rule.min ? [heavy] : [];
}

/** The paths of one weapon with a key: its proficiency, attack, roll mode, damage and mastery. */
function weaponSteps(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
  sources: (category: string, key: string) => Source[],
  effects: readonly ActiveEffect[],
  worn: WornItem,
  key: string,
  weapon: Weapon,
): Record<string, DerivedStep> {
  const path = attackPath(key);
  const magic = magicPart(worn);
  const steps: Record<string, DerivedStep> = {
    [`${path}.prof`]: levelOf([
      ...sources(WEAPON_PROFICIENCY, weapon.group),
      ...sources(WEAPON_PROFICIENCY, key),
    ]),
    [`${path}.hit`]: (read, ...rest) =>
      sumOf([
        { path: `abilities.${statOf(weapon, read)}.mod` },
        { profLevel: `${path}.prof` },
        { path: attackBonusPath(weapon.kind) },
        ...magic,
        { path: D20_BONUS_PATH },
      ])(read, ...rest),
    [`${path}.mode`]: (read, readBy, readKey) =>
      modeOf(
        effects,
        ROLL_TARGETS.weaponAttack(weapon.kind),
        heavySources(weapon, rulesOf(input.character).heavyWeapon, read, readKey),
        readBy,
      ),
  };

  const damage = weapon.damage;
  if (damage !== undefined) {
    // A formula that does not parse is taken as dice, and warned.
    const parsed = parseRoll(damage.formula);
    const fixed = parsed.ok && diceOf(parsed.formula).length === 0;
    const warnings: FormulaWarning[] = parsed.ok ? [] : [parsed.error];
    const modifier = rulesOf(input.character).fixedDamageModifier || !fixed;
    steps[`${path}.damage`] = (read, ...rest) => {
      const mod = `abilities.${statOf(weapon, read)}.mod`;
      const total = sumOf([
        modifier
          ? { path: mod }
          : { step: { kind: 'rule', rule: 'fixedDamage', value: read(mod), change: 0 } },
        { path: damageBonusPath(weapon.kind) },
        ...magic,
      ])(read, ...rest);
      return warnings.length === 0 ? total : { ...total, warnings };
    };
  }

  if (weapon.mastery !== undefined) {
    steps[`${path}.mastery`] = masteryOf(sources(MASTERY_PROFICIENCY, key));
  }
  return steps;
}

/**
 * The attack steps of a character: `crit.range`; each weapon kind's `attack.weapon.<kind>.bonus`
 * and `damage.weapon.<kind>.bonus`; then each equipped weapon's `attacks.<key>.*`, in inventory
 * order. A weapon with no key, or a key an earlier one took, has no attack: its kind's attack
 * bonus warns of it.
 */
export function attackSteps(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): Record<string, DerivedStep> {
  const critical: BreakdownStep = {
    kind: 'rule',
    rule: 'criticalHit',
    value: CRITICAL_FACE,
    change: CRITICAL_FACE,
  };
  const steps: Record<string, DerivedStep> = {
    [CRIT_RANGE_PATH]: () => ({ value: CRITICAL_FACE, steps: [critical] }),
  };

  const sources = proficiencySources(input.gathered);
  const effects = modeEffectsOf(input);
  const warned = new Map<WeaponKind, RuleWarning[]>(WEAPON_KINDS.map((kind) => [kind, []]));
  const taken = new Map<string, ItemDef>();
  for (const worn of equipmentOf(input.character, input.find).weapons) {
    const { item } = worn;
    const weapon = item.weapon;
    if (weapon === undefined) continue;
    const kept = item.key === undefined ? undefined : taken.get(item.key);
    if (item.key === undefined) {
      warned.get(weapon.kind)?.push({
        rule: 'weaponWithoutKey',
        data: { item: item.id },
        message: `"${item.id}" is an equipped weapon with no key, so it has no attack paths.`,
      });
    } else if (kept !== undefined) {
      warned.get(weapon.kind)?.push({
        rule: 'weaponKeyTaken',
        data: { item: item.id, kept: kept.id },
        message: `"${item.id}" has the key "${item.key}" of the equipped "${kept.id}"; only "${kept.id}" has an attack.`,
      });
    } else {
      taken.set(item.key, item);
      Object.assign(steps, weaponSteps(input, sources, effects, worn, item.key, weapon));
    }
  }

  for (const kind of WEAPON_KINDS) {
    const ruleWarnings = warned.get(kind) ?? [];
    steps[attackBonusPath(kind)] =
      ruleWarnings.length === 0 ? zeroStep : () => ({ value: 0, steps: [], ruleWarnings });
    steps[damageBonusPath(kind)] = zeroStep;
  }
  return steps;
}

/** What an attack roll's natural d20 face gives: a critical hit, a miss, or its total decides. */
export type AttackOutcome = 'criticalHit' | 'automaticMiss' | 'byTotal';

/**
 * An attack roll's outcome by its natural d20 face (ENG-34 §8): a 1 misses whatever the total, a
 * 20 or a face at or above `range` is a critical hit, any other face is compared by its total.
 * `range` is a weapon attack's `crit.range`; a spell attack's is `CRITICAL_FACE`. A face that is
 * not a whole number from 1 to 20 is compared by its total.
 */
export function attackOutcome(natural: number, range: number = CRITICAL_FACE): AttackOutcome {
  if (!Number.isInteger(natural) || natural < 1 || natural > CRITICAL_FACE) return 'byTotal';
  if (natural === 1) return 'automaticMiss';
  return natural === CRITICAL_FACE || natural >= range ? 'criticalHit' : 'byTotal';
}

/**
 * A critical hit's damage formula: each dice term of `formula` rolled twice, numbers and paths as
 * they are (ENG-34 §8). Gives the core's error for a formula that does not parse or grows past its
 * limits; never throws.
 */
export function criticalDamage(formula: string): ParseResult<ParsedRoll> {
  return multiplyDice(formula, CRITICAL_DICE);
}
