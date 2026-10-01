import { z } from 'zod';
import { listWithUnique, listWithUniqueIds } from './entity-base';
import { uniqueList } from './grant';
import {
  computedPathSchema,
  entityIdSchema,
  entityKeySchema,
  entityPartIdSchema,
  packIdSchema,
  parseEntityId,
  uuidSchema,
} from './ids';
import { type Migration, openerOf } from './migration';
import { checkSystemIdAndVersion } from './system';
import { visibleTextSchema } from './text';

// ENG-06: the core part of a character (ADR 004's row for SPEC §5.8), and one field, `systemData`,
// for the part the system's module owns (ENG-33 for fifth edition). The two parts change shape on
// their own, so each has its version: `schemaVersion` is the core's, `systemSchemaVersion` the
// module's. A character's own entities carry the pack id `character`, which no active pack may
// have, so they never collide with a pack's entries.

/** The stored shape of the character's core part. A change to it needs a migration (SPEC §5.8). */
export const CHARACTER_SCHEMA_VERSION = 1;

/** The steps to `CHARACTER_SCHEMA_VERSION`: step N takes version N + 1 to N + 2. None yet. */
export const CHARACTER_MIGRATIONS: readonly Migration[] = [];

/** The pack id in the ids of a character's own entities: `character:talent/lucky-charm`. */
export const CHARACTER_PACK_ID = 'character';

/** The actor kind a new character gets: a player's character (ADR 014 item 8). */
export const DEFAULT_ACTOR_KIND = 'pc';

/** What a person picked for one grant: keys or entity ids, at least one, none twice. */
const choiceSchema = uniqueList(z.union([entityKeySchema, entityIdSchema]));

/** A number changed by hand on the sheet. It wins over every rule (SPEC §6.1 step 7). */
const overrideSchema = z.strictObject({
  path: computedPathSchema,
  value: z.union([z.number(), z.boolean(), visibleTextSchema]),
  note: visibleTextSchema.optional(),
});

/** The trackers every system has: resources used, conditions, effects switched on or off. */
const trackersSchema = z.strictObject({
  resources: z.record(entityKeySchema, z.int().nonnegative()),
  conditions: listWithUniqueIds(
    z.strictObject({ id: entityIdSchema, level: z.int().positive().optional() }),
  ),
  toggles: z.record(entityPartIdSchema, z.boolean()),
});

/** Active packs in order, none twice; never `character`, which a character's own entities use. */
const activePacksSchema = z.array(packIdSchema).superRefine((packs, ctx) => {
  for (const [index, pack] of packs.entries()) {
    if (pack === CHARACTER_PACK_ID) {
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: `"${CHARACTER_PACK_ID}" is the id of a character's own entities, not a pack.`,
      });
    } else if (packs.indexOf(pack) !== index) {
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: `The pack "${pack}" is listed twice.`,
      });
    }
  }
});

/**
 * A system's character: the core part, with the system's id, the version of its module's part, its
 * editions (`editionSchema` of `systemListsOf`: never `any`), its entity union and its module's
 * part. Throws when one of these cannot be right.
 */
export function characterSchemaOf<
  const S extends string,
  const V extends number,
  R extends z.ZodType<string>,
  E extends z.ZodType<{ id: string }>,
  D extends z.ZodType,
>(parts: { system: S; systemSchemaVersion: V; edition: R; entity: E; systemData: D }) {
  checkSystemIdAndVersion(parts);
  if (parts.edition.safeParse('any').success) {
    throw new Error("A character's ruleset is one edition: its schema must refuse `any`.");
  }
  return z.strictObject({
    id: uuidSchema,
    schemaVersion: z.literal(CHARACTER_SCHEMA_VERSION),
    rev: z.int().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    system: z.literal(parts.system),
    systemSchemaVersion: z.literal(parts.systemSchemaVersion),
    ruleset: parts.edition,
    allowMixedRulesets: z.boolean(),
    kind: entityKeySchema,
    mode: z.enum(['guided', 'manual']),
    name: visibleTextSchema,
    player: visibleTextSchema.optional(),
    portraitBlobId: uuidSchema.optional(),
    packs: activePacksSchema,
    abilities: z.strictObject({ base: z.record(entityKeySchema, z.int()) }),
    choices: z.record(entityPartIdSchema, choiceSchema),
    state: trackersSchema,
    overrides: listWithUnique(overrideSchema, 'path'),
    localEntities: listWithUniqueIds(parts.entity).superRefine((entities, ctx) => {
      for (const [index, entity] of entities.entries()) {
        const pack = parseEntityId(entity.id)?.pack;
        if (pack !== CHARACTER_PACK_ID) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'id'],
            message: `A character's own entity has the pack id "${CHARACTER_PACK_ID}", not "${pack}".`,
          });
        }
      }
    }),
    notes: z.record(entityKeySchema, visibleTextSchema),
    systemData: parts.systemData,
  });
}

/**
 * The migration frame for a system's characters: the core's steps on `schemaVersion`, then the
 * module's `systemMigrations` on `systemSchemaVersion`.
 */
export function characterOpenerOf<S extends z.ZodType>(
  characterSchema: S,
  systemMigrations: readonly Migration[],
) {
  return openerOf(characterSchema, [
    { field: 'schemaVersion', migrations: CHARACTER_MIGRATIONS },
    { field: 'systemSchemaVersion', migrations: systemMigrations },
  ]);
}
