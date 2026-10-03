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
  type StoredObject,
  uniqueList,
  uuidSchema,
  visibleTextSchema,
} from '@grimoire/schema';
import { z } from 'zod';
import { fifthEditionEntitySchema, levelSchema } from './entity-types';
import { EDITION_RULES } from './rulesets';
import {
  COINS,
  EQUIPMENT_AC_CALC,
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

/** `value` when it is an object of fields: not a list, not a plain value. */
function fieldsOf(value: unknown): StoredObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as StoredObject)
    : undefined;
}

/** The steps to `FIFTH_EDITION_SCHEMA_VERSION` for a character: step N takes N + 1 to N + 2. */
export const FIFTH_EDITION_CHARACTER_MIGRATIONS: readonly Migration[] = [
  // 1 → 2 (ENG-47): `acCalc` is new and optional, and a character of version 1 pinned nothing.
  (file) => ({ ...file }),
  // 2 → 3 (ENG-58): `deathSaves.stable` is new and needed. Nothing in version 2 made a character
  // stable, so it was not. A file without those fields is returned as it is, for the schema.
  (file) => {
    const data = fieldsOf(file.systemData);
    const state = fieldsOf(data?.state);
    const deathSaves = fieldsOf(state?.deathSaves);
    if (data === undefined || state === undefined || deathSaves === undefined) return { ...file };
    return {
      ...file,
      systemData: { ...data, state: { ...state, deathSaves: { ...deathSaves, stable: false } } },
    };
  },
  // 3 → 4 (ENG-56): `languageSource` is new and needed; a character takes its rules base's. A
  // file with no edition or no `systemData` object is returned as it is, for the schema.
  (file) => {
    const { ruleset } = file;
    const data = fieldsOf(file.systemData);
    if (typeof ruleset !== 'string' || !Object.hasOwn(EDITION_RULES, ruleset)) return { ...file };
    if (data === undefined) return { ...file };
    const { languageSource } = EDITION_RULES[ruleset as keyof typeof EDITION_RULES];
    return { ...file, systemData: { ...data, languageSource } };
  },
];

/** The successes, or the failures, that end a run of death saves (ENG-33 §8). */
export const DEATH_SAVES = 3;

/** A table's house rules (SPEC §8.4). Their defaults are `DEFAULT_HOUSE_RULES`. */
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

/**
 * ENG-19: the house rules a new character is written with, "by the SRD" (SPEC §8.4): one value for
 * both editions, measured equal in SRD 5.1 and SRD 5.2.1 (ENG-19 §8). Inspiration's maximum is the
 * owner's 3 (ADR 009 item 5); the edition's own is `rulesOf(...).inspiration.max`.
 */
export const DEFAULT_HOUSE_RULES: HouseRules = {
  hitPointMethods: ['roll', 'avg'],
  abilityMax: 20,
  feats: 'own',
  multiclass: true,
  encumbrance: 'simple',
  skillAbilitySwap: false,
  inspirationMax: 3,
};

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
  /**
   * The death saves of the run at 0 hit points; `stable` once the third success, or first aid,
   * ends the run with the character alive (ENG-58).
   */
  deathSaves: z.strictObject({
    success: deathSaveCountSchema,
    failure: deathSaveCountSchema,
    stable: z.boolean(),
  }),
  /** The spell the character concentrates on. */
  concentration: entityIdSchema.optional(),
  inspiration: z.int().nonnegative(),
});

/** Fifth edition's part of a character (SPEC §5.8, ADR 014 item 8). */
export const fifthEditionDataSchema = z
  .strictObject({
    houseRules: houseRulesSchema,
    abilities: abilitiesSchema,
    /**
     * ENG-56: the side whose starting languages count when both give some (ADR 005 item 3.4);
     * no `both`, since a bonus of one kind counts once (ADR 014 item 1).
     */
    languageSource: z.enum(['species', 'background']),
    /** How levels are gained (ADR 010 item 7); the XP total is kept in both modes. */
    advancement: z.strictObject({ mode: z.enum(['xp', 'milestone']), xp: z.int().nonnegative() }),
    /** The species, with the size chosen from its list when it offers more than one. */
    species: z.strictObject({ id: entityIdSchema, size: entityKeySchema.optional() }).optional(),
    background: z.strictObject({ id: entityIdSchema }).optional(),
    /**
     * The base AC calculation the person picked (ENG-47): the module's own, or an `ac.formulas`
     * effect's part. Without it, the highest counts.
     */
    acCalc: z.union([z.literal(EQUIPMENT_AC_CALC), entityPartIdSchema]).optional(),
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
