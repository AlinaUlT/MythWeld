// SHEET-39: the roll dialog's rules that hold no screen (BRIEF P5 sheet 1): which roll mode a test
// is in, the formula it rolls, the kept d20 face, and what an attack's face does. The mode is the
// sign of every source of the sheet (the steps of `checks.<stat>.mode` and the like, ENG-34) with
// the dialog's own sources added: the person's Advantage and Disadvantage switches, a situational
// effect switched on, and 2014's spent inspiration. Any advantage and any disadvantage cancel.
import { type DieSource, type ParsedRoll, parseRoll, type RollPartWarning } from '@grimoire/engine';
import type { RollRecord } from '@grimoire/schema';
import { type Roller, readNothing, rollWith } from '../shared/dice';
import type { AppComputed, RollTest, SheetSystem, Situational } from '../systems';
import { stepsAt } from './breakdown';
import { numberAt } from './SheetNumber';

/** What the person has switched on for this roll. */
export interface RollSwitches {
  advantage: boolean;
  disadvantage: boolean;
  /** 2014: the inspiration is spent for advantage. */
  inspiration: boolean;
  /** The part ids of the situational effects switched on. */
  situational: readonly string[];
}

/** No switch on. */
export const NO_SWITCHES: RollSwitches = {
  advantage: false,
  disadvantage: false,
  inspiration: false,
  situational: [],
};

/** The sign each step of a test's mode gives: its source's, never its change. */
export function modeSources(computed: AppComputed, test: RollTest) {
  return stepsAt(computed, test.mode).filter((step) => step.value !== 0);
}

/** The signs of every source of a roll: the sheet's, then the dialog's own. */
export function signsOf(
  computed: AppComputed,
  test: RollTest,
  offered: readonly Situational[],
  on: RollSwitches,
): number[] {
  const own = [
    ...(on.advantage ? [1] : []),
    ...(on.disadvantage ? [-1] : []),
    ...(on.inspiration ? [1] : []),
    ...offered.filter(({ part }) => on.situational.includes(part)).map(({ sign }) => sign),
  ];
  return [...modeSources(computed, test).map((step) => step.value), ...own];
}

/** The text of a roll: the d20 of its mode and the number added, `2d20kh1 + 5`, `1d20 - 1`. */
export function d20Text(system: Pick<SheetSystem, 'd20'>, mode: number, bonus: number): string {
  const d20 = system.d20(mode);
  if (bonus === 0) return d20;
  return `${d20} ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`;
}

/** The d20 face the roll kept: the first kept face of its first dice term. */
export function keptFace(record: RollRecord): number | undefined {
  const term = record.breakdown[0]?.dice[0];
  if (term === undefined) return undefined;
  const at = term.kept.findIndex(Boolean);
  return at < 0 ? undefined : term.results[at];
}

/** A finished roll. */
export interface RolledTest {
  record: RollRecord;
  warnings: readonly RollPartWarning[];
  face: number | undefined;
  /** A weapon or spell attack's outcome by the natural face. */
  outcome: 'criticalHit' | 'automaticMiss' | 'byTotal' | undefined;
}

export interface RollTestRequest {
  system: SheetSystem;
  computed: AppComputed;
  test: RollTest;
  /** What the log calls the roll: the test's name. */
  name: string;
  mode: number;
  die: DieSource;
  roller: Roller;
  id: string;
  now: Date;
}

/** Rolls the test's d20 and its number; the record is for the roll log. */
export function rollTestWith(request: RollTestRequest): RolledTest | undefined {
  const { system, computed, test, name, mode, die, roller, id, now } = request;
  // A death save adds no number (SHEET-43): its roll is named by its mode's path.
  const bonus = test.bonus === undefined ? 0 : numberAt(computed, test.bonus);
  if (bonus === undefined) return undefined;
  const formula = parseRoll(d20Text(system, mode, bonus));
  if (!formula.ok) return undefined;
  const made = rollWith({
    formula: formula.formula,
    read: readNothing,
    die,
    roller,
    id,
    now,
    label: name,
    path: test.bonus ?? test.mode,
  });
  const face = keptFace(made.record);
  const attack = test.kind === 'weaponAttack' || test.kind === 'spellAttack';
  const range = test.critRange === undefined ? undefined : numberAt(computed, test.critRange);
  return {
    record: made.record,
    warnings: made.warnings,
    face,
    outcome:
      attack && face !== undefined
        ? range === undefined
          ? system.attackOutcome(face)
          : system.attackOutcome(face, range)
        : undefined,
  };
}

/** The damage formula of a weapon attack: its dice and the bonus the sheet shows. */
export function damageText(dice: string, bonus: number): string {
  if (bonus === 0) return dice;
  return `${dice} ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`;
}

/** The damage roll's formula: a critical hit rolls each dice term twice (ENG-34 §8). */
export function damageFormula(
  system: Pick<SheetSystem, 'criticalDamage'>,
  text: string,
  critical: boolean,
): ParsedRoll | undefined {
  const parsed = critical ? system.criticalDamage(text) : parseRoll(text);
  return parsed.ok ? parsed.formula : undefined;
}
