import { type Computed, compute, loadContentIndex, parseRoll } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenB4, goldenC2014, srd2014, srd2024 } from './golden/index.ts';

// ENG-16: weapon attacks. The rules are ENG-16 §8's. The character's own items (`character:`) are
// made up, no text of a book; each value below was worked out by hand from them and the goldens'
// data, never copied from a run. Golden A (2014): STR 13 (+1), DEX 10 (+0), proficiency +2,
// simple weapons and the dwarf's battleaxe, handaxe, light hammer, warhammer. Golden B (2024):
// STR 17 (+3), DEX 13 (+1), proficiency +2, simple and martial weapons, the mastery of the
// greatsword, greataxe and glaive.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type Row = CharacterInput['systemData']['inventory'][number];
type ItemInput = Extract<EntityInput, { type: 'item' }>;

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** A character opened as a file would be, computed on its edition's pack; its breakdowns add up. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  const one = opened(openFifthEditionCharacter(character));
  const { index } = one.ruleset === '2014' ? index2014 : index2024;
  const result = compute(one, index, fifthEditionModule);
  for (const [path, steps] of Object.entries(result.breakdown)) {
    const sum = steps.reduce((total, step) => total + step.change, 0);
    expect(sum, path).toBe(result.values[path]);
  }
  return result;
}

/** Path → value, for the paths named. */
function valuesOf(result: Computed<FifthEditionEntity>, paths: readonly string[]) {
  return Object.fromEntries(paths.map((path) => [path, result.values[path]]));
}

