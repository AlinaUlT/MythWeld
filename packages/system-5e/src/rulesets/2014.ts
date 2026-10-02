import type { EditionRules } from './edition-rules';

// ENG-15: the 2014 rules (SRD 5.1) where the editions differ (SPEC §6.3). Each value is checked
// against SRD 5.1 in the §8 of the ticket that adds it.

/** The 2014 rules. */
export const RULES_2014: EditionRules = {
  // "half your levels (rounded down) in the paladin and ranger classes" (Multiclassing, ENG-15 §8).
  halfCasterRounding: 'down',
};
