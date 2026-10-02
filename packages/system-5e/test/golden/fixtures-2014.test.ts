import { compute, loadContentIndex, parseFormula, parseRoll } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionEntity,
  type FifthEditionPack,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../../src/index.ts';
import {
  formulasOf,
  idsNamedBy,
  idsNamedByCharacter,
  keysNamedBy,
  opened,
  standingIn,
} from './checks.ts';
import { goldenA, goldenC2014, srd2014 } from './index.ts';

// ENG-09: the 2014 golden data is whole, agrees with itself, and gives what SPEC §6.7 says golden
// A has. Expected counts are ENG-09 §8's; golden A's scores and sources are SPEC §6.7's.

const FROM_CURRENT = { schemaVersion: 1, systemSchemaVersion: 1 };

const pack: FifthEditionPack = opened(openFifthEditionPack(srd2014));
const entities: readonly FifthEditionEntity[] = pack.entities;

const { index, refused, warnings } = loadContentIndex(FIFTH_EDITION_SYSTEM, [pack]);

// Gathering and the base phase are under test, through fifth edition's module (ENG-13), with
// `hp.max.bonus` from 0, the target of Dwarven Toughness, as a stand-in (ENG-14 gives it).

const a = opened(openFifthEditionCharacter(goldenA));
const c = opened(openFifthEditionCharacter(goldenC2014));

