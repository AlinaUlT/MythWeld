import {
  coreEntitySchema,
  type Effect,
  type EntityBase,
  effectOpSchema,
  effectSchema,
  entityBaseSchema,
  type Grant,
  grantSchema,
  type Prerequisite,
  prerequisiteSchema,
  usesDefSchema,
} from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Appendix Д's feat, its grant and its effect as the SPEC writes them (the owner's homebrew).
const appendixGrant = {
  id: 'occult-prof',
  kind: 'proficiency',
  category: 'skill',
  fixed: ['occultism'],
};
const appendixEffect = {
  id: 'int-plus-1',
  target: 'abilities.int.score',
  op: 'add',
  value: 1,
  label: { ru: 'Знаток тайного', en: 'Arcane Scholar' },
};

// A made-up game: stats grit, nerve and wits, a `lore` proficiency, uses back each scene.
const effects: Effect[] = [
  {
    id: 'steady',
    target: 'abilities.grit.score',
    op: 'add',
    value: '@classes.warden.level',
    phase: 'base',
    priority: -1,
    when: '@level >= 2',
    label: { en: 'Steady' },
  },
  { id: 'twice', target: 'resources.luck.max', op: 'mul', value: 2 },
  { id: 'floor', target: 'senses.dark', op: 'max', value: 30 },
  { id: 'ceiling', target: 'crit.range', op: 'min', value: 19 },
  { id: 'swap', target: 'skills.nerves.ability', op: 'set', value: 'wits' },
  { id: 'flag', target: 'armor.worn', op: 'set', value: false, phase: 'final' },
  { id: 'rust', target: 'defenses.resist', op: 'append', value: 'rust' },
  {
    id: 'keen',
    target: 'roll.skill.nerves',
    op: 'advantage',
    value: true,
    situational: { en: 'Against fear', ru: 'Против страха' },
  },
  {
    id: 'frenzy',
    target: 'roll.check.wits',
    op: 'disadvantage',
    value: true,
    toggle: { label: { en: 'Frenzy' }, default: false },
  },
  { id: 'hint', target: 'init.bonus', op: 'note', value: { en: 'Acts first in the dark.' } },
];

const grants: Grant[] = [
  {
    id: 'gifts',
    kind: 'entity',
    atLevel: 3,
    fixed: ['tales:talent/quick-step'],
    choose: { count: 1, from: { type: 'talent', tag: 'wild', category: 'origin' } },
  },
  {
    id: 'old-lore',
    kind: 'proficiency',
    category: 'lore',
    level: 3,
    choose: { count: 2, from: ['beasts', 'stars', 'rivers'] },
  },
  { id: 'hardy', kind: 'abilityScore', mode: 'fixed', values: { grit: 1, nerve: -1 } },
  {
    id: 'growth',
    kind: 'abilityScore',
    mode: 'distribute',
    from: ['grit', 'nerve', 'wits'],
    patterns: [[3], [2, 1]],
  },
  {
    id: 'luck',
    kind: 'resource',
    key: 'luck',
    label: { en: 'Luck', ru: 'Удача' },
    uses: {
      max: '@abilities.wits.mod + 1',
      recovery: [
        { on: 'scene', amount: '1' },
        { on: 'session', amount: 'all' },
      ],
    },
  },
];

const prerequisites: Prerequisite[] = [
  { kind: 'ability', key: 'grit', min: 13 },
  { kind: 'level', min: 4 },
  { kind: 'entity', id: 'tales:talent/quick-step' },
  { kind: 'proficiency', category: 'lore', key: 'stars' },
  { kind: 'formula', formula: '@abilities.wits.score >= 12', label: { en: 'Wits 12' } },
];

const talent: EntityBase = {
  id: 'tales:talent/night-warden',
  type: 'talent',
  ruleset: 'any',
  name: { en: 'Night Warden' },
  source: { pack: 'tales' },
  effects,
  grants,
  prerequisites,
};

