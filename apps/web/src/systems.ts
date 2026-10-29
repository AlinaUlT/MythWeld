// SHEET-10: the system modules the app carries, by system id (ADR 004). A stored file names its
// system, and the app finds that module's opener here; no other code asks which system it is.
// SHEET-09: a pack file names its system too, and opens through that module's pack opener.
// SHEET-24: what My characters names under a character's name is its module's too.
// SHEET-27: the manual form makes a character through its system's maker, with its rules bases.
// SHEET-30: so is what the sheet's header and dock read, and the module `compute()` runs.
import type { Computed, ContentIndex, LogStamp, SystemModule } from '@grimoire/engine';
import type { LogEntry, Opened } from '@grimoire/schema';
import {
  attackOutcome,
  criticalDamage,
  d20Formula,
  EDITION_RULES,
  type EditionTerms,
  FIFTH_EDITION_HEADER_NUMBERS,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type FifthEditionPack,
  fifthEditionCasting,
  fifthEditionClassLine,
  fifthEditionHitPoints,
  fifthEditionListLine,
  fifthEditionModule,
  type HeaderCasting,
  type HeaderHitPoints,
  type HeaderNumber,
  type ListLinePart,
  MAX_LEVEL,
  type MadeByHand,
  type ManualCharacterAsk,
  madeByHand,
  modeSigns,
  openFifthEditionCharacter,
  openFifthEditionPack,
  rollInitiative,
  rollModeOf,
  rollTestOf,
  rulesOf,
  situationalModes,
  spendInspiration,
} from '@grimoire/system-5e';

/** A character of any system the app carries. */
export type AppCharacter = FifthEditionCharacter;

/** A content pack of any system the app carries. */
export type AppPack = FifthEditionPack;

/** What `compute()` gives for a character of any system the app carries. */
export type AppComputed = Computed<FifthEditionEntity>;

/** Opens a stored character of one system through its migration frame (SPEC §5.8). */
export type CharacterOpener = (file: unknown) => Opened<AppCharacter>;

/** Each system's character opener, by the system id a character stores in `system`. */
export const CHARACTER_OPENERS: Readonly<Record<string, CharacterOpener>> = {
  [FIFTH_EDITION_SYSTEM]: openFifthEditionCharacter,
};

/** The opener of the system `system` names, or `undefined` when the app carries no such system. */
export function characterOpenerOf(system: unknown): CharacterOpener | undefined {
  return typeof system === 'string' && Object.hasOwn(CHARACTER_OPENERS, system)
    ? CHARACTER_OPENERS[system]
    : undefined;
}

/** Opens a pack file of one system through its migration frame (SPEC §5.8). */
export type PackOpener = (file: unknown) => Opened<AppPack>;

/** Each system's pack opener, by the system id a pack stores in `system`. */
export const PACK_OPENERS: Readonly<Record<string, PackOpener>> = {
  [FIFTH_EDITION_SYSTEM]: openFifthEditionPack,
};

/** The pack opener of the system `system` names, or `undefined` when the app carries none. */
export function packOpenerOf(system: unknown): PackOpener | undefined {
  return typeof system === 'string' && Object.hasOwn(PACK_OPENERS, system)
    ? PACK_OPENERS[system]
    : undefined;
}

/** The entities a list card names under a character's name, with a class's level. */
export type ListLine = (character: AppCharacter) => readonly ListLinePart[];

/** Each system's list line, by system id. */
export const CHARACTER_LIST_LINES: Readonly<Record<string, ListLine>> = {
  [FIFTH_EDITION_SYSTEM]: fifthEditionListLine,
};

/** The entities a list card names under `character`'s name; none for a system without a line. */
export function listLineOf(character: AppCharacter): readonly ListLinePart[] {
  const line = Object.hasOwn(CHARACTER_LIST_LINES, character.system)
    ? CHARACTER_LIST_LINES[character.system]
    : undefined;
  return line === undefined ? [] : line(character);
}

/** A rules base a system's characters may have. */
export type AppRuleset = AppCharacter['ruleset'];

