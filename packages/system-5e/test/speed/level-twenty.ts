import { CHARACTER_SCHEMA_VERSION, PACK_SCHEMA_VERSION } from '@grimoire/schema';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SCHEMA_VERSION,
  type fifthEditionCharacterSchema,
  type fifthEditionEntitySchema,
  type fifthEditionPackSchema,
} from '../../src/index.ts';
import { houseRules, rested, untouched } from '../golden/character-parts.ts';

// ENG-23: the character SPEC §6.6 times, "level 20, with multiclassing". The fixtures give a
// level-20 character only the features the goldens need, so the pack `speed-load` stands in for
// the rest: 56 features, the most class features any split of 20 levels gets in SRD 5.2.1 (ENG-23
// §8). Each has one effect, a formula reading a computed path; every fourth gives a resource. The
// features are made up and carry no rules text. Test data, written at the current versions: it is
// timed, not migrated.

type EntityInput = z.input<typeof fifthEditionEntitySchema>;
type Of<T extends EntityInput['type']> = Extract<EntityInput, { type: T }>;
type Effect = NonNullable<Of<'feature'>['effects']>[number];

/** The features the pack adds. */
export const LOAD_FEATURES = 56;

const source = { pack: 'speed-load' };
const ruleset = '2024';

/** What each feature's effect changes, and by what: they follow each other in this order. */
const EFFECTS: readonly Effect[] = [
  { id: 'armor-class', target: 'ac.bonus', op: 'add', value: '1', when: '@armor.worn' },
  { id: 'initiative', target: 'init.bonus', op: 'add', value: '@prof' },
  { id: 'hit-points', target: 'hp.max.bonus', op: 'add', value: '2 * @level' },
  { id: 'speed', target: 'speed.walk.bonus', op: 'add', value: '5 * floor(@prof / 2)' },
  { id: 'saves', target: 'saves.all.bonus', op: 'add', value: 'max(1, @abilities.cha.mod)' },
  { id: 'skills', target: 'skills.all.bonus', op: 'add', value: 'floor(@prof / 2)' },
  { id: 'damage', target: 'damage.weapon.melee.bonus', op: 'add', value: '@abilities.str.mod' },
  { id: 'spell-dc', target: 'spell.dc.bonus', op: 'add', value: 'min(1, @abilities.int.mod)' },
  { id: 'history', target: 'skills.history.bonus', op: 'add', value: '@abilities.int.mod' },
];

/** Feature `n` (from 1): one effect; every fourth, a resource too. */
function loadFeature(n: number): Of<'feature'> {
  const effect = EFFECTS[(n - 1) % EFFECTS.length] as Effect;
  return {
    id: `speed-load:feature/load-feature-${n}`,
    type: 'feature',
    ruleset,
    name: { en: `Load feature ${n}` },
    source,
    effects: [effect],
    ...(n % 4 === 0 && {
      grants: [
        {
          id: 'uses',
          kind: 'resource',
          key: `load${n}`,
          label: { en: `Load feature ${n}` },
          uses: {
            max: 'max(1, @abilities.cha.mod)',
            recovery: [{ on: 'long', amount: 'all' }],
          },
        },
      ],
    }),
  };
}

export const loadFeatures = Array.from({ length: LOAD_FEATURES }, (_, at) => loadFeature(at + 1));

/** The pack `speed-load`: the features, and the feat that gives them all. */
export const speedLoad = {
  id: 'speed-load',
  version: '1.0.0',
  schemaVersion: PACK_SCHEMA_VERSION,
  system: '5e',
  systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
  title: { en: 'Speed load' },
  ruleset,
  license: { name: 'Test data', redistributable: false },
  entities: [
    ...loadFeatures,
    {
      id: 'speed-load:feat/load',
      type: 'feat',
      ruleset,
      name: { en: 'Load' },
      source,
      category: 'general',
      grants: [{ id: 'features', kind: 'entity', fixed: loadFeatures.map(({ id }) => id) }],
    },
  ],
} satisfies z.input<typeof fifthEditionPackSchema>;

