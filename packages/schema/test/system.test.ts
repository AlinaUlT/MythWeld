import {
  entityBaseSchema,
  grantBaseSchema,
  grantSchema,
  prerequisiteSchema,
  systemEntitySchemaOf,
  systemListsOf,
  systemSchemasOf,
} from '@grimoire/schema';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  type TalesEntity,
  talentSchema,
  tales,
  talesEntitySchema,
  talesLists,
} from './tales/index.ts';

// Tales, the made-up test system (ENG-27): two editions, `knack`, `lore` and `craft`
// proficiencies at levels 1–3, uses back each scene or session, a `boon` grant kind, and
// `talent` and `calling` entity types. No real game.

const grit = {
  id: 'tales:ability/grit',
  type: 'ability',
  key: 'grit',
  ruleset: 'any',
  name: { en: 'Grit' },
  abbr: { en: 'GRT' },
  order: 0,
  source: { pack: 'tales' },
};

const talent = {
  id: 'tales:talent/night-warden',
  type: 'talent',
  ruleset: 'first-age',
  name: { en: 'Night Warden' },
  tier: 2,
  source: { pack: 'tales' },
  grants: [
    { id: 'old-lore', kind: 'proficiency', category: 'lore', level: 2, fixed: ['stars'] },
    {
      id: 'luck',
      kind: 'resource',
      key: 'luck',
      label: { en: 'Luck' },
      uses: { max: '1', recovery: [{ on: 'scene', amount: 'all' }] },
    },
    {
      id: 'watch',
      kind: 'boon',
      boon: 'tales:talent/quick-step',
      uses: { max: '2', recovery: [{ on: 'session', amount: '1' }] },
    },
  ],
  prerequisites: [{ kind: 'proficiency', category: 'craft', key: 'rope' }],
};

const calling = {
  id: 'tales:calling/warden',
  type: 'calling',
  key: 'warden',
  ruleset: 'second-age',
  name: { en: 'Warden' },
  die: 8,
  source: { pack: 'tales' },
};

/** `talent` with its grant at `index` changed by `change`. */
function withGrant(index: number, change: Record<string, unknown>) {
  return {
    ...talent,
    grants: talent.grants.map((grant, i) => (i === index ? { ...grant, ...change } : grant)),
  };
}

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

/** Defines lists with `change` applied; the cast lets a wrong list reach the run-time check. */
function listsWith(change: Record<string, unknown>) {
  const lists = {
    editions: ['first-age'],
    proficiencyCategories: ['lore'],
    proficiencyLevels: [1],
    recoveryEvents: ['scene'],
    ...change,
  };
  return () => systemListsOf(lists as unknown as Parameters<typeof systemListsOf>[0]);
}

