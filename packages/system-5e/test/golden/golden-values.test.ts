import {
  type Computed,
  compute,
  type LogStamp,
  loadContentIndex,
  removeCondition,
  setCondition,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_STAT_DEFAULTS,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
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
  goldenE,
  hbLocal,
  srd2014,
  srd2024,
} from './index.ts';

// The golden tests (SPEC §6.7): each value below is SPEC §6.7's, computed by hand there, never
// copied from a run. Each ticket from ENG-13 on adds the lines it makes true; the fixture
// tests hold the scores and Second Wind's uses (ENG-09, ENG-10). A line no ticket has made true
// yet is not here: Second Wind back on a rest (ENG-21).

/** The packs the goldens may name, each opened once, by id. */
const PACKS = new Map(
  [srd2014, srd2024, hbLocal].map((file) => {
    const pack = opened(openFifthEditionPack(file));
    return [pack.id, pack];
  }),
);

/** A character's active packs, in its order (SPEC §5.8), loaded into the content index. */
function loadedFor(character: FifthEditionCharacter) {
  return loadContentIndex(
    FIFTH_EDITION_SYSTEM,
    character.packs.flatMap((id) => PACKS.get(id) ?? []),
  );
}

/** A golden character, computed by fifth edition's module on the packs it names. */
function computed(
  golden: z.input<typeof fifthEditionCharacterSchema>,
): Computed<FifthEditionEntity> {
  const character = opened(openFifthEditionCharacter(golden));
  return compute(character, loadedFor(character).index, fifthEditionModule);
}

