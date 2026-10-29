// SHEET-50: the inventory's rows as the Gear tab draws them, and the warnings it owns. The rows keep
// their stored order, a row that holds others followed by them, each one level in; what each row
// is called, weighs and may do is read here once, so the section only draws.
import type { ComputeWarning, EntityFinder } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { AppCharacter, AppEntity, SheetSystem } from '../systems';

/** A row of the character's inventory. */
export type InventoryRow = AppCharacter['systemData']['inventory'][number];

/** One row, as the screen draws it. */
export interface GearRow {
  row: InventoryRow;
  /** How many rows it is inside of: 0 for a row carried loose. */
  depth: number;
  /** The row's name; none when its item is in no pack. */
  name: L10n | undefined;
  /** How many rows are directly inside it. */
  holds: number;
  /** What the row weighs by itself, in pounds. */
  weight: number;
  /** The row may be attuned: its item asks for it, or it is a custom row, or it already is. */
  attunable: boolean;
}

/** The rows in the order the screen draws them. */
export function gearRows(
  character: AppCharacter,
  find: EntityFinder<AppEntity>,
  inventory: SheetSystem['inventory'],
): GearRow[] {
  const rows = character.systemData.inventory;
  const weights = inventory.weight(character, find).rows;
  const inside = new Map<string | undefined, InventoryRow[]>();
  for (const row of rows) inside.set(row.container, [...(inside.get(row.container) ?? []), row]);

  const out: GearRow[] = [];
  const draw = (row: InventoryRow, depth: number) => {
    const item = row.itemId === undefined ? undefined : find(row.itemId);
    const entity = item?.type === 'item' ? item : undefined;
    out.push({
      row,
      depth,
      name: row.custom === undefined ? entity?.name : { en: row.custom.name },
      holds: inside.get(row.uid)?.length ?? 0,
      weight: weights[row.uid] ?? 0,
      attunable:
        row.attuned ||
        row.custom !== undefined ||
        (entity !== undefined && inventory.needsAttunement(entity)),
    });
    for (const held of inside.get(row.uid) ?? []) draw(held, depth + 1);
  };
  for (const row of inside.get(undefined) ?? []) draw(row, 0);
  return out;
}

/** The rows `uid` may be put inside: every other row, but not one that is inside it. */
export function placesFor(uid: string, rows: readonly GearRow[]): GearRow[] {
  const barred = new Set([uid]);
  // Rows are listed after what holds them, so one pass finds every row inside `uid`.
  for (const { row } of rows) {
    if (row.container !== undefined && barred.has(row.container)) barred.add(row.uid);
  }
  return rows.filter(({ row }) => !barred.has(row.uid));
}

/** A warning the Gear tab says, by its words' key and what fills them. */
export type GearWarning =
  | { key: 'attunementLimit'; attuned: number; limit: number }
  | { key: 'attunementCopies'; attuned: number; item: string }
  | { key: 'oneAtATime'; item: string; worn: string };

/** The warnings of `warnings` that the Gear tab says, each once, ids as they are stored. */
export function gearWarnings(warnings: readonly ComputeWarning[]): GearWarning[] {
  const found: GearWarning[] = [];
  for (const warning of warnings) {
    const data = 'data' in warning ? warning.data : undefined;
    if (data === undefined || !('rule' in warning)) continue;
    if (warning.code === 'characterRule' && warning.rule === 'attunementLimit') {
      found.push({
        key: 'attunementLimit',
        attuned: Number(data.attuned),
        limit: Number(data.limit),
      });
    } else if (warning.code === 'characterRule' && warning.rule === 'attunementCopies') {
      found.push({
        key: 'attunementCopies',
        attuned: Number(data.attuned),
        item: String(data.itemId),
      });
    } else if (warning.code === 'stepRule' && warning.rule === 'oneAtATime') {
      const next: GearWarning = {
        key: 'oneAtATime',
        item: String(data.item),
        worn: String(data.worn),
      };
      if (!found.some((each) => JSON.stringify(each) === JSON.stringify(next))) found.push(next);
    }
  }
  return found;
}
