import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../../src/index.ts';
import { opened } from './checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenC2024,
  goldenD,
  srd2014,
  srd2024,
} from './index.ts';

// The golden tests (SPEC §6.7): each value below is SPEC §6.7's, computed by hand there, never
// copied from a run. Each ticket from ENG-13 to ENG-19 adds the lines it makes true; the goldens
// are whole by ENG-19 (BACKLOG). A line no ticket has made true yet is not here.

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** A golden character, computed by fifth edition's module on its edition's pack. */
function computed(
  golden: z.input<typeof fifthEditionCharacterSchema>,
): Computed<FifthEditionEntity> {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = character.ruleset === '2014' ? index2014 : index2024;
  return compute(character, index, fifthEditionModule);
}

const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Path → value, for the paths named. */
function valuesOf(result: Computed<FifthEditionEntity>, paths: readonly string[]) {
  return Object.fromEntries(paths.map((path) => [path, result.values[path]]));
}

/** Each path's value, by the key in its middle: `abilities.<key>.mod` → key → value. */
function byKey(
  result: Computed<FifthEditionEntity>,
  pattern: (key: string) => string,
  keys = STATS,
) {
  return Object.fromEntries(keys.map((key) => [key, result.values[pattern(key)]]));
}

describe('ENG-13 goldens: check bonuses', () => {
  const a = computed(goldenA);
  const b = computed(goldenB);
  const b4 = computed(goldenB4);
  const d = computed(goldenD);

  it('golden A: modifiers, saves, skills, passive Perception', () => {
    expect(byKey(a, (key) => `abilities.${key}.mod`)).toEqual({
      str: 1,
      dex: 0,
      con: 3,
      int: -1,
      wis: 3,
      cha: 1,
    });
    // WIS +5, CHA +3, the others equal to their modifier.
    expect(byKey(a, (key) => `abilities.${key}.save`)).toEqual({
      str: 1,
      dex: 0,
      con: 3,
      int: -1,
      wis: 5,
      cha: 3,
    });
    expect(
      valuesOf(a, [
        'skills.insight.total',
        'skills.medicine.total',
        'skills.persuasion.total',
        'skills.religion.total',
        'skills.perception.total',
        'skills.perception.passive',
      ]),
    ).toEqual({
      'skills.insight.total': 5,
      'skills.medicine.total': 5,
      'skills.persuasion.total': 3,
      'skills.religion.total': 1,
      'skills.perception.total': 3,
      'skills.perception.passive': 13,
    });
  });

  it('golden B: modifiers, saves, skills, passive Perception', () => {
    expect(byKey(b, (key) => `abilities.${key}.mod`)).toEqual({
      str: 3,
      dex: 1,
      con: 2,
      int: -1,
      wis: 1,
      cha: 0,
    });
    expect(valuesOf(b, ['abilities.str.save', 'abilities.con.save'])).toEqual({
      'abilities.str.save': 5,
      'abilities.con.save': 4,
    });
    expect(
      valuesOf(b, [
        'skills.athletics.total',
        'skills.intimidation.total',
        'skills.perception.total',
        'skills.survival.total',
        'skills.insight.total',
        'skills.perception.passive',
      ]),
    ).toEqual({
      'skills.athletics.total': 5,
      'skills.intimidation.total': 2,
      'skills.perception.total': 3,
      'skills.survival.total': 3,
      'skills.insight.total': 3,
      'skills.perception.passive': 13,
    });
  });

  it('golden B4: STR 19 (+4), Athletics +6', () => {
    expect(
      valuesOf(b4, ['abilities.str.score', 'abilities.str.mod', 'skills.athletics.total']),
    ).toEqual({ 'abilities.str.score': 19, 'abilities.str.mod': 4, 'skills.athletics.total': 6 });
  });

  it('golden C: proficiency bonus +3, in both editions', () => {
    expect(computed(goldenC2014).values.prof).toBe(3);
    expect(computed(goldenC2024).values.prof).toBe(3);
  });

  it('golden D: Athletics +1, STR save +1; without exhaustion, golden B again', () => {
    expect(valuesOf(d, ['skills.athletics.total', 'abilities.str.save'])).toEqual({
      'skills.athletics.total': 1,
      'abilities.str.save': 1,
    });
    expect(valuesOf(b, ['skills.athletics.total', 'abilities.str.save'])).toEqual({
      'skills.athletics.total': 5,
      'abilities.str.save': 5,
    });
  });

  it('every golden: no warning, and each breakdown adds up to its value', () => {
    const all = [a, b, b4, d, computed(goldenC2014), computed(goldenC2024)];
    for (const result of all) {
      expect(result.warnings).toEqual([]);
      for (const [path, steps] of Object.entries(result.breakdown)) {
        const sum = steps.reduce((total, step) => total + step.change, 0);
        expect([path, sum]).toEqual([path, result.values[path]]);
      }
    }
  });
});

