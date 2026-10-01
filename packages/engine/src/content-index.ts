import { CHARACTER_PACK_ID, type EntityId, type L10n, type Locale } from '@grimoire/schema';
import { compareVersions } from './version';

// ENG-25: packs are checked as they load (ADR 003 item A3), and only the packs that pass enter the
// index. A pack is refused whole when loading it could do harm: it would replace another pack's
// entry (its id given before, or an entity with another pack's id), take the id of a character's
// own entities, bring another system (ADR 004 item 3), or need itself through a loop. What is only
// missing loads and warns (SPEC §8.2): a dependency not loaded or older than asked, a key repeated
// in one ruleset (ADR 014 item 2). An id the index lacks gives `missing`, shown as `Missing: <id>`.

/** The ruleset of an entry that holds in every edition of its system (`systemListsOf`). */
const ANY_RULESET = 'any';

/** What the index reads of an entity: the fields every system's entity has (ENG-02). */
export interface IndexedEntity {
  readonly id: EntityId;
  readonly type: string;
  readonly key?: string;
  readonly ruleset: string;
  readonly name: L10n;
  readonly aliases?: readonly L10n[];
}

/** What the loader reads of a pack the system's pack schema has parsed (ENG-05). */
export interface PackToLoad<E extends IndexedEntity> {
  readonly id: string;
  readonly version: string;
  readonly system: string;
  readonly dependsOn?: readonly { readonly id: string; readonly version?: string }[];
  readonly entities: readonly E[];
}

/**
 * An entry, or `missing`. The screen shows `missing` as `Missing: <id>` from its own text; the
 * `message` is English, for logs.
 */
export type Lookup<E> =
  | { ok: true; entity: E }
  | { ok: false; code: 'missing'; id: string; message: string };

/** Why a pack did not load. `code` and its data are for the screen; `message` is for logs. */
export type PackRefusal = { pack: string; message: string } & (
  | { code: 'repeatedPack' }
  | { code: 'reservedId' }
  | { code: 'otherSystem'; system: string }
  | { code: 'foreignEntity'; entity: EntityId }
  | { code: 'dependencyLoop'; loop: readonly string[] }
);

/** Something a loaded pack lacks or repeats. `code` and its data are for the screen. */
export type LoadWarning = { pack: string; message: string } & (
  | { code: 'missingDependency'; dependency: string }
  | { code: 'olderDependency'; dependency: string; needed: string; found: string }
  | { code: 'repeatedKey'; type: string; key: string; entity: EntityId; kept: EntityId }
);

/** The entries of the loaded packs, found by id, by type and key, or by name. */
export interface ContentIndex<E extends IndexedEntity> {
  /** Every entry: by pack in load order, then in its pack's order. */
  readonly entities: readonly E[];
  /** The entry with this id, or `missing`. Never throws. */
  get(id: string): Lookup<E>;
  /** Every entry of this type with this key, in load order. */
  withKey(type: string, key: string): readonly E[];
  /** The same entry in the system's other editions: same type, same key (ADR 014 item 3). */
  copiesOf(id: string): readonly E[];
  /** Each name and alias in one language, lowercased in it, to the ids that have it. */
  names(locale: Locale): ReadonlyMap<string, readonly EntityId[]>;
}

/** What loading gives: the index, the packs loaded in order, and what was refused or lacking. */
export interface LoadedContent<E extends IndexedEntity> {
  index: ContentIndex<E>;
  loaded: readonly string[];
  refused: readonly PackRefusal[];
  warnings: readonly LoadWarning[];
}

/** Two entries' rulesets meet: one edition, or one of them holds in every edition. */
function shareRuleset(a: string, b: string): boolean {
  return a === b || a === ANY_RULESET || b === ANY_RULESET;
}

/** The pack id an entity id starts with. */
function packOf(id: string): string {
  return id.slice(0, id.indexOf(':'));
}

/** Why a pack cannot load whatever else loads, or `undefined`. */
function refusalOf<E extends IndexedEntity>(
  pack: PackToLoad<E>,
  system: string,
  given: ReadonlySet<string>,
): PackRefusal | undefined {
  const id = pack.id;
  if (given.has(id)) {
    return {
      pack: id,
      code: 'repeatedPack',
      message: `The pack "${id}" is given twice; only the first can load.`,
    };
  }
  if (id === CHARACTER_PACK_ID) {
    return {
      pack: id,
      code: 'reservedId',
      message: `The pack id "${id}" is the id of a character's own entities.`,
    };
  }
  if (pack.system !== system) {
    return {
      pack: id,
      code: 'otherSystem',
      system: pack.system,
      message: `The pack "${id}" is of the system "${pack.system}", not "${system}".`,
    };
  }
  const foreign = pack.entities.find((entity) => packOf(entity.id) !== id);
  if (foreign !== undefined) {
    return {
      pack: id,
      code: 'foreignEntity',
      entity: foreign.id,
      message: `The pack "${id}" holds "${foreign.id}", an id of another pack.`,
    };
  }
  return undefined;
}

