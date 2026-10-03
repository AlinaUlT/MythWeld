import {
  CHARACTER_MIGRATIONS,
  CHARACTER_PACK_ID,
  CHARACTER_SCHEMA_VERSION,
  characterOpenerOf,
  characterSchemaOf,
  DEFAULT_ACTOR_KIND,
  type EntityId,
  type Migration,
  systemEntitySchemaOf,
  systemListsOf,
  systemSchemasOf,
} from '@grimoire/schema';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  talesCharacterSchema,
  talesDataSchema,
  talesEntitySchema,
  talesLists,
} from './tales/index.ts';

// Tales, the made-up test system (ENG-27): two editions, `talent` and `calling` entity types, and
// a module part holding a level, a calling and talents. No real game.

const ownTalent = {
  id: 'character:talent/lucky-charm',
  type: 'talent',
  ruleset: 'any',
  name: { en: 'Lucky charm' },
  tier: 1,
  source: { pack: 'character' },
  effects: [
    {
      id: 'glow',
      target: 'abilities.grit.score',
      op: 'add',
      value: 1,
      toggle: { label: { en: 'Glowing' }, default: false },
    },
  ],
};

/** Every field a character can have. */
const character = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  schemaVersion: 2,
  rev: 3,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:30:00.000Z',
  system: 'tales',
  systemSchemaVersion: 1,
  ruleset: 'first-age',
  allowMixedRulesets: false,
  kind: 'pc',
  mode: 'manual',
  name: 'Wren',
  player: 'A. Player',
  portraitBlobId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  packs: ['tales-core', 'hb-local'],
  abilities: { base: { grit: 12, wit: 9 } },
  choices: {
    'tales-core:talent/night-warden#pick-lore': ['stars'],
    'tales-core:talent/night-warden#find': ['tales-core:talent/quick-step'],
  },
  state: {
    resources: { lantern: 1, luck: 0 },
    conditions: [
      { id: 'tales-core:condition/weary', level: 2 },
      { id: 'tales-core:condition/lost' },
    ],
    toggles: { 'character:talent/lucky-charm#glow': true },
  },
  overrides: [
    { path: 'abilities.grit.score', value: 14, note: 'Set by the table.' },
    { path: 'lantern.lit', value: true },
    { path: 'title', value: 'Warden' },
  ],
  localEntities: [ownTalent],
  notes: { backstory: 'Grew up by the river.', looks: 'Tall, with a grey cloak.' },
  systemData: { level: 2, calling: 'tales-core:calling/warden', talents: [] },
};

const CHOICE = 'tales-core:talent/night-warden#pick-lore';

/** `character` with `change` applied to its top level. */
function characterWith(change: Record<string, unknown>) {
  return { ...character, ...change };
}

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

/** The paths of every issue when `character` with `change` is parsed. */
function refused(change: Record<string, unknown>): string[] {
  return issuePaths(talesCharacterSchema, characterWith(change));
}

