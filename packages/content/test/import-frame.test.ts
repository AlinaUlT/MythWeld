import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  entityIdOf,
  type Importer,
  type ImportInput,
  PACK_OF,
  RULESETS,
  runImport,
  type SourceEntry,
  slugOf,
  textOf,
} from '../src/import/frame.ts';
import { importers } from '../src/import/registry.ts';
import { readSourceFile, SOURCE_DIR, sourceFileName } from '../src/import/source.ts';
import { verifySource } from '../src/source/fetch-source.ts';

// CONT-04: the import frame. Control values: ENG-02 §11 (the 4,428 indexes of the source at
// `e6edf9a`, the 11 that are not slugs and their mapping), SPEC §3.2 (the two text shapes), and
// the measurement of `desc` kept as one string (206 entries, CONT-04 §8). Entities made up here
// hold no rules text.

describe('CONT-04 slugOf', () => {
  it('maps the 11 indexes that are not slugs, as ENG-02 §11 names them', () => {
    const dragons: [string, string][] = [
      ['black', 'acid'],
      ['blue', 'lightning'],
      ['brass', 'fire'],
      ['bronze', 'lightning'],
      ['copper', 'acid'],
      ['gold', 'fire'],
      ['green', 'poison'],
      ['red', 'fire'],
      ['silver', 'cold'],
      ['white', 'cold'],
    ];
    for (const [color, damage] of dragons) {
      expect(slugOf(`dragon-ancestor-${color}---${damage}-damage`)).toBe(
        `dragon-ancestor-${color}-${damage}-damage`,
      );
    }
    expect(slugOf('stone-of-good-luck-(luckstone)')).toBe('stone-of-good-luck-luckstone');
  });

  it('leaves a slug as it is', () => {
    expect(slugOf('fireball')).toBe('fireball');
    expect(slugOf('savage-attacker')).toBe('savage-attacker');
    expect(slugOf('barbarian-1')).toBe('barbarian-1');
  });

  it('refuses an index it cannot name, rather than import it under a wrong id', () => {
    for (const bad of ['', 'Fire Ball', 'a--', '-a', 'a_b', '(--)']) {
      expect(() => slugOf(bad)).toThrow(/does not map to a slug/);
    }
  });

  it('builds an id of the pack, the type and the slug', () => {
    expect(entityIdOf('srd-2014', 'feature', 'dragon-ancestor-black---acid-damage')).toBe(
      'srd-2014:feature/dragon-ancestor-black-acid-damage',
    );
    expect(PACK_OF).toEqual({ '2014': 'srd-2014', '2024': 'srd-2024' });
  });
});

describe('CONT-04 textOf', () => {
  it('reads SRD 5.1 text kept as a list of paragraphs, with a blank line between them', () => {
    expect(textOf({ index: 'a', desc: ['First.', 'Second.'] })).toBe('First.\n\nSecond.');
  });

  it('reads SRD 5.1 text kept as one string', () => {
    expect(textOf({ index: 'a', desc: 'One string.' })).toBe('One string.');
  });

  it('reads SRD 5.2.1 text, kept in `description`', () => {
    expect(textOf({ index: 'a', description: 'Described.' })).toBe('Described.');
  });

  it('prefers `description` when an entry has both', () => {
    expect(textOf({ index: 'a', desc: ['Old.'], description: 'New.' })).toBe('New.');
  });

  it('drops an empty paragraph, and gives nothing for an entry with no words', () => {
    expect(textOf({ index: 'a', desc: ['One.', '', '  ', 'Two.'] })).toBe('One.\n\nTwo.');
    expect(textOf({ index: 'a', desc: [] })).toBeUndefined();
    expect(textOf({ index: 'a', desc: [''] })).toBeUndefined();
    expect(textOf({ index: 'a', description: '  ' })).toBeUndefined();
    expect(textOf({ index: 'a' })).toBeUndefined();
  });
});

