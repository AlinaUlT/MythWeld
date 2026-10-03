import { finderOf, type LogStamp, loadContentIndex, reverseEntry } from '@grimoire/engine';
import { type LogEntry, logEntrySchema } from '@grimoire/schema';
import { expect } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type fifthEditionCharacterSchema,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { srd2014, srd2024 } from './golden/index.ts';

// ENG-20: what the tests of fifth edition's tracker actions share: the packs, a character with
// its trackers set, the checks every entry passes, and the made-up spells and pact class. The
// made-up entities (`character:`) carry no text of a book. ENG-21: the hit dice and the core's
// resources a test sets. ENG-58: whether the character is stable. ENG-59: the inspiration held.
// ENG-63: the inventory, which death changes. ENG-65: whether the character is knocked out. ENG-67:
// how a character finds an entry, which `isDead` reads.

export type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** The pack of the character's edition. */
export const indexOf = (character: FifthEditionCharacter) =>
  character.ruleset === '2014' ? index2014.index : index2024.index;

/** How the character finds an entity in the pack of its edition: `isDead` reads it (ENG-67). */
export const findIn = (character: FifthEditionCharacter) => finderOf(character, indexOf(character));

/** A character opened as a file would be. */
export const open = (character: CharacterInput) => opened(openFifthEditionCharacter(character));

export const stamp: LogStamp = {
  id: '3f2b8c1d-9e4a-4b7c-8d6e-5a1f0c2b3d4e',
  at: '2026-10-02T21:00:00.000Z',
  by: { role: 'player', name: 'Wren' },
};

/** A spell's id, as the trackers keep it. */
export type SpellId = NonNullable<CharacterInput['systemData']['state']['concentration']>;

/** The trackers a test sets; each one not given is the golden's. */
interface Trackers {
  current?: number;
  temp?: number;
  success?: number;
  failure?: number;
  stable?: boolean;
  concentration?: SpellId;
  slotsSpent?: Record<string, number>;
  pactSlotsSpent?: number;
  hitDiceSpent?: Record<string, number>;
  /** The uses spent of each resource: the core's `state.resources`. */
  resources?: Record<string, number>;
  inspiration?: number;
  knockedOut?: 'resting' | 'interrupted';
}

/** A golden character with `trackers` set, and `more` of its fields replaced, opened. */
export function withTrackers(
  golden: CharacterInput,
  trackers: Trackers,
  more: Partial<CharacterInput> = {},
): FifthEditionCharacter {
  const state = golden.systemData.state;
  const { current, temp, success, failure, stable, concentration, slotsSpent } = trackers;
  const { pactSlotsSpent } = trackers;
  const { hitDiceSpent, resources, inspiration, knockedOut } = trackers;
  const core = more.state ?? golden.state;
  return open({
    ...golden,
    ...more,
    state: { ...core, ...(resources !== undefined && { resources }) },
    systemData: {
      ...golden.systemData,
      ...more.systemData,
      state: {
        ...state,
        hp: { current: current ?? state.hp.current, temp: temp ?? state.hp.temp },
        deathSaves: {
          success: success ?? state.deathSaves.success,
          failure: failure ?? state.deathSaves.failure,
          stable: stable ?? state.deathSaves.stable,
        },
        ...(concentration !== undefined && { concentration }),
        ...(slotsSpent !== undefined && { slotsSpent }),
        ...(pactSlotsSpent !== undefined && { pactSlotsSpent }),
        ...(hitDiceSpent !== undefined && { hitDiceSpent }),
        ...(inspiration !== undefined && { inspiration }),
        ...(knockedOut !== undefined && { knockedOut }),
      },
    },
  });
}

/** An action that happened. */
type Done = { ok: true; character: FifthEditionCharacter; entry: LogEntry };

/** An action that was refused. */
type Refused = { ok: false; code: string; message: string };

