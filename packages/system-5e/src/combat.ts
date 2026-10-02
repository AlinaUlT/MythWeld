import {
  activeEffects,
  appendedNumbers,
  type BreakdownStep,
  type Derived,
  type DerivedStep,
  type DeriveInput,
  type EffectWarning,
  type RuleWarning,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity, ItemDef, LineageDef, SpeciesDef } from './entity-types';
import { type Equipment, type ExtraItem, equipmentOf, type WornItem } from './equipment';
import { ARMOR_GROUPS, SPEED_KINDS } from './system';

// ENG-14: fifth edition's combat numbers (SPEC §6.1 step 5): the hit point maximum, armor class,
// initiative and speeds, one rule in both editions (ENG-14 §8). What an item, a feat or a
// condition adds is its effect on a target given here (`hp.max.bonus`, `ac.bonus`, `ac.formulas`,
// `init.bonus`, `speed.*`); a total adds its parts as `path` steps, as ENG-13's do. ENG-44: the
// armor and the shield worn are `equipmentOf`'s. ENG-45: armor whose Strength requirement is above
// its wearer's Strength takes 10 feet from every speed, through `speed.armorReduction`, which an
// effect may set to 0 (the SRD 5.1 dwarf, ENG-45 §8).

/**
 * The stats the rules name: initiative and AC read Dexterity, hit points Constitution (ENG-14 §8);
 * an armor's Strength requirement, Strength (ENG-45 §8).
 */
export const RULE_STATS = {
  initiative: 'dex',
  armorClass: 'dex',
  hitPoints: 'con',
  armorStrength: 'str',
} as const;

/** AC without armor, before the Dexterity modifier (SRD 5.2.1; dnd5e `unarmored`). */
export const UNARMORED_AC = 10;

/** The list effects add AC candidates to (SPEC §5.4 `ac.formulas`). */
export const AC_FORMULAS = 'ac.formulas';

/** The feet armor takes from every speed when its wearer lacks its Strength (ENG-45 §8). */
export const ARMOR_SPEED_REDUCTION = 10;

/** The path of that reduction: 0 or `ARMOR_SPEED_REDUCTION`, then its effects. */
export const ARMOR_REDUCTION_PATH = 'speed.armorReduction';

/** A level's hit points as stored: a number rolled, the die's average, or its maximum. */
export type LevelHitPoints = FifthEditionCharacter['systemData']['classes'][number]['hp'][number];

/** A level's hit points before Constitution: `max` the die, `avg` half the die + 1 (dnd5e). */
export function hitPointsOf(die: number, entry: LevelHitPoints): number {
  if (entry === 'max') return die;
  if (entry === 'avg') return die / 2 + 1;
  return entry;
}

/** A path whose value is 0 until an effect changes it. */
const zero: DerivedStep = () => ({ value: 0, steps: [] });

/** A total of other paths, each a `path` step. */
function sumOf(paths: readonly string[]): DerivedStep {
  return (read) => {
    const steps = paths.map((path): BreakdownStep => {
      const value = read(path);
      return { kind: 'path', path, value, change: value };
    });
    return { value: steps.reduce((sum, step) => sum + step.change, 0), steps };
  };
}

/** A path that is 1 when `item` is worn, with a step naming it; else 0. */
function presence(item: ItemDef | undefined): DerivedStep {
  return () =>
    item === undefined
      ? { value: 0, steps: [] }
      : {
          value: 1,
          steps: [{ kind: 'entity', source: item.id, label: item.name, value: 1, change: 1 }],
        };
}

/** `presence` of the item worn, warning of each one of its category that counts for nothing. */
function wornOf(worn: WornItem | undefined, extra: readonly ExtraItem[]): DerivedStep {
  const ruleWarnings: RuleWarning[] = extra.map(({ item, worn: first }) => ({
    rule: 'oneAtATime',
    data: { item: item.id, worn: first.id },
    message: `"${item.id}" is equipped while "${first.id}" is worn; only one counts at a time, so "${item.id}" counts for nothing.`,
  }));
  const step = presence(worn?.item);
  return (...read) => ({ ...step(...read), ruleWarnings });
}

