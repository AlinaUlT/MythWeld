import { z } from 'zod';
import { formulaSchema } from './formula';
import { computedPathSchema, slugSchema } from './ids';
import { l10nSchema, visibleTextSchema } from './text';

/** When an effect applies (SPEC §6.1): with stat scores, with derived values, or last. */
export const effectPhaseSchema = z.enum(['base', 'derived', 'final']);
export type EffectPhase = z.infer<typeof effectPhaseSchema>;

/** What an effect does to its target (SPEC §5.4). What a roll does with `advantage` is a module's. */
export const effectOpSchema = z.enum([
  'add',
  'mul',
  'set',
  'max',
  'min',
  'append',
  'advantage',
  'disadvantage',
  'note',
]);
export type EffectOp = z.infer<typeof effectOpSchema>;

const numberOrFormulaSchema = z.union([z.number(), formulaSchema]);

/** The fields of an effect, whatever its op. */
const effectFields = {
  id: slugSchema,
  target: computedPathSchema,
  phase: effectPhaseSchema.optional(),
  priority: z.int().optional(),
  when: formulaSchema.optional(),
  situational: l10nSchema.optional(),
  toggle: z.strictObject({ label: l10nSchema, default: z.boolean() }).optional(),
  label: l10nSchema.optional(),
};

/** Passive mechanics of an entity (SPEC §5.4). `value` is checked against `op`. */
export const effectSchema = z.discriminatedUnion('op', [
  z.strictObject({
    ...effectFields,
    op: effectOpSchema.extract(['add', 'mul', 'max', 'min']),
    value: numberOrFormulaSchema,
  }),
  z.strictObject({
    ...effectFields,
    op: z.literal('set'),
    value: z.union([z.number(), z.boolean(), visibleTextSchema]),
  }),
  z.strictObject({ ...effectFields, op: z.literal('append'), value: visibleTextSchema }),
  z.strictObject({
    ...effectFields,
    op: effectOpSchema.extract(['advantage', 'disadvantage']),
    value: z.literal(true),
  }),
  z.strictObject({ ...effectFields, op: z.literal('note'), value: l10nSchema }),
]);
export type Effect = z.infer<typeof effectSchema>;
