import {
  chooseEntitiesSchema,
  entityIdSchema,
  entityKeySchema,
  grantBaseSchema,
  listWithUniqueIds,
  systemListsOf,
  systemSchemasOf,
  uniqueList,
  withFixedOrChoose,
} from '@grimoire/schema';
import { z } from 'zod';

// Fifth edition's lists and grant kinds, given to the core in ENG-24's steps. The values are
// SPEC §5.2, §5.3 and §5.5's; the bounds were measured in both SRDs (ENG-32 §8, ENG-33 §8).

/** Fifth edition's system id, which its packs and characters name (ADR 004 item 3). */
export const FIFTH_EDITION_SYSTEM = '5e';

/**
 * The stored shape of the module's part of a file: a pack's entities, a character's own entities
 * and its `systemData` (ENG-39). A change to it needs a step in each list of migrations.
 */
export const FIFTH_EDITION_SCHEMA_VERSION = 4;

/** The highest level a class or a character reaches, in both editions. */
export const MAX_LEVEL = 20;

/** The highest spell level; level 0 is a cantrip. */
export const MAX_SPELL_LEVEL = 9;

/** The sizes of a hit die: a class's `hitDie`, a character's spent hit dice. */
export const HIT_DIE_SIZES = [6, 8, 10, 12] as const;

/** The kinds of speed, in feet: a species' speeds, a character's `speed.<kind>` (ENG-14). */
export const SPEED_KINDS = ['walk', 'fly', 'swim', 'climb', 'burrow'] as const;

/**
 * The key of the module's own base AC calculation: the worn armor's, else 10 + DEX (ENG-14). A
 * character pins it, or an `ac.formulas` effect's part id, in `acCalc` (ENG-47).
 */
export const EQUIPMENT_AC_CALC = 'equipment';

/** The groups of armor: an armor's `group`, a character's `armor.<group>` (ENG-44). */
export const ARMOR_GROUPS = ['light', 'medium', 'heavy'] as const;

/**
 * What a spell's healing gives (ENG-53): hit points regained, or temporary hit points. ENG-20
 * changes each with its own action (`applyHealing`, `setTempHp`).
 */
export const HEALING_KINDS = ['hp', 'tempHp'] as const;

/** The coins: a price's unit, a character's money. */
export const COINS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;

/**
 * Fifth edition's editions, proficiencies and recovery events. ENG-16: a `mastery` proficiency's
 * keys are kinds of weapons (a weapon's `key`) whose mastery property the character uses (2024).
 */
export const fifthEditionLists = systemListsOf({
  editions: ['2014', '2024'],
  proficiencyCategories: ['skill', 'save', 'armor', 'weapon', 'tool', 'language', 'mastery'],
  proficiencyLevels: [0.5, 1, 2],
  recoveryEvents: ['short', 'long', 'dawn', 'turn', 'manual'],
});

/**
 * Spells an entity gives (SPEC §5.5). `ability` is the stat they are cast with; `uses`, their own
 * uses, cast through which they need no slot (ADR 014 item 7).
 */
export const spellGrantSchema = withFixedOrChoose(
  grantBaseSchema.safeExtend({
    kind: z.literal('spell'),
    fixed: uniqueList(entityIdSchema).optional(),
    choose: chooseEntitiesSchema.optional(),
    ability: entityKeySchema.optional(),
    alwaysPrepared: z.boolean().optional(),
    uses: fifthEditionLists.usesDefSchema.optional(),
  }),
);

/** Items an entity gives, each with how many (SPEC §5.5). */
export const itemGrantSchema = withFixedOrChoose(
  grantBaseSchema.safeExtend({
    kind: z.literal('item'),
    fixed: listWithUniqueIds(z.strictObject({ id: entityIdSchema, qty: z.int().positive() }))
      .min(1)
      .optional(),
    choose: chooseEntitiesSchema.optional(),
  }),
);

/** Fifth edition's grants, prerequisites, entity base and core types. */
export const fifthEdition = systemSchemasOf(fifthEditionLists, [spellGrantSchema, itemGrantSchema]);
