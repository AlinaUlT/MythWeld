import { z } from 'zod';
import { entityBaseSchema, l10nSchema } from './entity-base';
import { formulaSchema } from './formula';
import { entityKeySchema } from './ids';

// ENG-03: the entity types the game-free core owns. Each is the base with `type` fixed and its own
// fields added. `safeExtend` keeps the base's id-matches-type check; `extend` refuses to replace
// `type` on a refined object. Defaults (the modifier formula, a save, a maximum score) are not
// filled in here: they are a system's rules, and parsing adds nothing.

/** A stat, such as `str` or a made-up `san` (SPEC §5.3 `AbilityDef`). */
export const abilityDefSchema = entityBaseSchema.safeExtend({
  type: z.literal('ability'),
  key: entityKeySchema,
  abbr: l10nSchema,
  order: z.int().nonnegative(),
  modFormula: formulaSchema.optional(),
  hasSave: z.boolean().optional(),
  defaultMax: z.int().positive().optional(),
});
export type AbilityDef = z.infer<typeof abilityDefSchema>;

/** A skill, tied to a stat by that stat's key (SPEC §5.3 `SkillDef`). */
export const skillDefSchema = entityBaseSchema.safeExtend({
  type: z.literal('skill'),
  key: entityKeySchema,
  ability: entityKeySchema,
  totalFormula: formulaSchema.optional(),
  passive: z.boolean().optional(),
});
export type SkillDef = z.infer<typeof skillDefSchema>;

/** A condition on a character, with levels when it has them (SPEC §5.3 `ConditionDef`). */
export const conditionDefSchema = entityBaseSchema.safeExtend({
  type: z.literal('condition'),
  maxLevel: z.int().positive().optional(),
});
export type ConditionDef = z.infer<typeof conditionDefSchema>;

/** Any core entity, chosen by its `type`. A module's types join this list in ENG-24. */
export const coreEntitySchema = z.discriminatedUnion('type', [
  abilityDefSchema,
  skillDefSchema,
  conditionDefSchema,
]);
export type CoreEntity = z.infer<typeof coreEntitySchema>;
