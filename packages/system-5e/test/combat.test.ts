import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  hitPointsOf,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenD,
  srd2014,
  srd2024,
} from './golden/index.ts';

// ENG-14: fifth edition's combat numbers. The rules are ENG-14 §8's. The character's own entities
// (`character:`) are made up, no text of a book; each value below was worked out by hand from
// them and the goldens' data, never copied from a run. Golden B: DEX 13 (+1), CON 15 (+2), the
// fighter's d10 at level 1, chain mail (16, no DEX), Defense (+1 AC in armor), Alert (+2
// initiative), the human's walking speed 30.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type Row = CharacterInput['systemData']['inventory'][number];

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

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
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

/** An inventory row of an item, equipped unless said otherwise. */
function row(n: number, itemId: NonNullable<Row['itemId']>, equipped = true, attuned = false): Row {
  return { uid: `a1000000-0000-4000-8000-00000000000${n}`, itemId, qty: 1, equipped, attuned };
}

/** A made-up armor of a group, its base AC and its Dexterity cap. */
function armor(slug: string, group: 'light' | 'medium', baseAC: number, dexCap: number | null) {
  return {
    id: `character:item/${slug}`,
    type: 'item',
    ruleset: 'any',
    name: { en: slug },
    source,
    category: 'armor',
    armor: { group, baseAC, dexCap },
  } satisfies EntityInput;
}

const leather = armor('leather', 'light', 11, null);
const hide = armor('hide', 'medium', 12, 2);
const chainMail = 'srd-2024:item/chain-mail' as const;

/** A made-up feat with these effects (and grants). */
function feat(slug: string, effects: EntityInput['effects'], grants?: EntityInput['grants']) {
  return {
    id: `character:feat/${slug}`,
    type: 'feat',
    ruleset: 'any',
    name: { en: slug },
    source,
    effects,
    ...(grants && { grants }),
  } satisfies EntityInput;
}

/** Golden B with entities of its own, the feats among them taken, and changes to its data. */
function goldenBWith(
  own: EntityInput[],
  data: Partial<CharacterInput['systemData']> = {},
  base: CharacterInput = goldenB,
): CharacterInput {
  const feats = own.flatMap(({ id, type }) => (type === 'feat' ? [{ id }] : []));
  return {
    ...base,
    localEntities: own,
    systemData: { ...base.systemData, feats, ...data },
  };
}

