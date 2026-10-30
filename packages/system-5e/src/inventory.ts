import {
  type ActionResult,
  type Computed,
  changeTo,
  type EntityFinder,
  type JsonValue,
  type LogStamp,
} from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import { INVENTORY_PATH, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// SHEET-50: the Gear tab's actions on an inventory row (SPEC §7.2): worn, attuned, and the
// container it is in. Each one is one log entry of the whole inventory list, since a log path
// does not step into a list (`readAt`): it applies only while the list still holds what the entry
// saw. Nothing here counts or refuses by a rule: more attuned rows than the limit warn
// (`attunementWarnings`, SHEET-18), and a second armor worn counts for nothing and warns
// (`equipmentOf`, ENG-44), as the person set them by hand (SPEC §8.2). None takes a row away, so
// none ends with `withDropped`: an item put away is still carried, and keeps its switches.

type Row = FifthEditionCharacter['systemData']['inventory'][number];

/** Why an inventory action did not run. `code` and its data are for the screen. */
export type InventoryRefusal = { message: string } & (
  | { code: 'noRow'; uid: string }
  | { code: 'noContainer'; uid: string; container: string }
  | { code: 'insideItself'; uid: string; container: string }
);

/** The row's name, as the toast and the log show it; none for a row no pack has. */
function nameOf(row: Row, find: EntityFinder<FifthEditionEntity>): L10n | undefined {
  if (row.custom !== undefined) return { en: row.custom.name };
  const entity = row.itemId === undefined ? undefined : find(row.itemId);
  return entity?.name;
}

/** The inventory with the row `uid` replaced by `next`, every other row and the order kept. */
function replaced(rows: readonly Row[], uid: string, next: Row): Row[] {
  return rows.map((row) => (row.uid === uid ? next : row));
}

/** The row `uid` made into what `change` says, as one entry of `action`. */
function changed(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  uid: string,
  stamp: LogStamp,
  action: string,
  change: (row: Row) => Row,
): ActionResult<FifthEditionCharacter, InventoryRefusal | Unchanged> {
  const rows = character.systemData.inventory;
  const row = rows.find((each) => each.uid === uid);
  if (row === undefined) {
    return {
      ok: false,
      code: 'noRow',
      uid,
      message: `No row of the inventory has the uid ${uid}.`,
    };
  }
  const label = nameOf(row, find);
  const subject = row.itemId ?? uid;
  return settled<InventoryRefusal>(
    character,
    stamp,
    {
      action,
      subject,
      ...(label !== undefined && { label }),
      changes: [changeTo(character, INVENTORY_PATH, replaced(rows, uid, change(row)) as JsonValue)],
    },
    `The row ${uid} is already so.`,
  );
}

/**
 * The character with the row `uid` worn, or put away, and the entry. Refused for a uid no row has,
 * and as `unchanged` when the row already is so.
 */
export function setEquipped(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  uid: string,
  equipped: boolean,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, InventoryRefusal | Unchanged> {
  const action = equipped ? 'equipItem' : 'unequipItem';
  return changed(character, find, uid, stamp, action, (row) => ({ ...row, equipped }));
}

/**
 * The character with the row `uid` attuned, or not, and the entry. Never refused for the limit of
 * three: it warns (SHEET-18). Refused for a uid no row has, and as `unchanged` when it already is.
 */
export function setAttuned(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  uid: string,
  attuned: boolean,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, InventoryRefusal | Unchanged> {
  const action = attuned ? 'attuneItem' : 'endAttunement';
  return changed(character, find, uid, stamp, action, (row) => ({ ...row, attuned }));
}

/** Every row inside the row `uid`, however deep. */
function insideOf(rows: readonly Row[], uid: string): Set<string> {
  const inside = new Set<string>();
  let found = true;
  while (found) {
    found = false;
    for (const { uid: each, container } of rows) {
      const within = container === uid || (container !== undefined && inside.has(container));
      if (within && !inside.has(each)) {
        inside.add(each);
        found = true;
      }
    }
  }
  return inside;
}

/**
 * The character with the row `uid` inside the row `container`, or carried loose when `container`
 * is `undefined`, and the entry. Refused for a row or a container no row has, and for a container
 * that is the row or inside it (the stored shape allows no row inside itself).
 */
export function moveItem(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  uid: string,
  container: string | undefined,
  stamp: LogStamp,
): ActionResult<FifthEditionCharacter, InventoryRefusal | Unchanged> {
  const rows = character.systemData.inventory;
  if (container !== undefined && rows.some((row) => row.uid === uid)) {
    if (!rows.some((row) => row.uid === container)) {
      const message = `No row of the inventory has the uid ${container}.`;
      return { ok: false, code: 'noContainer', uid, container, message };
    }
    if (container === uid || insideOf(rows, uid).has(container)) {
      const message = `The row ${uid} cannot be inside itself.`;
      return { ok: false, code: 'insideItself', uid, container, message };
    }
  }
  return changed(character, find, uid, stamp, 'moveItem', ({ container: _, ...row }) =>
    container === undefined ? row : { ...row, container },
  );
}

/**
 * What the Gear tab says about the rows as they are worn and attuned: more attuned than the limit,
 * two copies of an item attuned (SHEET-18, SHEET-63), a second armor or shield worn (ENG-44). The
 * screen writes the words; `item`, `worn` and `itemId` are entity ids.
 */
export type GearWarning =
  | { rule: 'attunementLimit'; attuned: number; limit: number }
  | { rule: 'attunementCopies'; itemId: string; attuned: number }
  | { rule: 'oneAtATime'; item: string; worn: string };

/** The warnings of `computed` that are about the rows of the inventory, each once. */
export function gearWarnings(computed: Computed<FifthEditionEntity>): GearWarning[] {
  const found = new Map<string, GearWarning>();
  for (const warning of computed.warnings) {
    const { data } = warning as { data?: Readonly<Record<string, string | number>> };
    const rule = 'rule' in warning ? warning.rule : undefined;
    if (data === undefined) continue;
    if (rule === 'attunementLimit' && typeof data.attuned === 'number') {
      found.set(rule, { rule, attuned: data.attuned, limit: Number(data.limit) });
    } else if (rule === 'attunementCopies' && typeof data.itemId === 'string') {
      const { itemId } = data;
      found.set(`${rule}:${itemId}`, { rule, itemId, attuned: Number(data.attuned) });
    } else if (rule === 'oneAtATime' && typeof data.item === 'string') {
      const { item } = data;
      found.set(`${rule}:${item}`, { rule, item, worn: String(data.worn) });
    }
  }
  return [...found.values()];
}
