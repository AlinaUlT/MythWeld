import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  CANTRIP_LEVELS,
  cantripUpgrades,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionEntitySchema,
  fifthEditionModule,
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
  srd2014,
  srd2024,
} from './golden/index.ts';

// ENG-50: a spell's dice for the character's level. The rules are ENG-50 §8's. The SRD spells'
// numbers are 5e-database's (`e6edf9a`), with no text; the character's own entities
// (`character:`) are made up. Each value below was worked out by hand, never copied from a run.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type SpellInput = Pick<SpellDef, 'id' | 'level' | 'damage' | 'scaling'>;

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
    const at = (upgrades: number) => spellDice(fireBolt, { 'cantrip.upgrades': upgrades });
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
    const bySlot = [3, 4, 5, 6, 7, 8, 9].map((slot) => formulas(spellDice(fireball, {}, slot)));
    expect(bySlot.flat()).toEqual(['8d6', '9d6', '10d6', '11d6', '12d6', '13d6', '14d6']);
    // Without a slot, or with one below its level, its own dice; `cantrip.upgrades` is not read.
    expect(spellDice(fireball, { 'cantrip.upgrades': 3 })).toEqual({
      times: 0,
      damage: [{ formula: '8d6', type: 'fire' }],
      warnings: [],
    });
    expect(spellDice(fireball, {}, 2).times).toBe(0);
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
    expect(formulas(spellDice(own(spell), {}, 4))).toEqual(['4d6']);
  });

  it('counts a number of times that is not whole as the whole number below it, 0 at least', () => {
    expect(spellDice(fireBolt, { 'cantrip.upgrades': 1.5 }).times).toBe(1);
    expect(formulas(spellDice(fireBolt, { 'cantrip.upgrades': 1.5 }))).toEqual(['2d10']);
    expect(spellDice(fireBolt, { 'cantrip.upgrades': -1 }).times).toBe(0);
    expect(formulas(spellDice(fireball, {}, 4.5))).toEqual(['9d6']);
  });

  it('gives a spell with no scaling its own damage, and one with no damage nothing', () => {
    const plain: SpellInput = {
      id: 'character:spell/plain',
      level: 1,
      damage: [{ formula: '2d4', type: 'glare' }],
    };
    expect(spellDice(plain, {}, 5)).toEqual({
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
    const missing = spellDice(fireBolt, {});
    expect(formulas(missing)).toEqual(['1d10']);
    expect(codes(missing)).toEqual([{ code: 'missingPath', path: 'cantrip.upgrades' }]);
    expect(codes(spellDice(fireBolt, { 'cantrip.upgrades': 'many' }))).toEqual([
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
        expect.objectContaining({ code: 'scalingWithoutDamage', spell: 'character:spell/extra' }),
      ],
    });

    const broken: SpellInput = { ...fireBolt, scaling: { kind: 'cantrip', formula: '1d' } };
    const result = spellDice(broken, { 'cantrip.upgrades': 1 });
    expect(formulas(result)).toEqual(['1d10']);
    expect(codes(result)).toEqual([
      {
        code: 'scalingFormula',
        spell: 'srd-2014:spell/fire-bolt',
        error: expect.objectContaining({ code: 'unexpected', found: 'd', at: 1 }),
      },
    ]);
    // A count past 999 dice in a term: 1 + 999 × 1.
    expect(codes(spellDice(fireBolt, { 'cantrip.upgrades': 999 }))).toEqual([
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