describe('ENG-14 combat numbers', () => {
  it("gives each level's hit points by its entry: the die, half the die + 1, or the number", () => {
    expect([6, 8, 10, 12].map((die) => [hitPointsOf(die, 'max'), hitPointsOf(die, 'avg')])).toEqual(
      [
        [6, 4],
        [8, 5],
        [10, 6],
        [12, 7],
      ],
    );
    expect(hitPointsOf(10, 3)).toBe(3);
  });

  it('names each equipped item with its own paths; an item not equipped gives nothing', () => {
    const a = computed(goldenA);
    expect(valuesOf(a, ['armor.worn', 'shield', 'ac.bonus', 'ac.total'])).toEqual({
      'armor.worn': 1,
      shield: 1,
      'ac.bonus': 2,
      'ac.total': 18,
    });
    expect(a.entities.find(({ entity }) => entity.id === 'srd-2014:item/shield')?.paths).toEqual({
      equipped: 1,
      attuned: 0,
    });
    // The shield's own effect, `when: '@equipped'`.
    expect(a.breakdown['ac.bonus']).toEqual([
      {
        kind: 'effect',
        part: 'srd-2014:item/shield#armor-class',
        source: 'srd-2014:item/shield',
        label: { en: 'Shield' },
        op: 'add',
        value: 2,
        change: 2,
      },
    ]);
    expect(a.breakdown.shield).toEqual([
      {
        kind: 'entity',
        source: 'srd-2014:item/shield',
        label: { en: 'Shield' },
        value: 1,
        change: 1,
      },
    ]);
    // The shield's row not equipped: not gathered, no +2; chain mail 16.
    const inventory = goldenA.systemData.inventory.map((each) =>
      each.itemId === 'srd-2014:item/shield' ? { ...each, equipped: false } : each,
    );
    const bare = computed({ ...goldenA, systemData: { ...goldenA.systemData, inventory } });
    expect(bare.entities.map(({ entity }) => entity.id)).not.toContain('srd-2014:item/shield');
    expect(valuesOf(bare, ['shield', 'ac.bonus', 'ac.total'])).toEqual({
      shield: 0,
      'ac.bonus': 0,
      'ac.total': 16,
    });
    expect(bare.breakdown.shield).toEqual([]);
    expect(bare.warnings).toEqual([]);
  });

  it("reads `@attuned` as the row's flag", () => {
    const charm = {
      id: 'character:item/charm',
      type: 'item',
      ruleset: 'any',
      name: { en: 'Charm' },
      source,
      category: 'gear',
      effects: [{ id: 'ward', target: 'ac.bonus', op: 'add', value: 1, when: '@attuned' }],
    } satisfies EntityInput;
    const wearing = (attuned: boolean) =>
      computed(
        goldenBWith([charm], {
          inventory: [row(1, chainMail), row(2, 'character:item/charm', true, attuned)],
        }),
      ).values['ac.total'];
    // 16 + Defense 1, + the charm's 1 when attuned.
    expect([wearing(true), wearing(false)]).toEqual([18, 17]);
  });

  it('adds Dexterity as the armor allows: all, at most its cap, none; 10 + DEX with none', () => {
    const acOf = (dex: number, inventory: Row[]) =>
      computed(
        goldenBWith(
          [leather, hide],
          { inventory },
          {
            ...goldenB,
            abilities: { base: { ...goldenB.abilities.base, dex } },
          },
        ),
      ).values['ac.base'];
    const worn = [[row(1, leather.id)], [row(1, hide.id)], [row(1, chainMail)], []];
    // DEX 16 (+3): leather 11 + 3, hide 12 + 2 (its cap), chain mail 16, none 10 + 3.
    expect(worn.map((inventory) => acOf(16, inventory))).toEqual([14, 14, 16, 13]);
    // DEX 8 (−1): leather 11 − 1, hide 12 − 1, chain mail 16 (no penalty), none 10 − 1.
    expect(worn.map((inventory) => acOf(8, inventory))).toEqual([10, 11, 16, 9]);

    const medium = computed(
      goldenBWith(
        [hide],
        { inventory: [row(1, hide.id)] },
        {
          ...goldenB,
          abilities: { base: { ...goldenB.abilities.base, dex: 16 } },
        },
      ),
    );
    expect(medium.breakdown['ac.base']).toEqual([
      { kind: 'entity', source: hide.id, label: { en: 'hide' }, value: 12, change: 12 },
      { kind: 'path', path: 'abilities.dex.mod', value: 3, change: 2 },
    ]);
    // Defense's +1 reads `@armor.worn`: 14 + 1.
    expect(valuesOf(medium, ['armor.worn', 'ac.total'])).toEqual({
      'armor.worn': 1,
      'ac.total': 15,
    });
    expect(computed(goldenB).breakdown['ac.base']).toEqual([
      {
        kind: 'entity',
        source: chainMail,
        label: { en: 'Chain Mail' },
        value: 16,
        change: 16,
      },
    ]);
    const unarmored = computed(goldenBWith([], { inventory: [] }));
    expect(unarmored.breakdown['ac.base']).toEqual([
      { kind: 'rule', rule: 'unarmoredAC', value: 10, change: 10 },
      { kind: 'path', path: 'abilities.dex.mod', value: 1, change: 1 },
    ]);
    // No armor: Defense does not apply. 10 + 1.
    expect(valuesOf(unarmored, ['armor.worn', 'ac.bonus', 'ac.total'])).toEqual({
      'armor.worn': 0,
      'ac.bonus': 0,
      'ac.total': 11,
    });
  });

  it('takes the first armor gathered as the one worn', () => {
    const result = computed(
      goldenBWith([leather], { inventory: [row(1, leather.id), row(2, chainMail)] }),
    );
    // Leather 11 + DEX 1, + Defense 1.
    expect(valuesOf(result, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 12, 'ac.total': 13 });
    expect(result.breakdown['armor.worn']).toEqual([
      { kind: 'entity', source: leather.id, label: { en: 'leather' }, value: 1, change: 1 },
    ]);
  });

  it('takes the highest AC candidate an effect appends, when its `when` holds', () => {
    const guarded = feat('guarded', [
      {
        id: 'unarmored',
        target: 'ac.formulas',
        op: 'append',
        value: '10 + @abilities.dex.mod + @abilities.con.mod',
        when: '!@armor.worn',
      },
    ]);
    // No armor: 10 + 1 + 2 = 13 above 10 + 1.
    const bare = computed(goldenBWith([guarded], { inventory: [] }));
    expect(valuesOf(bare, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 13, 'ac.total': 13 });
    expect(bare.breakdown['ac.base']).toEqual([
      {
        kind: 'effect',
        part: 'character:feat/guarded#unarmored',
        source: 'character:feat/guarded',
        label: { en: 'guarded' },
        op: 'append',
        value: 13,
        change: 13,
      },
    ]);
    // In chain mail its `when` is false: 16 + Defense 1.
    const armored = computed(goldenBWith([guarded]));
    expect(valuesOf(armored, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 16, 'ac.total': 17 });
    expect(bare.warnings).toEqual([]);
    expect(armored.warnings).toEqual([]);

    // A candidate equal to the module's own keeps the module's: 10 + 1 both.
    const plain = feat('plain', [
      { id: 'same', target: 'ac.formulas', op: 'append', value: '10 + @abilities.dex.mod' },
    ]);
    expect(computed(goldenBWith([plain], { inventory: [] })).breakdown['ac.base']).toEqual([
      { kind: 'rule', rule: 'unarmoredAC', value: 10, change: 10 },
      { kind: 'path', path: 'abilities.dex.mod', value: 1, change: 1 },
    ]);
  });

  it('warns of an op on `ac.formulas` that appends nothing', () => {
    const odd = feat('odd', [
      { id: 'note', target: 'ac.formulas', op: 'note', value: { en: 'Sturdy' } },
      { id: 'plus', target: 'ac.formulas', op: 'add', value: 1 },
    ]);
    const result = computed(goldenBWith([odd]));
    expect(result.values['ac.total']).toBe(17);
    expect(codes(result)).toEqual([
      { code: 'notAppended', part: 'character:feat/odd#note', op: 'note', target: 'ac.formulas' },
      { code: 'noTarget', part: 'character:feat/odd#plus', target: 'ac.formulas' },
    ]);
  });

  it('gives each level its hit points and Constitution, at least 1 a level, then the bonus', () => {
    const a = computed(goldenA);
    expect(a.breakdown['hp.max']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2014:class/cleric',
        label: { en: 'Cleric' },
        value: 8,
        change: 8,
      },
      { kind: 'path', path: 'abilities.con.mod', value: 3, change: 3 },
      { kind: 'path', path: 'hp.max.bonus', value: 1, change: 1 },
      { kind: 'path', path: 'hp.max.mul', value: 1, change: 0 },
    ]);
    expect(a.breakdown['hp.max.bonus']).toEqual([
      {
        kind: 'effect',
        part: 'srd-2014:feature/dwarven-toughness#hit-points',
        source: 'srd-2014:feature/dwarven-toughness',
        label: { en: 'Dwarven Toughness' },
        op: 'add',
        value: 1,
        change: 1,
      },
    ]);
    // Golden B4: 10 + 6 + 6 + 6, CON +2 × 4.
    expect(computed(goldenB4).breakdown['hp.max']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2024:class/fighter',
        label: { en: 'Fighter' },
        value: 28,
        change: 28,
      },
      { kind: 'path', path: 'abilities.con.mod', value: 2, change: 8 },
      { kind: 'path', path: 'hp.max.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'hp.max.mul', value: 1, change: 0 },
    ]);
    // Golden C (2014): the wizard's 6 + 4 + 4, the paladin's 6 × 3, CON 12 (+1) × 6.
    expect(computed(goldenC2014).values['hp.max']).toBe(38);

    // CON 8 (−1), the wizard's levels max, 1 and avg: 6 − 1, 1 − 1 → 1, 4 − 1; the paladin's 3 × 5.
    const frail = computed({
      ...goldenC2014,
      abilities: { base: { ...goldenC2014.abilities.base, con: 8 } },
      systemData: {
        ...goldenC2014.systemData,
        classes: [
          { id: 'srd-2014:class/wizard', level: 3, hp: ['max', 1, 'avg'] },
          { id: 'srd-2014:class/paladin', level: 3, hp: ['avg', 'avg', 'avg'] },
        ],
      },
    });
    expect(frail.values['hp.max']).toBe(24);
    expect(frail.breakdown['hp.max']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2014:class/wizard',
        label: { en: 'Wizard' },
        value: 11,
        change: 11,
      },
      {
        kind: 'entity',
        source: 'srd-2014:class/paladin',
        label: { en: 'Paladin' },
        value: 18,
        change: 18,
      },
      { kind: 'path', path: 'abilities.con.mod', value: -1, change: -6 },
      { kind: 'rule', rule: 'hitPointsMinimum', value: 1, change: 1 },
      { kind: 'path', path: 'hp.max.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'hp.max.mul', value: 1, change: 0 },
    ]);
    expect(frail.warnings).toEqual([]);
  });

  it('warns of a number above the die, and uses the die; a class no pack has gives none', () => {
    const rolled = computed({
      ...goldenC2014,
      systemData: {
        ...goldenC2014.systemData,
        classes: [
          { id: 'srd-2014:class/wizard', level: 3, hp: ['max', 7, 'avg'] },
          { id: 'srd-2014:class/paladin', level: 3, hp: ['avg', 'avg', 'avg'] },
        ],
      },
    });
    // The wizard's 6 + 6 + 4, the paladin's 18, CON +1 × 6.
    expect(rolled.values['hp.max']).toBe(40);
    expect(codes(rolled)).toEqual([
      {
        code: 'stepRule',
        path: 'hp.max',
        rule: 'hitPointsAboveDie',
        data: { class: 'srd-2014:class/wizard', level: 2, value: 7, die: 6 },
      },
    ]);

    // Golden B with a second class no pack has: the fighter's 10 + 2 alone.
    const lost = computed({
      ...goldenB,
      systemData: {
        ...goldenB.systemData,
        classes: [
          ...goldenB.systemData.classes,
          { id: 'character:class/gone', level: 1, hp: ['avg'] },
        ],
      },
    });
    expect(valuesOf(lost, ['level', 'hp.max'])).toEqual({ level: 2, 'hp.max': 12 });
    expect(codes(lost)).toEqual([
      { code: 'missing', id: 'character:class/gone', from: 'character' },
    ]);
  });

  it("adds the Dexterity check's bonuses and `init.bonus` to initiative", () => {
    const b = computed(goldenB);
    expect(b.breakdown['init.total']).toEqual([
      { kind: 'path', path: 'checks.dex.total', value: 1, change: 1 },
      { kind: 'path', path: 'init.bonus', value: 2, change: 2 },
    ]);
    const quick = feat('quick', [{ id: 'dex', target: 'checks.dex.bonus', op: 'add', value: 2 }]);
    // DEX +1 + 2, + Alert 2.
    expect(computed(goldenBWith([quick])).values['init.total']).toBe(5);
    // Golden D: +1 − 4, + 2.
    expect(computed(goldenD).breakdown['init.total']).toEqual([
      { kind: 'path', path: 'checks.dex.total', value: -3, change: -3 },
      { kind: 'path', path: 'init.bonus', value: 2, change: 2 },
    ]);
  });

  it("gives every kind of speed: the species' or a lineage's own, its bonuses, at least 0", () => {
    const kinds = ['speed.walk', 'speed.fly', 'speed.swim', 'speed.climb', 'speed.burrow'];
    expect(valuesOf(computed(goldenB), kinds)).toEqual({
      'speed.walk': 30,
      'speed.fly': 0,
      'speed.swim': 0,
      'speed.climb': 0,
      'speed.burrow': 0,
    });
    expect(computed(goldenD).breakdown['speed.walk']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2024:species/human',
        label: { en: 'Human' },
        value: 30,
        change: 30,
      },
      // ENG-45: STR 17 meets chain mail's 13.
      { kind: 'path', path: 'speed.armorReduction', value: 0, change: 0 },
      { kind: 'path', path: 'speed.walk.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'speed.all.bonus', value: -10, change: -10 },
      { kind: 'path', path: 'speed.all.mul', value: 1, change: 0 },
    ]);
    // Golden C has no species: no speed, and no step.
    const c = computed(goldenC2014);
    expect(valuesOf(c, kinds)).toEqual(Object.fromEntries(kinds.map((kind) => [kind, 0])));
    expect(c.breakdown['speed.walk']).toEqual([]);

    // A lineage of the character's own, given by a feat: its walk 35 over the human's 30, swim 20.
    const kin = {
      id: 'character:lineage/fleet-kin',
      type: 'lineage',
      ruleset: 'any',
      name: { en: 'Fleet kin' },
      source,
      speed: { walk: 35, swim: 20 },
    } satisfies EntityInput;
    const fleet = feat(
      'fleet',
      [],
      [{ id: 'kin', kind: 'entity', fixed: ['character:lineage/fleet-kin'] }],
    );
    const fleetB = computed(goldenBWith([fleet, kin]));
    expect(valuesOf(fleetB, ['speed.walk', 'speed.swim', 'speed.fly'])).toEqual({
      'speed.walk': 35,
      'speed.swim': 20,
      'speed.fly': 0,
    });
    expect(fleetB.breakdown['speed.walk']?.[0]).toEqual({
      kind: 'entity',
      source: 'character:lineage/fleet-kin',
      label: { en: 'Fleet kin' },
      value: 35,
      change: 35,
    });
  });

  it("adds a kind's bonus to that kind only, multiplies rounding down, never gives below 0", () => {
    const slowed = feat('slowed', [
      { id: 'walk', target: 'speed.walk.bonus', op: 'add', value: 5 },
      { id: 'fly', target: 'speed.fly.bonus', op: 'add', value: 10 },
      { id: 'half', target: 'speed.all.mul', op: 'mul', value: 0.5 },
    ]);
    // (30 + 5) × 0.5 = 17.5 → 17; no fly speed to add to.
    const half = computed(goldenBWith([slowed]));
    expect(valuesOf(half, ['speed.walk', 'speed.fly', 'speed.all.mul'])).toEqual({
      'speed.walk': 17,
      'speed.fly': 0,
      'speed.all.mul': 0.5,
    });
    expect(half.breakdown['speed.walk']?.at(-1)).toEqual({
      kind: 'path',
      path: 'speed.all.mul',
      value: 0.5,
      change: -18,
    });

    // Golden D, −25 more: 30 − 25 − 10 = −5 → 0.
    const stuck = feat('stuck', [
      { id: 'walk', target: 'speed.walk.bonus', op: 'add', value: -25 },
    ]);
    const zero = computed(goldenBWith([stuck], {}, goldenD));
    expect(zero.values['speed.walk']).toBe(0);
    expect(zero.breakdown['speed.walk']?.slice(-2)).toEqual([
      { kind: 'rule', rule: 'speedFloor', value: 0, change: 5 },
      { kind: 'path', path: 'speed.all.mul', value: 1, change: 0 },
    ]);

    // An effect on a kind the character lacks has a path to change: a fly speed of its walking one.
    const winged = feat('winged', [
      { id: 'fly', target: 'speed.fly', op: 'max', value: '@speed.walk' },
    ]);
    const flying = computed(goldenBWith([winged]));
    expect(valuesOf(flying, ['speed.walk', 'speed.fly'])).toEqual({
      'speed.walk': 30,
      'speed.fly': 30,
    });
    expect(flying.warnings).toEqual([]);
  });

  it('stays pure: frozen inputs give equal results', () => {
    const character = deepFreeze(opened(openFifthEditionCharacter(goldenA)));
    const { index } = index2014;
    deepFreeze(index);
    expect(compute(character, index, fifthEditionModule)).toEqual(
      compute(character, index, fifthEditionModule),
    );
  });
});

