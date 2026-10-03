import type { StoredObject } from '@grimoire/schema';

// What the module's steps between stored shapes share (ENG-39: a pack's and a character's lists).
// A step reads a file of an older version, which no schema has checked yet: each part is read only
// when it has the shape it should, and anything else is left for the schema to refuse.
// ENG-57: version 5 needs `key` on a `spell` grant with `uses`; `keyedSpellUses` makes the key a
// version 4 file lacks, in a pack's `entities` and in a character's `localEntities`.

/** `value` when it is an object of fields: not a list, not a plain value. */
export function fieldsOf(value: unknown): StoredObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as StoredObject)
    : undefined;
}

/** What a key the 4 → 5 step makes starts with: a camelCase key, and never a reserved name. */
const USES_KEY_PREFIX = 'uses';

/** A grant id (`3rd-level`) in PascalCase (`3rdLevel`). */
function pascalOf(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** The grant lists of an entity: its `grants`, and a class's `multiclass.grants`. */
function grantListsOf(entity: StoredObject): unknown[][] {
  const lists = [entity.grants, fieldsOf(entity.multiclass)?.grants];
  return lists.filter((list): list is unknown[] => Array.isArray(list));
}

/** A `spell` grant with `uses` and no `key`. */
function lacksKey(grant: StoredObject): boolean {
  return grant.kind === 'spell' && grant.uses !== undefined && grant.key === undefined;
}

/**
 * `entities` with a key on each `spell` grant that has `uses` and none: `uses` and its grant id in
 * PascalCase (`spark` → `usesSpark`), followed by 2, 3 … when the file already has that key on a
 * grant. Entities and grants are taken in their order, each entity's `grants` before its
 * `multiclass.grants`. A value that is not a list is returned as it is; so is every part that is
 * not an object. Pure.
 */
export function keyedSpellUses(entities: unknown): unknown {
  if (!Array.isArray(entities)) return entities;
  const taken = new Set<string>();
  for (const entity of entities) {
    const fields = fieldsOf(entity);
    if (fields === undefined) continue;
    for (const grant of grantListsOf(fields).flat()) {
      const key = fieldsOf(grant)?.key;
      if (typeof key === 'string') taken.add(key);
    }
  }
  const keyed = (grant: unknown): unknown => {
    const fields = fieldsOf(grant);
    if (fields === undefined || !lacksKey(fields) || typeof fields.id !== 'string') return grant;
    const base = `${USES_KEY_PREFIX}${pascalOf(fields.id)}`;
    let key = base;
    for (let count = 2; taken.has(key); count++) key = `${base}${count}`;
    taken.add(key);
    return { ...fields, key };
  };
  const keyedList = (list: unknown) => (Array.isArray(list) ? list.map(keyed) : list);
  return entities.map((entity) => {
    const fields = fieldsOf(entity);
    if (fields === undefined) return entity;
    const multiclass = fieldsOf(fields.multiclass);
    return {
      ...fields,
      ...(fields.grants !== undefined && { grants: keyedList(fields.grants) }),
      ...(multiclass !== undefined && {
        multiclass: {
          ...multiclass,
          ...(multiclass.grants !== undefined && { grants: keyedList(multiclass.grants) }),
        },
      }),
    };
  });
}
