import { describe, expect, it } from 'vitest';
import { PACK_OF, RULESETS, type Ruleset, runImport } from '../src/import/frame.ts';
import { readSourceFile } from '../src/import/source.ts';
import { species } from '../src/import/species.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-09: species, lineages and their traits. Control values are measured from the fetched source
// at `e6edf9a` by a script outside the repository (CONT-09 §8), and the sizes of the human and the
// tiefling from the row's note. No rules text is written here: the test asserts ids, keys, counts
// and shapes.

interface Made {
  id: string;
  type: string;
  size?: string[];
  speed?: Record<string, number>;
  creatureType?: string;
  text?: { en: string };
  grants?: Record<string, unknown>[];
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({
      ruleset,
      importers: { species },
      read: (rs, file) => readSourceFile(rs, file),
    }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const made = (ruleset: Ruleset, type?: string): Made[] =>
  (run[ruleset].entities as unknown as Made[]).filter((e) => type === undefined || e.type === type);

const idOf = (ruleset: Ruleset, type: string, slug: string) =>
  `${PACK_OF[ruleset]}:${type}/${slug}`;

const entity = (ruleset: Ruleset, type: string, slug: string): Made => {
  const found = made(ruleset, type).find((e) => e.id === idOf(ruleset, type, slug));
  if (found === undefined) throw new Error(`${idOf(ruleset, type, slug)} is not imported`);
  return found;
};

const grant = (e: Made, id: string) => e.grants?.find((g) => g.id === id);

const features = (ruleset: Ruleset, ...slugs: string[]) =>
  slugs.map((slug) => idOf(ruleset, 'feature', slug));

const COUNTS: Record<Ruleset, [number, number, number]> = {
  '2014': [9, 4, 38],
  '2024': [9, 24, 67],
};

describe.each(RULESETS)('CONT-09 the species of %s', (ruleset) => {
  it('passes the frame with no problem, and makes the count the source gives of each type', () => {
    expect(run[ruleset].problems).toEqual([]);
    const [speciesCount, lineageCount, featureCount] = COUNTS[ruleset];
    expect(made(ruleset, 'species')).toHaveLength(speciesCount);
    expect(made(ruleset, 'lineage')).toHaveLength(lineageCount);
    expect(made(ruleset, 'feature')).toHaveLength(featureCount);
    expect(made(ruleset)).toHaveLength(speciesCount + lineageCount + featureCount);
  });

  it('makes one entity for each entry of each file, under its slug', () => {
    const [speciesFile, lineageFile] =
      ruleset === '2014' ? ['Races', 'Subraces'] : ['Species', 'Subspecies'];
    const slugs = (type: string) => made(ruleset, type).map((e) => e.id.split('/')[1]);
    expect(slugs('species')).toEqual(readSourceFile(ruleset, speciesFile).map((e) => e.index));
    expect(slugs('lineage')).toEqual(
      readSourceFile(ruleset, lineageFile ?? '').map((e) => e.index),
    );
    expect(slugs('feature')).toEqual(readSourceFile(ruleset, 'Traits').map((e) => e.index));
  });

  it('names an entity of each entity grant that exists, and uses every trait', () => {
    const ids = new Set(made(ruleset).map((e) => e.id));
    const named = new Set<string>();
    for (const e of made(ruleset)) {
      for (const g of e.grants ?? []) {
        if (g.kind !== 'entity') continue;
        const choose = g.choose as { from: string[] } | undefined;
        for (const id of [...((g.fixed as string[] | undefined) ?? []), ...(choose?.from ?? [])]) {
          expect(ids.has(id), `${e.id}#${String(g.id)} names ${id}`).toBe(true);
          named.add(id);
        }
      }
    }
    const unused = made(ruleset, 'feature').filter((f) => !named.has(f.id));
    expect(unused.map((f) => f.id)).toEqual([]);
    const lineages = made(ruleset, 'lineage');
    expect(lineages.every((l) => named.has(l.id))).toBe(true);
  });

  it('gives each trait its words, and gives a species a speed in feet', () => {
    for (const f of made(ruleset, 'feature')) expect(f.text?.en, f.id).toMatch(/\S/);
    for (const s of made(ruleset, 'species')) {
      expect(s.speed?.walk, s.id).toBeGreaterThan(0);
      expect(s.size?.length, s.id).toBeGreaterThan(0);
    }
  });
});

describe('CONT-09 SRD 5.1 races', () => {
  const r = (slug: string) => entity('2014', 'species', slug);

  it('gives the size and the speed the source gives', () => {
    const small = made('2014', 'species').filter((s) => s.size?.[0] === 'small');
    expect(small.map((s) => s.id.split('/')[1])).toEqual(['halfling', 'gnome']);
    expect(made('2014', 'species').every((s) => s.size?.length === 1)).toBe(true);
    expect([r('dwarf').speed, r('elf').speed, r('gnome').speed, r('halfling').speed]).toEqual([
      { walk: 25 },
      { walk: 30 },
      { walk: 25 },
      { walk: 25 },
    ]);
    expect(r('dwarf').size).toEqual(['medium']);
    expect(r('dwarf').creatureType).toBeUndefined();
  });

  it('writes the age, alignment, size and languages as the race’s text', () => {
    for (const s of made('2014', 'species')) {
      expect(s.text?.en, s.id).toMatch(/^\*\*Age\.\*\* \S[\s\S]*\*\*Languages\.\*\* \S/);
    }
  });

  it('gives the fixed stat increases of each race and subrace', () => {
    const values = (e: Made) =>
      (grant(e, 'ability-scores') as { values: object } | undefined)?.values;
    expect(values(r('dwarf'))).toEqual({ con: 2 });
    expect(values(r('human'))).toEqual({ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
    expect(values(r('dragonborn'))).toEqual({ str: 2, cha: 1 });
    expect(values(r('tiefling'))).toEqual({ int: 1, cha: 2 });
    expect(values(r('half-orc'))).toEqual({ str: 2, con: 1 });
    const lineage = (slug: string) => values(entity('2014', 'lineage', slug));
    expect(lineage('hill-dwarf')).toEqual({ wis: 1 });
    expect(lineage('high-elf')).toEqual({ int: 1 });
    expect(lineage('lightfoot-halfling')).toEqual({ cha: 1 });
    expect(lineage('rock-gnome')).toEqual({ con: 1 });
  });

  it('gives the half-elf two stats of five to raise by one', () => {
    expect(grant(r('half-elf'), 'ability-score-choice')).toEqual({
      id: 'ability-score-choice',
      kind: 'abilityScore',
      mode: 'distribute',
      from: ['str', 'dex', 'con', 'int', 'wis'],
      patterns: [[1, 1]],
    });
    expect(made('2014').filter((e) => grant(e, 'ability-score-choice'))).toHaveLength(1);
  });

  it('gives the languages: the fixed ones, and a pick from the list where the source has one', () => {
    const languages = (e: Made) => grant(e, 'languages') as Record<string, unknown>;
    expect(languages(r('dwarf'))).toEqual({
      id: 'languages',
      kind: 'proficiency',
      category: 'language',
      fixed: ['common', 'dwarvish'],
    });
    const human = languages(r('human')) as {
      fixed: string[];
      choose: { count: number; from: string[] };
    };
    expect(human.fixed).toEqual(['common']);
    expect(human.choose.count).toBe(1);
    expect(human.choose.from).toHaveLength(15);
    expect(human.choose.from).not.toContain('common');
    const halfElf = languages(r('half-elf')) as typeof human;
    expect(halfElf.fixed).toEqual(['common', 'elvish']);
    expect(halfElf.choose.from).toHaveLength(14);
    expect(halfElf.choose.from).not.toContain('elvish');
  });

  it('puts the high elf’s Extra Language on the lineage and leaves the trait without it', () => {
    const highElf = entity('2014', 'lineage', 'high-elf');
    const languages = grant(highElf, 'languages') as {
      fixed?: string[];
      choose: { count: number; from: string[] };
    };
    expect(languages.fixed).toBeUndefined();
    expect(languages.choose.count).toBe(1);
    expect(languages.choose.from).toHaveLength(14);
    expect(languages.choose.from).not.toContain('elvish');
    expect(entity('2014', 'feature', 'extra-language').grants).toBeUndefined();
    const withLanguages = made('2014').filter((e) => e.type !== 'feature' && grant(e, 'languages'));
    expect(withLanguages.map((e) => e.id.split('/')[1])).toEqual([
      'dwarf',
      'elf',
      'halfling',
      'human',
      'dragonborn',
      'gnome',
      'half-elf',
      'half-orc',
      'tiefling',
      'high-elf',
    ]);
  });

  it('lists each race’s traits in the source’s order and offers its subraces', () => {
    expect(grant(r('dwarf'), 'traits')).toEqual({
      id: 'traits',
      kind: 'entity',
      fixed: features(
        '2014',
        'darkvision',
        'dwarven-resilience',
        'stonecunning',
        'dwarven-combat-training',
        'tool-proficiency',
      ),
    });
    expect(grant(r('dwarf'), 'subrace')).toEqual({
      id: 'subrace',
      kind: 'entity',
      choose: { count: 1, from: [idOf('2014', 'lineage', 'hill-dwarf')] },
    });
    expect(grant(r('human'), 'traits')).toBeUndefined();
    expect(grant(r('human'), 'subrace')).toBeUndefined();
    expect(grant(entity('2014', 'lineage', 'rock-gnome'), 'traits')).toEqual({
      id: 'traits',
      kind: 'entity',
      fixed: features('2014', 'artificers-lore', 'tinker'),
    });
    expect(
      made('2014', 'species')
        .filter((s) => grant(s, 'subrace'))
        .map((s) => s.id.split('/')[1]),
    ).toEqual(['dwarf', 'elf', 'halfling', 'gnome']);
  });

  it('gives a trait the proficiencies and choices the source structures', () => {
    const f = (slug: string) => entity('2014', 'feature', slug);
    expect(f('dwarven-combat-training').grants).toEqual([
      {
        id: 'weapons',
        kind: 'proficiency',
        category: 'weapon',
        fixed: ['battleaxe', 'handaxe', 'lightHammer', 'warhammer'],
      },
    ]);
    expect(f('elf-weapon-training').grants).toEqual([
      {
        id: 'weapons',
        kind: 'proficiency',
        category: 'weapon',
        fixed: ['longsword', 'shortsword', 'shortbow', 'longbow'],
      },
    ]);
    expect(f('keen-senses').grants).toEqual([
      { id: 'skills', kind: 'proficiency', category: 'skill', fixed: ['perception'] },
    ]);
    expect(f('menacing').grants).toEqual([
      { id: 'skills', kind: 'proficiency', category: 'skill', fixed: ['intimidation'] },
    ]);
    expect(f('tinker').grants).toEqual([
      { id: 'tools', kind: 'proficiency', category: 'tool', fixed: ['tinkersTools'] },
    ]);
    expect(f('tool-proficiency').grants).toEqual([
      {
        id: 'tools',
        kind: 'proficiency',
        category: 'tool',
        choose: { count: 1, from: ['smithsTools', 'brewersSupplies', 'masonsTools'] },
      },
    ]);
    const versatility = grant(f('skill-versatility'), 'skills') as {
      choose: { count: number; from: string[] };
    };
    expect(versatility.choose.count).toBe(2);
    expect(versatility.choose.from).toHaveLength(18);
    expect(versatility.choose.from).toContain('sleightOfHand');
  });

  it('gives the dragonborn’s ancestry its ten traits to pick from', () => {
    const ancestry = grant(entity('2014', 'feature', 'draconic-ancestry'), 'subtraits') as {
      choose: { count: number; from: string[] };
    };
    expect(ancestry.choose.count).toBe(1);
    expect(ancestry.choose.from).toEqual(
      ['black', 'blue', 'brass', 'bronze', 'copper', 'gold', 'green', 'red', 'silver', 'white'].map(
        (color) => idOf('2014', 'feature', `draconic-ancestry-${color}`),
      ),
    );
  });

  it('gives a trait that is only words no grants', () => {
    expect(entity('2014', 'feature', 'darkvision').grants).toBeUndefined();
    expect(entity('2014', 'feature', 'lucky').grants).toBeUndefined();
  });
});

describe('CONT-09 SRD 5.2.1 species', () => {
  const s = (slug: string) => entity('2024', 'species', slug);

  it('names every species a humanoid, and gives each a size and a speed', () => {
    expect(made('2024', 'species').every((e) => e.creatureType === 'humanoid')).toBe(true);
    expect(s('goliath').speed).toEqual({ walk: 35 });
    expect(s('dwarf').speed).toEqual({ walk: 30 });
    expect(s('gnome').size).toEqual(['small']);
    expect(s('halfling').size).toEqual(['small']);
    expect(s('orc').size).toEqual(['medium']);
  });

  it('gives the human Medium or Small, as the row’s note says, and the tiefling the two it offers', () => {
    expect(s('human').size).toEqual(['medium', 'small']);
    expect(s('tiefling').size).toEqual(['small', 'medium']);
  });

  it('gives no stat increase and no language to a species', () => {
    const grants = made('2024').flatMap((e) => e.grants ?? []);
    expect(grants.filter((g) => g.kind === 'abilityScore' || g.category === 'language')).toEqual(
      [],
    );
  });

  it('lists each species’ traits and offers its lineages', () => {
    expect(grant(s('human'), 'traits')).toEqual({
      id: 'traits',
      kind: 'entity',
      fixed: features('2024', 'resourceful', 'skillful', 'versatile'),
    });
    const lineages = (slug: string) =>
      (grant(s(slug), 'lineage') as { choose: { count: number; from: string[] } }).choose;
    expect(lineages('dragonborn').from).toHaveLength(10);
    expect(lineages('elf').from).toEqual(
      ['drow', 'high-elf', 'wood-elf'].map((name) =>
        idOf('2024', 'lineage', `elven-lineage-${name}`),
      ),
    );
    expect(lineages('goliath').from).toHaveLength(6);
    expect(lineages('gnome').from).toHaveLength(2);
    expect(lineages('tiefling').from).toHaveLength(3);
    expect(lineages('elf').count).toBe(1);
    expect(
      made('2024', 'species')
        .filter((e) => grant(e, 'lineage'))
        .map((e) => e.id.split('/')[1]),
    ).toEqual(['dragonborn', 'elf', 'gnome', 'goliath', 'tiefling']);
    expect(grant(s('human'), 'lineage')).toBeUndefined();
    // Draconic Ancestry names the dragonborn and no trait list does: it joins the dragonborn's.
    expect(grant(s('dragonborn'), 'traits')).toEqual({
      id: 'traits',
      kind: 'entity',
      fixed: features('2024', 'darkvision-60', 'draconic-flight', 'draconic-ancestry'),
    });
  });

  it('gives a lineage its traits', () => {
    expect(grant(entity('2024', 'lineage', 'elven-lineage-high-elf'), 'traits')).toEqual({
      id: 'traits',
      kind: 'entity',
      fixed: features(
        '2024',
        'high-elf-cantrip-versatility',
        'lineage-spell-detect-magic',
        'lineage-spell-misty-step',
      ),
    });
  });

  it('gives the skill choices of Keen Senses and Skillful', () => {
    const keen = entity('2024', 'feature', 'keen-senses').grants;
    expect(keen).toEqual([
      {
        id: 'skills',
        kind: 'proficiency',
        category: 'skill',
        choose: { count: 1, from: ['insight', 'perception', 'survival'] },
      },
    ]);
    const skillful = grant(entity('2024', 'feature', 'skillful'), 'skills') as {
      choose: { count: number; from: string[] };
    };
    expect(skillful.choose.count).toBe(1);
    expect(skillful.choose.from).toHaveLength(18);
    expect(
      made('2024', 'feature')
        .filter((f) => f.grants)
        .map((f) => f.id.split('/')[1]),
    ).toEqual(['keen-senses', 'skillful']);
  });
});

describe('CONT-09 the hand-written packs', () => {
  const byId = (grants: Record<string, unknown>[] | undefined) =>
    [...(grants ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: each species, lineage and feature it holds is imported under its id',
    (ruleset, pack) => {
      const ids = new Set(made(ruleset).map((e) => e.id));
      // A feature of the pack that is a class's or a background's is another importer's.
      const traits = new Set(readSourceFile(ruleset, 'Traits').map((e) => e.index));
      const held = pack.entities.filter(
        (e) =>
          e.type === 'species' ||
          e.type === 'lineage' ||
          (e.type === 'feature' && traits.has(e.id.split('/')[1] ?? '')),
      );
      expect(held.length).toBeGreaterThan(0);
      for (const e of held) expect(ids.has(e.id), e.id).toBe(true);
    },
  );

  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: a species and a lineage have the size, speed and grants the pack has',
    (ruleset, pack) => {
      for (const held of pack.entities) {
        if (held.type !== 'species' && held.type !== 'lineage') continue;
        const imported = made(ruleset).find((e) => e.id === held.id);
        const have = held as unknown as Made;
        expect(imported?.size, held.id).toEqual(have.size);
        expect(imported?.speed, held.id).toEqual(have.speed);
        expect(imported?.creatureType, held.id).toEqual(have.creatureType);
        expect(byId(imported?.grants), held.id).toEqual(byId(have.grants));
      }
    },
  );

  it('the dwarf’s trait grants are the ones the pack has', () => {
    for (const slug of ['dwarven-combat-training', 'tool-proficiency', 'darkvision']) {
      const held = srd2014.entities.find(
        (e) => e.id === idOf('2014', 'feature', slug),
      ) as unknown as Made;
      expect(byId(entity('2014', 'feature', slug).grants), slug).toEqual(byId(held.grants));
    }
  });
});
