import type { Computed, HadEntity } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';

// SHEET-48: the Features tab's groups (ADR 009 item 2, board `V3-Features`): features are grouped
// under what gave them: the species, each class with its subclass named below, the background, and
// the feats the character has of its own. What a feature or feat gives in turn (a feat a feature
// gives, a feature a feat gives) stays with the group of the one that gave it. The root of an
// entity is found by following where gathering says it came from (`HadEntity.from`) up to the
// first one the character itself names; an entity that cannot be followed up, or whose root is an
// item or a spell, belongs to no group.

/** What a group of features is. */
export type FeatureGroupKind = 'species' | 'class' | 'background' | 'feats';

/** A switch of a feature: a toggled effect (SPEC §5.4), by the part id the trackers keep it under. */
export interface FeatureToggle {
  part: string;
  label: L10n;
  /** What the switch shows while nothing is stored for it. */
  default: boolean;
}

/** A feature or feat of a group, with the resources it gives and the switches it has. */
export interface FeatureRow {
  id: string;
  /** The resource keys the entity's own grants give: its uses. */
  resources: string[];
  toggles: FeatureToggle[];
}

/** A subclass line: the one chosen, or the level it is chosen at. */
export type SubclassLine = { chosen: string } | { chosenAt: number };

/** A group of the tab. */
export interface FeatureGroup {
  kind: FeatureGroupKind;
  /** The species, class or background the group is named for, when the character has one. */
  source?: string;
  /** A class's level. */
  level?: number;
  /** A class's subclass line. */
  subclass?: SubclassLine;
  rows: FeatureRow[];
}

/** The most steps up the chain of origins followed: far above any real depth. */
const MAX_DEPTH = 16;

/** The part id's entity: a part is `<entity id>#<grant or effect id>`. */
function entityOfPart(part: string): string {
  const at = part.lastIndexOf('#');
  return at < 0 ? part : part.slice(0, at);
}

/** The entity every `from` of `had` leads up to: the first with an origin of the character. */
function rootOf(
  had: HadEntity<FifthEditionEntity>,
  byId: ReadonlyMap<string, HadEntity<FifthEditionEntity>>,
): HadEntity<FifthEditionEntity> | undefined {
  const seen = new Set<string>();
  let at: HadEntity<FifthEditionEntity> | undefined = had;
  for (let step = 0; at !== undefined && step < MAX_DEPTH; step += 1) {
    if (at.from.includes('character')) return at;
    if (seen.has(at.entity.id)) return undefined;
    seen.add(at.entity.id);
    const origin: string | undefined = at.from[0];
    at = origin === undefined ? undefined : byId.get(entityOfPart(origin));
  }
  return undefined;
}

/**
 * The groups of the Features tab, in the order the board draws them: the species, each class in
 * the order taken, the background, the feats. A group with no feature is left out, but a class
 * the character has is always there, so its subclass line shows.
 */
export function fifthEditionFeatures(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
): FeatureGroup[] {
  const byId = new Map(computed.entities.map((had) => [had.entity.id as string, had]));
  const { species: own, background: origin } = character.systemData;
  const species: FeatureGroup = {
    kind: 'species',
    ...(own !== undefined && { source: own.id }),
    rows: [],
  };
  const background: FeatureGroup = {
    kind: 'background',
    ...(origin !== undefined && { source: origin.id }),
    rows: [],
  };
  const feats: FeatureGroup = { kind: 'feats', rows: [] };
  const classes = character.systemData.classes.flatMap(
    ({ id, level, subclass }): FeatureGroup[] => {
      const had = byId.get(id);
      if (had?.entity.type !== 'class') return [];
      const chosenAt = had.entity.subclassLevel;
      const line: SubclassLine =
        subclass !== undefined && byId.get(subclass)?.entity.type === 'subclass'
          ? { chosen: subclass }
          : { chosenAt };
      return [{ kind: 'class', source: id, level, subclass: line, rows: [] }];
    },
  );

  const classOfKey = (key: string) =>
    classes.find((group) => {
      const had = group.source === undefined ? undefined : byId.get(group.source);
      return had?.entity.type === 'class' && had.entity.key === key;
    });

  for (const had of computed.entities) {
    const { entity } = had;
    if (entity.type !== 'feature' && entity.type !== 'feat') continue;
    const root = rootOf(had, byId);
    if (root === undefined) continue;
    const rootEntity = root.entity;
    let group: FeatureGroup | undefined;
    switch (rootEntity.type) {
      case 'species':
      case 'lineage':
        group = species;
        break;
      case 'background':
        group = background;
        break;
      case 'class':
        group = classes.find((each) => each.source === rootEntity.id);
        break;
      case 'subclass':
        group = classOfKey(rootEntity.classKey);
        break;
      case 'feature':
      case 'feat':
        group = feats;
        break;
      default:
        group = undefined;
    }
    group?.rows.push({
      id: entity.id,
      resources: [
        ...new Set(
          computed.resources
            .filter(({ from }) => entityOfPart(from) === entity.id)
            .map(({ key }) => key),
        ),
      ],
      toggles: (entity.effects ?? []).flatMap((effect) =>
        effect.toggle === undefined
          ? []
          : [
              {
                part: `${entity.id}#${effect.id}`,
                label: effect.toggle.label,
                default: effect.toggle.default,
              },
            ],
      ),
    });
  }
  return [species, ...classes, background, feats].filter(
    (group) => group.kind === 'class' || group.rows.length > 0,
  );
}
