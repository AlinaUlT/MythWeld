import {
  addDice,
  type DerivedStep,
  type FormulaError,
  type FormulaValue,
  LEVEL_PATH,
} from '@grimoire/engine';
import type { SpellDef } from './entity-types';

// ENG-50: a spell's dice for the character's level (ADR 014 item 6). A spell's `scaling` formula
// joins its first damage once per step: for a cantrip, each of `CANTRIP_LEVELS` the character's
// total level has reached, the number `cantrip.upgrades`, which effects and overrides change as any
// other; for another spell, each slot level above its own. The dice are written from that count
// (`addDice`). The rules are ENG-50 §8's, one in both editions.

/** The character levels at which a cantrip's dice grow, one step each (§8: both SRDs). */
export const CANTRIP_LEVELS: readonly number[] = [5, 11, 17];

/** How many steps a cantrip's dice have grown at the character's level. */
export const CANTRIP_UPGRADES_PATH = 'cantrip.upgrades';

/** The steps a cantrip's dice have grown at a character level: each of `CANTRIP_LEVELS` reached. */
export function cantripUpgrades(level: number): number {
  return CANTRIP_LEVELS.filter((at) => level >= at).length;
}

/** `cantrip.upgrades`: one step, the character's level and what it gives. */
export function spellDiceSteps(): Record<string, DerivedStep> {
  return {
    [CANTRIP_UPGRADES_PATH]: (read) => {
      const level = read(LEVEL_PATH);
      const value = cantripUpgrades(level);
      return { value, steps: [{ kind: 'path', path: LEVEL_PATH, value: level, change: value }] };
    },
  };
}

/** One damage of a spell as it rolls now: its roll formula and its damage type's key. */
export interface SpellDamage {
  formula: string;
  type: string;
}

/**
 * Something working out a spell's dice met. `code` and its data are for the screen; `message` is
 * for logs. `missingPath`: the values have no number at `path`, so 0 steps are used.
 * `scalingFormula`: the first damage's formula, the scaling's, or the two joined do not parse, so
 * the damage's own is used. `scalingWithoutDamage`: the spell has no damage for its scaling to join.
 */
export type SpellDiceWarning = { message: string } & (
  | { code: 'missingPath'; path: string }
  | { code: 'scalingFormula'; spell: string; error: FormulaError }
  | { code: 'scalingWithoutDamage'; spell: string }
);

/** A spell's dice now, and how they were made. */
export interface SpellDice {
  /**
   * How many times the spell's `scaling.formula` joins its first damage: for a cantrip the value
   * of `cantrip.upgrades` (its breakdown says why), for another spell the slot levels above its
   * own; 0 without a scaling.
   */
  times: number;
  /** Each damage in order, the first with the scaling joined. */
  damage: SpellDamage[];
  warnings: SpellDiceWarning[];
}

/**
 * A spell's damage on a character whose computed values are `values`, cast with a slot of level
 * `slot` (its own level when not given). `times` counts as a whole number, rounded down, and as 0
 * below 0. Pure; never throws.
 */
export function spellDice(
  spell: Pick<SpellDef, 'id' | 'level' | 'damage' | 'scaling'>,
  values: Readonly<Record<string, FormulaValue>>,
  slot?: number,
): SpellDice {
  const warnings: SpellDiceWarning[] = [];
  const damage = (spell.damage ?? []).map(({ formula, type }) => ({ formula, type }));
  const scaling = spell.scaling;
  if (scaling === undefined) return { times: 0, damage, warnings };

  let steps = 0;
  if (scaling.kind === 'slot') {
    steps = slot === undefined ? 0 : slot - spell.level;
  } else {
    const upgrades = values[CANTRIP_UPGRADES_PATH];
    if (typeof upgrades === 'number') {
      steps = upgrades;
    } else {
      warnings.push({
        code: 'missingPath',
        path: CANTRIP_UPGRADES_PATH,
        message: `Missing: @${CANTRIP_UPGRADES_PATH}; "${spell.id}" uses its own dice.`,
      });
    }
  }
  const times = Number.isFinite(steps) ? Math.max(Math.floor(steps), 0) : 0;

  const [first, ...rest] = damage;
  if (first === undefined) {
    warnings.push({
      code: 'scalingWithoutDamage',
      spell: spell.id,
      message: `"${spell.id}" has a scaling and no damage for it to join.`,
    });
    return { times, damage, warnings };
  }
  const joined = addDice(first.formula, scaling.formula, times);
  if (!joined.ok) {
    warnings.push({
      code: 'scalingFormula',
      spell: spell.id,
      error: joined.error,
      message: `${joined.error.message} ("${spell.id}": its damage "${first.formula}" with its scaling "${scaling.formula}" × ${times}; its own damage is used).`,
    });
    return { times, damage, warnings };
  }
  return { times, damage: [{ ...first, formula: joined.formula.text }, ...rest], warnings };
}
