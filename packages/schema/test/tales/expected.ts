import type { EntityId, EntityPartId } from '@grimoire/schema';

// ENG-27: what `compute()` must give for each Tales character, worked out by hand from Tales'
// rules (`system.ts`) and the data (`content.ts`, `characters.ts`). Test data, not goldens: when a
// rule of Tales changes, these are worked out again by hand, never copied from a run.

export interface TalesExpected {
  /** The entities that give the character grants or effects: its calling, talents, conditions. */
  entities: readonly EntityId[];
  /** Computed path → value, after every phase, overrides included. */
  values: Readonly<Record<string, number>>;
  /** The choices left unmade, as `<entityId>#<grantId>`. */
  pendingChoices: readonly EntityPartId[];
  /** The ids the character names that no pack and none of its own entities have. */
  missing: readonly EntityId[];
  /** The entities the character has whose prerequisites it does not meet. */
  unmetPrerequisites: readonly EntityId[];
}

/**
 * Ash: first age, level 2. The warden's `pick-talent` (at level 2) gives Night Warden, which
 * grants Quick Step. Toggles: none on. Weary at level 1: `skills.all.bonus` is -1.
 */
export const ashExpected: TalesExpected = {
  entities: [
    'tales-core:calling/warden',
    'tales-core:talent/night-warden',
    'tales-core:talent/quick-step',
    'tales-core:condition/weary',
  ],
  values: {
    level: 2,
    'abilities.grit.score': 7, // base 6 + warden `sturdy` 1; `glow` is off
    'abilities.grit.mod': 3, // floor(7 / 2)
    'abilities.grit.max': 10, // Tales' default
    'abilities.wits.score': 5, // base 5
    'abilities.wits.mod': 2, // floor(5 / 2)
    'abilities.wits.max': 10,
    'abilities.nerve.score': 4, // base 4
    'abilities.nerve.mod': 1, // 4 - 3, its own formula
    'abilities.nerve.max': 8, // its own `defaultMax`
    'skills.climb.prof': 1, // warden `climber`, no level
    'skills.climb.total': 6, // first-age climb on grit: 3 + 2 × 1 + `nimble` 2 (wits mod) - 1
    'skills.sneak.prof': 1, // warden `pick-knack`: sneak
    'skills.sneak.total': 4, // wits 2 + 2 × 1 + `shadow` 1 - 1
    'skills.steady.prof': 0,
    'skills.steady.total': 0, // nerve 1 + 2 × 0 - 1
    'skills.steady.passive': 5, // 5 + 0
    'resources.luck.max': 2, // nerve mod 1 + 1
  },
  pendingChoices: [],
  missing: [],
  unmetPrerequisites: [],
};

/**
 * Brook: second age, level 3. The seeker's `knacks` choice is unmade, so every knack level is 0.
 * The `blessing` boon gives nothing. Lost has no effect, so `skills.all.bonus` is 0. Iron Will
 * applies although its prerequisites are unmet: they warn, never block.
 */
export const brookExpected: TalesExpected = {
  entities: [
    'tales-core:calling/seeker',
    'character:talent/lucky-charm',
    'tales-core:talent/iron-will',
    'tales-core:condition/lost',
  ],
  values: {
    level: 3,
    'abilities.grit.score': 6, // base 5 + `charm` 1, toggled on
    'abilities.grit.mod': 3, // floor(6 / 2)
    'abilities.grit.max': 10,
    'abilities.wits.score': 8, // base 6 + seeker `keen` 2
    'abilities.wits.mod': 4, // floor(8 / 2)
    'abilities.wits.max': 10,
    'abilities.nerve.score': 8, // base 9, above its maximum 8
    'abilities.nerve.mod': 5, // 8 - 3
    'abilities.nerve.max': 8,
    'skills.climb.prof': 0,
    'skills.climb.total': 4, // second-age climb on wits: 4 + 2 × 0
    'skills.sneak.prof': 0,
    'skills.sneak.total': 9, // the override; by the rules wits 4 + 2 × 0 = 4
    'skills.steady.prof': 0,
    'skills.steady.total': 7, // nerve 5 + 2 × 0 + `will` 2
    'skills.steady.passive': 12, // 5 + 7
    'resources.focus.max': 6, // level 3 × 2
  },
  pendingChoices: ['tales-core:calling/seeker#knacks'],
  missing: ['tales-core:talent/gone-missing'],
  unmetPrerequisites: ['tales-core:talent/iron-will'],
};
