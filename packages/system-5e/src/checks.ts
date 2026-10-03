import {
  type BreakdownStep,
  type DerivedStep,
  type DeriveInput,
  evaluateNumber,
  type Gathered,
  type KeyPath,
  LEVEL_PATH,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { ROLL_MODE_PATHS } from './rolls';

// ENG-13: fifth edition's check bonuses (SPEC §6.1 step 5): the proficiency bonus, ability checks,
// saves, skills and passive values, one rule in both editions (ENG-13 §8). A total adds its parts
// as `path` steps, so an effect on any part shows in the total's breakdown.
// ENG-43: a skill's stat is the key path `skills.<key>.ability`, its own `ability` until an effect
// or an override sets another; its total reads that stat's modifier and check bonus.
// ENG-34: a passive value is 5 higher when its skill's check has advantage, 5 lower with
// disadvantage (`skills.<key>.mode`, `rolls.ts`).

/** The proficiency bonus's path (SPEC §5.6 `@prof`). */
export const PROF_PATH = 'prof';

/** What every d20 test adds: checks, saves, skills, initiative, attacks (SPEC §5.4). */
export const D20_BONUS_PATH = 'd20.all.bonus';

/** What a passive value adds to its check's total (SRD 5.1 Passive Checks; ENG-13 §8). */
export const PASSIVE_BASE = 10;

/** What a passive value gains with advantage on its check, and loses with disadvantage (ENG-34 §8). */
export const PASSIVE_MODE = 5;

/** The proficiency bonus at a character's level: +2 to level 4, then 1 more every 4 levels. */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(level, 1) - 1) / 4);
}

/** A source of a proficiency level: the level it gives, and its step in the breakdown. */
export interface Source {
  level: number;
  step: BreakdownStep;
}

/** A path whose value is 0 until an effect changes it. */
export const zeroStep: DerivedStep = () => ({ value: 0, steps: [] });

/**
 * A part of a total: a path's value, the proficiency bonus times a proficiency level, a number
 * a rule of the system gives (ENG-15: the spell save DC's 8), or a step of its own (ENG-16: a
 * magic weapon's bonus).
 */
export type TotalPart =
  | { path: string }
  | { profLevel: string }
  | { rule: string; value: number }
  | { step: BreakdownStep };

/**
 * A total: each path a `path` step, the proficiency bonus's naming `prof` (SPEC §6.2's "+2 ×2"),
 * each rule's number a `rule` step, each step as it is.
 */
export function sumOf(parts: readonly TotalPart[]): DerivedStep {
  return (read) => {
    const steps = parts.map((part): BreakdownStep => {
      if ('step' in part) return part.step;
      if ('path' in part) {
        const value = read(part.path);
        return { kind: 'path', path: part.path, value, change: value };
      }
      if ('rule' in part) {
        return { kind: 'rule', rule: part.rule, value: part.value, change: part.value };
      }
      const bonus = read(PROF_PATH);
      return {
        kind: 'path',
        path: PROF_PATH,
        value: bonus,
        change: Math.floor(read(part.profLevel) * bonus),
      };
    });
    return { value: steps.reduce((sum, step) => sum + step.change, 0), steps };
  };
}

/**
 * The sources of each proficiency the character's grants give: by category and key, each
 * `proficiency` grant naming it, at its level (1 by default), its step the grant. ENG-16 reads
 * them for weapons as this file does for skills.
 */
export function proficiencySources(
  gathered: Gathered<FifthEditionEntity>,
): (category: string, key: string) => Source[] {
  const names = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity]));
  const grants = new Map(gathered.grants.map((grant) => [grant.part as string, grant]));
  return (category, key) =>
    gathered.proficiencies.flatMap(({ category: each, key: given, level = 1, from }) => {
      const grant = grants.get(from);
      if (each !== category || given !== key || grant === undefined) return [];
      const label = names.get(grant.source)?.name ?? {};
      const step: BreakdownStep = {
        kind: 'grant',
        part: from,
        source: grant.source,
        label,
        value: level,
        change: level,
      };
      return [{ level, step }];
    });
}

/** A proficiency level: the highest its sources give, the first of them its one step; else 0. */
export function levelOf(sources: readonly Source[]): DerivedStep {
  let level = 0;
  let steps: BreakdownStep[] = [];
  for (const source of sources) {
    if (source.level <= level) continue;
    level = source.level;
    steps = [source.step];
  }
  return () => ({ value: level, steps });
}

/**
 * The check steps of a character: `prof`, `d20.all.bonus`, `saves.all.bonus`, `skills.all.bonus`,
 * then each stat's check and save, then each skill's proficiency, total and passive value.
 */