/** The magic bonuses of the armor and the shield worn, each when its magic works (ENG-44 §8). */
function magicBonus({ armor, shield }: Equipment): DerivedStep {
  const steps: BreakdownStep[] = [];
  for (const worn of [armor, shield]) {
    const bonus = worn?.magic === true ? worn.item.magic?.bonus : undefined;
    if (worn === undefined || bonus === undefined) continue;
    const { id: source, name: label } = worn.item;
    steps.push({ kind: 'entity', source, label, value: bonus, change: bonus });
  }
  const value = steps.reduce((sum, step) => sum + step.change, 0);
  return () => ({ value, steps });
}

/** The hit point maximum: each class's levels, Constitution per level (at least 1), the bonus. */
function hitPoints({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): DerivedStep {
  const had = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity]));
  return (read) => {
    const con = `abilities.${RULE_STATS.hitPoints}.mod`;
    const mod = read(con);
    const steps: BreakdownStep[] = [];
    const ruleWarnings: RuleWarning[] = [];
    let levels = 0;
    let raised = 0;
    for (const { id, hp } of character.systemData.classes) {
      const entity = had.get(id);
      if (entity?.type !== 'class') continue;
      const die = entity.hitDie;
      let sum = 0;
      for (const [at, entry] of hp.entries()) {
        let value = hitPointsOf(die, entry);
        if (value > die) {
          ruleWarnings.push({
            rule: 'hitPointsAboveDie',
            data: { class: id, level: at + 1, value, die },
            message: `"${id}" stores ${value} hit points at its level ${at + 1}, above its d${die}; ${die} is used.`,
          });
          value = die;
        }
        sum += value;
        raised += Math.max(1 - (value + mod), 0);
      }
      levels += hp.length;
      steps.push({
        kind: 'entity',
        source: entity.id,
        label: entity.name,
        value: sum,
        change: sum,
      });
    }
    steps.push({ kind: 'path', path: con, value: mod, change: mod * levels });
    if (raised > 0) {
      steps.push({ kind: 'rule', rule: 'hitPointsMinimum', value: 1, change: raised });
    }
    const bonus = read('hp.max.bonus');
    steps.push({ kind: 'path', path: 'hp.max.bonus', value: bonus, change: bonus });
    return { value: steps.reduce((sum, step) => sum + step.change, 0), steps, ruleWarnings };
  };
}

/**
 * The base AC: the highest of the module's own candidate (the worn armor's, else 10 + DEX) and
 * each number an effect appends to `ac.formulas`, the first of equal ones.
 */
function armorClassBase(
  { character, gathered }: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
  armor: ItemDef | undefined,
): DerivedStep {
  return (read, readBy) => {
    const dexPath = `abilities.${RULE_STATS.armorClass}.mod`;
    const dex = read(dexPath);
    const worn = armor?.armor;
    let best: Derived;
    if (armor !== undefined && worn !== undefined) {
      // `dexCap` 0 adds none, not even a negative one; `null` adds all (ENG-14 §8).
      const { baseAC, dexCap } = worn;
      const adds = dexCap === null ? dex : dexCap === 0 ? 0 : Math.min(dex, dexCap);
      const steps: BreakdownStep[] = [
        { kind: 'entity', source: armor.id, label: armor.name, value: baseAC, change: baseAC },
      ];
      if (dexCap !== 0) steps.push({ kind: 'path', path: dexPath, value: dex, change: adds });
      best = { value: baseAC + adds, steps };
    } else {
      best = {
        value: UNARMORED_AC + dex,
        steps: [
          { kind: 'rule', rule: 'unarmoredAC', value: UNARMORED_AC, change: UNARMORED_AC },
          { kind: 'path', path: dexPath, value: dex, change: dex },
        ],
      };
    }
    const effectWarnings: EffectWarning[] = [];
    const appended = appendedNumbers(
      activeEffects(gathered.entities, character.state.toggles),
      AC_FORMULAS,
      (active) => ({ read: readBy(active.part) }),
      (warning) => effectWarnings.push(warning),
    );
    for (const { value, part, source, label } of appended) {
      if (value <= best.value) continue;
      best = {
        value,
        steps: [{ kind: 'effect', part, source, label, op: 'append', value, change: value }],
      };
    }
    return { ...best, effectWarnings };
  };
}

