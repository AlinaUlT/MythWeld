import { z } from 'zod';
import { formulaSchema } from './formula';
import { entityIdSchema, entityKeySchema } from './ids';
import { l10nSchema, visibleTextSchema } from './text';

/** Prerequisites whose proficiency categories are checked by `proficiencyCategory`. */
export function prerequisiteSchemaOf<C extends z.ZodType<string>>(proficiencyCategory: C) {
  return z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('ability'), key: entityKeySchema, min: z.int() }),
    z.strictObject({ kind: z.literal('level'), min: z.int().positive() }),
    z.strictObject({ kind: z.literal('entity'), id: entityIdSchema }),
    z.strictObject({
      kind: z.literal('proficiency'),
      category: proficiencyCategory,
      key: entityKeySchema,
    }),
    z.strictObject({ kind: z.literal('formula'), formula: formulaSchema, label: l10nSchema }),
    // CONT-05: the character has an entity of this name in any language, as SRD 5.2.1's four
    // fighting style feats ask for a "Fighting Style" feature and Boon of Spell Recall for
    // "Spellcasting".
    z.strictObject({ kind: z.literal('featureNamed'), name: visibleTextSchema }),
  ]);
}

/** What an entity asks of a character (SPEC §5.5). Unmet, it gives a warning, never a block. */
export const prerequisiteSchema = prerequisiteSchemaOf(entityKeySchema);
export type Prerequisite = z.infer<typeof prerequisiteSchema>;
