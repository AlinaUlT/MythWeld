import {
  type ActionResult,
  type Computed,
  type ConditionRecoveryWarning,
  type ContentIndex,
  changeTo,
  compute,
  conditionsRecoveredOn,
  type LogStamp,
  type RecoveryWarning,
  recoveredOn,
} from '@grimoire/engine';
import type { LogChange, LogEntry } from '@grimoire/schema';
import {
  CONCENTRATION_PATH,
  deathSavesReset,
  HP_CURRENT_PATH,
  HP_TEMP_PATH,
  hitDiceSpentPath,
  isWhole,
  knockOutEnded,
  PACT_SPENT_PATH,
  settled,
  slotSpentPath,
  type Unchanged,
  whole,
} from './actions';
import type { FifthEditionCharacter } from './character';
import { RULE_STATS } from './combat';
import { isDead } from './death-saves';
import type { FifthEditionEntity } from './entity-types';
import { hitDicePath } from './hit-dice';
import { fifthEditionModule } from './module';
import { rulesOf } from './rulesets';
import { HIT_DIE_SIZES, MAX_SPELL_LEVEL } from './system';

// ENG-21: fifth edition's rests (SPEC §6.4), each one log entry (ADR 014 item 10), so one undo
// takes the whole rest back. A short rest spends the hit dice the person rolled, each giving its
// roll plus the Constitution modifier, at least the edition's minimum; gives back the pact slots;
// and the uses that come back on `short`. A long rest gives back every hit point, the edition's
// share of the hit dice (the largest first), every slot, the uses that come back on `long` (else
// on `short`), and ends the temporary hit points, and concentration where the edition says so. A
// rest the rules give nothing is refused: at fewer hit points than the edition's minimum, and
// dead. Which recovery a resource follows is the core's `recoveredOn`. The rules are ENG-21 §8's.
// ENG-61: each rest lowers the stored conditions by their entries' `recovery` on the rest's events
// (the core's `conditionsRecoveredOn`), as both SRDs' exhaustion says of a long rest. The hit
// points come from the one `compute()` made before the rest, so 2014's halved maximum at
// exhaustion 4 is the one a long rest fills (dnd5e's order, ENG-61 §8).
// ENG-65: each rest ends a knock-out whose short rest damage did not interrupt (`resting`), and
// any knock-out when it gives hit points back (`knockOutEnded`).

/**
 * The recovery events each rest triggers, in order: a long rest gives back what comes back on a
 * long rest, else what comes back on a short one (dnd5e's `restTypes`, ENG-21 §8).
 */
export const REST_EVENTS = {
  short: ['short'],
  long: ['long', 'short'],
} as const satisfies Record<string, readonly string[]>;

/** The fewest hit points a long rest starts with, in both editions (ENG-21 §8). */
export const LONG_REST_MIN_HP = 1;

/** A hit die a short rest spends: its faces, and the number it rolled. */
export interface HitDieAsk {
  readonly die: number;
  readonly roll: number;
}

/** A hit die spent, and the hit points it gives before the maximum takes any. */
export interface SpentHitDie {
  die: number;
  roll: number;
  hp: number;
}

/** What a rest did, beside its changes: what the screen shows in its summary. */
export interface RestOutcome {
  /** Each hit die the rest spent, in the order asked. */
  hitDice: SpentHitDie[];
  /** What the formulas of the uses given back, and of the condition levels lowered, met. */
  warnings: (RecoveryWarning | ConditionRecoveryWarning)[];
}

/** Why a rest did not happen. `code` and its data are for the screen; `message` is for logs. */
export type RestRefusal = { message: string } & (
  | { code: 'badDie'; die: number }
  | { code: 'badRoll'; die: number; roll: number }
  | { code: 'noHitDieLeft'; die: number; left: number; count: number }
  | { code: 'tooFewHitPoints'; hp: number; min: number }
  | { code: 'dead' }
);

