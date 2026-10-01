import type { L10n, LogChange, LogEntry, Roller } from '@grimoire/schema';
import type { Computed } from './compute';
import type { ContentIndex, Lookup } from './content-index';
import { type CharacterCore, CONDITION_TYPE, type GatherableEntity, maxLevelOf } from './gather';
import { type Applied, applyEntry, copyJson, type EntryRefusal, readAt, sameJson } from './log';

// ENG-30: the actions on the trackers every system has (SPEC §5.8 `state`): the uses spent of a
// resource, the conditions, the switches of toggled effects. Each action reads the character,
// builds the log entry that makes its change, and applies that entry, so the entry alone redoes
// or undoes it (ADR 014 item 10). A refusal changes nothing and gives no entry; an action that
// would change nothing is refused too, so the history never holds an empty entry.

/**
 * Who makes a change, when, and the new entry's id. The caller gives them, as it gives a roll's
 * (ENG-26): the engine has no clock and no random source.
 */
export interface LogStamp {
  readonly id: string;
  readonly at: string;
  readonly by: Roller;
}

/** A character whose trackers also hold the uses spent of each resource key (SPEC §5.8). */
export interface TrackedCharacter<E extends GatherableEntity> extends CharacterCore<E> {
  readonly state: CharacterCore<E>['state'] & {
    readonly resources: Readonly<Partial<Record<string, number>>>;
  };
}

/** Why an action did not run. `code` and its data are for the screen; `message` is for logs. */
export type TrackerRefusal = { message: string } & (
  | { code: 'badCount'; count: number }
  | { code: 'noResource'; key: string }
  | { code: 'notEnough'; key: string; left: number; count: number }
  | { code: 'missing'; id: string }
  | { code: 'notACondition'; id: string; type: string }
  | { code: 'badLevel'; id: string; level: number; max: number }
  | { code: 'noToggle'; part: string }
  | { code: 'unchanged' }
);

/** What an action gives: the changed character and its entry, or why nothing changed. */
export type ActionResult<C> =
  | { ok: true; character: C; entry: LogEntry }
  | ({ ok: false } & (TrackerRefusal | EntryRefusal));

/** A resource's maximum (ENG-29), the uses spent, and the uses left. */
export interface ResourceUses {
  max: number;
  spent: number;
  left: number;
}

const RESOURCES = ['state', 'resources'] as const;
const CONDITIONS = ['state', 'conditions'] as const;
const TOGGLES = ['state', 'toggles'] as const;

/** A count of uses or levels: a whole number from 1. */
function isCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1;
}

/** `{ before }` with what `path` holds, or nothing when the field is not there. */
function before(character: unknown, path: readonly string[]): Pick<LogChange, 'before'> {
  const found = readAt(character, path);
  const value = found.ok ? copyJson(found.value) : undefined;
  return value === undefined ? {} : { before: value };
}

/**
 * The entry of `stamp` with these changes, applied to the character. Refused as `unchanged` when
 * every change's value after is its value before.
 */
function done<C>(
  character: C,
  stamp: LogStamp,
  made: Pick<LogEntry, 'action' | 'subject' | 'changes'> & { label?: L10n | undefined },
): ActionResult<C> {
  if (made.changes.every((change) => sameJson(change.before, change.after))) {
    return { ok: false, code: 'unchanged', message: `${made.action} changes nothing.` };
  }
  const { role, name, actorId } = stamp.by;
  const entry: LogEntry = {
    id: stamp.id,
    at: stamp.at,
    by: { role, name, ...(actorId !== undefined && { actorId }) },
    action: made.action,
    subject: made.subject,
    ...(made.label !== undefined && { label: { ...made.label } }),
    changes: made.changes,
  };
  const applied: Applied<C> = applyEntry(character, entry);
  return applied.ok ? { ok: true, character: applied.character, entry } : applied;
}

/** The uses spent of `key` the trackers hold: 0 when none are stored. */
function spentOf(character: unknown, key: string): number {
  const found = readAt(character, [...RESOURCES, key]);
  return found.ok && typeof found.value === 'number' ? found.value : 0;
}

/**
 * A resource's uses: its maximum, the uses spent, and the uses left, `floor(max) - spent` and
 * never below 0, since a maximum is its formula's number (ENG-29). `undefined` when no grant of
 * the character gives the key.
 */
export function resourceUses<E extends GatherableEntity>(
  character: TrackedCharacter<E>,
  computed: Pick<Computed<E>, 'values' | 'resources'>,
  key: string,
): ResourceUses | undefined {
  if (!computed.resources.some((given) => given.key === key)) return undefined;
  const value = computed.values[`resources.${key}.max`];
  const max = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  const spent = spentOf(character, key);
  return { max, spent, left: Math.max(0, Math.floor(max) - spent) };
}

/** The name of a resource key: its first grant's label. */
function resourceLabel<E extends GatherableEntity>(
  computed: Pick<Computed<E>, 'resources'>,
  key: string,
): L10n | undefined {
  return computed.resources.find((given) => given.key === key)?.label;
}

/** Spends `count` uses of the resource `key`. Refused when fewer are left. */
export function useResource<C extends TrackedCharacter<E>, E extends GatherableEntity>(
  character: C,
  computed: Pick<Computed<E>, 'values' | 'resources'>,
  ask: { key: string; count: number },
  stamp: LogStamp,
): ActionResult<C> {
  const { key, count } = ask;
  if (!isCount(count)) {
    return { ok: false, code: 'badCount', count, message: `${count} is not a count of uses.` };
  }
  const uses = resourceUses(character, computed, key);
  if (uses === undefined) {
    return { ok: false, code: 'noResource', key, message: `No grant gives the resource "${key}".` };
  }
  if (count > uses.left) {
    const { left } = uses;
    const message = `"${key}" has ${left} uses left, fewer than ${count}.`;
    return { ok: false, code: 'notEnough', key, left, count, message };
  }
  const path = [...RESOURCES, key];
  return done(character, stamp, {
    action: 'useResource',
    subject: key,
    label: resourceLabel(computed, key),
    changes: [{ path, ...before(character, path), after: uses.spent + count }],
  });
}

