// ENG-15: what differs between fifth edition's two editions (SPEC §6.3), as data. Each edition's
// file gives every field; the module reads them through `rulesOf`, never by testing the edition.
// ENG-19 adds the other differences of SPEC §6.3's table.

/** A rule that differs between the editions, each edition's value. */
export interface EditionRules {
  /**
   * How half of a half caster's class levels rounds in the multiclass caster level (ENG-15 §8):
   * a paladin's or a ranger's.
   */
  readonly halfCasterRounding: 'down' | 'up';
  /**
   * ENG-16: whether a weapon's damage with no dice to roll (a Blowgun's 1) adds the attack's
   * ability modifier (ENG-16 §8).
   */
  readonly fixedDamageModifier: boolean;
}
