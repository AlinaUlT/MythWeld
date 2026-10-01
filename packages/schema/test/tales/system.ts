import {
  characterOpenerOf,
  characterSchemaOf,
  entityIdSchema,
  entityKeySchema,
  grantBaseSchema,
  packOpenerOf,
  packSchemaOf,
  systemEntitySchemaOf,
  systemListsOf,
  systemSchemasOf,
} from '@grimoire/schema';
import { z } from 'zod';

// ENG-27: Tales, the made-up test system. The core's tests use it to show that the core knows no
// game (ADR 004 item 4). Everything in it is invented: no name, number or word of a real game.
//
// Tales' rules. What a pack's entity can say is in its data; the rest is here, and its numbers
// are `TALES_RULES`:
// - A stat's modifier is `floor(@score / 2)`, unless the stat has its own `modFormula`.
// - A stat's maximum is 10, unless the stat has its own `defaultMax`. A score above its maximum
//   counts as the maximum.
// - A stat has a save, unless it says `hasSave: false`. No rule of Tales gives a save a value.
// - A skill's knack level is the highest `level` its `knack` grants give: a grant without `level`
//   gives 1, and no grant gives 0.
// - A skill's total is its stat's modifier + 2 × its knack level + `skills.<key>.bonus` +
//   `skills.all.bonus`.
// - A skill with `passive: true` has a passive value of 5 + its total.
// - A character's level is 1 to 5, in its module part; formulas read it as `@level`.
// - A boon gives nothing until it is called on, which is an action of a later phase.
// Scores, effects, toggles, overrides, grants, choices, missing ids and prerequisites follow the
// core's rules (SPEC §6.1, §8.2).

/** Tales' rules as numbers and formulas. The words are above. */
export const TALES_RULES = {
  modFormula: 'floor(@score / 2)',
  statMax: 10,
  hasSave: true,
  knackCategory: 'knack',
  knackLevel: 1,
  knackStep: 2,
  passiveBase: 5,
} as const;

/** Tales' system id and the version of its module's stored shape. */
export const TALES_SYSTEM = 'tales';
export const TALES_SCHEMA_VERSION = 1;

export const talesLists = systemListsOf({
  editions: ['first-age', 'second-age'],
  proficiencyCategories: ['knack', 'lore', 'craft'],
  proficiencyLevels: [1, 2, 3],
  recoveryEvents: ['scene', 'session'],
});

/** Tales' own grant kind: a talent the character may call on. */
export const boonGrantSchema = grantBaseSchema.safeExtend({
  kind: z.literal('boon'),
  boon: entityIdSchema,
  uses: talesLists.usesDefSchema.optional(),
});

export const tales = systemSchemasOf(talesLists, [boonGrantSchema]);

/** A talent: something a character learned, of tier 1 to 3. */
export const talentSchema = tales.entityBaseSchema.safeExtend({
  type: z.literal('talent'),
  tier: z.int().min(1).max(3),
});

/** A calling: what a character does, with its die. */
export const callingSchema = tales.entityBaseSchema.safeExtend({
  type: z.literal('calling'),
  key: entityKeySchema,
  die: z.int().positive(),
});

export const talesEntitySchema = systemEntitySchemaOf(tales, [talentSchema, callingSchema]);
export type TalesEntity = z.infer<typeof talesEntitySchema>;

/** Tales' part of a character: its level, its calling, and talents taken outside a calling. */
export const talesDataSchema = z.strictObject({
  level: z.int().min(1).max(5),
  calling: entityIdSchema,
  talents: z.array(entityIdSchema),
});

export const talesPackSchema = packSchemaOf({
  system: TALES_SYSTEM,
  systemSchemaVersion: TALES_SCHEMA_VERSION,
  ruleset: tales.rulesetSchema,
  entity: talesEntitySchema,
});
export type TalesPack = z.infer<typeof talesPackSchema>;

export const talesCharacterSchema = characterSchemaOf({
  system: TALES_SYSTEM,
  systemSchemaVersion: TALES_SCHEMA_VERSION,
  edition: talesLists.editionSchema,
  entity: talesEntitySchema,
  systemData: talesDataSchema,
});
export type TalesCharacter = z.infer<typeof talesCharacterSchema>;

/** Opens a Tales pack or character as the app opens a file: through the migration frame. */
export const openTalesPack = packOpenerOf(talesPackSchema, []);
export const openTalesCharacter = characterOpenerOf(talesCharacterSchema, []);
