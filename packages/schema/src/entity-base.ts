import { z } from 'zod';
import {
  entityIdSchema,
  entityKeySchema,
  entityTypeNameSchema,
  packIdSchema,
  parseEntityId,
  rulesetIdSchema,
} from './ids';

/** Text that shows something: not empty, not only spaces. */
const visibleTextSchema = z.string().regex(/\S/, 'Must hold a visible character.');

export const localeSchema = z.enum(['en', 'ru']);
export type Locale = z.infer<typeof localeSchema>;

/** One text in each language it is known in; at least one (SPEC §5.2). */
export const l10nSchema = z
  .partialRecord(localeSchema, visibleTextSchema)
  .refine((text) => Object.keys(text).length > 0, 'Needs at least one language.');
export type L10n = z.infer<typeof l10nSchema>;

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

// ENG-02: the fields every entity has. Objects are strict, so an unknown field is refused rather
// than dropped; the id's type part must equal `type`. ENG-03 and ENG-24 extend this.
export const entityBaseSchema = z
  .strictObject({
    id: entityIdSchema,
    type: entityTypeNameSchema,
    key: entityKeySchema.optional(),
    ruleset: rulesetIdSchema,
    name: l10nSchema,
    aliases: z.array(l10nSchema).optional(),
    summary: l10nSchema.optional(),
    text: l10nSchema.optional(),
    tags: z.array(visibleTextSchema).optional(),
    source: entitySourceSchema,
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
export type EntityBase = z.infer<typeof entityBaseSchema>;
