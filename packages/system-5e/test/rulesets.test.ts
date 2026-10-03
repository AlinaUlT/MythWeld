import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_RULES,
  EDITION_RULES,
  houseRulesSchema,
  openFifthEditionCharacter,
  RULES_2014,
  RULES_2024,
  rulesOf,
  rulesOfEntity,
} from '../src/index.ts';
import { goldenA, goldenB } from './golden/index.ts';

// ENG-19: the edition files hold every 2014/2024 difference. Each expected value is the SRD's,
// quoted in ENG-19 §8, never copied from a run. ENG-20 adds the concentration DC's maximum (ENG-20
// §8); ENG-21 the short rest's hit points and the long rest's concentration (ENG-21 §8);
// ENG-46 the penalties of armor worn without training (ENG-46 §8); ENG-56 the place of the starting
// languages (ENG-56 §8); ENG-65 knocking out at 1 hit point (ENG-65 §8).

describe('ENG-19 the edition files', () => {
  it('give the 2014 rules: SRD 5.1', () => {
    expect(RULES_2014).toEqual({
      halfCasterRounding: 'down',
      fixedDamageModifier: true,
      terms: { species: 'race', lineage: 'subrace', inspiration: 'inspiration' },
      abilityBonusSource: 'species',
      languageSource: 'species',
      inspiration: { max: 1, use: 'advantage' },
      longRestHitDice: 0.5,
      hitDieMinimum: 0,
      heavyWeapon: { by: 'size', sizes: ['small'] },
      concentrationDcMax: null,
      shortRestMinHp: 0,
      longRestEndsConcentration: false,
      knockOutToOneHp: false,
      untrained: { armor: ['disadvantage', 'noSpells'], shield: ['disadvantage', 'noSpells'] },
    });
  });

  it('give the 2024 rules: SRD 5.2.1', () => {
    expect(RULES_2024).toEqual({
      halfCasterRounding: 'up',
      fixedDamageModifier: false,
      terms: { species: 'species', lineage: 'lineage', inspiration: 'heroicInspiration' },
      abilityBonusSource: 'background',
      languageSource: 'background',
      inspiration: { max: 1, use: 'reroll' },
      longRestHitDice: 1,
      hitDieMinimum: 1,
      heavyWeapon: { by: 'score', min: 13 },
      concentrationDcMax: 30,
      shortRestMinHp: 1,
      longRestEndsConcentration: true,
      knockOutToOneHp: true,
      untrained: { armor: ['disadvantage', 'noSpells'], shield: ['noArmorClass'] },
    });
  });

  it("are found by the character's rules base", () => {
    expect(rulesOf(goldenA)).toBe(RULES_2014);
    expect(rulesOf(goldenB)).toBe(RULES_2024);
    expect(Object.keys(EDITION_RULES)).toEqual(['2014', '2024']);
  });

  it("are found for an entity by its edition, or by the character's for `any` (ENG-56)", () => {
    for (const character of [goldenA, goldenB]) {
      expect(rulesOfEntity({ ruleset: '2014' }, character)).toBe(RULES_2014);
      expect(rulesOfEntity({ ruleset: '2024' }, character)).toBe(RULES_2024);
    }
    expect(rulesOfEntity({ ruleset: 'any' }, goldenA)).toBe(RULES_2014);
    expect(rulesOfEntity({ ruleset: 'any' }, goldenB)).toBe(RULES_2024);
  });

  it('give the house rules a new character is written with, the same in both editions', () => {
    expect(DEFAULT_HOUSE_RULES).toEqual({
      hitPointMethods: ['roll', 'avg'],
      abilityMax: 20,
      feats: 'own',
      multiclass: true,
      encumbrance: 'simple',
      skillAbilitySwap: false,
      inspirationMax: 3,
    });
    expect(houseRulesSchema.safeParse(DEFAULT_HOUSE_RULES).success).toBe(true);
  });

  it("let a character hold the owner's 3 inspiration, not 4, above the SRDs' 1", () => {
    const withInspiration = (inspiration: number) =>
      openFifthEditionCharacter({
        ...goldenB,
        systemData: {
          ...goldenB.systemData,
          houseRules: DEFAULT_HOUSE_RULES,
          state: { ...goldenB.systemData.state, inspiration },
        },
      });
    expect(withInspiration(3).ok).toBe(true);
    const four = withInspiration(4);
    expect(four.ok).toBe(false);
    expect(!four.ok && four.message).toContain('systemData.state.inspiration');
    expect(DEFAULT_HOUSE_RULES.inspirationMax).toBeGreaterThan(RULES_2024.inspiration.max);
  });
});
