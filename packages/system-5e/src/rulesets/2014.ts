import type { EditionRules } from './edition-rules';

// ENG-15: the 2014 rules (SRD 5.1) where the editions differ (SPEC §6.3). Each value is checked
// against SRD 5.1 in the §8 of the ticket that adds it.

/** The 2014 rules. */
export const RULES_2014: EditionRules = {
  // "half your levels (rounded down) in the paladin and ranger classes" (Multiclassing, ENG-15 §8).
  halfCasterRounding: 'down',
  // "When attacking with a weapon, you add your ability modifier … to the damage", with no
  // exception (Damage Rolls, ENG-16 §8).
  fixedDamageModifier: true,
  // Races and subraces (ENG-19 §8).
  terms: { species: 'race', lineage: 'subrace', inspiration: 'inspiration' },
  // A race's "Ability Score Increase"; no background has one (ENG-19 §8).
  abilityBonusSource: 'species',
  // "You either have inspiration or you don't"; "Spending your inspiration gives you advantage on
  // that roll" (Inspiration, ENG-19 §8).
  inspiration: { max: 1, use: 'advantage' },
  // "up to a number of dice equal to half of the character's total number of them (minimum of one
  // die)" (Long Rest, ENG-19 §8).
  longRestHitDice: 0.5,
  // "The character regains hit points equal to the total", with no minimum (Short Rest).
  hitDieMinimum: 0,
  // "Small creatures have disadvantage on attack rolls with heavy weapons" (Heavy, ENG-19 §8).
  heavyWeapon: { by: 'size', sizes: ['small'] },
  // "The DC equals 10 or half the damage you take, whichever number is higher", with no maximum
  // (Concentration, ENG-20 §8).
  concentrationDcMax: null,
  // A short rest's text names no hit points to start with (Short Rest, ENG-21 §8).
  shortRestMinHp: 0,
  // A long rest is time the character "sleeps or performs light activity", with no condition
  // (Long Rest, ENG-21 §8).
  longRestEndsConcentration: false,
};