/** SHEET-27: what the manual form needs of a system: its rules bases, their words, its maker. */
export interface ManualFormSystem {
  system: string;
  rulesets: readonly AppRuleset[];
  /** The highest level a character reaches, its classes' levels added up. */
  maxLevel: number;
  /** The words a rules base uses where the editions differ: each an i18n key's last part. */
  terms: (ruleset: AppRuleset) => EditionTerms;
  /** The character the form describes, at full hit points, and its numbers. */
  make: (ask: ManualCharacterAsk, index: ContentIndex<AppPack['entities'][number]>) => MadeByHand;
}

/** The systems the manual form offers; one for now (BRIEF P3 step 1). */
export const MANUAL_FORM_SYSTEMS: readonly ManualFormSystem[] = [
  {
    system: FIFTH_EDITION_SYSTEM,
    rulesets: Object.keys(EDITION_RULES) as AppRuleset[],
    maxLevel: MAX_LEVEL,
    terms: (ruleset) => EDITION_RULES[ruleset].terms,
    make: madeByHand,
  },
];

export type { MadeByHand, ManualCharacterAsk };

/** What a roll's action gives: the entry to record, or why there is none (`code` is for the screen). */
export type RollAction =
  | { ok: true; entry: LogEntry }
  | { ok: false; code: string; message: string };

/** SHEET-39: how a system's numbers roll in the roll dialog: its d20 tests and what changes them. */
export interface SheetRolls {
  /** The test the number at `path` rolls; none when it rolls nothing. */
  test: typeof rollTestOf;
  /** The signs the sheet's own sources give the test's mode. */
  signs: typeof modeSigns;
  /** What the signs add up to: 1 advantage, −1 disadvantage, 0 neither. */
  mode: typeof rollModeOf;
  /** The effects the person may switch on for one roll. */
  situational: typeof situationalModes;
  /** The d20 a roll of `mode` rolls. */
  d20: typeof d20Formula;
  /** What a natural d20 face does to an attack roll. */
  outcome: typeof attackOutcome;
  /** An attack's damage formula for a critical hit. */
  critical: typeof criticalDamage;
  /** What inspiration does to a roll in this character's rules, and how much it holds. */
  inspiration(character: AppCharacter): { held: number; use: 'advantage' | 'reroll' };
  /** The entry that spends one inspiration. */
  spend(character: AppCharacter, stamp: LogStamp): RollAction;
  /** The entry that rolling initiative makes, if it changes anything. */
  initiative(
    character: AppCharacter,
    index: ContentIndex<FifthEditionEntity>,
    stamp: LogStamp,
  ): RollAction;
}

/** What the sheet reads of one system: its module, and what its header and dock name. */
export interface SheetSystem {
  module: SystemModule<AppCharacter, FifthEditionEntity>;
  /** Each class with its level: the level shown next to the name (ADR 013 item 2). */
  classLine: ListLine;
  /** The header's stats row, left to right. */
  numbers: readonly HeaderNumber[];
  /** Each casting class's ability, spell save DC and spell attack (ADR 009 item 4). */
  casting(character: AppCharacter, computed: AppComputed): readonly HeaderCasting[];
  hitPoints(character: AppCharacter): HeaderHitPoints;
  /** How its numbers roll (SHEET-39). */
  rolls: SheetRolls;
}

/** Each system's sheet, by system id. */
export const SHEET_SYSTEMS: Readonly<Record<string, SheetSystem>> = {
  [FIFTH_EDITION_SYSTEM]: {
    module: fifthEditionModule,
    classLine: fifthEditionClassLine,
    numbers: FIFTH_EDITION_HEADER_NUMBERS,
    casting: fifthEditionCasting,
    hitPoints: fifthEditionHitPoints,
    rolls: {
      test: rollTestOf,
      signs: modeSigns,
      mode: rollModeOf,
      situational: situationalModes,
      d20: d20Formula,
      outcome: attackOutcome,
      critical: criticalDamage,
      inspiration: (character) => ({
        held: character.systemData.state.inspiration,
        use: rulesOf(character).inspiration.use,
      }),
      spend: spendInspiration,
      initiative: rollInitiative,
    },
  },
};

/** The sheet of `character`'s system, or `undefined` when the app has none for it. */
export function sheetSystemOf(character: AppCharacter): SheetSystem | undefined {
  return Object.hasOwn(SHEET_SYSTEMS, character.system)
    ? SHEET_SYSTEMS[character.system]
    : undefined;
}
