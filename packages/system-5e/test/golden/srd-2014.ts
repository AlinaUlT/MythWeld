import type { z } from 'zod';
import type { fifthEditionEntitySchema, fifthEditionPackSchema } from '../../src/index.ts';

// ENG-09: the SRD 5.1 entities goldens A and C need (SPEC §6.7, ADR 016), written by hand. Every
// value was read from 5e-database at `e6edf9a` (ENG-09 §8); ids keep its slugs, keys are the
// slugs in camelCase. Golden A's sources give all they give at level 1; golden C's classes give
// what every character taking them gets, and no features (ENG-09 §4). Mechanics are written only
// where a golden value reads them; the rest of each feature is its name.

type EntityInput = z.input<typeof fifthEditionEntitySchema>;
type Of<T extends EntityInput['type']> = Extract<EntityInput, { type: T }>;

const source = { pack: 'srd-2014' };
const ruleset = '2014';

/** One number per class level, from level 1. */
type Column = number[];

// --- Stats, skills, languages (`5e-SRD-Ability-Scores.json`, `-Skills.json`, `-Languages.json`)

/** Slug, abbreviation, name: in the SRD's order. */
const STATS: readonly [string, string, string][] = [
  ['str', 'STR', 'Strength'],
  ['dex', 'DEX', 'Dexterity'],
  ['con', 'CON', 'Constitution'],
  ['int', 'INT', 'Intelligence'],
  ['wis', 'WIS', 'Wisdom'],
  ['cha', 'CHA', 'Charisma'],
];

const stats = STATS.map(
  ([slug, abbr, name], order): Of<'ability'> => ({
    id: `srd-2014:ability/${slug}`,
    type: 'ability',
    key: slug,
    ruleset,
    name: { en: name },
    abbr: { en: abbr },
    order,
    source,
  }),
);

/** Slug, key, name, stat, and `true` for the one skill that shows a passive score (§8). */
const SKILLS: readonly [string, string, string, string, true?][] = [
  ['acrobatics', 'acrobatics', 'Acrobatics', 'dex'],
  ['animal-handling', 'animalHandling', 'Animal Handling', 'wis'],
  ['arcana', 'arcana', 'Arcana', 'int'],
  ['athletics', 'athletics', 'Athletics', 'str'],
  ['deception', 'deception', 'Deception', 'cha'],
  ['history', 'history', 'History', 'int'],
  ['insight', 'insight', 'Insight', 'wis'],
  ['intimidation', 'intimidation', 'Intimidation', 'cha'],
  ['investigation', 'investigation', 'Investigation', 'int'],
  ['medicine', 'medicine', 'Medicine', 'wis'],
  ['nature', 'nature', 'Nature', 'int'],
  ['perception', 'perception', 'Perception', 'wis', true],
  ['performance', 'performance', 'Performance', 'cha'],
  ['persuasion', 'persuasion', 'Persuasion', 'cha'],
  ['religion', 'religion', 'Religion', 'int'],
  ['sleight-of-hand', 'sleightOfHand', 'Sleight of Hand', 'dex'],
  ['stealth', 'stealth', 'Stealth', 'dex'],
  ['survival', 'survival', 'Survival', 'wis'],
];

const skills = SKILLS.map(
  ([slug, key, name, ability, passive]): Of<'skill'> => ({
    id: `srd-2014:skill/${slug}`,
    type: 'skill',
    key,
    ruleset,
    name: { en: name },
    ability,
    ...(passive && { passive }),
    source,
  }),
);

