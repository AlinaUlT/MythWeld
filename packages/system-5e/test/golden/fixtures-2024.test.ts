import { compute, loadContentIndex, parseFormula, parseRoll } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type FifthEditionPack,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../../src/index.ts';
import { formulasOf, idsNamedBy, idsNamedByCharacter, keysNamedBy, opened } from './checks.ts';
import { goldenB, goldenB4, goldenC2024, goldenD, srd2024 } from './index.ts';

// ENG-10: the 2024 golden data is whole, agrees with itself, and gives what SPEC §6.7 says goldens
// B, B4 and D have. Expected counts are ENG-10 §8's; scores, sources and numbers are SPEC §6.7's.

const FROM_CURRENT = { schemaVersion: 1, systemSchemaVersion: 2 };

const pack: FifthEditionPack = opened(openFifthEditionPack(srd2024));
const entities: readonly FifthEditionEntity[] = pack.entities;

const { index, refused, warnings } = loadContentIndex(FIFTH_EDITION_SYSTEM, [pack]);

// Gathering, the base phase and the fixture's mechanics are under test, through fifth edition's
// module (ENG-13): it gives `prof`, the fighter's table and `d20.all.bonus`, each target where it
// starts and the chain mail goldens B, B4 and D wear (ENG-14), and the critical range at a d20's
// highest face (SPEC §6.5; ENG-16).

const b = opened(openFifthEditionCharacter(goldenB));
const b4 = opened(openFifthEditionCharacter(goldenB4));
const c = opened(openFifthEditionCharacter(goldenC2024));
const d = opened(openFifthEditionCharacter(goldenD));

/** A character's scores, in the SRD's order of the stats. */
function scoresOf(character: FifthEditionCharacter): unknown[] {
  const { values } = compute(character, index, fifthEditionModule);
  return ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => values[`abilities.${key}.score`]);
}

/** The steps of a stat's score: the base, then each grant's increase. */
function increasesOf(character: FifthEditionCharacter, key: string): string[] {
  return (
    compute(character, index, fifthEditionModule).breakdown[`abilities.${key}.score`] ?? []
  ).map((step) =>
    step.kind === 'grant' ? `${step.part} ${step.change}` : `${step.kind} ${step.change}`,
  );
}

/** Golden B's entities, in the order gathering finds them. */
const GATHERED_B = [
  'srd-2024:species/human',
  'srd-2024:feature/resourceful',
  'srd-2024:feature/skillful',
  'srd-2024:feature/versatile',
  'srd-2024:feat/alert',
  'srd-2024:background/soldier',
  'srd-2024:feat/savage-attacker',
  'srd-2024:class/fighter',
  'srd-2024:feature/fighter-fighting-style',
  'srd-2024:feat/defense',
  'srd-2024:feature/fighter-second-wind',
  'srd-2024:feature/fighter-weapon-mastery',
];

/** Golden B's equipped items, gathered after everything else its part names (ENG-14). */
const ITEMS_B = ['srd-2024:item/chain-mail', 'srd-2024:item/greatsword'];

