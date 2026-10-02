import {
  entityKeySchema,
  formulaSchema,
  l10nSchema,
  listWithUnique,
  listWithUniqueIds,
  systemEntitySchemaOf,
  uniqueList,
  visibleTextSchema,
} from '@grimoire/schema';
import { z } from 'zod';
import { COINS, fifthEdition, HIT_DIE_SIZES, MAX_LEVEL, MAX_SPELL_LEVEL } from './system';

// ENG-32: fifth edition's entity types (SPEC §5.3), each built on the system's base, so its
// editions, grant kinds and proficiencies are checked by fifth edition's lists. What an entity
// gives is its `grants`, the only place the core reads it (ENG-11): SPEC's fields that list given
// entities (a class's features, a species' traits, a background's feat, a feature's origin and
// uses) are written as grants instead (ENG-32 §4). Distances are feet and weights pounds.
// ENG-38: a check JSON Schema can say carries its JSON Schema form beside it, in `.meta()`, so the
// published file refuses what Zod refuses; the others are lines in its description (`pack.ts`).

const base = fifthEdition.entityBaseSchema;

/** A class level, or a character's: 1 to 20. */
export const levelSchema = z.int().min(1).max(MAX_LEVEL);

/** One whole number per class level, from level 1 at index 0. */
const levelColumnSchema = z.array(z.int().nonnegative()).length(MAX_LEVEL);

/** A price: an amount of one coin. */
const costSchema = z.strictObject({
  amount: z.number().positive(),
  unit: z.enum(COINS),
});

/** Damage of one type: a roll formula and the damage type's key. */
const damageSchema = z.strictObject({ formula: formulaSchema, type: entityKeySchema });

/** Speeds in feet, by kind; at least one. */
const speedSchema = z
  .partialRecord(z.enum(['walk', 'fly', 'swim', 'climb', 'burrow']), z.int().nonnegative())
  .refine((speed) => Object.keys(speed).length > 0, 'Needs at least one speed.')
  .meta({ minProperties: 1 });

/** A species: its sizes to choose from, its speeds, its creature type. */
export const speciesDefSchema = base.safeExtend({
  type: z.literal('species'),
  size: uniqueList(entityKeySchema),
  speed: speedSchema,
  creatureType: entityKeySchema.optional(),
});
export type SpeciesDef = z.infer<typeof speciesDefSchema>;

/** A lineage of a species: a species' fields, each only where the lineage has its own. */
export const lineageDefSchema = base.safeExtend({
  type: z.literal('lineage'),
  size: uniqueList(entityKeySchema).optional(),
  speed: speedSchema.optional(),
  creatureType: entityKeySchema.optional(),
});
export type LineageDef = z.infer<typeof lineageDefSchema>;

/** How a class or subclass casts spells (SPEC §5.3 `SpellcastingDef`). */
export const spellcastingDefSchema = z.strictObject({
  ability: entityKeySchema,
  progression: z.enum(['full', 'half', 'third', 'pact', 'none']),
  preparation: z.enum(['prepared', 'known', 'spellbook']),
  preparedCount: z.union([formulaSchema, levelColumnSchema]).optional(),
  cantripsKnown: levelColumnSchema.optional(),
  spellsKnown: levelColumnSchema.optional(),
  /** Per class level, the slots of spell levels 1 to 9; a pact magic row has them at one level. */
  slotsTable: z
    .array(z.array(z.int().nonnegative()).max(MAX_SPELL_LEVEL))
    .length(MAX_LEVEL)
    .optional(),
  spellList: z
    .strictObject({ classKey: entityKeySchema.optional(), tag: visibleTextSchema.optional() })
    .refine(
      (list) => list.classKey !== undefined || list.tag !== undefined,
      'Needs `classKey`, `tag` or both.',
    )
    .meta({ anyOf: [{ required: ['classKey'] }, { required: ['tag'] }] }),
  ritual: z.boolean().optional(),
});
export type SpellcastingDef = z.infer<typeof spellcastingDefSchema>;

