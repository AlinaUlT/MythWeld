import { z } from 'zod';

/** Text that shows something: not empty, not only spaces. */
export const visibleTextSchema = z.string().regex(/\S/, 'Must hold a visible character.');

export const localeSchema = z.enum(['en', 'ru']);
export type Locale = z.infer<typeof localeSchema>;

/** One text in each language it is known in; at least one (SPEC §5.2). */
export const l10nSchema = z
  .partialRecord(localeSchema, visibleTextSchema)
  .refine((text) => Object.keys(text).length > 0, 'Needs at least one language.');
export type L10n = z.infer<typeof l10nSchema>;
