import { type ContentIndex, finderOf } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import { type BonusSide, bonusGivers } from './ability-bonus';
import type { FifthEditionCharacter, FifthEditionData } from './character';
import { characterLevel } from './classes';
import type { FifthEditionEntity } from './entity-types';
import { ruledGrants } from './module';
import { reached } from './origin';

// SHEET-29: what the manual form's window for ability score increases from two editions shows (BRIEF
// P3 step 6, ADR 017, board V3-Conflict): for each side, the species with its lineages and the
// background, which entities give increases and what each gives. A grant gives fixed amounts
// (+2 to Constitution) or a pattern to spread over a list of stats (+2 and +1, or +1 +1 +1 over
// three). Nothing is shown unless both sides give some: with one side, there is no choice (ENG-35).
// The warning itself is `abilityBonusConflict` (ENG-68); this reads the entities it names, and
// every side's givers, not only the first.

/** The stats a grant raises by a fixed amount, with the amount; and the patterns it may spread. */
export interface BonusGiverShown {
  id: string;
  name: L10n;
  ruleset: string;
  /** Stat key → the fixed increase, in the order the grant lists the stats. */
  fixed: { stat: string; amount: number }[];
  /** Each `distribute` grant: the stats it may go to, and the numbers one pattern spreads. */
  spread: { from: readonly string[]; patterns: readonly (readonly number[])[] }[];
}

/** The two sides of the window, and what the character takes now. */
export interface AbilityBonusShown {
  /** The side of the origin each giver is on. */
  sides: Record<BonusSide, BonusGiverShown[]>;
  /** The stored choice: `species`, `background`, `both` or `neither` (ADR 017). */
  source: FifthEditionData['abilities']['bonusSource'];
}

/**
 * The window's content, or `undefined` when the character has no conflict: one side, or neither,
 * gives ability score increases at its level.
 */
export function manualAbilityBonus(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
): AbilityBonusShown | undefined {
  const find = finderOf(character, index);
  const grantsBy = (entity: FifthEditionEntity) => ruledGrants(character, entity);
  const givers = bonusGivers(character, find, grantsBy);
  if (givers.species.length === 0 || givers.background.length === 0) return undefined;
  const level = characterLevel(character);
  const shown = (entity: FifthEditionEntity): BonusGiverShown => {
    const given = grantsBy(entity).filter((grant) => reached(grant, level));
    return {
      id: entity.id,
      name: entity.name,
      ruleset: entity.ruleset,
      fixed: given.flatMap((grant) =>
        grant.kind === 'abilityScore' && grant.mode === 'fixed'
          ? Object.entries(grant.values).map(([stat, amount]) => ({ stat, amount }))
          : [],
      ),
      spread: given.flatMap((grant) =>
        grant.kind === 'abilityScore' && grant.mode === 'distribute'
          ? [{ from: grant.from, patterns: grant.patterns }]
          : [],
      ),
    };
  };
  return {
    sides: { species: givers.species.map(shown), background: givers.background.map(shown) },
    source: character.systemData.abilities.bonusSource,
  };
}
