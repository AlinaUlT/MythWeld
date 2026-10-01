import { z } from 'zod';
import { linkSchema, listWithUniqueIds } from './entity-base';
import { uniqueList } from './grant';
import {
  entityIdPatternOf,
  entityIdSchema,
  entityKeySchema,
  packIdSchema,
  parseEntityId,
  versionSchema,
} from './ids';
import { type Migration, openerOf } from './migration';
import { checkSystemIdAndVersion } from './system';
import { l10nSchema, localeSchema, visibleTextSchema } from './text';

// ENG-05: a pack is parsed against one system's entity union (ADR 004 item 3), so the pack schema
// is built per system. `schemaVersion` is today's shape only; another version goes through the
// migration frame first (`packOpenerOf`, ENG-06). No field says where a pack came from: the app
// sets that when it installs the pack (ADR 003 item A7), so such a field is refused like any
// unknown one.
// ENG-39: a pack's entities are the module's types, so a pack carries the module's
// `systemSchemaVersion` too: the same number a character carries (ENG-06), one per module. Each
// opener gets the module's own steps for its kind of file.

/** The stored shape of a pack. A change to it needs a migration (SPEC §5.8). */
export const PACK_SCHEMA_VERSION = 1;

/** The steps to `PACK_SCHEMA_VERSION`: step N takes version N + 1 to N + 2. None yet. */
export const PACK_MIGRATIONS: readonly Migration[] = [];

/** The stored shape of a locale overlay. A change to it needs a migration (SPEC §5.8). */
export const LOCALE_OVERLAY_SCHEMA_VERSION = 1;

/** The steps to `LOCALE_OVERLAY_SCHEMA_VERSION`. None yet. */
export const LOCALE_OVERLAY_MIGRATIONS: readonly Migration[] = [];

/** A pack's license (SPEC §5.7). `redistributable: false` keeps it out of every public build. */
export const packLicenseSchema = z.strictObject({
  spdx: visibleTextSchema.optional(),
  name: visibleTextSchema,
  url: linkSchema.optional(),
  attribution: visibleTextSchema.optional(),
  redistributable: z.boolean(),
});
export type PackLicense = z.infer<typeof packLicenseSchema>;

/** A pack this pack needs, and the lowest version of it that will do. */
const dependencySchema = z.strictObject({
  id: packIdSchema,
  version: versionSchema.optional(),
});

/**
 * A system's content pack (SPEC §5.7, widened by ADR 003 item A2 and ADR 004 item 3): its
 * `system` id, the version of its module's shape, its `rulesetSchema` and its entity union
 * (`systemEntitySchemaOf`). Throws when the id or the version cannot be right.
 */
export function packSchemaOf<
  const S extends string,
  const V extends number,
  R extends z.ZodType<string>,
  E extends z.ZodType<{ id: string }>,
>(parts: { system: S; systemSchemaVersion: V; ruleset: R; entity: E }) {
  checkSystemIdAndVersion(parts);
  return z.strictObject({
    id: packIdSchema,
    version: versionSchema,
    schemaVersion: z.literal(PACK_SCHEMA_VERSION),
    system: z.literal(parts.system),
    systemSchemaVersion: z.literal(parts.systemSchemaVersion),
    title: l10nSchema,
    description: l10nSchema.optional(),
    ruleset: parts.ruleset,
    license: packLicenseSchema,
    authors: uniqueList(visibleTextSchema).optional(),
    homepage: linkSchema.optional(),
    repository: linkSchema.optional(),
    copyrightNotice: visibleTextSchema.optional(),
    dependsOn: listWithUniqueIds(dependencySchema).min(1).optional(),
    entities: listWithUniqueIds(parts.entity),
  });
}

/**
 * The long texts of one pack in one language, loaded when needed (SPEC §5.7). Entity id → field
 * name → text. Every entity id is of the overlay's own pack.
 */
export const localeOverlaySchema = z
  .strictObject({
    schemaVersion: z.literal(LOCALE_OVERLAY_SCHEMA_VERSION),
    packId: packIdSchema,
    locale: localeSchema,
    texts: z.record(
      entityIdSchema,
      z
        .record(entityKeySchema, visibleTextSchema)
        .refine((fields) => Object.keys(fields).length > 0, 'Needs at least one text.')
        .meta({ minProperties: 1 }),
    ),
  })
  .superRefine((overlay, ctx) => {
    for (const id of Object.keys(overlay.texts)) {
      const pack = parseEntityId(id)?.pack;
      if (pack !== overlay.packId) {
        ctx.addIssue({
          code: 'custom',
          path: ['texts', id],
          message: `The entity is of pack "${pack}", not of "${overlay.packId}".`,
        });
      }
    }
  });
export type LocaleOverlay = z.infer<typeof localeOverlaySchema>;

/**
 * The migration frame for a system's packs: the core's steps on `schemaVersion`, then the module's
 * `systemMigrations` on `systemSchemaVersion`. A newer pack is refused, an older one migrated.
 */
export function packOpenerOf<S extends z.ZodType>(
  packSchema: S,
  systemMigrations: readonly Migration[],
) {
  return openerOf(packSchema, [
    { field: 'schemaVersion', migrations: PACK_MIGRATIONS },
    { field: 'systemSchemaVersion', migrations: systemMigrations },
  ]);
}

/** Opens a locale overlay through the migration frame. */
export const openLocaleOverlay = openerOf(localeOverlaySchema, [
  { field: 'schemaVersion', migrations: LOCALE_OVERLAY_MIGRATIONS },
]);

/** What Zod checks and a JSON Schema cannot say. The exported file lists them for its reader. */
const PACK_CHECKS_LEFT_OUT = [
  'Entity ids are unique in `entities`; effect ids in `effects`; grant ids in `grants`.',
  "A choice's `count` is no more than its list's length.",
  'A pattern of an ability score grant has no more numbers than `from` has stats.',
];
const OVERLAY_CHECKS_LEFT_OUT = ["Every entity id in `texts` is of the overlay's `packId`."];

function describeChecks(what: string, left: readonly string[]): string {
  return [
    `${what}. The app checks these too, which this JSON Schema cannot say:`,
    ...left.map((check) => `- ${check}`),
  ].join('\n');
}

/** Each entity option whose `type` is a constant gets the id pattern of that type. */
function idMatchesType(ctx: { jsonSchema: z.core.JSONSchema.BaseSchema }): void {
  const properties = ctx.jsonSchema.properties;
  const type = properties?.type;
  const id = properties?.id;
  if (properties === undefined || typeof type !== 'object' || typeof id !== 'object') return;
  if (typeof type.const !== 'string' || typeof id.pattern !== 'string') return;
  // A new object: the id's JSON Schema is one object shared by every option.
  properties.id = { ...id, pattern: entityIdPatternOf(type.const) };
}

/** A pack schema as draft 2020-12 JSON Schema, for people who write a pack by hand. */
export function packJsonSchemaOf(packSchema: z.ZodType) {
  return {
    ...z.toJSONSchema(packSchema, { io: 'input', override: idMatchesType }),
    title: 'Content pack',
    description: describeChecks('A content pack', PACK_CHECKS_LEFT_OUT),
  };
}

/** The locale overlay as draft 2020-12 JSON Schema. */
export function localeOverlayJsonSchema() {
  return {
    ...z.toJSONSchema(localeOverlaySchema, { io: 'input' }),
    title: 'Locale overlay',
    description: describeChecks('The texts of one pack in one language', OVERLAY_CHECKS_LEFT_OUT),
  };
}
