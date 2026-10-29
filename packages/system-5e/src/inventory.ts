import {
  type ActionResult,
  type ContentIndex,
  changeTo,
  type EntityFinder,
  finderOf,
  type LogStamp,
  withDropped,
} from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import { INVENTORY_PATH, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';

// SHEET-50: what the Gear tab does to the inventory's rows: worn, attuned, and which row holds
// which. Each action writes the whole list as one change (a log path steps only through objects,
// as ENG-63's `deathChanges` does), every other field and the order kept. Limits warn and never
// block (SPEC §8.2): attuning a fourth item is allowed, and `attunementWarnings` says so. Putting a
// row into a container is the one thing refused, since a row inside itself would not store.
// Equipping or attuning changes what the character has, so those two end with `withDropped`
// (SHEET-22); moving a row gives and takes away nothing. Weights are pounds, as stored (SPEC §7.5).

type Row = FifthEditionCharacter['systemData']['inventory'][number];

/** Why a row of the inventory was not changed. `code` and its data are for the screen. */
export type InventoryRefusal = { message: string } & (
  | { code: 'noRow'; uid: string }
  | { code: 'noContainer'; uid: string; container: string }
  | { code: 'insideItself'; uid: string; container: string }
);

export type InventoryResult = ActionResult<FifthEditionCharacter, InventoryRefusal | Unchanged>;

/** The row `uid` and its place in the list. */
function rowAt(
  character: FifthEditionCharacter,
  uid: string,
): { row: Row; at: number } | undefined {
  const rows = character.systemData.inventory;
  const at = rows.findIndex((row) => row.uid === uid);
  const row = rows[at];
  return row === undefined ? undefined : { row, at };
}

/** The row's name as an entry labels it: its item's, or the custom row's own. */
function labelOf(row: Row, find: EntityFinder<FifthEditionEntity>): L10n | undefined {
  if (row.custom !== undefined) return { en: row.custom.name };
  const item = row.itemId === undefined ? undefined : find(row.itemId);
  return item?.name;
}

/** What an entry names the row by: its item's id, or the custom row's name. */
function subjectOf(row: Row): string {
  return row.itemId ?? row.custom?.name ?? row.uid;
}

/** The character's rows with the row `uid` replaced by `changed`, and the change that writes them. */
function written(character: FifthEditionCharacter, at: number, changed: Row) {
  const rows = character.systemData.inventory.map((row, place) => (place === at ? changed : row));
  return [changeTo(character, INVENTORY_PATH, rows)];
}

/** The row with `fields` set; a field given as `undefined` is removed. */
function withFields(row: Row, fields: Partial<Record<keyof Row, unknown>>): Row {
  const next: Record<string, unknown> = { ...row, ...fields };
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  return next as unknown as Row;
}

/** The key of the action that sets each field off, then on. */
const SWITCH_ACTIONS = {
  equipped: ['unequipItem', 'equipItem'],
  attuned: ['unattuneItem', 'attuneItem'],
} as const;

/** `equipItem` and `attuneItem`: one field of a row, set, the entity-bound stored parts dropped. */
function switched(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  uid: string,
  field: 'equipped' | 'attuned',
  on: boolean,
  stamp: LogStamp,
): InventoryResult {
  const found = rowAt(character, uid);
  if (found === undefined) {
    return { ok: false, code: 'noRow', uid, message: `No row has the uid "${uid}".` };
  }
  const { row, at } = found;
  const action = SWITCH_ACTIONS[field][on ? 1 : 0];
  const changes = written(character, at, withFields(row, { [field]: on }));
  const find = finderOf(character, index);
  return withDropped(
    character,
    settled<InventoryRefusal>(
      character,
      stamp,
      { action, subject: subjectOf(row), label: labelOf(row, find), changes },
      `The row is already ${on ? '' : 'not '}${field}.`,
    ),
    index,
    fifthEditionModule,
  );
}

/**
 * The character with the row `uid` worn (`equipped: true`) or taken off, and the entry, as
 * `equipItem` or `unequipItem`. What counts as worn is ENG-44's. Refused for a row that is not
 * there, and as `unchanged` when the row already is so.
 */
export function equipItem(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly uid: string; readonly equipped: boolean },
  stamp: LogStamp,
): InventoryResult {
  return switched(character, index, ask.uid, 'equipped', ask.equipped, stamp);
}

