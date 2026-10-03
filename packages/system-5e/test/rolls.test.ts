import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  attackOutcome,
  CRITICAL_FACE,
  criticalDamage,
  d20Formula,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
  ROLL_TARGETS,
  rollModeOf,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenB4, srd2014, srd2024 } from './golden/index.ts';

// ENG-34: the roll modes of fifth edition's d20 tests, and what a critical hit does. The rules are
// ENG-34 §8's. The character's own entities (`character:`) are made up, no text of a book; each
// value below was worked out by hand from them, the goldens' data and the rules, never copied from
// a run. Golden A (2014): a Medium hill dwarf, STR 13, chain mail and a shield worn, a warhammer
// (versatile, not heavy). Golden B (2024): STR 17, DEX 13, chain mail worn, a greatsword (heavy).
// Both SRDs' chain mail has disadvantage on Stealth.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type Row = CharacterInput['systemData']['inventory'][number];
type EffectInput = NonNullable<EntityInput['effects']>[number];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);
const source = { pack: 'character' };

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

/** Path → value, for every path whose name ends in `mode` or `Mode`. */
function modesOf(result: Computed<FifthEditionEntity>) {
  return Object.fromEntries(
    Object.entries(result.values).filter(([path]) => /(\.mode|Mode)$/.test(path)),
  );
}

/** Path → value, for the paths named. */
function valuesOf(result: Computed<FifthEditionEntity>, paths: readonly string[]) {
  return Object.fromEntries(paths.map((path) => [path, result.values[path]]));
}

/** A path's steps, each as `kind name value change`. */
function stepsOf(result: Computed<FifthEditionEntity>, path: string): string[] {
  return (result.breakdown[path] ?? []).map((step) => {
    const name =
      step.kind === 'path'
        ? step.path
        : step.kind === 'rule'
          ? step.rule
          : step.kind === 'effect'
            ? `${step.part} ${step.op}`
            : 'source' in step
              ? step.source
              : '';
    return `${step.kind} ${name} ${step.value} ${step.change}`;
  });
}

/** Freezes an object and everything in it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const each of Object.values(value)) deepFreeze(each);
  }
  return value;
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

const CHARM = 'character:feat/charm';

/** An effect of the charm, named `id`. */
function charmed(id: string, target: string, op: 'advantage' | 'disadvantage'): EffectInput {
  return { id, target, op, value: true };
}

/** A golden that has taken the charm, a feat of its own with these effects. */
function withCharm(
  golden: CharacterInput,
  effects: EffectInput[],
  change: Partial<CharacterInput> = {},
) {
  const charm: EntityInput = {
    id: CHARM,
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Charm' },
    source,
    effects,
  };
  return computed({
    ...golden,
    ...change,
    localEntities: [...golden.localEntities, ...(change.localEntities ?? []), charm],
    systemData: {
      ...golden.systemData,
      ...change.systemData,
      feats: [...golden.systemData.feats, { id: CHARM }],
    },
  });
}

/** An inventory row of an item, equipped unless said. */
function row(n: number, itemId: NonNullable<Row['itemId']>, equipped = true): Row {
  return {
    uid: `d4000000-0000-4000-8000-00000000000${n}`,
    itemId,
    qty: 1,
    equipped,
    attuned: false,
  };
}

/** A made-up heavy weapon of `kind`, keyed by its slug. */
function heavy(slug: string, kind: 'melee' | 'ranged'): EntityInput {
  return {
    id: `character:item/${slug}`,
    type: 'item',
    key: slug,
    ruleset: 'any',
    name: { en: slug },
    source,
    category: 'weapon',
    weapon: {
      group: 'martial',
      kind,
      damage: { formula: '1d10', type: 'piercing' },
      properties: ['heavy'],
    },
  };
}

/** A golden with its own base scores changed. */
function withBase(golden: CharacterInput, base: Record<string, number>): CharacterInput {
  return { ...golden, abilities: { base: { ...golden.abilities.base, ...base } } };
}

