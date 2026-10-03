import type { EntityPartId, L10n, LogChange, LogEntry, Roller } from '@grimoire/schema';
import type { Computed } from './compute';
import type { ContentIndex, Lookup } from './content-index';
import { evaluateNumber, type FormulaWarning } from './formula';
import { type CharacterCore, CONDITION_TYPE, type GatherableEntity, maxLevelOf } from './gather';
import {
  type Applied,
  applyEntry,
  copyJson,
  type EntryRefusal,
  type JsonValue,
  readAt,
  sameJson,
} from './log';

// ENG-30: the actions on the trackers every system has (SPEC §5.8 `state`): the uses spent of a
// resource, the conditions, the switches of toggled effects. Each action reads the character,
// builds the log entry that makes its change, and applies that entry, so the entry alone redoes
// or undoes it (ADR 014 item 10). A refusal changes nothing and gives no entry; an action that
// would change nothing is refused too, so the history never holds an empty entry.
// ENG-36: `entryOf` and `changeTo` are exported, so a module's action (fifth edition's level-up)
// builds its entry as these do.
// ENG-21: `recoveredOn` gives the changes that give uses back on a system's recovery events, for
// a module's rest to make part of its own entry.

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

/**
 * What an action gives: the changed character and its entry, or why nothing changed. `R` is the
 * action's own refusals: the core's tracker actions give `TrackerRefusal`, a module's its own.
 */
export type ActionResult<C, R extends { code: string; message: string } = TrackerRefusal> =
  | { ok: true; character: C; entry: LogEntry }
  | ({ ok: false } & (R | EntryRefusal));

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

/**
 * The change that sets `path` to `after`, or removes it when `after` is `undefined`: its `before`
 * is what the place holds now, none when the field is not there.
 */
export function changeTo(
  character: unknown,
  path: readonly string[],
  after: JsonValue | undefined,
): LogChange {
  const found = readAt(character, path);
  const before = found.ok ? copyJson(found.value) : undefined;
  return {
    path: [...path],
    ...(before !== undefined && { before }),
    ...(after !== undefined && { after: copyJson(after) }),
  };
}

/** What an action made: its key, what it was done to, its name, its changes. */
export type MadeChanges = Pick<LogEntry, 'action' | 'subject' | 'changes'> & {
  label?: L10n | undefined;
};

/** The entry of `stamp` with what an action made: who, when, and the changes. */
export function entryOf(stamp: LogStamp, made: MadeChanges): LogEntry {
  const { role, name, actorId } = stamp.by;
  return {
    id: stamp.id,
    at: stamp.at,
    by: { role, name, ...(actorId !== undefined && { actorId }) },
    action: made.action,
    subject: made.subject,
    ...(made.label !== undefined && { label: { ...made.label } }),
    changes: made.changes,
  };
}

/**
 * The entry of `stamp` with these changes, applied to the character. Refused as `unchanged` when
 * every change's value after is its value before.
 */
function done<C>(character: C, stamp: LogStamp, made: MadeChanges): ActionResult<C> {
  if (made.changes.every((change) => sameJson(change.before, change.after))) {
    return { ok: false, code: 'unchanged', message: `${made.action} changes nothing.` };
  }
  const entry = entryOf(stamp, made);
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
    changes: [changeTo(character, path, uses.spent + count)],
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
    changes: [changeTo(character, path, after)],
  });
}

/** A recovery amount's formula met something: it gave back what its number says (ENG-21). */
export interface RecoveryWarning {
  readonly code: 'recoveryFormula';
  readonly key: string;
  readonly part: EntityPartId;
  readonly warning: FormulaWarning;
  readonly message: string;
}

/** The changes to the uses spent that `recoveredOn` gives, and what their formulas met. */
export interface Recovered {
  changes: LogChange[];
  warnings: RecoveryWarning[];
}

/**
 * The uses each resource gets back on `events`, a system's recovery events in the order they
 * happen (a fifth-edition long rest: `long`, then `short`). Each grant of a key recovers by its
 * first recovery whose event comes first in `events`; a key two grants give gets back the most
 * either gives, `all` above any count. An amount's formula reads the computed values, rounded
 * down and never below 0. A key no grant gives keeps its count. One change per key whose uses
 * spent go down, in the order of `computed.resources`; nothing is applied.
 */
export function recoveredOn<E extends GatherableEntity>(
  character: TrackedCharacter<E>,
  computed: Pick<Computed<E>, 'values' | 'resources'>,
  events: readonly string[],
): Recovered {
  const { values } = computed;
  const read = (path: string) => (Object.hasOwn(values, path) ? values[path] : undefined);
  const back = new Map<string, number>();
  const warnings: RecoveryWarning[] = [];
  for (const { key, uses, from: part } of computed.resources) {
    const recovery = events
      .map((event) => uses.recovery.find((each) => each.on === event))
      .find((each) => each !== undefined);
    if (recovery === undefined) continue;
    let count = Number.POSITIVE_INFINITY;
    if (recovery.amount !== 'all') {
      const result = evaluateNumber(recovery.amount, read);
      for (const warning of result.warnings) {
        const message = `${warning.message} (the uses of "${key}" ${part} gives back on "${recovery.on}").`;
        warnings.push({ code: 'recoveryFormula', key, part, warning, message });
      }
      count = Number.isFinite(result.value) ? Math.max(0, Math.floor(result.value)) : 0;
    }
    back.set(key, Math.max(back.get(key) ?? 0, count));
  }
  const changes: LogChange[] = [];
  for (const [key, count] of back) {
    const spent = spentOf(character, key);
    const after = Math.max(0, spent - count);
    if (after < spent) changes.push(changeTo(character, [...RESOURCES, key], after));
  }
  return { changes, warnings };
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
    changes: [changeTo(character, CONDITIONS, copyJson(after))],
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
    changes: [changeTo(character, CONDITIONS, copyJson(after))],
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
    changes: [changeTo(character, path, on)],
  });
}
