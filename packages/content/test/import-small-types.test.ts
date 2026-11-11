import { describe, expect, it } from 'vitest';
import { PACK_OF, RULESETS, type Ruleset, runImport, slugOf } from '../src/import/frame.ts';
import { keyOf, smallTypes } from '../src/import/smallTypes.ts';
import { readSourceFile } from '../src/import/source.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-14: the small rule types. Control values are measured from the fetched source at `e6edf9a`
// by a script outside the repository (CONT-14 §8), never read from a run. No rules text is written
// here: the test asserts ids, keys, counts and shapes.

/** What the importer made for a ruleset, with the frame's problems. */
function imported(ruleset: Ruleset) {
  const result = runImport({
    ruleset,
    importers: { smallTypes },
    read: (rs, file) => readSourceFile(rs, file),
  });
  return { ...result, of: (type: string) => result.entities.filter((e) => e.type === type) };
}

const run = { '2014': imported('2014'), '2024': imported('2024') };

/** The count of each type in each ruleset, from the source: a file's length, or a measured set. */
const COUNTS: Record<Ruleset, Record<string, number>> = {
  '2014': {
    ability: 6,
    skill: 18,
    condition: 15,
    damageType: 13,
    language: 16,
    weaponProperty: 11,
    weaponMastery: 0,
    spellSchool: 8,
    toolKind: 37,
    size: 6,
    creatureType: 14,
    itemRarity: 7,
    areaShape: 5,
    featCategory: 0,
  },
  '2024': {
    ability: 6,
    skill: 18,
    condition: 15,
    damageType: 13,
    language: 19,
    weaponProperty: 10,
    weaponMastery: 8,
    spellSchool: 8,
    toolKind: 37,
    size: 6,
    creatureType: 14,
    itemRarity: 7,
    areaShape: 6,
    featCategory: 4,
  },
};

describe('CONT-14 keyOf', () => {
  it('writes a slug in camelCase, as the hand-written packs write their keys', () => {
    expect(keyOf('deep-speech')).toBe('deepSpeech');
    expect(keyOf('sleight-of-hand')).toBe('sleightOfHand');
    expect(keyOf('three-dragon-ante')).toBe('threeDragonAnte');
    expect(keyOf('str')).toBe('str');
  });
});

