import {
  addDice,
  addPath,
  type DerivedStep,
  type FormulaError,
  type FormulaValue,
  LEVEL_PATH,
  parseRoll,
  renamePaths,
} from '@grimoire/engine';
import { zeroStep } from './checks';
import type { SpellDef } from './entity-types';
import type { HEALING_KINDS } from './system';

// ENG-50: a spell's dice for the character's level (ADR 014 item 6). A spell's `scaling` formula
// joins its first damage once per step: for a cantrip, each of `CANTRIP_LEVELS` the character's
// total level has reached, the number `cantrip.upgrades`, which effects and overrides change as any
// other; for another spell, each slot level above its own. The dice are written from that count
// (`addDice`). The rules are ENG-50 §8's, one in both editions.
// ENG-53: a spell's healing is a roll formula of its own, which the scaling joins too. In a spell's
// roll formulas `@mod` is the modifier of the stat it is cast with: the cast names the stat, and
// `@abilities.<stat>.mod` is written in its place (`renamePaths`), a path with its breakdown. The
// rules are ENG-53 §8's, one in both editions.
// ENG-55: a spell's damage adds `damage.spell.bonus`, a target for effects every character has
// (SPEC §5.4, beside ENG-16's weapon kinds): its first damage, the one the scaling grows, once,
// with `@damage.spell.bonus` written at its end (`addPath`) when the bonus is not 0. The rules are
// ENG-55 §8's, one in both editions.

/** The character levels at which a cantrip's dice grow, one step each (§8: both SRDs). */
export const CANTRIP_LEVELS: readonly number[] = [5, 11, 17];

/** How many steps a cantrip's dice have grown at the character's level. */
export const CANTRIP_UPGRADES_PATH = 'cantrip.upgrades';

/** The steps a cantrip's dice have grown at a character level: each of `CANTRIP_LEVELS` reached. */
export function cantripUpgrades(level: number): number {
  return CANTRIP_LEVELS.filter((at) => level >= at).length;
}

/** What a spell's damage adds (SPEC §5.4's `damage.<…>.bonus`, beside the weapon kinds). */
export const DAMAGE_SPELL_BONUS_PATH = 'damage.spell.bonus';

/**
 * `cantrip.upgrades`: one step, the character's level and what it gives. `damage.spell.bonus`: 0
 * until an effect changes it.
 */
export function spellDiceSteps(): Record<string, DerivedStep> {
  return {
    [CANTRIP_UPGRADES_PATH]: (read) => {
      const level = read(LEVEL_PATH);
      const value = cantripUpgrades(level);
      return { value, steps: [{ kind: 'path', path: LEVEL_PATH, value: level, change: value }] };
    },
    [DAMAGE_SPELL_BONUS_PATH]: zeroStep,
  };
}

/** One damage of a spell as it rolls now: its roll formula and its damage type's key. */
export interface SpellDamage {
  formula: string;
  type: string;
}

/** A spell's healing as it rolls now: its roll formula and what it gives (`HEALING_KINDS`). */
export interface SpellHealing {
  formula: string;
  kind: (typeof HEALING_KINDS)[number];
}

/**
 * The path a spell's roll formula reads as the modifier of the stat it is cast with (`@mod`, as
 * SPEC §5.6's `@score` in a modifier formula).
 */
export const CASTING_MOD_PATH = 'mod';

/** How a spell is cast: the slot's level (its own level when not given), the stat it is cast with. */
export interface SpellCast {
  slot?: number;
  stat?: string;
}

/**
 * Something working out a spell's dice met. `code` and its data are for the screen; `message` is
 * for logs. `missingPath`: the values have no number at `path`, so 0 steps are used, or the
 * damage adds no bonus. `scalingFormula`: a formula, the scaling's, or the two joined do not parse,
 * so that formula is used as it is. `scalingWithoutRoll`: the spell has no damage and no healing
 * for its scaling to join. `damageBonusFormula`: the first damage with `@damage.spell.bonus` added
 * does not parse, so it is used without it. `noCastingStat`: a formula reads `@mod` and the cast
 * names no stat, so `@mod` stays (a roll reads it as 0). `castingStatFormula`: a formula with the
 * stat's modifier written in does not parse, so it keeps `@mod`.
 */
export type SpellDiceWarning = { message: string } & (
  | { code: 'missingPath'; path: string }
  | { code: 'scalingFormula'; spell: string; error: FormulaError }
  | { code: 'scalingWithoutRoll'; spell: string }
  | { code: 'damageBonusFormula'; spell: string; error: FormulaError }
  | { code: 'noCastingStat'; spell: string }
  | { code: 'castingStatFormula'; spell: string; stat: string; error: FormulaError }
);

/** A spell's dice now, and how they were made. */
export interface SpellDice {
  /**
   * How many times the spell's `scaling.formula` joins its first damage and its healing: for a
   * cantrip the value of `cantrip.upgrades` (its breakdown says why), for another spell the slot
   * levels above its own; 0 without a scaling.
   */
  times: number;
  /** Each damage in order, the first with the scaling joined and `damage.spell.bonus` added. */
  damage: SpellDamage[];
  /** Its healing, with the scaling joined; none when the spell heals nothing. */
  healing?: SpellHealing;
  warnings: SpellDiceWarning[];
}