describe('ENG-24 system schemas', () => {
  it("parses a made-up system's core and own types to equal objects", () => {
    for (const entity of [grit, talent, calling]) {
      expect(talesEntitySchema.parse(entity), entity.id).toEqual(entity);
    }
    expect(talesEntitySchema.options.map((schema) => schema.shape.type.value)).toEqual([
      'ability',
      'skill',
      'condition',
      'talent',
      'calling',
    ]);
  });

  it("takes only the system's editions in `ruleset`, and `any`", () => {
    for (const ruleset of ['first-age', 'second-age', 'any']) {
      expect(issuePaths(talesEntitySchema, { ...grit, ruleset }), ruleset).toEqual([]);
      expect(issuePaths(talesEntitySchema, { ...talent, ruleset }), ruleset).toEqual([]);
    }
    for (const ruleset of ['2014', 'third-age', 'Any']) {
      expect(issuePaths(talesEntitySchema, { ...grit, ruleset }), ruleset).toEqual(['ruleset']);
      expect(issuePaths(talesEntitySchema, { ...talent, ruleset }), ruleset).toEqual(['ruleset']);
    }
  });

  it("takes only the system's proficiency categories and levels", () => {
    expect(issuePaths(talesEntitySchema, withGrant(0, { category: 'craft' }))).toEqual([]);
    expect(issuePaths(talesEntitySchema, withGrant(0, { category: 'skill' }))).toEqual([
      'grants.0.category',
    ]);
    expect(issuePaths(talesEntitySchema, withGrant(0, { level: 3 }))).toEqual([]);
    for (const level of [0.5, 4, 0]) {
      expect(issuePaths(talesEntitySchema, withGrant(0, { level })), String(level)).toEqual([
        'grants.0.level',
      ]);
    }
    expect(
      issuePaths(talesEntitySchema, {
        ...talent,
        prerequisites: [{ kind: 'proficiency', category: 'skill', key: 'rope' }],
      }),
    ).toEqual(['prerequisites.0.category']);
  });

  it("takes only the system's recovery events, in the core's grants and the module's", () => {
    const dawn = { max: '1', recovery: [{ on: 'dawn', amount: 'all' }] };
    expect(issuePaths(talesEntitySchema, withGrant(1, { uses: dawn }))).toEqual([
      'grants.1.uses.recovery.0.on',
    ]);
    expect(issuePaths(talesEntitySchema, withGrant(2, { uses: dawn }))).toEqual([
      'grants.2.uses.recovery.0.on',
    ]);
  });

  it("adds the module's grant kinds, and refuses a kind no one defined", () => {
    expect(tales.grantSchema.parse(talent.grants[2])).toEqual(talent.grants[2]);
    expect(issuePaths(grantSchema, talent.grants[2])).toEqual(['kind']);
    expect(issuePaths(talesEntitySchema, withGrant(2, { kind: 'spell' }))).toEqual([
      'grants.2.kind',
    ]);
  });

  it("keeps the base's checks in the module's types", () => {
    expect(issuePaths(talesEntitySchema, { ...talent, id: 'tales:calling/night-warden' })).toEqual([
      'id',
    ]);
    expect(issuePaths(talesEntitySchema, { ...calling, tier: 1 })).toEqual(['']);
    expect(
      issuePaths(talesEntitySchema, { ...talent, grants: [talent.grants[2], talent.grants[2]] }),
    ).toEqual(['grants.1.id']);
    expect(issuePaths(talesEntitySchema, { ...talent, id: 'tales:feat/x', type: 'feat' })).toEqual([
      'type',
    ]);
  });

  it('refuses lists that cannot be right, naming the list', () => {
    expect(listsWith({})).not.toThrow();
    for (const [change, list] of [
      [{ editions: [] }, 'editions'],
      [{ editions: ['any'] }, 'editions'],
      [{ editions: ['First Age'] }, 'editions'],
      [{ editions: ['first-age', 'first-age'] }, 'editions'],
      [{ proficiencyCategories: ['Lore'] }, 'proficiencyCategories'],
      [{ proficiencyCategories: [] }, 'proficiencyCategories'],
      [{ proficiencyLevels: [0] }, 'proficiencyLevels'],
      [{ proficiencyLevels: [1, 1] }, 'proficiencyLevels'],
      [{ proficiencyLevels: [Number.POSITIVE_INFINITY] }, 'proficiencyLevels'],
      [{ recoveryEvents: ['long-rest'] }, 'recoveryEvents'],
      [{ recoveryEvents: [] }, 'recoveryEvents'],
    ] as const) {
      expect(listsWith(change), JSON.stringify(change)).toThrow(new RegExp(`at ${list}`));
    }
    expect(listsWith({ extra: ['x'] })).toThrow(/extra/);
  });

  it('refuses a grant kind or entity type that is taken, unnamed or not camelCase', () => {
    const kind = (name: string) => grantBaseSchema.safeExtend({ kind: z.literal(name) });
    expect(() => systemSchemasOf(talesLists, [kind('entity')])).toThrow(
      'The grant kind "entity" is given twice.',
    );
    expect(() => systemSchemasOf(talesLists, [kind('boon'), kind('boon')])).toThrow(
      'The grant kind "boon" is given twice.',
    );
    expect(() => systemSchemasOf(talesLists, [kind('Boon')])).toThrow(
      'The grant kind "Boon" is not a camelCase name.',
    );
    expect(() =>
      systemSchemasOf(talesLists, [grantBaseSchema.safeExtend({ kind: z.string() })]),
    ).toThrow('Each grant kind needs a literal `kind`.');

    const type = (name: string) => tales.entityBaseSchema.safeExtend({ type: z.literal(name) });
    expect(() => systemEntitySchemaOf(tales, [type('ability')])).toThrow(
      'The entity type "ability" is given twice.',
    );
    expect(() => systemEntitySchemaOf(tales, [talentSchema, talentSchema])).toThrow(
      'The entity type "talent" is given twice.',
    );
    expect(() => systemEntitySchemaOf(tales, [type('Talent')])).toThrow(
      'The entity type "Talent" is not a camelCase name.',
    );
    expect(() => systemEntitySchemaOf(tales, [tales.entityBaseSchema])).toThrow(
      'Each entity type needs a literal `type`.',
    );
  });

  it("keeps two systems apart, and the core's own schemas open", () => {
    const deepLists = systemListsOf({
      editions: ['deep'],
      proficiencyCategories: ['skill'],
      proficiencyLevels: [0.5, 1],
      recoveryEvents: ['dawn'],
    });
    const deep = systemSchemasOf(deepLists, []);
    const proficiency = (category: string, level: number) => ({
      id: 'p',
      kind: 'proficiency',
      category,
      level,
      fixed: ['x'],
    });
    expect(issuePaths(deep.grantSchema, proficiency('skill', 0.5))).toEqual([]);
    expect(issuePaths(deep.grantSchema, proficiency('lore', 2)).sort()).toEqual([
      'category',
      'level',
    ]);
    expect(issuePaths(tales.grantSchema, proficiency('skill', 0.5)).sort()).toEqual([
      'category',
      'level',
    ]);
    expect(issuePaths(deep.grantSchema, talent.grants[2])).toEqual(['kind']);
    // The core's own schemas check only the shape, as before.
    expect(issuePaths(grantSchema, proficiency('anything', 0.25))).toEqual([]);
    expect(
      issuePaths(prerequisiteSchema, { kind: 'proficiency', category: 'anything', key: 'x' }),
    ).toEqual([]);
    const { tier: _tier, grants: _grants, ...bare } = talent;
    expect(issuePaths(entityBaseSchema, { ...bare, ruleset: 'third-age' })).toEqual([]);
  });

  it("infers the system's types", () => {
    expectTypeOf<TalesEntity['type']>().toEqualTypeOf<
      'ability' | 'skill' | 'condition' | 'talent' | 'calling'
    >();
    expectTypeOf<TalesEntity['ruleset']>().toEqualTypeOf<'first-age' | 'second-age' | 'any'>();
    type TalesGrant = z.infer<typeof tales.grantSchema>;
    expectTypeOf<TalesGrant['kind']>().toEqualTypeOf<
      'entity' | 'proficiency' | 'abilityScore' | 'resource' | 'boon'
    >();
    expectTypeOf<Extract<TalesGrant, { kind: 'proficiency' }>['category']>().toEqualTypeOf<
      'knack' | 'lore' | 'craft'
    >();
    expectTypeOf<Extract<TalesGrant, { kind: 'proficiency' }>['level']>().toEqualTypeOf<
      1 | 2 | 3 | undefined
    >();
    expectTypeOf<
      NonNullable<Extract<TalesGrant, { kind: 'boon' }>['uses']>['recovery'][number]['on']
    >().toEqualTypeOf<'scene' | 'session'>();
    expectTypeOf<Extract<TalesEntity, { type: 'talent' }>['tier']>().toEqualTypeOf<number>();

    // A module type built on the core's open base is a type error: its `ruleset` and `grants`
    // are wider than the system's.
    const openTalent = entityBaseSchema.safeExtend({ type: z.literal('openTalent') });
    // @ts-expect-error -- not built on `tales.entityBaseSchema`
    expect(() => systemEntitySchemaOf(tales, [openTalent])).not.toThrow();
  });

  it('can be exported as JSON Schema, with the lists as enums', () => {
    const schema = z.toJSONSchema(talesEntitySchema) as {
      oneOf: Array<{ additionalProperties?: unknown; properties: Record<string, unknown> }>;
    };
    expect(schema.oneOf).toHaveLength(5);
    for (const option of schema.oneOf) {
      expect(option.additionalProperties).toBe(false);
      expect(option.properties.ruleset).toEqual({
        type: 'string',
        enum: ['first-age', 'second-age', 'any'],
      });
    }
    const grants = z.toJSONSchema(tales.grantSchema) as {
      oneOf: Array<{ properties: Record<string, unknown> }>;
    };
    expect(grants.oneOf).toHaveLength(5);
    expect(grants.oneOf[1]?.properties.category).toEqual({
      type: 'string',
      enum: ['knack', 'lore', 'craft'],
    });
    expect(grants.oneOf[1]?.properties.level).toEqual({ type: 'number', enum: [1, 2, 3] });
  });
});
