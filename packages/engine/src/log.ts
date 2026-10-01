import { type DocPath, type LogChange, type LogEntry, UNSAFE_PATH_STEPS } from '@grimoire/schema';

// ENG-30: applying a log entry, and reversing it (ADR 014 item 10). Both are pure. Each change
// says what its place holds before and after; an entry applies only where every place still holds
// its `before` value, and reverses only where every place holds its `after` value. Otherwise
// nothing changes and the refusal names the place, so a pending entry never writes over a newer
// value, and an old entry is never undone over a later one.

/** A JSON value, as a log entry holds one. A missing value is a field that is not there. */
export type JsonValue = Exclude<LogChange['before'], undefined>;

/** Why an entry did not apply. `code` and its data are for the screen; `message` is for logs. */
export type EntryRefusal = { message: string } & (
  | { code: 'badPath'; path: DocPath }
  | { code: 'changed'; path: DocPath; expected?: JsonValue; found?: JsonValue }
);

/** What applying or reversing gives: the changed character, or why nothing changed. */
export type Applied<C> = { ok: true; character: C } | ({ ok: false } & EntryRefusal);

/** An object's own fields: what a path steps through. */
type Fields = Readonly<Record<string, unknown>>;

/** The value is an object with fields, not a list and not `null`. */
function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What `path` holds in `root`: `undefined` when its last field is not there. Not `ok` when the way
 * to it is not objects, or a step is unsafe (`UNSAFE_PATH_STEPS`) or empty.
 */
export function readAt(
  root: unknown,
  path: readonly string[],
): { ok: true; value: unknown } | { ok: false } {
  if (path.length === 0) return { ok: false };
  let at = root;
  for (const step of path) {
    if (step === '' || UNSAFE_PATH_STEPS.includes(step) || !isFields(at)) return { ok: false };
    at = Object.hasOwn(at, step) ? at[step] : undefined;
  }
  return { ok: true, value: at };
}

/** Two values are the same JSON: fields in any order, a field holding `undefined` not there. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((each, index) => sameJson(each, b[index]))
    );
  }
  if (isFields(a) && isFields(b)) {
    const keysOf = (fields: Fields) =>
      Object.keys(fields).filter((key) => fields[key] !== undefined);
    const keys = keysOf(a);
    return (
      keys.length === keysOf(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
    );
  }
  return a === b;
}

/** A copy of a value as JSON keeps it: `undefined` for a field that is not there. */
export function copyJson(value: unknown): JsonValue | undefined {
  return value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as JsonValue);
}

/** `at` with `value` at `path` (removed when `undefined`), each object on the way copied. */
function writtenAt(at: Fields, path: readonly string[], value: unknown): Fields {
  const [step, ...rest] = path;
  if (step === undefined) return at;
  if (rest.length > 0) return { ...at, [step]: writtenAt(at[step] as Fields, rest, value) };
  if (value === undefined)
    return Object.fromEntries(Object.entries(at).filter(([key]) => key !== step));
  return { ...at, [step]: value };
}

/** Moves every place of `entry` from its `from` value to its `to` value, or refuses. */
function moved<C>(
  character: C,
  entry: LogEntry,
  from: 'before' | 'after',
  to: 'before' | 'after',
): Applied<C> {
  for (const change of entry.changes) {
    const path = [...change.path];
    const found = readAt(character, path);
    const shown = path.join('.');
    if (!found.ok) {
      return {
        ok: false,
        code: 'badPath',
        path,
        message: `"${shown}" is not a place in the character; nothing is changed.`,
      };
    }
    const expected = change[from];
    if (!sameJson(found.value, expected)) {
      const now = copyJson(found.value);
      return {
        ok: false,
        code: 'changed',
        path,
        ...(expected !== undefined && { expected: copyJson(expected) }),
        ...(now !== undefined && { found: now }),
        message: `"${shown}" holds ${JSON.stringify(now)}, not ${JSON.stringify(expected)}: it changed since the entry was made; nothing is changed.`,
      };
    }
  }
  let out = character as Fields;
  for (const change of entry.changes) out = writtenAt(out, change.path, copyJson(change[to]));
  return { ok: true, character: out as C };
}

/**
 * The character with `entry` applied: each place set to its `after` value. Refused, with nothing
 * changed, when a place does not hold its `before` value or is not a place in the character.
 * Applying does not check the result against the system's schema; the character's opener does,
 * when it is saved.
 */
export function applyEntry<C>(character: C, entry: LogEntry): Applied<C> {
  return moved(character, entry, 'before', 'after');
}

/**
 * The character with `entry` undone: each place set back to its `before` value. Refused, with
 * nothing changed, when a place does not hold its `after` value or is not a place in the
 * character.
 */
export function reverseEntry<C>(character: C, entry: LogEntry): Applied<C> {
  return moved(character, entry, 'after', 'before');
}