/** One row of a class's table: its columns, read as `@classes.<key>.table.<column>`. */
const classLevelSchema = z.strictObject({
  level: levelSchema,
  table: z.record(entityKeySchema, z.union([z.number(), visibleTextSchema])).optional(),
  abilityScoreImprovement: z.boolean().optional(),
});

/** What a class asks of, and gives, a character who takes it as a later class. */
const multiclassSchema = z
  .strictObject({
    prerequisites: z.array(fifthEdition.prerequisiteSchema).min(1).optional(),
    grants: listWithUniqueIds(fifthEdition.grantSchema).min(1).optional(),
  })
  .refine(
    (multiclass) => multiclass.prerequisites !== undefined || multiclass.grants !== undefined,
    'Needs `prerequisites`, `grants` or both.',
  )
  .meta({ anyOf: [{ required: ['prerequisites'] }, { required: ['grants'] }] });

/** A class. Its features are its `entity` grants, each at its `atLevel`. */
export const classDefSchema = base
  .safeExtend({
    type: z.literal('class'),
    key: entityKeySchema,
    hitDie: z.literal(HIT_DIE_SIZES),
    primaryAbilities: uniqueList(entityKeySchema).optional(),
    saves: uniqueList(entityKeySchema),
    subclassLevel: levelSchema,
    levels: listWithUnique(classLevelSchema, 'level').min(1).optional(),
    spellcasting: spellcastingDefSchema.optional(),
    multiclass: multiclassSchema.optional(),
  })
  .superRefine((entity, ctx) => {
    // A choice is kept under `<entityId>#<grantId>`, so two grants of one class need two ids.
    const own = new Set((entity.grants ?? []).map((grant) => grant.id));
    for (const [index, grant] of (entity.multiclass?.grants ?? []).entries()) {
      if (own.has(grant.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['multiclass', 'grants', index, 'id'],
          message: `The id "${grant.id}" is also one of the class's own grants.`,
        });
      }
    }
  });
export type ClassDef = z.infer<typeof classDefSchema>;

/** A subclass of the class whose key is `classKey`. Its features are its grants. */
export const subclassDefSchema = base.safeExtend({
  type: z.literal('subclass'),
  key: entityKeySchema,
  classKey: entityKeySchema,
  spellcasting: spellcastingDefSchema.optional(),
});
export type SubclassDef = z.infer<typeof subclassDefSchema>;

/** A background. Its stats, feat and proficiencies are its grants. */
export const backgroundDefSchema = base.safeExtend({ type: z.literal('background') });
export type BackgroundDef = z.infer<typeof backgroundDefSchema>;

/** A feat. */
export const featDefSchema = base.safeExtend({
  type: z.literal('feat'),
  category: entityKeySchema.optional(),
  repeatable: z.boolean().optional(),
});
export type FeatDef = z.infer<typeof featDefSchema>;

/** A feature of a class, species, background, feat or item. Its uses are a `resource` grant. */
export const featureDefSchema = base.safeExtend({
  type: z.literal('feature'),
  activation: z.enum(['action', 'bonus', 'reaction', 'free', 'passive', 'special']).optional(),
});
export type FeatureDef = z.infer<typeof featureDefSchema>;

/**
 * A JSON Schema form: `needs` are required when `field` holds `value`, and refused when it holds
 * another.
 */
function onlyWhen(field: string, value: string, needs: readonly string[]) {
  return {
    anyOf: [
      { properties: { [field]: { const: value } }, required: [...needs] },
      {
        properties: {
          [field]: { not: { const: value } },
          ...Object.fromEntries(needs.map((need) => [need, false])),
        },
      },
    ],
  };
}

/** How far a spell reaches; a `distance` range alone has a distance. */
const spellRangeSchema = z
  .strictObject({
    kind: z.enum(['self', 'touch', 'distance', 'sight', 'unlimited', 'special']),
    distance: z.int().positive().optional(),
    area: z.strictObject({ shape: entityKeySchema, size: z.int().positive() }).optional(),
  })
  .refine((range) => (range.kind === 'distance') === (range.distance !== undefined), {
    message: 'A `distance` range needs `distance`; no other range has one.',
    path: ['distance'],
  })
  .meta(onlyWhen('kind', 'distance', ['distance']));