describe.each(RULESETS)('CONT-14 the small types of %s', (ruleset) => {
  const { entities, problems, of } = run[ruleset];

  it('passes the frame with no problem', () => {
    expect(problems).toEqual([]);
  });

  it('makes the count the source gives for each type, and nothing else', () => {
    const counts = Object.fromEntries(smallTypes.types.map((type) => [type, of(type).length]));
    expect(counts).toEqual(COUNTS[ruleset]);
    expect(entities).toHaveLength(Object.values(COUNTS[ruleset]).reduce((a, b) => a + b, 0));
  });

  it('gives each entity of the pack of its ruleset, with a key a formula can read', () => {
    for (const entity of entities) {
      expect(entity.id.startsWith(`${PACK_OF[ruleset]}:`)).toBe(true);
      expect(entity.ruleset).toBe(ruleset);
      expect(entity.key, entity.id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
    }
  });

  it('makes one entity for each entry of a file that lists them, under the entry’s slug', () => {
    const filed: [string, string][] = [
      ['ability', 'Ability-Scores'],
      ['skill', 'Skills'],
      ['condition', 'Conditions'],
      ['damageType', 'Damage-Types'],
      ['language', 'Languages'],
      ['weaponProperty', 'Weapon-Properties'],
      ['spellSchool', 'Magic-Schools'],
      ...(ruleset === '2024'
        ? [['weaponMastery', 'Weapon-Mastery-Properties'] as [string, string]]
        : []),
    ];
    for (const [type, file] of filed) {
      const source = readSourceFile(ruleset, file).map((e) => slugOf(e.index));
      const made = of(type).map((e) => e.id.slice(e.id.indexOf('/') + 1));
      expect(made, type).toEqual(source);
      expect(of(type).length).toBe(COUNTS[ruleset][type]);
    }
  });

  it('names a stat by its full name and its short form, in the source’s order', () => {
    const stats = of('ability');
    expect(stats.map((s) => s.key)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    expect(stats.map((s) => ('order' in s ? s.order : -1))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stats.map((s) => s.name.en)).toEqual([
      'Strength',
      'Dexterity',
      'Constitution',
      'Intelligence',
      'Wisdom',
      'Charisma',
    ]);
    expect(stats.map((s) => ('abbr' in s ? s.abbr.en : ''))).toEqual([
      'STR',
      'DEX',
      'CON',
      'INT',
      'WIS',
      'CHA',
    ]);
  });

  it('ties each skill to a stat that exists, and marks only Perception passive', () => {
    const statKeys = new Set(of('ability').map((s) => s.key));
    const skills = of('skill');
    for (const skill of skills) {
      expect(skill.type === 'skill' && statKeys.has(skill.ability), skill.id).toBe(true);
    }
    const passive = skills.filter((s) => s.type === 'skill' && s.passive === true);
    expect(passive.map((s) => s.key)).toEqual(['perception']);
    const byKey = Object.fromEntries(
      skills.map((s) => [s.key, s.type === 'skill' ? s.ability : '']),
    );
    expect(byKey).toMatchObject({
      acrobatics: 'dex',
      animalHandling: 'wis',
      athletics: 'str',
      sleightOfHand: 'dex',
      arcana: 'int',
      persuasion: 'cha',
    });
  });

  it('keeps a key for a name of several words in camelCase', () => {
    const keys = (type: string) => of(type).map((e) => e.key);
    expect(keys('weaponProperty')).toContain('twoHanded');
    expect(keys('language')).toContain('deepSpeech');
  });

  it('names each size and creature type once', () => {
    expect(of('size').map((s) => s.key)).toEqual([
      'tiny',
      'small',
      'medium',
      'large',
      'huge',
      'gargantuan',
    ]);
    expect(of('creatureType').map((s) => s.key)).toContain('humanoid');
    for (const type of ['size', 'creatureType', 'itemRarity', 'areaShape', 'featCategory']) {
      const keys = of(type).map((e) => e.key);
      expect(new Set(keys).size, type).toBe(keys.length);
    }
  });
});

describe('CONT-14 the table types cover every value the source uses', () => {
  for (const ruleset of RULESETS) {
    const keysOf = (type: string) =>
      new Set(run[ruleset].of(type).map((e) => e.id.slice(e.id.indexOf('/') + 1)));
    const monsters = readSourceFile(ruleset, 'Monsters');
    const slug = (text: string) => text.trim().toLowerCase().replace(/\s+/g, '-');

    it(`names every monster size in ${ruleset}`, () => {
      const used = new Set(monsters.flatMap((m) => String(m.size).split(' or ').map(slug)));
      expect([...used].filter((size) => !keysOf('size').has(size))).toEqual([]);
      expect([...used].sort()).toEqual([...keysOf('size')].sort());
    });

    it(`names every monster creature type in ${ruleset}, a swarm as its beast or undead`, () => {
      const used = new Set(
        monsters.map((m) =>
          slug(
            String(m.type)
              .replace(/^swarm of tiny /i, '')
              .replace(/s$/, ''),
          ),
        ),
      );
      expect([...used].sort()).toEqual([...keysOf('creatureType')].sort());
    });

    it(`names every rarity of a magic item in ${ruleset}`, () => {
      const used = new Set<string>();
      for (const item of readSourceFile(ruleset, 'Magic-Items')) {
        const rarity = item.rarity as { name: string } | string;
        const text = typeof rarity === 'string' ? rarity : rarity.name;
        for (const part of text.replace(/\([^)]*\)/g, '').split(/,|\bor\b/)) {
          const name = part.trim().replace(/^Rarity /, '');
          if (name !== '') used.add(slug(name));
        }
      }
      expect([...used].sort()).toEqual([...keysOf('itemRarity')].sort());
    });

    it(`names every school of magic a spell has in ${ruleset}`, () => {
      const used = new Set(
        readSourceFile(ruleset, 'Spells').map((s) => {
          const school = s.school as string | { index: string };
          return typeof school === 'string' ? school : school.index;
        }),
      );
      expect([...used].sort()).toEqual([...keysOf('spellSchool')].sort());
    });
  }

  it('names the five shapes SRD 5.1 gives a spell, from `area_of_effect.type`', () => {
    const used = new Set(
      readSourceFile('2014', 'Spells')
        .map((s) => (s.area_of_effect as { type: string } | undefined)?.type)
        .filter((type): type is string => type !== undefined),
    );
    expect([...used].sort()).toEqual(['cone', 'cube', 'cylinder', 'line', 'sphere']);
    expect(
      run['2014']
        .of('areaShape')
        .map((s) => s.key)
        .sort(),
    ).toEqual([...used].sort());
  });

  it('names the six shapes SRD 5.2.1’s spell texts give an area', () => {
    const shapes = new Set<string>();
    const pattern = /\d+-foot(?:-\w+)* (Cone|Cube|Cylinder|Emanation|Line|Sphere)\b/g;
    for (const spell of readSourceFile('2024', 'Spells')) {
      for (const found of String(spell.description).matchAll(pattern)) {
        shapes.add((found[1] ?? '').toLowerCase());
      }
    }
    expect([...shapes].sort()).toEqual(
      run['2024']
        .of('areaShape')
        .map((s) => s.key)
        .sort(),
    );
  });

  it('names the four kinds of feat SRD 5.2.1 has, and SRD 5.1 has none', () => {
    const used = new Set(readSourceFile('2024', 'Feats').map((f) => String(f.type)));
    expect([...used].sort()).toEqual(
      run['2024']
        .of('featCategory')
        .map((c) => c.id.slice(c.id.indexOf('/') + 1))
        .sort(),
    );
    expect(run['2014'].of('featCategory')).toEqual([]);
  });
});

describe('CONT-14 tool kinds', () => {
  const tools = new Set([
    "Artisan's Tools",
    'Gaming Sets',
    'Musical Instruments',
    'Other',
    'Tools',
    'Vehicles',
  ]);

  it.each(RULESETS)('has one kind for each tool proficiency of %s, 37 of them', (ruleset) => {
    const proficiencies = readSourceFile(ruleset, 'Proficiencies').filter((p) =>
      tools.has(String(p.type)),
    );
    expect(proficiencies).toHaveLength(37);
    const kinds = run[ruleset].of('toolKind');
    expect(kinds.map((k) => k.id)).toEqual(
      proficiencies.map(
        (p) => `${PACK_OF[ruleset]}:toolKind/${slugOf((p.reference as { index: string }).index)}`,
      ),
    );
  });

  it('keeps the keys the golden characters name', () => {
    const keys = (ruleset: Ruleset) => new Set(run[ruleset].of('toolKind').map((k) => k.key));
    for (const key of ['smithsTools', 'brewersSupplies', 'masonsTools', 'thievesTools']) {
      expect(keys('2014').has(key), key).toBe(true);
    }
    for (const key of ['dice', 'dragonchess', 'playingCards', 'threeDragonAnte']) {
      expect(keys('2024').has(key), key).toBe(true);
    }
  });
});

describe('CONT-14 the hand-written packs', () => {
  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: each small entity it holds has the id, key and name the import makes',
    (ruleset, pack) => {
      const made = new Map(run[ruleset].entities.map((entity) => [entity.id, entity]));
      const held = pack.entities.filter((entity) => smallTypes.types.includes(entity.type));
      expect(held.length).toBeGreaterThan(0);
      for (const entity of held) {
        const entry = made.get(entity.id);
        expect(entry, entity.id).toBeDefined();
        expect(entry?.key, entity.id).toBe(entity.key);
        expect(entry?.name, entity.id).toEqual(entity.name);
      }
    },
  );
});
