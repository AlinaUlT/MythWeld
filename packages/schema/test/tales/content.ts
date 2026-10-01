import type { z } from 'zod';
import type { talesPackSchema } from './system';

// ENG-27: Tales' one pack. Each entity is there to exercise something the core must handle; the
// comment above it says what.

const source = { pack: 'tales-core' };

/** The pack `tales-core`, as a file would hold it. */
export const talesCore = {
  id: 'tales-core',
  version: '1.0.0',
  schemaVersion: 1,
  system: 'tales',
  systemSchemaVersion: 1,
  title: { en: 'Tales core' },
  ruleset: 'any',
  license: { name: 'Made up for the tests', redistributable: false },
  entities: [
    // Stats. `grit` and `wits` take Tales' defaults; `nerve` has its own formula and maximum.
    {
      id: 'tales-core:ability/grit',
      type: 'ability',
      key: 'grit',
      ruleset: 'any',
      name: { en: 'Grit' },
      abbr: { en: 'GRT' },
      order: 0,
      source,
    },
    {
      id: 'tales-core:ability/wits',
      type: 'ability',
      key: 'wits',
      ruleset: 'any',
      name: { en: 'Wits' },
      abbr: { en: 'WIT' },
      order: 1,
      source,
    },
    {
      id: 'tales-core:ability/nerve',
      type: 'ability',
      key: 'nerve',
      ruleset: 'any',
      name: { en: 'Nerve' },
      abbr: { en: 'NRV' },
      order: 2,
      modFormula: '@score - 3',
      hasSave: false,
      defaultMax: 8,
      source,
    },
    // Skills. `climb` has one entry per edition, on different stats (ADR 014 item 2).
    {
      id: 'tales-core:skill/climb',
      type: 'skill',
      key: 'climb',
      ruleset: 'first-age',
      name: { en: 'Climb' },
      ability: 'grit',
      source,
    },
    {
      id: 'tales-core:skill/climb-anew',
      type: 'skill',
      key: 'climb',
      ruleset: 'second-age',
      name: { en: 'Climb' },
      ability: 'wits',
      source,
    },
    {
      id: 'tales-core:skill/sneak',
      type: 'skill',
      key: 'sneak',
      ruleset: 'any',
      name: { en: 'Sneak' },
      ability: 'wits',
      source,
    },
    {
      id: 'tales-core:skill/steady',
      type: 'skill',
      key: 'steady',
      ruleset: 'any',
      name: { en: 'Steady' },
      ability: 'nerve',
      passive: true,
      source,
    },
    // Conditions: one with levels and an effect whose value reads its level, one with neither.
    {
      id: 'tales-core:condition/weary',
      type: 'condition',
      key: 'weary',
      ruleset: 'any',
      name: { en: 'Weary' },
      maxLevel: 3,
      effects: [
        {
          id: 'tired',
          target: 'skills.all.bonus',
          op: 'add',
          value: '-@conditions.weary.level',
        },
      ],
      source,
    },
    {
      id: 'tales-core:condition/lost',
      type: 'condition',
      key: 'lost',
      ruleset: 'any',
      name: { en: 'Lost' },
      source,
    },
    // Callings: every core grant kind, a grant at a level, two kinds of choice, the module's
    // own kind, two resources.
    {
      id: 'tales-core:calling/warden',
      type: 'calling',
      key: 'warden',
      ruleset: 'any',
      name: { en: 'Warden' },
      die: 8,
      grants: [
        { id: 'sturdy', kind: 'abilityScore', mode: 'fixed', values: { grit: 1 } },
        { id: 'climber', kind: 'proficiency', category: 'knack', fixed: ['climb'] },
        {
          id: 'pick-knack',
          kind: 'proficiency',
          category: 'knack',
          choose: { count: 1, from: ['sneak', 'steady'] },
        },
        {
          id: 'luck',
          kind: 'resource',
          key: 'luck',
          label: { en: 'Luck' },
          uses: { max: '@abilities.nerve.mod + 1', recovery: [{ on: 'scene', amount: 'all' }] },
        },
        {
          id: 'pick-talent',
          atLevel: 2,
          kind: 'entity',
          choose: { count: 1, from: { type: 'talent', tag: 'night' } },
        },
      ],
      source,
    },
    {
      id: 'tales-core:calling/seeker',
      type: 'calling',
      key: 'seeker',
      ruleset: 'second-age',
      name: { en: 'Seeker' },
      die: 6,
      grants: [
        { id: 'keen', kind: 'abilityScore', mode: 'fixed', values: { wits: 2 } },
        {
          id: 'knacks',
          kind: 'proficiency',
          category: 'knack',
          choose: { count: 2, from: ['climb', 'sneak', 'steady'] },
        },
        {
          id: 'focus',
          kind: 'resource',
          key: 'focus',
          label: { en: 'Focus' },
          uses: { max: '@level * 2', recovery: [{ on: 'session', amount: '2' }] },
        },
        {
          id: 'blessing',
          kind: 'boon',
          boon: 'tales-core:talent/deep-lungs',
          uses: { max: '1', recovery: [{ on: 'session', amount: 'all' }] },
        },
      ],
      source,
    },
    // Talents: one that grants another, a toggle, a formula as an effect's value, prerequisites.
    {
      id: 'tales-core:talent/night-warden',
      type: 'talent',
      ruleset: 'any',
      name: { en: 'Night Warden' },
      tier: 2,
      tags: ['night'],
      effects: [
        { id: 'shadow', target: 'skills.sneak.bonus', op: 'add', value: 1 },
        {
          id: 'glow',
          target: 'abilities.grit.score',
          op: 'add',
          value: 1,
          toggle: { label: { en: 'Glowing' }, default: false },
        },
      ],
      grants: [
        { id: 'step', kind: 'entity', fixed: ['tales-core:talent/quick-step'] },
        { id: 'stars', kind: 'proficiency', category: 'lore', fixed: ['stars'], level: 2 },
      ],
      source,
    },
    {
      id: 'tales-core:talent/quick-step',
      type: 'talent',
      ruleset: 'any',
      name: { en: 'Quick Step' },
      tier: 1,
      effects: [
        { id: 'nimble', target: 'skills.climb.bonus', op: 'add', value: '@abilities.wits.mod' },
      ],
      source,
    },
    {
      id: 'tales-core:talent/deep-lungs',
      type: 'talent',
      ruleset: 'any',
      name: { en: 'Deep Lungs' },
      tier: 1,
      tags: ['night'],
      grants: [
        {
          id: 'breath',
          kind: 'resource',
          key: 'breath',
          label: { en: 'Breath' },
          uses: { max: '2', recovery: [{ on: 'session', amount: '1' }] },
        },
      ],
      prerequisites: [{ kind: 'ability', key: 'nerve', min: 5 }],
      source,
    },
    {
      id: 'tales-core:talent/iron-will',
      type: 'talent',
      ruleset: 'second-age',
      name: { en: 'Iron Will' },
      tier: 3,
      effects: [{ id: 'will', target: 'skills.steady.bonus', op: 'add', value: 2 }],
      prerequisites: [
        { kind: 'level', min: 4 },
        { kind: 'proficiency', category: 'craft', key: 'rope' },
      ],
      source,
    },
  ],
} satisfies z.input<typeof talesPackSchema>;
