import { describe, expect, it } from 'vitest';
import { equipment } from '../src/import/equipment.ts';
import { PACK_OF, RULESETS, type Ruleset, runImport, slugOf } from '../src/import/frame.ts';
import { smallTypes } from '../src/import/smallTypes.ts';
import { readSourceFile } from '../src/import/source.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-12: the equipment. Control values are measured from the fetched source at `e6edf9a` by a
// script outside the repository (CONT-12 §8). No rules text is written here: the test asserts ids,
// keys, counts and shapes.

interface Item {
  id: string;
  type: string;
  key?: string;
  name: { en: string };
  text?: { en: string };
  category: string;
  tags?: string[];
  weight?: number;
  cost?: { amount: number; unit: string };
  weapon?: {
    group: string;
    kind: string;
    damage?: { formula: string; type: string };
    versatile?: string;
    properties?: string[];
    range?: { normal: number; long?: number };
    mastery?: string;
  };
  armor?: {
    group: string;
    baseAC: number;
    dexCap: number | null;
    strRequirement?: number;
    stealthDisadvantage?: boolean;
  };
  effects?: Record<string, unknown>[];
  grants?: { id: string; kind: string; fixed: { id: string; qty: number }[] }[];
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({
      ruleset,
      importers: { smallTypes, equipment },
      read: (rs, file) => readSourceFile(rs, file),
    }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const made = (ruleset: Ruleset) =>
  run[ruleset].entities.filter((e) => e.type === 'item') as unknown as Item[];
const item = (ruleset: Ruleset, slug: string): Item => {
  const found = made(ruleset).find((e) => e.id === `${PACK_OF[ruleset]}:item/${slug}`);
  if (found === undefined) throw new Error(`${slug} is not imported`);
  return found;
};
const where = (ruleset: Ruleset, test: (i: Item) => boolean) => made(ruleset).filter(test);

/** Per ruleset, the counts the source gives (CONT-12 §8). */
const MEASURED = {
  '2014': {
    items: 237,
    category: {
      weapon: 37,
      armor: 12,
      shield: 1,
      gear: 89,
      ammunition: 4,
      focus: 12,
      tool: 35,
      pack: 7,
      transport: 40,
    },
    weapons: { simple: 14, martial: 23, melee: 28, ranged: 9, versatile: 6, mastery: 0 },
    noCost: 7,
    noWeight: 52,
    text: 111,
  },
  '2024': {
    items: 182,
    category: {
      weapon: 38,
      armor: 12,
      shield: 1,
      gear: 72,
      ammunition: 5,
      focus: 10,
      tool: 37,
      pack: 7,
      transport: 0,
    },
    weapons: { simple: 14, martial: 24, melee: 28, ranged: 10, versatile: 7, mastery: 38 },
    noCost: 0,
    noWeight: 22,
    text: 82,
  },
} as const;

describe.each(RULESETS)('CONT-12 the equipment of %s', (ruleset) => {
  const m = MEASURED[ruleset];

  it('passes the frame with no problem, and makes one item for each entry, under its slug', () => {
    expect(run[ruleset].problems).toEqual([]);
    const source = readSourceFile(ruleset, 'Equipment');
    expect(made(ruleset)).toHaveLength(m.items);
    expect(made(ruleset).map((i) => i.id.split('/')[1])).toEqual(
      source.map((e) => slugOf(e.index)),
    );
    expect(made(ruleset).map((i) => i.name.en)).toEqual(source.map((e) => e.name));
  });

  it('gives each item a key of its own, the slug in camelCase', () => {
    const keys = made(ruleset).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of made(ruleset)) expect(i.key, i.id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
    expect(item(ruleset, 'chain-mail').key).toBe('chainMail');
  });

  it('puts each item in the category the source’s lists give it', () => {
    const count = (category: string) => where(ruleset, (i) => i.category === category).length;
    expect(Object.fromEntries(Object.keys(m.category).map((c) => [c, count(c)]))).toEqual(
      m.category,
    );
  });

  it('gives a weapon, an armor and only them a block, and a shield an effect, not an armor block', () => {
    for (const i of made(ruleset)) {
      expect(i.weapon !== undefined, i.id).toBe(i.category === 'weapon');
      expect(i.armor !== undefined, i.id).toBe(i.category === 'armor');
      expect(i.effects !== undefined, i.id).toBe(i.category === 'shield');
    }
    expect(item(ruleset, 'shield').effects).toEqual([
      { id: 'armor-class', target: 'ac.bonus', op: 'add', value: 2, when: '@equipped' },
    ]);
  });

  it('leaves out a price or a weight of 0, and gives the words the source has', () => {
    expect(where(ruleset, (i) => i.cost === undefined)).toHaveLength(m.noCost);
    expect(where(ruleset, (i) => i.weight === undefined)).toHaveLength(m.noWeight);
    expect(where(ruleset, (i) => i.text !== undefined)).toHaveLength(m.text);
    for (const i of made(ruleset)) {
      if (i.cost !== undefined) expect(i.cost.amount, i.id).toBeGreaterThan(0);
      if (i.weight !== undefined) expect(i.weight, i.id).toBeGreaterThan(0);
    }
  });

  it('counts the weapons by group, kind, versatile and mastery, and tags each melee or ranged', () => {
    const weapons = where(ruleset, (i) => i.category === 'weapon');
    const w = m.weapons;
    expect({
      simple: weapons.filter((i) => i.weapon?.group === 'simple').length,
      martial: weapons.filter((i) => i.weapon?.group === 'martial').length,
      melee: weapons.filter((i) => i.weapon?.kind === 'melee').length,
      ranged: weapons.filter((i) => i.weapon?.kind === 'ranged').length,
      versatile: weapons.filter((i) => i.weapon?.versatile !== undefined).length,
      mastery: weapons.filter((i) => i.weapon?.mastery !== undefined).length,
    }).toEqual(w);
    for (const i of weapons) expect(i.tags, i.id).toEqual([i.weapon?.kind]);
    expect(
      where(ruleset, (i) => i.category !== 'weapon' && (i.tags ?? []).includes('melee')),
    ).toEqual([]);
  });

  it('names a damage type, a property and a mastery that CONT-14 made', () => {
    const keys = (type: string) =>
      new Set(run[ruleset].entities.filter((e) => e.type === type).map((e) => e.key));
    for (const i of where(ruleset, (x) => x.category === 'weapon')) {
      if (i.weapon?.damage) expect(keys('damageType').has(i.weapon.damage.type), i.id).toBe(true);
      for (const p of i.weapon?.properties ?? []) {
        expect(keys('weaponProperty').has(p), `${i.id} ${p}`).toBe(true);
      }
      if (i.weapon?.mastery) expect(keys('weaponMastery').has(i.weapon.mastery), i.id).toBe(true);
    }
  });

  it('groups the armor 3 light, 5 medium and 4 heavy, with the Dexterity each allows', () => {
    const armor = where(ruleset, (i) => i.category === 'armor');
    const group = (name: string) => armor.filter((i) => i.armor?.group === name);
    expect([group('light').length, group('medium').length, group('heavy').length]).toEqual([
      3, 5, 4,
    ]);
    expect(group('light').every((i) => i.armor?.dexCap === null)).toBe(true);
    expect(group('medium').every((i) => i.armor?.dexCap === 2)).toBe(true);
    expect(group('heavy').every((i) => i.armor?.dexCap === 0)).toBe(true);
    expect(item(ruleset, 'hide-armor').armor).toMatchObject({
      group: 'medium',
      baseAC: 12,
      dexCap: 2,
    });
    expect(
      armor
        .filter((i) => i.armor?.strRequirement !== undefined)
        .map((i) => i.armor?.strRequirement)
        .sort(),
    ).toEqual([13, 15, 15]);
    expect(armor.filter((i) => i.armor?.stealthDisadvantage === true)).toHaveLength(7);
  });

  it('makes a pack of each of the seven, with its contents as an item grant', () => {
    const ids = new Set(made(ruleset).map((i) => i.id));
    const packs = where(ruleset, (i) => i.category === 'pack');
    expect(packs.every((p) => p.grants?.length === 1 && p.grants[0]?.id === 'contents')).toBe(true);
    for (const p of packs) {
      for (const part of p.grants?.[0]?.fixed ?? []) {
        expect(ids.has(part.id), `${p.id} holds ${part.id}`).toBe(true);
        expect(part.qty).toBeGreaterThan(0);
      }
    }
    expect(where(ruleset, (i) => i.category !== 'pack' && i.grants !== undefined)).toEqual([]);
  });
});

describe('CONT-12 SRD 5.1', () => {
  it('has the 40 mounts and vehicles as `transport`, tagged by kind: 9, 25 and 6', () => {
    const transport = where('2014', (i) => i.category === 'transport');
    const tagged = (tag: string) => transport.filter((i) => i.tags?.[0] === tag).length;
    expect([
      tagged('Mounts and Other Animals'),
      tagged('Tack, Harness, and Drawn Vehicles'),
      tagged('Waterborne Vehicles'),
    ]).toEqual([9, 25, 6]);
    expect(item('2014', 'camel').category).toBe('transport');
  });

  it('puts the four kits that are tool proficiencies among the tools', () => {
    for (const slug of ['disguise-kit', 'forgery-kit', 'herbalism-kit', 'poisoners-kit']) {
      expect(item('2014', slug).category, slug).toBe('tool');
    }
    expect(item('2014', 'healers-kit').category).toBe('gear');
    expect(item('2014', 'arrow').category).toBe('ammunition');
    expect(item('2014', 'amulet').category).toBe('focus');
  });

  it('reads a weapon: damage, versatile, properties, range, and a net with no damage', () => {
    expect(item('2014', 'longsword').weapon).toEqual({
      group: 'martial',
      kind: 'melee',
      damage: { formula: '1d8', type: 'slashing' },
      versatile: '1d10',
      properties: ['versatile'],
      range: { normal: 5 },
    });
    expect(item('2014', 'longbow').weapon?.range).toEqual({ normal: 150, long: 600 });
    expect(item('2014', 'longbow').weapon?.properties).toEqual([
      'ammunition',
      'heavy',
      'twoHanded',
    ]);
    expect(item('2014', 'net').weapon?.damage).toBeUndefined();
  });

  it('reads the free items as having no price', () => {
    expect(item('2014', 'vestments').cost).toBeUndefined();
    expect(item('2014', 'abacus').cost).toEqual({ amount: 2, unit: 'gp' });
  });
});

describe('CONT-12 SRD 5.2.1', () => {
  it('has no mount or vehicle', () => {
    expect(where('2024', (i) => i.category === 'transport')).toEqual([]);
  });

  it('puts the packs and the disguise kit where the categories file puts them, not the entry', () => {
    expect(item('2024', 'explorers-pack').category).toBe('pack');
    expect(item('2024', 'entertainers-pack').category).toBe('pack');
    expect(item('2024', 'disguise-kit').category).toBe('tool');
    expect(item('2024', 'forgery-kit').category).toBe('tool');
  });

  it('reads a weapon with its mastery, and the quarterstaff as a weapon before a focus', () => {
    expect(item('2024', 'longsword').weapon).toMatchObject({
      group: 'martial',
      kind: 'melee',
      mastery: 'sap',
      versatile: '1d10',
    });
    expect(item('2024', 'quarterstaff').category).toBe('weapon');
    expect(item('2024', 'lance').weapon?.properties).toEqual(['heavy', 'reach', 'twoHanded']);
    expect(item('2024', 'lance').text?.en).toMatch(/\S/);
  });
});

describe('CONT-12 the hand-written packs', () => {
  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: each item it holds is imported with the same key, name, category, price, weight and blocks',
    (ruleset, pack) => {
      const held = pack.entities.filter((e) => e.type === 'item') as unknown as Item[];
      expect(held.length).toBeGreaterThan(0);
      for (const h of held) {
        const imported = made(ruleset).find((i) => i.id === h.id);
        expect(imported, h.id).toBeDefined();
        expect(imported?.key, h.id).toBe(h.key);
        expect(imported?.name, h.id).toEqual(h.name);
        expect(imported?.category, h.id).toBe(h.category);
        expect(imported?.cost, h.id).toEqual(h.cost);
        expect(imported?.weight, h.id).toEqual(h.weight);
        expect(imported?.armor, h.id).toEqual(h.armor);
        expect(imported?.effects, h.id).toEqual(h.effects);
        if (h.weapon !== undefined) expect(imported?.weapon, h.id).toMatchObject(h.weapon);
      }
    },
  );
});
