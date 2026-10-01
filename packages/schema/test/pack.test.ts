import {
  entityIdSchema,
  grantBaseSchema,
  LOCALE_OVERLAY_SCHEMA_VERSION,
  localeOverlayJsonSchema,
  localeOverlaySchema,
  type Migration,
  PACK_SCHEMA_VERSION,
  packJsonSchemaOf,
  packOpenerOf,
  packSchemaOf,
  type StoredObject,
  systemEntitySchemaOf,
  systemListsOf,
  systemSchemasOf,
} from '@grimoire/schema';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

// A made-up system: two editions, `lore` proficiencies, uses back each scene, a `boon` grant kind
// and a `talent` entity type. No real game.
const talesLists = systemListsOf({
  editions: ['first-age', 'second-age'],
  proficiencyCategories: ['lore', 'skill'],
  proficiencyLevels: [1, 2],
  recoveryEvents: ['scene'],
});
const tales = systemSchemasOf(talesLists, [
  grantBaseSchema.safeExtend({ kind: z.literal('boon'), boon: entityIdSchema }),
]);
const talentSchema = tales.entityBaseSchema.safeExtend({
  type: z.literal('talent'),
  tier: z.int().min(1).max(3),
});
const talesPackSchema = packSchemaOf({
  system: 'tales',
  systemSchemaVersion: 1,
  ruleset: tales.rulesetSchema,
  entity: systemEntitySchemaOf(tales, [talentSchema]),
});

const talent = {
  id: 'tales-core:talent/night-warden',
  type: 'talent',
  ruleset: 'first-age',
  name: { en: 'Night Warden' },
  tier: 2,
  source: { pack: 'tales-core', links: ['https://example.org/tales'] },
  grants: [
    { id: 'old-lore', kind: 'proficiency', category: 'lore', fixed: ['stars'] },
    { id: 'pick-lore', kind: 'proficiency', category: 'lore', choose: { count: 1, from: ['a'] } },
    { id: 'find', kind: 'entity', choose: { count: 1, from: { tag: 'night' } } },
    { id: 'tough', kind: 'abilityScore', mode: 'fixed', values: { grit: 1 } },
    { id: 'watch', kind: 'boon', boon: 'tales-core:talent/quick-step' },
  ],
};

/** Every field a pack can have. */
const fullPack = {
  id: 'tales-core',
  version: '2.1.0-beta.1',
  schemaVersion: 1,
  system: 'tales',
  systemSchemaVersion: 1,
  title: { en: 'Tales core', ru: 'Основа сказаний' },
  description: { en: 'A made-up test pack.' },
  ruleset: 'first-age',
  license: {
    spdx: 'CC-BY-4.0',
    name: 'Creative Commons Attribution 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Made up for a test.',
    redistributable: true,
  },
  authors: ['A. Writer', 'B. Writer'],
  homepage: 'https://example.org/tales',
  repository: 'https://example.org/tales.git',
  copyrightNotice: 'Made up for a test.',
  dependsOn: [{ id: 'tales-base', version: '1.0.0' }, { id: 'tales-maps' }],
  entities: [
    {
      id: 'tales-core:ability/grit',
      type: 'ability',
      key: 'grit',
      ruleset: 'any',
      name: { en: 'Grit' },
      abbr: { en: 'GRT' },
      order: 0,
      source: { pack: 'tales-core' },
    },
    talent,
  ],
};

// SPEC Appendix Д, with `system` and `systemSchemaVersion` added and its feat left out: `feat` is
// fifth edition's type (ENG-32), which the made-up system does not have.
const appendixPack = {
  id: 'hb-local',
  version: '1.0.0',
  schemaVersion: 1,
  system: 'tales',
  systemSchemaVersion: 1,
  title: { ru: 'Мой хоумбрю', en: 'My homebrew' },
  ruleset: 'any',
  license: { name: 'Personal', redistributable: false },
  entities: [
    {
      id: 'hb-local:ability/san',
      type: 'ability',
      key: 'san',
      ruleset: 'any',
      name: { ru: 'Рассудок', en: 'Sanity' },
      abbr: { ru: 'РАС', en: 'SAN' },
      order: 7,
      hasSave: true,
      source: { pack: 'hb-local' },
    },
    {
      id: 'hb-local:skill/occultism',
      type: 'skill',
      key: 'occultism',
      ruleset: 'any',
      name: { ru: 'Оккультизм', en: 'Occultism' },
      ability: 'int',
      source: { pack: 'hb-local' },
    },
    {
      id: 'hb-local:skill/composure',
      type: 'skill',
      key: 'composure',
      ruleset: 'any',
      name: { ru: 'Самообладание', en: 'Composure' },
      ability: 'san',
      source: { pack: 'hb-local' },
    },
  ],
};

