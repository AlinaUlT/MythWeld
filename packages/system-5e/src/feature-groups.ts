import {
  type Computed,
  type HadEntity,
  type ResourceGiven,
  type ResourceRecovery,
  recoveryOf,
  resourceUses,
} from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import { classesOf } from './classes';
import type { FifthEditionEntity } from './entity-types';

// SHEET-48: the Features tab's groups (ADR 009 item 2, board `V3-Features`): the features and
// feats a character has, each under what gave it. A feature is followed up the places that gave
// it until a species, a class or a background; a lineage is passed through to its species, a
// subclass to the class that has it. What the character gave itself, or what no such place led to,
// stands under the feats. Each row also holds its uses, their recovery and its switches, read from
// the engine's trackers, so the screen draws and decides nothing.

/** What a group is named after. */
export type FeatureGroupKind = 'species' | 'class' | 'background' | 'feats';

/** A row of the tab: a feature or a feat. */
export type FeatureEntity = Extract<FifthEditionEntity, { type: 'feature' | 'feat' }>;

/** One resource a feature gives: its uses and what brings them back (ENG-29, SHEET-20). */
export interface FeatureUses {
  key: string;
  label: L10n;
  max: number;
  spent: number;
  left: number;
  recovery: readonly ResourceRecovery[];
}

/** One switch of a feature's toggled effects (ENG-17): its part, its label and where it stands. */
export interface FeatureSwitch {
  part: string;
  label: L10n;
  on: boolean;
}

/** A feature or feat with the trackers it holds. */
export interface FeatureRow {
  entity: FeatureEntity;
  uses: readonly FeatureUses[];
  switches: readonly FeatureSwitch[];
  /** The feature is passive: it works without being used. */
  alwaysOn: boolean;
}

/** A card of the tab. */
export interface FeatureGroup {
  kind: FeatureGroupKind;
  /** The species, the class or the background; none for the feats. */
  source?: FifthEditionEntity;
  /** A class's level. */
  level?: number;
  /** The line under the name: a class's subclass, a species' lineage. */
  detail?: FifthEditionEntity;
  features: readonly FeatureRow[];
}

type Had = HadEntity<FifthEditionEntity>;
type ComputedOf = Computed<FifthEditionEntity>;

/** The entity id a place (`<entityId>#<grantId>`) belongs to. */
function entityIdOf(origin: string): string {
  const at = origin.indexOf('#');
  return at < 0 ? origin : origin.slice(0, at);
}

/** The most places walked up from one feature: gathering has no cycle, but a pack could. */
const MAX_STEPS = 16;

interface Source {
  kind: Exclude<FeatureGroupKind, 'feats'>;
  entity: FifthEditionEntity;
  detail?: FifthEditionEntity;
}

/** The species, class or background an entity came from, or `undefined` when none led to it. */
function sourceOf(
  start: Had,
  byId: ReadonlyMap<string, Had>,
  subclassOf: ReadonlyMap<string, FifthEditionEntity>,
  classOfSubclass: ReadonlyMap<string, FifthEditionEntity>,
): Source | undefined {
  let current: Had | undefined = start;
  let detail: FifthEditionEntity | undefined;
  for (let step = 0; step < MAX_STEPS && current !== undefined; step += 1) {
    const { entity } = current;
    if (entity.type === 'species' || entity.type === 'background') {
      return { kind: entity.type, entity, ...(detail && { detail }) };
    }
    if (entity.type === 'class') {
      const subclass = subclassOf.get(entity.id);
      return { kind: 'class', entity, ...(subclass && { detail: subclass }) };
    }
    if (entity.type === 'subclass') {
      const owner = classOfSubclass.get(entity.id);
      const had = owner === undefined ? undefined : byId.get(owner.id);
      return had === undefined ? undefined : sourceOf(had, byId, subclassOf, classOfSubclass);
    }
    if (entity.type === 'lineage') detail = entity;
    const origin: string | undefined = current.from.find((place) => place !== 'character');
    current = origin === undefined ? undefined : byId.get(entityIdOf(origin));
  }
  return undefined;
}

function rowOf(
  character: FifthEditionCharacter,
  computed: ComputedOf,
  had: Had,
  entity: FeatureEntity,
): FeatureRow {
  const keys = new Set<string>();
  const uses = computed.resources
    .filter((given: ResourceGiven) => entityIdOf(given.from) === entity.id)
    .flatMap((given: ResourceGiven) => {
      if (keys.has(given.key)) return [];
      keys.add(given.key);
      const counted = resourceUses(character, computed, given.key);
      if (counted === undefined) return [];
      return [
        {
          key: given.key,
          label: given.label,
          ...counted,
          recovery: recoveryOf(computed, given.key),
        },
      ];
    });
  const stored: Readonly<Partial<Record<string, boolean>>> = character.state.toggles;
  const switches = (entity.effects ?? []).flatMap((effect) => {
    if (effect.toggle === undefined) return [];
    const part = `${entity.id}#${effect.id}`;
    return [
      {
        part,
        label: effect.toggle.label,
        on: stored[part] ?? effect.toggle.default,
      },
    ];
  });
  return {
    entity,
    uses,
    switches,
    alwaysOn: entity.type === 'feature' && entity.activation === 'passive' && had.dormant !== true,
  };
}

/**
 * The cards of the Features tab: the species, each class in the order taken, the background, then
 * the feats. A card with no row is left out; a row keeps the order the character gathered it in.
 */
export function fifthEditionFeatureGroups(
  character: FifthEditionCharacter,
  computed: ComputedOf,
): FeatureGroup[] {
  const byId = new Map<string, Had>(computed.entities.map((had) => [had.entity.id, had]));
  const classes = classesOf(character, computed);
  const subclassOf = new Map<string, FifthEditionEntity>();
  const classOfSubclass = new Map<string, FifthEditionEntity>();
  for (const { entity, subclass } of classes) {
    if (subclass === undefined) continue;
    subclassOf.set(entity.id, subclass);
    classOfSubclass.set(subclass.id, entity);
  }

  const groups = new Map<string, FeatureGroup & { features: FeatureRow[] }>();
  const groupOf = (
    kind: FeatureGroupKind,
    source?: Source,
  ): FeatureGroup & { features: FeatureRow[] } => {
    const id = `${kind}:${source?.entity.id ?? ''}`;
    const found = groups.get(id);
    if (found !== undefined) return found;
    const level = classes.find(({ entity }) => entity.id === source?.entity.id)?.level;
    const made: FeatureGroup & { features: FeatureRow[] } = {
      kind,
      features: [],
      ...(source && { source: source.entity }),
      ...(source?.detail && { detail: source.detail }),
      ...(level !== undefined && { level }),
    };
    groups.set(id, made);
    return made;
  };

  for (const had of computed.entities) {
    const { entity } = had;
    if (entity.type !== 'feature' && entity.type !== 'feat') continue;
    const source = sourceOf(had, byId, subclassOf, classOfSubclass);
    groupOf(source?.kind ?? 'feats', source).features.push(rowOf(character, computed, had, entity));
  }

  const order: Record<FeatureGroupKind, number> = { species: 0, class: 1, background: 2, feats: 3 };
  return [...groups.values()].sort((a, b) => order[a.kind] - order[b.kind]);
}