/**
 * Gives back `amount` uses of the resource `key`, or all of them: the uses spent go down, never
 * below 0. A key no grant gives any more can still be given back.
 */
export function regainResource<C extends TrackedCharacter<E>, E extends GatherableEntity>(
  character: C,
  computed: Pick<Computed<E>, 'resources'>,
  ask: { key: string; amount: number | 'all' },
  stamp: LogStamp,
): ActionResult<C> {
  const { key, amount } = ask;
  if (amount !== 'all' && !isCount(amount)) {
    const message = `${amount} is not a count of uses.`;
    return { ok: false, code: 'badCount', count: amount, message };
  }
  const spent = spentOf(character, key);
  const after = amount === 'all' ? 0 : Math.max(0, spent - amount);
  if (after === spent) {
    return { ok: false, code: 'unchanged', message: `No use of "${key}" is spent.` };
  }
  const path = [...RESOURCES, key];
  return done(character, stamp, {
    action: 'regainResource',
    subject: key,
    label: resourceLabel(computed, key),
    changes: [{ path, ...before(character, path), after }],
  });
}

/** An entry by id: the character's own first, then its packs' (as gathering finds it). */
function lookUp<E extends GatherableEntity>(
  character: CharacterCore<E>,
  index: ContentIndex<E>,
  id: string,
): Lookup<E> {
  const own = character.localEntities.find((entity) => entity.id === id);
  return own === undefined ? index.get(id) : { ok: true, entity: own };
}

/**
 * Gives the character the condition `id` at `level` (1 when not given), or sets the level of one
 * it has, in its place. A level is stored only for a condition with more than one.
 */
export function setCondition<C extends TrackedCharacter<E>, E extends GatherableEntity>(
  character: C,
  index: ContentIndex<E>,
  ask: { id: string; level?: number },
  stamp: LogStamp,
): ActionResult<C> {
  const { id, level = 1 } = ask;
  const found = lookUp(character, index, id);
  if (!found.ok) return { ok: false, code: 'missing', id, message: found.message };
  const { entity } = found;
  if (entity.type !== CONDITION_TYPE) {
    const { type } = entity;
    return { ok: false, code: 'notACondition', id, type, message: `"${id}" is a ${type}.` };
  }
  const max = maxLevelOf(entity);
  if (!isCount(level) || level > max) {
    const message = `"${id}" takes a level from 1 to ${max}, not ${level}.`;
    return { ok: false, code: 'badLevel', id, level, max, message };
  }
  const conditions = character.state.conditions;
  const item = max > 1 ? { id, level } : { id };
  const after = conditions.some((each) => each.id === id)
    ? conditions.map((each) => (each.id === id ? item : each))
    : [...conditions, item];
  return done(character, stamp, {
    action: 'setCondition',
    subject: id,
    label: entity.name,
    changes: [{ path: [...CONDITIONS], ...before(character, CONDITIONS), after: copyJson(after) }],
  });
}

/** Takes the condition `id` from the character, whether or not a pack still has its entry. */
export function removeCondition<C extends TrackedCharacter<E>, E extends GatherableEntity>(
  character: C,
  index: ContentIndex<E>,
  ask: { id: string },
  stamp: LogStamp,
): ActionResult<C> {
  const { id } = ask;
  const conditions = character.state.conditions;
  if (!conditions.some((each) => each.id === id)) {
    return { ok: false, code: 'unchanged', message: `The character does not have "${id}".` };
  }
  const found = lookUp(character, index, id);
  const after = conditions.filter((each) => each.id !== id);
  return done(character, stamp, {
    action: 'removeCondition',
    subject: id,
    label: found.ok ? found.entity.name : undefined,
    changes: [{ path: [...CONDITIONS], ...before(character, CONDITIONS), after: copyJson(after) }],
  });
}

/**
 * Sets the switch of the toggled effect `part` (`<entityId>#<effectId>`) of an entity the
 * character has. Refused as `unchanged` when the switch already shows `on`: its stored state, else
 * its default.
 */
export function setToggle<C extends TrackedCharacter<E>, E extends GatherableEntity>(
  character: C,
  computed: Pick<Computed<E>, 'entities'>,
  ask: { part: string; on: boolean },
  stamp: LogStamp,
): ActionResult<C> {
  const { part, on } = ask;
  const toggle = computed.entities
    .flatMap(({ entity }) =>
      (entity.effects ?? []).map((effect) => ({ part: `${entity.id}#${effect.id}`, effect })),
    )
    .find((each) => each.part === part)?.effect.toggle;
  if (toggle === undefined) {
    const message = `"${part}" is not a toggled effect of an entity the character has.`;
    return { ok: false, code: 'noToggle', part, message };
  }
  const path = [...TOGGLES, part];
  const stored = readAt(character, path);
  const now = stored.ok && typeof stored.value === 'boolean' ? stored.value : toggle.default;
  if (now === on) {
    return { ok: false, code: 'unchanged', message: `"${part}" is already ${on ? 'on' : 'off'}.` };
  }
  return done(character, stamp, {
    action: 'setToggle',
    subject: part,
    label: toggle.label,
    changes: [{ path, ...before(character, path), after: on }],
  });
}