/** Slug, key, name: the 8 standard languages, then the 8 exotic ones. */
const LANGUAGES: readonly [string, string, string][] = [
  ['common', 'common', 'Common'],
  ['dwarvish', 'dwarvish', 'Dwarvish'],
  ['elvish', 'elvish', 'Elvish'],
  ['giant', 'giant', 'Giant'],
  ['gnomish', 'gnomish', 'Gnomish'],
  ['goblin', 'goblin', 'Goblin'],
  ['halfling', 'halfling', 'Halfling'],
  ['orc', 'orc', 'Orc'],
  ['abyssal', 'abyssal', 'Abyssal'],
  ['celestial', 'celestial', 'Celestial'],
  ['draconic', 'draconic', 'Draconic'],
  ['deep-speech', 'deepSpeech', 'Deep Speech'],
  ['infernal', 'infernal', 'Infernal'],
  ['primordial', 'primordial', 'Primordial'],
  ['sylvan', 'sylvan', 'Sylvan'],
  ['undercommon', 'undercommon', 'Undercommon'],
];

const languages = LANGUAGES.map(
  ([slug, key, name]): Of<'language'> => ({
    id: `srd-2014:language/${slug}`,
    type: 'language',
    key,
    ruleset,
    name: { en: name },
    source,
  }),
);

/** A feature that is its name only: its mechanics are phase 3's (SPEC §6.8). */
function named(slug: string, name: string): Of<'feature'> {
  return { id: `srd-2014:feature/${slug}`, type: 'feature', ruleset, name: { en: name }, source };
}

// --- The dwarf and the hill dwarf (`5e-SRD-Races.json`, `-Subraces.json`, `-Traits.json`) -----

const dwarf: Of<'species'> = {
  id: 'srd-2014:species/dwarf',
  type: 'species',
  ruleset,
  name: { en: 'Dwarf' },
  source,
  size: ['medium'],
  speed: { walk: 25 },
  // SRD 5.1's dwarf traits: heavy armor does not slow a dwarf. 5e-database's dwarf has only its
  // `speed`; the trait is read from SRD 5.1 as dnd5e quotes it (ENG-45 §8).
  effects: [{ id: 'heavy-armor', target: 'speed.armorReduction', op: 'set', value: 0 }],
  grants: [
    { id: 'ability-scores', kind: 'abilityScore', mode: 'fixed', values: { con: 2 } },
    {
      id: 'traits',
      kind: 'entity',
      fixed: [
        'srd-2014:feature/darkvision',
        'srd-2014:feature/dwarven-resilience',
        'srd-2014:feature/stonecunning',
        'srd-2014:feature/dwarven-combat-training',
        'srd-2014:feature/tool-proficiency',
      ],
    },
    { id: 'languages', kind: 'proficiency', category: 'language', fixed: ['common', 'dwarvish'] },
    { id: 'subrace', kind: 'entity', choose: { count: 1, from: ['srd-2014:lineage/hill-dwarf'] } },
  ],
};

const hillDwarf: Of<'lineage'> = {
  id: 'srd-2014:lineage/hill-dwarf',
  type: 'lineage',
  ruleset,
  name: { en: 'Hill Dwarf' },
  source,
  grants: [
    { id: 'ability-scores', kind: 'abilityScore', mode: 'fixed', values: { wis: 1 } },
    { id: 'traits', kind: 'entity', fixed: ['srd-2014:feature/dwarven-toughness'] },
  ],
};

const dwarfTraits: Of<'feature'>[] = [
  named('darkvision', 'Darkvision'),
  named('dwarven-resilience', 'Dwarven Resilience'),
  named('stonecunning', 'Stonecunning'),
  {
    ...named('dwarven-combat-training', 'Dwarven Combat Training'),
    grants: [
      {
        id: 'weapons',
        kind: 'proficiency',
        category: 'weapon',
        fixed: ['battleaxe', 'handaxe', 'lightHammer', 'warhammer'],
      },
    ],
  },
  {
    ...named('tool-proficiency', 'Tool Proficiency'),
    grants: [
      {
        id: 'tools',
        kind: 'proficiency',
        category: 'tool',
        choose: { count: 1, from: ['smithsTools', 'brewersSupplies', 'masonsTools'] },
      },
    ],
  },
  {
    ...named('dwarven-toughness', 'Dwarven Toughness'),
    // SPEC §5.4's own example: one hit point per level.
    effects: [{ id: 'hit-points', target: 'hp.max.bonus', op: 'add', value: '@level' }],
  },
];

