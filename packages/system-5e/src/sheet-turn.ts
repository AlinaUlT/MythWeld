import type { Computed } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { type FeatureGroup, fifthEditionFeatures } from './sheet-features';

// SHEET-49: what the Turn tab lists (ADR 010 item 8, board `V3-Turn`): the character's features
// grouped by when they are used, from each feature's `activation` (SPEC §5.2): nothing is typed
// twice. A feature that says no timing but has uses of its own is listed under limited uses. A
// feature or feat that says neither is not listed: the tab shows what the data says, and fills out
// as the packs say more. The order is the board's: the actions of a turn first, then what may be
// done once on a turn, then what is always on, then the rest.
// SHEET-76: a feat says its `activation` as a feature does, `oncePerTurn` is a timing of its own, and
// an always-on row names the numbers its effects add (Initiative +2, AC +1), each read from the
// breakdown of the path the effect names, the effect's own `change`, never recomputed here.

/** When a thing is used: a feature's `activation`, or `limited` for uses with no timing. */
export type TurnTiming =
  | 'action'
  | 'bonus'
  | 'reaction'
  | 'free'
  | 'oncePerTurn'
  | 'passive'
  | 'special'
  | 'limited';

/** The groups in the order the tab draws them. */
export const TURN_TIMINGS: readonly TurnTiming[] = [
  'action',
  'bonus',
  'reaction',
  'free',
  'oncePerTurn',
  'passive',
  'special',
  'limited',
];

/**
 * A number an effect of the feature adds: the path it names, which the breakdown opens, and the
 * effect's own change. `of` is the path whose name the line reads: a `.bonus` path is read as
 * its `.total` ("Initiative", "AC") when the character has one.
 */
export interface TurnNumber {
  path: string;
  of: string;
  change: number;
}

/** A feature of a group: what gave it, and the keys of its own uses. */
export interface TurnRow {
  id: string;
  /** What an always-on feature adds, one for each number its effects give now; empty otherwise. */
  numbers: TurnNumber[];
  /** The kind and entity of the group the feature is in: its class, species or background. */
  source: Pick<FeatureGroup, 'kind' | 'source'>;
  resources: string[];
}

/** The features used at one timing. */
export interface TurnGroup {
  timing: TurnTiming;
  rows: TurnRow[];
}

/** The numbers the effects of entity `id` add now, from each path's breakdown, in path order. */
function numbersOf(computed: Computed<FifthEditionEntity>, id: string): TurnNumber[] {
  const numbers: TurnNumber[] = [];
  for (const [path, steps] of Object.entries(computed.breakdown).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    for (const step of steps) {
      if (step.kind !== 'effect' || step.source !== id || step.op !== 'add') continue;
      if (typeof step.change !== 'number' || step.change === 0) continue;
      const total = path.endsWith('.bonus') ? `${path.slice(0, -'.bonus'.length)}.total` : path;
      numbers.push({
        path,
        of: Object.hasOwn(computed.values, total) ? total : path,
        change: step.change,
      });
    }
  }
  return numbers;
}

/**
 * The Turn tab's groups, in `TURN_TIMINGS` order, none empty: each feature of the Features tab's
 * groups (SHEET-48) under its `activation`, or under limited uses when it has none and has uses.
 */
export function fifthEditionTurn(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
): TurnGroup[] {
  const activation = new Map(
    computed.entities.flatMap(({ entity }) =>
      (entity.type === 'feature' || entity.type === 'feat') && entity.activation !== undefined
        ? [[entity.id as string, entity.activation] as const]
        : [],
    ),
  );
  const groups = new Map<TurnTiming, TurnRow[]>();
  for (const group of fifthEditionFeatures(character, computed)) {
    for (const { id, resources } of group.rows) {
      const timing: TurnTiming | undefined =
        activation.get(id) ?? (resources.length > 0 ? 'limited' : undefined);
      if (timing === undefined) continue;
      const row: TurnRow = {
        id,
        source: { kind: group.kind, ...(group.source !== undefined && { source: group.source }) },
        resources,
        numbers: timing === 'passive' ? numbersOf(computed, id) : [],
      };
      groups.set(timing, [...(groups.get(timing) ?? []), row]);
    }
  }
  return TURN_TIMINGS.flatMap((timing) => {
    const rows = groups.get(timing);
    return rows === undefined ? [] : [{ timing, rows }];
  });
}