/**
 * The character attuned to the row `uid` (`attuned: true`) or no longer, and the entry, as
 * `attuneItem` or `unattuneItem`. Never refused for the limits (SHEET-18, SHEET-63): they warn.
 * Refused for a row that is not there, and as `unchanged` when the row already is so.
 */
export function attuneItem(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly uid: string; readonly attuned: boolean },
  stamp: LogStamp,
): InventoryResult {
  return switched(character, index, ask.uid, 'attuned', ask.attuned, stamp);
}

/**
 * The character with the row `uid` put inside the row `container`, or out of any row when
 * `container` is not given, and the entry, as `moveItem`. Refused for a row or a container that is
 * not there, and for a container that is the row or inside it (no row ends up inside itself).
 */
export function moveItem(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly uid: string; readonly container?: string },
  stamp: LogStamp,
): InventoryResult {
  const { uid, container } = ask;
  const found = rowAt(character, uid);
  if (found === undefined) {
    return { ok: false, code: 'noRow', uid, message: `No row has the uid "${uid}".` };
  }
  if (container !== undefined) {
    if (rowAt(character, container) === undefined) {
      const message = `No row has the uid "${container}", so nothing can be put in it.`;
      return { ok: false, code: 'noContainer', uid, container, message };
    }
    if (containersOf(character, container).includes(uid)) {
      const message = `The row "${uid}" cannot be put inside "${container}", which is it or inside it.`;
      return { ok: false, code: 'insideItself', uid, container, message };
    }
  }
  const { row, at } = found;
  const find = finderOf(character, index);
  return settled<InventoryRefusal>(
    character,
    stamp,
    {
      action: 'moveItem',
      subject: subjectOf(row),
      label: labelOf(row, find),
      changes: written(character, at, withFields(row, { container })),
    },
    'The row is already there.',
  );
}

/** The row `uid` and every row it is inside, from the nearest outwards. */
function containersOf(character: FifthEditionCharacter, uid: string): string[] {
  const holder = new Map(character.systemData.inventory.map((row) => [row.uid as string, row]));
  const chain: string[] = [uid];
  for (let at = holder.get(uid)?.container; at !== undefined && !chain.includes(at); ) {
    chain.push(at);
    at = holder.get(at)?.container;
  }
  return chain;
}

/** What the character carries, in pounds. */
export interface CarriedWeight {
  /** Every row's weight added up; a row inside a container counts once. */
  readonly total: number;
  /** The weight of each row by its `uid`: its count × one's weight, its contents not included. */
  readonly rows: Readonly<Record<string, number>>;
  /** The ids of the items no pack has, each once, in the order of the rows. */
  readonly missing: readonly string[];
}

/**
 * What the character's rows weigh: `qty` × the item's weight, or the custom row's own. An item with
 * no weight counts 0; one `find` does not know counts 0 and is named in `missing`.
 */
export function carriedWeight(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
): CarriedWeight {
  const rows: Record<string, number> = {};
  const missing: string[] = [];
  let total = 0;
  for (const row of character.systemData.inventory) {
    let each = row.custom?.weight ?? 0;
    if (row.itemId !== undefined) {
      const item = find(row.itemId);
      if (item?.type === 'item') each = item.weight ?? 0;
      else if (!missing.includes(row.itemId)) missing.push(row.itemId);
    }
    rows[row.uid] = each * row.qty;
    total += each * row.qty;
  }
  return { total, rows, missing };
}
