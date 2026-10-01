import {
  characterOpenerOf,
  characterSchemaOf,
  entityIdSchema,
  entityKeySchema,
  entityPartIdSchema,
  listWithUnique,
  listWithUniqueIds,
  type Migration,
  rollRecordSchema,
  uniqueList,
  uuidSchema,
  visibleTextSchema,
} from '@grimoire/schema';
import { z } from 'zod';
import { fifthEditionEntitySchema, levelSchema } from './entity-types';
import {
  COINS,
  FIFTH_EDITION_SCHEMA_VERSION,
  FIFTH_EDITION_SYSTEM,
  fifthEditionLists,
  HIT_DIE_SIZES,
  MAX_LEVEL,
  MAX_SPELL_LEVEL,
} from './system';

// ENG-33: fifth edition's part of a character, the core's `systemData` (ENG-06): SPEC §5.8's
// fifth-edition fields, with ADR 014 item 8's. What a grant gives is the core's `choices`, never a
// field here: a lineage, and a feat a background, species or class gives (ENG-32 §11). Fields are
// checked against each other only inside this file; an id naming nothing in a pack is valid here
// (missing is not broken).

/** The steps to `FIFTH_EDITION_SCHEMA_VERSION` for a character: step N takes N + 1 to N + 2. */
export const FIFTH_EDITION_CHARACTER_MIGRATIONS: readonly Migration[] = [];

/** The successes, or the failures, that end a run of death saves (ENG-33 §8). */
export const DEATH_SAVES = 3;

/** A table's house rules (SPEC §8.4). Their defaults are each edition's (ENG-19). */
export const houseRulesSchema = z.strictObject({
  /** How a level's hit points may be taken: rolled, the die's average, or its maximum. */
  hitPointMethods: uniqueList(z.enum(['roll', 'avg', 'max'])),
  /** The highest score a stat reaches. */
  abilityMax: z.int().positive(),
  /** Which feats may be taken: none, the rules base's, also the other edition's optional ones, any. */
  feats: z.enum(['none', 'own', 'ownAndOtherOptional', 'all']),
  multiclass: z.boolean(),
  encumbrance: z.enum(['none', 'simple', 'variant']),
  /** A skill may be rolled with another stat than its own. */
  skillAbilitySwap: z.boolean(),
  /** The most inspiration a character holds (ADR 009 item 5). */
  inspirationMax: z.int().positive(),
});
export type HouseRules = z.infer<typeof houseRulesSchema>;

/** How the base scores were made: the method's key, and the rolls it made (ADR 014 item 8). */
const abilitiesSchema = z.strictObject({
  method: entityKeySchema,
  rolls: z.array(rollRecordSchema).min(1).optional(),
  /** Whose ability score increases apply (ADR 014 item 1). `both` warns; it never blocks. */
  bonusSource: z.enum(['species', 'background', 'both']),
});

/** The most a hit die rolls: the largest one's faces. */
const MAX_HIT_DIE_ROLL = Math.max(...HIT_DIE_SIZES);

/** A level's hit points: a number rolled, the die's average, or its maximum (dnd5e's values). */
const levelHitPointsSchema = z.union([
  z.int().min(1).max(MAX_HIT_DIE_ROLL),
  z.enum(['avg', 'max']),
]);

/** A class the character has, with one hit points entry per level. */
const classEntrySchema = z
  .strictObject({
    id: entityIdSchema,
    subclass: entityIdSchema.optional(),
    level: levelSchema,
    hp: z.array(levelHitPointsSchema),
  })
  .refine((entry) => entry.hp.length === entry.level, {
    message: 'Needs one hit points entry per level.',
    path: ['hp'],
  });

/** The classes in the order taken: the first is the first class. Their levels add up to 20. */
const classesSchema = listWithUniqueIds(classEntrySchema).superRefine((classes, ctx) => {
  const total = classes.reduce((sum, entry) => sum + entry.level, 0);
  if (total > MAX_LEVEL) {
    ctx.addIssue({
      code: 'custom',
      message: `The levels add up to ${total}; a character reaches ${MAX_LEVEL} at most.`,
    });
  }
});

/**
 * Feats no grant gives. `replaces` names the grant whose ability score improvement the feat is
 * taken in place of; a feat without it was given by hand.
 */
const featsSchema = listWithUniqueIds(
  z.strictObject({ id: entityIdSchema, replaces: entityPartIdSchema.optional() }),
).superRefine((feats, ctx) => {
  const replaced = new Set<string>();
  for (const [index, feat] of feats.entries()) {
    if (feat.replaces === undefined) continue;
    if (replaced.has(feat.replaces)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'replaces'],
        message: `The grant "${feat.replaces}" is replaced twice.`,
      });
    }
    replaced.add(feat.replaces);
  }
});

/** The spells one class or subclass knows and has prepared; at least one of the two lists. */
const castingSchema = z
  .strictObject({
    known: uniqueList(entityIdSchema).optional(),
    prepared: uniqueList(entityIdSchema).optional(),
  })
  .refine(
    (casting) => casting.known !== undefined || casting.prepared !== undefined,
    'Needs `known`, `prepared` or both.',
  );