/** The result has no warning, and each path's breakdown adds up to its value (ENG-13). */
function expectWhole(result: Computed<FifthEditionEntity>) {
  expect(result.warnings).toEqual([]);
  for (const [path, steps] of Object.entries(result.breakdown)) {
    const sum = steps.reduce((total, step) => total + step.change, 0);
    expect([path, sum]).toEqual([path, result.values[path]]);
  }
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
    for (const result of [a, b, b4, d, computed(goldenC2014), computed(goldenC2024)]) {
      expectWhole(result);
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

describe('ENG-34 goldens: golden B4', () => {
  const b4 = computed(goldenB4);
  const athlete = 'srd-2024:feature/champion-remarkable-athlete';

  /** The parts of the effects that gave a path's value. */
  function effectsOf(path: string) {
    return (b4.breakdown[path] ?? []).map((step) =>
      step.kind === 'effect' ? step.part : step.kind,
    );
  }

  it('golden B4: Athletics +6, with advantage (Remarkable Athlete)', () => {
    expect(valuesOf(b4, ['skills.athletics.total', 'skills.athletics.mode'])).toEqual({
      'skills.athletics.total': 6,
      'skills.athletics.mode': 1,
    });
    expect(effectsOf('skills.athletics.mode')).toEqual([`${athlete}#athletics`]);
  });

  it('golden B4: initiative +3, with advantage', () => {
    expect(valuesOf(b4, ['init.total', 'init.mode'])).toEqual({ 'init.total': 3, 'init.mode': 1 });
    expect(effectsOf('init.mode')).toEqual([`${athlete}#initiative`]);
  });

  it('golden B4: no warning, and each breakdown adds up to its value', () => {
    expectWhole(b4);
  });
});

describe('ENG-22 golden E: the homebrew pack from Appendix Д', () => {
  const e = computed(goldenE);
  const b = computed(goldenB);
  /** Golden E with its base SAN at `score`. */
  const withSan = (score: number) => ({
    ...goldenE,
    abilities: { base: { ...goldenE.abilities.base, san: score } },
  });
  const noFeat = { ...goldenE, systemData: { ...goldenE.systemData, feats: [] } };
  const packOff = { ...goldenE, packs: ['srd-2024'] };

  it("the pack, Appendix Д's with its system and the module's version, loads after the SRD", () => {
    const loaded = loadedFor(opened(openFifthEditionCharacter(goldenE)));
    expect([loaded.loaded, loaded.refused, loaded.warnings]).toEqual([
      ['srd-2024', 'hb-local'],
      [],
      [],
    ]);
  });

  it('SAN 14: modifier +2, and a save; a stat after the six', () => {
    expect(
      valuesOf(e, [
        'abilities.san.score',
        'abilities.san.mod',
        'abilities.san.saveProf',
        'abilities.san.save',
      ]),
    ).toEqual({
      'abilities.san.score': 14,
      'abilities.san.mod': 2,
      'abilities.san.saveProf': 0,
      'abilities.san.save': 2,
    });
    // What the abilities and saves blocks list: each stat, by its order, and whether it has a save.
    const stats = Object.values(e.byKey.ability ?? {})
      .flatMap((stat) => (stat.type === 'ability' ? [stat] : []))
      .sort((x, y) => x.order - y.order)
      .map((stat) => [stat.key, stat.hasSave ?? FIFTH_EDITION_STAT_DEFAULTS.hasSave]);
    expect(stats).toEqual([...STATS, 'san'].map((key) => [key, true]));
  });

  it('Composure: from SAN, no proficiency, +2', () => {
    expect(e.keys['skills.composure.ability']?.key).toBe('san');
    expect(valuesOf(e, ['skills.composure.prof', 'skills.composure.total'])).toEqual({
      'skills.composure.prof': 0,
      'skills.composure.total': 2,
    });
  });

  it('Occultism: INT 8 → 9 (−1) + proficiency 2 from Arcane Scholar = +1', () => {
    expect(
      valuesOf(e, [
        'abilities.int.score',
        'abilities.int.mod',
        'skills.occultism.prof',
        'prof',
        'skills.occultism.total',
      ]),
    ).toEqual({
      'abilities.int.score': 9,
      'abilities.int.mod': -1,
      'skills.occultism.prof': 1,
      prof: 2,
      'skills.occultism.total': 1,
    });
    expect(
      e.breakdown['abilities.int.score']?.map((step) =>
        step.kind === 'effect' ? step.part : step.kind,
      ),
    ).toEqual(['base', 'hb-local:feat/arcane-scholar#int-plus-1']);
    expect(
      e.breakdown['skills.occultism.prof']?.map((step) => step.kind === 'grant' && step.part),
    ).toEqual(['hb-local:feat/arcane-scholar#occult-prof']);
  });

  it('SAN changed to 16: Composure +3 at once', () => {
    expect(computed(withSan(16)).values['skills.composure.total']).toBe(3);
  });

  it('the feat removed: Occultism −1, INT 8', () => {
    expect(valuesOf(computed(noFeat), ['skills.occultism.total', 'abilities.int.score'])).toEqual({
      'skills.occultism.total': -1,
      'abilities.int.score': 8,
    });
  });

  it('the pack off: the character opens; Missing: hb-local:… where it was named, no crash', () => {
    const off = computed(packOff);
    expect(off.warnings).toEqual([
      {
        code: 'missing',
        id: 'hb-local:feat/arcane-scholar',
        from: 'character',
        message: 'Missing: hb-local:feat/arcane-scholar (given by character).',
      },
      // ENG-12: a base score whose stat no pack gives is not used.
      expect.objectContaining({ code: 'noStat', key: 'san', from: 'character' }),
    ]);
    expect(Object.keys(off.byKey.ability ?? {})).toEqual(STATS);
    expect(valuesOf(off, ['skills.occultism.total', 'skills.composure.total'])).toEqual({
      'skills.occultism.total': undefined,
      'skills.composure.total': undefined,
    });
  });

  it("golden B's other values do not move: INT 9's modifier is −1, as INT 8's is", () => {
    const moved = Object.entries(b.values).flatMap(([path, value]) =>
      e.values[path] === value ? [] : [[path, value, e.values[path]]],
    );
    expect(moved).toEqual([['abilities.int.score', 8, 9]]);
  });

  it('golden E, with SAN 16 and with no feat: no warning, each breakdown adds up', () => {
    for (const result of [e, computed(withSan(16)), computed(noFeat)]) expectWhole(result);
  });
});

describe('ENG-19 goldens: golden D', () => {
  const b = computed(goldenB);
  const d = computed(goldenD);
  const exhaustion = 'srd-2024:condition/exhaustion';
  const stamp: LogStamp = {
    id: '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b',
    at: '2026-10-02T12:00:00.000Z',
    by: { role: 'player', name: 'Test' },
  };

  /** Each d20 test a character has: saves, checks, skills, weapon and spell attacks, initiative. */
  const D20_TEST =
    /^(abilities\.[^.]+\.save|checks\.[^.]+\.total|skills\.[^.]+\.total|attacks\.[^.]+\.hit|(classes|abilities)\.[^.]+\.spell\.attack|init\.total)$/;

  it("golden D: every d20 test is golden B's − 4", () => {
    const tests = Object.keys(b.values).filter((path) => D20_TEST.test(path));
    // 6 saves, 6 checks, 18 skills, the greatsword, initiative.
    expect(tests).toHaveLength(32);
    const lower = tests.filter((path) => d.values[path] !== Number(b.values[path]) - 4);
    expect(lower).toEqual([]);
  });

  it("golden D: speed 20, every other speed golden B's 0; damage, hit points, AC golden B's", () => {
    const speeds = ['walk', 'fly', 'swim', 'climb', 'burrow'].map((kind) => `speed.${kind}`);
    expect(valuesOf(d, speeds)).toEqual({
      'speed.walk': 20,
      'speed.fly': 0,
      'speed.swim': 0,
      'speed.climb': 0,
      'speed.burrow': 0,
    });
    expect(valuesOf(b, speeds)).toEqual({ ...valuesOf(d, speeds), 'speed.walk': 30 });
    const kept = ['attacks.greatsword.damage', 'hp.max', 'ac.total'];
    expect(valuesOf(d, kept)).toEqual({
      'attacks.greatsword.damage': 3,
      'hp.max': 12,
      'ac.total': 17,
    });
    expect(valuesOf(b, kept)).toEqual(valuesOf(d, kept));
  });

  it("golden D: exhaustion 2 given to golden B is golden D; removed, golden B's values again", () => {
    const character = opened(openFifthEditionCharacter(goldenB));
    const { index } = loadedFor(character);
    const given = setCondition(character, index, { id: exhaustion, level: 2 }, stamp);
    if (!given.ok) throw new Error(given.message);
    const tired = compute(given.character, index, fifthEditionModule);
    expect(tired.values).toEqual(d.values);
    expect(tired.breakdown).toEqual(d.breakdown);

    const removed = removeCondition(given.character, index, { id: exhaustion }, stamp);
    if (!removed.ok) throw new Error(removed.message);
    const rested = compute(removed.character, index, fifthEditionModule);
    expect(rested.values).toEqual(b.values);
    expect(rested.breakdown).toEqual(b.breakdown);
  });
});
