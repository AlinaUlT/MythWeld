// SHEET-10: a character is stored as it was saved, at its versions, and migrates each time it
// opens (SPEC §5.8). Opening never writes: an older row stays as it is until the next save
// stores the current version, and a row the app refuses (newer, invalid, of a system it does
// not carry) is left untouched, so no saved data is lost or rewritten (ADR 002).
import type { Opened } from '@grimoire/schema';
import { type AppCharacter, characterOpenerOf } from '../systems';
import { type CharacterRow, db } from './db';

/** A row whose `system` names no system the app carries. */
export interface UnknownSystem {
  ok: false;
  code: 'unknownSystem';
  system: unknown;
  message: string;
}

/** No row has this id. */
export interface NotFound {
  ok: false;
  code: 'notFound';
  id: string;
  message: string;
}

/** What opening a stored character gives: the frame's answer, or why it never reached it. */
export type OpenedCharacter = Opened<AppCharacter> | UnknownSystem | NotFound;

/** What saving gives: the character as stored, or why nothing was stored. */
export type SavedCharacter = Opened<AppCharacter> | UnknownSystem;

/** Runs a stored file through the opener of the system it names. */
function openFile(file: unknown): Opened<AppCharacter> | UnknownSystem {
  const system =
    typeof file === 'object' && file !== null
      ? (file as Record<string, unknown>).system
      : undefined;
  const open = characterOpenerOf(system);
  if (open === undefined) {
    return {
      ok: false,
      code: 'unknownSystem',
      system,
      message: `The character's system ${JSON.stringify(system)} is not one this app carries.`,
    };
  }
  return open(file);
}

/** Opens the stored character `id`, migrated to the current versions; the row is not written. */
export async function openCharacter(
  id: string,
  characters = db.characters,
): Promise<OpenedCharacter> {
  const row = await characters.get(id);
  if (row === undefined) {
    return { ok: false, code: 'notFound', id, message: `No character is stored with id ${id}.` };
  }
  return openFile(row);
}

/**
 * Stores `character` under its id, as its system's schema reads it. One the schema refuses is
 * not stored, so a row always opens as it was saved.
 */
export async function saveCharacter(
  character: AppCharacter,
  characters = db.characters,
): Promise<SavedCharacter> {
  const opened = openFile(character);
  if (opened.ok) await characters.put(opened.value as CharacterRow);
  return opened;
}

/** How many characters are stored, each counted whether it opens or not (ADR 005 item 2). */
export function countCharacters(characters = db.characters): Promise<number> {
  return characters.count();
}