/** One row of the inventory: an item of a pack, or a custom one written on the sheet. */
const inventoryRowSchema = z
  .strictObject({
    uid: uuidSchema,
    itemId: entityIdSchema.optional(),
    custom: z
      .strictObject({ name: visibleTextSchema, weight: z.number().positive().optional() })
      .optional(),
    qty: z.int().nonnegative(),
    equipped: z.boolean(),
    attuned: z.boolean(),
    /** The `uid` of the row this one is inside. */
    container: uuidSchema.optional(),
    note: visibleTextSchema.optional(),
  })
  .refine(
    (row) => (row.itemId === undefined) !== (row.custom === undefined),
    'Needs `itemId` or `custom`, not both.',
  );

/** The inventory: no `uid` twice; a container is another row, and no row ends up inside itself. */
const inventorySchema = listWithUnique(inventoryRowSchema, 'uid').superRefine((rows, ctx) => {
  const containerOf = new Map(rows.map((row) => [row.uid as string, row.container]));
  for (const [index, row] of rows.entries()) {
    if (row.container === undefined) continue;
    if (!containerOf.has(row.container)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'container'],
        message: `No row has the uid "${row.container}".`,
      });
      continue;
    }
    const passed = new Set<string>();
    let at: string | undefined = row.container;
    while (at !== undefined && at !== row.uid && !passed.has(at)) {
      passed.add(at);
      at = containerOf.get(at);
    }
    if (at === row.uid) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'container'],
        message: 'The row ends up inside itself.',
      });
    }
  }
});

/** A count of death saves: 0 to 3. */
const deathSaveCountSchema = z.int().min(0).max(DEATH_SAVES);

/** The spell levels that have slots, as record keys: `1` to `9`. */
const slotLevels = Array.from({ length: MAX_SPELL_LEVEL }, (_, index) => `${index + 1}`);

/** Fifth edition's trackers; the core's (resources, conditions, toggles) are in the core's `state`. */
const trackersSchema = z.strictObject({
  hp: z.strictObject({ current: z.int().nonnegative(), temp: z.int().nonnegative() }),
  /** Hit dice spent, by die: `{ d10: 1 }`. */
  hitDiceSpent: z.partialRecord(
    z.templateLiteral(['d', z.literal(HIT_DIE_SIZES)]),
    z.int().nonnegative(),
  ),
  /** Slots spent, by spell level. */
  slotsSpent: z.partialRecord(z.enum(slotLevels as [string, ...string[]]), z.int().nonnegative()),
  /** Pact magic slots spent: all of them are of one level. */
  pactSlotsSpent: z.int().nonnegative(),
  deathSaves: z.strictObject({ success: deathSaveCountSchema, failure: deathSaveCountSchema }),
  /** The spell the character concentrates on. */
  concentration: entityIdSchema.optional(),
  inspiration: z.int().nonnegative(),
});

/** Fifth edition's part of a character (SPEC §5.8, ADR 014 item 8). */
export const fifthEditionDataSchema = z
  .strictObject({
    houseRules: houseRulesSchema,
    abilities: abilitiesSchema,
    /** How levels are gained (ADR 010 item 7); the XP total is kept in both modes. */
    advancement: z.strictObject({ mode: z.enum(['xp', 'milestone']), xp: z.int().nonnegative() }),
    /** The species, with the size chosen from its list when it offers more than one. */
    species: z.strictObject({ id: entityIdSchema, size: entityKeySchema.optional() }).optional(),
    background: z.strictObject({ id: entityIdSchema }).optional(),
    classes: classesSchema,
    feats: featsSchema,
    /** Class or subclass id → the spells it knows and has prepared. */
    spells: z.record(entityIdSchema, castingSchema),
    inventory: inventorySchema,
    currency: z.record(z.enum(COINS), z.int().nonnegative()),
    state: trackersSchema,
  })
  .superRefine((data, ctx) => {
    const max = data.houseRules.inspirationMax;
    if (data.state.inspiration > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['state', 'inspiration'],
        message: `${data.state.inspiration} is above the house rules' maximum of ${max}.`,
      });
    }
  });
export type FifthEditionData = z.infer<typeof fifthEditionDataSchema>;

/** A fifth-edition character: the core's part, fifth edition's entities and its `systemData`. */
export const fifthEditionCharacterSchema = characterSchemaOf({
  system: FIFTH_EDITION_SYSTEM,
  systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
  edition: fifthEditionLists.editionSchema,
  entity: fifthEditionEntitySchema,
  systemData: fifthEditionDataSchema,
});
export type FifthEditionCharacter = z.infer<typeof fifthEditionCharacterSchema>;

/** Opens a fifth-edition character as the app opens a file: through the migration frame. */
export const openFifthEditionCharacter = characterOpenerOf(
  fifthEditionCharacterSchema,
  FIFTH_EDITION_CHARACTER_MIGRATIONS,
);
