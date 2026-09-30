import { z } from 'zod';
import { formulaSchema } from './formula';
import { entityIdSchema, entityKeySchema } from './ids';
import { l10nSchema } from './text';

/** What an entity asks of a character (SPEC §5.5). Unmet, it gives a warning, never a block. */
export const prerequisiteSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('ability'), key: entityKeySchema, min: z.int() }),
  z.strictObject({ kind: z.literal('level'), min: z.int().positive() }),
  z.strictObject({ kind: z.literal('entity'), id: entityIdSchema }),
  z.strictObject({
    kind: z.literal('proficiency'),
    category: entityKeySchema,
    key: entityKeySchema,
  }),
  z.strictObject({ kind: z.literal('formula'), formula: formulaSchema, label: l10nSchema }),
]);
export type Prerequisite = z.infer<typeof prerequisiteSchema>;
