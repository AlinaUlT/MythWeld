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
};
