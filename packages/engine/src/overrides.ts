import type { Computed } from './compute';
import { LEVEL_PATH } from './derived';
import type { CharacterCore, GatherableEntity } from './gather';
import { type Applied, applyEntry, sameJson } from './log';
import { type ActionResult, changeTo, entryOf, type LogStamp } from './trackers';

// SHEET-34: the manual edit (SPEC §6.1 step 7, BRIEF P5 "Override by hand"): a number the person
// sets over the one `compute()` gave. The edit is stored in `overrides`, one for each path, and
// always wins (ENG-17). Every system has it, so it lives in the core. Like the inventory, the list
// is written as a whole: a log path steps only through objects (ENG-63). An edit applies only to a
// number path (ENG-17: `overrideNotANumber` otherwise), so a path that holds no number is refused
// here, where the screen could not have offered it. A key path's edit stores a key, not a number,
// and is not made here. The level cannot be edited: gathering has read it before any edit applies.

/** The place the edits are stored. */
const OVERRIDES_PATH = ['overrides'] as const;

/** Why a manual edit was refused. `code` and its data are for the screen. */
export type OverrideRefusal = { message: string } & (
  | { code: 'notANumber'; path: string }
  | { code: 'badValue'; value: number }
  | { code: 'fixedPath'; path: string }
  | { code: 'noOverride'; path: string }
  | { code: 'unchanged' }
);

type Edit = CharacterCore<GatherableEntity>['overrides'][number];

/** The edit with a note only when the note shows a character, trimmed of the spaces around it. */
function edited(path: string, value: number, note: string | undefined): Edit {
  const text = note?.trim();
  return { path, value, ...(text !== undefined && text !== '' && { note: text }) };
}

/** The edits of `character` as `after` lists them, as one entry of `action`. */
function written<C extends CharacterCore<E>, E extends GatherableEntity>(
  character: C,
  stamp: LogStamp,
  action: 'setOverride' | 'clearOverride',
  path: string,
  after: readonly Edit[],
): ActionResult<C, OverrideRefusal> {
  const change = changeTo(
    character,
    OVERRIDES_PATH,
    after.map((each) => ({ ...each })),
  );
  if (sameJson(change.before, change.after)) {
    return { ok: false, code: 'unchanged', message: `${action} changes nothing.` };
  }
  const entry = entryOf(stamp, { action, subject: path, changes: [change] });
  const applied: Applied<C> = applyEntry(character, entry);
  return applied.ok ? { ok: true, character: applied.character, entry } : applied;
}

/**
 * Sets the manual edit of the number path `ask.path` to `ask.value`, with the person's `ask.note`:
 * a new edit, or the old one replaced in its place in the list. Refused when the path holds no
 * number now, is the level, or the value is not a finite number; as `unchanged` when the same edit
 * is there already.
 */
export function setOverride<C extends CharacterCore<E>, E extends GatherableEntity>(
  character: C,
  computed: Pick<Computed<E>, 'values'>,
  ask: { path: string; value: number; note?: string | undefined },
  stamp: LogStamp,
): ActionResult<C, OverrideRefusal> {
  const { path, value } = ask;
  if (path === LEVEL_PATH) {
    const message = `The level is read before any edit applies; "${path}" cannot be edited.`;
    return { ok: false, code: 'fixedPath', path, message };
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, code: 'badValue', value, message: `${value} is not a number.` };
  }
  const held = Object.hasOwn(computed.values, path) ? computed.values[path] : undefined;
  if (typeof held !== 'number') {
    const message = `"${path}" holds no number; only a number can be edited by hand.`;
    return { ok: false, code: 'notANumber', path, message };
  }
  const edit = edited(path, value, ask.note);
  const at = character.overrides.findIndex((each) => each.path === path);
  const after =
    at < 0
      ? [...character.overrides, edit]
      : character.overrides.map((each, index) => (index === at ? edit : each));
  return written(character, stamp, 'setOverride', path, after);
}

/** Takes the manual edit of `path` away, so the computed number shows again. */
export function clearOverride<C extends CharacterCore<E>, E extends GatherableEntity>(
  character: C,
  path: string,
  stamp: LogStamp,
): ActionResult<C, OverrideRefusal> {
  if (!character.overrides.some((each) => each.path === path)) {
    return { ok: false, code: 'noOverride', path, message: `"${path}" has no manual edit.` };
  }
  const after = character.overrides.filter((each) => each.path !== path);
  return written(character, stamp, 'clearOverride', path, after);
}
