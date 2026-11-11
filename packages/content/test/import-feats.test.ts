import { describe, expect, it } from 'vitest';
import { feats } from '../src/import/feats.ts';
import { PACK_OF, RULESETS, type Ruleset, runImport } from '../src/import/frame.ts';
import { smallTypes } from '../src/import/smallTypes.ts';
import { readSourceFile } from '../src/import/source.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-11: the feats. Control values are measured from the fetched source at `e6edf9a` by a script
// outside the repository (CONT-11 §8). No rules text is written here: the test asserts ids, keys,
// counts and shapes.

interface Feat {
  id: string;
  type: string;
  name: { en: string };
  text?: { en: string };
  category?: string;
  repeatable?: boolean;
  prerequisites?: Record<string, unknown>[];
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({
      ruleset,
      importers: { smallTypes, feats },
      read: (rs, file) => readSourceFile(rs, file),
    }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const made = (ruleset: Ruleset) =>
  run[ruleset].entities.filter((e) => e.type === 'feat') as unknown as Feat[];
const slug = (feat: Feat) => feat.id.split('/')[1];
const feat = (ruleset: Ruleset, name: string): Feat => {
  const found = made(ruleset).find((e) => e.id === `${PACK_OF[ruleset]}:feat/${name}`);
  if (found === undefined) throw new Error(`${name} is not imported`);
  return found;
};

describe.each(RULESETS)('CONT-11 the feats of %s', (ruleset) => {
  it('passes the frame with no problem', () => {
    expect(run[ruleset].problems).toEqual([]);
  });

  it('makes one feat for each entry of the file, under its slug, with its name and words', () => {
    const source = readSourceFile(ruleset, 'Feats');
    expect(made(ruleset).map(slug)).toEqual(source.map((e) => e.index));
    expect(made(ruleset).map((f) => f.name.en)).toEqual(source.map((e) => e.name));
    for (const f of made(ruleset)) expect(f.text?.en, f.id).toMatch(/\S/);
  });
});

describe('CONT-11 SRD 5.1', () => {
  it('has one feat, Grappler, which needs Strength 13 and has no category', () => {
    expect(made('2014')).toHaveLength(1);
    const grappler = feat('2014', 'grappler');
    expect(grappler.prerequisites).toEqual([{ kind: 'ability', key: 'str', min: 13 }]);
    expect(grappler.category).toBeUndefined();
    expect(grappler.repeatable).toBeUndefined();
  });
});

describe('CONT-11 SRD 5.2.1', () => {
  const all = made('2024');

  it('has seventeen feats: 4 origin, 2 general, 4 fighting style, 7 epic boons', () => {
    expect(all).toHaveLength(17);
    const count = (category: string) => all.filter((f) => f.category === category).length;
    expect([count('origin'), count('general'), count('fightingStyle'), count('epicBoon')]).toEqual([
      4, 2, 4, 7,
    ]);
    expect(all.every((f) => f.category !== undefined)).toBe(true);
  });

  it('names a category that exists', () => {
    const categories = new Set(
      run['2024'].entities.filter((e) => e.type === 'featCategory').map((e) => e.key),
    );
    expect(categories).toEqual(new Set(['origin', 'general', 'fightingStyle', 'epicBoon']));
    for (const f of all) expect(categories.has(f.category ?? ''), f.id).toBe(true);
  });

  it('marks Ability Score Improvement, Magic Initiate and Skilled as repeatable, and no other', () => {
    expect(all.filter((f) => f.repeatable).map(slug)).toEqual([
      'magic-initiate',
      'skilled',
      'ability-score-improvement',
    ]);
  });

  it('asks level 4 of the two general feats and level 19 of the seven epic boons', () => {
    const level = (f: Feat) => f.prerequisites?.find((p) => p.kind === 'level')?.min;
    expect(all.filter((f) => level(f) === 4).map(slug)).toEqual([
      'ability-score-improvement',
      'grappler',
    ]);
    expect(all.filter((f) => level(f) === 19).map(slug)).toEqual([
      'boon-of-combat-prowess',
      'boon-of-dimensional-travel',
      'boon-of-fate',
      'boon-of-irresistible-offense',
      'boon-of-spell-recall',
      'boon-of-the-night-spirit',
      'boon-of-truesight',
    ]);
    expect(
      all.filter((f) => f.category === 'origin').every((f) => f.prerequisites === undefined),
    ).toBe(true);
  });

  it('asks a Fighting Style feature of the four fighting style feats, and Spellcasting of Boon of Spell Recall', () => {
    const named = (f: Feat) => f.prerequisites?.filter((p) => p.kind === 'featureNamed');
    for (const name of ['archery', 'defense', 'great-weapon-fighting', 'two-weapon-fighting']) {
      expect(named(feat('2024', name)), name).toEqual([
        { kind: 'featureNamed', name: 'Fighting Style' },
      ]);
    }
    expect(feat('2024', 'defense').prerequisites).toEqual([
      { kind: 'featureNamed', name: 'Fighting Style' },
    ]);
    expect(feat('2024', 'boon-of-spell-recall').prerequisites).toEqual([
      { kind: 'level', min: 19 },
      { kind: 'featureNamed', name: 'Spellcasting' },
    ]);
    expect(all.filter((f) => named(f)?.length).map(slug)).toHaveLength(5);
  });

  it('gives Grappler level 4 and Strength or Dexterity 13 as one formula with the source’s words', () => {
    expect(feat('2024', 'grappler').prerequisites).toEqual([
      { kind: 'level', min: 4 },
      {
        kind: 'formula',
        formula: '@abilities.str.score >= 13 || @abilities.dex.score >= 13',
        label: { en: 'Strength or Dexterity 13+' },
      },
    ]);
    expect(all.filter((f) => f.prerequisites?.some((p) => p.kind === 'formula'))).toHaveLength(1);
  });
});

describe('CONT-11 the hand-written packs', () => {
  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: each feat it holds is imported with the same id, name and category',
    (ruleset, pack) => {
      const held = pack.entities.filter((e) => e.type === 'feat');
      expect(held.length).toBeGreaterThanOrEqual(ruleset === '2024' ? 3 : 0);
      for (const e of held) {
        const imported = made(ruleset).find((f) => f.id === e.id);
        expect(imported, e.id).toBeDefined();
        expect(imported?.name, e.id).toEqual(e.name);
        expect(imported?.category, e.id).toEqual((e as Feat).category);
      }
    },
  );
});