/** How long a spell lasts; a `timed` duration alone has a value and a unit. */
const spellDurationSchema = z
  .strictObject({
    kind: z.enum(['instant', 'timed', 'untilDispelled', 'special']),
    value: z.int().positive().optional(),
    unit: z.enum(['round', 'minute', 'hour', 'day']).optional(),
  })
  .refine(
    (duration) =>
      duration.kind === 'timed'
        ? duration.value !== undefined && duration.unit !== undefined
        : duration.value === undefined && duration.unit === undefined,
    'A `timed` duration needs `value` and `unit`; no other duration has them.',
  )
  .meta(onlyWhen('kind', 'timed', ['value', 'unit']));

/** A spell's components; a material's cost and whether it is used up need the material. */
const spellComponentsSchema = z
  .strictObject({
    v: z.boolean(),
    s: z.boolean(),
    m: l10nSchema.optional(),
    mCost: costSchema.optional(),
    mConsumed: z.boolean().optional(),
  })
  .refine(
    (components) =>
      components.m !== undefined ||
      (components.mCost === undefined && components.mConsumed === undefined),
    '`mCost` and `mConsumed` need `m`.',
  )
  .meta({ dependentRequired: { mCost: ['m'], mConsumed: ['m'] } });

/** A JSON Schema form: a `scaling` of this kind. */
function scalingKind(kind: string) {
  return { type: 'object', properties: { kind: { const: kind } } };
}

/**
 * A spell. Level 0 is a cantrip. `scaling` is how its dice grow (ADR 014 item 6): a cantrip's with
 * the character's level, another spell's with the slot it is cast with.
 */
export const spellDefSchema = base
  .safeExtend({
    type: z.literal('spell'),
    level: z.int().min(0).max(MAX_SPELL_LEVEL),
    school: entityKeySchema,
    castingTime: z.strictObject({
      value: z.int().positive(),
      unit: z.enum(['action', 'bonus', 'reaction', 'minute', 'hour']),
      note: l10nSchema.optional(),
    }),
    range: spellRangeSchema,
    components: spellComponentsSchema,
    duration: spellDurationSchema,
    concentration: z.boolean(),
    ritual: z.boolean(),
    classes: uniqueList(entityKeySchema),
    attack: z.enum(['melee', 'ranged']).optional(),
    save: entityKeySchema.optional(),
    damage: z.array(damageSchema).min(1).optional(),
    scaling: z
      .strictObject({ kind: z.enum(['cantrip', 'slot']), formula: formulaSchema })
      .optional(),
  })
  .refine(
    (spell) =>
      spell.scaling === undefined || (spell.scaling.kind === 'cantrip') === (spell.level === 0),
    {
      message: 'A cantrip scales by `cantrip`, a spell of level 1 or more by `slot`.',
      path: ['scaling', 'kind'],
    },
  )
  .meta({
    anyOf: [
      { properties: { level: { const: 0 }, scaling: scalingKind('cantrip') } },
      { properties: { level: { not: { const: 0 } }, scaling: scalingKind('slot') } },
    ],
  });
export type SpellDef = z.infer<typeof spellDefSchema>;

/** A weapon's numbers; a range in feet, the long one no shorter than the normal one. */
const weaponSchema = z.strictObject({
  group: z.enum(['simple', 'martial']),
  kind: z.enum(['melee', 'ranged']),
  damage: damageSchema.optional(),
  versatile: formulaSchema.optional(),
  properties: uniqueList(entityKeySchema).optional(),
  range: z
    .strictObject({ normal: z.int().positive(), long: z.int().positive().optional() })
    .refine((range) => range.long === undefined || range.long >= range.normal, {
      message: 'The long range is below the normal one.',
      path: ['long'],
    })
    .optional(),
  mastery: entityKeySchema.optional(),
});

/** Armor's numbers. `dexCap` is the most Dexterity adds: `null` for no cap, 0 for none. */
const armorSchema = z.strictObject({
  group: z.enum(['light', 'medium', 'heavy']),
  baseAC: z.int().positive(),
  dexCap: z.int().nonnegative().nullable(),
  strRequirement: z.int().positive().optional(),
  stealthDisadvantage: z.boolean().optional(),
});

