import { type Computed, type ContentIndex, compute } from '@grimoire/engine';
import { CHARACTER_SCHEMA_VERSION, type EntityId } from '@grimoire/schema';
import { DEFAULT_HOUSE_RULES, type FifthEditionCharacter } from './character';
import type { LevelHitPoints } from './combat';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';
import { rulesOf } from './rulesets';
import { COINS, FIFTH_EDITION_SCHEMA_VERSION, FIFTH_EDITION_SYSTEM } from './system';

// SHEET-27: the character the manual form makes (SPEC §7.4, manual mode): what the person typed,
// and nothing chosen for them. Every grant's pick stays a pending choice; the house rules are
// `DEFAULT_HOUSE_RULES`, the bonus and language sides the edition's (ENG-19, ENG-56). Each level's
// hit points are written as both SRDs give them without a roll: the first class's level 1 at the
// die's maximum, every other level at the fixed value (SHEET-27 §8). A level typed by hand has no
// XP behind it, so advancement is by milestone until the person changes it (phase 4's level-up).
// SHEET-28: the starting inventory is the items the form lists, each as typed and none attuned.
// The hit points start full: the maximum is computed, then written as the current hit points.

/** A class the manual form names, with its level and, when picked, its subclass. */
export interface ManualClass {
  readonly id: EntityId;
  readonly level: number;
  readonly subclass?: EntityId;
}

/** An item the manual form puts in the starting inventory: one row, with its quantity. */
export interface ManualItem {
  /** The row's id: the app makes it, as it makes the character's. */
  readonly uid: string;
  readonly itemId: EntityId;
  readonly qty: number;
  readonly equipped: boolean;
}

/** What the manual form asks for. `id` and `at` come from the app: the module makes no ids. */
export interface ManualCharacterAsk {
  readonly id: string;
  /** When it is made: the ISO time stored as both `createdAt` and `updatedAt`. */
  readonly at: string;
  readonly ruleset: FifthEditionCharacter['ruleset'];
  readonly allowMixedRulesets: boolean;
  readonly name: string;
  /** The active packs, in order. */
  readonly packs: readonly string[];
  readonly species?: EntityId;
  readonly background?: EntityId;
  /** The classes in the order taken: the first is the first class. */
  readonly classes: readonly ManualClass[];
  /** Stat key → base score, any whole number (SPEC §7.4). */
  readonly scores: Readonly<Record<string, number>>;
  /** The starting inventory, in the order added; nothing is attuned (SHEET-28). */
  readonly items: readonly ManualItem[];
}

/** The method key the manual form's scores are stored with: typed, not made by a method. */
export const MANUAL_SCORES_METHOD = 'manual';

/** Each level's hit points with no roll: the first class's level 1 at the maximum, the rest fixed. */
export function manualHitPoints(classes: readonly ManualClass[]): LevelHitPoints[][] {
  return classes.map(({ level }, taken) =>
    Array.from(
      { length: level },
      (_, at): LevelHitPoints => (taken === 0 && at === 0 ? 'max' : 'avg'),
    ),
  );
}

/** The character `ask` describes, at 0 hit points: `madeByHand` fills them. */
export function manualCharacter(ask: ManualCharacterAsk): FifthEditionCharacter {
  const rules = rulesOf(ask);
  const hp = manualHitPoints(ask.classes);
  return {
    id: ask.id,
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    rev: 0,
    createdAt: ask.at,
    updatedAt: ask.at,
    system: FIFTH_EDITION_SYSTEM,
    systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
    ruleset: ask.ruleset,
    allowMixedRulesets: ask.allowMixedRulesets,
    kind: 'pc',
    mode: 'manual',
    name: ask.name,
    packs: [...ask.packs],
    abilities: { base: { ...ask.scores } },
    choices: {},
    state: { resources: {}, conditions: [], toggles: {} },
    overrides: [],
    localEntities: [],
    notes: {},
    systemData: {
      houseRules: {
        ...DEFAULT_HOUSE_RULES,
        hitPointMethods: [...DEFAULT_HOUSE_RULES.hitPointMethods],
      },
      abilities: { method: MANUAL_SCORES_METHOD, bonusSource: rules.abilityBonusSource },
      languageSource: rules.languageSource,
      advancement: { mode: 'milestone', xp: 0 },
      ...(ask.species !== undefined && { species: { id: ask.species } }),
      ...(ask.background !== undefined && { background: { id: ask.background } }),
      classes: ask.classes.map(({ id, level, subclass }, taken) => ({
        id,
        ...(subclass !== undefined && { subclass }),
        level,
        hp: hp[taken] ?? [],
      })),
      feats: [],
      spells: {},
      inventory: ask.items.map(({ uid, itemId, qty, equipped }) => ({
        uid,
        itemId,
        qty,
        equipped,
        attuned: false,
      })),
      currency: Object.fromEntries(COINS.map((coin) => [coin, 0])) as Record<
        (typeof COINS)[number],
        number
      >,
      state: {
        hp: { current: 0, temp: 0 },
        hitDiceSpent: {},
        slotsSpent: {},
        pactSlotsSpent: 0,
        deathSaves: { success: 0, failure: 0, stable: false },
        inspiration: 0,
      },
    },
  };
}

/** A character the manual form made, and what `compute()` gives for it. */
export interface MadeByHand {
  character: FifthEditionCharacter;
  computed: Computed<FifthEditionEntity>;
}

/** The character `ask` describes, its hit points at their computed maximum, and its numbers. */
export function madeByHand(
  ask: ManualCharacterAsk,
  index: ContentIndex<FifthEditionEntity>,
): MadeByHand {
  const drafted = manualCharacter(ask);
  const max = compute(drafted, index, fifthEditionModule).values['hp.max'];
  const current = typeof max === 'number' && Number.isInteger(max) && max > 0 ? max : 0;
  const { systemData } = drafted;
  const character: FifthEditionCharacter = {
    ...drafted,
    systemData: {
      ...systemData,
      state: { ...systemData.state, hp: { ...systemData.state.hp, current } },
    },
  };
  return { character, computed: compute(character, index, fifthEditionModule) };
}
