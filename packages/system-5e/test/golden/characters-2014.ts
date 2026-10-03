import type { z } from 'zod';
import type { fifthEditionCharacterSchema } from '../../src/index.ts';
import { houseRules, rested, untouched } from './character-parts.ts';

// ENG-09: the 2014 golden characters of SPEC §6.7, on the pack `srd-2014`. What SPEC §6.7 states
// is written as it states it (golden A's dwarf is the hill dwarf, ADR 016); what it leaves open
// is test data, marked so. Their expected values are SPEC §6.7's, turned on by ENG-13 onward.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;

/** The core part both characters share. */
const core: Omit<CharacterInput, 'id' | 'name' | 'abilities' | 'choices' | 'systemData'> = {
  schemaVersion: 2,
  rev: 0,
  createdAt: '2026-10-02T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
  system: '5e',
  systemSchemaVersion: 6,
  ruleset: '2014',
  allowMixedRulesets: false,
  kind: 'pc',
  mode: 'manual',
  packs: ['srd-2014'],
  state: { resources: {}, conditions: [], toggles: {} },
  overrides: [],
  localEntities: [],
  notes: {},
};

/**
 * Golden A: a hill dwarf Life domain cleric 1 with the Acolyte background, the standard array, chain
 * mail, a shield and a warhammer. The tool and the two languages are test data.
 */
export const goldenA = {
  ...core,
  id: '0a9d8c7b-6e5f-4a3b-9c2d-1e0f9a8b7c6d',
  name: 'Golden A',
  abilities: { base: { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 } },
  choices: {
    'srd-2014:species/dwarf#subrace': ['srd-2014:lineage/hill-dwarf'],
    'srd-2014:feature/tool-proficiency#tools': ['masonsTools'],
    'srd-2014:background/acolyte#languages': ['celestial', 'elvish'],
    'srd-2014:class/cleric#skills': ['medicine', 'persuasion'],
  },
  systemData: {
    ...untouched,
    houseRules,
    abilities: { method: 'standardArray', bonusSource: 'species' },
    languageSource: 'species',
    advancement: { mode: 'milestone', xp: 0 },
    species: { id: 'srd-2014:species/dwarf' },
    background: { id: 'srd-2014:background/acolyte' },
    classes: [
      {
        id: 'srd-2014:class/cleric',
        subclass: 'srd-2014:subclass/life',
        level: 1,
        hp: ['max'],
      },
    ],
    inventory: [
      {
        uid: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
        itemId: 'srd-2014:item/chain-mail',
        qty: 1,
        equipped: true,
        attuned: false,
      },
      {
        uid: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
        itemId: 'srd-2014:item/shield',
        qty: 1,
        equipped: true,
        attuned: false,
      },
      {
        uid: '3d4e5f6a-7b8c-4d9e-8f1a-2b3c4d5e6f7a',
        itemId: 'srd-2014:item/warhammer',
        qty: 1,
        equipped: true,
        attuned: false,
      },
    ],
    // SPEC §6.7's hit point maximum, not yet hurt.
    state: { ...rested, hp: { current: 12, temp: 0 } },
  },
} satisfies z.input<typeof fifthEditionCharacterSchema>;

/**
 * Golden C, the 2014 column: wizard 3, then paladin 3, with no species and no background. The
 * scores (the standard array, meeting both classes' prerequisites), the order of the classes and
 * the wizard's skills are test data.
 */
export const goldenC2014 = {
  ...core,
  id: '4e5f6a7b-8c9d-4e0f-9a2b-3c4d5e6f7a8b',
  name: 'Golden C (2014)',
  abilities: { base: { str: 13, dex: 10, con: 12, int: 15, wis: 8, cha: 14 } },
  choices: { 'srd-2014:class/wizard#skills': ['arcana', 'history'] },
  systemData: {
    ...untouched,
    houseRules,
    abilities: { method: 'standardArray', bonusSource: 'species' },
    languageSource: 'species',
    advancement: { mode: 'milestone', xp: 0 },
    classes: [
      { id: 'srd-2014:class/wizard', level: 3, hp: ['max', 'avg', 'avg'] },
      { id: 'srd-2014:class/paladin', level: 3, hp: ['avg', 'avg', 'avg'] },
    ],
    inventory: [],
    // Golden C states no hit points: the current ones are test data.
    state: { ...rested, hp: { current: 30, temp: 0 } },
  },
} satisfies z.input<typeof fifthEditionCharacterSchema>;
