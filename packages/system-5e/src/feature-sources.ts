import type { Computed, HadEntity } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// SHEET-48: how the Features tab groups a fifth-edition character's features (ADR 009 item 2,
// board `V3-Features`): under the species (its lineage on the line below), each class (its
// subclass on the line below), the background, and the feats the character took by hand. A feature
// belongs to the first thing that gave it, found by following its origins up: a trait of a lineage
// to the species, a feature of a subclass to its class, a feat a background gave to the background.
// What no one of these gave (an item's feature, a condition) is not here.

/** What a group of features is named after. */
export type FeatureSourceKind = 'species' | 'class' | 'background' | 'feats';

/** The line under a group's name: the lineage or subclass the character has, or why it has none. */
export type FeatureSubline =
  | { kind: 'lineage' | 'subclass'; entity: FifthEditionEntity }
  /** The class gives its subclass at a level the character has not reached. */
  | { kind: 'subclassLater' }
  /** The character has reached the level, and no subclass is chosen. */
  | { kind: 'subclassUnchosen' };

/** The features and feats one thing gave. */
export interface FeatureSource {
  kind: FeatureSourceKind;
  /** The species, class or background; none for the feats. */
  entity?: FifthEditionEntity;
  /** A class's level. */
  level?: number;
  subline?: FeatureSubline;
  /** In the order gathering met them. */
  entries: FifthEditionEntity[];
  /** The ids this source's grants name that no pack on the device has (SPEC §8.2). */
  missing: string[];
}

type Had = HadEntity<FifthEditionEntity>;

/** The group id of the feats the character took by hand. */
const FEATS = 'feats';

/** The id of the entity a grant's origin (`<entityId>#<grantId>`) belongs to. */
function giverOf(origin: string): string {
  const at = origin.indexOf('#');
  return at === -1 ? origin : origin.slice(0, at);
}

/**
 * The groups of a character's features, in the order the tab shows them: the species, each class
 * in the order taken, the background, the feats. A group with no features is kept, so the tab
 * names what the character has; the feats group is kept only with a feat in it.
 */
export function fifthEditionFeatureSources(
  character: Pick<FifthEditionCharacter, 'systemData'>,
  computed: Pick<Computed<FifthEditionEntity>, 'entities' | 'warnings'>,
): FeatureSource[] {
  const { classes } = character.systemData;
  const byId = new Map<string, Had>(computed.entities.map((had) => [had.entity.id, had]));

  // The id of the species, class or background whose group `had` is in, or `FEATS`.
  const groupOf = (had: Had, seen: ReadonlySet<string>): string | undefined => {
    const { entity } = had;
    if (entity.type === 'species' || entity.type === 'class' || entity.type === 'background') {
      return entity.id;
    }
    if (entity.type === 'subclass')
      return classes.find(({ subclass }) => subclass === entity.id)?.id;
    if (entity.type !== 'lineage' && entity.type !== 'feature' && entity.type !== 'feat') {
      return undefined;
    }
    const next = new Set(seen).add(entity.id);
    for (const origin of had.from) {
      if (origin === 'character') {
        if (entity.type !== 'lineage') return FEATS;
        continue;
      }
      const giver = byId.get(giverOf(origin));
      if (giver === undefined || next.has(giver.entity.id)) continue;
      const found = groupOf(giver, next);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const groups = new Map<string, FeatureSource>();
  const open = (id: string, source: FeatureSource) => groups.set(id, source);
  const order: string[] = [];
  const named = (type: 'species' | 'background') =>
    computed.entities.filter(({ entity }) => entity.type === type);
  for (const { entity } of named('species')) {
    open(entity.id, { kind: 'species', entity, entries: [], missing: [] });
    order.push(entity.id);
  }
  for (const { id, subclass } of classes) {
    const had = byId.get(id);
    if (had === undefined) continue;
    const { entity, level } = had;
    const sub = subclass === undefined ? undefined : byId.get(subclass)?.entity;
    let subline: FeatureSubline | undefined;
    if (sub !== undefined) subline = { kind: 'subclass', entity: sub };
    else if (entity.type === 'class') {
      subline = { kind: level < entity.subclassLevel ? 'subclassLater' : 'subclassUnchosen' };
    }
    open(id, {
      kind: 'class',
      entity,
      level,
      ...(subline !== undefined && { subline }),
      entries: [],
      missing: [],
    });
    order.push(id);
  }
  for (const { entity } of named('background')) {
    open(entity.id, { kind: 'background', entity, entries: [], missing: [] });
    order.push(entity.id);
  }
  open(FEATS, { kind: 'feats', entries: [], missing: [] });
  order.push(FEATS);

  for (const had of computed.entities) {
    const { entity } = had;
    if (entity.type === 'lineage') {
      const group = groups.get(groupOf(had, new Set()) ?? '');
      if (group?.kind === 'species') group.subline = { kind: 'lineage', entity };
    } else if (entity.type === 'feature' || entity.type === 'feat') {
      groups.get(groupOf(had, new Set()) ?? '')?.entries.push(entity);
    }
  }
  for (const warning of computed.warnings) {
    if (warning.code !== 'missing' || warning.from === 'character') continue;
    const giver = byId.get(giverOf(warning.from));
    const group = giver === undefined ? undefined : groups.get(groupOf(giver, new Set()) ?? '');
    group?.missing.push(warning.id);
  }

  return order.flatMap((id) => {
    const source = groups.get(id);
    const empty = source?.kind === 'feats' && source.entries.length === 0;
    return source === undefined || empty ? [] : [source];
  });
}
