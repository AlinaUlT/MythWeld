import {
  type ActiveEffect,
  activeEffects,
  type BreakdownStep,
  CONDITION_TYPE,
  type DerivedStep,
  type DeriveInput,
  type EffectWarning,
  effectApplies,
  type FormulaValue,
  numberChangeOf,
  type RuleWarning,
} from '@grimoire/engine';
import { type Effect, entityKeySchema } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// SHEET-15: resistances, immunities and vulnerabilities (SPEC §5.4 `defenses.*`). An effect
// appends a key to one of four lists: a damage type's to `defenses.resist`, `immune` or `vuln`,
// a condition's to `defenses.conditionImmune`. Each key appended is a number path of its own,
// `defenses.<list>.<key>`: 1 while an effect appending it applies, else 0, with a step for each
// such effect, the first changing it by 1 ("multiple instances ... count as only one", SHEET-15
// §8). So its breakdown names the sources, a formula reads it, and an override of 0 takes it away.
// A key no entry of its type has still counts, and warns `defenseMissing` (SPEC §8.2).

/** The first step of every defense's path. */
export const DEFENSES_PATH = 'defenses';

/** The entity type whose keys a damage's `type` names (`entity-types.ts`). */
export const DAMAGE_TYPE = 'damageType';

/** Each list of defenses, and the entity type whose keys it holds (SPEC §5.4). */
export const DEFENSE_LISTS = {
  resist: DAMAGE_TYPE,
  immune: DAMAGE_TYPE,
  vuln: DAMAGE_TYPE,
  conditionImmune: CONDITION_TYPE,
} as const;
export type DefenseList = keyof typeof DEFENSE_LISTS;

/** A list's keys, each with its path's value above 0, in the order their paths were computed. */
export type Defenses = Readonly<Record<DefenseList, readonly string[]>>;

/** The rules a defense's warnings are named by. */
export const DEFENSE_RULES = {
  missing: 'defenseMissing',
  notAppended: 'defenseNotAppended',
  notAKey: 'defenseNotAKey',
} as const;

/** The path of a key in a list of defenses. */
export function defensePath(list: DefenseList, key: string): string {
  return `${DEFENSES_PATH}.${list}.${key}`;
}

/** The list an effect's target names, when it names one. */
function listOf(target: string): DefenseList | undefined {
  const [first, list, ...rest] = target.split('.');
  if (first !== DEFENSES_PATH || rest.length > 0) return undefined;
  return Object.keys(DEFENSE_LISTS).find((each): each is DefenseList => each === list);
}

/** The key an effect appends to a list, when its op is `append` and its value is a key. */
function appendedKey(effect: Effect): string | undefined {
  if (effect.op !== 'append') return undefined;
  return entityKeySchema.safeParse(effect.value).success ? effect.value : undefined;
}

/**
 * The effects on the four lists, each with its list: the active ones, or with `allSwitched`
 * every one a switch would make active too.
 */
function defenseEffects(
  { character, gathered }: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
  allSwitched = false,
): [DefenseList, ActiveEffect][] {
  const toggles = allSwitched
    ? Object.fromEntries(
        gathered.entities.flatMap(({ entity }) =>
          (entity.effects ?? []).map(({ id }) => [`${entity.id}#${id}`, true]),
        ),
      )
    : character.state.toggles;
  return activeEffects(gathered.entities, toggles).flatMap((active) => {
    const list = listOf(active.effect.target);
    return list === undefined ? [] : [[list, active]];
  });
}

/**
 * The defense steps of a character: a path for each key an effect appends to a list, whatever
 * its `when` or its switch says now, so a formula reads it either way.
 */
