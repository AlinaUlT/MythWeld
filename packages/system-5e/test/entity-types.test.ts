import {
  type CharacterCore,
  compute,
  type GatherableEntity,
  loadContentIndex,
  type SystemModule,
} from '@grimoire/engine';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  backgroundDefSchema,
  classDefSchema,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionEntity,
  fifthEdition,
  fifthEditionEntitySchema,
  itemGrantSchema,
  MAX_LEVEL,
  MAX_SPELL_LEVEL,
  spellGrantSchema,
} from '../src/index.ts';

// Every entity below is made up for this test (pack `hb-test`): no name, number or text of a real
// book, so no rules fact is asserted. The shapes are SPEC §5.3's, changed as ENG-32 §4 says.

const source = { pack: 'hb-test' };

/** A level column: one number per class level. */
function column(value: number): number[] {
  return Array.from({ length: MAX_LEVEL }, () => value);
}

const ability = {
  id: 'hb-test:ability/san',
  type: 'ability',
  key: 'san',
  ruleset: 'any',
  name: { en: 'Sanity' },
  abbr: { en: 'SAN' },
  order: 6,
  source,
};

const skill = {
  id: 'hb-test:skill/composure',
  type: 'skill',
  key: 'composure',
  ability: 'san',
  ruleset: 'any',
  name: { en: 'Composure' },
  source,
};

const condition = {
  id: 'hb-test:condition/dazzled',
  type: 'condition',
  key: 'dazzled',
  ruleset: '2024',
  name: { en: 'Dazzled' },
  maxLevel: 3,
  source,
};

const species = {
  id: 'hb-test:species/lantern-folk',
  type: 'species',
  ruleset: '2024',
  name: { en: 'Lantern Folk' },
  source,
  size: ['small', 'medium'],
  speed: { walk: 30, climb: 15 },
  creatureType: 'fey',
  grants: [
    { id: 'traits', kind: 'entity', fixed: ['hb-test:feature/glow'] },
    {
      id: 'lineage',
      kind: 'entity',
      choose: { count: 1, from: ['hb-test:lineage/ember', 'hb-test:lineage/frost'] },
    },
  ],
};

const lineage = {
  id: 'hb-test:lineage/ember',
  type: 'lineage',
  ruleset: '2024',
  name: { en: 'Ember' },
  source,
  speed: { walk: 35 },
};

const klass = {
  id: 'hb-test:class/lamplighter',
  type: 'class',
  key: 'lamplighter',
  ruleset: '2024',
  name: { en: 'Lamplighter' },
  source,
  hitDie: 8,
  primaryAbilities: ['wis'],
  saves: ['wis', 'san'],
  subclassLevel: 3,
  levels: [
    { level: 1, table: { wicks: 2, glowDie: '1d6' } },
    { level: 4, abilityScoreImprovement: true },
  ],
  spellcasting: {
    ability: 'wis',
    progression: 'half',
    preparation: 'prepared',
    preparedCount: column(4),
    cantripsKnown: column(2),
    slotsTable: column(0).map((_, index) => (index === 0 ? [] : [2])),
    spellList: { classKey: 'lamplighter' },
    ritual: true,
  },
  grants: [
    { id: 'first-light', kind: 'entity', atLevel: 1, fixed: ['hb-test:feature/first-light'] },
  ],
  multiclass: {
    prerequisites: [{ kind: 'ability', key: 'wis', min: 13 }],
    grants: [{ id: 'light-armor', kind: 'proficiency', category: 'armor', fixed: ['light'] }],
  },
};

const subclass = {
  id: 'hb-test:subclass/beacon',
  type: 'subclass',
  key: 'beacon',
  classKey: 'lamplighter',
  ruleset: '2024',
  name: { en: 'Beacon' },
  source,
  spellcasting: {
    ability: 'int',
    progression: 'third',
    preparation: 'known',
    preparedCount: '@abilities.int.mod + 1',
    spellsKnown: column(3),
    spellList: { tag: 'beacon' },
  },
  grants: [
    {
      id: 'beacon-spells',
      kind: 'spell',
      atLevel: 3,
      fixed: ['hb-test:spell/lantern-ward'],
      alwaysPrepared: true,
    },
  ],
};

