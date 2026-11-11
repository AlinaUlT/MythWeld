import { describe, expect, it } from 'vitest';
import { PACK_OF, RULESETS, type Ruleset, runImport } from '../src/import/frame.ts';
import { importers } from '../src/import/registry.ts';
import { readSourceFile } from '../src/import/source.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-10: the backgrounds. Control values are measured from the fetched source at `e6edf9a` by a
// script outside the repository, and the Standard Languages table from SRD 5.2.1 page 20
// (CONT-10 §8). No rules text is written here: the test asserts ids, keys, counts and shapes.

interface Made {
  id: string;
  type: string;
  key?: string;
  name?: { en: string };
  text?: { en: string };
  grants?: Record<string, unknown>[];
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({ ruleset, importers, read: (rs, file) => readSourceFile(rs, file) }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const all = (ruleset: Ruleset) => run[ruleset].entities as unknown as Made[];
const backgrounds = (ruleset: Ruleset) => all(ruleset).filter((e) => e.type === 'background');
const background = (ruleset: Ruleset, slug: string): Made => {
  const found = backgrounds(ruleset).find((e) => e.id === `${PACK_OF[ruleset]}:background/${slug}`);
  if (found === undefined) throw new Error(`${slug} is not imported`);
  return found;
};
const grant = (made: Made, id: string) => made.grants?.find((g) => g.id === id);
const ids = (ruleset: Ruleset) => new Set(all(ruleset).map((e) => e.id));

describe.each(RULESETS)('CONT-10 the backgrounds of %s', (ruleset) => {
  it('passes the frame with no problem', () => {
    expect(run[ruleset].problems).toEqual([]);
  });

  it('makes one background for each entry of the file, under its slug and name', () => {
    const source = readSourceFile(ruleset, 'Backgrounds');
    expect(backgrounds(ruleset).map((e) => e.id.split('/')[1])).toEqual(source.map((e) => e.index));
    expect(backgrounds(ruleset).map((e) => e.name?.en)).toEqual(source.map((e) => e.name));
    for (const e of backgrounds(ruleset)) expect(e.text?.en, e.id).toMatch(/\S/);
  });

  it('names only entities that exist: its feat, feature, items and skills', () => {
    const known = ids(ruleset);
    const keys = new Set(all(ruleset).flatMap((e) => (e.key ? [e.key] : [])));
    for (const e of backgrounds(ruleset)) {
      for (const g of e.grants ?? []) {
        if (g.kind === 'entity') {
          for (const id of (g.fixed as string[] | undefined) ?? [])
            expect(known.has(id), id).toBe(true);
        }
        if (g.kind === 'item') {
          const fixed = ((g.fixed as { id: string }[] | undefined) ?? []).map((i) => i.id);
          const from = (g.choose as { from: string[] } | undefined)?.from ?? [];
          for (const id of [...fixed, ...from]) expect(known.has(id), id).toBe(true);
        }
        if (g.kind === 'proficiency' && g.category === 'skill') {
          for (const key of (g.fixed as string[]) ?? []) expect(keys.has(key), key).toBe(true);
        }
      }
    }
  });
});

describe('CONT-10 SRD 5.1', () => {
  it('has one background, Acolyte, and one feature of its own', () => {
    expect(backgrounds('2014')).toHaveLength(1);
    const feature = all('2014').find((e) => e.id === 'srd-2014:feature/shelter-of-the-faithful');
    expect(feature?.type).toBe('feature');
    expect(feature?.name?.en).toBe('Shelter of the Faithful');
    expect(feature?.text?.en).toMatch(/\S/);
  });

  it('gives the Acolyte two skills, two languages of the player’s choice, its feature and its items', () => {
    const acolyte = background('2014', 'acolyte');
    expect(grant(acolyte, 'skills')).toEqual({
      id: 'skills',
      kind: 'proficiency',
      category: 'skill',
      fixed: ['insight', 'religion'],
    });
    expect(grant(acolyte, 'languages')).toEqual({
      id: 'languages',
      kind: 'proficiency',
      category: 'language',
      choose: { count: 2, from: { type: 'language' } },
    });
    expect(grant(acolyte, 'feature')).toEqual({
      id: 'feature',
      kind: 'entity',
      fixed: ['srd-2014:feature/shelter-of-the-faithful'],
    });
    expect(grant(acolyte, 'equipment')).toEqual({
      id: 'equipment',
      kind: 'item',
      fixed: [
        { id: 'srd-2014:item/clothes-common', qty: 1 },
        { id: 'srd-2014:item/pouch', qty: 1 },
      ],
    });
    expect(grant(acolyte, 'equipment-choice')).toEqual({
      id: 'equipment-choice',
      kind: 'item',
      choose: {
        count: 1,
        from: ['srd-2014:item/amulet', 'srd-2014:item/emblem', 'srd-2014:item/reliquary'],
      },
    });
    expect(acolyte.grants).toHaveLength(5);
  });

  it('keeps the suggested characteristics in its words: 8 traits, 6 ideals, 6 bonds, 6 flaws', () => {
    const text = background('2014', 'acolyte').text?.en ?? '';
    const section = (heading: string) =>
      (text.split(`**${heading}**`)[1] ?? '').split('\n\n')[1]?.split('\n') ?? [];
    expect(section('Suggested Personality Traits')).toHaveLength(8);
    expect(section('Suggested Ideals')).toHaveLength(6);
    expect(section('Suggested Bonds')).toHaveLength(6);
    expect(section('Suggested Flaws')).toHaveLength(6);
    // The last ideal fits any alignment, the first is lawful.
    expect(section('Suggested Ideals')[5]).toMatch(/\(Any\)$/);
    expect(section('Suggested Ideals')[0]).toMatch(/\(Lawful\)$/);
  });

  it('lists its equipment in words, with a semicolon between the items', () => {
    expect(background('2014', 'acolyte').text?.en).toContain(
      '**Equipment:** Clothes, common; Pouch; one from Holy Symbols; 15 gp',
    );
  });
});

describe('CONT-10 SRD 5.2.1', () => {
  const STANDARD = [
    'commonSignLanguage',
    'draconic',
    'dwarvish',
    'elvish',
    'giant',
    'gnomish',
    'goblin',
    'halfling',
    'orc',
  ];

  it('has four backgrounds: Acolyte, Criminal, Sage, Soldier', () => {
    expect(backgrounds('2024').map((e) => e.id.split('/')[1])).toEqual([
      'acolyte',
      'criminal',
      'sage',
      'soldier',
    ]);
  });

  it.each([
    [
      'acolyte',
      ['int', 'wis', 'cha'],
      'magic-initiate',
      ['insight', 'religion'],
      ['calligraphersSupplies'],
    ],
    ['criminal', ['dex', 'con', 'int'], 'alert', ['sleightOfHand', 'stealth'], ['thievesTools']],
    [
      'sage',
      ['con', 'int', 'wis'],
      'magic-initiate',
      ['arcana', 'history'],
      ['calligraphersSupplies'],
    ],
  ])(
    '%s: three stats, an origin feat, two skills and one tool',
    (slug, stats, feat, skills, tools) => {
      const made = background('2024', slug);
      expect(grant(made, 'ability-scores')).toEqual({
        id: 'ability-scores',
        kind: 'abilityScore',
        mode: 'distribute',
        from: stats,
        patterns: [
          [2, 1],
          [1, 1, 1],
        ],
      });
      expect(grant(made, 'feat')).toEqual({
        id: 'feat',
        kind: 'entity',
        fixed: [`srd-2024:feat/${feat}`],
      });
      expect(grant(made, 'skills')).toMatchObject({ category: 'skill', fixed: skills });
      expect(grant(made, 'tools')).toMatchObject({ category: 'tool', fixed: tools });
    },
  );

  it('gives the Soldier its stats, feat, skills and one gaming set of four to choose', () => {
    const soldier = background('2024', 'soldier');
    expect(grant(soldier, 'ability-scores')).toMatchObject({ from: ['str', 'dex', 'con'] });
    expect(grant(soldier, 'feat')).toMatchObject({ fixed: ['srd-2024:feat/savage-attacker'] });
    expect(grant(soldier, 'skills')).toMatchObject({ fixed: ['athletics', 'intimidation'] });
    expect(grant(soldier, 'tools')).toEqual({
      id: 'tools',
      kind: 'proficiency',
      category: 'tool',
      choose: { count: 1, from: ['dice', 'dragonchess', 'playingCards', 'threeDragonAnte'] },
    });
  });

  it('gives each background Common and two of the nine other Standard Languages, which exist', () => {
    const keys = new Set(
      all('2024')
        .filter((e) => e.type === 'language')
        .map((e) => e.key),
    );
    for (const e of backgrounds('2024')) {
      expect(grant(e, 'languages'), e.id).toEqual({
        id: 'languages',
        kind: 'proficiency',
        category: 'language',
        fixed: ['common'],
        choose: { count: 2, from: STANDARD },
      });
    }
    for (const key of ['common', ...STANDARD]) expect(keys.has(key), key).toBe(true);
  });

  it('gives no starting items: the choice of a package or 50 gp is not a grant', () => {
    for (const e of backgrounds('2024')) {
      expect(
        e.grants?.some((g) => g.kind === 'item'),
        e.id,
      ).toBe(false);
    }
  });

  it('writes the words of each background in the SRD’s order, the equipment line as the source has it', () => {
    const source = readSourceFile('2024', 'Backgrounds');
    for (const entry of source) {
      const text = background('2024', entry.index).text?.en ?? '';
      const labels = text.split('\n\n').map((p) => p.split(':**')[0]);
      expect(labels, entry.index).toEqual([
        '**Ability Scores',
        '**Feat',
        '**Skill Proficiencies',
        '**Tool Proficiency',
        '**Equipment',
      ]);
      const desc = (entry.equipment_options as { desc: string }[])[0]?.desc;
      expect(text.endsWith(`**Equipment:** ${desc}`), entry.index).toBe(true);
    }
    // The two Magic Initiate backgrounds name their spell list: the Acolyte's is in the source, the
    // Sage's is from the SRD (CONT-10 §8).
    expect(background('2024', 'acolyte').text?.en).toContain('**Feat:** Magic Initiate (Cleric)');
    expect(background('2024', 'sage').text?.en).toContain('**Feat:** Magic Initiate (Wizard)');
    expect(background('2024', 'criminal').text?.en).toContain('**Feat:** Alert\n');
  });
});

describe('CONT-10 the hand-written packs', () => {
  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: each background it holds is imported with the same id and grants',
    (ruleset, pack) => {
      const held = pack.entities.filter((e) => e.type === 'background');
      expect(held.length).toBeGreaterThan(0);
      for (const e of held) {
        const imported = background(ruleset, e.id.split('/')[1] ?? '');
        expect(imported.name, e.id).toEqual(e.name);
        // The pack holds some of the grants the import makes (the import adds the languages), each
        // under the same id and with the same value.
        for (const g of (e as unknown as Made).grants ?? []) {
          expect(grant(imported, String(g.id)), `${e.id} ${g.id}`).toEqual(g);
        }
      }
    },
  );

  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)('%s: the features of a background the pack holds are imported', (ruleset, pack) => {
    const backgroundFeatures = new Set(
      backgrounds(ruleset).flatMap(
        (b) => (grant(b, 'feature')?.fixed as string[] | undefined) ?? [],
      ),
    );
    for (const e of pack.entities.filter((f) => backgroundFeatures.has(f.id))) {
      expect(ids(ruleset).has(e.id), e.id).toBe(true);
    }
  });
});
