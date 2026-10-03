import {
  averageOf,
  type Computed,
  compute,
  type FormulaValue,
  loadContentIndex,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  CANTRIP_LEVELS,
  cantripUpgrades,
  criticalDamage,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionEntitySchema,
  fifthEditionModule,
  grantCastingStat,
  openFifthEditionCharacter,
  openFifthEditionPack,
  type SpellDef,
  spellDice,
} from '../src/index.ts';
import { cantrip, spell } from './entities.ts';
import { opened } from './golden/checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenC2024,
  goldenE,
  hbLocal,
  srd2014,
  srd2024,
} from './golden/index.ts';

// ENG-50: a spell's dice for the character's level. The rules are ENG-50 §8's. The SRD spells'
// numbers are 5e-database's (`e6edf9a`), with no text; the character's own entities
// (`character:`) are made up. Each value below was worked out by hand, never copied from a run.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type SpellInput = Pick<SpellDef, 'id' | 'level' | 'damage' | 'healing' | 'scaling'>;

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(openFifthEditionPack(srd2024)),
  opened(openFifthEditionPack(hbLocal)),
]);

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

/** Golden B as a fighter of `level`: the first level's hit points the maximum, then the average. */
function fighterAt(level: number): CharacterInput {
  const hp = ['max' as const, ...Array.from({ length: level - 1 }, () => 'avg' as const)];
  return {
    ...goldenB,
    systemData: { ...goldenB.systemData, classes: [{ id: 'srd-2024:class/fighter', level, hp }] },
  };
}

/** Fire Bolt (SRD 5.1 `fire-bolt`): 1d10 fire, 1d10 more at character levels 5, 11 and 17. */
const fireBolt: SpellInput = {
  id: 'srd-2014:spell/fire-bolt',
  level: 0,
  damage: [{ formula: '1d10', type: 'fire' }],
  scaling: { kind: 'cantrip', formula: '1d10' },
};

/** Fireball (SRD 5.1 `fireball`): level 3, 8d6 fire, 1d6 more per slot level above 3. */
const fireball: SpellInput = {
  id: 'srd-2014:spell/fireball',
  level: 3,
  damage: [{ formula: '8d6', type: 'fire' }],
  scaling: { kind: 'slot', formula: '1d6' },
};

/**
 * A spell damage bonus of 0, as every computed character has (ENG-55): the values written by hand
 * below hold it, so a test checks only the warnings it names.
 */
const NO_BONUS = { 'damage.spell.bonus': 0 } as const;

/** The formula of each damage. */
function formulas(dice: { damage: readonly { formula: string }[] }): string[] {
  return dice.damage.map(({ formula }) => formula);
}

/** The warnings without their log message. */
function codes(dice: { warnings: readonly { message: string }[] }) {
  return dice.warnings.map(({ message: _, ...warning }) => warning);
}

describe('ENG-50 cantrip upgrades', () => {
  it('counts the levels 5, 11 and 17 reached: 0 to level 4, then one more at each', () => {
    expect(CANTRIP_LEVELS).toEqual([5, 11, 17]);
    const byLevel = Array.from({ length: 20 }, (_, at) => cantripUpgrades(at + 1));
    expect(byLevel).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3]);
  });

  it("reads the character's total level, not a class's, in both editions", () => {
    // Golden A: level 1. Golden B4: level 4. Golden C: wizard 3 + paladin 3 = level 6.
    const a = computed(goldenA);
    expect(a.values['cantrip.upgrades']).toBe(0);
    expect(a.breakdown['cantrip.upgrades']).toEqual([
      { kind: 'path', path: 'level', value: 1, change: 0 },
    ]);
    expect(computed(goldenB4).values['cantrip.upgrades']).toBe(0);
    for (const golden of [goldenC2014, goldenC2024]) {
      const c = computed(golden);
      expect(c.values['cantrip.upgrades']).toBe(1);
      expect(c.breakdown['cantrip.upgrades']).toEqual([
        { kind: 'path', path: 'level', value: 6, change: 1 },
      ]);
    }
  });

  it('grows at levels 5, 11 and 17 as the character levels up', () => {
    const levels = [4, 5, 10, 11, 16, 17, 20];
    const upgrades = levels.map((level) => computed(fighterAt(level)).values['cantrip.upgrades']);
    expect(upgrades).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it('takes effects, and an override wins', () => {
    const sharper: EntityInput = {
      id: 'character:feat/sharper-sparks',
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Sharper Sparks' },
      source: { pack: 'character' },
      effects: [{ id: 'step', target: 'cantrip.upgrades', op: 'add', value: 1 }],
    };
    const withFeat = computed({
      ...goldenA,
      localEntities: [sharper],
      systemData: { ...goldenA.systemData, feats: [{ id: 'character:feat/sharper-sparks' }] },
    });
    // Level 1 gives 0, the feat 1 more.
    expect(withFeat.values['cantrip.upgrades']).toBe(1);
    expect(withFeat.warnings).toEqual([]);
    const overridden = computed({
      ...goldenA,
      overrides: [{ path: 'cantrip.upgrades', value: 3 }],
    });
    expect(overridden.values['cantrip.upgrades']).toBe(3);
    expect(overridden.breakdown['cantrip.upgrades']?.at(-1)).toMatchObject({ kind: 'override' });
    expect(formulas(spellDice(fireBolt, overridden.values))).toEqual(['4d10']);
  });
});