const background = {
  id: 'hb-test:background/tinker',
  type: 'background',
  ruleset: '2024',
  name: { en: 'Tinker' },
  source,
  grants: [
    {
      id: 'stats',
      kind: 'abilityScore',
      mode: 'distribute',
      from: ['int', 'dex', 'san'],
      patterns: [
        [2, 1],
        [1, 1, 1],
      ],
    },
    { id: 'feat', kind: 'entity', fixed: ['hb-test:feat/steady-hands'] },
    {
      id: 'kit',
      kind: 'item',
      fixed: [
        { id: 'hb-test:item/lantern-pole', qty: 1 },
        { id: 'hb-test:item/oil-flask', qty: 3 },
      ],
    },
  ],
};

const feat = {
  id: 'hb-test:feat/steady-hands',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Steady Hands' },
  source,
  category: 'origin',
  repeatable: false,
  grants: [
    {
      id: 'spark',
      kind: 'spell',
      fixed: ['hb-test:spell/ember-spark'],
      ability: 'san',
      uses: { max: '1', recovery: [{ on: 'long', amount: 'all' }] },
    },
  ],
};

const feature = {
  id: 'hb-test:feature/first-light',
  type: 'feature',
  ruleset: '2024',
  name: { en: 'First Light' },
  source,
  activation: 'bonus',
  grants: [
    {
      id: 'wicks',
      kind: 'resource',
      key: 'wicks',
      label: { en: 'Wicks' },
      uses: {
        max: '@classes.lamplighter.table.wicks',
        recovery: [
          { on: 'short', amount: '1' },
          { on: 'long', amount: 'all' },
        ],
      },
    },
  ],
};

const cantrip = {
  id: 'hb-test:spell/ember-spark',
  type: 'spell',
  ruleset: '2024',
  name: { en: 'Ember Spark' },
  source,
  level: 0,
  school: 'glowcraft',
  castingTime: { value: 1, unit: 'action' },
  range: { kind: 'distance', distance: 60 },
  components: { v: true, s: true },
  duration: { kind: 'instant' },
  concentration: false,
  ritual: false,
  classes: ['lamplighter'],
  attack: 'ranged',
  damage: [{ formula: '1d8', type: 'glare' }],
  scaling: { kind: 'cantrip', formula: '1d8' },
};

const spell = {
  id: 'hb-test:spell/lantern-ward',
  type: 'spell',
  ruleset: '2024',
  name: { en: 'Lantern Ward' },
  source,
  level: 2,
  school: 'glowcraft',
  castingTime: { value: 1, unit: 'reaction', note: { en: 'when a light goes out near you' } },
  range: { kind: 'self', area: { shape: 'sphere', size: 10 } },
  components: {
    v: true,
    s: false,
    m: { en: 'a wick' },
    mCost: { amount: 5, unit: 'sp' },
    mConsumed: true,
  },
  duration: { kind: 'timed', value: 10, unit: 'minute' },
  concentration: true,
  ritual: true,
  classes: ['lamplighter'],
  save: 'san',
  damage: [{ formula: '2d6', type: 'glare' }],
  scaling: { kind: 'slot', formula: '1d6' },
};

const weapon = {
  id: 'hb-test:item/lantern-pole',
  type: 'item',
  ruleset: '2024',
  name: { en: 'Lantern Pole' },
  source,
  category: 'weapon',
  weight: 4,
  cost: { amount: 2, unit: 'gp' },
  weapon: {
    group: 'simple',
    kind: 'melee',
    damage: { formula: '1d6', type: 'glare' },
    versatile: '1d8',
    properties: ['longHaft'],
    range: { normal: 20, long: 60 },
    mastery: 'nudge',
  },
  magic: { rarity: 'common', attunement: { en: 'by a lamplighter' }, bonus: 1 },
};

const armor = {
  id: 'hb-test:item/glass-coat',
  type: 'item',
  ruleset: '2024',
  name: { en: 'Glass Coat' },
  source,
  category: 'armor',
  weight: 20,
  armor: { group: 'medium', baseAC: 13, dexCap: 2, strRequirement: 11, stealthDisadvantage: true },
};