const anEffect = { id: 'e', target: 'init.bonus' };

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('ENG-04 effects, grants, prerequisites', () => {
  it("parses Appendix Д's grant and effect to equal objects", () => {
    expect(grantSchema.parse(appendixGrant)).toEqual(appendixGrant);
    expect(effectSchema.parse(appendixEffect)).toEqual(appendixEffect);
    const feat = {
      id: 'hb-local:feat/arcane-scholar',
      type: 'feat',
      ruleset: 'any',
      name: { ru: 'Знаток тайного', en: 'Arcane Scholar' },
      source: { pack: 'hb-local' },
      grants: [appendixGrant],
      effects: [appendixEffect],
    };
    expect(entityBaseSchema.parse(feat)).toEqual(feat);
  });

  it('parses a made-up game to an equal object, with nothing added', () => {
    expect(entityBaseSchema.parse(talent)).toEqual(talent);
    for (const effect of effects) {
      expect(Object.keys(effectSchema.parse(effect)).sort(), effect.id).toEqual(
        Object.keys(effect).sort(),
      );
    }
    for (const grant of grants) {
      expect(Object.keys(grantSchema.parse(grant)).sort(), grant.id).toEqual(
        Object.keys(grant).sort(),
      );
    }
    const shaken = {
      id: 'tales:condition/shaken',
      type: 'condition',
      ruleset: 'any',
      name: { en: 'Shaken' },
      maxLevel: 3,
      source: { pack: 'tales' },
      effects: [{ id: 'shake', target: 'd20.all.bonus', op: 'add', value: '-1 * @self.level' }],
    };
    expect(coreEntitySchema.parse(shaken)).toEqual(shaken);
  });

  it('accepts a target of camelCase steps joined by dots', () => {
    for (const target of ['abilities.san.score', 'd20.all.bonus', 'init.bonus', 'speed']) {
      expect(
        issuePaths(effectSchema, { ...anEffect, target, op: 'add', value: 1 }),
        target,
      ).toEqual([]);
    }
    for (const target of [
      '',
      '.score',
      'score.',
      'abilities..score',
      'abilities.San.score',
      'abilities.*.score',
      'abilities.san-x.score',
      'abilities.1st.score',
    ]) {
      expect(
        issuePaths(effectSchema, { ...anEffect, target, op: 'add', value: 1 }),
        target,
      ).toEqual(['target']);
    }
  });

  it('checks the fields of an effect', () => {
    expect(issuePaths(effectSchema, { op: 'add', value: 1 }).sort()).toEqual(['id', 'target']);
    expect(issuePaths(effectSchema, { ...anEffect, op: 'add' })).toEqual(['value']);
    for (const [field, value] of [
      ['id', 'Steady'],
      ['id', 'a#b'],
      ['phase', 'late'],
      ['priority', 1.5],
      ['when', ' '],
      ['situational', {}],
      ['situational', 'Against fear'],
      ['toggle', { label: { en: 'On' } }],
      ['toggle', { default: true }],
      ['label', {}],
    ] as const) {
      const paths = issuePaths(effectSchema, { ...anEffect, op: 'add', value: 1, [field]: value });
      expect(paths[0], `${field}=${JSON.stringify(value)}`).toMatch(new RegExp(`^${field}`));
    }
  });

  it('takes exactly the nine ops of SPEC §5.4', () => {
    expect(effectOpSchema.options).toEqual([
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
    for (const op of ['upgrade', 'Add', 'override', '']) {
      expect(issuePaths(effectSchema, { ...anEffect, op, value: 1 }), op).toEqual(['op']);
    }
  });

  it('checks the value against the op', () => {
    const passes: Array<[string, unknown]> = [
      ['add', -2],
      ['add', '@prof'],
      ['mul', 0.5],
      ['max', 60],
      ['min', '@abilities.grit.mod'],
      ['set', 3],
      ['set', true],
      ['set', 'wits'],
      ['append', 'rust'],
      ['append', '10 + @abilities.grit.mod'],
      ['advantage', true],
      ['disadvantage', true],
      ['note', { en: 'A note' }],
    ];
    for (const [op, value] of passes) {
      expect(issuePaths(effectSchema, { ...anEffect, op, value }), `${op} ${value}`).toEqual([]);
    }
    expect(new Set(passes.map(([op]) => op))).toEqual(new Set(effectOpSchema.options));
    const refused: Array<[string, unknown]> = [
      ['add', true],
      ['add', Number.POSITIVE_INFINITY],
      ['add', Number.NaN],
      ['add', ''],
      ['mul', { en: 'x' }],
      ['max', false],
      ['set', '  '],
      ['set', null],
      ['append', 3],
      ['append', true],
      ['append', ''],
      ['advantage', false],
      ['advantage', 'yes'],
      ['disadvantage', 1],
      ['note', 'Plain text'],
      ['note', {}],
    ];
    for (const [op, value] of refused) {
      const paths = issuePaths(effectSchema, { ...anEffect, op, value });
      expect(paths[0], `${op} ${String(value)}`).toMatch(/^value/);
    }
  });

  it('gives entities or proficiencies, fixed, chosen or both', () => {
    const entity = { id: 'g', kind: 'entity' };
    const proficiency = { id: 'g', kind: 'proficiency', category: 'lore' };
    expect(issuePaths(grantSchema, { ...entity, fixed: ['tales:talent/a'] })).toEqual([]);
    expect(issuePaths(grantSchema, { ...proficiency, fixed: ['stars'], level: 0.5 })).toEqual([]);
    expect(issuePaths(grantSchema, entity)).toEqual(['']);
    expect(issuePaths(grantSchema, proficiency)).toEqual(['']);
    expect(issuePaths(grantSchema, { ...entity, fixed: [] })).toEqual(['fixed']);
    expect(
      issuePaths(grantSchema, { ...entity, fixed: ['tales:talent/a', 'tales:talent/a'] }),
    ).toEqual(['fixed']);
    expect(issuePaths(grantSchema, { ...entity, fixed: ['stars'] })).toEqual(['fixed.0']);
    expect(issuePaths(grantSchema, { ...proficiency, fixed: ['tales:talent/a'] })).toEqual([
      'fixed.0',
    ]);
    const { category: _c, ...noCategory } = proficiency;
    expect(issuePaths(grantSchema, { ...noCategory, fixed: ['stars'] })).toEqual(['category']);
    for (const level of [0, -1, '1']) {
      expect(
        issuePaths(grantSchema, { ...proficiency, fixed: ['stars'], level }),
        String(level),
      ).toEqual(['level']);
    }
  });

  it('checks a choice', () => {
    const grant = (choose: unknown) => ({ id: 'g', kind: 'proficiency', category: 'lore', choose });
    expect(issuePaths(grantSchema, grant({ count: 2, from: ['a', 'b'] }))).toEqual([]);
    expect(issuePaths(grantSchema, grant({ count: 1, from: { type: 'skill' } }))).toEqual([]);
    for (const [choose, path] of [
      [{ count: 0, from: ['a'] }, 'choose.count'],
      [{ count: 1.5, from: ['a', 'b'] }, 'choose.count'],
      [{ count: 3, from: ['a', 'b'] }, 'choose.count'],
      [{ count: 1, from: [] }, 'choose.from'],
      [{ count: 1, from: ['a', 'a'] }, 'choose.from'],
      [{ count: 1, from: {} }, 'choose.from'],
      [{ count: 1, from: { category: 'Origin' } }, 'choose.from.category'],
      [{ count: 1, from: { tag: 'wild', kind: 'feat' } }, 'choose.from'],
      [{ count: 1, from: ['tales:talent/a'] }, 'choose.from.0'],
      [{ from: ['a'] }, 'choose.count'],
      [{ count: 1, from: ['a'], pick: 1 }, 'choose'],
    ] as const) {
      const paths = issuePaths(grantSchema, grant(choose));
      expect(paths[0], JSON.stringify(choose)).toBe(path);
    }
    expect(
      issuePaths(grantSchema, {
        id: 'g',
        kind: 'entity',
        choose: { count: 1, from: ['stars'] },
      })[0],
    ).toBe('choose.from');
  });

  it('increases stats by fixed values or by patterns', () => {
    const fixed = { id: 'g', kind: 'abilityScore', mode: 'fixed' };
    const distribute = {
      id: 'g',
      kind: 'abilityScore',
      mode: 'distribute',
      from: ['grit', 'wits'],
    };
    expect(issuePaths(grantSchema, { ...fixed, values: { grit: 2, san: -1 } })).toEqual([]);
    expect(issuePaths(grantSchema, { ...distribute, patterns: [[2], [1, 1]] })).toEqual([]);
    for (const [grant, path] of [
      [{ ...fixed, values: {} }, 'values'],
      [{ ...fixed, values: { grit: 0 } }, 'values.grit'],
      [{ ...fixed, values: { grit: 1.5 } }, 'values.grit'],
      [{ ...fixed, values: { Grit: 1 } }, 'values.Grit'],
      [fixed, 'values'],
      [{ ...distribute, from: [], patterns: [[1]] }, 'from'],
      [{ ...distribute, from: ['grit', 'grit'], patterns: [[1]] }, 'from'],
      [{ ...distribute, patterns: [] }, 'patterns'],
      [{ ...distribute, patterns: [[]] }, 'patterns.0'],
      [{ ...distribute, patterns: [[0]] }, 'patterns.0.0'],
      [{ ...distribute, patterns: [[1, 1, 1]] }, 'patterns'],
      [{ ...fixed, mode: 'split', values: { grit: 1 } }, 'mode'],
    ] as const) {
      expect(issuePaths(grantSchema, grant)[0], JSON.stringify(grant)).toBe(path);
    }
  });

  it('gives a resource with its uses', () => {
    const luck = grants[4];
    expect(issuePaths(grantSchema, luck)).toEqual([]);
    const { uses: _u, ...noUses } = luck as Extract<Grant, { kind: 'resource' }>;
    expect(issuePaths(grantSchema, noUses)).toEqual(['uses']);
    for (const [uses, path] of [
      [{ max: '', recovery: [{ on: 'scene', amount: 'all' }] }, 'max'],
      [{ max: '2', recovery: [] }, 'recovery'],
      [{ max: '2', recovery: [{ on: 'Scene', amount: 'all' }] }, 'recovery.0.on'],
      [{ max: '2', recovery: [{ on: 'short-rest', amount: 'all' }] }, 'recovery.0.on'],
      [{ max: '2', recovery: [{ on: 'scene', amount: ' ' }] }, 'recovery.0.amount'],
      [{ max: '2', recovery: [{ on: 'scene' }] }, 'recovery.0.amount'],
      [{ max: 2, recovery: [{ on: 'scene', amount: 'all' }] }, 'max'],
      [{ max: '2', recovery: [{ on: 'scene', amount: 'all', at: 'dusk' }] }, 'recovery.0'],
    ] as const) {
      expect(issuePaths(usesDefSchema, uses)[0], JSON.stringify(uses)).toBe(path);
    }
  });

  it('refuses a grant kind the core does not own, and a bad id or level', () => {
    for (const kind of ['feat', 'feature', 'spell', 'item', 'Entity']) {
      expect(issuePaths(grantSchema, { id: 'g', kind, fixed: ['tales:talent/a'] }), kind).toEqual([
        'kind',
      ]);
    }
    const entity = { id: 'g', kind: 'entity', fixed: ['tales:talent/a'] };
    for (const id of ['Gifts', 'a#b', '', 'a--b']) {
      expect(issuePaths(grantSchema, { ...entity, id }), id).toEqual(['id']);
    }
    for (const atLevel of [0, 1.5, '3']) {
      expect(issuePaths(grantSchema, { ...entity, atLevel }), String(atLevel)).toEqual(['atLevel']);
    }
  });

  it('checks each prerequisite kind', () => {
    for (const prerequisite of prerequisites) {
      expect(prerequisiteSchema.parse(prerequisite)).toEqual(prerequisite);
    }
    for (const [prerequisite, paths] of [
      [{ kind: 'ability', key: 'grit', min: 13.5 }, ['min']],
      [{ kind: 'ability', key: 'Grit', min: 13 }, ['key']],
      [{ kind: 'level', min: 0 }, ['min']],
      [{ kind: 'entity', id: 'quick-step' }, ['id']],
      [{ kind: 'proficiency', category: 'lore', id: 'stars' }, ['', 'key']],
      [{ kind: 'formula', formula: '@level > 1' }, ['label']],
      [{ kind: 'formula', formula: '', label: { en: 'x' } }, ['formula']],
      [{ kind: 'class', id: 'tales:class/warden' }, ['kind']],
      [{ kind: 'level', min: 2, max: 5 }, ['']],
    ] as const) {
      expect(
        issuePaths(prerequisiteSchema, prerequisite).sort(),
        JSON.stringify(prerequisite),
      ).toEqual(paths);
    }
  });

  it('refuses an id used twice in one list, not across lists', () => {
    const twice = { ...appendixEffect, target: 'abilities.wis.score' };
    expect(issuePaths(entityBaseSchema, { ...talent, effects: [appendixEffect, twice] })).toEqual([
      'effects.1.id',
    ]);
    expect(
      issuePaths(entityBaseSchema, {
        ...talent,
        grants: [...grants, { ...grants[0], atLevel: 5 }],
      }),
    ).toEqual(['grants.5.id']);
    expect(
      issuePaths(entityBaseSchema, {
        ...talent,
        effects: [{ ...appendixEffect, id: 'luck' }],
        grants,
      }),
    ).toEqual([]);
  });

  it('refuses a field it does not name, in every object', () => {
    for (const [schema, values] of [
      [effectSchema, effects],
      [grantSchema, grants],
      [prerequisiteSchema, prerequisites],
    ] as const) {
      for (const value of values) {
        expect(issuePaths(schema, { ...value, extra: 1 }), JSON.stringify(value)).toEqual(['']);
      }
    }
    const add = { ...anEffect, op: 'add', value: 1 };
    for (const [schema, value, path] of [
      [
        effectSchema,
        { ...add, toggle: { label: { en: 'On' }, default: true, sticky: true } },
        'toggle',
      ],
      [grantSchema, { ...appendixGrant, qty: 1 }, ''],
      [grantSchema, { ...grants[2], from: ['grit'] }, ''],
      [prerequisiteSchema, { kind: 'entity', id: 'tales:talent/a', note: 'x' }, ''],
    ] as const) {
      expect(issuePaths(schema, value), JSON.stringify(value)).toEqual([path]);
    }
  });

  it('can be exported as JSON Schema', () => {
    type Node = { oneOf?: Node[]; additionalProperties?: unknown; properties?: object };
    const objectOptions = (node: Node): Node[] =>
      node.oneOf ? node.oneOf.flatMap(objectOptions) : [node];
    const effect = z.toJSONSchema(effectSchema) as Node;
    const grant = z.toJSONSchema(grantSchema) as Node;
    const prerequisite = z.toJSONSchema(prerequisiteSchema) as Node;
    expect(objectOptions(effect)).toHaveLength(5);
    expect(objectOptions(grant)).toHaveLength(5);
    expect(objectOptions(prerequisite)).toHaveLength(5);
    for (const option of [effect, grant, prerequisite].flatMap(objectOptions)) {
      expect(option.additionalProperties).toBe(false);
    }
    const base = z.toJSONSchema(entityBaseSchema) as Node;
    expect(Object.keys(base.properties ?? {})).toEqual(
      expect.arrayContaining(['effects', 'grants', 'prerequisites']),
    );
  });
});
