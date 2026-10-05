import type { z } from 'zod';
import type { fifthEditionCharacterSchema } from '../../src/index.ts';
import { houseRules, rested, untouched } from './character-parts.ts';

// ENG-37: golden F (ADR 005 item 3.6), the character ADR 018 approves: golden B with the 2014 hill
// dwarf in place of the 2024 human, on both SRD packs. It is of neither edition's pack alone, so
// it has a file of its own. Its 2014 pack comes first, so a key's first entry is not the rules
// base's (ADR 014 item 2). It stores the rules base's bonus source, the background's; the test
// makes the other three options of ADR 017 from it. The choices ADR 018 calls test data are
// golden A's and golden B's.

/**
 * Golden F: a 2024 character, mixing on, with the 2014 dwarf and hill dwarf, the 2024 Soldier and
 * fighter 1, the standard array, the Defense style, chain mail and a greatsword.
 */
export const goldenF = {
  id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
  schemaVersion: 2,
  rev: 0,
  createdAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
  system: '5e',
  systemSchemaVersion: 7,
  ruleset: '2024',
  allowMixedRulesets: true,
  kind: 'pc',
  mode: 'manual',
  packs: ['srd-2014', 'srd-2024'],
  name: 'Golden F',
  abilities: { base: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } },
  choices: {
    'srd-2014:species/dwarf#subrace': ['srd-2014:lineage/hill-dwarf'],
    'srd-2014:feature/tool-proficiency#tools': ['masonsTools'],
    'srd-2024:background/soldier#ability-scores': ['str', 'con'],
    'srd-2024:background/soldier#tools': ['playingCards'],
    'srd-2024:class/fighter#skills': ['perception', 'survival'],
    'srd-2024:feature/fighter-fighting-style#feat': ['srd-2024:feat/defense'],
    'srd-2024:feature/fighter-weapon-mastery#kinds': ['greatsword', 'greataxe', 'glaive'],
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
    species: { id: 'srd-2014:species/dwarf' },
    background: { id: 'srd-2024:background/soldier' },
    classes: [{ id: 'srd-2024:class/fighter', level: 1, hp: ['max'] }],
    inventory: [
      {
        uid: '3b4c5d6e-7f8a-4b9c-8d0e-2f3a4b5c6d7e',
        itemId: 'srd-2024:item/chain-mail',
        qty: 1,
        equipped: true,
        attuned: false,
      },
      {
        uid: '4c5d6e7f-8a9b-4c0d-9e1f-3a4b5c6d7e8f',
        itemId: 'srd-2024:item/greatsword',
        qty: 1,
        equipped: true,
        attuned: false,
      },
    ],
    // ADR 018's hit point maximum for the background's option, not yet hurt.
    state: { ...rested, hp: { current: 13, temp: 0 } },
  },
} satisfies z.input<typeof fifthEditionCharacterSchema>;
