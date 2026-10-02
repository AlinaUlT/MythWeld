import type { z } from 'zod';
import type { fifthEditionEntitySchema, fifthEditionPackSchema } from '../../src/index.ts';

// ENG-10: the SRD 5.2.1 entities goldens B, B4, C and D need (SPEC §6.7), written by hand. Every
// value was read from 5e-database at `e6edf9a`, and from dnd5e at `7bfb3f1` where 5e-database is
// silent (ENG-10 §8); ids keep 5e-database's slugs, keys are the slugs in camelCase (ENG-09 §4).
// The fighter gives all it gives to level 4 (golden B4); golden C's classes give what every
// character taking them gets, and no features. Mechanics are written only where a golden value
// reads them, each as SPEC §5.4's catalogue writes it; the rest of each feature is its name.

type EntityInput = z.input<typeof fifthEditionEntitySchema>;
type Of<T extends EntityInput['type']> = Extract<EntityInput, { type: T }>;

const source = { pack: 'srd-2024' };
const ruleset = '2024';

// --- Stats and skills (`5e-SRD-Ability-Scores.json`, `-Skills.json`) --------------------------

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
    id: `srd-2024:ability/${slug}`,
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
    id: `srd-2024:skill/${slug}`,
    type: 'skill',
    key,
    ruleset,
    name: { en: name },
    ability,
    ...(passive && { passive }),
    source,
  }),
);

/** A feature that is its name only: its mechanics are phase 3's (SPEC §6.8). */
function named(slug: string, name: string): Of<'feature'> {
  return { id: `srd-2024:feature/${slug}`, type: 'feature', ruleset, name: { en: name }, source };
}

/** A feat of a category, its name only. */
function feat(slug: string, name: string, category: string): Of<'feat'> {
  return {
    id: `srd-2024:feat/${slug}`,
    type: 'feat',
    ruleset,
    name: { en: name },
    source,
    category,
  };
}

// --- The human (`5e-SRD-Species.json`, `-Traits.json`; its sizes from dnd5e, §8) --------------

const human: Of<'species'> = {
  id: 'srd-2024:species/human',
  type: 'species',
  ruleset,
  name: { en: 'Human' },
  source,
  size: ['medium', 'small'],
  speed: { walk: 30 },
  creatureType: 'humanoid',
  grants: [
    {
      id: 'traits',
      kind: 'entity',
      fixed: [
        'srd-2024:feature/resourceful',
        'srd-2024:feature/skillful',
        'srd-2024:feature/versatile',
      ],
    },
  ],
};

const humanTraits: Of<'feature'>[] = [
  named('resourceful', 'Resourceful'),
  {
    ...named('skillful', 'Skillful'),
    grants: [
      {
        id: 'skills',
        kind: 'proficiency',
        category: 'skill',
        choose: { count: 1, from: { type: 'skill' } },
      },
    ],
  },
  {
    ...named('versatile', 'Versatile'),
    grants: [
      {
        id: 'feat',
        kind: 'entity',
        choose: { count: 1, from: { type: 'feat', category: 'origin' } },
      },
    ],
  },
];

// --- The Soldier (`5e-SRD-Backgrounds.json`; its increases from dnd5e, §8) ---------------------

const soldier: Of<'background'> = {
  id: 'srd-2024:background/soldier',
  type: 'background',
  ruleset,
  name: { en: 'Soldier' },
  source,
  grants: [
    {
      id: 'ability-scores',
      kind: 'abilityScore',
      mode: 'distribute',
      from: ['str', 'dex', 'con'],
      patterns: [
        [2, 1],
        [1, 1, 1],
      ],
    },
    { id: 'feat', kind: 'entity', fixed: ['srd-2024:feat/savage-attacker'] },
    { id: 'skills', kind: 'proficiency', category: 'skill', fixed: ['athletics', 'intimidation'] },
    {
      id: 'tools',
      kind: 'proficiency',
      category: 'tool',
      choose: { count: 1, from: ['dice', 'dragonchess', 'playingCards', 'threeDragonAnte'] },
    },
  ],
};