/**
 * An action on `before` that happened: its entry parses and carries the stamp, its character
 * opens unchanged, and reversing the entry gives `before` back.
 */
export function done<R extends Done | Refused>(
  before: FifthEditionCharacter,
  result: R,
): Extract<R, { ok: true }> {
  const action = result as Done | Refused;
  if (!action.ok) throw new Error(`${action.code}: ${action.message}`);
  expect(logEntrySchema.parse(action.entry)).toEqual(action.entry);
  expect(action.entry).toMatchObject({ id: stamp.id, at: stamp.at, by: stamp.by });
  expect(open(action.character)).toEqual(action.character);
  const back = reverseEntry(action.character, action.entry);
  expect(back.ok && back.character).toEqual(before);
  return result as Extract<R, { ok: true }>;
}

/** A refusal without its log message, which must be there. */
export function refused(result: Done | Refused): Omit<Refused, 'ok' | 'message'> {
  if (result.ok) throw new Error('The action happened.');
  const { ok: _, message, ...refusal } = result;
  expect(message).not.toBe('');
  return refusal;
}

/** A copy of a value JSON holds: a character, an ask, a stamp. */
export function copyOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A deep-frozen copy of `value`. */
export function frozen<T>(value: T): T {
  const copy = copyOf(value);
  const freeze = (each: unknown) => {
    if (typeof each !== 'object' || each === null) return;
    Object.freeze(each);
    for (const inner of Object.values(each)) freeze(inner);
  };
  freeze(copy);
  return copy;
}

/** The places in `systemData.state` the actions change. */
const STATE = ['systemData', 'state'];
export const HP = [...STATE, 'hp', 'current'];
export const TEMP = [...STATE, 'hp', 'temp'];
export const SUCCESS = [...STATE, 'deathSaves', 'success'];
export const FAILURE = [...STATE, 'deathSaves', 'failure'];
export const STABLE = [...STATE, 'deathSaves', 'stable'];
export const CONCENTRATION = [...STATE, 'concentration'];
export const PACT = [...STATE, 'pactSlotsSpent'];
export const INSPIRATION = [...STATE, 'inspiration'];
export const KNOCKED_OUT = [...STATE, 'knockedOut'];
export const INVENTORY = ['systemData', 'inventory'];
export const slot = (level: number) => [...STATE, 'slotsSpent', `${level}`];
export const hitDice = (die: number) => [...STATE, 'hitDiceSpent', `d${die}`];
export const resource = (key: string) => ['state', 'resources', key];

const source = { pack: 'character' };

/** A made-up spell of `level`, with or without concentration. */
export function ownSpell(slug: string, level: number, concentration: boolean): EntityInput {
  return {
    id: `character:spell/${slug}`,
    type: 'spell',
    ruleset: 'any',
    name: { en: slug },
    source,
    level,
    school: 'evocation',
    castingTime: { value: 1, unit: 'action' },
    range: { kind: 'self' },
    components: { v: true, s: true },
    duration: concentration ? { kind: 'timed', value: 1, unit: 'minute' } : { kind: 'instant' },
    concentration,
    ritual: false,
    classes: ['hexer'],
  };
}

/** A made-up pact caster, as ENG-15's test has it: at level 3, two slots of level 2. */
export const hexer: EntityInput = {
  id: 'character:class/hexer',
  type: 'class',
  key: 'hexer',
  ruleset: 'any',
  name: { en: 'hexer' },
  source,
  hitDie: 8,
  saves: ['wis', 'cha'],
  subclassLevel: 3,
  spellcasting: {
    ability: 'cha',
    progression: 'pact',
    preparation: 'known',
    cantripsKnown: Array.from({ length: 20 }, () => 2),
    slotsTable: Array.from({ length: 20 }, (_, at) =>
      at === 0 ? [1] : at === 1 ? [2] : at < 4 ? [0, 2] : [0, 0, 2],
    ),
    spellList: { classKey: 'hexer' },
  },
};
