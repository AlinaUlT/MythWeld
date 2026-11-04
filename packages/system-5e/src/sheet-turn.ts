import type { Computed } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { type FeatureGroup, fifthEditionFeatures } from './sheet-features';

// SHEET-49: what the Turn tab lists (ADR 010 item 8, board `V3-Turn`): the character's features
// grouped by when they are used, from each feature's `activation` (SPEC §5.2): nothing is typed
// twice. A feature that says no timing but has uses of its own is listed under limited uses. A
// feature or feat that says neither is not listed: the tab shows what the data says, and fills out
// as the packs say more. The order is the board's: the actions of a turn first, then what is always
// on, then the rest.

/** When a thing is used: a feature's `activation`, or `limited` for uses with no timing. */
export type TurnTiming =
  | 'action'
  | 'bonus'
  | 'reaction'
  | 'free'
  | 'passive'
  | 'special'
  | 'limited';

/** The groups in the order the tab draws them. */
export const TURN_TIMINGS: readonly TurnTiming[] = [
  'action',
  'bonus',
  'reaction',
  'free',
  'passive',
  'special',
  'limited',
];

/** A feature of a group: what gave it, and the keys of its own uses. */
export interface TurnRow {
  id: string;
  /** The kind and entity of the group the feature is in: its class, species or background. */
  source: Pick<FeatureGroup, 'kind' | 'source'>;
  resources: string[];
}

/** The features used at one timing. */
export interface TurnGroup {
  timing: TurnTiming;
  rows: TurnRow[];
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
      entity.type === 'feature' && entity.activation !== undefined
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
      };
      groups.set(timing, [...(groups.get(timing) ?? []), row]);
    }
  }
  return TURN_TIMINGS.flatMap((timing) => {
    const rows = groups.get(timing);
    return rows === undefined ? [] : [{ timing, rows }];
  });
}