export function checkSteps({
  character,
  gathered,
  stats,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): Record<string, DerivedStep> {
  const names = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity]));
  const granted = proficiencySources(gathered);

  // The first class gives its saves (ENG-13 §8); a later class never does.
  const first = character.systemData.classes[0];
  const firstClass = first === undefined ? undefined : names.get(first.id);
  const classSaves = (key: string): Source[] =>
    firstClass?.type === 'class' && firstClass.saves.includes(key)
      ? [
          {
            level: 1,
            step: {
              kind: 'entity',
              source: firstClass.id,
              label: firstClass.name,
              value: 1,
              change: 1,
            },
          },
        ]
      : [];

  const steps: Record<string, DerivedStep> = {
    [PROF_PATH]: (read) => {
      const bonus = proficiencyBonus(read(LEVEL_PATH));
      return {
        value: bonus,
        steps: [{ kind: 'rule', rule: 'proficiencyBonus', value: bonus, change: bonus }],
      };
    },
    [D20_BONUS_PATH]: zeroStep,
    'saves.all.bonus': zeroStep,
    'skills.all.bonus': zeroStep,
  };

  for (const { key, hasSave } of stats) {
    const mod = { path: `abilities.${key}.mod` };
    const check = `checks.${key}`;
    steps[`${check}.bonus`] = zeroStep;
    steps[`${check}.total`] = sumOf([mod, { path: `${check}.bonus` }, { path: D20_BONUS_PATH }]);
    if (!hasSave) continue;
    const save = `abilities.${key}.save`;
    steps[`${save}Prof`] = levelOf([...classSaves(key), ...granted('save', key)]);
    steps[`${save}Bonus`] = zeroStep;
    steps[save] = sumOf([
      mod,
      { profLevel: `${save}Prof` },
      { path: `${save}Bonus` },
      { path: 'saves.all.bonus' },
      { path: D20_BONUS_PATH },
    ]);
  }

  for (const [key, skill] of Object.entries(gathered.byKey.skill ?? {})) {
    if (skill.type !== 'skill') continue;
    const path = `skills.${key}`;
    steps[`${path}.prof`] = levelOf(granted('skill', key));
    steps[`${path}.bonus`] = zeroStep;
    const own = skill.totalFormula;
    steps[`${path}.total`] =
      own === undefined
        ? (read, readBy, readKey) => {
            const stat = readKey(`${path}.ability`) ?? skill.ability;
            return sumOf([
              { path: `abilities.${stat}.mod` },
              { profLevel: `${path}.prof` },
              { path: `${path}.bonus` },
              { path: 'skills.all.bonus' },
              { path: `checks.${stat}.bonus` },
              { path: D20_BONUS_PATH },
            ])(read, readBy, readKey);
          }
        : (read) => {
            const { value, warnings } = evaluateNumber(own, read);
            const step: BreakdownStep = {
              kind: 'formula',
              formula: own,
              of: 'skill',
              value,
              change: value,
            };
            return { value, steps: [step], warnings };
          };
    if (skill.passive !== true) continue;
    const modePath = ROLL_MODE_PATHS.skill(key);
    steps[`${path}.passive`] = (read) => {
      const total = read(`${path}.total`);
      const mode = read(modePath);
      const change = mode > 0 ? PASSIVE_MODE : mode < 0 ? -PASSIVE_MODE : 0;
      return {
        value: PASSIVE_BASE + total + change,
        steps: [
          { kind: 'rule', rule: 'passiveBase', value: PASSIVE_BASE, change: PASSIVE_BASE },
          { kind: 'path', path: `${path}.total`, value: total, change: total },
          { kind: 'path', path: modePath, value: mode, change },
        ],
      };
    };
  }
  return steps;
}

/**
 * Each skill's stat, `skills.<key>.ability`: its own `ability`, a step naming the skill, and the
 * stats the character has as the keys an effect or an override may set it to.
 */
export function skillKeys({
  gathered,
  stats,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): Record<string, KeyPath> {
  const keys: Record<string, KeyPath> = {};
  const statKeys = stats.map(({ key }) => key);
  for (const [key, skill] of Object.entries(gathered.byKey.skill ?? {})) {
    if (skill.type !== 'skill') continue;
    const { id: source, name: label, ability } = skill;
    keys[`skills.${key}.ability`] = {
      key: ability,
      steps: [{ kind: 'entity', source, label, key: ability }],
      keys: statKeys,
    };
  }
  return keys;
}