// --- Feats (`5e-SRD-Feats.json`): a category is 5e-database's `type` in camelCase -------------

const feats: Of<'feat'>[] = [
  {
    ...feat('alert', 'Alert', 'origin'),
    // SPEC §5.4's own example.
    effects: [{ id: 'initiative', target: 'init.bonus', op: 'add', value: '@prof' }],
  },
  feat('savage-attacker', 'Savage Attacker', 'origin'),
  {
    // Its prerequisite, any Fighting Style feature, has no shape (ENG-10 §4).
    ...feat('defense', 'Defense', 'fightingStyle'),
    // SPEC §5.4's own example.
    effects: [{ id: 'armor-class', target: 'ac.bonus', op: 'add', value: 1, when: '@armor.worn' }],
  },
];

// --- The fighter and the Champion (`5e-SRD-Classes.json`, `-Levels.json`, `-Features.json`) ---

/** The fighter's table: its Second Wind and Weapon Mastery columns, per class level. */
const FIGHTER_LEVELS: NonNullable<Of<'class'>['levels']> = [
  { level: 1, table: { secondWindUses: 2, weaponMastery: 3 } },
  { level: 2, table: { secondWindUses: 2, weaponMastery: 3 } },
  { level: 3, table: { secondWindUses: 2, weaponMastery: 3 } },
  { level: 4, table: { secondWindUses: 3, weaponMastery: 4 } },
  { level: 5, table: { secondWindUses: 3, weaponMastery: 4 } },
  { level: 6, table: { secondWindUses: 3, weaponMastery: 4 } },
  { level: 7, table: { secondWindUses: 3, weaponMastery: 4 } },
  { level: 8, table: { secondWindUses: 3, weaponMastery: 4 } },
  { level: 9, table: { secondWindUses: 3, weaponMastery: 4 } },
  { level: 10, table: { secondWindUses: 4, weaponMastery: 5 } },
  { level: 11, table: { secondWindUses: 4, weaponMastery: 5 } },
  { level: 12, table: { secondWindUses: 4, weaponMastery: 5 } },
  { level: 13, table: { secondWindUses: 4, weaponMastery: 5 } },
  { level: 14, table: { secondWindUses: 4, weaponMastery: 5 } },
  { level: 15, table: { secondWindUses: 4, weaponMastery: 5 } },
  { level: 16, table: { secondWindUses: 4, weaponMastery: 6 } },
  { level: 17, table: { secondWindUses: 4, weaponMastery: 6 } },
  { level: 18, table: { secondWindUses: 4, weaponMastery: 6 } },
  { level: 19, table: { secondWindUses: 4, weaponMastery: 6 } },
  { level: 20, table: { secondWindUses: 4, weaponMastery: 6 } },
];

const fighter: Of<'class'> = {
  id: 'srd-2024:class/fighter',
  type: 'class',
  key: 'fighter',
  ruleset,
  name: { en: 'Fighter' },
  source,
  hitDie: 10,
  primaryAbilities: ['str', 'dex'],
  saves: ['str', 'con'],
  subclassLevel: 3,
  levels: FIGHTER_LEVELS,
  grants: [
    {
      id: 'features-1',
      kind: 'entity',
      atLevel: 1,
      fixed: [
        'srd-2024:feature/fighter-fighting-style',
        'srd-2024:feature/fighter-second-wind',
        'srd-2024:feature/fighter-weapon-mastery',
      ],
    },
    {
      id: 'features-2',
      kind: 'entity',
      atLevel: 2,
      fixed: ['srd-2024:feature/fighter-action-surge', 'srd-2024:feature/fighter-tactical-mind'],
    },
    {
      id: 'features-3',
      kind: 'entity',
      atLevel: 3,
      fixed: ['srd-2024:feature/fighter-subclass'],
    },
    {
      id: 'features-4',
      kind: 'entity',
      atLevel: 4,
      fixed: ['srd-2024:feature/fighter-ability-score-improvement'],
    },
    // The feature's improvement, the feat Ability Score Improvement's (ENG-10 §4).
    {
      id: 'ability-scores-4',
      kind: 'abilityScore',
      atLevel: 4,
      mode: 'distribute',
      from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
      patterns: [[2], [1, 1]],
    },
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
        from: [
          'acrobatics',
          'animalHandling',
          'athletics',
          'history',
          'insight',
          'intimidation',
          'perception',
          'survival',
        ],
      },
    },
  ],
  multiclass: {
    prerequisites: [
      {
        kind: 'formula',
        formula: '@abilities.str.score >= 13 || @abilities.dex.score >= 13',
        label: { en: 'Strength 13 or Dexterity 13' },
      },
    ],
    grants: [
      {
        id: 'multiclass-armor',
        kind: 'proficiency',
        category: 'armor',
        fixed: ['light', 'medium', 'shield'],
      },
      { id: 'multiclass-weapons', kind: 'proficiency', category: 'weapon', fixed: ['martial'] },
    ],
  },
};