// ENG-45: chain mail's Str 13 (both fixtures) against the wearer's Strength. Golden B's STR is its
// base + 2 (the Soldier's +2, chosen on STR): base 10 gives 12, base 11 gives 13. Golden A's dwarf
// adds no STR: base 12 gives 12. The 10 feet and "equal to or higher" are ENG-45 §8's.

/** A golden character with another base Strength. */
function withStrength<T extends CharacterInput>(character: T, str: number): T {
  return { ...character, abilities: { base: { ...character.abilities.base, str } } };
}

describe("ENG-45 heavy armor's Strength requirement", () => {
  const weakB = withStrength(goldenB, 10);
  const slowing = [
    {
      kind: 'entity',
      source: 'srd-2024:item/chain-mail',
      label: { en: 'Chain Mail' },
      value: 13,
      change: 0,
    },
    { kind: 'path', path: 'abilities.str.score', value: 12, change: 0 },
    { kind: 'rule', rule: 'armorStrength', value: 10, change: 10 },
  ];

  it('takes 10 feet from the speed of a wearer whose Strength is below the requirement', () => {
    const b = computed(weakB);
    expect(valuesOf(b, ['abilities.str.score', 'speed.armorReduction', 'speed.walk'])).toEqual({
      'abilities.str.score': 12,
      'speed.armorReduction': 10,
      'speed.walk': 20,
    });
    expect(b.breakdown['speed.armorReduction']).toEqual(slowing);
    expect(b.breakdown['speed.walk']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2024:species/human',
        label: { en: 'Human' },
        value: 30,
        change: 30,
      },
      { kind: 'path', path: 'speed.armorReduction', value: 10, change: -10 },
      { kind: 'path', path: 'speed.walk.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'speed.all.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'speed.all.mul', value: 1, change: 0 },
    ]);
    expect(b.warnings).toEqual([]);
  });

  it('takes it from every kind of speed the character has, and from none it lacks', () => {
    const kin = {
      id: 'character:lineage/fleet-kin',
      type: 'lineage',
      ruleset: 'any',
      name: { en: 'Fleet kin' },
      source,
      speed: { walk: 35, swim: 20 },
    } satisfies EntityInput;
    const fleet = feat(
      'fleet',
      [],
      [{ id: 'kin', kind: 'entity', fixed: ['character:lineage/fleet-kin'] }],
    );
    const b = computed(goldenBWith([fleet, kin], {}, weakB));
    // 35 − 10, 20 − 10; no fly speed.
    expect(valuesOf(b, ['speed.walk', 'speed.swim', 'speed.fly'])).toEqual({
      'speed.walk': 25,
      'speed.swim': 10,
      'speed.fly': 0,
    });
    expect(b.breakdown['speed.fly']).toEqual([]);
  });

  it('gives none when the Strength score equals the requirement or is above it', () => {
    const met = computed(withStrength(goldenB, 11));
    expect(valuesOf(met, ['abilities.str.score', 'speed.armorReduction', 'speed.walk'])).toEqual({
      'abilities.str.score': 13,
      'speed.armorReduction': 0,
      'speed.walk': 30,
    });
    expect(met.breakdown['speed.armorReduction']).toEqual([]);
    // The goldens: A's 13, B's 17, B4's 19; D is B.
    for (const golden of [goldenA, goldenB, goldenB4, goldenD]) {
      expect(computed(golden).values['speed.armorReduction'], golden.name).toBe(0);
    }
  });

  it('reads the Strength score after its effects', () => {
    const belt = feat('belt', [{ id: 'str', target: 'abilities.str.score', op: 'max', value: 13 }]);
    const b = computed(goldenBWith([belt], {}, weakB));
    expect(valuesOf(b, ['abilities.str.score', 'speed.armorReduction', 'speed.walk'])).toEqual({
      'abilities.str.score': 13,
      'speed.armorReduction': 0,
      'speed.walk': 30,
    });
  });

  it('reads only the armor worn, and only its requirement', () => {
    const cases: Record<string, Row[]> = {
      'leather, no requirement': [row(1, leather.id)],
      'chain mail not equipped': [row(1, chainMail, false)],
      'chain mail after the leather worn': [row(1, leather.id), row(2, chainMail)],
    };
    for (const [name, inventory] of Object.entries(cases)) {
      const b = computed(goldenBWith([leather], { inventory }, weakB));
      expect(valuesOf(b, ['speed.armorReduction', 'speed.walk']), name).toEqual({
        'speed.armorReduction': 0,
        'speed.walk': 30,
      });
    }
  });

  it("lets an effect change it: the SRD 5.1 dwarf's sets it to 0", () => {
    const a = computed(withStrength(goldenA, 12));
    expect(valuesOf(a, ['abilities.str.score', 'speed.armorReduction', 'speed.walk'])).toEqual({
      'abilities.str.score': 12,
      'speed.armorReduction': 0,
      'speed.walk': 25,
    });
    expect(a.breakdown['speed.armorReduction']).toEqual([
      { ...slowing[0], source: 'srd-2014:item/chain-mail' },
      slowing[1],
      slowing[2],
      {
        kind: 'effect',
        part: 'srd-2014:species/dwarf#heavy-armor',
        source: 'srd-2014:species/dwarf',
        label: { en: 'Dwarf' },
        op: 'set',
        value: 0,
        change: -10,
      },
    ]);
    expect(a.warnings).toEqual([]);
  });
});

