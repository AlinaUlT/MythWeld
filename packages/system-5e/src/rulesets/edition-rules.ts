import type { FifthEditionData } from '../character';

// ENG-15: what differs between fifth edition's two editions (SPEC §6.3), as data. Each edition's
// file gives every field; the module reads them through `rulesOf`, never by testing the edition.
// ENG-19: every difference SPEC §6.3's table and the closed tickets name. Each field holds a
// rule's value; the ticket that computes with it reads it. The rows of SPEC §6.3 that are data
// have no field here: a class's subclass level is its `subclassLevel`; exhaustion is each SRD's
// own condition entity, its effects with `when`; the origin feat is a background's grant; feat
// categories are a feat's `category`; weapon mastery is ENG-16's; spell preparation ENG-15's.

/** A word the screens use where the editions differ: the last part of an i18n key. */
export interface EditionTerms {
  /** A species (`species`): a race in 2014. */
  readonly species: 'race' | 'species';
  /** A lineage (`lineage`): a subrace in 2014. */
  readonly lineage: 'subrace' | 'lineage';
  /** Inspiration: Heroic Inspiration in 2024. */
  readonly inspiration: 'inspiration' | 'heroicInspiration';
}

/**
 * Who has disadvantage on attack rolls with a Heavy weapon (ENG-19 §8): a creature of one of
 * `sizes`, or one whose score in the weapon kind's stat (`ATTACK_STATS`) is below `min`.
 */
export type HeavyWeaponRule =
  | { readonly by: 'size'; readonly sizes: readonly string[] }
  | { readonly by: 'score'; readonly min: number };

/**
 * ENG-46: what an armor or a shield worn without its training does (ENG-46 §8): disadvantage on
 * every d20 test of Strength or Dexterity, or no spells.
 */
export type UntrainedPenalty = 'disadvantage' | 'noSpells';

/** What a shield worn without its training does: an armor's penalties, or none of its AC. */
export type UntrainedShieldPenalty = UntrainedPenalty | 'noArmorClass';

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
  /** The words for a species, a lineage and inspiration. */
  readonly terms: EditionTerms;
  /** Whose ability score increases a new character takes: its species' or its background's. */
  readonly abilityBonusSource: Exclude<
    FifthEditionData['abilities']['bonusSource'],
    'both' | 'neither'
  >;
  /**
   * ENG-56: the side of the origin whose `language` grants are the edition's starting languages:
   * the species with its lineages, or the background. Also the place a new character takes them
   * from when a mix gives them from both (`systemData.languageSource`).
   */
  readonly languageSource: FifthEditionData['languageSource'];
  /**
   * Inspiration: the most the rules let a character hold, shown beside the house rule's
   * `inspirationMax` (ADR 009 item 5), and what spending it does: advantage on a d20 test, or a
   * die rolled again.
   */
  readonly inspiration: { readonly max: number; readonly use: 'advantage' | 'reroll' };
  /** The share of its hit dice a long rest gives back: rounded down, at least 1 die. */
  readonly longRestHitDice: number;
  /** The fewest hit points one hit die spent gives. */
  readonly hitDieMinimum: number;
  /** Who has disadvantage with a Heavy weapon. */
  readonly heavyWeapon: HeavyWeaponRule;
  /**
   * ENG-20: the highest DC of the Constitution save that keeps concentration after damage (the
   * higher of 10 and half the damage); `null` when the edition sets none (ENG-20 §8).
   */
  readonly concentrationDcMax: number | null;
  /** ENG-21: the fewest hit points a short rest starts with (ENG-21 §8). */
  readonly shortRestMinHp: number;
  /**
   * ENG-21: whether a long rest ends concentration: the edition's sleep is the Unconscious
   * condition (ENG-21 §8).
   */
  readonly longRestEndsConcentration: boolean;
  /**
   * ENG-65: whether damage that would drop a creature to 0 hit points with a melee attack may
   * leave it at 1, knocked out (`applyDamage`'s `knockOut`). Without it, knocking out is damage to
   * 0, then `stabilize` (ENG-65 §8).
   */
  readonly knockOutToOneHp: boolean;
  /** ENG-46: the penalties of an armor, and of a shield, worn without its training. */
  readonly untrained: {
    readonly armor: readonly UntrainedPenalty[];
    readonly shield: readonly UntrainedShieldPenalty[];
  };
}
