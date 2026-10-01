import { z } from 'zod';
import { effectSchema } from './effect';
import { grantSchema } from './grant';
import {
  entityIdSchema,
  entityKeySchema,
  entityTypeNameSchema,
  packIdSchema,
  parseEntityId,
  rulesetIdSchema,
} from './ids';
import { prerequisiteSchema } from './prerequisite';
import { l10nSchema, visibleTextSchema } from './text';

/** Who translated the entity's texts (SPEC §5.2: four values, not the three of §3.3). */
export const translationSchema = z.enum(['official', 'community', 'machine', 'reviewed']);
export type Translation = z.infer<typeof translationSchema>;

/** A link a person opens themselves: http or https only, never `javascript:`. */
const linkSchema = z.url({ protocol: /^https?$/, hostname: z.regexes.domain });

/** Where an entity comes from (SPEC §5.2, widened by ADR 003 item A2). */
export const entitySourceSchema = z.strictObject({
  pack: packIdSchema,
  page: visibleTextSchema.optional(),
  book: visibleTextSchema.optional(),
  author: visibleTextSchema.optional(),
  license: visibleTextSchema.optional(),
  links: z.array(linkSchema).optional(),
});
export type EntitySource = z.infer<typeof entitySourceSchema>;

/** Notes about the entity. No other tool's fields: `foundry` moved out (ADR 003 item A1). */
export const entityMetaSchema = z.strictObject({
  translation: translationSchema.optional(),
  variantOf: entityIdSchema.optional(),
  manual: z.boolean().optional(),
});
export type EntityMeta = z.infer<typeof entityMetaSchema>;

/** A list whose items' ids differ; a repeat is reported on the later item's `id`. */
function listWithUniqueIds<T extends z.ZodType<{ id: string }>>(item: T) {
  return z.array(item).superRefine((list, ctx) => {
    const seen = new Set<string>();
    for (const [index, entry] of list.entries()) {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `The id "${entry.id}" is used twice.`,
        });
      }
      seen.add(entry.id);
    }
  });
}

/** The base of a system's entities: its editions, its grant kinds, its prerequisites. */
export function entityBaseSchemaOf<
  R extends z.ZodType<string>,
  G extends z.ZodType<{ id: string }>,
  P extends z.ZodType,
>(parts: { ruleset: R; grant: G; prerequisite: P }) {
  return z
    .strictObject({
      id: entityIdSchema,
      type: entityTypeNameSchema,
      key: entityKeySchema.optional(),
      ruleset: parts.ruleset,
      name: l10nSchema,
      aliases: z.array(l10nSchema).optional(),
      summary: l10nSchema.optional(),
      text: l10nSchema.optional(),
      tags: z.array(visibleTextSchema).optional(),
      source: entitySourceSchema,
      effects: listWithUniqueIds(effectSchema).optional(),
      grants: listWithUniqueIds(parts.grant).optional(),
      prerequisites: z.array(parts.prerequisite).optional(),
      meta: entityMetaSchema.optional(),
    })
    .superRefine((entity, ctx) => {
      const parts = parseEntityId(entity.id);
      if (parts !== undefined && parts.type !== entity.type) {
        ctx.addIssue({
          code: 'custom',
          path: ['id'],
          message: `The id names type "${parts.type}", but the entity's type is "${entity.type}".`,
        });
      }
    });
}

// ENG-02: the fields every entity has. Objects are strict, so an unknown field is refused rather
// than dropped; the id's type part must equal `type`. ENG-03 extends this; a system's base is
// built by `entityBaseSchemaOf` with its own lists (`system.ts`).
export const entityBaseSchema = entityBaseSchemaOf({
  ruleset: rulesetIdSchema,
  grant: grantSchema,
  prerequisite: prerequisiteSchema,
});
export type EntityBase = z.infer<typeof entityBaseSchema>;