// A made-up importer for the frame's own tests: damage types, which have no fields of their own.
const entry = (index: string): SourceEntry => ({ index, name: `Made up ${index}` });
const damageType = (id: string, key: string, extra: object = {}) => ({
  id,
  type: 'damageType',
  key,
  ruleset: '2014',
  name: { en: 'Made up' },
  source: { pack: 'srd-2014' },
  ...extra,
});
const read = (_ruleset: string, file: string): readonly SourceEntry[] =>
  file === 'Made' ? [entry('one'), entry('two')] : [];

function made(run: Importer['run'], types: readonly string[] = ['damageType']): Importer {
  return { types, files: { '2014': ['Made'], '2024': [] }, run };
}

describe('CONT-04 runImport', () => {
  it('hands an importer its files, and keeps every entity that passes the schema', () => {
    let given: ImportInput | undefined;
    const result = runImport({
      ruleset: '2014',
      read,
      importers: {
        one: made((input) => {
          given = input;
          return (
            input.files.Made?.map((e) =>
              damageType(entityIdOf(input.packId, 'damageType', e.index), e.index),
            ) ?? []
          );
        }),
      },
    });
    expect(given?.packId).toBe('srd-2014');
    expect(given?.ruleset).toBe('2014');
    expect(Object.keys(given?.files ?? {})).toEqual(['Made']);
    expect(result.problems).toEqual([]);
    expect(result.entities.map((e) => e.id)).toEqual([
      'srd-2014:damageType/one',
      'srd-2014:damageType/two',
    ]);
  });

  it('refuses an entity the schema refuses, with the path of each issue, and goes on', () => {
    const result = runImport({
      ruleset: '2014',
      read,
      importers: {
        one: made(() => [
          damageType('srd-2014:damageType/bad', 'bad', { name: {} }),
          damageType('srd-2014:damageType/good', 'good'),
          { type: 'nothing' },
          null,
        ]),
      },
    });
    expect(result.entities.map((e) => e.id)).toEqual(['srd-2014:damageType/good']);
    expect(result.problems).toHaveLength(3);
    expect(result.problems[0]).toMatchObject({ importer: 'one', id: 'srd-2014:damageType/bad' });
    expect(result.problems[0]?.message).toContain('name: Needs at least one language.');
    expect(result.problems[1]?.id).toBeUndefined();
    expect(result.problems[2]?.id).toBeUndefined();
  });

  it("refuses an id of another ruleset's pack", () => {
    const result = runImport({
      ruleset: '2014',
      read,
      importers: { one: made(() => [damageType('srd-2024:damageType/x', 'x')]) },
    });
    expect(result.entities).toEqual([]);
    expect(result.problems).toEqual([
      {
        importer: 'one',
        id: 'srd-2024:damageType/x',
        message: 'The id is not of the pack "srd-2014".',
      },
    ]);
  });

  it('refuses a type its importer does not name', () => {
    const result = runImport({
      ruleset: '2014',
      read,
      importers: { one: made(() => [damageType('srd-2014:damageType/x', 'x')], ['language']) },
    });
    expect(result.entities).toEqual([]);
    expect(result.problems[0]?.message).toBe('The importer does not name the type "damageType".');
  });

  it('refuses an id made twice, within an importer and across two', () => {
    const twice = () => [
      damageType('srd-2014:damageType/x', 'x'),
      damageType('srd-2014:damageType/x', 'x'),
    ];
    const result = runImport({
      ruleset: '2014',
      read,
      importers: { one: made(twice), two: made(() => [damageType('srd-2014:damageType/x', 'x')]) },
    });
    expect(result.entities.map((e) => e.id)).toEqual(['srd-2014:damageType/x']);
    expect(result.problems.map((p) => [p.importer, p.message])).toEqual([
      ['one', 'The id is made twice.'],
      ['two', 'The id is made twice.'],
    ]);
  });

  it('reads only the files of the ruleset it runs for', () => {
    const asked: string[] = [];
    runImport({
      ruleset: '2024',
      read: (ruleset, file) => {
        asked.push(`${ruleset}/${file}`);
        return [];
      },
      importers: {
        one: { types: [], files: { '2014': ['A'], '2024': ['B', 'C'] }, run: () => [] },
      },
    });
    expect(asked).toEqual(['2024/B', '2024/C']);
  });
});

