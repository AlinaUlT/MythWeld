import { describe, expect, it } from 'vitest';
import { PACK_OF, RULESETS, type Ruleset, runImport, slugOf } from '../src/import/frame.ts';
import { magicItems } from '../src/import/magicItems.ts';
import { smallTypes } from '../src/import/smallTypes.ts';
import { readSourceFile } from '../src/import/source.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-13: the magic items. Control values are measured from the fetched source at `e6edf9a` by a
// script outside the repository (CONT-13 §8). No rules text is written here: the test asserts ids,
// keys, counts and shapes.

interface Item {
  id: string;
  type: string;
  name: { en: string };
  text?: { en: string };
  category: string;
  tags?: string[];
  magic?: { rarity: string; attunement?: boolean | { en: string }; bonus?: number };
  meta?: { variantOf?: string };
  weapon?: unknown;
  armor?: unknown;
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({
      ruleset,
      importers: { smallTypes, magicItems },
      read: (rs, file) => readSourceFile(rs, file),
    }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const made = (ruleset: Ruleset) =>
  run[ruleset].entities.filter((e) => e.type === 'item') as unknown as Item[];
const idOf = (ruleset: Ruleset, slug: string) => `${PACK_OF[ruleset]}:item/${slug}`;
const item = (ruleset: Ruleset, slug: string): Item => {
  const found = made(ruleset).find((e) => e.id === idOf(ruleset, slug));
  if (found === undefined) throw new Error(`${slug} is not imported`);
  return found;
};
const count = (ruleset: Ruleset, test: (i: Item) => boolean) => made(ruleset).filter(test).length;

/** Per ruleset: the items, the categories, the rarity keys and the counts the source gives. */
const MEASURED = {
  '2014': {
    items: 362,
    category: { consumable: 51, ammunition: 5, shield: 4, gear: 302 },
    rarity: {
      common: 4,
      uncommon: 94,
      rare: 119,
      veryRare: 90,
      legendary: 43,
      artifact: 1,
      varies: 11,
    },
    variants: 123,
    bonus: 12,
    attunement: { any: 146, restricted: 29 },
  },
  '2024': {
    items: 262,
    category: { consumable: 20, ammunition: 5, shield: 8, gear: 229 },
    rarity: {
      common: 1,
      uncommon: 74,
      rare: 87,
      veryRare: 54,
      legendary: 32,
      artifact: 1,
      varies: 13,
    },
    variants: 19,
    bonus: 15,
    attunement: { any: 113, restricted: 23 },
  },
} as const;

describe.each(RULESETS)('CONT-13 the magic items of %s', (ruleset) => {
  const m = MEASURED[ruleset];

  it('passes the frame with no problem, and makes one item for each entry', () => {
    expect(run[ruleset].problems).toEqual([]);
    expect(made(ruleset)).toHaveLength(m.items);
    const source = readSourceFile(ruleset, 'Magic-Items');
    expect(made(ruleset).map((i) => i.name.en)).toEqual(source.map((e) => e.name));
  });

  it('names each item under its slug, but for the one that would take an equipment item’s id', () => {
    const equipment = new Set(readSourceFile(ruleset, 'Equipment').map((e) => slugOf(e.index)));
    const source = readSourceFile(ruleset, 'Magic-Items').map((e) => slugOf(e.index));
    const clashing = source.filter((slug) => equipment.has(slug));
    expect(clashing).toEqual(ruleset === '2024' ? ['shield'] : []);
    expect(made(ruleset).map((i) => i.id.split('/')[1])).toEqual(
      source.map((slug) => (equipment.has(slug) ? `${slug}-magic` : slug)),
    );
  });

  it('gives each item its words and a magic block, and no weapon or armor block', () => {
    for (const i of made(ruleset)) {
      expect(i.text?.en, i.id).toMatch(/\S/);
      expect(i.magic?.rarity, i.id).toMatch(/^[a-z][a-zA-Z]*$/);
      expect(i.weapon, i.id).toBeUndefined();
      expect(i.armor, i.id).toBeUndefined();
    }
  });

  it('puts each item in a category: what is drunk or read, ammunition, shields, the rest gear', () => {
    const categories = (c: string) => count(ruleset, (i) => i.category === c);
    expect({
      consumable: categories('consumable'),
      ammunition: categories('ammunition'),
      shield: categories('shield'),
      gear: categories('gear'),
    }).toEqual(m.category);
  });

  it('tags each item with the source’s category', () => {
    const source = readSourceFile(ruleset, 'Magic-Items');
    expect(made(ruleset).map((i) => i.tags)).toEqual(
      source.map((e) => [(e.equipment_category as { name: string }).name]),
    );
  });

  it('gives each item a rarity key of those CONT-14 made, and `varies` for an item that comes in several', () => {
    const keys = new Set(
      run[ruleset].entities.filter((e) => e.type === 'itemRarity').map((e) => e.key),
    );
    for (const i of made(ruleset)) expect(keys.has(i.magic?.rarity ?? ''), i.id).toBe(true);
    const rarity = (key: string) => count(ruleset, (i) => i.magic?.rarity === key);
    expect(Object.fromEntries(Object.keys(m.rarity).map((key) => [key, rarity(key)]))).toEqual(
      m.rarity,
    );
  });

  it('links each variant to its parent, and no other item', () => {
    const ids = new Set(made(ruleset).map((i) => i.id));
    const variants = made(ruleset).filter((i) => i.meta?.variantOf !== undefined);
    expect(variants).toHaveLength(m.variants);
    for (const v of variants) expect(ids.has(v.meta?.variantOf ?? ''), v.id).toBe(true);
    const source = readSourceFile(ruleset, 'Magic-Items');
    expect(variants.map((v) => v.id.split('/')[1])).toEqual(
      source.filter((e) => e.variant === true).map((e) => slugOf(e.index)),
    );
  });

  it('gives a variant its +1, +2 or +3, and an item that is not a variant none', () => {
    const bonus = made(ruleset).filter((i) => i.magic?.bonus !== undefined);
    expect(bonus).toHaveLength(m.bonus);
    expect(bonus.every((i) => i.meta?.variantOf !== undefined)).toBe(true);
    expect(new Set(bonus.map((i) => i.magic?.bonus))).toEqual(new Set([1, 2, 3]));
  });

  it('says what attunement needs: anyone, or the words of who', () => {
    const attuned = made(ruleset).filter((i) => i.magic?.attunement !== undefined);
    const any = attuned.filter((i) => i.magic?.attunement === true);
    expect([any.length, attuned.length - any.length]).toEqual([
      m.attunement.any,
      m.attunement.restricted,
    ]);
    for (const i of attuned) {
      const who = i.magic?.attunement;
      expect(who === true || /\S/.test((who as { en: string }).en), i.id).toBe(true);
    }
  });
});

describe('CONT-13 SRD 5.1', () => {
  it('reads the first line: attunement, and who may', () => {
    expect(item('2014', 'ring-of-protection').magic).toEqual({ rarity: 'rare', attunement: true });
    expect(item('2014', 'bag-of-holding').magic).toEqual({ rarity: 'uncommon' });
    expect(item('2014', 'holy-avenger').magic).toEqual({
      rarity: 'legendary',
      attunement: { en: 'a paladin' },
    });
    expect(item('2014', 'ring-of-shooting-stars').magic?.attunement).toEqual({
      en: 'outdoors at night',
    });
  });

  it('takes a variant’s kind from its parent, and its bonus from its name', () => {
    const ammunition = item('2014', 'ammunition-1');
    expect(ammunition.category).toBe('ammunition');
    expect(ammunition.meta).toEqual({ variantOf: idOf('2014', 'ammunition') });
    expect(ammunition.magic).toEqual({ rarity: 'uncommon', bonus: 1 });
    expect(item('2014', 'armor-1').magic).toEqual({ rarity: 'rare', bonus: 1 });
    expect(item('2014', 'ammunition').magic).toEqual({ rarity: 'varies' });
    expect(item('2014', 'potion-of-healing').category).toBe('consumable');
    expect(item('2014', 'arrow-of-slaying').category).toBe('ammunition');
    expect(item('2014', 'animated-shield').category).toBe('shield');
    expect(item('2014', 'adamantine-armor').category).toBe('gear');
  });
});

describe('CONT-13 SRD 5.2.1', () => {
  it('reads the flag and who may attune', () => {
    expect(item('2024', 'ring-of-protection').magic).toEqual({ rarity: 'rare', attunement: true });
    expect(item('2024', 'bag-of-holding').magic).toEqual({ rarity: 'uncommon' });
    expect(item('2024', 'holy-avenger').magic).toEqual({
      rarity: 'legendary',
      attunement: { en: 'Paladin' },
    });
    expect(item('2024', 'staff-of-healing').magic?.attunement).toEqual({
      en: 'Bard, Cleric, or Druid',
    });
  });

  it('gives the magic shield an id of its own, and the equipment’s shield is not made here', () => {
    const shield = item('2024', 'shield-magic');
    expect(shield.category).toBe('shield');
    expect(shield.magic).toEqual({ rarity: 'varies' });
    expect(made('2024').some((i) => i.id === idOf('2024', 'shield'))).toBe(false);
    for (const [slug, bonus] of [
      ['shield-1', 1],
      ['shield-2', 2],
      ['shield-3', 3],
    ] as const) {
      const variant = item('2024', slug);
      expect(variant.meta).toEqual({ variantOf: idOf('2024', 'shield-magic') });
      expect(variant.category).toBe('shield');
      expect(variant.magic?.bonus).toBe(bonus);
    }
  });

  it('reads a bonus from the rarity or the name, and `varies` where an item has several rarities', () => {
    expect(item('2024', 'ammunition-2').magic).toEqual({ rarity: 'rare', bonus: 2 });
    expect(item('2024', 'armor-3').magic?.bonus).toBe(3);
    expect(item('2024', 'wand-of-the-war-mage-1').magic).toEqual({
      rarity: 'uncommon',
      attunement: { en: 'Spellcaster' },
      bonus: 1,
    });
    expect(item('2024', 'ammunition').magic).toEqual({ rarity: 'varies' });
    expect(item('2024', 'ammunition').category).toBe('ammunition');
  });
});

describe('CONT-13 the hand-written packs', () => {
  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)('%s: no item it holds takes the id of a magic item', (ruleset, pack) => {
    const ids = new Set(made(ruleset).map((i) => i.id));
    const held = pack.entities.filter((e) => e.type === 'item');
    expect(held.length).toBeGreaterThan(0);
    for (const e of held) expect(ids.has(e.id), e.id).toBe(false);
  });
});
