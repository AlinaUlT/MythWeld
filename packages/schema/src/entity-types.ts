import { z } from 'zod';
import { entityBaseSchema, type entityBaseSchemaOf } from './entity-base';
import { formulaSchema } from './formula';
import { recoverySchemaOf } from './grant';
import { entityKeySchema } from './ids';
import { l10nSchema } from './text';

// ENG-03: the entity types the game-free core owns. Each is the base with `type` fixed and its own
// fields added. `safeExtend` keeps the base's id-matches-type check; `extend` refuses to replace
// `type` on a refined object. Defaults (the modifier formula, a save, a maximum score) are not
// filled in here: they are a system's rules, and parsing adds nothing.

/**
 * The core's types on a system's base, so every system has them, with its own lists:
 * `recoveryEvent` checks a condition's recovery events.
 */
export function coreEntitySchemasOf<
  R extends z.ZodType<string>,
  G extends z.ZodType<{ id: string }>,
  P extends z.ZodType,
  V extends z.ZodType<string>,
>(base: ReturnType<typeof entityBaseSchemaOf<R, G, P>>, recoveryEvent: V) {
  /** A stat, such as `str` or a made-up `san` (SPEC §5.3 `AbilityDef`). */
  const abilityDefSchema = base.safeExtend({
    type: z.literal('ability'),
    key: entityKeySchema,
    abbr: l10nSchema,
    order: z.int().nonnegative(),
    modFormula: formulaSchema.optional(),
    hasSave: z.boolean().optional(),
    defaultMax: z.int().positive().optional(),
  });
  /** A skill, tied to a stat by that stat's key (SPEC §5.3 `SkillDef`). */
  const skillDefSchema = base.safeExtend({
    type: z.literal('skill'),
    key: entityKeySchema,
    ability: entityKeySchema,
    totalFormula: formulaSchema.optional(),
    passive: z.boolean().optional(),
  });
  /**
   * A condition on a character, with levels when it has them (SPEC §5.3 `ConditionDef`).
   * ENG-61: `recovery`, the levels each recovery event takes away (`all`: every one); at level 0
   * the condition ends.
   */
  const conditionDefSchema = base.safeExtend({
    type: z.literal('condition'),
    maxLevel: z.int().positive().optional(),
    recovery: recoverySchemaOf(recoveryEvent).optional(),
  });
  return [abilityDefSchema, skillDefSchema, conditionDefSchema] as const;
}

export const [abilityDefSchema, skillDefSchema, conditionDefSchema] = coreEntitySchemasOf(
  entityBaseSchema,
  entityKeySchema,
);
export type AbilityDef = z.infer<typeof abilityDefSchema>;
export type SkillDef = z.infer<typeof skillDefSchema>;
export type ConditionDef = z.infer<typeof conditionDefSchema>;

/** Any core entity, chosen by its `type`. A system's union is `systemEntitySchemaOf`'s. */
export const coreEntitySchema = z.discriminatedUnion('type', [
  abilityDefSchema,
  skillDefSchema,
  conditionDefSchema,
]);
export type CoreEntity = z.infer<typeof coreEntitySchema>;
