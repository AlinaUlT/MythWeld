import type { z } from 'zod';
import type { talesCharacterSchema } from './system';

// ENG-27: two Tales characters. Ash has made every choice; Brook has what the core must handle
// without breaking (SPEC §8.2): an unmade choice, a missing id, unmet prerequisites. Their values
// are in `expected.ts`.

/** First age, level 2, a warden. Weary at level 1, one luck used. */
export const ash = {
  id: '6f1c2a3e-8b4d-4c5e-9a7f-1d2e3f4a5b6c',
  schemaVersion: 2,
  rev: 0,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  system: 'tales',
  systemSchemaVersion: 1,
  ruleset: 'first-age',
  allowMixedRulesets: false,
  kind: 'pc',
  mode: 'guided',
  name: 'Ash',
  packs: ['tales-core'],
  abilities: { base: { grit: 6, wits: 5, nerve: 4 } },
  choices: {
    'tales-core:calling/warden#pick-knack': ['sneak'],
    'tales-core:calling/warden#pick-talent': ['tales-core:talent/night-warden'],
  },
  state: {
    resources: { luck: 1 },
    conditions: [{ id: 'tales-core:condition/weary', level: 1 }],
    toggles: {},
  },
  overrides: [],
  localEntities: [],
  notes: {},
  systemData: { level: 2, calling: 'tales-core:calling/warden', talents: [] },
} satisfies z.input<typeof talesCharacterSchema>;

/**
 * Second age, level 3, a seeker. The `knacks` choice is unmade; a talent of the character's own
 * with its toggle on; `iron-will` without its prerequisites; one talent id no pack has; `nerve`
 * above its maximum; an override on Sneak.
 */
export const brook = {
  id: '3a9d6c2e-1b84-4f07-8c5a-7e2d0b9f4a61',
  schemaVersion: 2,
  rev: 4,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:20:00.000Z',
  system: 'tales',
  systemSchemaVersion: 1,
  ruleset: 'second-age',
  allowMixedRulesets: false,
  kind: 'pc',
  mode: 'manual',
  name: 'Brook',
  packs: ['tales-core'],
  abilities: { base: { grit: 5, wits: 6, nerve: 9 } },
  choices: {},
  state: {
    resources: {},
    conditions: [{ id: 'tales-core:condition/lost' }],
    toggles: { 'character:talent/lucky-charm#charm': true },
  },
  overrides: [{ path: 'skills.sneak.total', value: 9, note: 'Agreed at the table.' }],
  localEntities: [
    {
      id: 'character:talent/lucky-charm',
      type: 'talent',
      ruleset: 'any',
      name: { en: 'Lucky charm' },
      tier: 1,
      effects: [
        {
          id: 'charm',
          target: 'abilities.grit.score',
          op: 'add',
          value: 1,
          toggle: { label: { en: 'Held' }, default: false },
        },
      ],
      source: { pack: 'character' },
    },
  ],
  notes: { free: 'Made up for the tests.' },
  systemData: {
    level: 3,
    calling: 'tales-core:calling/seeker',
    talents: [
      'character:talent/lucky-charm',
      'tales-core:talent/iron-will',
      'tales-core:talent/gone-missing',
    ],
  },
} satisfies z.input<typeof talesCharacterSchema>;