describe('ENG-14 goldens: combat numbers', () => {
  const a = computed(goldenA);
  const b = computed(goldenB);
  const b4 = computed(goldenB4);
  const d = computed(goldenD);
  const combat = ['hp.max', 'ac.total', 'init.total', 'speed.walk'];

  it('golden A: hit points 12, AC 18, speed 25, initiative +0', () => {
    // 12 = 8 + 3 + 1 (Dwarven Toughness); 18 = chain mail 16 + shield 2.
    expect(valuesOf(a, combat)).toEqual({
      'hp.max': 12,
      'ac.total': 18,
      'init.total': 0,
      'speed.walk': 25,
    });
  });

  it('golden B: hit points 12, initiative +3, AC 17, speed 30', () => {
    // +3 = DEX +1, Alert +2; 17 = chain mail 16 + Defense 1.
    expect(valuesOf(b, combat)).toEqual({
      'hp.max': 12,
      'ac.total': 17,
      'init.total': 3,
      'speed.walk': 30,
    });
  });

  it('golden B4: hit points 36 = 12 + 3 × (6 + 2), initiative +3', () => {
    expect(valuesOf(b4, ['hp.max', 'init.total'])).toEqual({ 'hp.max': 36, 'init.total': 3 });
  });

  it('golden D: initiative −1, speed 20; without exhaustion, golden B again', () => {
    expect(valuesOf(d, ['init.total', 'speed.walk'])).toEqual({
      'init.total': -1,
      'speed.walk': 20,
    });
    expect(valuesOf(b, ['init.total', 'speed.walk'])).toEqual({
      'init.total': 3,
      'speed.walk': 30,
    });
  });
});

describe('ENG-15 goldens: spellcasting', () => {
  const a = computed(goldenA);

  it('golden A: spell save DC 13, attack +5; 4 prepared and the domain spells; 2 slots, 3 cantrips', () => {
    expect(
      valuesOf(a, [
        'classes.cleric.spell.dc',
        'classes.cleric.spell.attack',
        'classes.cleric.spell.prepared',
        'spell.slots.level1',
        'classes.cleric.spell.cantrips',
      ]),
    ).toEqual({
      'classes.cleric.spell.dc': 13,
      'classes.cleric.spell.attack': 5,
      'classes.cleric.spell.prepared': 4,
      'spell.slots.level1': 2,
      'classes.cleric.spell.cantrips': 3,
    });
    // Bless and Cure Wounds, always prepared: the Life domain's spell grant, reached at cleric 1.
    const alwaysPrepared = a.grants.flatMap(({ part, grant }) =>
      grant.kind === 'spell' && grant.alwaysPrepared === true ? [[part, grant.fixed]] : [],
    );
    expect(alwaysPrepared).toEqual([
      [
        'srd-2014:subclass/life#domain-spells-1',
        ['srd-2014:spell/bless', 'srd-2014:spell/cure-wounds'],
      ],
    ]);
  });

  it('golden C: caster level 4 and slots 4, 3 in 2014; 5 and 4, 3, 2 in 2024', () => {
    const slots = ['spell.slots.level1', 'spell.slots.level2', 'spell.slots.level3'];
    expect(valuesOf(computed(goldenC2014), ['spell.casterLevel', ...slots])).toEqual({
      'spell.casterLevel': 4,
      'spell.slots.level1': 4,
      'spell.slots.level2': 3,
      'spell.slots.level3': 0,
    });
    expect(valuesOf(computed(goldenC2024), ['spell.casterLevel', ...slots])).toEqual({
      'spell.casterLevel': 5,
      'spell.slots.level1': 4,
      'spell.slots.level2': 3,
      'spell.slots.level3': 2,
    });
  });
});

