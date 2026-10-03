import { MAX_LEVEL } from '../src/index.ts';

// Every entity below is made up for the tests (pack `hb-test`): no name, number or text of a real
// book, so no rules fact is asserted. The shapes are SPEC §5.3's, changed as ENG-32 §4 says.

export const source = { pack: 'hb-test' };

/** A level column: one number per class level. */
export function column(value: number): number[] {
  return Array.from({ length: MAX_LEVEL }, () => value);
}

export const ability = {
  id: 'hb-test:ability/san',
  type: 'ability',
  key: 'san',
  ruleset: 'any',
  name: { en: 'Sanity' },
  abbr: { en: 'SAN' },
  order: 6,
  source,
};

export const skill = {
  id: 'hb-test:skill/composure',
  type: 'skill',
  key: 'composure',
  ability: 'san',
  ruleset: 'any',
  name: { en: 'Composure' },
  source,
};

export const condition = {
  id: 'hb-test:condition/dazzled',
  type: 'condition',
  key: 'dazzled',
  ruleset: '2024',
  name: { en: 'Dazzled' },
  maxLevel: 3,
  source,
};

export const species = {
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

export const lineage = {
  id: 'hb-test:lineage/ember',
  type: 'lineage',
  ruleset: '2024',
  name: { en: 'Ember' },
  source,
  speed: { walk: 35 },
};

export const klass = {
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

export const subclass = {
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

export const background = {
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

export const feat = {
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

export const feature = {
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

export const cantrip = {
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

export const spell = {
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
  healing: { formula: '1d6 + @mod', kind: 'tempHp' },
  scaling: { kind: 'slot', formula: '1d6' },
};

export const weapon = {
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

export const armor = {
  id: 'hb-test:item/glass-coat',
  type: 'item',
  ruleset: '2024',
  name: { en: 'Glass Coat' },
  source,
  category: 'armor',
  weight: 20,
  armor: { group: 'medium', baseAC: 13, dexCap: 2, strRequirement: 11, stealthDisadvantage: true },
};

export const gear = {
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
export function named(type: string, slug: string, key: string) {
  return { id: `hb-test:${type}/${slug}`, type, key, ruleset: 'any', name: { en: slug }, source };
}

export const language = named('language', 'flicker', 'flicker');
export const damageType = named('damageType', 'glare', 'glare');
export const weaponProperty = named('weaponProperty', 'long-haft', 'longHaft');
export const weaponMastery = named('weaponMastery', 'nudge', 'nudge');
export const toolKind = named('toolKind', 'wick-kit', 'wickKit');

export const rule = {
  id: 'hb-test:rule/dim-light',
  type: 'rule',
  ruleset: '2024',
  name: { en: 'Dim Light' },
  source,
  topic: 'environment',
  icon: 'lantern',
};

export const everyEntity = [
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
