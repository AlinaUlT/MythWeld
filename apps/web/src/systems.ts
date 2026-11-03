// SHEET-10: the system modules the app carries, by system id (ADR 004). A stored file names its
// system, and the app finds that module's opener here; no other code asks which system it is.
// SHEET-09: a pack file names its system too, and opens through that module's pack opener.
// SHEET-24: what My characters names under a character's name is its module's too.
// SHEET-27: the manual form makes a character through its system's maker, with its rules bases.
// SHEET-30: so is what the sheet's header and dock read, and the module `compute()` runs.
import type { Computed, ContentIndex, SystemModule } from '@grimoire/engine';
import type { Opened } from '@grimoire/schema';
import {
  ABOUT_LISTS,
  type AboutListName,
  type AboutShown,
  attackOutcome,
  type ChecksShown,
  criticalDamage,
  d20Formula,
  EDITION_RULES,
  type EditionTerms,
  type FeatureGroup,
  FIFTH_EDITION_HEADER_NUMBERS,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type FifthEditionPack,
  fifthEditionAbout,
  fifthEditionCasting,
  fifthEditionChecks,
  fifthEditionClassLine,
  fifthEditionFeatures,
  fifthEditionGear,
  fifthEditionHitPoints,
  fifthEditionInspiration,
  fifthEditionListLine,
  fifthEditionModule,
  fifthEditionPathParts,
  fifthEditionPendingKey,
  fifthEditionRollTest,
  fifthEditionSituational,
  type GearShown,
  gainInspiration,
  type HeaderCasting,
  type HeaderHitPoints,
  type HeaderNumber,
  type InspirationShown,
  type ListLinePart,
  MAX_LEVEL,
  type MadeByHand,
  type ManualCharacterAsk,
  madeByHand,
  openFifthEditionCharacter,
  openFifthEditionPack,
  type PathPart,
  type PendingKeyAnswer,
  type RollTest,
  removeRow,
  rollInitiative,
  rollModeOf,
  type Situational,
  setRowAttuned,
  setRowContainer,
  setRowEquipped,
  setRowQuantity,
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

export type {
  AboutListName,
  FeatureGroup,
  GearShown,
  MadeByHand,
  ManualCharacterAsk,
  PathPart,
  PendingKeyAnswer,
  RollTest,
  Situational,
};

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
  /** The d20 test the number at `path` is, or none when it does not roll (SHEET-39). */
  rollTest(computed: AppComputed, path: string): RollTest | undefined;
  /** The situational effects that name one of a test's `roll.*` targets (SHEET-39). */
  situational(computed: AppComputed, targets: readonly string[]): readonly Situational[];
  /** The mode sources of these signs give: 1 advantage, −1 disadvantage, 0 neither. */
  rollMode: typeof rollModeOf;
  /** The d20 formula of a roll in a mode. */
  d20: typeof d20Formula;
  /** What an attack roll's natural face does: a critical hit, an automatic miss, or by total. */
  attackOutcome: typeof attackOutcome;
  criticalDamage: typeof criticalDamage;
  /** The entry for rolling initiative: it interrupts a knock-out's short rest (SHEET-19). */
  rollInitiative: typeof rollInitiative;
  /** How the pending key at `path` is answered, or none when this system cannot (SHEET-36). */
  pendingKey(path: string): PendingKeyAnswer | undefined;
  /** The rows of the Gear tab, their weight and the rules they break (SHEET-50). */
  gear(
    character: AppCharacter,
    computed: AppComputed,
    find: (id: string) => FifthEditionEntity | undefined,
  ): GearShown;
  setRowEquipped: typeof setRowEquipped;
  setRowAttuned: typeof setRowAttuned;
  setRowQuantity: typeof setRowQuantity;
  setRowContainer: typeof setRowContainer;
  removeRow: typeof removeRow;
  /** The groups of the Features tab: what gave each feature (ADR 009 item 2, SHEET-48). */
  features(character: AppCharacter, computed: AppComputed): FeatureGroup[];
  /** The parts a computed path is named by in a breakdown (SHEET-33). */
  pathParts(path: string): readonly PathPart[];
  /** The stats, saves, skills and passive values the Main tab shows (SHEET-32). */
  checks(computed: AppComputed): ChecksShown;
  /** The inspiration held, its stars and the edition's own maximum (ADR 009 item 5, SHEET-55). */
  inspiration(character: AppCharacter): InspirationShown;
  /** The origin details and proficiencies the About tab shows (ADR 009 item 3, SHEET-53). */
  about(character: AppCharacter, computed: AppComputed): AboutShown;
  /** Each About list's proficiency category, and the entity type that names its keys. */
  aboutLists: Readonly<Record<AboutListName, { category: string; type: string }>>;
  /** The words of the edition's species and lineage: a race and a subrace in 2014. */
  terms: (ruleset: AppRuleset) => EditionTerms;
  /** Gains or spends one inspiration; the action's entry, not yet stored. */
  gainInspiration: typeof gainInspiration;
  spendInspiration: typeof spendInspiration;
}

/** Each system's sheet, by system id. */
export const SHEET_SYSTEMS: Readonly<Record<string, SheetSystem>> = {
  [FIFTH_EDITION_SYSTEM]: {
    module: fifthEditionModule,
    classLine: fifthEditionClassLine,
    numbers: FIFTH_EDITION_HEADER_NUMBERS,
    casting: fifthEditionCasting,
    hitPoints: fifthEditionHitPoints,
    checks: fifthEditionChecks,
    features: fifthEditionFeatures,
    gear: fifthEditionGear,
    setRowEquipped,
    setRowAttuned,
    setRowQuantity,
    setRowContainer,
    removeRow,
    pathParts: fifthEditionPathParts,
    pendingKey: fifthEditionPendingKey,
    rollTest: fifthEditionRollTest,
    situational: fifthEditionSituational,
    rollMode: rollModeOf,
    d20: d20Formula,
    attackOutcome,
    criticalDamage,
    rollInitiative,
    about: fifthEditionAbout,
    aboutLists: ABOUT_LISTS,
    terms: (ruleset) => EDITION_RULES[ruleset].terms,
    inspiration: fifthEditionInspiration,
    gainInspiration,
    spendInspiration,
  },
};

/** The sheet of `character`'s system, or `undefined` when the app has none for it. */
export function sheetSystemOf(character: AppCharacter): SheetSystem | undefined {
  return Object.hasOwn(SHEET_SYSTEMS, character.system)
    ? SHEET_SYSTEMS[character.system]
    : undefined;
}
