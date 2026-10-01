import { z } from 'zod';
import { formulaSchema } from './formula';
import { entityIdSchema, entityKeySchema, entityTypeNameSchema, slugSchema } from './ids';
import { l10nSchema, visibleTextSchema } from './text';

// ENG-04: the core's grant kinds name no game. SPEC §5.5's `feature` and `feat` kinds are one
// `entity` kind; `spell` and `item` carry fifth edition's fields and are its module's (ENG-32).
// Where a list of values is a system's (a proficiency's category and level, a recovery's event),
// only the shape is checked here; a system narrows it with its own list (`system.ts`).

/** A list with at least one item and no item twice. */
export function uniqueList<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .min(1)
    .refine((list) => new Set(list).size === list.length, 'Holds an item twice.')
    .meta({ uniqueItems: true });
}

/** `UsesDef` whose recovery events are checked by `recoveryEvent`. */
export function usesDefSchemaOf<E extends z.ZodType<string>>(recoveryEvent: E) {
  return z.strictObject({
    max: formulaSchema,
    recovery: z
      .array(
        z.strictObject({
          on: recoveryEvent,
          amount: z.union([z.literal('all'), formulaSchema]),
        }),
      )
      .min(1),
  });
}

/** How many times a thing can be used, and when uses come back (SPEC §5.3 `UsesDef`). */
export const usesDefSchema = usesDefSchemaOf(entityKeySchema);
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
  )
  .meta({ anyOf: [{ required: ['type'] }, { required: ['tag'] }, { required: ['category'] }] });

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

/**
 * `grant`, refusing it when it has neither `fixed` nor `choose`: it would give nothing. Every kind
 * that gives by list or by choice uses it, a module's included.
 */
export function withFixedOrChoose<T extends z.ZodType<{ fixed?: unknown; choose?: unknown }>>(
  grant: T,
): T {
  return grant
    .refine(givesSomething, 'Needs `fixed`, `choose` or both.')
    .meta({ anyOf: [{ required: ['fixed'] }, { required: ['choose'] }] });
}

const entityGrantSchema = withFixedOrChoose(
  grantBaseSchema.safeExtend({
    kind: z.literal('entity'),
    fixed: uniqueList(entityIdSchema).optional(),
    choose: chooseEntitiesSchema.optional(),
  }),
);

const abilityScoreGrantSchema = z.discriminatedUnion('mode', [
  grantBaseSchema.safeExtend({
    kind: z.literal('abilityScore'),
    mode: z.literal('fixed'),
    values: z
      .record(
        entityKeySchema,
        z
          .int()
          .refine((change) => change !== 0, 'Must not be 0.')
          .meta({ not: { const: 0 } }),
      )
      .refine((values) => Object.keys(values).length > 0, 'Needs at least one stat.')
      .meta({ minProperties: 1 }),
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

/** The core's grant kinds, with a system's lists where a value is the system's. */
export function coreGrantSchemasOf<
  C extends z.ZodType<string>,
  L extends z.ZodType<number>,
  U extends z.ZodType<UsesDef>,
>(lists: { proficiencyCategory: C; proficiencyLevel: L; usesDef: U }) {
  const proficiencyGrantSchema = withFixedOrChoose(
    grantBaseSchema.safeExtend({
      kind: z.literal('proficiency'),
      category: lists.proficiencyCategory,
      fixed: uniqueList(entityKeySchema).optional(),
      choose: chooseKeysSchema.optional(),
      level: lists.proficiencyLevel.optional(),
    }),
  );
  const resourceGrantSchema = grantBaseSchema.safeExtend({
    kind: z.literal('resource'),
    key: entityKeySchema,
    label: l10nSchema,
    uses: lists.usesDef,
  });
  return [
    entityGrantSchema,
    proficiencyGrantSchema,
    abilityScoreGrantSchema,
    resourceGrantSchema,
  ] as const;
}

/** What an entity gives, and the choices it asks for (SPEC §5.5). */
export const grantSchema = z.discriminatedUnion(
  'kind',
  coreGrantSchemasOf({
    proficiencyCategory: entityKeySchema,
    proficiencyLevel: z.number().positive(),
    usesDef: usesDefSchema,
  }),
);
export type Grant = z.infer<typeof grantSchema>;