describe("ENG-50 a spell's dice", () => {
  it("gives a cantrip's dice at each upgrade: SRD 5.1 Fire Bolt's 1d10, 2d10, 3d10, 4d10", () => {
    const at = (upgrades: number) =>
      spellDice(fireBolt, { ...NO_BONUS, 'cantrip.upgrades': upgrades });
    expect([0, 1, 2, 3].map((upgrades) => formulas(at(upgrades)))).toEqual([
      ['1d10'],
      ['2d10'],
      ['3d10'],
      ['4d10'],
    ]);
    expect(at(2)).toEqual({
      times: 2,
      damage: [{ formula: '3d10', type: 'fire' }],
      warnings: [],
    });
  });

  it('gives a cantrip the dice of the computed character: golden C, level 6, 2d10', () => {
    expect(formulas(spellDice(fireBolt, computed(goldenC2014).values))).toEqual(['2d10']);
    expect(formulas(spellDice(fireBolt, computed(goldenA).values))).toEqual(['1d10']);
  });

  it("gives a spell's dice at each slot: SRD 5.1 Fireball's 8d6 at 3 to 14d6 at 9", () => {
    const bySlot = [3, 4, 5, 6, 7, 8, 9].map((slot) => formulas(spellDice(fireball, {}, { slot })));
    expect(bySlot.flat()).toEqual(['8d6', '9d6', '10d6', '11d6', '12d6', '13d6', '14d6']);
    // Without a slot, or with one below its level, its own dice; `cantrip.upgrades` is not read.
    expect(spellDice(fireball, { ...NO_BONUS, 'cantrip.upgrades': 3 })).toEqual({
      times: 0,
      damage: [{ formula: '8d6', type: 'fire' }],
      warnings: [],
    });
    expect(spellDice(fireball, {}, { slot: 2 }).times).toBe(0);
  });

  it('joins the scaling to the first damage only, the rest of its formula kept', () => {
    const flare: SpellInput = {
      id: 'character:spell/flare',
      level: 0,
      damage: [
        { formula: '1d6 + @abilities.wis.mod', type: 'glare' },
        { formula: '1d6', type: 'cold' },
      ],
      scaling: { kind: 'cantrip', formula: '1d6' },
    };
    expect(spellDice(flare, { 'cantrip.upgrades': 2 }).damage).toEqual([
      { formula: '3d6 + @abilities.wis.mod', type: 'glare' },
      { formula: '1d6', type: 'cold' },
    ]);
  });

  it("reads the module's own spell shape: the made-up cantrip and spell", () => {
    const own = (input: unknown) => {
      const entity = fifthEditionEntitySchema.parse(input);
      if (entity.type !== 'spell') throw new Error('not a spell');
      return entity;
    };
    // The cantrip: 1d8, 1d8 more each upgrade. The spell: level 2, 2d6, 1d6 more per slot above.
    expect(formulas(spellDice(own(cantrip), { 'cantrip.upgrades': 1 }))).toEqual(['2d8']);
    expect(formulas(spellDice(own(spell), {}, { slot: 4 }))).toEqual(['4d6']);
  });

  it('counts a number of times that is not whole as the whole number below it, 0 at least', () => {
    expect(spellDice(fireBolt, { 'cantrip.upgrades': 1.5 }).times).toBe(1);
    expect(formulas(spellDice(fireBolt, { 'cantrip.upgrades': 1.5 }))).toEqual(['2d10']);
    expect(spellDice(fireBolt, { 'cantrip.upgrades': -1 }).times).toBe(0);
    expect(formulas(spellDice(fireball, {}, { slot: 4.5 }))).toEqual(['9d6']);
  });

  it('gives a spell with no scaling its own damage, and one with no damage nothing', () => {
    const plain: SpellInput = {
      id: 'character:spell/plain',
      level: 1,
      damage: [{ formula: '2d4', type: 'glare' }],
    };
    expect(spellDice(plain, NO_BONUS, { slot: 5 })).toEqual({
      times: 0,
      damage: [{ formula: '2d4', type: 'glare' }],
      warnings: [],
    });
    expect(spellDice({ id: 'character:spell/quiet', level: 1 }, {})).toEqual({
      times: 0,
      damage: [],
      warnings: [],
    });
  });

  it('warns, never throws: no upgrades value, a scaling with no damage, a formula that fails', () => {
    const missing = spellDice(fireBolt, NO_BONUS);
    expect(formulas(missing)).toEqual(['1d10']);
    expect(codes(missing)).toEqual([{ code: 'missingPath', path: 'cantrip.upgrades' }]);
    expect(codes(spellDice(fireBolt, { ...NO_BONUS, 'cantrip.upgrades': 'many' }))).toEqual([
      { code: 'missingPath', path: 'cantrip.upgrades' },
    ]);

    const extra: SpellInput = {
      id: 'character:spell/extra',
      level: 0,
      scaling: { kind: 'cantrip', formula: '1d6' },
    };
    expect(spellDice(extra, { 'cantrip.upgrades': 1 })).toEqual({
      times: 1,
      damage: [],
      warnings: [
        expect.objectContaining({ code: 'scalingWithoutRoll', spell: 'character:spell/extra' }),
      ],
    });

    const broken: SpellInput = { ...fireBolt, scaling: { kind: 'cantrip', formula: '1d' } };
    const result = spellDice(broken, { ...NO_BONUS, 'cantrip.upgrades': 1 });
    expect(formulas(result)).toEqual(['1d10']);
    expect(codes(result)).toEqual([
      {
        code: 'scalingFormula',
        spell: 'srd-2014:spell/fire-bolt',
        error: expect.objectContaining({ code: 'unexpected', found: 'd', at: 1 }),
      },
    ]);
    // A count past 999 dice in a term: 1 + 999 × 1.
    expect(codes(spellDice(fireBolt, { ...NO_BONUS, 'cantrip.upgrades': 999 }))).toEqual([
      {
        code: 'scalingFormula',
        spell: 'srd-2014:spell/fire-bolt',
        error: expect.objectContaining({ code: 'diceCount', found: 1000 }),
      },
    ]);
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const damage = [{ formula: '1d10', type: 'fire' }];
    const scaling = { kind: 'cantrip' as const, formula: '1d10' };
    const frozenSpell: SpellInput = { ...fireBolt, damage, scaling };
    for (const part of [frozenSpell, damage, scaling, ...damage]) Object.freeze(part);
    const values = Object.freeze({ 'cantrip.upgrades': 2 });
    const first = spellDice(frozenSpell, values);
    expect(spellDice(frozenSpell, values)).toEqual(first);
    expect(first).toEqual(spellDice(fireBolt, { 'cantrip.upgrades': 2 }));
    expect(frozenSpell.damage).toEqual([{ formula: '1d10', type: 'fire' }]);
  });
});

