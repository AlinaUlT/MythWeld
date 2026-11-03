import {
  type ActionResult,
  type ContentIndex,
  changeTo,
  type LogStamp,
  withDropped,
} from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import { INVENTORY_PATH, isWhole, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';

// SHEET-50: the actions on the inventory (SPEC §7.2): worn and attuned, how many, which row a row
// is inside, and taking a row away. The inventory is written as a whole list, since a log path
// steps only through objects (ENG-63). Nothing here refuses the rules' own limits: a fourth
// attunement, a second armor worn, are warned by `compute()`, never refused (§8.2). A row taken
// away ends with `withDropped` (SHEET-22), so the switches and the AC pin of what it gave go too;
// the rows inside it are put where it was.

type Row = FifthEditionCharacter['systemData']['inventory'][number];

/** Why an inventory action was refused. `code` and its data are for the screen. */
export type InventoryRefusal = { message: string } & (
  | { code: 'noRow'; uid: string }
  | { code: 'badQuantity'; qty: number }
  | { code: 'noContainer'; container: string }
  | { code: 'insideItself'; uid: string; container: string }
);

/** What every inventory action is asked: the row, and its name for the toast. */
export interface RowAsk {
  readonly uid: string;
  /** The row's name, which the entry carries as its label (the toast names it). */
  readonly label?: L10n | undefined;
}

type Result = ActionResult<FifthEditionCharacter, InventoryRefusal | Unchanged>;

/** What a row is called in the log when no label is given: its item's id, or its own name. */
function subjectOf(row: Row): string {
  return row.itemId ?? row.custom?.name ?? row.uid;
}

/** The row `uid`, or a refusal. */
function rowOf(character: FifthEditionCharacter, uid: string): Row | InventoryRefusal {
  const found = character.systemData.inventory.find((row) => row.uid === uid);
  return found ?? { code: 'noRow', uid, message: `No row of the inventory has the uid "${uid}".` };
}

/** `row` with `container` set, or the field left out when there is none. */
function insideOf(row: Row, container: string | undefined): Row {
  const { container: _, ...rest } = row;
  return container === undefined ? rest : { ...rest, container };
}

/** The character's inventory as the one change of an entry of `action`. */
function written(
  character: FifthEditionCharacter,
  stamp: LogStamp,
  action: string,
  row: Row,
  label: L10n | undefined,
  rows: readonly Row[],
): Result {
  return settled<InventoryRefusal>(
    character,
    stamp,
    {
      action,
      subject: subjectOf(row),
      ...(label !== undefined && { label }),
      changes: [
        changeTo(
          character,
          INVENTORY_PATH,
          rows.map((each) => ({ ...each })),
        ),
      ],
    },
    'The inventory changes nothing.',
  );
}

/** Whether `uid` is worn, held or not: sets the row's `equipped`. */
export function setRowEquipped(
  character: FifthEditionCharacter,
  ask: RowAsk & { readonly equipped: boolean },
  stamp: LogStamp,
): Result {
  const row = rowOf(character, ask.uid);
  if ('code' in row) return { ok: false, ...row };
  const rows = character.systemData.inventory.map((each) =>
    each.uid === ask.uid ? { ...each, equipped: ask.equipped } : each,
  );
  return written(character, stamp, 'setEquipped', row, ask.label, rows);
}

/** Whether the character is attuned to the row's item (SRD Attunement): sets `attuned`. */
export function setRowAttuned(
  character: FifthEditionCharacter,
  ask: RowAsk & { readonly attuned: boolean },
  stamp: LogStamp,
): Result {
  const row = rowOf(character, ask.uid);
  if ('code' in row) return { ok: false, ...row };
  const rows = character.systemData.inventory.map((each) =>
    each.uid === ask.uid ? { ...each, attuned: ask.attuned } : each,
  );
  return written(character, stamp, 'setAttuned', row, ask.label, rows);
}

/** How many of the row's item the character carries: a whole number from 1. */
export function setRowQuantity(
  character: FifthEditionCharacter,
  ask: RowAsk & { readonly qty: number },
  stamp: LogStamp,
): Result {
  if (!isWhole(ask.qty, 1)) {
    return {
      ok: false,
      code: 'badQuantity',
      qty: ask.qty,
      message: `${ask.qty} is not a whole number of items from 1.`,
    };
  }
  const row = rowOf(character, ask.uid);
  if ('code' in row) return { ok: false, ...row };
  const rows = character.systemData.inventory.map((each) =>
    each.uid === ask.uid ? { ...each, qty: ask.qty } : each,
  );
  return written(character, stamp, 'setQuantity', row, ask.label, rows);
}

/**
 * Puts the row inside the row `container`, or takes it out with none. Refused for a row that
 * is not there, a container that is not, and a row put inside itself or inside what it holds.
 */
export function setRowContainer(
  character: FifthEditionCharacter,
  ask: RowAsk & { readonly container: string | undefined },
  stamp: LogStamp,
): Result {
  const row = rowOf(character, ask.uid);
  if ('code' in row) return { ok: false, ...row };
  const { container } = ask;
  const rows = character.systemData.inventory;
  if (container !== undefined) {
    if (!rows.some((each) => each.uid === container)) {
      return {
        ok: false,
        code: 'noContainer',
        container,
        message: `No row of the inventory has the uid "${container}".`,
      };
    }
    const passed = new Set<string>();
    for (
      let at: string | undefined = container;
      at !== undefined && !passed.has(at);
      at = rows.find((each) => each.uid === at)?.container
    ) {
      if (at === ask.uid) {
        return {
          ok: false,
          code: 'insideItself',
          uid: ask.uid,
          container,
          message: `A row cannot be inside itself or inside a row it holds.`,
        };
      }
      passed.add(at);
    }
  }
  const next = rows.map((each) => (each.uid === ask.uid ? insideOf(each, container) : each));
  return written(character, stamp, 'moveItem', row, ask.label, next);
}

/**
 * Takes the row away. The rows inside it are put where it was (inside its own container, or on
 * their own), and what the item gave that no longer applies goes with it (`withDropped`).
 */
export function removeRow(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: RowAsk,
  stamp: LogStamp,
): Result {
  const row = rowOf(character, ask.uid);
  if ('code' in row) return { ok: false, ...row };
  const rows = character.systemData.inventory
    .filter((each) => each.uid !== ask.uid)
    .map((each) => (each.container === ask.uid ? insideOf(each, row.container) : each));
  return withDropped(
    character,
    written(character, stamp, 'removeItem', row, ask.label, rows),
    index,
    fifthEditionModule,
  );
}