const overlay = {
  schemaVersion: 1,
  packId: 'tales-core',
  locale: 'ru',
  texts: {
    'tales-core:talent/night-warden': { text: 'Текст.', summary: 'Кратко.' },
    'tales-core:ability/grit': { flavorText: 'Ещё текст.' },
  },
};

/** `fullPack` with `change` applied to its top level. */
function packWith(change: Record<string, unknown>) {
  return { ...fullPack, ...change };
}

/** `fullPack` whose talent has `change` applied. */
function talentWith(change: Record<string, unknown>) {
  return packWith({ entities: [fullPack.entities[0], { ...talent, ...change }] });
}

/** `fullPack` whose talent's grant at `index` has `change` applied. */
function grantWith(index: number, change: Record<string, unknown>) {
  return talentWith({
    grants: talent.grants.map((grant, i) => (i === index ? { ...grant, ...change } : grant)),
  });
}

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats.default(ajv);
const packJsonSchema = packJsonSchemaOf(talesPackSchema);
const jsonValidPack = ajv.compile(packJsonSchema);
const jsonValidOverlay = ajv.compile(localeOverlayJsonSchema());

describe('ENG-05 content pack', () => {
  it('parses a full pack and the Appendix Д pack to equal objects', () => {
    expect(talesPackSchema.parse(fullPack)).toEqual(fullPack);
    expect(talesPackSchema.parse(appendixPack)).toEqual(appendixPack);
    expect(PACK_SCHEMA_VERSION).toBe(1);
    expect(LOCALE_OVERLAY_SCHEMA_VERSION).toBe(1);
  });

  it('needs the fields of SPEC §5.7, and takes the rest as optional', () => {
    const { id, version, schemaVersion, system, systemSchemaVersion } = fullPack;
    const { title, ruleset, license, entities } = fullPack;
    const bare = {
      ...{ id, version, schemaVersion, system, systemSchemaVersion },
      ...{ title, ruleset, license, entities },
    };
    expect(issuePaths(talesPackSchema, bare)).toEqual([]);
    for (const field of Object.keys(bare)) {
      const { [field]: _left, ...without } = bare as Record<string, unknown>;
      expect(issuePaths(talesPackSchema, without), field).toEqual([field]);
    }
    const { spdx, url, attribution, ...bareLicense } = fullPack.license;
    expect(issuePaths(talesPackSchema, packWith({ license: bareLicense }))).toEqual([]);
    expect(spdx && url && attribution).toBeTruthy();
    for (const field of ['name', 'redistributable']) {
      const { [field]: _left, ...without } = bareLicense as Record<string, unknown>;
      expect(issuePaths(talesPackSchema, packWith({ license: without })), field).toEqual([
        `license.${field}`,
      ]);
    }
  });

  it('takes a semver version only', () => {
    for (const version of ['0.0.1', '1.0.0', '10.20.30', '2.1.0-beta.1', '1.0.0-0.3.7']) {
      expect(issuePaths(talesPackSchema, packWith({ version })), version).toEqual([]);
    }
    for (const version of ['1.0', 'v1.0.0', '01.0.0', '1.0.0+build', '1.0.0-', '']) {
      expect(issuePaths(talesPackSchema, packWith({ version })), version).toEqual(['version']);
    }
    expect(
      issuePaths(talesPackSchema, packWith({ dependsOn: [{ id: 'tales-base', version: '1' }] })),
    ).toEqual(['dependsOn.0.version']);
  });

  it('refuses another system, another schema version and an edition the system lacks', () => {
    expect(issuePaths(talesPackSchema, packWith({ system: 'deep' }))).toEqual(['system']);
    for (const schemaVersion of [0, 2, '1']) {
      expect(
        issuePaths(talesPackSchema, packWith({ schemaVersion })),
        String(schemaVersion),
      ).toEqual(['schemaVersion']);
    }
    expect(issuePaths(talesPackSchema, packWith({ ruleset: '2014' }))).toEqual(['ruleset']);
    expect(() =>
      packSchemaOf({
        system: 'Tales',
        systemSchemaVersion: 1,
        ruleset: tales.rulesetSchema,
        entity: talentSchema,
      }),
    ).toThrow('The system id "Tales" is not kebab-case.');
  });

  it('refuses links that are not http or https', () => {
    for (const field of ['homepage', 'repository']) {
      expect(issuePaths(talesPackSchema, packWith({ [field]: 'javascript:alert(1)' }))).toEqual([
        field,
      ]);
    }
    expect(
      issuePaths(
        talesPackSchema,
        packWith({ license: { ...fullPack.license, url: 'ftp://example.org' } }),
      ),
    ).toEqual(['license.url']);
  });

  it('refuses repeats and empty lists', () => {
    expect(issuePaths(talesPackSchema, packWith({ authors: ['A', 'A'] }))).toEqual(['authors']);
    expect(issuePaths(talesPackSchema, packWith({ authors: [] }))).toEqual(['authors']);
    expect(issuePaths(talesPackSchema, packWith({ dependsOn: [] }))).toEqual(['dependsOn']);
    expect(
      issuePaths(talesPackSchema, packWith({ dependsOn: [{ id: 'a' }, { id: 'a' }] })),
    ).toEqual(['dependsOn.1.id']);
    expect(
      issuePaths(talesPackSchema, packWith({ entities: [talent, fullPack.entities[0], talent] })),
    ).toEqual(['entities.2.id']);
  });

  it('refuses an entity type the system does not have', () => {
    expect(
      issuePaths(talesPackSchema, talentWith({ id: 'tales-core:feat/x', type: 'feat' })),
    ).toEqual(['entities.1.type']);
  });

  it('has no field for where a pack came from, and refuses unknown fields', () => {
    for (const field of ['origin', 'builtIn', 'official', 'source']) {
      expect(issuePaths(talesPackSchema, packWith({ [field]: true })), field).toEqual(['']);
    }
    expect(
      issuePaths(talesPackSchema, packWith({ license: { ...fullPack.license, free: true } })),
    ).toEqual(['license']);
    expect(
      issuePaths(talesPackSchema, packWith({ dependsOn: [{ id: 'a', optional: true }] })),
    ).toEqual(['dependsOn.0']);
  });

  it('checks a locale overlay', () => {
    expect(localeOverlaySchema.parse(overlay)).toEqual(overlay);
    const texts = (value: unknown) => ({ ...overlay, texts: value });
    expect(issuePaths(localeOverlaySchema, texts({ 'other:talent/x': { text: 'x' } }))).toEqual([
      'texts.other:talent/x',
    ]);
    expect(issuePaths(localeOverlaySchema, texts({ 'tales-core:talent/x': {} }))).toEqual([
      'texts.tales-core:talent/x',
    ]);
    expect(
      issuePaths(localeOverlaySchema, texts({ 'tales-core:talent/x': { text: ' ' } })),
    ).toEqual(['texts.tales-core:talent/x.text']);
    expect(
      issuePaths(localeOverlaySchema, texts({ 'tales-core:talent/x': { 'long-text': 'x' } })),
    ).toEqual(['texts.tales-core:talent/x.long-text']);
    expect(issuePaths(localeOverlaySchema, texts({ 'not an id': { text: 'x' } }))).toEqual([
      'texts.not an id',
    ]);
    expect(issuePaths(localeOverlaySchema, { ...overlay, locale: 'de' })).toEqual(['locale']);
    expect(issuePaths(localeOverlaySchema, { ...overlay, schemaVersion: 2 })).toEqual([
      'schemaVersion',
    ]);
    expect(issuePaths(localeOverlaySchema, { ...overlay, version: '1.0.0' })).toEqual(['']);
  });

  it('exports JSON Schema that a validator accepts valid files by', () => {
    expect(packJsonSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(packJsonSchema.title).toBe('Content pack');
    for (const pack of [fullPack, appendixPack]) {
      expect(jsonValidPack(pack), JSON.stringify(jsonValidPack.errors)).toBe(true);
    }
    expect(jsonValidOverlay(overlay), JSON.stringify(jsonValidOverlay.errors)).toBe(true);
  });

  it('carries 8 checks a refinement makes into the JSON Schema', () => {
    const refused = [
      ['a language present', packWith({ title: {} })],
      ['an http or https link', packWith({ homepage: 'javascript:alert(1)' })],
      ["the id's type equal to `type`", talentWith({ id: 'tales-core:ability/night-warden' })],
      ['no item twice in a list', packWith({ authors: ['A', 'A'] })],
      ['`fixed` or `choose`', grantWith(0, { fixed: undefined })],
      ["a filter's field", grantWith(2, { choose: { count: 1, from: {} } })],
      ['a stat change not 0', grantWith(3, { values: { grit: 0 } })],
      ['at least one stat', grantWith(3, { values: {} })],
    ] as const;
    for (const [check, pack] of refused) {
      const json = JSON.parse(JSON.stringify(pack));
      expect(talesPackSchema.safeParse(json).success, check).toBe(false);
      expect(jsonValidPack(json), check).toBe(false);
    }
    expect(jsonValidOverlay({ ...overlay, texts: { 'tales-core:talent/x': {} } })).toBe(false);
  });

  it('lists in its description the checks a JSON Schema cannot say', () => {
    const left = [
      ['entity ids unique', packWith({ entities: [talent, talent] })],
      ['grant ids unique', talentWith({ grants: [talent.grants[0], talent.grants[0]] })],
      ["a choice's count within its list", grantWith(1, { choose: { count: 2, from: ['a'] } })],
      [
        'a pattern no longer than `from`',
        grantWith(3, { mode: 'distribute', values: undefined, from: ['grit'], patterns: [[1, 1]] }),
      ],
    ] as const;
    for (const [check, pack] of left) {
      const json = JSON.parse(JSON.stringify(pack));
      expect(talesPackSchema.safeParse(json).success, check).toBe(false);
      expect(jsonValidPack(json), check).toBe(true);
    }
    expect(packJsonSchema.description).toBe(
      [
        'A content pack. The app checks these too, which this JSON Schema cannot say:',
        '- Entity ids are unique in `entities`; effect ids in `effects`; grant ids in `grants`.',
        "- A choice's `count` is no more than its list's length.",
        '- A pattern of an ability score grant has no more numbers than `from` has stats.',
      ].join('\n'),
    );
    const otherPack = { ...overlay, texts: { 'other:talent/x': { text: 'x' } } };
    expect(localeOverlaySchema.safeParse(otherPack).success).toBe(false);
    expect(jsonValidOverlay(otherPack)).toBe(true);
    expect(localeOverlayJsonSchema().description).toContain('`packId`');
  });
});

describe("ENG-39 a pack carries the version of its module's shape", () => {
  const { systemSchemaVersion: _left, ...unversioned } = fullPack;

  it("takes the module's version, and refuses any other", () => {
    expect(talesPackSchema.parse(fullPack).systemSchemaVersion).toBe(1);
    expect(issuePaths(talesPackSchema, unversioned)).toEqual(['systemSchemaVersion']);
    for (const systemSchemaVersion of [2, 0, '1', null]) {
      expect(
        issuePaths(talesPackSchema, packWith({ systemSchemaVersion })),
        String(systemSchemaVersion),
      ).toEqual(['systemSchemaVersion']);
    }
  });

  it('throws when the version cannot be right, in the words a character uses', () => {
    const parts = { system: 'tales', ruleset: tales.rulesetSchema, entity: talentSchema };
    for (const systemSchemaVersion of [0, 1.5]) {
      expect(() => packSchemaOf({ ...parts, systemSchemaVersion })).toThrow(
        `The system's schema version ${systemSchemaVersion} is not a whole number from 1.`,
      );
    }
  });

  it('puts the version in the JSON Schema as a required constant', () => {
    expect(packJsonSchema.properties?.systemSchemaVersion).toEqual({ type: 'number', const: 1 });
    expect(packJsonSchema.required).toContain('systemSchemaVersion');
    expect(jsonValidPack(unversioned)).toBe(false);
    expect(jsonValidPack(packWith({ systemSchemaVersion: 2 }))).toBe(false);
  });

  it('types the version by the number given', () => {
    expectTypeOf<z.infer<typeof talesPackSchema>['systemSchemaVersion']>().toEqualTypeOf<1>();
  });

  it("opens through the core's chain and the module's", () => {
    // The module's version 2 renames a talent's `tier` to `rank`.
    const rankedTalentSchema = tales.entityBaseSchema.safeExtend({
      type: z.literal('talent'),
      rank: z.int().min(1).max(3),
    });
    const rankedPackSchema = packSchemaOf({
      system: 'tales',
      systemSchemaVersion: 2,
      ruleset: tales.rulesetSchema,
      entity: systemEntitySchemaOf(tales, [rankedTalentSchema]),
    });
    const renameTier = vi.fn<Migration>((file) => ({
      ...file,
      entities: (file.entities as StoredObject[]).map(({ tier, ...entity }) =>
        tier === undefined ? entity : { ...entity, rank: tier },
      ),
    }));
    const openRanked = packOpenerOf(rankedPackSchema, [renameTier]);
    const { tier, ...rankedTalent } = { ...talent, rank: talent.tier };

    expect(openRanked(fullPack)).toEqual({
      ok: true,
      value: {
        ...fullPack,
        systemSchemaVersion: 2,
        entities: [fullPack.entities[0], rankedTalent],
      },
      from: { schemaVersion: 1, systemSchemaVersion: 1 },
    });
    expect(tier).toBe(2);
    expect(renameTier).toHaveBeenCalledOnce();

    renameTier.mockClear();
    expect(openRanked(packWith({ systemSchemaVersion: 3 }))).toMatchObject({
      ok: false,
      code: 'newer',
      field: 'systemSchemaVersion',
      found: 3,
      current: 2,
    });
    const opened = openRanked(unversioned);
    expect(opened.ok === false && opened.code === 'invalid' && opened.message).toContain(
      '→ at systemSchemaVersion',
    );
    expect(renameTier).not.toHaveBeenCalled();
    expect(() => packOpenerOf(rankedPackSchema, [])).toThrow(
      'The schema\'s "systemSchemaVersion" is 2, but its migrations lead to version 1.',
    );
  });
});