const gear = {
  id: 'hb-test:item/oil-flask',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Oil Flask' },
  source,
  category: 'consumable',
  weight: 0.5,
  cost: { amount: 1, unit: 'cp' },
};

/** A simple type's entity: base fields and a key. */
function named(type: string, slug: string, key: string) {
  return { id: `hb-test:${type}/${slug}`, type, key, ruleset: 'any', name: { en: slug }, source };
}

const language = named('language', 'flicker', 'flicker');
const damageType = named('damageType', 'glare', 'glare');
const weaponProperty = named('weaponProperty', 'long-haft', 'longHaft');
const weaponMastery = named('weaponMastery', 'nudge', 'nudge');
const toolKind = named('toolKind', 'wick-kit', 'wickKit');

const rule = {
  id: 'hb-test:rule/dim-light',
  type: 'rule',
  ruleset: '2024',
  name: { en: 'Dim Light' },
  source,
  topic: 'environment',
  icon: 'lantern',
};

const everyEntity = [
  ability,
  skill,
  condition,
  species,
  lineage,
  klass,
  subclass,
  background,
  feat,
  feature,
  cantrip,
  spell,
  weapon,
  armor,
  gear,
  language,
  damageType,
  weaponProperty,
  weaponMastery,
  toolKind,
  rule,
];

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

/** Each unknown field when `value` is parsed: `<path>:<field>`. */
function unknownFields(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => [...issue.path, key].join('.').replace(/^\./, ''))
      : [],
  );
}

/** `entity` with its grant at `index` changed by `change`. */
function withGrant<T extends { grants: readonly object[] }>(
  entity: T,
  index: number,
  change: Record<string, unknown>,
): T {
  return {
    ...entity,
    grants: entity.grants.map((grant, i) => (i === index ? { ...grant, ...change } : grant)),
  };
}

/** `entity` with `field` removed. */
function without<T extends object>(entity: T, field: keyof T & string): Omit<T, typeof field> {
  const { [field]: _, ...rest } = entity;
  return rest;
}