export function defenseSteps(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): Record<string, DerivedStep> {
  const on = new Set(defenseEffects(input).map(([, { part }]) => part));
  const byPath = new Map<string, { list: DefenseList; key: string; effects: ActiveEffect[] }>();
  for (const [list, active] of defenseEffects(input, true)) {
    const key = appendedKey(active.effect);
    if (key === undefined) continue;
    const path = defensePath(list, key);
    const given = byPath.get(path) ?? { list, key, effects: [] };
    byPath.set(path, given);
    given.effects.push(active);
  }
  const steps: Record<string, DerivedStep> = {};
  for (const [path, { list, key, effects }] of byPath) {
    const type = DEFENSE_LISTS[list];
    const found = input.findKey(type, key) !== undefined;
    steps[path] = (_, readBy) => {
      const effectWarnings: EffectWarning[] = [];
      const parts: BreakdownStep[] = [];
      for (const active of effects) {
        const { part, source, label } = active;
        if (!on.has(part)) continue;
        const reader = { read: readBy(part) };
        if (!effectApplies(active, reader, (warning) => effectWarnings.push(warning))) continue;
        const change = parts.length === 0 ? 1 : 0;
        parts.push({ kind: 'effect', part, source, label, op: 'append', value: 1, change });
      }
      const value = parts.length === 0 ? 0 : 1;
      const ruleWarnings: RuleWarning[] =
        value === 0 || found
          ? []
          : [
              {
                rule: DEFENSE_RULES.missing,
                data: { list, key },
                message: `Missing: ${type} "${key}" (${path}); it still counts.`,
              },
            ];
      return { value, steps: parts, effectWarnings, ruleWarnings };
    };
  }
  return steps;
}

/**
 * What the module warns of an effect on a list that gives it no key: an op other than `append`
 * or `note` (a number op is the phases' `noTarget`), or an `append` whose value is not a key.
 */
export function defenseWarnings(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): RuleWarning[] {
  return defenseEffects(input).flatMap(([list, { effect, part }]): RuleWarning[] => {
    const { op, value, target } = effect;
    if (op === 'note' || numberChangeOf(effect) !== undefined) return [];
    if (op !== 'append') {
      return [
        {
          rule: DEFENSE_RULES.notAppended,
          data: { part, list, op },
          message: `"${part}" (${op}) appends no key to ${target}; it is not used.`,
        },
      ];
    }
    if (appendedKey(effect) !== undefined) return [];
    return [
      {
        rule: DEFENSE_RULES.notAKey,
        data: { part, list },
        message: `"${part}" appends ${JSON.stringify(value)} to ${target}, which is not a key; it is not used.`,
      },
    ];
  });
}

/** The character's defenses, read from its computed values: each key whose path is above 0. */
export function defensesOf(values: Readonly<Record<string, FormulaValue>>): Defenses {
  const lists: Record<DefenseList, string[]> = {
    resist: [],
    immune: [],
    vuln: [],
    conditionImmune: [],
  };
  for (const [path, value] of Object.entries(values)) {
    const [first, list, key, ...rest] = path.split('.');
    if (first !== DEFENSES_PATH || key === undefined || rest.length > 0) continue;
    const named = listOf(`${DEFENSES_PATH}.${list}`);
    if (named !== undefined && typeof value === 'number' && value > 0) lists[named].push(key);
  }
  return lists;
}

// SHEET-16: damage of a type meets the defenses in the order both SRDs give: immunity takes it
// all, else resistance halves it, rounded down, then vulnerability doubles it (SHEET-16 §8). The
// amount it starts from is the damage after every other change: the person types it.

/** The lists damage of a type meets, in the order it meets them. */
export const DAMAGE_DEFENSES = [
  'immune',
  'resist',
  'vuln',
] as const satisfies readonly DefenseList[];
export type DamageDefense = (typeof DAMAGE_DEFENSES)[number];

/**
 * A defense that changed damage: its list, its path, whose breakdown names its sources, and the
 * damage after it.
 */
export interface DefenseStep {
  list: DamageDefense;
  path: string;
  amount: number;
}

/** What the defenses made of damage of a type. */
export interface DefendedDamage {
  /** The damage dealt, before the defenses. */
  dealt: number;
  /** The damage type's key. */
  type: string;
  /** Each defense that applied, in order. */
  steps: DefenseStep[];
  /** The damage taken. */
  amount: number;
}

/** What `dealt` damage of `type` comes to against `defenses` (`defensesOf`). */
export function defendedDamage(dealt: number, type: string, defenses: Defenses): DefendedDamage {
  const steps: DefenseStep[] = [];
  let amount = dealt;
  for (const list of DAMAGE_DEFENSES) {
    if (!defenses[list].includes(type)) continue;
    amount = list === 'immune' ? 0 : list === 'resist' ? Math.floor(amount / 2) : amount * 2;
    steps.push({ list, path: defensePath(list, type), amount });
    if (amount === 0) break;
  }
  return { dealt, type, steps, amount };
}