/** Each path under `attacks.` and its value, in the order computed. */
function attacksOf(result: Computed<FifthEditionEntity>) {
  return Object.fromEntries(
    Object.entries(result.values).filter(([path]) => path.startsWith('attacks.')),
  );
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

/** A path's steps, each as `kind path|rule|source change`. */
function stepsOf(result: Computed<FifthEditionEntity>, path: string): string[] {
  return (result.breakdown[path] ?? []).map((step) => {
    const name =
      'path' in step && step.kind === 'path'
        ? step.path
        : 'rule' in step
          ? step.rule
          : 'part' in step
            ? step.part
            : 'source' in step
              ? step.source
              : '';
    return `${step.kind} ${name} ${step.change}`;
  });
}

/** Freezes an object and everything in it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

const source = { pack: 'character' };

/** A made-up weapon: its key is its slug unless `key` is `null`. */
function weapon(
  slug: string,
  fields: Partial<NonNullable<ItemInput['weapon']>>,
  rest: Partial<ItemInput> = {},
  key: string | null = slug,
): ItemInput {
  return {
    id: `character:item/${slug}`,
    type: 'item',
    ...(key !== null && { key }),
    ruleset: 'any',
    name: { en: slug },
    source,
    category: 'weapon',
    weapon: {
      group: 'simple',
      kind: 'melee',
      damage: { formula: '1d6', type: 'slashing' },
      ...fields,
    },
    ...rest,
  };
}

/** A simple melee finesse weapon, 1d4. */
const stiletto = weapon('stiletto', {
  damage: { formula: '1d4', type: 'piercing' },
  properties: ['finesse'],
});
/** A simple ranged weapon, 1d4. */
const slingshot = weapon('slingshot', {
  kind: 'ranged',
  damage: { formula: '1d4', type: 'bludgeoning' },
});
/** A martial melee weapon no golden is proficient with, 1d8. */
const longblade = weapon('longblade', {
  group: 'martial',
  damage: { formula: '1d8', type: 'slashing' },
});
/** A martial melee weapon +1, no attunement. */
const keenblade = weapon(
  'keenblade',
  { group: 'martial' },
  { magic: { rarity: 'uncommon', bonus: 1 } },
);
/** A martial melee weapon +2 that needs attunement. */
const boundblade = weapon(
  'boundblade',
  { group: 'martial' },
  { magic: { rarity: 'rare', attunement: true, bonus: 2 } },
);
/** A simple melee weapon whose damage is a fixed 1, no dice. */
const cudgel = weapon('cudgel', { damage: { formula: '1', type: 'bludgeoning' } });
/** A simple melee weapon whose damage formula does not parse. */
const brokenFlail = weapon(
  'broken-flail',
  { damage: { formula: '1d', type: 'bludgeoning' } },
  {},
  'brokenFlail',
);
/** A simple melee weapon with no key. */
const nameless = weapon('nameless', {}, {}, null);
/** A 2014 weapon with the greatsword's key. */
const oldGreatsword: ItemInput = {
  ...weapon('old-greatsword', { group: 'martial', damage: { formula: '2d6', type: 'slashing' } }),
  key: 'greatsword',
  ruleset: '2014',
};
const own = [stiletto, slingshot, longblade, keenblade, boundblade, cudgel, brokenFlail, nameless];

/** A feat: +2 to ranged weapon attacks, +2 to melee weapon damage. */
const marksman: EntityInput = {
  id: 'character:feat/marksman',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Marksman' },
  source,
  effects: [
    { id: 'aim', target: 'attack.weapon.ranged.bonus', op: 'add', value: 2 },
    { id: 'heft', target: 'damage.weapon.melee.bonus', op: 'add', value: 2 },
  ],
};

/** An inventory row of an item, equipped unless said otherwise. */
function row(n: number, itemId: NonNullable<Row['itemId']>, attuned = false, equipped = true): Row {
  return { uid: `c3000000-0000-4000-8000-00000000000${n}`, itemId, qty: 1, equipped, attuned };
}

/** A golden with the made-up items, holding these rows, with `fields` and `data` of its own. */
function holding(
  golden: CharacterInput,
  rows: Row[],
  fields: Partial<CharacterInput> = {},
  data: Partial<CharacterInput['systemData']> = {},
): CharacterInput {
  return {
    ...golden,
    localEntities: [...own, marksman],
    ...fields,
    systemData: { ...golden.systemData, ...data, inventory: rows },
  };
}

/** Golden B holding these rows. */
function b(...rows: Row[]): CharacterInput {
  return holding(goldenB, rows);
}

/** Golden A holding these rows. */
function a(...rows: Row[]): CharacterInput {
  return holding(goldenA, rows);
}

describe('ENG-16 weapon attacks', () => {
  it('gives every character the bonus targets and a critical range of 20', () => {
    // Golden C has no weapon.
    const c = computed(goldenC2014);
    expect(
      valuesOf(c, [
        'attack.weapon.melee.bonus',
        'attack.weapon.ranged.bonus',
        'damage.weapon.melee.bonus',
        'damage.weapon.ranged.bonus',
        'crit.range',
      ]),
    ).toEqual({
      'attack.weapon.melee.bonus': 0,
      'attack.weapon.ranged.bonus': 0,
      'damage.weapon.melee.bonus': 0,
      'damage.weapon.ranged.bonus': 0,
      'crit.range': 20,
    });
    expect(attacksOf(c)).toEqual({});
    expect(stepsOf(c, 'crit.range')).toEqual(['rule criticalHit 20']);
    // Improved Critical's `min 19` takes 1 from it.
    expect(stepsOf(computed(goldenB4), 'crit.range')).toEqual([
      'rule criticalHit 20',
      'effect srd-2024:feature/champion-improved-critical#critical-range -1',
    ]);
  });

  it('adds the stat, the proficiency, the kind bonus and the d20 bonus; damage the stat', () => {
    const result = computed(goldenB);
    expect(attacksOf(result)).toEqual({
      'attacks.greatsword.prof': 1,
      'attacks.greatsword.hit': 5,
      'attacks.greatsword.damage': 3,
      'attacks.greatsword.mastery': 1,
    });
    expect(stepsOf(result, 'attacks.greatsword.prof')).toEqual([
      'grant srd-2024:class/fighter#weapons 1',
    ]);
    expect(stepsOf(result, 'attacks.greatsword.hit')).toEqual([
      'path abilities.str.mod 3',
      'path prof 2',
      'path attack.weapon.melee.bonus 0',
      'path d20.all.bonus 0',
    ]);
    expect(stepsOf(result, 'attacks.greatsword.damage')).toEqual([
      'path abilities.str.mod 3',
      'path damage.weapon.melee.bonus 0',
    ]);
    expect(stepsOf(result, 'attacks.greatsword.mastery')).toEqual([
      'grant srd-2024:feature/fighter-weapon-mastery#kinds 1',
    ]);
  });

  it('takes the finesse stat with the higher modifier, Strength when equal', () => {
    // STR +3 above DEX +1: 3 + 2 = 5 to hit, 3 damage.
    const strong = computed(b(row(1, stiletto.id)));
    expect(valuesOf(strong, ['attacks.stiletto.hit', 'attacks.stiletto.damage'])).toEqual({
      'attacks.stiletto.hit': 5,
      'attacks.stiletto.damage': 3,
    });
    // DEX 18 (+4) above STR +3: 4 + 2 = 6 to hit, 4 damage, both by Dexterity.
    const base = { ...goldenB.abilities.base, dex: 18 };
    const nimble = computed(holding(goldenB, [row(1, stiletto.id)], { abilities: { base } }));
    expect(valuesOf(nimble, ['attacks.stiletto.hit', 'attacks.stiletto.damage'])).toEqual({
      'attacks.stiletto.hit': 6,
      'attacks.stiletto.damage': 4,
    });
    expect(stepsOf(nimble, 'attacks.stiletto.damage')[0]).toBe('path abilities.dex.mod 4');
    // DEX 16 (+3) equal to STR +3: Strength.
    const even = { ...goldenB.abilities.base, dex: 16 };
    const tied = computed(holding(goldenB, [row(1, stiletto.id)], { abilities: { base: even } }));
    expect(stepsOf(tied, 'attacks.stiletto.hit')[0]).toBe('path abilities.str.mod 3');
  });

  it('attacks with Dexterity by a ranged weapon, and adds no proficiency without one', () => {
    // DEX +1 + 2 = 3 to hit, 1 damage.
    const ranged = computed(b(row(1, slingshot.id)));
    expect(valuesOf(ranged, ['attacks.slingshot.hit', 'attacks.slingshot.damage'])).toEqual({
      'attacks.slingshot.hit': 3,
      'attacks.slingshot.damage': 1,
    });
    expect(stepsOf(ranged, 'attacks.slingshot.hit')[2]).toBe('path attack.weapon.ranged.bonus 0');
    // Golden A has no martial weapons but the dwarf's: STR +1, no proficiency.
    const untrained = computed(a(row(1, longblade.id)));
    expect(
      valuesOf(untrained, [
        'attacks.longblade.prof',
        'attacks.longblade.hit',
        'attacks.longblade.damage',
      ]),
    ).toEqual({
      'attacks.longblade.prof': 0,
      'attacks.longblade.hit': 1,
      'attacks.longblade.damage': 1,
    });
    expect(stepsOf(untrained, 'attacks.longblade.prof')).toEqual([]);
    expect(stepsOf(untrained, 'attacks.longblade.hit')[1]).toBe('path prof 0');
  });

  it('adds a magic bonus to attack and damage when its magic works', () => {
    // +1 with no attunement: 6 to hit, 4 damage.
    const keen = computed(b(row(1, keenblade.id)));
    expect(valuesOf(keen, ['attacks.keenblade.hit', 'attacks.keenblade.damage'])).toEqual({
      'attacks.keenblade.hit': 6,
      'attacks.keenblade.damage': 4,
    });
    expect(stepsOf(keen, 'attacks.keenblade.hit')[3]).toBe('entity character:item/keenblade 1');
    // +2 needing attunement: none unattuned (5, 3); attuned 7, 5.
    const paths = ['attacks.boundblade.hit', 'attacks.boundblade.damage'];
    expect(valuesOf(computed(b(row(1, boundblade.id))), paths)).toEqual({
      'attacks.boundblade.hit': 5,
      'attacks.boundblade.damage': 3,
    });
    expect(valuesOf(computed(b(row(1, boundblade.id, true))), paths)).toEqual({
      'attacks.boundblade.hit': 7,
      'attacks.boundblade.damage': 5,
    });
    // Two rows of one weapon: one attack, the first row's attunement.
    const twice = computed(b(row(1, boundblade.id), row(2, boundblade.id, true)));
    expect(attacksOf(twice)).toEqual({
      'attacks.boundblade.prof': 1,
      'attacks.boundblade.hit': 5,
      'attacks.boundblade.damage': 3,
    });
    expect(codes(twice)).toEqual([]);
  });

  it('adds no modifier to fixed damage in 2024, and adds it in 2014', () => {
    // 2024: the cudgel's damage is its 1 alone; the STR +3 is named, not added.
    const modern = computed(b(row(1, cudgel.id)));
    expect(valuesOf(modern, ['attacks.cudgel.hit', 'attacks.cudgel.damage'])).toEqual({
      'attacks.cudgel.hit': 5,
      'attacks.cudgel.damage': 0,
    });
    expect(stepsOf(modern, 'attacks.cudgel.damage')).toEqual([
      'rule fixedDamage 0',
      'path damage.weapon.melee.bonus 0',
    ]);
    expect(modern.breakdown['attacks.cudgel.damage']?.[0]?.value).toBe(3);
    // 2014: STR +1 is added; hit 1 + 2 = 3.
    const legacy = computed(a(row(1, cudgel.id)));
    expect(valuesOf(legacy, ['attacks.cudgel.hit', 'attacks.cudgel.damage'])).toEqual({
      'attacks.cudgel.hit': 3,
      'attacks.cudgel.damage': 1,
    });
    // A formula that does not parse is taken as dice, and warned: STR +3.
    const broken = computed(b(row(1, brokenFlail.id)));
    expect(broken.values['attacks.brokenFlail.damage']).toBe(3);
    const parsed = parseRoll('1d');
    expect(parsed.ok).toBe(false);
    expect(codes(broken)).toEqual([
      {
        code: 'stepFormula',
        path: 'attacks.brokenFlail.damage',
        warning: parsed.ok ? undefined : parsed.error,
      },
    ]);
  });

  it('applies effects on the kind bonuses to that kind only, and an override last', () => {
    const feats = [{ id: 'character:feat/marksman' as const }];
    const rows = [row(1, 'srd-2024:item/greatsword'), row(2, slingshot.id)];
    const result = computed(holding(goldenB, rows, {}, { feats }));
    // Melee: hit 5 unchanged, damage 3 + 2 = 5. Ranged: hit 3 + 2 = 5, damage 1 unchanged.
    const paths = [
      'attacks.greatsword.hit',
      'attacks.greatsword.damage',
      'attacks.slingshot.hit',
      'attacks.slingshot.damage',
    ];
    expect(valuesOf(result, paths)).toEqual({
      'attacks.greatsword.hit': 5,
      'attacks.greatsword.damage': 5,
      'attacks.slingshot.hit': 5,
      'attacks.slingshot.damage': 1,
    });
    expect(stepsOf(result, 'attacks.slingshot.hit')[2]).toBe('path attack.weapon.ranged.bonus 2');
    // An override of the greatsword's attack wins: 9, its step 9 − 5 = 4.
    const overrides = [{ path: 'attacks.greatsword.hit', value: 9 }];
    const overridden = computed(holding(goldenB, rows, { overrides }, { feats }));
    expect(overridden.values['attacks.greatsword.hit']).toBe(9);
    expect(stepsOf(overridden, 'attacks.greatsword.hit').at(-1)).toBe('override  4');
  });

  it('gives a mastery only to a weapon with one, 1 for a kind chosen and 0 for another', () => {
    // The greataxe is chosen; the halberd is not, at level 1.
    const result = computed(
      b(row(1, 'srd-2024:item/greataxe'), row(2, 'srd-2024:item/halberd'), row(3, stiletto.id)),
    );
    expect(
      valuesOf(result, [
        'attacks.greataxe.mastery',
        'attacks.halberd.mastery',
        'attacks.stiletto.mastery',
      ]),
    ).toEqual({
      'attacks.greataxe.mastery': 1,
      'attacks.halberd.mastery': 0,
      'attacks.stiletto.mastery': undefined,
    });
    expect(stepsOf(result, 'attacks.halberd.mastery')).toEqual([]);
    // Golden B4 chose the halberd at level 4.
    const b4 = computed(holding(goldenB4, [row(1, 'srd-2024:item/halberd')]));
    expect(b4.values['attacks.halberd.mastery']).toBe(1);
    // The 2014 warhammer has no mastery.
    expect(computed(goldenA).values['attacks.warhammer.mastery']).toBeUndefined();
  });

  it('gives nothing for a weapon not equipped, and warns of one with no key or a key taken', () => {
    expect(attacksOf(computed(b(row(1, slingshot.id, false, false))))).toEqual({});

    const unnamed = computed(b(row(1, nameless.id)));
    expect(attacksOf(unnamed)).toEqual({});
    expect(codes(unnamed)).toEqual([
      {
        code: 'stepRule',
        path: 'attack.weapon.melee.bonus',
        rule: 'weaponWithoutKey',
        data: { item: nameless.id },
      },
    ]);
    expect(unnamed.values['attack.weapon.melee.bonus']).toBe(0);

    const mixed = computed({
      ...holding(goldenB, [row(1, 'srd-2024:item/greatsword'), row(2, oldGreatsword.id)]),
      allowMixedRulesets: true,
      localEntities: [oldGreatsword],
    });
    expect(attacksOf(mixed)).toEqual({
      'attacks.greatsword.prof': 1,
      'attacks.greatsword.hit': 5,
      'attacks.greatsword.damage': 3,
      'attacks.greatsword.mastery': 1,
    });
    expect(codes(mixed)).toEqual([
      { code: 'otherRuleset', entity: oldGreatsword.id, ruleset: '2014', mixingAllowed: true },
      {
        code: 'stepRule',
        path: 'attack.weapon.melee.bonus',
        rule: 'weaponKeyTaken',
        data: { item: oldGreatsword.id, kept: 'srd-2024:item/greatsword' },
      },
    ]);
  });

  it('stays pure: frozen inputs give equal results', () => {
    const character = deepFreeze(
      opened(openFifthEditionCharacter(b(row(1, stiletto.id), row(2, boundblade.id, true)))),
    );
    const { index } = index2024;
    deepFreeze(index);
    expect(compute(character, index, fifthEditionModule)).toEqual(
      compute(character, index, fifthEditionModule),
    );
  });
});