describe('ENG-16 goldens: weapon attacks', () => {
  const a = computed(goldenA);
  const b = computed(goldenB);
  const b4 = computed(goldenB4);
  const d = computed(goldenD);
  const greatsword = ['attacks.greatsword.hit', 'attacks.greatsword.damage'];

  /** An equipped item's own damage dice and type, which its attack's damage bonus is added to. */
  function damageOf(result: Computed<FifthEditionEntity>, id: string) {
    const item = result.entities.find(({ entity }) => entity.id === id)?.entity;
    return item?.type === 'item' ? item.weapon?.damage : undefined;
  }

  it('golden A: warhammer +3 to hit, proficiency from the species; 1d8+1 bludgeoning', () => {
    expect(valuesOf(a, ['attacks.warhammer.hit', 'attacks.warhammer.damage'])).toEqual({
      'attacks.warhammer.hit': 3,
      'attacks.warhammer.damage': 1,
    });
    expect(damageOf(a, 'srd-2014:item/warhammer')).toEqual({
      formula: '1d8',
      type: 'bludgeoning',
    });
    // The cleric's weapons are simple; the warhammer is the dwarf's Dwarven Combat Training's.
    expect(
      a.breakdown['attacks.warhammer.prof']?.map((step) => step.kind === 'grant' && step.part),
    ).toEqual(['srd-2014:feature/dwarven-combat-training#weapons']);
    expect(a.values['crit.range']).toBe(20);
  });

  it('golden B: greatsword +5, 2d6+3 slashing, mastery Graze', () => {
    expect(valuesOf(b, [...greatsword, 'attacks.greatsword.mastery'])).toEqual({
      'attacks.greatsword.hit': 5,
      'attacks.greatsword.damage': 3,
      'attacks.greatsword.mastery': 1,
    });
    expect(damageOf(b, 'srd-2024:item/greatsword')).toEqual({ formula: '2d6', type: 'slashing' });
    const item = b.entities.find(({ entity }) => entity.id === 'srd-2024:item/greatsword')?.entity;
    expect(item?.type === 'item' && item.weapon?.mastery).toBe('graze');
  });

  it('golden B4: greatsword +6, 2d6+4; a critical hit on 19–20; 4 kinds of weapons mastered', () => {
    expect(valuesOf(b4, [...greatsword, 'crit.range'])).toEqual({
      'attacks.greatsword.hit': 6,
      'attacks.greatsword.damage': 4,
      'crit.range': 19,
    });
    const kinds = b4.proficiencies.filter(({ category }) => category === 'mastery');
    expect(kinds).toHaveLength(4);
    expect(b4.values['classes.fighter.table.weaponMastery']).toBe(4);
  });

  it('golden D: greatsword +1, damage unchanged; without exhaustion, golden B again', () => {
    expect(valuesOf(d, greatsword)).toEqual({
      'attacks.greatsword.hit': 1,
      'attacks.greatsword.damage': 3,
    });
    expect(valuesOf(b, greatsword)).toEqual({
      'attacks.greatsword.hit': 5,
      'attacks.greatsword.damage': 3,
    });
  });
});
