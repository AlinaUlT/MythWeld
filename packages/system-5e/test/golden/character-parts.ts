import type { z } from 'zod';
import type { fifthEditionCharacterSchema } from '../../src/index.ts';

// ENG-09's parts every golden character shares, whatever its edition; moved here by ENG-10.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type DataInput = CharacterInput['systemData'];

/** House rules: test data. Each edition's defaults are ENG-19's. */
export const houseRules: DataInput['houseRules'] = {
  hitPointMethods: ['roll', 'avg'],
  abilityMax: 20,
  feats: 'own',
  multiclass: true,
  encumbrance: 'none',
  skillAbilitySwap: false,
  inspirationMax: 1,
};

/** What every character here starts with: no coins, no feats outside grants, no spells chosen. */
export const untouched: Pick<DataInput, 'currency' | 'feats' | 'spells'> = {
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  feats: [],
  spells: {},
};

/** Trackers with nothing spent; each character adds its current hit points. */
export const rested: Omit<DataInput['state'], 'hp'> = {
  hitDiceSpent: {},
  slotsSpent: {},
  pactSlotsSpent: 0,
  deathSaves: { success: 0, failure: 0 },
  inspiration: 0,
};