describe('ENG-09 2014 fixtures', () => {
  it('opens and loads the pack as a file', () => {
    expect(openFifthEditionPack(srd2014)).toEqual({ ok: true, value: srd2014, from: FROM_CURRENT });
    expect(refused).toEqual([]);
    expect(warnings).toEqual([]);
    expect(index.entities).toHaveLength(66);
  });

  it('holds the counts the SRD has', () => {
    const counts: Record<string, number> = {};
    for (const entity of entities) counts[entity.type] = (counts[entity.type] ?? 0) + 1;
    expect(counts).toEqual({
      ability: 6,
      skill: 18,
      language: 16,
      species: 1,
      lineage: 1,
      feature: 12,
      background: 1,
      class: 3,
      subclass: 1,
      spell: 2,
      item: 3,
      damageType: 1,
      weaponProperty: 1,
    });
    expect(entities.every((entity) => entity.ruleset === '2014')).toBe(true);
    expect(entities.every((entity) => entity.source.pack === 'srd-2014')).toBe(true);
  });

  it('names only its own entities', () => {
    const missing = entities.flatMap((entity) =>
      idsNamedBy(entity)
        .filter((id) => !index.get(id).ok)
        .map((id) => `${id} (named by ${entity.id})`),
    );
    expect(missing).toEqual([]);
    expect(entities.flatMap(idsNamedBy)).toHaveLength(15);
  });

  it('names only its own stats, skills, languages, damage types and properties', () => {
    const missing = entities.flatMap((entity) =>
      keysNamedBy(entity)
        .filter((named) => {
          const [type = '', key = ''] = named.split(':');
          return index.withKey(type, key).length === 0;
        })
        .map((named) => `${named} (named by ${entity.id})`),
    );
    expect(missing).toEqual([]);
    expect(entities.flatMap(keysNamedBy)).toHaveLength(60);
  });

  it('holds formulas that parse', () => {
    const formulas = entities.flatMap((entity) => formulasOf(entity).formulas);
    const rolls = entities.flatMap((entity) => formulasOf(entity).rolls);
    expect(formulas).toEqual([
      '@level',
      'max(1, @abilities.wis.mod + @classes.cleric.level)',
      'max(1, @abilities.int.mod + @classes.wizard.level)',
      'max(1, @abilities.cha.mod + floor(@classes.paladin.level / 2))',
      '@equipped',
    ]);
    expect(rolls).toEqual(['1d8', '1d10']);
    expect(formulas.filter((formula) => !parseFormula(formula).ok)).toEqual([]);
    expect(rolls.filter((roll) => !parseRoll(roll).ok)).toEqual([]);
  });

  it('opens both characters, each naming only the pack', () => {
    expect(openFifthEditionCharacter(goldenA)).toEqual({
      ok: true,
      value: goldenA,
      from: FROM_CURRENT,
    });
    expect(openFifthEditionCharacter(goldenC2014)).toEqual({
      ok: true,
      value: goldenC2014,
      from: FROM_CURRENT,
    });
    for (const character of [a, c]) {
      expect(idsNamedByCharacter(character).filter((id) => !index.get(id).ok)).toEqual([]);
    }
  });

  it('gathers golden A whole, every choice made', () => {
    const computed = compute(a, index, standingIn);
    expect(computed.entities.map((had) => had.entity.id)).toEqual([
      'srd-2014:species/dwarf',
      'srd-2014:feature/darkvision',
      'srd-2014:feature/dwarven-resilience',
      'srd-2014:feature/stonecunning',
      'srd-2014:feature/dwarven-combat-training',
      'srd-2014:feature/tool-proficiency',
      'srd-2014:lineage/hill-dwarf',
      'srd-2014:feature/dwarven-toughness',
      'srd-2014:background/acolyte',
      'srd-2014:feature/shelter-of-the-faithful',
      'srd-2014:class/cleric',
      'srd-2014:feature/spellcasting-cleric',
      'srd-2014:feature/divine-domain',
      'srd-2014:feature/domain-spells-1',
      'srd-2014:subclass/life',
      'srd-2014:feature/bonus-proficiency',
      'srd-2014:feature/disciple-of-life',
      // ENG-14: the equipped items, in inventory order.
      'srd-2014:item/chain-mail',
      'srd-2014:item/shield',
      'srd-2014:item/warhammer',
    ]);
    expect(computed.pendingChoices).toEqual([]);
    expect(computed.warnings).toEqual([]);
    expect(computed.values.level).toBe(1);
    // SPEC §6.7: hit points 12 = 8 + 3 + 1, the 1 from Dwarven Toughness.
    expect(computed.values['hp.max.bonus']).toBe(1);
  });

  it("gives golden A's proficiencies from the sources SPEC §6.7 names", () => {
    const given = compute(a, index, standingIn).proficiencies.map(
      ({ category, key, from }) => `${category} ${key} ← ${from}`,
    );
    expect(given).toEqual([
      'language common ← srd-2014:species/dwarf#languages',
      'language dwarvish ← srd-2014:species/dwarf#languages',
      'weapon battleaxe ← srd-2014:feature/dwarven-combat-training#weapons',
      'weapon handaxe ← srd-2014:feature/dwarven-combat-training#weapons',
      'weapon lightHammer ← srd-2014:feature/dwarven-combat-training#weapons',
      // SPEC §6.7: the warhammer's proficiency comes from the species.
      'weapon warhammer ← srd-2014:feature/dwarven-combat-training#weapons',
      'tool masonsTools ← srd-2014:feature/tool-proficiency#tools',
      // Insight and Religion are the Acolyte's.
      'skill insight ← srd-2014:background/acolyte#skills',
      'skill religion ← srd-2014:background/acolyte#skills',
      'language celestial ← srd-2014:background/acolyte#languages',
      'language elvish ← srd-2014:background/acolyte#languages',
      'armor light ← srd-2014:class/cleric#armor',
      'armor medium ← srd-2014:class/cleric#armor',
      'armor shield ← srd-2014:class/cleric#armor',
      'weapon simple ← srd-2014:class/cleric#weapons',
      // Medicine and Persuasion are the cleric's.
      'skill medicine ← srd-2014:class/cleric#skills',
      'skill persuasion ← srd-2014:class/cleric#skills',
      // Heavy armor is the Life domain's.
      'armor heavy ← srd-2014:feature/bonus-proficiency#armor',
    ]);
  });

  it("gives golden A's scores: SPEC §6.7", () => {
    const { values, breakdown } = compute(a, index, standingIn);
    const scores = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(
      (key) => values[`abilities.${key}.score`],
    );
    expect(scores).toEqual([13, 10, 16, 8, 16, 12]);
    const increases = (key: string) =>
      (breakdown[`abilities.${key}.score`] ?? []).map((step) =>
        step.kind === 'grant' ? `${step.part} ${step.change}` : `${step.kind} ${step.change}`,
      );
    expect(increases('con')).toEqual(['base 14', 'srd-2014:species/dwarf#ability-scores 2']);
    expect(increases('wis')).toEqual(['base 15', 'srd-2014:lineage/hill-dwarf#ability-scores 1']);
  });

  it('gathers golden C (2014): two classes, level 6', () => {
    const computed = compute(c, index, standingIn);
    expect(computed.entities.map((had) => [had.entity.id, had.level])).toEqual([
      ['srd-2014:class/wizard', 3],
      ['srd-2014:class/paladin', 3],
    ]);
    expect(computed.values.level).toBe(6);
    expect(computed.warnings).toEqual([]);
    // ENG-13: the paladin, a later class, gives its multiclass grants, not its own skills.
    expect(computed.pendingChoices).toEqual([]);
  });
});
