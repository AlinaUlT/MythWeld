// SHEET-10: the system modules the app carries, by system id (ADR 004). A stored file names its
// system, and the app finds that module's opener here; no other code asks which system it is.
// SHEET-09: a pack file names its system too, and opens through that module's pack opener.
// SHEET-24: what My characters names under a character's name is its module's too.
// SHEET-27: the manual form makes a character through its system's maker, with its rules bases.
// SHEET-30: so is what the sheet's header and dock read, and the module `compute()` runs.
import type { Computed, ContentIndex, SystemModule } from '@grimoire/engine';
import type { Opened } from '@grimoire/schema';
import {
  EDITION_RULES,
  type EditionTerms,
  FIFTH_EDITION_HEADER_NUMBERS,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionAbout,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type FifthEditionPack,
  fifthEditionAbout,
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
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '@grimoire/system-5e';

/** A character of any system the app carries. */
export type AppCharacter = FifthEditionCharacter;

/** A content pack of any system the app carries. */
export type AppPack = FifthEditionPack;

/** What `compute()` gives for a character of any system the app carries. */
export type AppComputed = Computed<FifthEditionEntity>;

/** What the About tab shows for a character of any system the app carries. */
export type AppAbout = FifthEditionAbout;

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
  /** SHEET-53: what the About tab names: the origin, the alignment, the languages, the training. */
  about(character: AppCharacter, computed: AppComputed): AppAbout;
}

/** Each system's sheet, by system id. */
export const SHEET_SYSTEMS: Readonly<Record<string, SheetSystem>> = {
  [FIFTH_EDITION_SYSTEM]: {
    module: fifthEditionModule,
    classLine: fifthEditionClassLine,
    numbers: FIFTH_EDITION_HEADER_NUMBERS,
    casting: fifthEditionCasting,
    hitPoints: fifthEditionHitPoints,
    about: fifthEditionAbout,
  },
};

/** The sheet of `character`'s system, or `undefined` when the app has none for it. */
export function sheetSystemOf(character: AppCharacter): SheetSystem | undefined {
  return Object.hasOwn(SHEET_SYSTEMS, character.system)
    ? SHEET_SYSTEMS[character.system]
    : undefined;
}