describe('ENG-47 the base AC calculation the person picks', () => {
  // Golden B: DEX +1, CON +2, chain mail 16, Defense +1 in armor. Worked out by hand: `guarded`
  // 10 + 1 + 2 = 13, only without armor; `plated` 13 + 1 = 14; `plain` 10 + 1 = 11; `stance`
  // 12 + 1 = 13, switched off until the person switches it on. The module's own: 16 in chain mail,
  // 10 + 1 = 11 without armor.
  const guarded = feat('guarded', [
    {
      id: 'unarmored',
      target: 'ac.formulas',
      op: 'append',
      value: '10 + @abilities.dex.mod + @abilities.con.mod',
      when: '!@armor.worn',
    },
  ]);
  const plated = feat('plated', [
    { id: 'plates', target: 'ac.formulas', op: 'append', value: '13 + @abilities.dex.mod' },
  ]);
  const plain = feat('plain', [
    { id: 'same', target: 'ac.formulas', op: 'append', value: '10 + @abilities.dex.mod' },
  ]);
  const stance = feat('stance', [
    {
      id: 'stance',
      target: 'ac.formulas',
      op: 'append',
      value: '12 + @abilities.dex.mod',
      toggle: { label: { en: 'Stance' }, default: false },
    },
  ]);
  const GUARDED = 'character:feat/guarded#unarmored';
  const PLATES = 'character:feat/plated#plates';
  const SAME = 'character:feat/plain#same';
  const STANCE = 'character:feat/stance#stance';
  const GONE = 'character:feat/gone#plates';

  const chosen = { kind: 'rule', rule: 'acCalcChosen', value: 0, change: 0 };
  const unarmored = [
    { kind: 'rule', rule: 'unarmoredAC', value: 10, change: 10 },
    { kind: 'path', path: 'abilities.dex.mod', value: 1, change: 1 },
  ];
  const inChainMail = [
    { kind: 'entity', source: chainMail, label: { en: 'Chain Mail' }, value: 16, change: 16 },
  ];

  /** The step of the candidate a made-up feat's effect `part` appends, worth `value`. */
  function appended(part: `character:feat/${string}#${string}`, value: number) {
    const [source = ''] = part.split('#');
    const label = { en: source.slice('character:feat/'.length) };
    return { kind: 'effect', part, source, label, op: 'append', value, change: value };
  }

  /** The warning of a pin that applies nowhere. */
  function notApplying(calc: string) {
    return { code: 'stepRule', path: 'ac.base', rule: 'acCalcNotApplying', data: { calc } };
  }

  /** Golden B with these feats, armor or none, and a pin or none. */
  function pinned(
    own: EntityInput[],
    armored: boolean,
    acCalc?: CharacterInput['systemData']['acCalc'],
  ): CharacterInput {
    return goldenBWith(own, {
      ...(!armored && { inventory: [] }),
      ...(acCalc !== undefined && { acCalc }),
    });
  }

  it('takes the pinned calculation over the highest, without armor', () => {
    const none = computed(pinned([guarded, plated], false));
    expect(valuesOf(none, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 14, 'ac.total': 14 });
    expect(none.breakdown['ac.base']).toEqual([appended(PLATES, 14)]);

    const own = computed(pinned([guarded, plated], false, 'equipment'));
    expect(valuesOf(own, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 11, 'ac.total': 11 });
    expect(own.breakdown['ac.base']).toEqual([chosen, ...unarmored]);

    const lower = computed(pinned([guarded, plated], false, GUARDED));
    expect(valuesOf(lower, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 13, 'ac.total': 13 });
    expect(lower.breakdown['ac.base']).toEqual([chosen, appended(GUARDED, 13)]);

    const highest = computed(pinned([guarded, plated], false, PLATES));
    expect(valuesOf(highest, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 14, 'ac.total': 14 });
    expect(highest.breakdown['ac.base']).toEqual([chosen, appended(PLATES, 14)]);

    for (const result of [none, own, lower, highest]) expect(result.warnings).toEqual([]);
  });

  it('takes the pinned calculation over the highest, in chain mail', () => {
    const none = computed(pinned([guarded, plated], true));
    expect(valuesOf(none, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 16, 'ac.total': 17 });
    expect(none.breakdown['ac.base']).toEqual(inChainMail);

    // Plated 14, + Defense 1.
    const lower = computed(pinned([guarded, plated], true, PLATES));
    expect(valuesOf(lower, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 14, 'ac.total': 15 });
    expect(lower.breakdown['ac.base']).toEqual([chosen, appended(PLATES, 14)]);

    const own = computed(pinned([guarded, plated], true, 'equipment'));
    expect(valuesOf(own, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 16, 'ac.total': 17 });
    expect(own.breakdown['ac.base']).toEqual([chosen, ...inChainMail]);

    for (const result of [none, lower, own]) expect(result.warnings).toEqual([]);
  });

  it('warns of a pin that does not apply now, and the highest counts', () => {
    // In chain mail, guarded's `when` is false.
    const off = computed(pinned([guarded, plated], true, GUARDED));
    expect(valuesOf(off, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 16, 'ac.total': 17 });
    expect(off.breakdown['ac.base']).toEqual(inChainMail);
    expect(codes(off)).toEqual([notApplying(GUARDED)]);

    // No entity has the part.
    const gone = computed(pinned([guarded, plated], true, GONE));
    expect(valuesOf(gone, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 16, 'ac.total': 17 });
    expect(codes(gone)).toEqual([notApplying(GONE)]);

    // Switched off: 10 + 1. Switched on: stance's 13.
    const switchedOff = computed(pinned([stance], false, STANCE));
    expect(switchedOff.values['ac.base']).toBe(11);
    expect(switchedOff.breakdown['ac.base']).toEqual(unarmored);
    expect(codes(switchedOff)).toEqual([notApplying(STANCE)]);
    const on = pinned([stance], false, STANCE);
    const switchedOn = computed({ ...on, state: { ...on.state, toggles: { [STANCE]: true } } });
    expect(switchedOn.values['ac.base']).toBe(13);
    expect(switchedOn.breakdown['ac.base']).toEqual([chosen, appended(STANCE, 13)]);
    expect(switchedOn.warnings).toEqual([]);
  });

  it("breaks a tie: the module's own without a pin, the pinned one with it", () => {
    const none = computed(pinned([plain], false));
    expect(none.values['ac.base']).toBe(11);
    expect(none.breakdown['ac.base']).toEqual(unarmored);
    const same = computed(pinned([plain], false, SAME));
    expect(same.values['ac.base']).toBe(11);
    expect(same.breakdown['ac.base']).toEqual([chosen, appended(SAME, 11)]);
    expect(same.warnings).toEqual([]);
  });

  it('gives way to an override', () => {
    const result = computed({
      ...pinned([guarded, plated], true, PLATES),
      overrides: [{ path: 'ac.base', value: 20 }],
    });
    // The override's 20, + Defense 1.
    expect(valuesOf(result, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 20, 'ac.total': 21 });
    expect(result.breakdown['ac.base']?.at(-1)).toMatchObject({ kind: 'override', value: 20 });
  });

  it('is pinned by no golden', () => {
    for (const golden of [goldenA, goldenB, goldenB4, goldenC2014, goldenD]) {
      expect(
        opened(openFifthEditionCharacter(golden)).systemData.acCalc,
        golden.name,
      ).toBeUndefined();
      const steps = computed(golden).breakdown['ac.base'] ?? [];
      expect(steps.filter((step) => step.kind === 'rule' && step.rule === 'acCalcChosen')).toEqual(
        [],
      );
    }
  });

  it('stays pure: frozen inputs with a pin give equal results', () => {
    const one = pinned([guarded, plated], false, GUARDED);
    const character = deepFreeze(opened(openFifthEditionCharacter(one)));
    const { index } = index2024;
    deepFreeze(index);
    const result = compute(character, index, fifthEditionModule);
    expect(result.values['ac.base']).toBe(13);
    expect(compute(character, index, fifthEditionModule)).toEqual(result);
  });
});

