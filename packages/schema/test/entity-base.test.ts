import {
  type EntityBase,
  entityBaseSchema,
  entityIdSchema,
  entityKeySchema,
  l10nSchema,
  parseEntityId,
} from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Made-up entities of a made-up game; no rules text from any real one.
const minimal: EntityBase = {
  id: 'tales:stat/grit',
  type: 'stat',
  ruleset: 'any',
  name: { en: 'Grit' },
  source: { pack: 'tales' },
};

const full: EntityBase = {
  id: 'tales:stat/nerve',
  type: 'stat',
  key: 'nerve',
  ruleset: 'first-age',
  name: { en: 'Nerve', ru: 'Выдержка' },
  aliases: [{ en: 'Steadiness' }, { ru: 'Хладнокровие' }],
  summary: { en: 'How calm you stay.' },
  text: { en: 'A made-up stat for a made-up game.', ru: 'Выдуманная характеристика.' },
  tags: ['mental', 'core'],
  source: {
    pack: 'tales',
    page: '12',
    book: 'Tales Rulebook',
    author: 'Nobody',
    license: 'CC-BY-4.0',
    links: ['https://example.org/nerve', 'http://example.org/nerve'],
  },
  meta: { translation: 'reviewed', variantOf: 'tales:stat/grit', manual: true },
};

/** The paths of every issue when `value` is parsed as an entity, or `[]` when it passes. */
function issuePaths(value: unknown): string[] {
  const result = entityBaseSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('ENG-02 entity base', () => {
  it('accepts the ids of SPEC §5.1 and Appendix Д', () => {
    for (const id of [
      'srd-2024:feat/alert',
      'hb-local:skill/occultism',
      'hb-local:ability/san',
      'hb-local:feat/arcane-scholar',
      'srd-2014:damageType/fire',
    ]) {
      expect(entityIdSchema.safeParse(id).success, id).toBe(true);
    }
  });

  it('refuses a malformed id', () => {
    for (const id of [
      'SRD:feat/alert',
      'srd:feat/Alert',
      'srd:feat/a/b',
      'srd:feat/',
      ':feat/a',
      'srd:Feat/a',
      'srd:feat/a--b',
      'srd-:feat/a',
      'srd feat/a',
      'srd:feat',
      '',
    ]) {
      expect(entityIdSchema.safeParse(id).success, id).toBe(false);
    }
  });

  it('splits an id into its parts', () => {
    expect(parseEntityId('srd-2024:feat/alert')).toEqual({
      pack: 'srd-2024',
      type: 'feat',
      slug: 'alert',
    });
    expect(parseEntityId('srd-2014:damageType/fire')).toEqual({
      pack: 'srd-2014',
      type: 'damageType',
      slug: 'fire',
    });
    expect(parseEntityId('srd:feat/a/b')).toBeUndefined();
    expect(parseEntityId('alert')).toBeUndefined();
  });

  it('parses a valid entity to an equal object, nothing added or dropped', () => {
    expect(entityBaseSchema.parse(minimal)).toEqual(minimal);
    expect(entityBaseSchema.parse(full)).toEqual(full);
  });

  it('refuses an id that names another type', () => {
    expect(issuePaths({ ...minimal, id: 'hb-local:skill/occultism', type: 'ability' })).toEqual([
      'id',
    ]);
  });

  it('takes en and ru only, at least one, each with visible text', () => {
    expect(l10nSchema.safeParse({ ru: 'Выдержка' }).success).toBe(true);
    for (const name of [{}, { de: 'x' }, { en: 'Grit', de: 'x' }, { en: '' }, { en: '  ' }]) {
      expect(issuePaths({ ...minimal, name })[0], JSON.stringify(name)).toMatch(/^name/);
    }
    expect(issuePaths({ ...minimal, name: 'Grit' })).toEqual(['name']);
  });

  it('takes any edition id as ruleset, since the core names no game', () => {
    for (const ruleset of ['any', '2014', '2024', 'first-age']) {
      expect(issuePaths({ ...minimal, ruleset }), ruleset).toEqual([]);
    }
    for (const ruleset of ['', 'Any', 'first age']) {
      expect(issuePaths({ ...minimal, ruleset }), ruleset).toEqual(['ruleset']);
    }
    const { ruleset: _, ...withoutRuleset } = minimal;
    expect(issuePaths(withoutRuleset)).toEqual(['ruleset']);
  });

  it('takes a key that can be one step of a formula path', () => {
    for (const key of ['str', 'san', 'sleightOfHand', 'd20']) {
      expect(entityKeySchema.safeParse(key).success, key).toBe(true);
    }
    for (const key of ['Str', 'sleight-of-hand', 'sleight_of_hand', '1st', '', 'a.b']) {
      expect(issuePaths({ ...minimal, key }), key).toEqual(['key']);
    }
  });

  it('takes exactly the four translation labels of SPEC §5.2', () => {
    for (const translation of ['official', 'community', 'machine', 'reviewed']) {
      expect(issuePaths({ ...minimal, meta: { translation } }), translation).toEqual([]);
    }
    for (const translation of ['auto', 'Official', '']) {
      expect(issuePaths({ ...minimal, meta: { translation } }), translation).toEqual([
        'meta.translation',
      ]);
    }
  });

  it('refuses meta.foundry, a bad variantOf and a non-boolean manual', () => {
    expect(issuePaths({ ...minimal, meta: { foundry: { identifier: 'grit' } } })).toEqual(['meta']);
    expect(issuePaths({ ...minimal, meta: { variantOf: 'grit' } })).toEqual(['meta.variantOf']);
    expect(issuePaths({ ...minimal, meta: { manual: 'yes' } })).toEqual(['meta.manual']);
  });

  it('checks source: a pack id, text fields, http and https links only', () => {
    expect(issuePaths({ ...minimal, source: {} })).toEqual(['source.pack']);
    expect(issuePaths({ ...minimal, source: { pack: 'Tales Pack' } })).toEqual(['source.pack']);
    expect(issuePaths({ ...minimal, source: { pack: 'tales', book: '' } })).toEqual([
      'source.book',
    ]);
    for (const link of ['javascript:alert(1)', 'ftp://example.org', 'example.org', 'https://']) {
      expect(issuePaths({ ...minimal, source: { pack: 'tales', links: [link] } }), link).toEqual([
        'source.links.0',
      ]);
    }
  });

  it('refuses a field it does not name, at every level', () => {
    expect(issuePaths({ ...minimal, effect: [] })).toEqual(['']);
    expect(issuePaths({ ...minimal, rulset: 'any' })).toEqual(['']);
    expect(
      issuePaths({ ...minimal, source: { pack: 'tales', url: 'https://example.org' } }),
    ).toEqual(['source']);
    expect(issuePaths({ ...minimal, meta: { manaul: true } })).toEqual(['meta']);
  });

  it('can be exported as JSON Schema', () => {
    const schema = z.toJSONSchema(entityBaseSchema);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['id', 'type', 'ruleset', 'name', 'source']);
  });
});
