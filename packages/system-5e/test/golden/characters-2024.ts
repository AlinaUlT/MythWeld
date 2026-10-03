import type { z } from 'zod';
import type { fifthEditionCharacterSchema } from '../../src/index.ts';
import { houseRules, rested, untouched } from './character-parts.ts';

// ENG-10: the 2024 golden characters of SPEC §6.7, on the pack `srd-2024`. What SPEC §6.7 states
// is written as it states it; what it leaves open is test data, marked so. Their expected values
// are SPEC §6.7's, turned on by ENG-13 onward. ENG-22 adds golden E, on `hb-local` too.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;

/** The core part every 2024 character shares. */
const core: Omit<CharacterInput, 'id' | 'name' | 'abilities' | 'choices' | 'systemData'> = {
  schemaVersion: 1,
  rev: 0,
  createdAt: '2026-10-02T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
  system: '5e',
  systemSchemaVersion: 4,
  ruleset: '2024',
  allowMixedRulesets: false,
  kind: 'pc',
  mode: 'manual',
  packs: ['srd-2024'],
  state: { resources: {}, conditions: [], toggles: {} },
  overrides: [],
  localEntities: [],
  notes: {},
};

/** Golden B's choices at fighter 1. The gaming set is test data. */
const choicesB: CharacterInput['choices'] = {
  'srd-2024:feature/skillful#skills': ['insight'],
  'srd-2024:feature/versatile#feat': ['srd-2024:feat/alert'],
  'srd-2024:background/soldier#ability-scores': ['str', 'con'],
  'srd-2024:background/soldier#tools': ['playingCards'],
  'srd-2024:class/fighter#skills': ['perception', 'survival'],
  'srd-2024:feature/fighter-fighting-style#feat': ['srd-2024:feat/defense'],
  // ENG-16: the greatsword, whose Graze SPEC §6.7 names; the other two kinds are test data.
  'srd-2024:feature/fighter-weapon-mastery#kinds': ['greatsword', 'greataxe', 'glaive'],
};

/** Chain mail and a greatsword, both equipped. */
const inventoryB: CharacterInput['systemData']['inventory'] = [
  {
    uid: '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c',
    itemId: 'srd-2024:item/chain-mail',
    qty: 1,
    equipped: true,
    attuned: false,
  },
  {
    uid: '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d',
    itemId: 'srd-2024:item/greatsword',
    qty: 1,
    equipped: true,
    attuned: false,
  },
];

/**
 * Golden B: a human fighter 1 with the Soldier background, the standard array, the Defense style,
 * chain mail and a greatsword. Its size is test data: the human chooses Medium or Small.
 */
export const goldenB = {
  ...core,
  id: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e',
  name: 'Golden B',
  abilities: { base: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
  choices: choicesB,
  systemData: {
    ...untouched,
    houseRules,
    abilities: { method: 'standardArray', bonusSource: 'background' },
    languageSource: 'background',
    advancement: { mode: 'milestone', xp: 0 },
    species: { id: 'srd-2024:species/human', size: 'medium' },
    background: { id: 'srd-2024:background/soldier' },
    classes: [{ id: 'srd-2024:class/fighter', level: 1, hp: ['max'] }],
    inventory: inventoryB,
    // SPEC §6.7's hit point maximum, not yet hurt.
    state: { ...rested, hp: { current: 12, temp: 0 } },
  },
} satisfies z.input<typeof fifthEditionCharacterSchema>;

/** Golden B4: golden B at fighter 4, a Champion from level 3, +2 STR at level 4, average hit points. */
export const goldenB4 = {
  ...goldenB,
  id: '8c9d0e1f-2a3b-4c4d-9e5f-6a7b8c9d0e1f',
  name: 'Golden B4',
  choices: {
    ...choicesB,
    'srd-2024:class/fighter#ability-scores-4': ['str'],
    // ENG-16: the fourth kind of weapon, at level 4: test data.
    'srd-2024:feature/fighter-weapon-mastery#kinds-4': ['halberd'],
  },
  systemData: {
    ...goldenB.systemData,
    classes: [
      {
        id: 'srd-2024:class/fighter',
        subclass: 'srd-2024:subclass/champion',
        level: 4,
        hp: ['max', 'avg', 'avg', 'avg'],
      },
    ],
    // SPEC §6.7's hit point maximum, not yet hurt.
    state: { ...rested, hp: { current: 36, temp: 0 } },
  },
} satisfies z.input<typeof fifthEditionCharacterSchema>;

/**
 * Golden E: golden B with SPEC Appendix Д's pack after the SRD, a base SAN of 14 (Appendix Д's last
 * line) and its feat Arcane Scholar, given by hand: a fighter 1 has no grant to take it in place of.
 */
export const goldenE = {
  ...goldenB,
  id: '1f2a3b4c-5d6e-4f7a-8b9c-0d1e2f3a4b5c',
  name: 'Golden E',
  packs: ['srd-2024', 'hb-local'],
  abilities: { base: { ...goldenB.abilities.base, san: 14 } },
  systemData: { ...goldenB.systemData, feats: [{ id: 'hb-local:feat/arcane-scholar' }] },
} satisfies z.input<typeof fifthEditionCharacterSchema>;

/** Golden D: golden B with exhaustion at level 2. */
export const goldenD = {
  ...goldenB,
  id: '9d0e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f2a',
  name: 'Golden D',
  state: { ...core.state, conditions: [{ id: 'srd-2024:condition/exhaustion', level: 2 }] },
} satisfies z.input<typeof fifthEditionCharacterSchema>;

/**
 * Golden C, the 2024 column: wizard 3, then paladin 3, with no species and no background. Its
 * scores, the order of the classes and the wizard's skills are golden C (2014)'s test data.
 */
export const goldenC2024 = {
  ...core,
  id: '0e1f2a3b-4c5d-4e6f-9a7b-8c9d0e1f2a3b',
  name: 'Golden C (2024)',
  abilities: { base: { str: 13, dex: 10, con: 12, int: 15, wis: 8, cha: 14 } },
  choices: { 'srd-2024:class/wizard#skills': ['arcana', 'history'] },
  systemData: {
    ...untouched,
    houseRules,
    abilities: { method: 'standardArray', bonusSource: 'background' },
    languageSource: 'background',
    advancement: { mode: 'milestone', xp: 0 },
    classes: [
      { id: 'srd-2024:class/wizard', level: 3, hp: ['max', 'avg', 'avg'] },
      { id: 'srd-2024:class/paladin', level: 3, hp: ['avg', 'avg', 'avg'] },
    ],
    inventory: [],
    // Golden C states no hit points: the current ones are test data.
    state: { ...rested, hp: { current: 30, temp: 0 } },
  },
} satisfies z.input<typeof fifthEditionCharacterSchema>;