describe('ENG-10 2024 fixtures', () => {
  it('opens and loads the pack as a file', () => {
    expect(openFifthEditionPack(srd2024)).toEqual({ ok: true, value: srd2024, from: FROM_CURRENT });
    expect(refused).toEqual([]);
    expect(warnings).toEqual([]);
    expect(index.entities).toHaveLength(57);
  });

  it('holds the counts the SRD has', () => {
    const counts: Record<string, number> = {};
    for (const entity of entities) counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    expect(counts).toEqual({
      ability: 6,
      skill: 18,
      species: 1,
      feature: 12,
      background: 1,
      feat: 3,
      class: 3,
      subclass: 1,
      condition: 1,
      item: 5,
      damageType: 1,
      weaponProperty: 3,
      weaponMastery: 2,
    });
    expect(entities.every((entity) => entity.ruleset === '2024')).toBe(true);
    expect(entities.every((entity) => entity.source.pack === 'srd-2024')).toBe(true);
  });

  it('names only its own entities', () => {
    const missing = entities.flatMap((entity) =>
      idsNamedBy(entity)
        .filter((id) => !index.get(id).ok)
        .map((id) => `${id} (named by ${entity.id})`),
    );
    expect(missing).toEqual([]);
    expect(entities.flatMap(idsNamedBy)).toHaveLength(13);
  });

  it('names only its own stats, skills, classes, damage types, properties and masteries', () => {
    const missing = entities.flatMap((entity) =>
      keysNamedBy(entity)
        .filter((named) => {
          const [type = '', key = ''] = named.split(':');
          return index.withKey(type, key).length === 0;
        })
        .map((named) => `${named} (named by ${entity.id})`),
    );
    expect(missing).toEqual([]);
    expect(entities.flatMap(keysNamedBy)).toHaveLength(81);
  });

  it('holds formulas that parse', () => {
    const formulas = entities.flatMap((entity) => formulasOf(entity).formulas);
    const rolls = entities.flatMap((entity) => formulasOf(entity).rolls);
    expect(formulas).toEqual([
      '@prof',
      '@armor.worn',
      '@abilities.str.score >= 13 || @abilities.dex.score >= 13',
      '@classes.fighter.table.secondWindUses',
      '1',
      '-2 * @conditions.exhaustion.level',
      '-5 * @conditions.exhaustion.level',
    ]);
    expect(rolls).toEqual(['2d6', '1d12', '1d10', '1d10']);
    expect(formulas.filter((formula) => !parseFormula(formula).ok)).toEqual([]);
    expect(rolls.filter((roll) => !parseRoll(roll).ok)).toEqual([]);
  });

  it('opens the four characters, each naming only the pack', () => {
    for (const golden of [goldenB, goldenB4, goldenC2024, goldenD]) {
      expect(openFifthEditionCharacter(golden)).toEqual({
        ok: true,
        value: golden,
        from: FROM_CURRENT,
      });
    }
    for (const character of [b, b4, c, d]) {
      expect(idsNamedByCharacter(character).filter((id) => !index.get(id).ok)).toEqual([]);
    }
  });

  it('gathers golden B whole, every choice made', () => {
    const computed = compute(b, index, fifthEditionModule);
    expect(computed.entities.map((had) => had.entity.id)).toEqual([...GATHERED_B, ...ITEMS_B]);
    expect(computed.pendingChoices).toEqual([]);
    expect(computed.warnings).toEqual([]);
    expect(computed.values.level).toBe(1);
  });

  it("gives golden B's proficiencies from the sources SPEC §6.7 names", () => {
    const given = compute(b, index, fifthEditionModule).proficiencies.map(
      ({ category, key, from }) => `${category} ${key} ← ${from}`,
    );
    expect(given).toEqual([
      // Insight is the human's.
      'skill insight ← srd-2024:feature/skillful#skills',
      // Athletics and Intimidation are the Soldier's.
      'skill athletics ← srd-2024:background/soldier#skills',
      'skill intimidation ← srd-2024:background/soldier#skills',
      'tool playingCards ← srd-2024:background/soldier#tools',
      'armor light ← srd-2024:class/fighter#armor',
      'armor medium ← srd-2024:class/fighter#armor',
      'armor heavy ← srd-2024:class/fighter#armor',
      'armor shield ← srd-2024:class/fighter#armor',
      'weapon simple ← srd-2024:class/fighter#weapons',
      // The greatsword is a martial weapon.
      'weapon martial ← srd-2024:class/fighter#weapons',
      // Perception and Survival are the fighter's.
      'skill perception ← srd-2024:class/fighter#skills',
      'skill survival ← srd-2024:class/fighter#skills',
      // ENG-16: the kinds of weapons whose mastery the fighter uses, the greatsword's Graze among
      // them (SPEC §6.7); the other two are test data.
      'mastery greatsword ← srd-2024:feature/fighter-weapon-mastery#kinds',
      'mastery greataxe ← srd-2024:feature/fighter-weapon-mastery#kinds',
      'mastery glaive ← srd-2024:feature/fighter-weapon-mastery#kinds',
    ]);
  });

  it("gives golden B's scores: SPEC §6.7", () => {
    expect(scoresOf(b)).toEqual([17, 13, 15, 8, 12, 10]);
    expect(increasesOf(b, 'str')).toEqual([
      'base 15',
      'srd-2024:background/soldier#ability-scores 2',
    ]);
    expect(increasesOf(b, 'con')).toEqual([
      'base 14',
      'srd-2024:background/soldier#ability-scores 1',
    ]);
  });

  it("gives golden B's mechanics their numbers: SPEC §6.7", () => {
    const { values, resources } = compute(b, index, fifthEditionModule);
    // Initiative +3 = DEX +1, Alert +2.
    expect(values['init.bonus']).toBe(2);
    // AC 17 = chain mail 16, Defense +1.
    expect(values['ac.bonus']).toBe(1);
    // Second Wind: 2 uses; a short rest gives 1 back, a long rest all.
    expect(resources.map(({ key, from }) => `${key} ← ${from}`)).toEqual([
      'secondWind ← srd-2024:feature/fighter-second-wind#uses',
    ]);
    expect(resources[0]?.uses.recovery).toEqual([
      { on: 'short', amount: '1' },
      { on: 'long', amount: 'all' },
    ]);
    expect(values['resources.secondWind.max']).toBe(2);
    expect(values['crit.range']).toBe(20);
  });

  it('gathers golden B4: the Champion, level 4, +2 STR', () => {
    const computed = compute(b4, index, fifthEditionModule);
    expect(computed.entities.map((had) => had.entity.id)).toEqual([
      ...GATHERED_B,
      'srd-2024:feature/fighter-action-surge',
      'srd-2024:feature/fighter-tactical-mind',
      'srd-2024:feature/fighter-subclass',
      'srd-2024:feature/fighter-ability-score-improvement',
      'srd-2024:subclass/champion',
      'srd-2024:feature/champion-improved-critical',
      'srd-2024:feature/champion-remarkable-athlete',
      ...ITEMS_B,
    ]);
    expect(computed.pendingChoices).toEqual([]);
    expect(computed.warnings).toEqual([]);
    expect(computed.values.level).toBe(4);
    expect(scoresOf(b4)).toEqual([19, 13, 15, 8, 12, 10]);
    expect(increasesOf(b4, 'str')).toEqual([
      'base 15',
      'srd-2024:background/soldier#ability-scores 2',
      'srd-2024:class/fighter#ability-scores-4 2',
    ]);
  });

  it("gives golden B4's mechanics their numbers: SPEC §6.7", () => {
    const { values, entities: had } = compute(b4, index, fifthEditionModule);
    // A critical hit on 19 or 20 (Improved Critical).
    expect(values['crit.range']).toBe(19);
    expect(values['resources.secondWind.max']).toBe(3);
    // Weapon mastery: 4 kinds of weapons.
    expect(values['classes.fighter.table.weaponMastery']).toBe(4);
    expect(values['init.bonus']).toBe(2);
    expect(values['ac.bonus']).toBe(1);
    // Advantage on initiative and on Athletics (Remarkable Athlete): roll targets, not numbers.
    const athlete = had.find(
      ({ entity }) => entity.id === 'srd-2024:feature/champion-remarkable-athlete',
    );
    expect(athlete?.entity.effects?.map(({ target, op }) => `${op} ${target}`)).toEqual([
      'advantage roll.init',
      'advantage roll.skill.athletics',
    ]);
  });

  it('gives golden D exhaustion 2: every d20 test −4, speed −10', () => {
    const computed = compute(d, index, fifthEditionModule);
    expect(computed.entities.map((had) => had.entity.id)).toEqual([
      ...GATHERED_B,
      ...ITEMS_B,
      'srd-2024:condition/exhaustion',
    ]);
    expect(computed.pendingChoices).toEqual([]);
    expect(computed.warnings).toEqual([]);
    expect(computed.values['conditions.exhaustion.level']).toBe(2);
    expect(computed.values['d20.all.bonus']).toBe(-4);
    // Speed 20 = 30 − 10.
    expect(computed.values['speed.all.bonus']).toBe(-10);
    // Golden B has none of it.
    const without = compute(b, index, fifthEditionModule).values;
    expect([without['d20.all.bonus'], without['speed.all.bonus']]).toEqual([0, 0]);
  });

  it('gathers golden C (2024): two classes, level 6', () => {
    const computed = compute(c, index, fifthEditionModule);
    expect(computed.entities.map((had) => [had.entity.id, had.level])).toEqual([
      ['srd-2024:class/wizard', 3],
      ['srd-2024:class/paladin', 3],
    ]);
    expect(computed.values.level).toBe(6);
    expect(computed.warnings).toEqual([]);
    // ENG-13: the paladin, a later class, gives its multiclass grants, not its own skills.
    expect(computed.pendingChoices).toEqual([]);
  });
});
