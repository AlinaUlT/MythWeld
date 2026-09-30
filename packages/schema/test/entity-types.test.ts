import {
  type AbilityDef,
  abilityDefSchema,
  type ConditionDef,
  conditionDefSchema,
  coreEntitySchema,
  entityTypeNameSchema,
  type SkillDef,
  skillDefSchema,
} from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Made-up entities; the only real names are the stat names `str` and `san` of SPEC §5.3.
const str: AbilityDef = {
  id: 'tales:ability/str',
  type: 'ability',
  key: 'str',
  ruleset: 'any',
  name: { en: 'Strength', ru: 'Сила' },
  abbr: { en: 'STR', ru: 'СИЛ' },
  order: 0,
  source: { pack: 'tales' },
};

const san: AbilityDef = {
  id: 'hb-local:ability/san',
  type: 'ability',
  key: 'san',
  ruleset: 'any',
  name: { en: 'Sanity', ru: 'Рассудок' },
  abbr: { en: 'SAN' },
  order: 6,
  modFormula: 'floor(@score / 3)',
  hasSave: false,
  defaultMax: 30,
  source: { pack: 'hb-local' },
};

const nerves: SkillDef = {
  id: 'hb-local:skill/nerves',
  type: 'skill',
  key: 'nerves',
  ability: 'san',
  ruleset: 'first-age',
  name: { en: 'Nerves' },
  totalFormula: '@abilities.san.mod + 1',
  passive: true,
  source: { pack: 'hb-local' },
};

const dazed: ConditionDef = {
  id: 'tales:condition/dazed',
  type: 'condition',
  ruleset: 'any',
  name: { en: 'Dazed' },
  maxLevel: 3,
  source: { pack: 'tales' },
};

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('ENG-03 core entity types', () => {
  it('parses each type to an equal object, with no default filled in', () => {
    expect(abilityDefSchema.parse(str)).toEqual(str);
    expect(abilityDefSchema.parse(san)).toEqual(san);
    expect(skillDefSchema.parse(nerves)).toEqual(nerves);
    expect(conditionDefSchema.parse(dazed)).toEqual(dazed);
    expect(Object.keys(abilityDefSchema.parse(str)).sort()).toEqual(Object.keys(str).sort());
  });

  it('treats a custom stat exactly like a standard one', () => {
    const { id: _id, key: _key, ...sameFields } = str;
    for (const key of ['str', 'san', 'grit']) {
      expect(
        issuePaths(abilityDefSchema, { ...sameFields, id: `tales:ability/${key}`, key }),
        key,
      ).toEqual([]);
    }
  });

  it('checks the fields of an ability', () => {
    const { key: _k, abbr: _a, order: _o, ...bare } = str;
    expect(issuePaths(abilityDefSchema, bare).sort()).toEqual(['abbr', 'key', 'order']);
    for (const [field, value] of [
      ['key', 'Str'],
      ['abbr', {}],
      ['abbr', 'STR'],
      ['order', -1],
      ['order', 1.5],
      ['modFormula', ''],
      ['modFormula', '   '],
      ['hasSave', 'yes'],
      ['defaultMax', 0],
      ['defaultMax', 20.5],
    ] as const) {
      const paths = issuePaths(abilityDefSchema, { ...str, [field]: value });
      expect(paths[0], `${field}=${String(value)}`).toMatch(new RegExp(`^${field}`));
    }
  });

  it('checks the fields of a skill', () => {
    const { ability: _a, ...noAbility } = nerves;
    expect(issuePaths(skillDefSchema, noAbility)).toEqual(['ability']);
    const { key: _k, ...noKey } = nerves;
    expect(issuePaths(skillDefSchema, noKey)).toEqual(['key']);
    for (const ability of ['San', 'sleight-of-hand', '']) {
      expect(issuePaths(skillDefSchema, { ...nerves, ability }), ability).toEqual(['ability']);
    }
    expect(issuePaths(skillDefSchema, { ...nerves, totalFormula: ' ' })).toEqual(['totalFormula']);
    expect(issuePaths(skillDefSchema, { ...nerves, passive: 1 })).toEqual(['passive']);
  });

  it('checks the levels of a condition', () => {
    const { maxLevel: _m, ...noLevels } = dazed;
    expect(issuePaths(conditionDefSchema, noLevels)).toEqual([]);
    for (const maxLevel of [0, -1, 1.5, '3']) {
      expect(issuePaths(conditionDefSchema, { ...dazed, maxLevel }), String(maxLevel)).toEqual([
        'maxLevel',
      ]);
    }
  });

  it('keeps the base checks: the id names the type, unknown fields are refused', () => {
    expect(issuePaths(abilityDefSchema, { ...str, id: 'tales:skill/str' })).toEqual(['id']);
    expect(issuePaths(skillDefSchema, { ...nerves, abbr: { en: 'NRV' } })).toEqual(['']);
    expect(issuePaths(conditionDefSchema, { ...dazed, name: {} })[0]).toMatch(/^name/);
  });

  it('picks the schema by type, and refuses a type the core does not own', () => {
    for (const entity of [str, san, nerves, dazed]) {
      expect(coreEntitySchema.parse(entity)).toEqual(entity);
    }
    expect(
      issuePaths(coreEntitySchema, { ...dazed, id: 'tales:feat/dazed', type: 'feat' }),
    ).toEqual(['type']);
    expect(
      issuePaths(coreEntitySchema, { ...str, type: 'skill', id: 'tales:skill/str' }).sort(),
    ).toEqual(['', 'ability']);
  });

  it('names each type as an entity id can', () => {
    for (const schema of coreEntitySchema.options) {
      expect(entityTypeNameSchema.safeParse(schema.shape.type.value).success).toBe(true);
    }
    expect(coreEntitySchema.options.map((schema) => schema.shape.type.value)).toEqual([
      'ability',
      'skill',
      'condition',
    ]);
  });

  it('can be exported as JSON Schema', () => {
    const schema = z.toJSONSchema(coreEntitySchema) as {
      oneOf: Array<{ additionalProperties?: unknown; required?: string[] }>;
    };
    expect(schema.oneOf).toHaveLength(3);
    for (const option of schema.oneOf) expect(option.additionalProperties).toBe(false);
    expect([...(schema.oneOf[0]?.required ?? [])].sort()).toEqual([
      'abbr',
      'id',
      'key',
      'name',
      'order',
      'ruleset',
      'source',
      'type',
    ]);
  });
});