describe('ENG-19 the hit point multiplier', () => {
  it('is 1 for every character, a rule step; the maximum ends with it', () => {
    const a = computed(goldenA);
    expect(a.values['hp.max.mul']).toBe(1);
    expect(a.breakdown['hp.max.mul']).toEqual([
      { kind: 'rule', rule: 'hitPointsMultiplier', value: 1, change: 1 },
    ]);
    expect(a.breakdown['hp.max']?.at(-1)).toEqual({
      kind: 'path',
      path: 'hp.max.mul',
      value: 1,
      change: 0,
    });
  });

  it('multiplies the maximum as an effect says, rounding down', () => {
    // Golden B: 10 + CON +2 = 12, + 1 from the feat = 13; halved, 6.5, rounded down to 6.
    const halved = computed(
      goldenBWith([
        feat('frail', [
          { id: 'more', target: 'hp.max.bonus', op: 'add', value: 1 },
          { id: 'half', target: 'hp.max.mul', op: 'mul', value: 0.5 },
        ]),
      ]),
    );
    expect(valuesOf(halved, ['hp.max.bonus', 'hp.max.mul', 'hp.max'])).toEqual({
      'hp.max.bonus': 1,
      'hp.max.mul': 0.5,
      'hp.max': 6,
    });
    expect(halved.breakdown['hp.max']?.at(-1)).toEqual({
      kind: 'path',
      path: 'hp.max.mul',
      value: 0.5,
      change: -7,
    });
    expect(halved.warnings).toEqual([]);
  });

  it('gives way to an override', () => {
    // Golden B's 12, × 2.
    const doubled = computed({ ...goldenB, overrides: [{ path: 'hp.max.mul', value: 2 }] });
    expect(valuesOf(doubled, ['hp.max.mul', 'hp.max'])).toEqual({ 'hp.max.mul': 2, 'hp.max': 24 });
  });
});
