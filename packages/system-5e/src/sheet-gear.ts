import type { Computed, EntityFinder } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { needsAttunement } from './equipment';

// SHEET-50: what the Gear tab names for a fifth-edition character (SPEC §7.2): the inventory in
// the order the character keeps it, each row under the row it is inside, with its item's weight
// and whether it asks for attunement; the weight carried, in pounds (SPEC §7.5: stored units are
// pounds); and the rules the equipment breaks, which `compute()` warns and never refuses: the
// attunement limit and copies as character rules, one armor and one shield at a time as the rule of
// the step that counts the worn item.

type Row = FifthEditionCharacter['systemData']['inventory'][number];

/** A row of the Gear tab. */
export interface GearRow {
  uid: string;
  /** The row's item; a custom row has none. */
  itemId?: string;
  /** A custom row's name. */
  customName?: string;
  qty: number;
  equipped: boolean;
  attuned: boolean;
  /** The row this one is inside, when that row is there. */
  container?: string;
  note?: string;
  /** One item's weight in pounds, when the item or the custom row has one. */
  weight?: number;
  /** The item asks for attunement. */
  asksAttunement: boolean;
  /** How many rows are inside this one, and how deep this one is. */
  inside: number;
  depth: number;
}

/** The rules of the equipment the screen words. */
export const GEAR_RULES = ['attunementLimit', 'attunementCopies', 'oneAtATime'] as const;
export type GearRule = (typeof GEAR_RULES)[number];

/** A rule the equipment breaks, with the data its warning carries. */
export interface GearWarning {
  rule: GearRule;
  data: Readonly<Record<string, string | number>>;
}

export interface GearShown {
  rows: GearRow[];
  /** What the character carries, in pounds: each row's weight times its quantity, contents too. */
  weight: number;
  warnings: GearWarning[];
}

/** The most steps down the rows inside rows followed: far above any real depth. */
const MAX_DEPTH = 8;

function isGearRule(rule: string): rule is GearRule {
  return (GEAR_RULES as readonly string[]).includes(rule);
}

export function fifthEditionGear(
  character: FifthEditionCharacter,
  computed: Pick<Computed<FifthEditionEntity>, 'warnings'>,
  find: EntityFinder<FifthEditionEntity>,
): GearShown {
  const rows = character.systemData.inventory;
  const present = new Set(rows.map(({ uid }) => uid as string));
  const insideOf = (uid: string) => rows.filter((row) => row.container === uid);

  const shown: GearRow[] = [];
  let weight = 0;
  const place = (row: Row, depth: number, seen: ReadonlySet<string>) => {
    const item = row.itemId === undefined ? undefined : find(row.itemId);
    const each = item?.type === 'item' ? item.weight : row.custom?.weight;
    weight += (each ?? 0) * row.qty;
    const inside = insideOf(row.uid);
    shown.push({
      uid: row.uid,
      ...(row.itemId !== undefined && { itemId: row.itemId }),
      ...(row.custom !== undefined && { customName: row.custom.name }),
      qty: row.qty,
      equipped: row.equipped,
      attuned: row.attuned,
      ...(row.container !== undefined &&
        present.has(row.container) && { container: row.container }),
      ...(row.note !== undefined && { note: row.note }),
      ...(each !== undefined && { weight: each }),
      asksAttunement: item?.type === 'item' && needsAttunement(item),
      inside: inside.length,
      depth,
    });
    if (depth >= MAX_DEPTH) return;
    for (const next of inside) {
      if (!seen.has(next.uid)) place(next, depth + 1, new Set([...seen, row.uid]));
    }
  };
  for (const row of rows) {
    // A row inside a row that is not there is carried on its own.
    if (row.container === undefined || !present.has(row.container)) place(row, 0, new Set());
  }

  const warnings = computed.warnings.flatMap((warning): GearWarning[] =>
    (warning.code === 'characterRule' || warning.code === 'stepRule') && isGearRule(warning.rule)
      ? [
          {
            rule: warning.rule,
            data: Object.fromEntries(
              Object.entries(warning.data ?? {}).filter(
                (entry): entry is [string, string | number] =>
                  typeof entry[1] === 'string' || typeof entry[1] === 'number',
              ),
            ),
          },
        ]
      : [],
  );
  return { rows: shown, weight, warnings };
}