/** Each equipped row: chain mail and the four weapons of the 2024 fixtures. */
const EQUIPPED = [
  ['0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', 'srd-2024:item/chain-mail'],
  ['1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e', 'srd-2024:item/greatsword'],
  ['2c3d4e5f-6a7b-4c8d-8e9f-1a2b3c4d5e6f', 'srd-2024:item/greataxe'],
  ['3d4e5f6a-7b8c-4d9e-9f0a-2b3c4d5e6f7a', 'srd-2024:item/glaive'],
  ['4e5f6a7b-8c9d-4e0f-8a1b-3c4d5e6f7a8b', 'srd-2024:item/halberd'],
] as const;

/**
 * Level 20: golden B4's human Soldier, fighter 10 with the Champion, then wizard 5 and paladin 5;
 * golden C's scores, which meet the three classes' prerequisites. The feat `Load` gives the pack's
 * features. The fighter's fifth kind of weapon, at level 10, stays unchosen: a pending choice.
 */
export const levelTwenty = {
  id: '5f6a7b8c-9d0e-4f1a-9b2c-4d5e6f7a8b9c',
  name: 'Level twenty',
  schemaVersion: CHARACTER_SCHEMA_VERSION,
  rev: 0,
  createdAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
  system: '5e',
  systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
  ruleset,
  allowMixedRulesets: false,
  kind: 'pc',
  mode: 'manual',
  packs: ['srd-2024', 'speed-load'],
  abilities: { base: { str: 13, dex: 10, con: 12, int: 15, wis: 8, cha: 14 } },
  choices: {
    'srd-2024:feature/skillful#skills': ['insight'],
    'srd-2024:feature/versatile#feat': ['srd-2024:feat/alert'],
    'srd-2024:background/soldier#ability-scores': ['str', 'con'],
    'srd-2024:background/soldier#tools': ['playingCards'],
    'srd-2024:class/fighter#skills': ['perception', 'survival'],
    'srd-2024:class/fighter#ability-scores-4': ['str'],
    'srd-2024:feature/fighter-fighting-style#feat': ['srd-2024:feat/defense'],
    'srd-2024:feature/fighter-weapon-mastery#kinds': ['greatsword', 'greataxe', 'glaive'],
    'srd-2024:feature/fighter-weapon-mastery#kinds-4': ['halberd'],
  },
  state: { resources: {}, conditions: [], toggles: {} },
  overrides: [],
  localEntities: [],
  notes: {},
  systemData: {
    ...untouched,
    houseRules,
    abilities: { method: 'standardArray', bonusSource: 'background' },
    languageSource: 'background',
    advancement: { mode: 'milestone', xp: 0 },
    species: { id: 'srd-2024:species/human', size: 'medium' },
    background: { id: 'srd-2024:background/soldier' },
    classes: [
      {
        id: 'srd-2024:class/fighter',
        subclass: 'srd-2024:subclass/champion',
        level: 10,
        hp: ['max', 'avg', 'avg', 'avg', 'avg', 'avg', 'avg', 'avg', 'avg', 'avg'],
      },
      { id: 'srd-2024:class/wizard', level: 5, hp: ['avg', 'avg', 'avg', 'avg', 'avg'] },
      { id: 'srd-2024:class/paladin', level: 5, hp: ['avg', 'avg', 'avg', 'avg', 'avg'] },
    ],
    feats: [{ id: 'speed-load:feat/load' }],
    inventory: EQUIPPED.map(([uid, itemId]) => ({
      uid,
      itemId,
      qty: 1,
      equipped: true,
      attuned: false,
    })),
    state: { ...rested, hp: { current: 100, temp: 0 } },
  },
} satisfies z.input<typeof fifthEditionCharacterSchema>;
