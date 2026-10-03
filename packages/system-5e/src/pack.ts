import { type Migration, packJsonSchemaOf, packOpenerOf, packSchemaOf } from '@grimoire/schema';
import type { z } from 'zod';
import { fifthEditionEntitySchema } from './entity-types';
import { FIFTH_EDITION_SCHEMA_VERSION, FIFTH_EDITION_SYSTEM, fifthEdition } from './system';

// A fifth-edition pack (ENG-05) carries the module's version, the number its characters carry
// (ENG-39). Its steps are its own: a version that changes only a character's `systemData` has a
// pack step that returns the pack as it is.
// ENG-38: its JSON Schema is the file the app publishes (`apps/web/public/schema/5e/`). The module
// returns it; the app's test writes it.

/** The steps to `FIFTH_EDITION_SCHEMA_VERSION` for a pack: step N takes N + 1 to N + 2. */
export const FIFTH_EDITION_PACK_MIGRATIONS: readonly Migration[] = [
  // 1 → 2: ENG-47 changed a character's `systemData` only.
  (file) => ({ ...file }),
  // 2 → 3: ENG-58 changed a character's `systemData` only.
  (file) => ({ ...file }),
  // 3 → 4: ENG-56 changed a character's `systemData` only.
  (file) => ({ ...file }),
];

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

/** What the module checks and a JSON Schema cannot say. The published file lists them. */
export const FIFTH_EDITION_CHECKS_LEFT_OUT = [
  "A weapon's long range is no shorter than its normal range.",
  'A class gives each level once in `levels`.',
  "Grant ids differ in a class's `multiclass.grants`, and from the ids in its `grants`.",
  "An `item` grant's `fixed` list names each item once.",
] as const;

/** The fifth-edition pack as draft 2020-12 JSON Schema: the file the app publishes. */
export function fifthEditionPackJsonSchema() {
  return packJsonSchemaOf(fifthEditionPackSchema, FIFTH_EDITION_CHECKS_LEFT_OUT);
}