describe('CONT-04 the registry', () => {
  it('has one importer file for each row of wave 2 and wave 3 that imports, each in the Importer shape', () => {
    expect(Object.keys(importers)).toEqual([
      'spells',
      'classes',
      'species',
      'backgrounds',
      'feats',
      'equipment',
      'magicItems',
      'smallTypes',
      'rules',
      'monsters',
    ]);
    for (const importer of Object.values(importers)) {
      expect(Array.isArray(importer.types)).toBe(true);
      expect(RULESETS.every((ruleset) => Array.isArray(importer.files[ruleset]))).toBe(true);
      expect(typeof importer.run).toBe('function');
    }
  });

  it.each(RULESETS)('runs over the source for %s with no problem', (ruleset) => {
    const result = runImport({
      ruleset,
      importers,
      read: (rs, file) => readSourceFile(rs, file),
    });
    expect(result.problems).toEqual([]);
  });
});

describe('CONT-04 the source, as fetched', () => {
  beforeAll(() => {
    const problems = verifySource(SOURCE_DIR);
    if (problems.length > 0) {
      throw new Error(
        `The import source is not in place (${problems[0]}): run \`pnpm fetch-source\`.`,
      );
    }
  });

  // CONT-73: the fetch adds SRD 5.2.1's `Rules` to its folder, derived from the PDF. These counts
  // are of 5e-database's own files, so that one is left out.
  const files = (ruleset: string) =>
    readdirSync(join(SOURCE_DIR, ruleset))
      .filter((name) => name.endsWith('.json'))
      .filter((name) => !(ruleset === '2024' && name === '5e-SRD-Rules.json'))
      .map((name) => name.slice('5e-SRD-'.length, -'.json'.length));

  const everyEntry = RULESETS.flatMap((ruleset) =>
    existsSync(join(SOURCE_DIR, ruleset))
      ? files(ruleset).map((file) => ({ ruleset, file, entries: readSourceFile(ruleset, file) }))
      : [],
  );

  it('holds 24 files for SRD 5.1 and 25 for SRD 5.2.1, each read through its short name', () => {
    expect(files('2014')).toHaveLength(24);
    expect(files('2024')).toHaveLength(25);
    expect(sourceFileName('Spells')).toBe('5e-SRD-Spells.json');
    expect(readSourceFile('2014', 'Spells').length).toBeGreaterThan(0);
    expect(() => readSourceFile('2014', 'Nothing')).toThrow(/pnpm fetch-source/);
  });

  it('has 4,428 entries, 4,417 with a slug already and 11 that the mapping names', () => {
    const indexes = everyEntry.flatMap(({ entries }) => entries.map((e) => e.index));
    expect(indexes).toHaveLength(4428);
    const changed = indexes.filter((index) => slugOf(index) !== index);
    expect(changed).toHaveLength(11);
    expect(changed.filter((index) => index.includes('---'))).toHaveLength(10);
    expect(changed.filter((index) => index.includes('('))).toEqual([
      'stone-of-good-luck-(luckstone)',
    ]);
  });

  it('keeps every entry of a file under an id of its own', () => {
    for (const { file, entries } of everyEntry) {
      const slugs = entries.map((e) => slugOf(e.index));
      expect(new Set(slugs).size, file).toBe(slugs.length);
    }
  });

  it('reads the text of every entry that has any, in one of the three shapes', () => {
    let asString = 0;
    for (const { ruleset, file, entries } of everyEntry) {
      for (const e of entries) {
        if (typeof e.desc === 'string') asString += 1;
        const words = [e.desc, e.description]
          .flat()
          .filter((t): t is string => typeof t === 'string');
        const text = textOf(e);
        if (words.some((t) => /\S/.test(t))) {
          expect(text, `${ruleset}/${file}/${e.index}`).toMatch(/\S/);
          expect(text).not.toContain('\n\n\n');
        } else expect(text).toBeUndefined();
      }
    }
    // SRD 5.1 keeps `desc` as one string for 206 entries: 134 rules, 45 monsters, 9 alignments, 8
    // schools of magic, 6 languages and 4 subraces (measured, CONT-04 §8).
    expect(asString).toBe(206);
  });
});
