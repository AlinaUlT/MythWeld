import {
  type ActionResult,
  type ContentIndex,
  changeTo,
  compute,
  type EntityFinder,
  finderOf,
  type LogStamp,
  type MadeChanges,
} from '@grimoire/engine';
import type { LogChange, LogEntry } from '@grimoire/schema';
import {
  CONCENTRATION_PATH,
  DEATH_FAILURE_PATH,
  DEATH_STABLE_PATH,
  deathChanges,
  deathSavesReset,
  HP_CURRENT_PATH,
  HP_TEMP_PATH,
  isWhole,
  KNOCKED_OUT_PATH,
  knockOutEnded,
  settled,
  type Unchanged,
} from './actions';
import { DEATH_SAVES, type FifthEditionCharacter } from './character';
import { isDead } from './death-saves';
import type { FifthEditionEntity } from './entity-types';
import { EXHAUSTION_DEATH_LEVEL, exhaustionLevel } from './exhaustion';
import { fifthEditionModule } from './module';
import { rulesOf } from './rulesets';

// ENG-20: fifth edition's hit point actions (SPEC §6.4), each one log entry (ADR 014 item 10).
// Damage takes the temporary hit points first, then the hit points, down to 0; what is left over
// at 0 is measured against the maximum (massive damage), and damage past the temporary hit points
// at 0 gives death save failures. The third failure is death, so death is 0 hit points with 3
// failures: no other field says it. At 0 hit points concentration ends; above 0 the outcome gives
// the DC of the save that keeps it, which the screen rolls. Healing never passes the maximum and,
// from 0, resets the death saves. Temporary hit points never add up. The rules are ENG-20 §8's.
// ENG-58: damage that gets past the temporary hit points ends stable; healing from 0 ends it too.
// A dead character comes back only through `revive`, with the hit points its revival gives.
// ENG-65: damage may knock out instead (2024): it leaves the character at 1 hit point, knocked out,
// and any other damage interrupts the short rest that knock-out started. Healing and reviving end
// the knock-out (`knockOutEnded`).
// ENG-67: exhaustion 6 is death too, so `isDead` reads the stored conditions' entries: every action
// takes the index, and `revive` refuses while the exhaustion it leaves still kills.

/** The lowest DC of the Constitution save that keeps concentration after damage (both SRDs). */
export const CONCENTRATION_DC_MIN = 10;

/** Why a hit point action did not run. `code` and its data are for the screen. */
export type HitPointRefusal = { message: string } & (
  | { code: 'badAmount'; amount: number }
  | { code: 'dead' }
  | { code: 'notDead' }
  | { code: 'noKnockOut' }
  | { code: 'notDroppedToZero' }
  | { code: 'exhausted'; level: number }
);

/** What healing or temporary hit points give: the changed character and its entry, or why not. */
export type HitPointResult = ActionResult<FifthEditionCharacter, HitPointRefusal | Unchanged>;

/** What damage asks for. */
export interface DamageAsk {
  /** The damage taken, resistance, vulnerability and immunity applied: a whole number from 1. */
  readonly amount: number;
  /** The damage is a critical hit's: at 0 hit points it gives two failures, not one. */
  readonly critical?: boolean;
  /**
   * ENG-65: the attacker knocks the character out, with a melee attack: the damage that would drop
   * it to 0 hit points leaves it at 1, knocked out, where the edition says so (`knockOutToOneHp`).
   */
  readonly knockOut?: boolean;
}

/** What damage did, beside its changes: what the screen tells or asks next. */
export interface DamageOutcome {
  /** The temporary hit points it took. */
  temp: number;
  /** The hit points it took. */
  hp: number;
  /**
   * Where it left the character: above 0 hit points, at 0 (dying or stable), dead, or knocked out
   * above 0 (ENG-65).
   */
  status: 'up' | 'down' | 'dead' | 'knockedOut';
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
  find: EntityFinder<FifthEditionEntity>,
  amount: number,
  min: number,
): ({ ok: false } & HitPointRefusal) | undefined {
  if (!isWhole(amount, min)) {
    const message = `${amount} is not a whole number of hit points from ${min}.`;
    return { ok: false, code: 'badAmount', amount, message };
  }
  if (isDead(character, find)) {
    return { ok: false, code: 'dead', message: 'The character is dead: it has no hit points.' };
  }
  return undefined;
}

/**
 * The refusal of a knock-out the character's edition does not have, or that damage of `through`
 * past the temporary hit points does not give: it must drop the character from above 0 to 0.
 */