describe('ENG-06 character document', () => {
  it('parses a full character to an equal object', () => {
    expect(talesCharacterSchema.parse(character)).toEqual(character);
    expect(CHARACTER_SCHEMA_VERSION).toBe(2);
    expect(CHARACTER_MIGRATIONS).toHaveLength(1);
    expect(CHARACTER_PACK_ID).toBe('character');
    expect(DEFAULT_ACTOR_KIND).toBe('pc');
  });

  it('needs every core field but `player` and `portraitBlobId`; lists and records may be empty', () => {
    for (const field of Object.keys(character)) {
      const { [field]: _left, ...without } = character as Record<string, unknown>;
      const expected = ['player', 'portraitBlobId'].includes(field) ? [] : [field];
      expect(issuePaths(talesCharacterSchema, without), field).toEqual(expected);
    }
    const empty = characterWith({
      packs: [],
      abilities: { base: {} },
      choices: {},
      state: { resources: {}, conditions: [], toggles: {} },
      overrides: [],
      localEntities: [],
      notes: {},
    });
    expect(issuePaths(talesCharacterSchema, empty)).toEqual([]);
  });

  it('takes ids as lowercase UUIDs, times in UTC, and a revision from 0', () => {
    expect(refused({ id: '0F8FAD5B-D9CB-469F-A165-70867728950E' })).toEqual(['id']);
    expect(refused({ id: 'wren' })).toEqual(['id']);
    expect(refused({ portraitBlobId: 'portrait.png' })).toEqual(['portraitBlobId']);
    expect(refused({ createdAt: '2026-10-01T09:00:00+02:00' })).toEqual(['createdAt']);
    expect(refused({ updatedAt: '2026-10-01' })).toEqual(['updatedAt']);
    expect(refused({ rev: 0 })).toEqual([]);
    for (const rev of [-1, 1.5]) expect(refused({ rev }), String(rev)).toEqual(['rev']);
  });

  it('takes its own system, its own versions and one of its editions', () => {
    expect(refused({ ruleset: 'second-age' })).toEqual([]);
    for (const ruleset of ['any', '2014', 'third-age']) {
      expect(refused({ ruleset }), ruleset).toEqual(['ruleset']);
    }
    expect(refused({ system: 'deep' })).toEqual(['system']);
    for (const schemaVersion of [0, 1, 3, '2']) {
      expect(refused({ schemaVersion }), String(schemaVersion)).toEqual(['schemaVersion']);
    }
    expect(refused({ systemSchemaVersion: 2 })).toEqual(['systemSchemaVersion']);
  });

  it('takes any actor kind that is a key, and one of two modes', () => {
    for (const kind of ['npc', 'enemy', 'swampBeast']) expect(refused({ kind }), kind).toEqual([]);
    for (const kind of ['Big boss', 'big-boss', ''])
      expect(refused({ kind }), kind).toEqual(['kind']);
    expect(refused({ mode: 'guided' })).toEqual([]);
    expect(refused({ mode: 'wizard' })).toEqual(['mode']);
    expect(refused({ allowMixedRulesets: 'yes' })).toEqual(['allowMixedRulesets']);
    expect(refused({ name: ' ' })).toEqual(['name']);
  });

  it("lists packs in order, none twice, never the character's own", () => {
    expect(refused({ packs: ['hb-local', 'tales-core'] })).toEqual([]);
    expect(refused({ packs: ['tales-core', 'hb-local', 'tales-core'] })).toEqual(['packs.2']);
    expect(refused({ packs: ['tales-core', CHARACTER_PACK_ID] })).toEqual(['packs.1']);
    expect(refused({ packs: ['Tales'] })).toEqual(['packs.0']);
  });

  it('keys a choice by entity and grant, with at least one pick and none twice', () => {
    expect(refused({ choices: { 'tales-core:talent/night-warden': ['stars'] } })).toEqual([
      'choices.tales-core:talent/night-warden',
    ]);
    expect(refused({ choices: { [CHOICE]: [] } })).toEqual([`choices.${CHOICE}`]);
    expect(refused({ choices: { [CHOICE]: ['stars', 'stars'] } })).toEqual([`choices.${CHOICE}`]);
    expect(refused({ choices: { [CHOICE]: ['Old stars'] } })).toEqual([`choices.${CHOICE}.0`]);
  });

  it('checks the trackers every system has', () => {
    const state = (change: Record<string, unknown>) => ({
      state: { ...character.state, ...change },
    });
    for (const used of [-1, 0.5]) {
      expect(refused(state({ resources: { lantern: used } })), String(used)).toEqual([
        'state.resources.lantern',
      ]);
    }
    const weary = { id: 'tales-core:condition/weary' };
    expect(refused(state({ conditions: [weary, weary] }))).toEqual(['state.conditions.1.id']);
    expect(refused(state({ conditions: [{ ...weary, level: 0 }] }))).toEqual([
      'state.conditions.0.level',
    ]);
    expect(refused(state({ toggles: { glow: true } }))).toEqual(['state.toggles.glow']);
    expect(refused(state({ toggles: { 'character:talent/lucky-charm#glow': 'on' } }))).toEqual([
      'state.toggles.character:talent/lucky-charm#glow',
    ]);
    expect(refused(state({ hp: { current: 5 } }))).toEqual(['state']);
  });

  it('keeps one override per path, each a number, true or false, or visible text', () => {
    const grit = { path: 'abilities.grit.score', value: 14 };
    expect(refused({ overrides: [grit, { ...grit, value: 15 }] })).toEqual(['overrides.1.path']);
    for (const value of ['', null, [14]]) {
      expect(refused({ overrides: [{ ...grit, value }] }), JSON.stringify(value)).toEqual([
        'overrides.0.value',
      ]);
    }
    expect(refused({ overrides: [{ ...grit, path: 'abilities.*.score' }] })).toEqual([
      'overrides.0.path',
    ]);
    expect(refused({ overrides: [{ ...grit, by: 'DM' }] })).toEqual(['overrides.0']);
  });

  it("keeps a character's own entities under the pack id `character`", () => {
    const luck = {
      id: 'character:ability/luck',
      type: 'ability',
      key: 'luck',
      ruleset: 'any',
      name: { en: 'Luck' },
      abbr: { en: 'LCK' },
      order: 2,
      source: { pack: 'character' },
    };
    expect(refused({ localEntities: [ownTalent, luck] })).toEqual([]);
    expect(
      refused({ localEntities: [{ ...ownTalent, id: 'hb-local:talent/lucky-charm' }] }),
    ).toEqual(['localEntities.0.id']);
    expect(refused({ localEntities: [ownTalent, luck, ownTalent] })).toEqual([
      'localEntities.2.id',
    ]);
    expect(
      refused({ localEntities: [{ ...ownTalent, id: 'character:feat/lucky', type: 'feat' }] }),
    ).toEqual(['localEntities.0.type']);
  });

  it("checks the module's part by the module's schema, and refuses unknown fields", () => {
    expect(refused({ systemData: { ...character.systemData, level: 6 } })).toEqual([
      'systemData.level',
    ]);
    expect(refused({ systemData: { ...character.systemData, hp: 10 } })).toEqual(['systemData']);
    for (const field of ['houseRules', 'inspiration', 'classes', 'hp']) {
      expect(refused({ [field]: {} }), field).toEqual(['']);
    }
    expect(refused({ notes: { 'back-story': 'x' } })).toEqual(['notes.back-story']);
    expect(refused({ notes: { backstory: ' ' } })).toEqual(['notes.backstory']);
    expect(refused({ abilities: { base: { grit: 12.5 } } })).toEqual(['abilities.base.grit']);
    expect(refused({ abilities: { base: {}, method: 'roll' } })).toEqual(['abilities']);
  });

  it('keeps two systems apart', () => {
    const deepLists = systemListsOf({
      editions: ['one'],
      proficiencyCategories: ['craft'],
      proficiencyLevels: [1],
      recoveryEvents: ['dive'],
    });
    const deep = systemSchemasOf(deepLists, []);
    const deepCharacterSchema = characterSchemaOf({
      system: 'deep',
      systemSchemaVersion: 2,
      edition: deepLists.editionSchema,
      entity: systemEntitySchemaOf(deep, []),
      systemData: z.strictObject({ depth: z.int() }),
    });
    expect(issuePaths(deepCharacterSchema, character)).toEqual([
      'system',
      'systemSchemaVersion',
      'ruleset',
      'localEntities.0.type',
      'systemData.depth',
      'systemData',
    ]);
  });

  it("throws when a system's parts cannot be right", () => {
    const parts = {
      system: 'tales',
      systemSchemaVersion: 1,
      edition: talesLists.editionSchema,
      entity: talesEntitySchema,
      systemData: talesDataSchema,
    };
    expect(() => characterSchemaOf({ ...parts, system: 'Tales' })).toThrow(
      'The system id "Tales" is not kebab-case.',
    );
    for (const systemSchemaVersion of [0, 1.5]) {
      expect(() => characterSchemaOf({ ...parts, systemSchemaVersion })).toThrow(
        `The system's schema version ${systemSchemaVersion} is not a whole number from 1.`,
      );
    }
    expect(() => characterSchemaOf({ ...parts, edition: talesLists.rulesetSchema })).toThrow(
      "A character's ruleset is one edition: its schema must refuse `any`.",
    );
  });

  it("types the character by the system's lists", () => {
    type Character = z.infer<typeof talesCharacterSchema>;
    expectTypeOf<Character['system']>().toEqualTypeOf<'tales'>();
    expectTypeOf<Character['schemaVersion']>().toEqualTypeOf<2>();
    expectTypeOf<Character['systemSchemaVersion']>().toEqualTypeOf<1>();
    expectTypeOf<Character['ruleset']>().toEqualTypeOf<'first-age' | 'second-age'>();
    expectTypeOf<Character['mode']>().toEqualTypeOf<'guided' | 'manual'>();
    expectTypeOf<Character['systemData']>().toEqualTypeOf<{
      level: number;
      calling: EntityId;
      talents: EntityId[];
    }>();
    expectTypeOf<Character['localEntities'][number]['type']>().toEqualTypeOf<
      'ability' | 'skill' | 'condition' | 'talent' | 'calling'
    >();
  });
});

