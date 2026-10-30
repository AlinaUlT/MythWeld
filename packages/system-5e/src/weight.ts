import type { BreakdownStep, DerivedStep, DeriveInput } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// SHEET-50: what the inventory weighs (SPEC §7.2 "weight"), in pounds, stored as the packs and the
// rows store it (SPEC §7.5). Three kinds of path, so each number on the Gear tab has a breakdown:
// `weight.row.<uid>` is one row's own weight, its quantity times what one weighs; `weight.in.<uid>`
// is what the rows inside that row weigh, each with what it holds; `weight.carried` is every row
// added once. A row inside a container is still carried, so it counts in `weight.carried` as its
// own row and the container's `weight.in` only names it. An item with no weight (most magic
// items), an item no pack has, and a custom row without one weigh 0: nothing is guessed.

/** The path of the whole inventory's weight. */
export const CARRIED_PATH = 'weight.carried';

/** The path of one row's own weight. */
export function rowWeightPath(uid: string): string {
  return `weight.row.${uid}`;
}

/** The path of the weight of the rows inside the row `uid`. */
export function containedWeightPath(uid: string): string {
  return `weight.in.${uid}`;
}

type Row = FifthEditionCharacter['systemData']['inventory'][number];

/** What one of the row weighs, and the step that names where it comes from; none when unknown. */
function unitOf(
  row: Row,
  find: DeriveInput<FifthEditionCharacter, FifthEditionEntity>['find'],
): { weight: number; step: (change: number) => BreakdownStep } | undefined {
  if (row.custom !== undefined) {
    const { weight } = row.custom;
    if (weight === undefined) return undefined;
    return { weight, step: (change) => ({ kind: 'base', value: weight, change }) };
  }
  const entity = row.itemId === undefined ? undefined : find(row.itemId);
  if (entity?.type !== 'item' || entity.weight === undefined) return undefined;
  const { id: source, name: label, weight } = entity;
  return { weight, step: (change) => ({ kind: 'entity', source, label, value: weight, change }) };
}

/** The weight paths of every row of the inventory, and the whole's (SHEET-50). */
export function weightSteps({
  character,
  find,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): Record<string, DerivedStep> {
  const rows = character.systemData.inventory;
  const steps: Record<string, DerivedStep> = {};
  for (const row of rows) {
    steps[rowWeightPath(row.uid)] = () => {
      const unit = unitOf(row, find);
      if (unit === undefined || row.qty === 0) return { value: 0, steps: [] };
      const value = unit.weight * row.qty;
      return { value, steps: [unit.step(value)] };
    };
    const inside = rows.filter(({ container }) => container === row.uid);
    if (inside.length === 0) continue;
    steps[containedWeightPath(row.uid)] = (read) => {
      const parts = inside.flatMap(({ uid }) => {
        const held = rows.some(({ container }) => container === uid);
        return [rowWeightPath(uid), ...(held ? [containedWeightPath(uid)] : [])];
      });
      return pathSum(parts, read);
    };
  }
  steps[CARRIED_PATH] = (read) =>
    pathSum(
      rows.map(({ uid }) => rowWeightPath(uid)),
      read,
    );
  return steps;
}

/** The sum of `paths`, each a step of its own; a path that weighs nothing has none. */
function pathSum(paths: readonly string[], read: (path: string) => number) {
  const steps: BreakdownStep[] = [];
  let value = 0;
  for (const path of paths) {
    const part = read(path);
    if (part === 0) continue;
    value += part;
    steps.push({ kind: 'path', path, value: part, change: part });
  }
  return { value, steps };
}