const fighterFeatures: Of<'feature'>[] = [
  {
    ...named('fighter-fighting-style', 'Fighting Style'),
    grants: [
      {
        id: 'feat',
        kind: 'entity',
        choose: { count: 1, from: { type: 'feat', category: 'fightingStyle' } },
      },
    ],
  },
  {
    ...named('fighter-second-wind', 'Second Wind'),
    grants: [
      {
        id: 'uses',
        kind: 'resource',
        key: 'secondWind',
        label: { en: 'Second Wind' },
        uses: {
          // SPEC §5.3's own example of a class table column.
          max: '@classes.fighter.table.secondWindUses',
          recovery: [
            { on: 'short', amount: '1' },
            { on: 'long', amount: 'all' },
          ],
        },
      },
    ],
  },
  // How many kinds of weapons is the table's `weaponMastery`; which kinds is ENG-16's (§9).
  named('fighter-weapon-mastery', 'Weapon Mastery'),
  named('fighter-action-surge', 'Action Surge'),
  named('fighter-tactical-mind', 'Tactical Mind'),
  named('fighter-subclass', 'Fighter Subclass'),
  named('fighter-ability-score-improvement', 'Ability Score Improvement'),
];

const champion: Of<'subclass'> = {
  id: 'srd-2024:subclass/champion',
  type: 'subclass',
  key: 'champion',
  classKey: 'fighter',
  ruleset,
  name: { en: 'Champion' },
  source,
  grants: [
    {
      id: 'features-3',
      kind: 'entity',
      atLevel: 3,
      fixed: [
        'srd-2024:feature/champion-improved-critical',
        'srd-2024:feature/champion-remarkable-athlete',
      ],
    },
  ],
};

// SPEC §5.4's own examples, both.
const championFeatures: Of<'feature'>[] = [
  {
    ...named('champion-improved-critical', 'Improved Critical'),
    effects: [{ id: 'critical-range', target: 'crit.range', op: 'min', value: 19 }],
  },
  {
    ...named('champion-remarkable-athlete', 'Remarkable Athlete'),
    effects: [
      { id: 'initiative', target: 'roll.init', op: 'advantage', value: true },
      { id: 'athletics', target: 'roll.skill.athletics', op: 'advantage', value: true },
    ],
  },
];

// --- Golden C's classes (`5e-SRD-Classes.json`, `-Levels.json`) -------------------------------