/** The feet the armor worn takes from every speed: 10 when its Strength requirement is not met. */
function armorReduction(armor: ItemDef | undefined): DerivedStep {
  const needs = armor?.armor?.strRequirement;
  return (read) => {
    if (armor === undefined || needs === undefined) return { value: 0, steps: [] };
    const path = `abilities.${RULE_STATS.armorStrength}.score`;
    const score = read(path);
    // "Equal to or higher than the listed score" is enough (ENG-45 §8).
    if (score >= needs) return { value: 0, steps: [] };
    const value = ARMOR_SPEED_REDUCTION;
    return {
      value,
      steps: [
        { kind: 'entity', source: armor.id, label: armor.name, value: needs, change: 0 },
        { kind: 'path', path, value: score, change: 0 },
        { kind: 'rule', rule: 'armorStrength', value, change: value },
      ],
    };
  };
}

/** The species, and each lineage with speeds of its own, the character has. */
function speedSources({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): (SpeciesDef | LineageDef)[] {
  const id = character.systemData.species?.id;
  const lineages: LineageDef[] = [];
  let species: SpeciesDef | undefined;
  for (const { entity } of gathered.entities) {
    if (entity.type === 'lineage' && entity.speed !== undefined) lineages.push(entity);
    if (entity.type === 'species' && entity.id === id) species = entity;
  }
  return species === undefined ? lineages : [...lineages, species];
}

/**
 * A kind of speed: its source's (a lineage's own before the species'), − the armor's reduction, +
 * its bonus + every speed's, at least 0, × the multiplier rounded down. A speed the character
 * lacks is 0.
 */
function speedOf(
  kind: (typeof SPEED_KINDS)[number],
  sources: readonly (SpeciesDef | LineageDef)[],
): DerivedStep {
  const giver = sources.find(({ speed }) => speed?.[kind] !== undefined);
  const base = giver?.speed?.[kind] ?? 0;
  return (read) => {
    if (giver === undefined || base <= 0) return { value: 0, steps: [] };
    const reduction = read(ARMOR_REDUCTION_PATH);
    const steps: BreakdownStep[] = [
      { kind: 'entity', source: giver.id, label: giver.name, value: base, change: base },
      // `0 - x`, not `-x`: no reduction is a change of 0, never −0.
      { kind: 'path', path: ARMOR_REDUCTION_PATH, value: reduction, change: 0 - reduction },
    ];
    for (const path of [`speed.${kind}.bonus`, 'speed.all.bonus']) {
      const value = read(path);
      steps.push({ kind: 'path', path, value, change: value });
    }
    let sum = steps.reduce((total, step) => total + step.change, 0);
    if (sum < 0) {
      steps.push({ kind: 'rule', rule: 'speedFloor', value: 0, change: -sum });
      sum = 0;
    }
    const mul = read('speed.all.mul');
    const value = Math.max(0, Math.floor(sum * mul));
    steps.push({ kind: 'path', path: 'speed.all.mul', value: mul, change: value - sum });
    return { value, steps };
  };
}

/**
 * The combat steps of a character: `hp.max.bonus`, `hp.max`; `armor.worn`, `shield`, `ac.bonus`,
 * `ac.base`, `ac.total`; `init.bonus`, `init.total`; `speed.all.bonus`, `speed.all.mul`,
 * `speed.armorReduction`; each armor group's `armor.<group>`; then each kind's speed bonus and
 * speed.
 */
export function combatSteps(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): Record<string, DerivedStep> {
  const equipment = equipmentOf(input.character, input.find);
  const armor = equipment.armor?.item;
  const steps: Record<string, DerivedStep> = {
    'hp.max.bonus': zero,
    'hp.max': hitPoints(input),
    'armor.worn': wornOf(equipment.armor, equipment.extra.armor),
    shield: wornOf(equipment.shield, equipment.extra.shield),
    'ac.bonus': magicBonus(equipment),
    'ac.base': armorClassBase(input, armor),
    'ac.total': sumOf(['ac.base', 'ac.bonus']),
    'init.bonus': zero,
    'init.total': sumOf([`checks.${RULE_STATS.initiative}.total`, 'init.bonus']),
    'speed.all.bonus': zero,
    'speed.all.mul': () => ({
      value: 1,
      steps: [{ kind: 'rule', rule: 'speedMultiplier', value: 1, change: 1 }],
    }),
    [ARMOR_REDUCTION_PATH]: armorReduction(armor),
  };
  for (const group of ARMOR_GROUPS) {
    steps[`armor.${group}`] = presence(armor?.armor?.group === group ? armor : undefined);
  }
  const sources = speedSources(input);
  for (const kind of SPEED_KINDS) {
    steps[`speed.${kind}.bonus`] = zero;
    steps[`speed.${kind}`] = speedOf(kind, sources);
  }
  return steps;
}