describe("ENG-06 a character opens through the core's chain and the module's", () => {
  const openTalesCharacter = characterOpenerOf(talesCharacterSchema, []);

  it('opens a character of the current versions as it is', () => {
    expect(openTalesCharacter(character)).toEqual({
      ok: true,
      value: character,
      from: { schemaVersion: 2, systemSchemaVersion: 1 },
    });
  });

  it("refuses a character from a newer app, in the core's part or the module's", () => {
    expect(openTalesCharacter(characterWith({ schemaVersion: 3 }))).toEqual({
      ok: false,
      code: 'newer',
      field: 'schemaVersion',
      found: 3,
      current: 2,
      message:
        'The file was saved by a newer version of the app: its "schemaVersion" is 3, and this app reads up to 2.',
    });
    expect(openTalesCharacter(characterWith({ systemSchemaVersion: 4 }))).toMatchObject({
      ok: false,
      code: 'newer',
      field: 'systemSchemaVersion',
      found: 4,
      current: 1,
    });
  });

  it("runs the module's own steps on an older character", () => {
    // The module's version 2 renames `level` to `rank` in its part.
    const { level, ...rest } = character.systemData;
    const rankSchema = characterSchemaOf({
      system: 'tales',
      systemSchemaVersion: 2,
      edition: talesLists.editionSchema,
      entity: talesEntitySchema,
      systemData: talesDataSchema.omit({ level: true }).safeExtend({ rank: z.int() }),
    });
    const renameLevel: Migration = (file) => {
      const { level, ...data } = file.systemData as Record<string, unknown>;
      return { ...file, systemData: { ...data, rank: level } };
    };
    expect(characterOpenerOf(rankSchema, [renameLevel])(character)).toEqual({
      ok: true,
      value: { ...character, systemSchemaVersion: 2, systemData: { ...rest, rank: level } },
      from: { schemaVersion: 2, systemSchemaVersion: 1 },
    });
    expect(level).toBe(2);
    expect(() => characterOpenerOf(rankSchema, [])).toThrow(
      'The schema\'s "systemSchemaVersion" is 2, but its migrations lead to version 1.',
    );
  });
});
