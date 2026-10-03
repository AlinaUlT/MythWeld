import type { EditionRules } from './edition-rules';

// ENG-15: the 2024 rules (SRD 5.2.1) where the editions differ (SPEC §6.3). Each value is checked
// against SRD 5.2.1 in the §8 of the ticket that adds it.

/** The 2024 rules. */
export const RULES_2024: EditionRules = {
  // "Half your levels (round up) in the Paladin and Ranger classes" (Multiclassing, ENG-15 §8).
  halfCasterRounding: 'up',
  // "you don't add your ability modifier to a fixed damage amount that doesn't use a roll, such as
  // the damage of a Blowgun" (Damage Rolls, ENG-16 §8).
  fixedDamageModifier: false,
  // Species and lineages; Heroic Inspiration (ENG-19 §8).
  terms: { species: 'species', lineage: 'lineage', inspiration: 'heroicInspiration' },
  // "adjust them according to your background" (Step 3: Ability Scores, ENG-19 §8).
  abilityBonusSource: 'background',
  // "Common plus two languages", chosen in the origin step (Choose Languages); in data, each 2024
  // background gives them, as dnd5e's do (ENG-56 §8).
  languageSource: 'background',
  // "If you gain Heroic Inspiration but already have it, it's lost"; "you can expend it to reroll
  // any die immediately after rolling it" (Heroic Inspiration, ENG-19 §8).
  inspiration: { max: 1, use: 'reroll' },
  // "You regain all lost Hit Points and all spent Hit Point Dice" (Long Rest, ENG-19 §8).
  longRestHitDice: 1,
  // "You regain Hit Points equal to the total (minimum of 1 Hit Point)" (Short Rest, ENG-19 §8).
  hitDieMinimum: 1,
  // "if it's a Melee weapon and your Strength score isn't at least 13 or if it's a Ranged weapon
  // and your Dexterity score isn't at least 13" (Heavy, ENG-19 §8).
  heavyWeapon: { by: 'score', min: 13 },
  // "The DC equals 10 or half the damage taken (round down), whichever number is higher, up to a
  // maximum DC of 30" (Concentration, ENG-20 §8).
  concentrationDcMax: 30,
  // "To start a Short Rest, you must have at least 1 Hit Point" (Short Rest, ENG-21 §8).
  shortRestMinHp: 1,
  // "During sleep, you have the Unconscious condition", which is Incapacitated, and "Your
  // Concentration ends if you have the Incapacitated condition" (Long Rest, ENG-21 §8).
  longRestEndsConcentration: true,
  // "If you wear Light, Medium, or Heavy armor and lack training with it, you have Disadvantage on
  // any D20 Test that involves Strength or Dexterity, and you can't cast spells"; "You gain the
  // Armor Class benefit of a Shield only if you have training with it" (Armor Training, ENG-46 §8).
  untrained: { armor: ['disadvantage', 'noSpells'], shield: ['noArmorClass'] },
};