/** Which block each category needs; no other category has it. */
const ITEM_BLOCKS = [
  { block: 'weapon', category: 'weapon', needs: 'A weapon needs its `weapon` block.' },
  { block: 'armor', category: 'armor', needs: 'Armor needs its `armor` block.' },
] as const;

/** An item. A shield is the category `shield` with an effect on `ac.bonus` (SPEC §5.3). */
export const itemDefSchema = base
  .safeExtend({
    type: z.literal('item'),
    category: z.enum([
      'weapon',
      'armor',
      'shield',
      'gear',
      'tool',
      'consumable',
      'ammunition',
      'focus',
      'pack',
      'treasure',
    ]),
    weight: z.number().positive().optional(),
    cost: costSchema.optional(),
    weapon: weaponSchema.optional(),
    armor: armorSchema.optional(),
    magic: z
      .strictObject({
        rarity: entityKeySchema,
        attunement: z.union([z.boolean(), l10nSchema]).optional(),
        bonus: z.int().optional(),
      })
      .optional(),
  })
  .superRefine((item, ctx) => {
    for (const { block, category, needs } of ITEM_BLOCKS) {
      const has = item[block] !== undefined;
      if (has === (item.category === category)) continue;
      ctx.addIssue({
        code: 'custom',
        path: [block],
        message: has ? `Only the category \`${category}\` has a \`${block}\` block.` : needs,
      });
    }
  })
  .meta({
    allOf: ITEM_BLOCKS.map(({ block, category }) => onlyWhen('category', category, [block])),
  });
export type ItemDef = z.infer<typeof itemDefSchema>;

// The simple types have no fields of their own; other entities name each one by its key.

/** A language, named by key in a `language` proficiency. */
export const languageDefSchema = base.safeExtend({
  type: z.literal('language'),
  key: entityKeySchema,
});
export type LanguageDef = z.infer<typeof languageDefSchema>;

/** A damage type, named by key in a damage's `type`. */
export const damageTypeDefSchema = base.safeExtend({
  type: z.literal('damageType'),
  key: entityKeySchema,
});
export type DamageTypeDef = z.infer<typeof damageTypeDefSchema>;

/** A weapon property, named by key in a weapon's `properties`. */
export const weaponPropertyDefSchema = base.safeExtend({
  type: z.literal('weaponProperty'),
  key: entityKeySchema,
});
export type WeaponPropertyDef = z.infer<typeof weaponPropertyDefSchema>;

/** A weapon mastery property, named by key in a weapon's `mastery`. */
export const weaponMasteryDefSchema = base.safeExtend({
  type: z.literal('weaponMastery'),
  key: entityKeySchema,
});
export type WeaponMasteryDef = z.infer<typeof weaponMasteryDefSchema>;

/** A kind of tool, named by key in a `tool` proficiency. */
export const toolKindDefSchema = base.safeExtend({
  type: z.literal('toolKind'),
  key: entityKeySchema,
});
export type ToolKindDef = z.infer<typeof toolKindDefSchema>;

/** A rule, shown in Quick rules under its topic, with an icon when it has one (ADR 014 item 5). */
export const ruleDefSchema = base.safeExtend({
  type: z.literal('rule'),
  topic: entityKeySchema,
  icon: entityKeySchema.optional(),
});
export type RuleDef = z.infer<typeof ruleDefSchema>;

/** Any fifth-edition entity, chosen by its `type`: the core's three types, then the module's. */
export const fifthEditionEntitySchema = systemEntitySchemaOf(fifthEdition, [
  speciesDefSchema,
  lineageDefSchema,
  classDefSchema,
  subclassDefSchema,
  backgroundDefSchema,
  featDefSchema,
  featureDefSchema,
  spellDefSchema,
  itemDefSchema,
  languageDefSchema,
  damageTypeDefSchema,
  weaponPropertyDefSchema,
  weaponMasteryDefSchema,
  toolKindDefSchema,
  ruleDefSchema,
]);
export type FifthEditionEntity = z.infer<typeof fifthEditionEntitySchema>;
