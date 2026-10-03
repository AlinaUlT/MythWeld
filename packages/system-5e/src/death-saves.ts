import { type ActionResult, changeTo, type LogStamp } from '@grimoire/engine';
import type { LogChange, LogEntry } from '@grimoire/schema';
import {
  DEATH_FAILURE_PATH,
  DEATH_SUCCESS_PATH,
  deathSavesReset,
  HP_CURRENT_PATH,
  isWhole,
  settled,
  type Unchanged,
} from './actions';
import { DEATH_SAVES, type FifthEditionCharacter } from './character';

// ENG-58: fifth edition's death saves (both SRDs, one rule; ENG-58 §8), each one log entry. The
// person rolls the d20 and the action takes the face it kept and the total with its bonuses: a 1
// is two failures and a 20 one hit point back, whatever the total; otherwise 10 or more is a
// success. The third success makes the character stable and the third failure kills; a stable
// character makes no death saves until damage ends it (`applyDamage`). Every end of a run resets
// both counts (`deathSavesReset`).

/** The total a death save succeeds at, in both SRDs. */
export const DEATH_SAVE_DC = 10;

/** The d20 faces a death save reads by themselves: a 1 is two failures, a 20 one hit point back. */
export const DEATH_SAVE_FACES = { twoFailures: 1, hitPoint: 20 } as const;

/** The faces of the die a death save rolls. */
const D20_FACES = 20;

/** Why a death save, or stabilizing, did not happen. `code` and its data are for the screen. */
export type DeathSaveRefusal = { message: string } & (
  | { code: 'badFace'; natural: number }
  | { code: 'badTotal'; total: number }
  | { code: 'dead' }
  | { code: 'notDying'; hp: number }
  | { code: 'stable' }
);

/** What a death save asks for: the d20's face the roll kept, and the total. */
export interface DeathSaveAsk {
  /** The face the roll kept, from 1 to 20 (with advantage, the higher of the two). */
  readonly natural: number;
  /** The roll with its bonuses, a whole number; `natural` when not given. */
  readonly total?: number;
}

/** What a death save did, beside its changes: what the screen tells next. */
export interface DeathSaveOutcome {
  /** The successes it gave: 1 or 0. */
  successes: number;
  /** The failures it gave: 0, 1 or 2, never past the third. */
  failures: number;
  /** The hit points it gave back: 1 on a 20, else 0. */
  hp: number;
  /** Where it left the character: still dying, stable, dead, or up at 1 hit point. */
  status: 'dying' | 'stable' | 'dead' | 'up';
}

/** What a death save gives: the changed character, its entry and the outcome, or why not. */
export type DeathSaveResult =
  | { ok: true; character: FifthEditionCharacter; entry: LogEntry; outcome: DeathSaveOutcome }
  | Extract<ActionResult<FifthEditionCharacter, DeathSaveRefusal | Unchanged>, { ok: false }>;

/**
 * The character is dead: at 0 hit points with 3 death save failures (ENG-20). ENG-62 moved it here
 * from `hit-points.ts`, so the module reads it without an import loop.
 */
export function isDead(character: FifthEditionCharacter): boolean {
  const { hp, deathSaves } = character.systemData.state;
  return hp.current === 0 && deathSaves.failure >= DEATH_SAVES;
}

/** The character is stable: at 0 hit points, alive, and making no death saves. */
export function isStable(character: FifthEditionCharacter): boolean {
  const { hp, deathSaves } = character.systemData.state;
  return hp.current === 0 && deathSaves.stable && !isDead(character);
}

/** The refusal of a character that makes no death saves: dead, or above 0 hit points. */
function notDying(
  character: FifthEditionCharacter,
): ({ ok: false } & DeathSaveRefusal) | undefined {
  if (isDead(character)) {
    return { ok: false, code: 'dead', message: 'The character is dead.' };
  }
  const hp = character.systemData.state.hp.current;
  if (hp > 0) {
    const message = `The character has ${hp} hit points: it makes no death saves.`;
    return { ok: false, code: 'notDying', hp, message };
  }
  return undefined;
}

/** The death save changes an action makes, as one entry of `action`. */
function deathSaves(
  character: FifthEditionCharacter,
  stamp: LogStamp,
  action: string,
  changes: LogChange[],
  unchanged: string,
) {
  return settled<DeathSaveRefusal>(
    character,
    stamp,
    { action, subject: 'deathSaves', changes },
    unchanged,
  );
}

/**
 * The character after the death save `ask` rolled, the entry, and what it did. A 20 gives 1 hit
 * point and resets both counts; a 1 is two failures; otherwise a total of 10 or more is a
 * success. The third success resets both counts and makes the character stable; the third
 * failure is death. Refused for a face that is not a whole number from 1 to 20, a total that is
 * not a whole number, a dead character, one above 0 hit points, and a stable one.
 */
export function rollDeathSave(
  character: FifthEditionCharacter,
  ask: DeathSaveAsk,
  stamp: LogStamp,
): DeathSaveResult {
  const { natural, total = natural } = ask;
  if (!isWhole(natural, 1) || natural > D20_FACES) {
    const message = `${natural} is not a face of a d20.`;
    return { ok: false, code: 'badFace', natural, message };
  }
  if (!Number.isInteger(total)) {
    return { ok: false, code: 'badTotal', total, message: `${total} is not a whole number.` };
  }
  const refused = notDying(character);
  if (refused !== undefined) return refused;
  if (character.systemData.state.deathSaves.stable) {
    return {
      ok: false,
      code: 'stable',
      message: 'The character is stable: it makes no death saves.',
    };
  }
  const { success, failure } = character.systemData.state.deathSaves;

  let changes: LogChange[];
  let outcome: DeathSaveOutcome;
  if (natural === DEATH_SAVE_FACES.hitPoint) {
    changes = [changeTo(character, HP_CURRENT_PATH, 1), ...deathSavesReset(character)];
    outcome = { successes: 0, failures: 0, hp: 1, status: 'up' };
  } else if (natural !== DEATH_SAVE_FACES.twoFailures && total >= DEATH_SAVE_DC) {
    const stable = success + 1 >= DEATH_SAVES;
    changes = stable
      ? deathSavesReset(character, true)
      : [changeTo(character, DEATH_SUCCESS_PATH, success + 1)];
    outcome = { successes: 1, failures: 0, hp: 0, status: stable ? 'stable' : 'dying' };
  } else {
    const given = natural === DEATH_SAVE_FACES.twoFailures ? 2 : 1;
    const after = Math.min(DEATH_SAVES, failure + given);
    changes = [changeTo(character, DEATH_FAILURE_PATH, after)];
    const status = after >= DEATH_SAVES ? 'dead' : 'dying';
    outcome = { successes: 0, failures: after - failure, hp: 0, status };
  }
  const result = deathSaves(
    character,
    stamp,
    'rollDeathSave',
    changes,
    'The death save changes nothing.',
  );
  return result.ok ? { ...result, outcome } : result;
}

/**
 * The character made stable at 0 hit points, both counts reset, and the entry: first aid's
 * Medicine check, a spell, or knocking out, whichever the screen recorded. Refused for a dead
 * character, one above 0 hit points, and as `unchanged` for a stable one.
 */
export function stabilize(
  character: FifthEditionCharacter,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, DeathSaveRefusal | Unchanged> {
  const refused = notDying(character);
  if (refused !== undefined) return refused;
  return deathSaves(
    character,
    stamp,
    'stabilize',
    deathSavesReset(character, true),
    'The character is stable already.',
  );
}
