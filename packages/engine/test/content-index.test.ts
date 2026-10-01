import {
  compareVersions,
  type IndexedEntity,
  type LoadedContent,
  loadContentIndex,
  type PackToLoad,
} from '@grimoire/engine';
import {
  packSchemaOf,
  systemEntitySchemaOf,
  systemListsOf,
  systemSchemasOf,
} from '@grimoire/schema';
import { describe, expect, expectTypeOf, it } from 'vitest';

// A made-up system: two editions and the core's types only. No real game (ADR 004 item 4).
const tales = systemSchemasOf(
  systemListsOf({
    editions: ['first-age', 'second-age'],
    proficiencyCategories: ['lore'],
    proficiencyLevels: [1],
    recoveryEvents: ['scene'],
  }),
  [],
);
const talesPackSchema = packSchemaOf({
  system: 'tales',
  systemSchemaVersion: 1,
  ruleset: tales.rulesetSchema,
  entity: systemEntitySchemaOf(tales, []),
});
type TalesPack = ReturnType<typeof talesPackSchema.parse>;
type TalesEntity = TalesPack['entities'][number];

/** A pack of the made-up system, parsed by its schema. */
function pack(id: string, entities: readonly object[], change: object = {}): TalesPack {
  return talesPackSchema.parse({
    id,
    version: '1.0.0',
    schemaVersion: 1,
    system: 'tales',
    systemSchemaVersion: 1,
    title: { en: 'Made up' },
    ruleset: 'any',
    license: { name: 'Made up for a test', redistributable: false },
    entities,
    ...change,
  });
}

/** A stat of the made-up system. */
function stat(id: string, key: string, ruleset: string, name: object, change: object = {}) {
  const pack = id.slice(0, id.indexOf(':'));
  return {
    id,
    type: 'ability',
    key,
    ruleset,
    name,
    abbr: { en: 'X' },
    order: 0,
    source: { pack },
    ...change,
  };
}

/** A skill of the made-up system, tied to `grit`. */
function skill(id: string, key: string, ruleset: string, name: object) {
  const pack = id.slice(0, id.indexOf(':'));
  return { id, type: 'skill', key, ruleset, name, ability: 'grit', source: { pack } };
}

const grit = stat(
  'tales-core:ability/grit',
  'grit',
  'any',
  { en: 'Grit', ru: 'Стойкость' },
  {
    aliases: [{ en: 'Toughness' }],
  },
);
const climb = skill('tales-core:skill/climb', 'climb', 'first-age', { en: 'Climb' });
const climbAnew = skill('tales-core:skill/climb-anew', 'climb', 'second-age', { en: 'Climb' });
const dazed = {
  id: 'tales-core:condition/dazed',
  type: 'condition',
  ruleset: 'any',
  name: { en: 'Dazed' },
  source: { pack: 'tales-core' },
};
const wits = stat(
  'tales-extra:ability/wits',
  'wits',
  'any',
  { en: 'Wits', ru: 'Смекалка' },
  {
    aliases: [{ en: 'Cunning', ru: 'Хитрость' }, { en: 'wits' }],
  },
);

const core = pack('tales-core', [grit, climb, climbAnew, dazed], { version: '1.4.0' });
const extra = pack('tales-extra', [wits], { dependsOn: [{ id: 'tales-core', version: '1.2.0' }] });

/** A pack with no entities that needs `needs`, in that order. */
function needing(id: string, ...needs: string[]): TalesPack {
  return pack(id, [], needs.length > 0 ? { dependsOn: needs.map((need) => ({ id: need })) } : {});
}

/** `value` and everything in it, frozen. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** What a load gives, with the index's lookups read into plain data. */
function dataOf(content: LoadedContent<IndexedEntity>) {
  const { index, loaded, refused, warnings } = content;
  return {
    loaded,
    refused,
    warnings,
    entities: index.entities,
    en: [...index.names('en')],
    ru: [...index.names('ru')],
  };
}