const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILLS = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival',
];

/** Every mode of a golden with no effect on a roll target: 0, but `overrides`. */
function modesWith(overrides: Record<string, number>, weapon: string) {
  return {
    ...Object.fromEntries(STATS.map((stat) => [`checks.${stat}.mode`, 0])),
    ...Object.fromEntries(STATS.map((stat) => [`abilities.${stat}.saveMode`, 0])),
    ...Object.fromEntries(SKILLS.map((key) => [`skills.${key}.mode`, 0])),
    'init.mode': 0,
    'spell.attackMode': 0,
    'deathSave.mode': 0,
    [`attacks.${weapon}.mode`]: 0,
    ...overrides,
  };
}

describe('ENG-34 roll modes', () => {
  it("gives each golden's d20 tests a mode: Stealth's −1 from the chain mail worn, the rest 0", () => {
    const a = computed(goldenA);
    const b = computed(goldenB);
    expect(modesOf(a)).toEqual(modesWith({ 'skills.stealth.mode': -1 }, 'warhammer'));
    expect(modesOf(b)).toEqual(modesWith({ 'skills.stealth.mode': -1 }, 'greatsword'));
    expect(stepsOf(a, 'skills.stealth.mode')).toEqual(['entity srd-2014:item/chain-mail -1 -1']);
    expect(stepsOf(b, 'skills.stealth.mode')).toEqual(['entity srd-2024:item/chain-mail -1 -1']);
    expect(stepsOf(b, 'skills.athletics.mode')).toEqual([]);
    expect([a.warnings, b.warnings]).toEqual([[], []]);
  });

  it('golden B4: Athletics and initiative with advantage, from Remarkable Athlete', () => {
    const b4 = computed(goldenB4);
    expect(modesOf(b4)).toEqual(
      modesWith(
        { 'skills.stealth.mode': -1, 'skills.athletics.mode': 1, 'init.mode': 1 },
        'greatsword',
      ),
    );
    const athlete = 'srd-2024:feature/champion-remarkable-athlete';
    expect(stepsOf(b4, 'skills.athletics.mode')).toEqual([
      `effect ${athlete}#athletics advantage 1 1`,
    ]);
    expect(stepsOf(b4, 'init.mode')).toEqual([`effect ${athlete}#initiative advantage 1 1`]);
  });

  it('cancels any advantage with any disadvantage, however many of each', () => {
    const result = withCharm(goldenB, [
      charmed('a', 'roll.skill.athletics', 'advantage'),
      charmed('b', 'roll.check.str', 'disadvantage'),
      charmed('c', 'roll.save.all', 'advantage'),
      charmed('d', 'roll.save.str', 'advantage'),
      charmed('e', 'roll.save.str', 'disadvantage'),
      charmed('f', 'roll.skill.stealth', 'advantage'),
    ]);
    expect(
      valuesOf(result, [
        'skills.athletics.mode',
        'checks.str.mode',
        'abilities.str.saveMode',
        'abilities.dex.saveMode',
        'deathSave.mode',
        'skills.stealth.mode',
      ]),
    ).toEqual({
      'skills.athletics.mode': 0,
      'checks.str.mode': -1,
      'abilities.str.saveMode': 0,
      'abilities.dex.saveMode': 1,
      'deathSave.mode': 1,
      'skills.stealth.mode': 0,
    });
    const of = (id: string, op: string) => `effect ${CHARM}#${id} ${op}`;
    expect(stepsOf(result, 'skills.athletics.mode')).toEqual([
      `${of('a', 'advantage')} 1 1`,
      `${of('b', 'disadvantage')} -1 -1`,
    ]);
    // Two advantages, then a disadvantage: 1, 0, −1.
    expect(stepsOf(result, 'abilities.str.saveMode')).toEqual([
      `${of('c', 'advantage')} 1 1`,
      `${of('d', 'advantage')} 1 0`,
      `${of('e', 'disadvantage')} -1 -1`,
    ]);
    // The armor's rule first, then the effect.
    expect(stepsOf(result, 'skills.stealth.mode')).toEqual([
      'entity srd-2024:item/chain-mail -1 -1',
      `${of('f', 'advantage')} 1 1`,
    ]);
    expect(result.warnings).toEqual([]);
    // Every step of a mode is a source whose value is its sign: read again, they give the mode.
    for (const path of Object.keys(modesOf(result))) {
      const signs = (result.breakdown[path] ?? []).map((step) => step.value);
      expect([path, rollModeOf(signs)]).toEqual([path, result.values[path]]);
    }
  });

  it("reads an ability check's targets for its skills and for initiative", () => {
    const dex = withCharm(goldenB, [charmed('a', 'roll.check.dex', 'advantage')]);
    expect(
      valuesOf(dex, [
        'checks.dex.mode',
        'skills.acrobatics.mode',
        'skills.sleightOfHand.mode',
        'skills.stealth.mode',
        'init.mode',
        'skills.athletics.mode',
        'abilities.dex.saveMode',
      ]),
    ).toEqual({
      'checks.dex.mode': 1,
      'skills.acrobatics.mode': 1,
      'skills.sleightOfHand.mode': 1,
      'skills.stealth.mode': 0, // the chain mail's disadvantage cancels it
      'init.mode': 1,
      'skills.athletics.mode': 0,
      'abilities.dex.saveMode': 0,
    });

    // 2014 exhaustion's level 1, every ability check: each stat's, each skill's, initiative's.
    const all = withCharm(goldenB, [charmed('a', 'roll.check.all', 'disadvantage')]);
    expect(modesOf(all)).toEqual(
      modesWith(
        {
          ...Object.fromEntries(STATS.map((stat) => [`checks.${stat}.mode`, -1])),
          ...Object.fromEntries(SKILLS.map((key) => [`skills.${key}.mode`, -1])),
          'init.mode': -1,
        },
        'greatsword',
      ),
    );
  });

  it("follows a skill's stat when an effect sets another", () => {
    const strCheck = charmed('a', 'roll.check.str', 'advantage');
    const swapped: EffectInput = {
      id: 'b',
      target: 'skills.acrobatics.ability',
      op: 'set',
      value: 'str',
    };
    expect(withCharm(goldenB, [strCheck]).values['skills.acrobatics.mode']).toBe(0);
    expect(withCharm(goldenB, [strCheck, swapped]).values['skills.acrobatics.mode']).toBe(1);
  });

  it('gives a stat of a pack its check and save modes, read as any other', () => {
    const san: EntityInput = {
      id: 'character:ability/san',
      type: 'ability',
      key: 'san',
      ruleset: 'any',
      name: { en: 'Sanity' },
      abbr: { en: 'SAN' },
      order: 6,
      source,
    };
    const composure: EntityInput = {
      id: 'character:skill/composure',
      type: 'skill',
      key: 'composure',
      ruleset: 'any',
      name: { en: 'Composure' },
      ability: 'san',
      source,
    };
    const result = withCharm(
      goldenB,
      [charmed('a', 'roll.check.all', 'disadvantage'), charmed('b', 'roll.save.san', 'advantage')],
      {
        abilities: { base: { ...goldenB.abilities.base, san: 14 } },
        localEntities: [san, composure],
      },
    );
    expect(
      valuesOf(result, ['checks.san.mode', 'skills.composure.mode', 'abilities.san.saveMode']),
    ).toEqual({ 'checks.san.mode': -1, 'skills.composure.mode': -1, 'abilities.san.saveMode': 1 });
  });

  it("reads an attack's kind and every attack; a spell attack its own", () => {
    const result = withCharm(goldenB, [
      charmed('a', 'roll.attack.all', 'advantage'),
      charmed('b', 'roll.attack.weapon.melee', 'disadvantage'),
      charmed('c', 'roll.attack.weapon.ranged', 'disadvantage'),
      charmed('d', 'roll.deathSave', 'disadvantage'),
    ]);
    expect(
      valuesOf(result, ['attacks.greatsword.mode', 'spell.attackMode', 'deathSave.mode']),
    ).toEqual({ 'attacks.greatsword.mode': 0, 'spell.attackMode': 1, 'deathSave.mode': -1 });
    const spell = withCharm(goldenB, [charmed('a', 'roll.attack.spell', 'disadvantage')]);
    expect(valuesOf(spell, ['attacks.greatsword.mode', 'spell.attackMode'])).toEqual({
      'attacks.greatsword.mode': 0,
      'spell.attackMode': -1,
    });
  });

  it('uses a switched effect only while it is on', () => {
    const rage: EffectInput = {
      ...charmed('rage', 'roll.check.str', 'advantage'),
      toggle: { label: { en: 'Rage' }, default: false },
    };
    const off = withCharm(goldenB, [rage]);
    const on = withCharm(goldenB, [rage], {
      state: { ...goldenB.state, toggles: { [`${CHARM}#rage`]: true } },
    });
    const paths = ['checks.str.mode', 'skills.athletics.mode'];
    expect(valuesOf(off, paths)).toEqual({ 'checks.str.mode': 0, 'skills.athletics.mode': 0 });
    expect(valuesOf(on, paths)).toEqual({ 'checks.str.mode': 1, 'skills.athletics.mode': 1 });
  });

  it('adds 5 to a passive value with advantage, takes 5 with disadvantage, neither with both', () => {
    const passive = (effects: EffectInput[]) => {
      const result = withCharm(goldenB, effects);
      return [
        result.values['skills.perception.passive'],
        stepsOf(result, 'skills.perception.passive')[2],
      ];
    };
    const advantage = charmed('a', 'roll.skill.perception', 'advantage');
    const disadvantage = charmed('b', 'roll.check.wis', 'disadvantage');
    // Golden B's passive Perception 13 = 10 + 3.
    expect(passive([])).toEqual([13, 'path skills.perception.mode 0 0']);
    expect(passive([advantage])).toEqual([18, 'path skills.perception.mode 1 5']);
    expect(passive([disadvantage])).toEqual([8, 'path skills.perception.mode -1 -5']);
    expect(passive([advantage, disadvantage])).toEqual([13, 'path skills.perception.mode 0 0']);
  });

  it('lets an override win; the passive reads a mode above 1 as advantage', () => {
    const b4 = computed({
      ...goldenB4,
      overrides: [
        { path: 'skills.athletics.mode', value: -1 },
        { path: 'skills.perception.mode', value: 2 },
      ],
    });
    expect(valuesOf(b4, ['skills.athletics.mode', 'skills.perception.passive'])).toEqual({
      'skills.athletics.mode': -1,
      'skills.perception.passive': 18, // 13 + 5
    });
    expect(stepsOf(b4, 'skills.athletics.mode')).toEqual([
      'effect srd-2024:feature/champion-remarkable-athlete#athletics advantage 1 1',
      'override  -1 -2',
    ]);
    expect(d20Formula(b4.values['skills.perception.mode'] as number)).toBe('2d20kh1');
  });

  it('gives no Stealth disadvantage for an armor carried, nor for one that counts for nothing', () => {
    const quilted: EntityInput = {
      id: 'character:item/quilted',
      type: 'item',
      key: 'quilted',
      ruleset: 'any',
      name: { en: 'Quilted' },
      source,
      category: 'armor',
      armor: { group: 'light', baseAC: 11, dexCap: null },
    };
    const carried = computed({
      ...goldenB,
      systemData: { ...goldenB.systemData, inventory: [row(1, 'srd-2024:item/chain-mail', false)] },
    });
    expect(carried.values['skills.stealth.mode']).toBe(0);
    // The quilted armor is worn first; the chain mail after it counts for nothing (ENG-44).
    const second = computed({
      ...goldenB,
      localEntities: [quilted],
      systemData: {
        ...goldenB.systemData,
        inventory: [row(1, quilted.id), row(2, 'srd-2024:item/chain-mail')],
      },
    });
    expect(second.values['skills.stealth.mode']).toBe(0);
    expect(codes(second).map(({ code }) => code)).toEqual(['stepRule']);
  });

  describe('the Heavy property, by edition', () => {
    const arbalest = heavy('arbalest', 'ranged');
    const maul = heavy('maul', 'melee');
    const armed = (golden: CharacterInput, base: Record<string, number> = {}) =>
      computed({
        ...withBase(golden, base),
        localEntities: [arbalest, maul],
        systemData: {
          ...golden.systemData,
          inventory: [row(1, arbalest.id), row(2, maul.id)],
        },
      });

    it("2024: below 13 in the weapon kind's score, disadvantage; 13 is enough", () => {
      // Golden B: STR 17, DEX 13; base STR 15 + 2. Base STR 10 → 12, base DEX 12 → 12.
      const strong = armed(goldenB);
      expect(valuesOf(strong, ['attacks.arbalest.mode', 'attacks.maul.mode'])).toEqual({
        'attacks.arbalest.mode': 0,
        'attacks.maul.mode': 0,
      });
      const weak = armed(goldenB, { str: 10, dex: 12 });
      expect(valuesOf(weak, ['attacks.arbalest.mode', 'attacks.maul.mode'])).toEqual({
        'attacks.arbalest.mode': -1,
        'attacks.maul.mode': -1,
      });
      expect(stepsOf(weak, 'attacks.maul.mode')).toEqual(['rule heavyWeapon -1 -1']);
      expect(stepsOf(weak, 'attacks.arbalest.mode')).toEqual(['rule heavyWeapon -1 -1']);
      expect(valuesOf(weak, ['abilities.str.score', 'abilities.dex.score'])).toEqual({
        'abilities.str.score': 12,
        'abilities.dex.score': 12,
      });
      // Base STR 11 → 13: the maul is no longer too heavy. A score met gives no step.
      expect(armed(goldenB, { str: 11 }).values['attacks.maul.mode']).toBe(0);
      expect(stepsOf(strong, 'attacks.arbalest.mode')).toEqual([]);
    });

    it('2014: a Small creature, whatever its scores; a size not chosen gives none', () => {
      // Golden A is Medium: STR 8 makes no difference in 2014.
      expect(armed(goldenA, { str: 8 }).values['attacks.maul.mode']).toBe(0);
      const species = (size: string[]): EntityInput => ({
        id: 'character:species/wee',
        type: 'species',
        ruleset: 'any',
        name: { en: 'Wee' },
        source,
        size,
        speed: { walk: 25 },
      });
      const small = (sizes: string[], chosen?: string) =>
        computed({
          ...goldenA,
          localEntities: [arbalest, maul, species(sizes)],
          systemData: {
            ...goldenA.systemData,
            species: { id: 'character:species/wee', ...(chosen && { size: chosen }) },
            inventory: [row(1, arbalest.id), row(2, maul.id)],
          },
        });
      const wee = small(['small']);
      expect(valuesOf(wee, ['attacks.arbalest.mode', 'attacks.maul.mode'])).toEqual({
        'attacks.arbalest.mode': -1,
        'attacks.maul.mode': -1,
      });
      expect(stepsOf(wee, 'attacks.maul.mode')).toEqual(['rule heavyWeapon -1 -1']);
      expect(small(['small', 'medium']).values['attacks.maul.mode']).toBe(0);
      expect(small(['small', 'medium'], 'small').values['attacks.maul.mode']).toBe(-1);
      expect(small(['small', 'medium'], 'medium').values['attacks.maul.mode']).toBe(0);
    });
  });

  it('warns an op that gives no mode once; a number op on a roll target is not computed', () => {
    const result = withCharm(goldenB, [
      { id: 'a', target: 'roll.check.all', op: 'note', value: { en: 'Lit' } },
      { id: 'b', target: 'roll.init', op: 'add', value: 1 },
      { id: 'c', target: 'skills.athletics.total', op: 'advantage', value: true },
    ]);
    expect(codes(result)).toEqual([
      { code: 'notARollMode', part: `${CHARM}#a`, op: 'note', target: 'roll.check.all' },
      { code: 'notANumber', part: `${CHARM}#c`, op: 'advantage', target: 'skills.athletics.total' },
      { code: 'noTarget', part: `${CHARM}#b`, target: 'roll.init' },
    ]);
    expect(result.values['skills.athletics.total']).toBe(5);
  });

  it('stays pure: frozen inputs give equal results', () => {
    const character = deepFreeze(opened(openFifthEditionCharacter(goldenB4)));
    const { index } = index2024;
    deepFreeze(index);
    expect(compute(character, index, fifthEditionModule)).toEqual(
      compute(character, index, fifthEditionModule),
    );
  });
});

