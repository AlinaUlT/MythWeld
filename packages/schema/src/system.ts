import { z } from 'zod';
import { entityBaseSchemaOf } from './entity-base';
import { coreEntitySchemasOf } from './entity-types';
import { coreGrantSchemasOf, type UsesDef, uniqueList, usesDefSchemaOf } from './grant';
import { entityKeySchema, entityTypeNameSchema, rulesetIdSchema, systemIdSchema } from './ids';
import { prerequisiteSchemaOf } from './prerequisite';

// ENG-24: a system module adds its grant kinds and entity types to the core's schemas, and gives
// the lists the core checks only for shape. Three steps, each needing the one before: the lists
// (a module's grant kind may use the system's `usesDefSchema`); the base, built with every grant
// kind, since `safeExtend` cannot widen `grants`; the union by `type`, the module's types built on
// that base. A name the union already has is refused when the system is defined, not at parse.

type List<T> = readonly [T, ...T[]];

/** A module's grant kind: built on `grantBaseSchema`, with a literal `kind`. */
export type GrantKindSchema = z.ZodType<{ id: string; kind: string }> &
  z.core.$ZodTypeDiscriminable;

const systemListsSchema = z.strictObject({
  editions: uniqueList(
    rulesetIdSchema.refine((edition) => edition !== 'any', '`any` is not an edition.'),
  ),
  proficiencyCategories: uniqueList(entityKeySchema),
  proficiencyLevels: uniqueList(z.number().positive()),
  recoveryEvents: uniqueList(entityKeySchema),
});

/** A version of a stored shape: a whole number from 1. */
export const schemaVersionSchema = z.int().positive();

/**
 * Throws when a system's id is not kebab-case, or the version of its module's shape is not a whole
 * number from 1. The pack's and the character's schemas are built only after this check.
 */
export function checkSystemIdAndVersion(parts: {
  system: string;
  systemSchemaVersion: number;
}): void {
  if (!systemIdSchema.safeParse(parts.system).success) {
    throw new Error(`The system id "${parts.system}" is not kebab-case.`);
  }
  if (!schemaVersionSchema.safeParse(parts.systemSchemaVersion).success) {
    throw new Error(
      `The system's schema version ${parts.systemSchemaVersion} is not a whole number from 1.`,
    );
  }
}

/**
 * A system's editions (`ruleset`, with `any`; `edition`, without it, for a character's one rules
 * base), proficiency categories and levels, and recovery events, as schemas. Throws when a list is
 * empty, holds an item twice, or holds an item of the wrong shape.
 */
export function systemListsOf<
  const E extends List<string>,
  const C extends List<string>,
  const L extends List<number>,
  const R extends List<string>,
>(lists: { editions: E; proficiencyCategories: C; proficiencyLevels: L; recoveryEvents: R }) {
  const checked = systemListsSchema.safeParse(lists);
  if (!checked.success) {
    throw new Error(`The system's lists are refused:\n${z.prettifyError(checked.error)}`);
  }
  const recoveryEventSchema = z.enum(lists.recoveryEvents);
  return {
    rulesetSchema: z.enum([...lists.editions, 'any']),
    editionSchema: z.enum(lists.editions),
    proficiencyCategorySchema: z.enum(lists.proficiencyCategories),
    proficiencyLevelSchema: z.literal(lists.proficiencyLevels),
    recoveryEventSchema,
    usesDefSchema: usesDefSchemaOf(recoveryEventSchema),
  };
}

/** Throws when an option's discriminator is missing, not camelCase, or already taken. */
function checkNames(
  options: readonly z.core.SomeType[],
  discriminator: 'kind' | 'type',
  what: string,
  pattern: z.ZodType<string>,
): void {
  const taken = new Set<unknown>();
  for (const option of options) {
    const values = option._zod.propValues?.[discriminator];
    if (values === undefined || values.size === 0) {
      throw new Error(`Each ${what} needs a literal \`${discriminator}\`.`);
    }
    for (const value of values) {
      if (!pattern.safeParse(value).success) {
        throw new Error(`The ${what} "${String(value)}" is not a camelCase name.`);
      }
      if (taken.has(value)) throw new Error(`The ${what} "${String(value)}" is given twice.`);
      taken.add(value);
    }
  }
}

/**
 * A system's grants, prerequisites, entity base and core types, with its lists. `grantKinds` are
 * the module's own kinds, added to the core's.
 */
export function systemSchemasOf<
  R extends z.ZodType<string>,
  C extends z.ZodType<string>,
  L extends z.ZodType<number>,
  E extends z.ZodType<string>,
  U extends z.ZodType<UsesDef>,
  const K extends readonly GrantKindSchema[],
>(
  lists: {
    rulesetSchema: R;
    proficiencyCategorySchema: C;
    proficiencyLevelSchema: L;
    recoveryEventSchema: E;
    usesDefSchema: U;
  },
  grantKinds: K,
) {
  const options = [
    ...coreGrantSchemasOf({
      proficiencyCategory: lists.proficiencyCategorySchema,
      proficiencyLevel: lists.proficiencyLevelSchema,
      usesDef: lists.usesDefSchema,
    }),
    ...grantKinds,
  ] as const;
  checkNames(options, 'kind', 'grant kind', entityKeySchema);
  const grantSchema = z.discriminatedUnion('kind', options);
  const prerequisiteSchema = prerequisiteSchemaOf(lists.proficiencyCategorySchema);
  const entityBaseSchema = entityBaseSchemaOf({
    ruleset: lists.rulesetSchema,
    grant: grantSchema,
    prerequisite: prerequisiteSchema,
  });
  const [abilityDefSchema, skillDefSchema, conditionDefSchema] = coreEntitySchemasOf(
    entityBaseSchema,
    lists.recoveryEventSchema,
  );
  return {
    rulesetSchema: lists.rulesetSchema,
    proficiencyCategorySchema: lists.proficiencyCategorySchema,
    proficiencyLevelSchema: lists.proficiencyLevelSchema,
    recoveryEventSchema: lists.recoveryEventSchema,
    usesDefSchema: lists.usesDefSchema,
    grantSchema,
    prerequisiteSchema,
    entityBaseSchema,
    abilityDefSchema,
    skillDefSchema,
    conditionDefSchema,
  };
}

/**
 * Any entity of a system, chosen by its `type`: the core's types and `entityTypes`, the module's
 * own, each built on the system's `entityBaseSchema`.
 */
export function systemEntitySchemaOf<
  B extends z.ZodType<{ type: string }>,
  A extends z.core.$ZodTypeDiscriminable,
  S extends z.core.$ZodTypeDiscriminable,
  D extends z.core.$ZodTypeDiscriminable,
  const T extends readonly (z.ZodType<z.output<B>> & z.core.$ZodTypeDiscriminable)[],
>(
  schemas: { entityBaseSchema: B; abilityDefSchema: A; skillDefSchema: S; conditionDefSchema: D },
  entityTypes: T,
) {
  const options = [
    schemas.abilityDefSchema,
    schemas.skillDefSchema,
    schemas.conditionDefSchema,
    ...entityTypes,
  ] as const;
  checkNames(options, 'type', 'entity type', entityTypeNameSchema);
  return z.discriminatedUnion('type', options);
}