/** The wizard's slots of levels 1 to 9, per class level: measured equal to the 2014 rows. */
const WIZARD_SLOTS: number[][] = [
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

/** The paladin's slots of levels 1 to 5, per class level: it casts from level 1 in 2024. */
const PALADIN_SLOTS: number[][] = [
  [2],
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

const wizard: Of<'class'> = {
  id: 'srd-2024:class/wizard',
  type: 'class',
  key: 'wizard',
  ruleset,
  name: { en: 'Wizard' },
  source,
  hitDie: 6,
  primaryAbilities: ['int'],
  saves: ['int', 'wis'],
  subclassLevel: 3,
  spellcasting: {
    ability: 'int',
    progression: 'full',
    preparation: 'spellbook',
    preparedCount: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
    cantripsKnown: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    slotsTable: WIZARD_SLOTS,
    spellList: { classKey: 'wizard' },
    ritual: true,
  },
  grants: [
    { id: 'weapons', kind: 'proficiency', category: 'weapon', fixed: ['simple'] },
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
  id: 'srd-2024:class/paladin',
  type: 'class',
  key: 'paladin',
  ruleset,
  name: { en: 'Paladin' },
  source,
  hitDie: 10,
  primaryAbilities: ['str', 'cha'],
  saves: ['wis', 'cha'],
  subclassLevel: 3,
  spellcasting: {
    ability: 'cha',
    progression: 'half',
    preparation: 'prepared',
    preparedCount: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
    slotsTable: PALADIN_SLOTS,
    spellList: { classKey: 'paladin' },
    ritual: true,
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
      { id: 'multiclass-weapons', kind: 'proficiency', category: 'weapon', fixed: ['martial'] },
    ],
  },
};

// --- Exhaustion (`5e-SRD-Conditions.json`; SPEC §6.3's 2024 row, dnd5e's speeds, §8) ----------

const exhaustion: Of<'condition'> = {
  id: 'srd-2024:condition/exhaustion',
  type: 'condition',
  key: 'exhaustion',
  ruleset,
  name: { en: 'Exhaustion' },
  source,
  maxLevel: 6,
  effects: [
    // SPEC §5.4's own example.
    {
      id: 'd20-tests',
      target: 'd20.all.bonus',
      op: 'add',
      value: '-2 * @conditions.exhaustion.level',
    },
    // Every speed the creature has (dnd5e); `speed.all.bonus` is ENG-14's (ENG-10 §4).
    {
      id: 'speed',
      target: 'speed.all.bonus',
      op: 'add',
      value: '-5 * @conditions.exhaustion.level',
    },
  ],
};

// --- Equipment (`5e-SRD-Equipment.json`, `-Damage-Types.json`, `-Weapon-Properties.json`,
// `-Weapon-Mastery-Properties.json`) -----------------------------------------------------------

const items: Of<'item'>[] = [
  {
    id: 'srd-2024:item/chain-mail',
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
    id: 'srd-2024:item/greatsword',
    type: 'item',
    key: 'greatsword',
    ruleset,
    name: { en: 'Greatsword' },
    source,
    category: 'weapon',
    weight: 6,
    cost: { amount: 50, unit: 'gp' },
    weapon: {
      group: 'martial',
      kind: 'melee',
      damage: { formula: '2d6', type: 'slashing' },
      properties: ['heavy', 'twoHanded'],
      mastery: 'graze',
    },
  },
];

const slashing: Of<'damageType'> = {
  id: 'srd-2024:damageType/slashing',
  type: 'damageType',
  key: 'slashing',
  ruleset,
  name: { en: 'Slashing' },
  source,
};

const weaponProperties: Of<'weaponProperty'>[] = [
  {
    id: 'srd-2024:weaponProperty/heavy',
    type: 'weaponProperty',
    key: 'heavy',
    ruleset,
    name: { en: 'Heavy' },
    source,
  },
  {
    id: 'srd-2024:weaponProperty/two-handed',
    type: 'weaponProperty',
    key: 'twoHanded',
    ruleset,
    name: { en: 'Two-Handed' },
    source,
  },
];

const graze: Of<'weaponMastery'> = {
  id: 'srd-2024:weaponMastery/graze',
  type: 'weaponMastery',
  key: 'graze',
  ruleset,
  name: { en: 'Graze' },
  source,
};

/** The pack `srd-2024`, as a file would hold it: the SRD 5.2.1 entities goldens B to D need. */
export const srd2024 = {
  id: 'srd-2024',
  version: '0.1.0',
  schemaVersion: 1,
  system: '5e',
  systemSchemaVersion: 1,
  title: { en: 'SRD 5.2.1' },
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
    human,
    ...humanTraits,
    soldier,
    ...feats,
    fighter,
    ...fighterFeatures,
    champion,
    ...championFeatures,
    wizard,
    paladin,
    exhaustion,
    ...items,
    slashing,
    ...weaponProperties,
    graze,
  ],
} satisfies z.input<typeof fifthEditionPackSchema>;