/** The shortest loop of dependencies from `start` back to it, or `undefined` when there is none. */
function loopThrough(start: string, needs: ReadonlyMap<string, readonly string[]>) {
  const cameFrom = new Map<string, string>();
  const queue = [start];
  for (const at of queue) {
    for (const next of needs.get(at) ?? []) {
      if (next === start) {
        const path: string[] = [];
        for (let step = at; step !== start; step = cameFrom.get(step) as string) path.push(step);
        return [start, ...path.reverse(), start];
      }
      if (!cameFrom.has(next)) {
        cameFrom.set(next, at);
        queue.push(next);
      }
    }
  }
  return undefined;
}

/**
 * Loads a character's packs, in order, into the content index. `system` is the character's
 * system id; each pack has been parsed by that system's pack schema. Pure: the packs are read,
 * never changed.
 */
export function loadContentIndex<E extends IndexedEntity>(
  system: string,
  packs: readonly PackToLoad<E>[],
): LoadedContent<E> {
  const refused: PackRefusal[] = [];
  const given = new Set<string>();
  const passed: PackToLoad<E>[] = [];
  for (const pack of packs) {
    const refusal = refusalOf(pack, system, given);
    given.add(pack.id);
    if (refusal === undefined) passed.push(pack);
    else refused.push(refusal);
  }

  const passedIds = new Set(passed.map((pack) => pack.id));
  const needs = new Map(
    passed.map((pack) => [
      pack.id,
      (pack.dependsOn ?? []).map((dependency) => dependency.id).filter((id) => passedIds.has(id)),
    ]),
  );
  const loading: PackToLoad<E>[] = [];
  for (const pack of passed) {
    const loop = loopThrough(pack.id, needs);
    if (loop === undefined) {
      loading.push(pack);
    } else {
      refused.push({
        pack: pack.id,
        code: 'dependencyLoop',
        loop,
        message: `The pack "${pack.id}" is on a loop of dependencies: ${loop.join(' → ')}.`,
      });
    }
  }

  const warnings: LoadWarning[] = [];
  const versions = new Map(loading.map((pack) => [pack.id, pack.version]));
  for (const pack of loading) {
    for (const { id, version } of pack.dependsOn ?? []) {
      const found = versions.get(id);
      if (found === undefined) {
        warnings.push({
          pack: pack.id,
          code: 'missingDependency',
          dependency: id,
          message: `The pack "${pack.id}" needs "${id}", which is not loaded.`,
        });
      } else if (version !== undefined && compareVersions(found, version) < 0) {
        warnings.push({
          pack: pack.id,
          code: 'olderDependency',
          dependency: id,
          needed: version,
          found,
          message: `The pack "${pack.id}" needs "${id}" ${version} or later; ${found} is loaded.`,
        });
      }
    }
  }

  const byId = new Map<string, E>();
  const byKey = new Map<string, Map<string, E[]>>();
  const byName = new Map<Locale, Map<string, EntityId[]>>();
  for (const pack of loading) {
    for (const entity of pack.entities) {
      byId.set(entity.id, entity);

      if (entity.key !== undefined) {
        const ofType = byKey.get(entity.type) ?? new Map<string, E[]>();
        byKey.set(entity.type, ofType);
        const same = ofType.get(entity.key) ?? [];
        ofType.set(entity.key, same);
        const kept = same.find((other) => shareRuleset(other.ruleset, entity.ruleset));
        if (kept !== undefined) {
          warnings.push({
            pack: pack.id,
            code: 'repeatedKey',
            type: entity.type,
            key: entity.key,
            entity: entity.id,
            kept: kept.id,
            message: `"${entity.id}" repeats the ${entity.type} key "${entity.key}" of "${kept.id}" in one ruleset; "${kept.id}" is kept.`,
          });
        }
        same.push(entity);
      }

      for (const text of [entity.name, ...(entity.aliases ?? [])]) {
        for (const [locale, value] of Object.entries(text) as [Locale, string | undefined][]) {
          if (value === undefined) continue;
          const words = byName.get(locale) ?? new Map<string, EntityId[]>();
          byName.set(locale, words);
          const word = value.toLocaleLowerCase(locale);
          const ids = words.get(word) ?? [];
          words.set(word, ids);
          if (!ids.includes(entity.id)) ids.push(entity.id);
        }
      }
    }
  }

  const none: readonly E[] = [];
  const withKey = (type: string, key: string): readonly E[] => byKey.get(type)?.get(key) ?? none;
  const index: ContentIndex<E> = {
    entities: loading.flatMap((pack) => pack.entities),
    get(id) {
      const entity = byId.get(id);
      if (entity !== undefined) return { ok: true, entity };
      return { ok: false, code: 'missing', id, message: `Missing: ${id}` };
    },
    withKey,
    copiesOf(id) {
      const entity = byId.get(id);
      if (entity?.key === undefined) return none;
      return withKey(entity.type, entity.key).filter(
        (other) => !shareRuleset(other.ruleset, entity.ruleset),
      );
    },
    names(locale) {
      return byName.get(locale) ?? new Map();
    },
  };

  return { index, loaded: loading.map((pack) => pack.id), refused, warnings };
}