describe('ENG-25 packs load into the content index', () => {
  it('loads packs in order, every entity by pack, then in its pack', () => {
    const { index, loaded, refused, warnings } = loadContentIndex('tales', [core, extra]);
    expect(loaded).toEqual(['tales-core', 'tales-extra']);
    expect(refused).toEqual([]);
    expect(warnings).toEqual([]);
    expect(index.entities.map((entity) => entity.id)).toEqual([
      'tales-core:ability/grit',
      'tales-core:skill/climb',
      'tales-core:skill/climb-anew',
      'tales-core:condition/dazed',
      'tales-extra:ability/wits',
    ]);
    expect(index.get('tales-extra:ability/wits')).toEqual({ ok: true, entity: wits });
  });

  it('gives `missing` for an id it lacks, never a throw', () => {
    const { index } = loadContentIndex('tales', [core]);
    for (const id of ['tales-core:ability/luck', 'tales-maps:ability/grit', 'not an id', '']) {
      expect(index.get(id)).toEqual({ ok: false, code: 'missing', id, message: `Missing: ${id}` });
    }
  });

  it('refuses a pack id given twice, and keeps the first', () => {
    const second = pack('tales-core', [
      stat('tales-core:ability/luck', 'luck', 'any', { en: 'Luck' }),
    ]);
    const { index, loaded, refused } = loadContentIndex('tales', [core, second]);
    expect(loaded).toEqual(['tales-core']);
    expect(refused).toEqual([
      {
        pack: 'tales-core',
        code: 'repeatedPack',
        message: 'The pack "tales-core" is given twice; only the first can load.',
      },
    ]);
    expect(index.get('tales-core:ability/luck').ok).toBe(false);
    expect(index.get('tales-core:ability/grit')).toEqual({ ok: true, entity: grit });
  });

  it("refuses the pack id of a character's own entities", () => {
    const { loaded, refused } = loadContentIndex('tales', [needing('character'), core]);
    expect(loaded).toEqual(['tales-core']);
    expect(refused).toEqual([
      {
        pack: 'character',
        code: 'reservedId',
        message: `The pack id "character" is the id of a character's own entities.`,
      },
    ]);
  });

  it('refuses a pack of another system', () => {
    const sagas = {
      ...pack('sagas-core', [stat('sagas-core:ability/grit', 'grit', 'any', { en: 'Grit' })]),
      system: 'sagas',
    };
    const { index, loaded, refused } = loadContentIndex('tales', [core, sagas]);
    expect(loaded).toEqual(['tales-core']);
    expect(refused).toEqual([
      {
        pack: 'sagas-core',
        code: 'otherSystem',
        system: 'sagas',
        message: 'The pack "sagas-core" is of the system "sagas", not "tales".',
      },
    ]);
    expect(index.get('sagas-core:ability/grit').ok).toBe(false);
  });

  it("refuses a pack holding another pack's id, so it never replaces that entry", () => {
    const fake = { ...grit, name: { en: 'Fake grit' }, source: { pack: 'tales-fake' } };
    const faker = pack('tales-fake', [
      stat('tales-fake:ability/luck', 'luck', 'any', { en: 'Luck' }),
      fake,
    ]);
    for (const order of [
      [core, faker],
      [faker, core],
    ]) {
      const { index, loaded, refused } = loadContentIndex('tales', order);
      expect(loaded).toEqual(['tales-core']);
      expect(refused).toEqual([
        {
          pack: 'tales-fake',
          code: 'foreignEntity',
          entity: 'tales-core:ability/grit',
          message: 'The pack "tales-fake" holds "tales-core:ability/grit", an id of another pack.',
        },
      ]);
      expect(index.get('tales-core:ability/grit')).toEqual({ ok: true, entity: grit });
      expect(index.get('tales-fake:ability/luck').ok).toBe(false);
    }
  });

  it('refuses every pack on a loop of dependencies, naming the loop', () => {
    const twoPacks = loadContentIndex('tales', [
      needing('tales-a', 'tales-b'),
      needing('tales-b', 'tales-a'),
    ]);
    expect(twoPacks.loaded).toEqual([]);
    expect(twoPacks.refused).toEqual([
      {
        pack: 'tales-a',
        code: 'dependencyLoop',
        loop: ['tales-a', 'tales-b', 'tales-a'],
        message: 'The pack "tales-a" is on a loop of dependencies: tales-a → tales-b → tales-a.',
      },
      {
        pack: 'tales-b',
        code: 'dependencyLoop',
        loop: ['tales-b', 'tales-a', 'tales-b'],
        message: 'The pack "tales-b" is on a loop of dependencies: tales-b → tales-a → tales-b.',
      },
    ]);

    const itself = loadContentIndex('tales', [needing('tales-a', 'tales-a')]);
    expect(
      itself.refused.map((refusal) => refusal.code === 'dependencyLoop' && refusal.loop),
    ).toEqual([['tales-a', 'tales-a']]);

    // `tales-c` is on a loop only through a side path: c → b → a → c.
    const sidePath = loadContentIndex('tales', [
      needing('tales-a', 'tales-b', 'tales-c'),
      needing('tales-b', 'tales-a'),
      needing('tales-c', 'tales-b'),
    ]);
    expect(
      sidePath.refused.map((refusal) => refusal.code === 'dependencyLoop' && refusal.loop),
    ).toEqual([
      ['tales-a', 'tales-b', 'tales-a'],
      ['tales-b', 'tales-a', 'tales-b'],
      ['tales-c', 'tales-b', 'tales-a', 'tales-c'],
    ]);
  });

  it('loads a pack whose dependency is missing or refused, with a warning', () => {
    const { index, loaded, refused, warnings } = loadContentIndex('tales', [
      needing('tales-a', 'tales-b'),
      needing('tales-b', 'tales-a'),
      needing('tales-c', 'tales-a', 'tales-maps', 'tales-core'),
      core,
    ]);
    expect(loaded).toEqual(['tales-c', 'tales-core']);
    expect(refused.map((refusal) => refusal.pack)).toEqual(['tales-a', 'tales-b']);
    expect(warnings).toEqual([
      {
        pack: 'tales-c',
        code: 'missingDependency',
        dependency: 'tales-a',
        message: 'The pack "tales-c" needs "tales-a", which is not loaded.',
      },
      {
        pack: 'tales-c',
        code: 'missingDependency',
        dependency: 'tales-maps',
        message: 'The pack "tales-c" needs "tales-maps", which is not loaded.',
      },
    ]);
    expect(index.get('tales-maps:ability/grit')).toMatchObject({ ok: false, code: 'missing' });
  });

  it('warns when a dependency is older than the version asked', () => {
    const warningsFor = (found: string) =>
      loadContentIndex('tales', [{ ...core, version: found }, extra]).warnings;
    for (const found of ['1.0.0-beta.1', '1.1.0']) {
      expect(warningsFor(found)).toEqual([
        {
          pack: 'tales-extra',
          code: 'olderDependency',
          dependency: 'tales-core',
          needed: '1.2.0',
          found,
          message: `The pack "tales-extra" needs "tales-core" 1.2.0 or later; ${found} is loaded.`,
        },
      ]);
    }
    for (const found of ['1.2.0', '1.10.0', '2.0.0-alpha']) {
      expect(warningsFor(found)).toEqual([]);
    }
  });

  it('warns on a key repeated in one ruleset, and keeps the first', () => {
    const repeats = pack('tales-more', [
      stat('tales-more:ability/grit-again', 'grit', 'first-age', { en: 'Grit again' }),
      skill('tales-more:skill/climb-again', 'climb', 'first-age', { en: 'Climb again' }),
      skill('tales-more:skill/climb-twice', 'climb', 'any', { en: 'Climb twice' }),
      // Not repeats: the key in another type; the key in each edition.
      skill('tales-more:skill/grit', 'grit', 'first-age', { en: 'Grit' }),
      stat('tales-more:ability/nerve', 'nerve', 'first-age', { en: 'Nerve' }),
      stat('tales-more:ability/nerve-anew', 'nerve', 'second-age', { en: 'Nerve' }),
    ]);
    const { index, loaded, warnings } = loadContentIndex('tales', [core, repeats]);
    expect(loaded).toEqual(['tales-core', 'tales-more']);
    expect(warnings).toEqual([
      {
        pack: 'tales-more',
        code: 'repeatedKey',
        type: 'ability',
        key: 'grit',
        entity: 'tales-more:ability/grit-again',
        kept: 'tales-core:ability/grit',
        message:
          '"tales-more:ability/grit-again" repeats the ability key "grit" of "tales-core:ability/grit" in one ruleset; "tales-core:ability/grit" is kept.',
      },
      expect.objectContaining({
        entity: 'tales-more:skill/climb-again',
        kept: 'tales-core:skill/climb',
      }),
      expect.objectContaining({
        entity: 'tales-more:skill/climb-twice',
        kept: 'tales-core:skill/climb',
      }),
    ]);
    expect(index.withKey('skill', 'climb').map((entity) => entity.id)).toEqual([
      'tales-core:skill/climb',
      'tales-core:skill/climb-anew',
      'tales-more:skill/climb-again',
      'tales-more:skill/climb-twice',
    ]);

    const onePack = loadContentIndex('tales', [
      pack('tales-more', [
        stat('tales-more:ability/nerve', 'nerve', 'first-age', { en: 'Nerve' }),
        stat('tales-more:ability/nerve-again', 'nerve', 'first-age', { en: 'Nerve' }),
      ]),
    ]);
    expect(onePack.warnings).toEqual([
      expect.objectContaining({
        code: 'repeatedKey',
        entity: 'tales-more:ability/nerve-again',
        kept: 'tales-more:ability/nerve',
      }),
    ]);
  });

  it("finds an entry's copy in the other edition by type and key", () => {
    const { index } = loadContentIndex('tales', [core, extra]);
    expect(index.copiesOf('tales-core:skill/climb')).toEqual([climbAnew]);
    expect(index.copiesOf('tales-core:skill/climb-anew')).toEqual([climb]);
    expect(index.copiesOf('tales-core:ability/grit')).toEqual([]);
    expect(index.copiesOf('tales-core:condition/dazed')).toEqual([]);
    expect(index.copiesOf('tales-core:skill/swim')).toEqual([]);
    expect(index.withKey('ability', 'wits')).toEqual([wits]);
    expect(index.withKey('skill', 'wits')).toEqual([]);
  });

  it('keeps names and aliases per language, lowercased in it', () => {
    const { index } = loadContentIndex('tales', [core, extra]);
    expect([...index.names('en')]).toEqual([
      ['grit', ['tales-core:ability/grit']],
      ['toughness', ['tales-core:ability/grit']],
      ['climb', ['tales-core:skill/climb', 'tales-core:skill/climb-anew']],
      ['dazed', ['tales-core:condition/dazed']],
      ['wits', ['tales-extra:ability/wits']],
      ['cunning', ['tales-extra:ability/wits']],
    ]);
    expect([...index.names('ru')]).toEqual([
      ['стойкость', ['tales-core:ability/grit']],
      ['смекалка', ['tales-extra:ability/wits']],
      ['хитрость', ['tales-extra:ability/wits']],
    ]);
    const englishOnly = {
      ...dazed,
      id: 'tales-maps:condition/dazed',
      source: { pack: 'tales-maps' },
    };
    const maps = loadContentIndex('tales', [pack('tales-maps', [englishOnly])]).index;
    expect(maps.names('en').get('dazed')).toEqual(['tales-maps:condition/dazed']);
    expect(maps.names('ru').size).toBe(0);
  });

  it('changes none of its packs, and gives equal results for equal packs', () => {
    const packs = () => [
      core,
      extra,
      needing('tales-a', 'tales-a'),
      needing('tales-c', 'tales-maps'),
    ];
    const frozen = deepFreeze(structuredClone(packs()));
    const first = loadContentIndex('tales', frozen);
    expect(frozen).toEqual(packs());
    expect(dataOf(first)).toEqual(dataOf(loadContentIndex('tales', packs())));
  });

  it("keeps the system's own entity type", () => {
    const { index } = loadContentIndex('tales', [core]);
    expectTypeOf<TalesPack>().toExtend<PackToLoad<TalesEntity>>();
    expectTypeOf(index.entities).toEqualTypeOf<readonly TalesEntity[]>();
    const found = index.get('tales-core:ability/grit');
    if (found.ok) expectTypeOf(found.entity).toEqualTypeOf<TalesEntity>();
  });
});