// --- The Acolyte (`5e-SRD-Backgrounds.json`) ----------------------------------------------------

const acolyte: Of<'background'> = {
  id: 'srd-2014:background/acolyte',
  type: 'background',
  ruleset,
  name: { en: 'Acolyte' },
  source,
  grants: [
    { id: 'skills', kind: 'proficiency', category: 'skill', fixed: ['insight', 'religion'] },
    {
      id: 'languages',
      kind: 'proficiency',
      category: 'language',
      choose: { count: 2, from: { type: 'language' } },
    },
    { id: 'feature', kind: 'entity', fixed: ['srd-2014:feature/shelter-of-the-faithful'] },
  ],
};

// --- Classes (`5e-SRD-Classes.json`, `-Levels.json`) -------------------------------------------

/** The cleric's and the wizard's slots of levels 1 to 9, per class level: measured equal. */
const FULL_CASTER_SLOTS: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** The cleric's and the wizard's cantrips known, per class level: measured equal. */
const FULL_CASTER_CANTRIPS: Column = [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

/** The paladin's slots of levels 1 to 5, per class level. */
const PALADIN_SLOTS: number[][] = [
  [],
  [2],
  [3],
  [3],
  [4, 2],
  [4, 2],
  [4, 3],
  [4, 3],
  [4, 3, 2],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

const cleric: Of<'class'> = {
  id: 'srd-2014:class/cleric',
  type: 'class',
  key: 'cleric',
  ruleset,
  name: { en: 'Cleric' },
  source,
  hitDie: 8,
  saves: ['wis', 'cha'],
  subclassLevel: 1,
  spellcasting: {
    ability: 'wis',
    progression: 'full',
    preparation: 'prepared',
    preparedCount: 'max(1, @abilities.wis.mod + @classes.cleric.level)',
    cantripsKnown: FULL_CASTER_CANTRIPS,
    slotsTable: FULL_CASTER_SLOTS,
    spellList: { classKey: 'cleric' },
    ritual: true,
  },
  grants: [
    {
      id: 'features-1',
      kind: 'entity',
      atLevel: 1,
      fixed: [
        'srd-2014:feature/spellcasting-cleric',
        'srd-2014:feature/divine-domain',
        'srd-2014:feature/domain-spells-1',
      ],
    },
    {
      id: 'armor',
      kind: 'proficiency',
      category: 'armor',
      fixed: ['light', 'medium', 'shield'],
    },
    { id: 'weapons', kind: 'proficiency', category: 'weapon', fixed: ['simple'] },
    {
      id: 'skills',
      kind: 'proficiency',
      category: 'skill',
      choose: {
        count: 2,
        from: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
      },
    },
  ],
  multiclass: {
    prerequisites: [{ kind: 'ability', key: 'wis', min: 13 }],
    grants: [
      {
        id: 'multiclass-armor',
        kind: 'proficiency',
        category: 'armor',
        fixed: ['light', 'medium', 'shield'],
      },
    ],
  },
};

const clericFeatures: Of<'feature'>[] = [
  named('spellcasting-cleric', 'Spellcasting: Cleric'),
  named('divine-domain', 'Divine Domain'),
  named('domain-spells-1', 'Domain Spells'),
];

const life: Of<'subclass'> = {
  id: 'srd-2014:subclass/life',
  type: 'subclass',
  key: 'life',
  classKey: 'cleric',
  ruleset,
  name: { en: 'Life' },
  source,
  grants: [
    {
      id: 'features-1',
      kind: 'entity',
      atLevel: 1,
      fixed: ['srd-2014:feature/bonus-proficiency', 'srd-2014:feature/disciple-of-life'],
    },
    {
      id: 'domain-spells-1',
      kind: 'spell',
      atLevel: 1,
      fixed: ['srd-2014:spell/bless', 'srd-2014:spell/cure-wounds'],
      alwaysPrepared: true,
    },
  ],
};

const lifeFeatures: Of<'feature'>[] = [
  {
    ...named('bonus-proficiency', 'Bonus Proficiency'),
    grants: [{ id: 'armor', kind: 'proficiency', category: 'armor', fixed: ['heavy'] }],
  },
  named('disciple-of-life', 'Disciple of Life'),
];

const wizard: Of<'class'> = {
  id: 'srd-2014:class/wizard',
  type: 'class',
  key: 'wizard',
  ruleset,
  name: { en: 'Wizard' },
  source,
  hitDie: 6,
  saves: ['int', 'wis'],
  subclassLevel: 2,
  spellcasting: {
    ability: 'int',
    progression: 'full',
    preparation: 'spellbook',
    preparedCount: 'max(1, @abilities.int.mod + @classes.wizard.level)',
    cantripsKnown: FULL_CASTER_CANTRIPS,
    slotsTable: FULL_CASTER_SLOTS,
    spellList: { classKey: 'wizard' },
    ritual: true,
  },
  grants: [
    {
      id: 'weapons',
      kind: 'proficiency',
      category: 'weapon',
      fixed: ['dagger', 'dart', 'sling', 'quarterstaff', 'crossbowLight'],
    },
    {
      id: 'skills',
      kind: 'proficiency',
      category: 'skill',
      choose: {
        count: 2,
        from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
      },
    },
  ],
  multiclass: { prerequisites: [{ kind: 'ability', key: 'int', min: 13 }] },
};

const paladin: Of<'class'> = {
  id: 'srd-2014:class/paladin',
  type: 'class',
  key: 'paladin',
  ruleset,
  name: { en: 'Paladin' },
  source,
  hitDie: 10,
  saves: ['wis', 'cha'],
  subclassLevel: 3,
  spellcasting: {
    ability: 'cha',
    progression: 'half',
    preparation: 'prepared',
    preparedCount: 'max(1, @abilities.cha.mod + floor(@classes.paladin.level / 2))',
    slotsTable: PALADIN_SLOTS,
    spellList: { classKey: 'paladin' },
  },
  grants: [
    {
      id: 'armor',
      kind: 'proficiency',
      category: 'armor',
      fixed: ['light', 'medium', 'heavy', 'shield'],
    },
    { id: 'weapons', kind: 'proficiency', category: 'weapon', fixed: ['simple', 'martial'] },
    {
      id: 'skills',
      kind: 'proficiency',
      category: 'skill',
      choose: {
        count: 2,
        from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
      },
    },
  ],
  multiclass: {
    prerequisites: [
      { kind: 'ability', key: 'str', min: 13 },
      { kind: 'ability', key: 'cha', min: 13 },
    ],
    grants: [
      {
        id: 'multiclass-armor',
        kind: 'proficiency',
        category: 'armor',
        fixed: ['light', 'medium', 'shield'],
      },
      {
        id: 'multiclass-weapons',
        kind: 'proficiency',
        category: 'weapon',
        fixed: ['simple', 'martial'],
      },
    ],
  },
};

// --- Spells (`5e-SRD-Spells.json`). Neither has damage; Cure Wounds heals, its healing growing
// by slot (`heal_at_slot_level`, "1d8 + MOD" at 1 to "9d8 + MOD" at 9; ENG-53 §8). -------------

const spells: Of<'spell'>[] = [
  {
    id: 'srd-2014:spell/bless',
    type: 'spell',
    ruleset,
    name: { en: 'Bless' },
    source,
    level: 1,
    school: 'enchantment',
    castingTime: { value: 1, unit: 'action' },
    range: { kind: 'distance', distance: 30 },
    components: { v: true, s: true, m: { en: 'A sprinkling of holy water.' } },
    duration: { kind: 'timed', value: 1, unit: 'minute' },
    concentration: true,
    ritual: false,
    classes: ['cleric', 'paladin'],
  },
  {
    id: 'srd-2014:spell/cure-wounds',
    type: 'spell',
    ruleset,
    name: { en: 'Cure Wounds' },
    source,
    level: 1,
    school: 'evocation',
    castingTime: { value: 1, unit: 'action' },
    range: { kind: 'touch' },
    components: { v: true, s: true },
    duration: { kind: 'instant' },
    concentration: false,
    ritual: false,
    classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
    healing: { formula: '1d8 + @mod', kind: 'hp' },
    scaling: { kind: 'slot', formula: '1d8' },
  },
];

// --- Equipment (`5e-SRD-Equipment.json`, `-Damage-Types.json`, `-Weapon-Properties.json`) -----

const items: Of<'item'>[] = [
  {
    id: 'srd-2014:item/chain-mail',
    type: 'item',
    key: 'chainMail',
    ruleset,
    name: { en: 'Chain Mail' },
    source,
    category: 'armor',
    weight: 55,
    cost: { amount: 75, unit: 'gp' },
    armor: {
      group: 'heavy',
      baseAC: 16,
      dexCap: 0,
      strRequirement: 13,
      stealthDisadvantage: true,
    },
  },
  {
    id: 'srd-2014:item/shield',
    type: 'item',
    key: 'shield',
    ruleset,
    name: { en: 'Shield' },
    source,
    category: 'shield',
    weight: 6,
    cost: { amount: 10, unit: 'gp' },
    // SPEC §5.3's own example.
    effects: [{ id: 'armor-class', target: 'ac.bonus', op: 'add', value: 2, when: '@equipped' }],
  },
  {
    id: 'srd-2014:item/warhammer',
    type: 'item',
    key: 'warhammer',
    ruleset,
    name: { en: 'Warhammer' },
    source,
    category: 'weapon',
    weight: 2,
    cost: { amount: 15, unit: 'gp' },
    weapon: {
      group: 'martial',
      kind: 'melee',
      damage: { formula: '1d8', type: 'bludgeoning' },
      versatile: '1d10',
      properties: ['versatile'],
    },
  },
];

const bludgeoning: Of<'damageType'> = {
  id: 'srd-2014:damageType/bludgeoning',
  type: 'damageType',
  key: 'bludgeoning',
  ruleset,
  name: { en: 'Bludgeoning' },
  source,
};

const versatile: Of<'weaponProperty'> = {
  id: 'srd-2014:weaponProperty/versatile',
  type: 'weaponProperty',
  key: 'versatile',
  ruleset,
  name: { en: 'Versatile' },
  source,
};

/** The pack `srd-2014`, as a file would hold it: the SRD 5.1 entities goldens A and C need. */
export const srd2014 = {
  id: 'srd-2014',
  version: '0.1.0',
  schemaVersion: 1,
  system: '5e',
  systemSchemaVersion: 5,
  title: { en: 'SRD 5.1' },
  ruleset,
  // The attribution text is checked against the SRD's legal page by the import (ENG-09 §4).
  license: {
    spdx: 'CC-BY-4.0',
    name: 'Creative Commons Attribution 4.0 International',
    url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    redistributable: true,
  },
  entities: [
    ...stats,
    ...skills,
    ...languages,
    dwarf,
    hillDwarf,
    ...dwarfTraits,
    acolyte,
    named('shelter-of-the-faithful', 'Shelter of the Faithful'),
    cleric,
    ...clericFeatures,
    life,
    ...lifeFeatures,
    wizard,
    paladin,
    ...spells,
    ...items,
    bludgeoning,
    versatile,
  ],
} satisfies z.input<typeof fifthEditionPackSchema>;