// ENG-53: a spell's healing, and `@mod` as the casting stat's modifier. The rules and numbers are
// ENG-53 §8's: SRD 5.1's from 5e-database (`e6edf9a`), SRD 5.2.1's from dnd5e (`7bfb3f1`), with no
// text. Golden A: WIS 15 + 1 = 16 → +3, CHA 12 → +1. Golden C 2024: CHA 14 → +2. Golden E: SAN 14
// → +2. Each average below was worked out by hand, never copied from a run.

/** An entity of a loaded pack, found by id; the test fails when it is not there. */
function entityIn(loaded: typeof index2014, id: string): FifthEditionEntity {
  const found = loaded.index.get(id);
  if (!found.ok) throw new Error(found.message);
  return found.entity;
}

/** The stat a class of a loaded pack casts with: its `spellcasting.ability`. */
function castingStatOf(loaded: typeof index2014, id: string): string | undefined {
  const found = entityIn(loaded, id);
  return found.type === 'class' ? found.spellcasting?.ability : undefined;
}

/** A roll formula's average on a computed character, with what it read and the warnings' codes. */
function averageOn(result: Computed<FifthEditionEntity>, formula: string | undefined) {
  const { value, reads, warnings } = averageOf(formula ?? '', (path) => result.values[path]);
  return { value, reads, warnings: warnings.map(({ code }) => code) };
}