describe('ENG-25 dependency versions', () => {
  it("orders semver 2.0.0's examples", () => {
    const chains = [
      ['1.0.0', '2.0.0', '2.1.0', '2.1.1'],
      [
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-alpha.beta',
        '1.0.0-beta',
        '1.0.0-beta.2',
        '1.0.0-beta.11',
        '1.0.0-rc.1',
        '1.0.0',
      ],
      ['1.9.0', '1.10.0', '10.0.0', '99999999999999999999.0.0'],
      // Digits by number, then below letters and hyphens, though `-` and `1` sort first as text.
      ['1.0.0-0', '1.0.0-9', '1.0.0-10', '1.0.0-99', '1.0.0--', '1.0.0-1a', '1.0.0-A', '1.0.0-a'],
      ['1.0.0-a', '1.0.0-a.0', '1.0.0-a.0.0', '1.0.0-a-b'],
    ];
    for (const chain of chains) {
      for (const [i, a] of chain.entries()) {
        for (const [j, b] of chain.entries()) {
          expect(compareVersions(a, b), `${a} vs ${b}`).toBe(Math.sign(i - j));
        }
      }
    }
  });

  it('throws on a text that is not a version', () => {
    expect(() => compareVersions('1.0', '1.0.0')).toThrow('"1.0" is not a semver version.');
    expect(() => compareVersions('1.0.0', '1.0.0-01')).toThrow(
      '"1.0.0-01" is not a semver version.',
    );
  });
});
