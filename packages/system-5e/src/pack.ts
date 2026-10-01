import { type Migration, packOpenerOf, packSchemaOf } from '@grimoire/schema';
import type { z } from 'zod';
import { fifthEditionEntitySchema } from './entity-types';
import { FIFTH_EDITION_SCHEMA_VERSION, FIFTH_EDITION_SYSTEM, fifthEdition } from './system';

// A fifth-edition pack (ENG-05) carries the module's version, the number its characters carry
// (ENG-39). Its steps are its own: a version that changes only a character's `systemData` has a
// pack step that returns the pack as it is. Its published JSON Schema is ENG-38's.

/** The steps to `FIFTH_EDITION_SCHEMA_VERSION` for a pack: step N takes N + 1 to N + 2. */
export const FIFTH_EDITION_PACK_MIGRATIONS: readonly Migration[] = [];

/** A fifth-edition content pack: its entities are fifth edition's union (ENG-32). */
export const fifthEditionPackSchema = packSchemaOf({
  system: FIFTH_EDITION_SYSTEM,
  systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
  ruleset: fifthEdition.rulesetSchema,
  entity: fifthEditionEntitySchema,
});
export type FifthEditionPack = z.infer<typeof fifthEditionPackSchema>;

/** Opens a fifth-edition pack as the app opens a file: through the migration frame. */
export const openFifthEditionPack = packOpenerOf(
  fifthEditionPackSchema,
  FIFTH_EDITION_PACK_MIGRATIONS,
);
