import type { Effect, EffectPhase, EntityId, EntityPartId, L10n } from '@grimoire/schema';
import type { GatherableEntity, HadEntity } from './gather';

// SPEC §6.1 step 3: the effects of every entity a character has, each with where it came from.
// A toggle is the person's switch: what the trackers store, else the toggle's default. A
// situational effect is never applied to a number; the roll that it names shows it.

/** The first step of a stat's paths: `abilities.<key>.score`, `abilities.<key>.max`. */
export const STATS_PATH = 'abilities';

/** The paths of a stat the base phase computes (SPEC §5.4 catalogue). */
export const STAT_FIELDS = ['score', 'max'] as const;
export type StatField = (typeof STAT_FIELDS)[number];

/** An effect that applies: the effect, its entity, and its place as a toggle names it. */
export interface ActiveEffect {
  effect: Effect;
  part: EntityPartId;
  source: EntityId;
  /** What the breakdown calls it: the effect's own label, else its entity's name. */
  label: L10n;
}

/** The stat and the field an effect's target names, when it names a stat's score or maximum. */
export function statTargetOf(target: string): { key: string; field: StatField } | undefined {
  const [first, key, field, ...rest] = target.split('.');
  if (first !== STATS_PATH || key === undefined || rest.length > 0) return undefined;
  const found = STAT_FIELDS.find((each) => each === field);
  return found === undefined ? undefined : { key, field: found };
}

/** The phase an effect applies in: its own, else `base` for a stat's score or maximum. */
export function phaseOf(effect: Effect): EffectPhase {
  return effect.phase ?? (statTargetOf(effect.target) === undefined ? 'derived' : 'base');
}

/** Every effect of the entities a character has that is switched on, in the entities' order. */
export function activeEffects<E extends GatherableEntity>(
  entities: readonly HadEntity<E>[],
  toggles: Readonly<Partial<Record<string, boolean>>>,
): ActiveEffect[] {
  const active: ActiveEffect[] = [];
  for (const { entity } of entities) {
    for (const effect of entity.effects ?? []) {
      const part: EntityPartId = `${entity.id}#${effect.id}`;
      if (effect.situational !== undefined) continue;
      if (effect.toggle !== undefined && !(toggles[part] ?? effect.toggle.default)) continue;
      active.push({ effect, part, source: entity.id, label: effect.label ?? entity.name });
    }
  }
  return active;
}