/** SRD 5.2.1 Cure Wounds: 2d8 + the modifier, 2d8 more per slot level above 1 (dnd5e). */
const cureWounds2024: SpellInput = {
  id: 'srd-2024:spell/cure-wounds',
  level: 1,
  healing: { formula: '2d8 + @mod', kind: 'hp' },
  scaling: { kind: 'slot', formula: '2d8' },
};

describe("ENG-53 a spell's healing", () => {
  const a = computed(goldenA);
  const cure = entityIn(index2014, 'srd-2014:spell/cure-wounds');
  if (cure.type !== 'spell') throw new Error('Cure Wounds is not a spell');

  it("gives SRD 5.1 Cure Wounds cast as golden A's cleric: 1d8 + WIS, 1d8 more per slot", () => {
    const stat = castingStatOf(index2014, 'srd-2014:class/cleric');
    expect(stat).toBe('wis');
    expect(spellDice(cure, a.values, { stat })).toEqual({
      times: 0,
      damage: [],
      healing: { formula: '1d8 + @abilities.wis.mod', kind: 'hp' },
      warnings: [],
    });
    const bySlot = [1, 2, 9].map((slot) => spellDice(cure, a.values, { slot, stat }).healing);
    expect(bySlot.map((healing) => healing?.formula)).toEqual([
      '1d8 + @abilities.wis.mod',
      '2d8 + @abilities.wis.mod',
      '9d8 + @abilities.wis.mod',
    ]);
    // 4.5 + 3, 9 + 3, 40.5 + 3.
    expect(bySlot.map((healing) => averageOn(a, healing?.formula))).toEqual([
      { value: 7.5, reads: ['abilities.wis.mod'], warnings: [] },
      { value: 12, reads: ['abilities.wis.mod'], warnings: [] },
      { value: 43.5, reads: ['abilities.wis.mod'], warnings: [] },
    ]);
  });

  it('casts it with the stat a grant names: CHA on golden A, 4.5 + 1 = 5.5', () => {
    const stat = grantCastingStat({ id: 'lore', kind: 'spell', fixed: [cure.id], ability: 'cha' });
    const healing = spellDice(cure, a.values, { slot: 1, stat }).healing;
    expect(healing).toEqual({ formula: '1d8 + @abilities.cha.mod', kind: 'hp' });
    expect(averageOn(a, healing?.formula).value).toBe(5.5);
  });

  it('keeps @mod with no stat, and warns; a roll of it reads 0 for the modifier', () => {
    const result = spellDice(cure, a.values, { slot: 1 });
    expect(result.healing).toEqual({ formula: '1d8 + @mod', kind: 'hp' });
    expect(codes(result)).toEqual([{ code: 'noCastingStat', spell: 'srd-2014:spell/cure-wounds' }]);
    expect(averageOn(a, result.healing?.formula)).toEqual({
      value: 4.5,
      reads: ['mod'],
      warnings: ['missingPath'],
    });
  });

  it("gives SRD 5.2.1 Cure Wounds cast as golden C 2024's paladin: 2d8 + CHA, 2d8 per slot", () => {
    const c = computed(goldenC2024);
    const stat = castingStatOf(index2024, 'srd-2024:class/paladin');
    expect(stat).toBe('cha');
    const bySlot = [1, 2, 3].map((slot) => spellDice(cureWounds2024, c.values, { slot, stat }));
    expect(bySlot.map(({ times, healing }) => [times, healing?.formula])).toEqual([
      [0, '2d8 + @abilities.cha.mod'],
      [1, '4d8 + @abilities.cha.mod'],
      [2, '6d8 + @abilities.cha.mod'],
    ]);
    // 9 + 2, 18 + 2, 27 + 2.
    expect(bySlot.map(({ healing }) => averageOn(c, healing?.formula).value)).toEqual([11, 20, 29]);
  });

  it('gives temporary hit points and healing with no dice: SRD 5.1 False Life and Heal', () => {
    const falseLife: SpellInput = {
      id: 'srd-2014:spell/false-life',
      level: 1,
      healing: { formula: '1d4 + 4', kind: 'tempHp' },
      scaling: { kind: 'slot', formula: '5' },
    };
    const lives = [1, 3].map((slot) => spellDice(falseLife, {}, { slot }).healing);
    expect(lives).toEqual([
      { formula: '1d4 + 4', kind: 'tempHp' },
      { formula: '1d4 + 4 + (5) + (5)', kind: 'tempHp' },
    ]);
    // 2.5 + 4; 2.5 + 4 + 10, as 5e-database's "1d4 + 14" at slot 3.
    expect(lives.map((healing) => averageOn(a, healing?.formula).value)).toEqual([6.5, 16.5]);

    const heal: SpellInput = {
      id: 'srd-2014:spell/heal',
      level: 6,
      healing: { formula: '70', kind: 'hp' },
      scaling: { kind: 'slot', formula: '10' },
    };
    const heals = [6, 9].map((slot) => spellDice(heal, {}, { slot }).healing?.formula);
    expect(heals).toEqual(['70', '70 + (10) + (10) + (10)']);
    expect(heals.map((formula) => averageOn(a, formula).value)).toEqual([70, 100]);
  });

  it('joins the scaling to the first damage and the healing: SRD 5.2.1 Conjure Celestial', () => {
    const conjure: SpellInput = {
      id: 'srd-2024:spell/conjure-celestial',
      level: 7,
      damage: [{ formula: '6d12', type: 'radiant' }],
      healing: { formula: '4d12 + @mod', kind: 'hp' },
      scaling: { kind: 'slot', formula: '1d12' },
    };
    expect(spellDice(conjure, NO_BONUS, { slot: 9, stat: 'cha' })).toEqual({
      times: 2,
      damage: [{ formula: '8d12', type: 'radiant' }],
      healing: { formula: '6d12 + @abilities.cha.mod', kind: 'hp' },
      warnings: [],
    });
  });

  it('writes the stat into a damage too: SRD 5.1 Spiritual Weapon on golden A, 4.5 + 3', () => {
    const weapon: SpellInput = {
      id: 'srd-2014:spell/spiritual-weapon',
      level: 2,
      damage: [{ formula: '1d8 + @mod', type: 'force' }],
    };
    const result = spellDice(weapon, a.values, { slot: 2, stat: 'wis' });
    expect(result).toEqual({
      times: 0,
      damage: [{ formula: '1d8 + @abilities.wis.mod', type: 'force' }],
      warnings: [],
    });
    expect(averageOn(a, result.damage[0]?.formula).value).toBe(7.5);
    expect(codes(spellDice(weapon, a.values))).toEqual([
      { code: 'noCastingStat', spell: 'srd-2014:spell/spiritual-weapon' },
    ]);
  });

  it("reads the module's own spell shape: Lantern Ward's temporary hit points with SAN", () => {
    const own = fifthEditionEntitySchema.parse(spell);
    if (own.type !== 'spell') throw new Error('not a spell');
    const e = computed(goldenE);
    // Level 2: 2d6, and 1d6 + the modifier; one scaling, 1d6 more to each per slot level above.
    const result = spellDice(own, e.values, { slot: 4, stat: 'san' });
    expect(result).toEqual({
      times: 2,
      damage: [{ formula: '4d6', type: 'glare' }],
      healing: { formula: '3d6 + @abilities.san.mod', kind: 'tempHp' },
      warnings: [],
    });
    // 10.5 + 2.
    expect(averageOn(e, result.healing?.formula)).toEqual({
      value: 12.5,
      reads: ['abilities.san.mod'],
      warnings: [],
    });
  });

  it('warns, never throws: a stat that is no key, a formula past the limits, a scaling that fails', () => {
    const bad = spellDice(cure, a.values, { stat: 'Wis' });
    expect(bad.healing).toEqual({ formula: '1d8 + @mod', kind: 'hp' });
    expect(codes(bad)).toEqual([
      {
        code: 'castingStatFormula',
        spell: 'srd-2014:spell/cure-wounds',
        stat: 'Wis',
        error: expect.objectContaining({ code: 'badPath', path: 'abilities.Wis.mod' }),
      },
    ]);

    // 704 characters, 101 × `@mod`, each 14 longer as `@abilities.wis.mod`: 704 + 1414 = 2118.
    const long: SpellInput = {
      id: 'character:spell/long',
      level: 1,
      healing: { formula: `@mod${' + @mod'.repeat(100)}`, kind: 'hp' },
    };
    const tooLong = spellDice(long, {}, { stat: 'wis' });
    expect(tooLong.healing?.formula).toBe(long.healing?.formula);
    expect(codes(tooLong)).toEqual([
      {
        code: 'castingStatFormula',
        spell: 'character:spell/long',
        stat: 'wis',
        error: expect.objectContaining({ code: 'tooLong', length: 2118 }),
      },
    ]);

    // The healing's join fails, the damage's does not: the healing keeps its own formula.
    const odd: SpellInput = {
      id: 'character:spell/odd',
      level: 1,
      damage: [{ formula: '1d6', type: 'glare' }],
      healing: { formula: '1d', kind: 'hp' },
      scaling: { kind: 'slot', formula: '1d6' },
    };
    const joined = spellDice(odd, NO_BONUS, { slot: 2 });
    expect(joined.damage).toEqual([{ formula: '2d6', type: 'glare' }]);
    expect(joined.healing).toEqual({ formula: '1d', kind: 'hp' });
    expect(codes(joined)).toEqual([
      {
        code: 'scalingFormula',
        spell: 'character:spell/odd',
        error: expect.objectContaining({ code: 'unexpected' }),
      },
    ]);
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const healing = { formula: '2d8 + @mod', kind: 'hp' as const };
    const scaling = { kind: 'slot' as const, formula: '2d8' };
    const frozenSpell: SpellInput = { ...cureWounds2024, healing, scaling };
    for (const part of [frozenSpell, healing, scaling]) Object.freeze(part);
    const values = Object.freeze({ 'abilities.cha.mod': 2 });
    const cast = Object.freeze({ slot: 2, stat: 'cha' });
    const first = spellDice(frozenSpell, values, cast);
    expect(spellDice(frozenSpell, values, cast)).toEqual(first);
    expect(first.healing).toEqual({ formula: '4d8 + @abilities.cha.mod', kind: 'hp' });
    expect(frozenSpell.healing).toEqual({ formula: '2d8 + @mod', kind: 'hp' });
  });
});

