import {
  type ActionResult,
  type ContentIndex,
  changeTo,
  compute,
  type LogStamp,
  type MadeChanges,
} from '@grimoire/engine';
import type { LogChange, LogEntry } from '@grimoire/schema';
import {
  CONCENTRATION_PATH,
  DEATH_FAILURE_PATH,
  DEATH_SUCCESS_PATH,
  HP_CURRENT_PATH,
  HP_TEMP_PATH,
  isWhole,
  settled,
  type Unchanged,
} from './actions';
import { DEATH_SAVES, type FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';
import { rulesOf } from './rulesets';

// ENG-20: fifth edition's hit point actions (SPEC §6.4), each one log entry (ADR 014 item 10).
// Damage takes the temporary hit points first, then the hit points, down to 0; what is left over
// at 0 is measured against the maximum (massive damage), and damage past the temporary hit points
// at 0 gives death save failures. The third failure is death, so death is 0 hit points with 3
// failures: no other field says it. At 0 hit points concentration ends; above 0 the outcome gives
// the DC of the save that keeps it, which the screen rolls. Healing never passes the maximum and,
// from 0, resets the death saves. Temporary hit points never add up. The rules are ENG-20 §8's.

/** The lowest DC of the Constitution save that keeps concentration after damage (both SRDs). */
export const CONCENTRATION_DC_MIN = 10;

/** Why a hit point action did not run. `code` and its data are for the screen. */
export type HitPointRefusal = { message: string } & (
  | { code: 'badAmount'; amount: number }
  | { code: 'dead' }
);

/** What healing or temporary hit points give: the changed character and its entry, or why not. */
export type HitPointResult = ActionResult<FifthEditionCharacter, HitPointRefusal | Unchanged>;

/** What damage asks for. */
export interface DamageAsk {
  /** The damage taken, resistance, vulnerability and immunity applied: a whole number from 1. */
  readonly amount: number;
  /** The damage is a critical hit's: at 0 hit points it gives two failures, not one. */
  readonly critical?: boolean;
}

/** What damage did, beside its changes: what the screen tells or asks next. */
export interface DamageOutcome {
  /** The temporary hit points it took. */
  temp: number;
  /** The hit points it took. */
  hp: number;
  /** Where it left the character: above 0 hit points, at 0 (dying or stable), or dead. */
  status: 'up' | 'down' | 'dead';
  /** The death save failures it gave. */
  failures: number;
  /** The DC of the Constitution save that keeps concentration, when the character still holds it. */
  concentrationDc?: number;
  /** The spell whose concentration it ended, by dropping the character to 0 hit points. */
  concentrationEnded?: string;
}

/** What damage gives: the changed character, its entry and the outcome, or why nothing changed. */
export type DamageResult =
  | { ok: true; character: FifthEditionCharacter; entry: LogEntry; outcome: DamageOutcome }
  | Extract<HitPointResult, { ok: false }>;

/** The character is dead: at 0 hit points with 3 death save failures. */
export function isDead(character: FifthEditionCharacter): boolean {
  const { hp, deathSaves } = character.systemData.state;
  return hp.current === 0 && deathSaves.failure >= DEATH_SAVES;
}

/**
 * The DC of the Constitution save that keeps concentration after `damage`: the higher of 10 and
 * half the damage, rounded down, at most the edition's `concentrationDcMax`.
 */
export function concentrationDc(
  character: Pick<FifthEditionCharacter, 'ruleset'>,
  damage: number,
): number {
  const dc = Math.max(CONCENTRATION_DC_MIN, Math.floor(damage / 2));
  const max = rulesOf(character).concentrationDcMax;
  return max === null ? dc : Math.min(max, dc);
}

/** The hit point maximum the character computes, rounded down; 0 when it is not a number. */
function maxOf(character: FifthEditionCharacter, index: ContentIndex<FifthEditionEntity>): number {
  const value = compute(character, index, fifthEditionModule).values['hp.max'];
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
}

/** The refusal of an amount that is not a whole number from `min`, or of a dead character. */
function refusal(
  character: FifthEditionCharacter,
  amount: number,
  min: number,
): ({ ok: false } & HitPointRefusal) | undefined {
  if (!isWhole(amount, min)) {
    const message = `${amount} is not a whole number of hit points from ${min}.`;
    return { ok: false, code: 'badAmount', amount, message };
  }
  if (isDead(character)) {
    return { ok: false, code: 'dead', message: 'The character is dead: it has no hit points.' };
  }
  return undefined;
}

/** The hit point changes an action makes, as one entry of `action`. */
function hitPoints(action: string, changes: LogChange[]): MadeChanges {
  return { action, subject: 'hp', changes };
}

/**
 * The character after taking `ask.amount` damage, the entry, and what the damage did: the
 * temporary hit points first, then the hit points, never below 0. Dropped to 0 with damage left
 * over equal to the maximum or more, it dies; already at 0, damage past the temporary hit points
 * gives a failure, two from a critical hit, and kills when it is the maximum or more. At 0
 * concentration ends. Refused for an amount that is not a whole number from 1, and for a dead
 * character.
 */
export function applyDamage(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: DamageAsk,
  stamp: LogStamp,
): DamageResult {
  const { amount, critical = false } = ask;
  const refused = refusal(character, amount, 1);
  if (refused !== undefined) return refused;
  const { hp, deathSaves, concentration } = character.systemData.state;
  const max = maxOf(character, index);

  const temp = Math.min(hp.temp, amount);
  const through = amount - temp;
  const lost = Math.min(hp.current, through);
  const current = hp.current - lost;
  let failure = deathSaves.failure;
  if (hp.current > 0) {
    const left = through - lost;
    if (left > 0 && left >= max) failure = DEATH_SAVES;
  } else if (through > 0) {
    failure = through >= max ? DEATH_SAVES : Math.min(DEATH_SAVES, failure + (critical ? 2 : 1));
  }
  const ends = current === 0 && concentration !== undefined;

  const result = settled<HitPointRefusal>(
    character,
    stamp,
    hitPoints('applyDamage', [
      changeTo(character, HP_TEMP_PATH, hp.temp - temp),
      changeTo(character, HP_CURRENT_PATH, current),
      changeTo(character, DEATH_FAILURE_PATH, failure),
      ...(ends ? [changeTo(character, CONCENTRATION_PATH, undefined)] : []),
    ]),
    'The damage changes nothing.',
  );
  if (!result.ok) return result;
  const outcome: DamageOutcome = {
    temp,
    hp: lost,
    status: current > 0 ? 'up' : failure >= DEATH_SAVES ? 'dead' : 'down',
    failures: failure - deathSaves.failure,
    ...(concentration !== undefined &&
      !ends && { concentrationDc: concentrationDc(character, amount) }),
    ...(ends && { concentrationEnded: concentration }),
  };
  return { ...result, outcome };
}

/**
 * The character after regaining `ask.amount` hit points, up to its maximum, and the entry: from 0,
 * the death saves go back to none. Hit points above the maximum stay as they are. Refused for an
 * amount that is not a whole number from 1, for a dead character, and as `unchanged` at the
 * maximum.
 */
export function applyHealing(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly amount: number },
  stamp: LogStamp,
): HitPointResult {
  const { amount } = ask;
  const refused = refusal(character, amount, 1);
  if (refused !== undefined) return refused;
  const { hp } = character.systemData.state;
  const max = maxOf(character, index);
  const current = Math.max(hp.current, Math.min(max, hp.current + amount));
  const revived = hp.current === 0 && current > 0;
  return settled<HitPointRefusal>(
    character,
    stamp,
    hitPoints('applyHealing', [
      changeTo(character, HP_CURRENT_PATH, current),
      ...(revived
        ? [changeTo(character, DEATH_SUCCESS_PATH, 0), changeTo(character, DEATH_FAILURE_PATH, 0)]
        : []),
    ]),
    'The character is at its hit point maximum or above it.',
  );
}

/**
 * The character with `ask.amount` temporary hit points, and the entry. They never add up: the
 * larger of the old and the new stays, unless `replace` takes the new ones, the person's choice.
 * Nothing else changes, at 0 hit points too. Refused for an amount that is not a whole number
 * from 0, for a dead character, and as `unchanged` when the count stays.
 */
export function setTempHp(
  character: FifthEditionCharacter,
  ask: { readonly amount: number; readonly replace?: boolean },
  stamp: LogStamp,
): HitPointResult {
  const { amount, replace = false } = ask;
  const refused = refusal(character, amount, 0);
  if (refused !== undefined) return refused;
  const { temp } = character.systemData.state.hp;
  return settled<HitPointRefusal>(
    character,
    stamp,
    hitPoints('setTempHp', [
      changeTo(character, HP_TEMP_PATH, replace ? amount : Math.max(temp, amount)),
    ]),
    `The character keeps its ${temp} temporary hit points.`,
  );
}
