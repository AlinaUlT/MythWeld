import type { z } from 'zod';
import { visibleTextSchema } from './entity-base';

/**
 * A formula as it is stored (SPEC §5.6): text such as `floor((@score - 10) / 2)`. ENG-07 parses
 * and evaluates it; here it is only text with a visible character.
 */
export const formulaSchema = visibleTextSchema;
export type Formula = z.infer<typeof formulaSchema>;