/** What a rest gives: the changed character, its entry and the outcome, or why nothing changed. */
export type RestResult =
  | { ok: true; character: FifthEditionCharacter; entry: LogEntry; outcome: RestOutcome }
  | Extract<ActionResult<FifthEditionCharacter, RestRefusal | Unchanged>, { ok: false }>;

/** A rest's refusal for a dead character, or one with fewer hit points than `min`. */
function restRefusal(
  character: FifthEditionCharacter,
  min: number,
): ({ ok: false } & RestRefusal) | undefined {
  if (isDead(character)) {
    return { ok: false, code: 'dead', message: 'The character is dead: a rest gives it nothing.' };
  }
  const hp = character.systemData.state.hp.current;
  if (hp < min) {
    const message = `The rest starts at ${min} hit points or more; the character has ${hp}.`;
    return { ok: false, code: 'tooFewHitPoints', hp, min, message };
  }
  return undefined;
}

/**
 * The changes that end a knock-out at the end of a rest: the short rest the knock-out started ends
 * it, unless damage interrupted that rest; hit points regained end it either way.
 */
function knockOutRested(character: FifthEditionCharacter, current: number): LogChange[] {
  const { hp, knockedOut } = character.systemData.state;
  return knockedOut === 'resting' || current > hp.current ? knockOutEnded(character) : [];
}

/** A computed number, 0 when it is not one. */
function numberAt(computed: Computed<FifthEditionEntity>, path: string): number {
  const value = computed.values[path];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** The changes, the entry and the outcome of a rest, or `unchanged` when nothing changes. */
function rested(
  character: FifthEditionCharacter,
  stamp: LogStamp,
  action: string,
  changes: LogChange[],
  outcome: RestOutcome,
): RestResult {
  const result = settled<RestRefusal>(
    character,
    stamp,
    { action, subject: 'rest', changes },
    'The rest gives back nothing: nothing is spent or lost.',
  );
  return result.ok ? { ...result, outcome } : result;
}

/**
 * The character after a short rest that spends `ask.hitDice`, and the entry. Each die gives its
 * roll plus the Constitution modifier, at least the edition's `hitDieMinimum`; the hit points go
 * up to the maximum, never down, and from 0 they reset the death saves and end stable. The pact
 * slots and the uses that come back on `short` come back. Refused for a die no class has, a roll
 * it cannot show, a die more than the character has left, a dead character, one below the
 * edition's `shortRestMinHp`, and as `unchanged` when nothing changes. ENG-61: the stored
 * conditions lose the levels their entries take on `short`. ENG-65: it ends a knock-out
 * (`knockOutRested`).
 */
export function shortRest(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly hitDice?: readonly HitDieAsk[] },
  stamp: LogStamp,
): RestResult {
  const { hitDice = [] } = ask;
  for (const { die, roll } of hitDice) {
    if (!(HIT_DIE_SIZES as readonly number[]).includes(die)) {
      return { ok: false, code: 'badDie', die, message: `d${die} is not a hit die.` };
    }
    if (!isWhole(roll, 1) || roll > die) {
      const message = `A d${die} cannot roll ${roll}.`;
      return { ok: false, code: 'badRoll', die, roll, message };
    }
  }
  const rules = rulesOf(character);
  const refused = restRefusal(character, rules.shortRestMinHp);
  if (refused !== undefined) return refused;

  const computed = compute(character, index, fifthEditionModule);
  const mod = numberAt(computed, `abilities.${RULE_STATS.hitPoints}.mod`);
  const { hp } = character.systemData.state;
  const spentBefore: Readonly<Partial<Record<string, number>>> =
    character.systemData.state.hitDiceSpent;
  const spentNow = new Map<number, number>();
  const spent: SpentHitDie[] = [];
  for (const { die, roll } of hitDice) {
    const before = spentBefore[`d${die}`] ?? 0;
    const left = Math.max(0, whole(computed.values[hitDicePath(die)]) - before);
    const count = (spentNow.get(die) ?? 0) + 1;
    if (count > left) {
      const message = `The character has ${left} d${die} left, fewer than ${count}.`;
      return { ok: false, code: 'noHitDieLeft', die, left, count, message };
    }
    spentNow.set(die, count);
    spent.push({ die, roll, hp: Math.max(rules.hitDieMinimum, roll + mod) });
  }

  const max = Math.floor(numberAt(computed, 'hp.max'));
  const regained = spent.reduce((sum, each) => sum + each.hp, 0);
  const current = Math.max(hp.current, Math.min(max, hp.current + regained));
  const revived = hp.current === 0 && current > 0;
  const recovered = recoveredOn(character, computed, REST_EVENTS.short);
  const eased = conditionsRecoveredOn(character, computed, REST_EVENTS.short);
  return rested(
    character,
    stamp,
    'shortRest',
    [
      changeTo(character, HP_CURRENT_PATH, current),
      ...(revived ? deathSavesReset(character) : []),
      ...[...spentNow].map(([die, count]) =>
        changeTo(character, hitDiceSpentPath(die), (spentBefore[`d${die}`] ?? 0) + count),
      ),
      changeTo(character, PACT_SPENT_PATH, 0),
      ...recovered.changes,
      ...eased.changes,
      ...knockOutRested(character, current),
    ],
    { hitDice: spent, warnings: [...recovered.warnings, ...eased.warnings] },
  );
}