function knockOutRefusal(
  character: FifthEditionCharacter,
  through: number,
): ({ ok: false } & HitPointRefusal) | undefined {
  if (!rulesOf(character).knockOutToOneHp) {
    const message =
      "The character's edition knocks a creature out at 0 hit points, stable: the damage, then stabilize.";
    return { ok: false, code: 'noKnockOut', message };
  }
  const { current } = character.systemData.state.hp;
  if (current === 0 || through < current) {
    const message = `The damage does not drop the character from ${current} hit points to 0.`;
    return { ok: false, code: 'notDroppedToZero', message };
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
 * gives a failure, two from a critical hit, and kills when it is the maximum or more. Damage
 * past the temporary hit points ends stable. At 0 concentration ends. Death ends every attunement
 * (`deathChanges`). ENG-65: with `knockOut`, the damage that would drop the character to 0 leaves
 * it at 1, knocked out (`resting`), with no failure and no massive damage, and concentration ends;
 * any other damage to a knocked-out character interrupts its rest (`interrupted`). Refused for an
 * amount that is not a whole number from 1, for a dead character, and for a knock-out the edition
 * does not have or the damage does not give.
 */
export function applyDamage(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: DamageAsk,
  stamp: LogStamp,
): DamageResult {
  const { amount, critical = false, knockOut = false } = ask;
  const refused = refusal(character, finderOf(character, index), amount, 1);
  if (refused !== undefined) return refused;
  const { hp, deathSaves, concentration, knockedOut } = character.systemData.state;
  const temp = Math.min(hp.temp, amount);
  const through = amount - temp;
  const knocked = knockOut ? knockOutRefusal(character, through) : undefined;
  if (knocked !== undefined) return knocked;
  const max = maxOf(character, index);

  const lost = knockOut ? hp.current - 1 : Math.min(hp.current, through);
  const current = hp.current - lost;
  let failure = deathSaves.failure;
  if (hp.current > 0) {
    const left = through - lost;
    // Knocked out, the character is reduced to 1, never to 0: no massive damage (ENG-65 §8).
    if (!knockOut && left > 0 && left >= max) failure = DEATH_SAVES;
  } else if (through > 0) {
    failure = through >= max ? DEATH_SAVES : Math.min(DEATH_SAVES, failure + (critical ? 2 : 1));
  }
  const ends = (current === 0 || knockOut) && concentration !== undefined;
  const dies = current === 0 && failure >= DEATH_SAVES;
  // A knock-out starts its short rest; any other damage interrupts the one it started.
  const mark = knockOut ? 'resting' : knockedOut === undefined ? undefined : 'interrupted';

  const result = settled<HitPointRefusal>(
    character,
    stamp,
    hitPoints('applyDamage', [
      changeTo(character, HP_TEMP_PATH, hp.temp - temp),
      changeTo(character, HP_CURRENT_PATH, current),
      changeTo(character, DEATH_FAILURE_PATH, failure),
      ...(through > 0 ? [changeTo(character, DEATH_STABLE_PATH, false)] : []),
      ...(ends ? [changeTo(character, CONCENTRATION_PATH, undefined)] : []),
      ...(dies ? deathChanges(character) : []),
      changeTo(character, KNOCKED_OUT_PATH, mark),
    ]),
    'The damage changes nothing.',
  );
  if (!result.ok) return result;
  const outcome: DamageOutcome = {
    temp,
    hp: lost,
    status: current === 0 ? (dies ? 'dead' : 'down') : mark === undefined ? 'up' : 'knockedOut',
    failures: failure - deathSaves.failure,
    ...(concentration !== undefined &&
      !ends && { concentrationDc: concentrationDc(character, amount) }),
    ...(ends && { concentrationEnded: concentration }),
  };
  return { ...result, outcome };
}

/**
 * The character after regaining `ask.amount` hit points, up to its maximum, and the entry: from 0,
 * the death saves go back to none, and stable ends. Any hit point regained ends a knock-out
 * (ENG-65). Hit points above the maximum stay as they are. Refused for an amount that is not a
 * whole number from 1, for a dead character, and as `unchanged` at the maximum.
 */
export function applyHealing(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly amount: number },
  stamp: LogStamp,
): HitPointResult {
  const { amount } = ask;
  const refused = refusal(character, finderOf(character, index), amount, 1);
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
      ...(revived ? deathSavesReset(character) : []),
      ...(current > hp.current ? knockOutEnded(character) : []),
    ]),
    'The character is at its hit point maximum or above it.',
  );
}

/**
 * ENG-58: the dead character brought back to life with `ask.hp` hit points, a whole number from 1
 * or `max`, at most its maximum and at least 1, both death save counts at 0, no knock-out
 * (ENG-65); and the entry. The revival spells give 1 or all (ENG-58 §8). Refused for an amount
 * that is not a whole number from 1, for a character that is not dead, and as `exhausted` at
 * exhaustion 6, which the revival leaves (ENG-67), so the character would be dead again.
 */
export function revive(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly hp: number | 'max' },
  stamp: LogStamp,
): HitPointResult {
  const { hp } = ask;
  if (hp !== 'max' && !isWhole(hp, 1)) {
    const message = `${hp} is not a whole number of hit points from 1.`;
    return { ok: false, code: 'badAmount', amount: hp, message };
  }
  const find = finderOf(character, index);
  if (!isDead(character, find)) {
    return { ok: false, code: 'notDead', message: 'The character is not dead.' };
  }
  const level = exhaustionLevel(character, find);
  if (level >= EXHAUSTION_DEATH_LEVEL) {
    const message = `At exhaustion ${level} the character is dead: revived, it would die again.`;
    return { ok: false, code: 'exhausted', level, message };
  }
  const max = maxOf(character, index);
  const current = Math.max(1, hp === 'max' ? max : Math.min(max, hp));
  return settled<HitPointRefusal>(
    character,
    stamp,
    hitPoints('revive', [
      changeTo(character, HP_CURRENT_PATH, current),
      ...deathSavesReset(character),
      ...knockOutEnded(character),
    ]),
    'The revival changes nothing.',
  );
}

/**
 * The character with `ask.amount` temporary hit points, and the entry. They never add up: the
 * larger of the old and the new stays, unless `replace` takes the new ones, the person's choice.
 * Nothing else changes, at 0 hit points too. Refused for an amount that is not a whole number
 * from 0, for a dead character (exhaustion 6 included, which `index` gives the entry of), and as
 * `unchanged` when the count stays.
 */
export function setTempHp(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly amount: number; readonly replace?: boolean },
  stamp: LogStamp,
): HitPointResult {
  const { amount, replace = false } = ask;
  const refused = refusal(character, finderOf(character, index), amount, 0);
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