describe('ENG-32 fifth-edition entity types', () => {
  it('parses every type to an equal object, chosen among 18 types', () => {
    for (const entity of everyEntity) {
      expect(fifthEditionEntitySchema.parse(entity), entity.id).toEqual(entity);
    }
    expect(fifthEditionEntitySchema.options.map((schema) => schema.shape.type.value)).toEqual([
      'ability',
      'skill',
      'condition',
      'species',
      'lineage',
      'class',
      'subclass',
      'background',
      'feat',
      'feature',
      'spell',
      'item',
      'language',
      'damageType',
      'weaponProperty',
      'weaponMastery',
      'toolKind',
      'rule',
    ]);
    expect(issuePaths(fifthEditionEntitySchema, { ...rule, type: 'monster' })).toEqual(['type']);
    expect(MAX_LEVEL).toBe(20);
    expect(MAX_SPELL_LEVEL).toBe(9);
  });

  it("takes only fifth edition's editions, proficiencies and recovery events", () => {
    for (const ruleset of ['2014', '2024', 'any']) {
      expect(issuePaths(fifthEditionEntitySchema, { ...klass, ruleset }), ruleset).toEqual([]);
    }
    expect(issuePaths(fifthEditionEntitySchema, { ...klass, ruleset: '2020' })).toEqual([
      'ruleset',
    ]);
    const proficiency = { id: 'p', kind: 'proficiency', category: 'skill', fixed: ['stealth'] };
    for (const category of ['skill', 'save', 'armor', 'weapon', 'tool', 'language']) {
      const entity = { ...feat, grants: [{ ...proficiency, category }] };
      expect(issuePaths(fifthEditionEntitySchema, entity), category).toEqual([]);
    }
    for (const level of [0.5, 1, 2]) {
      const entity = { ...feat, grants: [{ ...proficiency, level }] };
      expect(issuePaths(fifthEditionEntitySchema, entity), String(level)).toEqual([]);
    }
    expect(
      issuePaths(fifthEditionEntitySchema, {
        ...feat,
        grants: [{ ...proficiency, category: 'feat' }],
      }),
    ).toEqual(['grants.0.category']);
    expect(
      issuePaths(fifthEditionEntitySchema, { ...feat, grants: [{ ...proficiency, level: 3 }] }),
    ).toEqual(['grants.0.level']);
    for (const on of ['short', 'long', 'dawn', 'turn', 'manual']) {
      const uses = { max: '1', recovery: [{ on, amount: 'all' }] };
      expect(issuePaths(fifthEditionEntitySchema, withGrant(feat, 0, { uses })), on).toEqual([]);
    }
    const scene = { max: '1', recovery: [{ on: 'scene', amount: 'all' }] };
    expect(issuePaths(fifthEditionEntitySchema, withGrant(feat, 0, { uses: scene }))).toEqual([
      'grants.0.uses.recovery.0.on',
    ]);
    expect(issuePaths(fifthEditionEntitySchema, withGrant(feature, 0, { uses: scene }))).toEqual([
      'grants.0.uses.recovery.0.on',
    ]);
    expect(
      issuePaths(fifthEdition.prerequisiteSchema, {
        kind: 'proficiency',
        category: 'lore',
        key: 'stars',
      }),
    ).toEqual(['category']);
  });

  it('gives spells by list or choice, with their stat and own uses', () => {
    const grant = feat.grants[0];
    expect(spellGrantSchema.parse(grant)).toEqual(grant);
    const chosen = {
      id: 'pick',
      kind: 'spell',
      atLevel: 2,
      choose: { count: 2, from: { type: 'spell', tag: 'glow' } },
    };
    expect(spellGrantSchema.parse(chosen)).toEqual(chosen);
    expect(issuePaths(spellGrantSchema, { id: 'pick', kind: 'spell' })).toEqual(['']);
    expect(issuePaths(spellGrantSchema, { ...grant, ability: ['int', 'wis'] })).toEqual([
      'ability',
    ]);
    // `choice` is no word of the schema: it passes only as a stat's key, like `san`.
    expect(issuePaths(spellGrantSchema, { ...grant, ability: 'choice' })).toEqual([]);
    expect(issuePaths(spellGrantSchema, { ...grant, fixed: [] })).toEqual(['fixed']);
    expect(issuePaths(spellGrantSchema, { ...grant, alwaysPrepared: 'yes' })).toEqual([
      'alwaysPrepared',
    ]);
    expect(unknownFields(spellGrantSchema, { ...grant, slot: false })).toEqual(['slot']);
  });

  it('gives items by list, with how many, or by choice', () => {
    const grant = background.grants[2];
    expect(itemGrantSchema.parse(grant)).toEqual(grant);
    const chosen = { id: 'kit', kind: 'item', choose: { count: 1, from: { category: 'tool' } } };
    expect(itemGrantSchema.parse(chosen)).toEqual(chosen);
    const pole = { id: 'hb-test:item/lantern-pole', qty: 1 };
    expect(issuePaths(itemGrantSchema, { ...chosen, choose: undefined })).toEqual(['']);
    expect(issuePaths(itemGrantSchema, { ...grant, fixed: [] })).toEqual(['fixed']);
    expect(issuePaths(itemGrantSchema, { ...grant, fixed: [{ ...pole, qty: 0 }] })).toEqual([
      'fixed.0.qty',
    ]);
    expect(issuePaths(itemGrantSchema, { ...grant, fixed: [pole, { ...pole, qty: 2 }] })).toEqual([
      'fixed.1.id',
    ]);
    expect(unknownFields(itemGrantSchema, { ...grant, fixed: [{ ...pole, note: 'x' }] })).toEqual([
      'fixed.0.note',
    ]);
    expect(
      issuePaths(fifthEditionEntitySchema, withGrant(background, 2, { kind: 'loot' })),
    ).toEqual(['grants.2.kind']);
  });

  it('refuses each SPEC field that a grant already says', () => {
    const cases: [object, string][] = [
      [
        { ...klass, levels: [{ level: 1, features: ['hb-test:feature/first-light'] }] },
        'levels.0.features',
      ],
      [{ ...subclass, levels: [{ level: 3, features: [] }] }, 'levels'],
      [{ ...subclass, alwaysPrepared: [{ level: 3, spells: [] }] }, 'alwaysPrepared'],
      [{ ...species, traits: ['hb-test:feature/glow'] }, 'traits'],
      [{ ...species, lineages: ['hb-test:lineage/ember'] }, 'lineages'],
      [{ ...background, abilityOptions: ['int', 'dex', 'san'] }, 'abilityOptions'],
      [{ ...background, originFeat: 'hb-test:feat/steady-hands' }, 'originFeat'],
      [{ ...background, feature: 'hb-test:feature/glow' }, 'feature'],
      [{ ...feature, origin: { kind: 'class', id: klass.id, level: 1 } }, 'origin'],
      [{ ...feature, uses: { max: '1', recovery: [{ on: 'long', amount: 'all' }] } }, 'uses'],
    ];
    for (const [entity, field] of cases) {
      expect(unknownFields(fifthEditionEntitySchema, entity), field).toEqual([field]);
    }
  });

  it('files a rule under a topic, with an optional icon', () => {
    expect(fifthEditionEntitySchema.parse(without(rule, 'icon'))).toEqual(without(rule, 'icon'));
    expect(issuePaths(fifthEditionEntitySchema, without(rule, 'topic'))).toEqual(['topic']);
    expect(issuePaths(fifthEditionEntitySchema, { ...rule, topic: 'Environment' })).toEqual([
      'topic',
    ]);
    expect(issuePaths(fifthEditionEntitySchema, { ...rule, icon: 'big lantern' })).toEqual([
      'icon',
    ]);
  });

  it("ties a spell's scaling to its level", () => {
    const slot = { kind: 'slot', formula: '1d8' };
    expect(issuePaths(fifthEditionEntitySchema, { ...cantrip, scaling: slot })).toEqual([
      'scaling.kind',
    ]);
    const byLevel = { kind: 'cantrip', formula: '1d6' };
    expect(issuePaths(fifthEditionEntitySchema, { ...spell, scaling: byLevel })).toEqual([
      'scaling.kind',
    ]);
    expect(issuePaths(fifthEditionEntitySchema, { ...spell, level: 9 })).toEqual([]);
    expect(
      issuePaths(fifthEditionEntitySchema, { ...cantrip, scaling: { kind: 'cantrip' } }),
    ).toEqual(['scaling.formula']);
    expect(issuePaths(fifthEditionEntitySchema, without(cantrip, 'scaling'))).toEqual([]);
  });

  it('keeps hit dice, levels, spell levels and level columns to their bounds', () => {
    for (const hitDie of [6, 8, 10, 12]) {
      expect(issuePaths(classDefSchema, { ...klass, hitDie }), String(hitDie)).toEqual([]);
    }
    for (const hitDie of [4, 7, 20]) {
      expect(issuePaths(classDefSchema, { ...klass, hitDie }), String(hitDie)).toEqual(['hitDie']);
    }
    for (const level of [0, 21, 1.5]) {
      const levels = [{ level, table: { wicks: 1 } }];
      expect(issuePaths(classDefSchema, { ...klass, levels }), String(level)).toEqual([
        'levels.0.level',
      ]);
      expect(issuePaths(classDefSchema, { ...klass, subclassLevel: level })).toEqual([
        'subclassLevel',
      ]);
    }
    for (const level of [-1, 10, 0.5]) {
      expect(issuePaths(fifthEditionEntitySchema, { ...spell, level }), String(level)).toEqual([
        'level',
      ]);
    }
    const short = { ...klass.spellcasting, cantripsKnown: column(2).slice(1) };
    expect(issuePaths(classDefSchema, { ...klass, spellcasting: short })).toEqual([
      'spellcasting.cantripsKnown',
    ]);
    const tooManySlots = {
      ...klass.spellcasting,
      slotsTable: column(0).map(() => column(1).slice(0, 10)),
    };
    expect(issuePaths(classDefSchema, { ...klass, spellcasting: tooManySlots })[0]).toBe(
      'spellcasting.slotsTable.0',
    );
    const preparedRow = { ...klass.spellcasting, preparedCount: [1, 2] };
    expect(issuePaths(classDefSchema, { ...klass, spellcasting: preparedRow })).toEqual([
      'spellcasting.preparedCount',
    ]);
  });

  it('refuses an entry whose parts contradict each other', () => {
    const refusals: [object, string][] = [
      [{ ...cantrip, range: { kind: 'distance' } }, 'range.distance'],
      [{ ...cantrip, range: { kind: 'touch', distance: 5 } }, 'range.distance'],
      [{ ...cantrip, duration: { kind: 'timed', value: 1 } }, 'duration'],
      [{ ...cantrip, duration: { kind: 'instant', unit: 'round' } }, 'duration'],
      [
        { ...spell, components: { v: true, s: true, mCost: { amount: 1, unit: 'gp' } } },
        'components',
      ],
      [{ ...spell, components: { v: true, s: true, mConsumed: true } }, 'components'],
      [{ ...gear, weapon: weapon.weapon }, 'weapon'],
      [without(weapon, 'weapon'), 'weapon'],
      [{ ...weapon, armor: armor.armor }, 'armor'],
      [without(armor, 'armor'), 'armor'],
      [
        { ...weapon, weapon: { ...weapon.weapon, range: { normal: 60, long: 20 } } },
        'weapon.range.long',
      ],
      [
        { ...klass, levels: [{ level: 4, table: { wicks: 3 } }, ...klass.levels] },
        'levels.2.level',
      ],
      [
        {
          ...klass,
          multiclass: { grants: [{ ...klass.multiclass.grants[0], id: 'first-light' }] },
        },
        'multiclass.grants.0.id',
      ],
      [{ ...species, speed: {} }, 'speed'],
      [
        { ...klass, spellcasting: { ...klass.spellcasting, spellList: {} } },
        'spellcasting.spellList',
      ],
      [{ ...klass, multiclass: {} }, 'multiclass'],
    ];
    for (const [entity, path] of refusals) {
      expect(issuePaths(fifthEditionEntitySchema, entity), path).toEqual([path]);
    }
    // Each part alone is enough, and a list that may be empty is left out instead.
    expect(
      issuePaths(fifthEditionEntitySchema, {
        ...klass,
        multiclass: { grants: klass.multiclass.grants },
      }),
    ).toEqual([]);
    const plain = { ...weapon.weapon, properties: undefined, damage: undefined };
    expect(issuePaths(fifthEditionEntitySchema, { ...weapon, weapon: plain })).toEqual([]);
    expect(
      issuePaths(fifthEditionEntitySchema, {
        ...weapon,
        weapon: { ...weapon.weapon, properties: [] },
      }),
    ).toEqual(['weapon.properties']);
    expect(issuePaths(fifthEditionEntitySchema, { ...klass, levels: [] })).toEqual(['levels']);
    expect(issuePaths(fifthEditionEntitySchema, { ...spell, damage: [] })).toEqual(['damage']);
    expect(
      issuePaths(fifthEditionEntitySchema, { ...klass, multiclass: { prerequisites: [] } }),
    ).toEqual(['multiclass.prerequisites']);
    expect(
      issuePaths(fifthEditionEntitySchema, { ...armor, armor: { ...armor.armor, dexCap: null } }),
    ).toEqual([]);
    expect(issuePaths(fifthEditionEntitySchema, { ...species, creatureType: undefined })).toEqual(
      [],
    );
    expect(issuePaths(fifthEditionEntitySchema, { ...klass, primaryAbilities: undefined })).toEqual(
      [],
    );
  });

  it('needs the key other entities name a class, subclass or simple type by', () => {
    for (const entity of [
      klass,
      subclass,
      language,
      damageType,
      weaponProperty,
      weaponMastery,
      toolKind,
    ]) {
      expect(issuePaths(fifthEditionEntitySchema, without(entity, 'key')), entity.type).toEqual([
        'key',
      ]);
    }
    for (const entity of [species, background, feat, feature, spell, gear, rule]) {
      expect(issuePaths(fifthEditionEntitySchema, entity), entity.type).toEqual([]);
    }
    expect(issuePaths(backgroundDefSchema, { ...background, id: 'hb-test:feat/tinker' })).toEqual([
      'id',
    ]);
  });

  it('is read by the core: a spell choice is pending, then passes through', () => {
    expectTypeOf<FifthEditionEntity>().toExtend<GatherableEntity>();
    const curious = fifthEditionEntitySchema.parse({
      id: 'hb-test:feat/curious-mind',
      type: 'feat',
      ruleset: '2024',
      name: { en: 'Curious Mind' },
      source,
      grants: [{ id: 'pick', kind: 'spell', choose: { count: 1, from: { type: 'spell' } } }],
    });
    const entities = [
      ...everyEntity.map((entity) => fifthEditionEntitySchema.parse(entity)),
      curious,
    ];
    const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, [
      { id: 'hb-test', version: '1.0.0', system: FIFTH_EDITION_SYSTEM, entities },
    ]);
    const character: CharacterCore<FifthEditionEntity> = {
      ruleset: '2024',
      allowMixedRulesets: false,
      abilities: { base: { san: 10 } },
      choices: {},
      state: { conditions: [], toggles: {} },
      overrides: [],
      localEntities: [],
    };
    // Only gathering is under test: the module names the feat, and no stat or value is computed.
    const system: SystemModule<CharacterCore<FifthEditionEntity>, FifthEditionEntity> = {
      level: () => 1,
      entities: () => [{ id: curious.id }],
      statDefaults: { defaultMax: 1, modFormula: '0', hasSave: false },
      derive: () => ({}),
    };

    const pending = compute(character, index, system);
    expect(pending.pendingChoices.map((choice) => [choice.part, choice.options])).toEqual([
      ['hb-test:feat/curious-mind#pick', [cantrip.id, spell.id]],
    ]);

    const chosen = compute(
      { ...character, choices: { 'hb-test:feat/curious-mind#pick': [spell.id] } },
      index,
      system,
    );
    expect(chosen.pendingChoices).toEqual([]);
    expect(chosen.grants.map((grant) => [grant.part, grant.grant.kind, grant.chosen])).toEqual([
      ['hb-test:feat/curious-mind#pick', 'spell', [spell.id]],
    ]);
    expect(chosen.entities.map((had) => had.entity.id)).toEqual([curious.id]);
    expect(chosen.warnings).toEqual([]);
  });

  it('types the union by its lists', () => {
    expectTypeOf<FifthEditionEntity['type']>().toEqualTypeOf<
      | 'ability'
      | 'skill'
      | 'condition'
      | 'species'
      | 'lineage'
      | 'class'
      | 'subclass'
      | 'background'
      | 'feat'
      | 'feature'
      | 'spell'
      | 'item'
      | 'language'
      | 'damageType'
      | 'weaponProperty'
      | 'weaponMastery'
      | 'toolKind'
      | 'rule'
    >();
    expectTypeOf<FifthEditionEntity['ruleset']>().toEqualTypeOf<'2014' | '2024' | 'any'>();
    type Grant = NonNullable<FifthEditionEntity['grants']>[number];
    expectTypeOf<Grant['kind']>().toEqualTypeOf<
      'entity' | 'proficiency' | 'abilityScore' | 'resource' | 'spell' | 'item'
    >();
    expectTypeOf<Extract<Grant, { kind: 'proficiency' }>['level']>().toEqualTypeOf<
      0.5 | 1 | 2 | undefined
    >();
    expectTypeOf<Extract<FifthEditionEntity, { type: 'class' }>['hitDie']>().toEqualTypeOf<
      6 | 8 | 10 | 12
    >();
  });

  it('exports a JSON Schema with one strict option per type', () => {
    const json = z.toJSONSchema(fifthEditionEntitySchema) as unknown as {
      oneOf: { additionalProperties: unknown; properties: { ruleset: { enum: unknown } } }[];
    };
    expect(json.oneOf).toHaveLength(18);
    for (const option of json.oneOf) {
      expect(option.additionalProperties).toBe(false);
      expect(option.properties.ruleset.enum).toEqual(['2014', '2024', 'any']);
    }
  });
});