/**
 * The character after a long rest, and the entry: every hit point back (hit points above the
 * maximum stay), no temporary hit points, the edition's `longRestHitDice` share of all its hit
 * dice back (rounded down, at least 1, the largest first), every slot and pact slot back, the uses
 * that come back on `long`, else on `short`, and no concentration where the edition's
 * `longRestEndsConcentration` says so. ENG-61: the stored conditions lose the levels their
 * entries take on `long`, else on `short` (each SRD's exhaustion: 1). ENG-65: it ends a knock-out
 * as a short rest does (`knockOutRested`). Refused for a dead character, one at 0 hit points, and
 * as `unchanged` when nothing changes.
 */
export function longRest(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  stamp: LogStamp,
): RestResult {
  const refused = restRefusal(character, LONG_REST_MIN_HP);
  if (refused !== undefined) return refused;
  const rules = rulesOf(character);
  const computed = compute(character, index, fifthEditionModule);
  const { hp, hitDiceSpent, slotsSpent, concentration } = character.systemData.state;
  const max = Math.floor(numberAt(computed, 'hp.max'));
  const current = Math.max(hp.current, max);

  const total = HIT_DIE_SIZES.reduce(
    (sum, die) => sum + whole(computed.values[hitDicePath(die)]),
    0,
  );
  let left = Math.max(1, Math.floor(total * rules.longRestHitDice));
  const dice: LogChange[] = [];
  for (const die of [...HIT_DIE_SIZES].sort((a, b) => b - a)) {
    const spent = hitDiceSpent[`d${die}`] ?? 0;
    const back = Math.min(spent, left);
    left -= back;
    if (back > 0) dice.push(changeTo(character, hitDiceSpentPath(die), spent - back));
  }
  const slots: Readonly<Partial<Record<string, number>>> = slotsSpent;
  const levels = Array.from({ length: MAX_SPELL_LEVEL }, (_, at) => at + 1);
  const recovered = recoveredOn(character, computed, REST_EVENTS.long);
  const eased = conditionsRecoveredOn(character, computed, REST_EVENTS.long);
  return rested(
    character,
    stamp,
    'longRest',
    [
      changeTo(character, HP_CURRENT_PATH, current),
      changeTo(character, HP_TEMP_PATH, 0),
      ...dice,
      ...levels
        .filter((level) => (slots[`${level}`] ?? 0) > 0)
        .map((level) => changeTo(character, slotSpentPath(level), 0)),
      changeTo(character, PACT_SPENT_PATH, 0),
      ...recovered.changes,
      ...eased.changes,
      ...(rules.longRestEndsConcentration && concentration !== undefined
        ? [changeTo(character, CONCENTRATION_PATH, undefined)]
        : []),
      ...knockOutRested(character, current),
    ],
    { hitDice: [], warnings: [...recovered.warnings, ...eased.warnings] },
  );
}
