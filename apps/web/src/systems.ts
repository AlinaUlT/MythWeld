// SHEET-10: the system modules the app carries, by system id (ADR 004). A stored file names its
// system, and the app finds that module's opener here; no other code asks which system it is.
// SHEET-09: a pack file names its system too, and opens through that module's pack opener.
// SHEET-24: what My characters names under a character's name is its module's too.
import type { Opened } from '@grimoire/schema';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionPack,
  fifthEditionListLine,
  type ListLinePart,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '@grimoire/system-5e';

/** A character of any system the app carries. */
export type AppCharacter = FifthEditionCharacter;

/** A content pack of any system the app carries. */
export type AppPack = FifthEditionPack;

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