/** How many times a spell's scaling joins: whole, 0 at least; 0 without a scaling. */
function timesOf(
  spell: Pick<SpellDef, 'id' | 'level' | 'scaling'>,
  values: Readonly<Record<string, FormulaValue>>,
  slot: number | undefined,
  warnings: SpellDiceWarning[],
): number {
  const scaling = spell.scaling;
  if (scaling === undefined) return 0;
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
  return Number.isFinite(steps) ? Math.max(Math.floor(steps), 0) : 0;
}

/**
 * A spell's damage and healing on a character whose computed values are `values`, cast as `cast`
 * says. `times` counts as a whole number, rounded down, and as 0 below 0. Pure; never throws.
 */
export function spellDice(
  spell: Pick<SpellDef, 'id' | 'level' | 'damage' | 'healing' | 'scaling'>,
  values: Readonly<Record<string, FormulaValue>>,
  cast: SpellCast = {},
): SpellDice {
  const warnings: SpellDiceWarning[] = [];
  const times = timesOf(spell, values, cast.slot, warnings);
  const damage = (spell.damage ?? []).map(({ formula, type }) => ({ formula, type }));
  const healing = spell.healing && { formula: spell.healing.formula, kind: spell.healing.kind };

  // The scaling joins the first damage and the healing (ENG-53 §8).
  const scaling = spell.scaling;
  if (scaling !== undefined) {
    const grown = [damage[0], healing].flatMap((roll) => roll ?? []);
    if (grown.length === 0) {
      warnings.push({
        code: 'scalingWithoutRoll',
        spell: spell.id,
        message: `"${spell.id}" has a scaling and no damage or healing for it to join.`,
      });
    }
    for (const roll of grown) {
      const joined = addDice(roll.formula, scaling.formula, times);
      if (joined.ok) {
        roll.formula = joined.formula.text;
        continue;
      }
      warnings.push({
        code: 'scalingFormula',
        spell: spell.id,
        error: joined.error,
        message: `${joined.error.message} ("${spell.id}": "${roll.formula}" with its scaling "${scaling.formula}" × ${times}; "${roll.formula}" is used).`,
      });
    }
  }

  addDamageBonus(spell, damage[0], values, warnings);

  // `@mod`: the modifier of the stat the spell is cast with, in every formula.
  const { stat } = cast;
  let unnamed = false;
  for (const roll of [...damage, healing].flatMap((each) => each ?? [])) {
    if (stat === undefined) {
      unnamed ||= readsCastingMod(roll.formula);
      continue;
    }
    const named = renamePaths(roll.formula, (path) =>
      path === CASTING_MOD_PATH ? `abilities.${stat}.mod` : undefined,
    );
    if (named.ok) {
      roll.formula = named.formula.text;
      continue;
    }
    warnings.push({
      code: 'castingStatFormula',
      spell: spell.id,
      stat,
      error: named.error,
      message: `${named.error.message} ("${spell.id}" cast with "${stat}": "${roll.formula}" keeps @${CASTING_MOD_PATH}).`,
    });
  }
  if (unnamed) {
    warnings.push({
      code: 'noCastingStat',
      spell: spell.id,
      message: `"${spell.id}" reads @${CASTING_MOD_PATH} and is cast with no stat; @${CASTING_MOD_PATH} stays.`,
    });
  }
  return healing === undefined ? { times, damage, warnings } : { times, damage, healing, warnings };
}

/**
 * `@damage.spell.bonus` added to a spell's first damage, in place, when its value is a number that
 * is not 0 (ENG-55 §4: one damage roll, nothing written for 0); a spell with no damage reads none.
 */
function addDamageBonus(
  spell: Pick<SpellDef, 'id'>,
  first: SpellDamage | undefined,
  values: Readonly<Record<string, FormulaValue>>,
  warnings: SpellDiceWarning[],
): void {
  if (first === undefined) return;
  const bonus = values[DAMAGE_SPELL_BONUS_PATH];
  if (typeof bonus !== 'number') {
    warnings.push({
      code: 'missingPath',
      path: DAMAGE_SPELL_BONUS_PATH,
      message: `Missing: @${DAMAGE_SPELL_BONUS_PATH}; "${spell.id}" adds no bonus to its damage.`,
    });
    return;
  }
  if (bonus === 0) return;
  const added = addPath(first.formula, DAMAGE_SPELL_BONUS_PATH);
  if (added.ok) {
    first.formula = added.formula.text;
    return;
  }
  warnings.push({
    code: 'damageBonusFormula',
    spell: spell.id,
    error: added.error,
    message: `${added.error.message} ("${spell.id}": "${first.formula}" with @${DAMAGE_SPELL_BONUS_PATH}; "${first.formula}" is used).`,
  });
}

/** Whether a roll formula names `@mod`; a formula that does not parse names nothing. */
function readsCastingMod(formula: string): boolean {
  const parsed = parseRoll(formula);
  return parsed.ok && parsed.formula.paths.includes(CASTING_MOD_PATH);
}
