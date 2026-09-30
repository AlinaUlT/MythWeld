import { z } from 'zod';
import { formulaSchema } from './formula';
import { entityIdSchema, entityKeySchema, entityTypeNameSchema, slugSchema } from './ids';
import { l10nSchema, visibleTextSchema } from './text';

// ENG-04: the core's grant kinds name no game. SPEC §5.5's `feature` and `feat` kinds are one
// `entity` kind; `spell` and `item` carry fifth edition's fields and are its module's (ENG-32).
// Where a list of values is a system's (a proficiency's category and level, a recovery's event),
// only the shape is checked here.

/** A list with at least one item and no item twice. */
function uniqueList<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .min(1)
    .refine((list) => new Set(list).size === list.length, 'Holds an item twice.');
}

/** How many times a thing can be used, and when uses come back (SPEC §5.3 `UsesDef`). */
export const usesDefSchema = z.strictObject({
  max: formulaSchema,
  recovery: z
    .array(
      z.strictObject({
        on: entityKeySchema,
        amount: z.union([z.literal('all'), formulaSchema]),
      }),
    )
    .min(1),
});
export type UsesDef = z.infer<typeof usesDefSchema>;

/** Picks entities by their fields instead of listing them. */
const chooseFilterSchema = z
  .strictObject({
    type: entityTypeNameSchema.optional(),
    tag: visibleTextSchema.optional(),
    category: entityKeySchema.optional(),
  })
  .refine(
    (filter) =>
      filter.type !== undefined || filter.tag !== undefined || filter.category !== undefined,
    'Needs `type`, `tag` or `category`.',
  );

/** A choice a person makes: `count` items from a list or from what a filter finds. */
function chooseOf<T extends z.ZodType>(item: T) {
  return z
    .strictObject({
      count: z.int().positive(),
      from: z.union([uniqueList(item), chooseFilterSchema]),
    })
    .refine((choose) => !Array.isArray(choose.from) || choose.count <= choose.from.length, {
      message: 'Asks for more items than the list holds.',
      path: ['count'],
    });
}

/** A choice among keys: skills, stats, a system's proficiencies. */
export const chooseKeysSchema = chooseOf(entityKeySchema);
export type ChooseKeys = z.infer<typeof chooseKeysSchema>;

/** A choice among entities. */
export const chooseEntitiesSchema = chooseOf(entityIdSchema);
export type ChooseEntities = z.infer<typeof chooseEntitiesSchema>;

/** The fields every grant has. Each kind, a module's included, extends this. */
export const grantBaseSchema = z.strictObject({
  id: slugSchema,
  atLevel: z.int().positive().optional(),
});

function givesSomething(grant: { fixed?: unknown; choose?: unknown }): boolean {
  return grant.fixed !== undefined || grant.choose !== undefined;
}
const GIVES_NOTHING = 'Needs `fixed`, `choose` or both.';

const entityGrantSchema = grantBaseSchema
  .safeExtend({
    kind: z.literal('entity'),
    fixed: uniqueList(entityIdSchema).optional(),
    choose: chooseEntitiesSchema.optional(),
  })
  .refine(givesSomething, GIVES_NOTHING);

const proficiencyGrantSchema = grantBaseSchema
  .safeExtend({
    kind: z.literal('proficiency'),
    category: entityKeySchema,
    fixed: uniqueList(entityKeySchema).optional(),
    choose: chooseKeysSchema.optional(),
    level: z.number().positive().optional(),
  })
  .refine(givesSomething, GIVES_NOTHING);

const abilityScoreGrantSchema = z.discriminatedUnion('mode', [
  grantBaseSchema.safeExtend({
    kind: z.literal('abilityScore'),
    mode: z.literal('fixed'),
    values: z
      .record(
        entityKeySchema,
        z.int().refine((change) => change !== 0, 'Must not be 0.'),
      )
      .refine((values) => Object.keys(values).length > 0, 'Needs at least one stat.'),
  }),
  grantBaseSchema
    .safeExtend({
      kind: z.literal('abilityScore'),
      mode: z.literal('distribute'),
      from: uniqueList(entityKeySchema),
      patterns: z.array(z.array(z.int().positive()).min(1)).min(1),
    })
    .refine((grant) => grant.patterns.every((pattern) => pattern.length <= grant.from.length), {
      message: 'A pattern has more numbers than `from` has stats.',
      path: ['patterns'],
    }),
]);

const resourceGrantSchema = grantBaseSchema.safeExtend({
  kind: z.literal('resource'),
  key: entityKeySchema,
  label: l10nSchema,
  uses: usesDefSchema,
});

/** What an entity gives, and the choices it asks for (SPEC §5.5). */
export const grantSchema = z.discriminatedUnion('kind', [
  entityGrantSchema,
  proficiencyGrantSchema,
  abilityScoreGrantSchema,
  resourceGrantSchema,
]);
export type Grant = z.infer<typeof grantSchema>;