describe('ENG-34 rolls and critical hits', () => {
  it('gives the mode of sources by their signs: both cancel', () => {
    expect(
      [[], [1], [-1], [1, 1], [1, -1], [1, 1, -1], [-1, -1, 1], [0], [0, -1]].map((signs) =>
        rollModeOf(signs),
      ),
    ).toEqual([0, 1, -1, 1, 0, 0, 0, 0, -1]);
  });

  it('rolls 1d20, or two keeping the higher or the lower', () => {
    expect([d20Formula(0), d20Formula(1), d20Formula(-1), d20Formula(3)]).toEqual([
      '1d20',
      '2d20kh1',
      '2d20kl1',
      '2d20kh1',
    ]);
  });

  it('gives a natural 1 a miss, a natural 20 or a face in the range a critical hit', () => {
    expect(CRITICAL_FACE).toBe(20);
    expect(
      [
        [20, 20],
        [19, 20],
        [19, 19],
        [20, 25],
        [1, 1],
        [1, 20],
        [2, 1],
        [0, 1],
        [21, 19],
        [10.5, 10],
      ].map(([natural, range]) => attackOutcome(natural as number, range)),
    ).toEqual([
      'criticalHit',
      'byTotal',
      'criticalHit',
      'criticalHit',
      'automaticMiss',
      'automaticMiss',
      'criticalHit',
      'byTotal',
      'byTotal',
      'byTotal',
    ]);
    // A spell attack's range is 20 (Improved Critical names weapons).
    expect([attackOutcome(19), attackOutcome(20)]).toEqual(['byTotal', 'criticalHit']);
  });

  it("rolls a critical hit's damage dice twice, its modifiers once", () => {
    const written = (formula: string) => {
      const result = criticalDamage(formula);
      return result.ok ? result.formula.text : `error ${result.error.code}`;
    };
    expect(
      ['1d4', '2d6+4', '1d8 + 2к6 + @prof', '4d6kh3', '5', '1d', '600d6'].map(written),
    ).toEqual([
      '2d4',
      '4d6+4',
      '2d8 + 4к6 + @prof',
      '(4d6kh3 + 4d6kh3)',
      '5',
      'error unexpected',
      'error diceCount',
    ]);
  });

  it('names the targets each d20 test reads', () => {
    expect(ROLL_TARGETS.skill('stealth', 'dex')).toEqual([
      'roll.skill.stealth',
      'roll.check.dex',
      'roll.check.all',
    ]);
    expect(ROLL_TARGETS.init()).toEqual(['roll.init', 'roll.check.dex', 'roll.check.all']);
    expect(ROLL_TARGETS.weaponAttack('ranged')).toEqual([
      'roll.attack.weapon.ranged',
      'roll.attack.all',
    ]);
    expect(ROLL_TARGETS.deathSave()).toEqual(['roll.deathSave', 'roll.save.all']);
  });
});