// ENG-55: a spell's damage adds `damage.spell.bonus`. The rules are ENG-55 §8's. Golden A: level 1,
// WIS 16 → +3. Golden C 2014: level 6. SRD 5.1 Flame Strike's two damages are dnd5e's (`7bfb3f1`);
// the feat is made up. Each average below was worked out by hand, never copied from a run.

/** A made-up feat whose effect adds 1 to every spell's damage. */
const hotter: EntityInput = {
  id: 'character:feat/hotter-spells',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Hotter Spells' },
  source: { pack: 'character' },
  effects: [{ id: 'more', target: 'damage.spell.bonus', op: 'add', value: 1 }],
};

/** A golden with the feat, and these overrides. */
function withHotter(
  golden: CharacterInput,
  overrides: CharacterInput['overrides'] = [],
): CharacterInput {
  return {
    ...golden,
    localEntities: [hotter],
    systemData: { ...golden.systemData, feats: [{ id: hotter.id }] },
    overrides,
  };
}

/** A roll formula's average on values written by hand. */
function averageWith(values: Readonly<Record<string, FormulaValue>>, formula: string | undefined) {
  return averageOf(formula ?? '', (path) => values[path]).value;
}

describe("ENG-55 a spell's damage bonus", () => {
  it('gives every character damage.spell.bonus 0, which an effect changes', () => {
    for (const golden of [goldenA, goldenB, goldenC2014, goldenC2024, goldenE]) {
      const result = computed(golden);
      expect(result.values['damage.spell.bonus']).toBe(0);
      expect(result.breakdown['damage.spell.bonus']).toEqual([]);
    }
    const hot = computed(withHotter(goldenA));
    expect(hot.values['damage.spell.bonus']).toBe(1);
    expect(hot.breakdown['damage.spell.bonus']).toEqual([
      expect.objectContaining({
        kind: 'effect',
        part: 'character:feat/hotter-spells#more',
        op: 'add',
        value: 1,
        change: 1,
      }),
    ]);
    expect(hot.warnings).toEqual([]);
  });

  it("adds it to SRD 5.1 Fire Bolt's damage: nothing at 0, the path written when it is not", () => {
    const a = computed(goldenA);
    expect(spellDice(fireBolt, a.values)).toEqual({
      times: 0,
      damage: [{ formula: '1d10', type: 'fire' }],
      warnings: [],
    });
    const hot = computed(withHotter(goldenA));
    const bolt = spellDice(fireBolt, hot.values);
    expect(bolt).toEqual({
      times: 0,
      damage: [{ formula: '1d10 + @damage.spell.bonus', type: 'fire' }],
      warnings: [],
    });
    // 5.5 + 1, read from the computed path.
    expect(averageOn(hot, bolt.damage[0]?.formula)).toEqual({
      value: 6.5,
      reads: ['damage.spell.bonus'],
      warnings: [],
    });
    // Golden C 2014, level 6: one upgrade, 11 + 1.
    const c = computed(withHotter(goldenC2014));
    expect(c.warnings).toEqual([]);
    const grown = spellDice(fireBolt, c.values).damage[0]?.formula;
    expect(grown).toBe('2d10 + @damage.spell.bonus');
    expect(averageOn(c, grown).value).toBe(12);
    // A penalty: 5.5 - 2.
    const less = { 'cantrip.upgrades': 0, 'damage.spell.bonus': -2 };
    expect(formulas(spellDice(fireBolt, less))).toEqual(['1d10 + @damage.spell.bonus']);
    expect(averageWith(less, '1d10 + @damage.spell.bonus')).toBe(3.5);
  });

  it('lets an override win: 3 is written, 0 writes nothing', () => {
    const three = computed({ ...goldenA, overrides: [{ path: 'damage.spell.bonus', value: 3 }] });
    expect(three.values['damage.spell.bonus']).toBe(3);
    expect(three.breakdown['damage.spell.bonus']?.at(-1)).toMatchObject({ kind: 'override' });
    const bolt = spellDice(fireBolt, three.values).damage[0]?.formula;
    expect(bolt).toBe('1d10 + @damage.spell.bonus');
    expect(averageOn(three, bolt).value).toBe(8.5);
    const none = computed(withHotter(goldenA, [{ path: 'damage.spell.bonus', value: 0 }]));
    expect(none.values['damage.spell.bonus']).toBe(0);
    expect(spellDice(fireBolt, none.values)).toEqual({
      times: 0,
      damage: [{ formula: '1d10', type: 'fire' }],
      warnings: [],
    });
  });

  it('joins after the scaling, and a critical hit doubles the dice only', () => {
    // SRD 5.1 Fireball at slot 5: 10d6, 35 + 2.
    const two = { 'damage.spell.bonus': 2 };
    const ball = spellDice(fireball, two, { slot: 5 }).damage[0]?.formula;
    expect(ball).toBe('10d6 + @damage.spell.bonus');
    expect(averageWith(two, ball)).toBe(37);
    // Dice of other faces follow the spell's own, then the bonus follows the whole.
    const mixed: SpellInput = {
      id: 'character:spell/mixed',
      level: 1,
      damage: [{ formula: '2d4', type: 'glare' }],
      scaling: { kind: 'slot', formula: '1d6' },
    };
    expect(formulas(spellDice(mixed, two, { slot: 2 }))).toEqual([
      '2d4 + 1d6 + @damage.spell.bonus',
    ]);
    // Fire Bolt's critical hit: 2d10, 11 + 1.
    const one = { 'cantrip.upgrades': 0, 'damage.spell.bonus': 1 };
    const critical = criticalDamage(spellDice(fireBolt, one).damage[0]?.formula ?? '');
    expect(critical.ok && critical.formula.text).toBe('2d10 + @damage.spell.bonus');
    expect(averageWith(one, '2d10 + @damage.spell.bonus')).toBe(12);
  });

  it('adds it to the first damage only: SRD 5.1 Flame Strike, 4d6 fire and 4d6 radiant', () => {
    const flameStrike: SpellInput = {
      id: 'srd-2014:spell/flame-strike',
      level: 5,
      damage: [
        { formula: '4d6', type: 'fire' },
        { formula: '4d6', type: 'radiant' },
      ],
    };
    const one = { 'damage.spell.bonus': 1 };
    const strike = spellDice(flameStrike, one, { slot: 5 });
    expect(strike).toEqual({
      times: 0,
      damage: [
        { formula: '4d6 + @damage.spell.bonus', type: 'fire' },
        { formula: '4d6', type: 'radiant' },
      ],
      warnings: [],
    });
    // 14 + 1, and 14.
    expect(strike.damage.map(({ formula }) => averageWith(one, formula))).toEqual([15, 14]);
  });

  it('keeps the stat and the healing as they were: Spiritual Weapon, Cure Wounds, Conjure Celestial', () => {
    const hot = computed(withHotter(goldenA));
    const weapon: SpellInput = {
      id: 'srd-2014:spell/spiritual-weapon',
      level: 2,
      damage: [{ formula: '1d8 + @mod', type: 'force' }],
    };
    const struck = spellDice(weapon, hot.values, { slot: 2, stat: 'wis' }).damage[0]?.formula;
    expect(struck).toBe('1d8 + @abilities.wis.mod + @damage.spell.bonus');
    // 4.5 + 3 + 1.
    expect(averageOn(hot, struck)).toEqual({
      value: 8.5,
      reads: ['abilities.wis.mod', 'damage.spell.bonus'],
      warnings: [],
    });
    const cure = entityIn(index2014, 'srd-2014:spell/cure-wounds');
    if (cure.type !== 'spell') throw new Error('Cure Wounds is not a spell');
    const cured = spellDice(cure, hot.values, { slot: 1, stat: 'wis' });
    expect(cured).toEqual({
      times: 0,
      damage: [],
      healing: { formula: '1d8 + @abilities.wis.mod', kind: 'hp' },
      warnings: [],
    });
    expect(averageOn(hot, cured.healing?.formula).value).toBe(7.5);
    const conjure: SpellInput = {
      id: 'srd-2024:spell/conjure-celestial',
      level: 7,
      damage: [{ formula: '6d12', type: 'radiant' }],
      healing: { formula: '4d12 + @mod', kind: 'hp' },
      scaling: { kind: 'slot', formula: '1d12' },
    };
    const one = { 'damage.spell.bonus': 1 };
    const conjured = spellDice(conjure, one, { slot: 9, stat: 'cha' });
    expect(conjured).toEqual({
      times: 2,
      damage: [{ formula: '8d12 + @damage.spell.bonus', type: 'radiant' }],
      healing: { formula: '6d12 + @abilities.cha.mod', kind: 'hp' },
      warnings: [],
    });
    // 52 + 1.
    expect(averageWith(one, conjured.damage[0]?.formula)).toBe(53);
  });

  it('warns, never throws: no bonus value, a formula that fails, one past the limits', () => {
    const missing = spellDice(fireball, {}, { slot: 3 });
    expect(formulas(missing)).toEqual(['8d6']);
    expect(codes(missing)).toEqual([{ code: 'missingPath', path: 'damage.spell.bonus' }]);
    expect(codes(spellDice(fireball, { 'damage.spell.bonus': 'one' }))).toEqual([
      { code: 'missingPath', path: 'damage.spell.bonus' },
    ]);
    // A spell with no damage reads no bonus.
    const cure = entityIn(index2014, 'srd-2014:spell/cure-wounds');
    if (cure.type !== 'spell') throw new Error('Cure Wounds is not a spell');
    expect(spellDice(cure, {}, { stat: 'wis' }).warnings).toEqual([]);

    const one = { 'damage.spell.bonus': 1 };
    const broken: SpellInput = {
      id: 'character:spell/broken',
      level: 1,
      damage: [{ formula: '1d', type: 'glare' }],
    };
    const result = spellDice(broken, one);
    expect(formulas(result)).toEqual(['1d']);
    expect(codes(result)).toEqual([
      {
        code: 'damageBonusFormula',
        spell: 'character:spell/broken',
        error: expect.objectContaining({ code: 'unexpected', found: 'd', at: 1 }),
      },
    ]);
    // 3 + 244 × 4 = 979 characters, and " + @damage.spell.bonus" 22 more: 1001.
    const long: SpellInput = {
      id: 'character:spell/long',
      level: 1,
      damage: [{ formula: `1d6${' + 1'.repeat(244)}`, type: 'glare' }],
    };
    expect(long.damage?.[0]?.formula).toHaveLength(979);
    const tooLong = spellDice(long, one);
    expect(formulas(tooLong)).toEqual([long.damage?.[0]?.formula]);
    expect(codes(tooLong)).toEqual([
      {
        code: 'damageBonusFormula',
        spell: 'character:spell/long',
        error: expect.objectContaining({ code: 'tooLong', length: 1001 }),
      },
    ]);
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const damage = [{ formula: '1d10', type: 'fire' }];
    const scaling = { kind: 'cantrip' as const, formula: '1d10' };
    const frozenSpell: SpellInput = { ...fireBolt, damage, scaling };
    for (const part of [frozenSpell, damage, scaling, ...damage]) Object.freeze(part);
    const values = Object.freeze({ 'cantrip.upgrades': 1, 'damage.spell.bonus': 1 });
    const first = spellDice(frozenSpell, values);
    expect(spellDice(frozenSpell, values)).toEqual(first);
    expect(formulas(first)).toEqual(['2d10 + @damage.spell.bonus']);
    expect(frozenSpell.damage).toEqual([{ formula: '1d10', type: 'fire' }]);
  });
});
