// SHEET-26: a character file is read, opened through its system's migration frame (an older file
// migrates, a newer or broken one is refused) and stored (SPEC §5.8, §12 stage 2). A refused file
// writes nothing. A file whose id a stored character already has never replaces it: it is stored
// as a new character, because what is on the device is the person's saved data (ADR 002).
import type { Opened } from '@grimoire/schema';
import type { AppCharacter } from '../systems';
import { openFile, type SavedCharacter, saveCharacter } from './characters';
import { db, type GrimoireDb } from './db';

/** The largest file import reads: far above any character, below what could stall the phone. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** What import reads: a `File` is one. */
export interface ImportSource {
  size: number;
  text(): Promise<string>;
}

/** Why a file was refused before the frame saw it. */
export type FileRefusal =
  | { ok: false; code: 'tooLarge'; size: number; limit: number; message: string }
  | { ok: false; code: 'unreadable'; message: string }
  | { ok: false; code: 'notJson'; message: string }
  | { ok: false; code: 'notACharacter'; message: string };

/** The frame's refusals and the unknown system's: what `SavedCharacter` holds besides success. */
export type CharacterRefusal = Exclude<SavedCharacter, { ok: true }>;

/** What import gives: the character as stored, or why nothing was stored. */
export type ImportedCharacter =
  | { ok: true; character: AppCharacter; renamed: boolean }
  | FileRefusal
  | CharacterRefusal;

/** The byte-order mark some editors put first in a text file; JSON does not allow it. */
const BYTE_ORDER_MARK = '﻿';

/** The file's text, or why it could not be read. */
async function readText(source: ImportSource): Promise<{ text: string } | FileRefusal> {
  if (source.size > IMPORT_MAX_BYTES) {
    return {
      ok: false,
      code: 'tooLarge',
      size: source.size,
      limit: IMPORT_MAX_BYTES,
      message: `The file is ${source.size} bytes; import reads up to ${IMPORT_MAX_BYTES}.`,
    };
  }
  try {
    return { text: await source.text() };
  } catch (error) {
    return {
      ok: false,
      code: 'unreadable',
      message: `The file could not be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** The file's JSON, when it is an object that names a `system`; or why it is not a character. */
function parseCharacterFile(text: string): { file: Record<string, unknown> } | FileRefusal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text);
  } catch (error) {
    return {
      ok: false,
      code: 'notJson',
      message: `The file is not JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).system !== 'string'
  ) {
    return {
      ok: false,
      code: 'notACharacter',
      message: 'The file is not an object with a "system" text, which every character has.',
    };
  }
  return { file: parsed as Record<string, unknown> };
}

/**
 * Stores the character `source` holds, migrated to the current versions; or refuses it with the
 * reason and stores nothing. When a stored character has the file's id, the file is stored as a
 * new one: a new id, revision 0, made and changed at `now`, named `nameIfTaken(name)`.
 */
export async function importCharacter(
  source: ImportSource,
  nameIfTaken: (name: string) => string,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<ImportedCharacter> {
  const read = await readText(source);
  if ('ok' in read) return read;
  const parsed = parseCharacterFile(read.text);
  if ('ok' in parsed) return parsed;
  const opened: Opened<AppCharacter> | CharacterRefusal = openFile(parsed.file);
  if (!opened.ok) return opened;

  return database.transaction('rw', database.characters, async () => {
    const taken = (await database.characters.get(opened.value.id)) !== undefined;
    const character = taken
      ? {
          ...opened.value,
          id: crypto.randomUUID(),
          rev: 0,
          createdAt: now,
          updatedAt: now,
          name: nameIfTaken(opened.value.name),
        }
      : opened.value;
    const saved = await saveCharacter(character, database.characters);
    return saved.ok ? { ok: true as const, character: saved.value, renamed: taken } : saved;
  });
}
