// SHEET-25: what a character's Actions do to it on the device (ADR 008 item 4). Copy stores a new
// character from the stored one; its rolls and changes stay the original's. Export gives the
// stored character, at the current versions, as a JSON file (SPEC §12 stage 2). Delete drops the
// character with its rolls and its changes in one transaction (SHEET-07 §9) and gives back every
// row it dropped, exactly as stored, so "Undo" puts them back unchanged. A file the person added
// (a portrait) is left alone: another character may name it.
import type { AppCharacter } from '../systems';
import {
  type OpenedCharacter,
  openCharacter,
  type SavedCharacter,
  saveCharacter,
} from './characters';
import { type CharacterRow, db, type GrimoireDb, type HistoryRow, type RollLogRow } from './db';
import { rowsOf as historyRowsOf } from './history';
import { rowsOf as rollRowsOf } from './rollLog';

/** What copying gives: the copy as stored, or why nothing was stored. */
export type CopiedCharacter = SavedCharacter | Exclude<OpenedCharacter, { ok: true }>;

/** What the copy is: its id, its name and when it is made. */
export interface CopyOf {
  id?: string;
  name: string;
  now?: string;
}

/**
 * Stores a copy of the stored character `id`: a new id, `name`, revision 0, made and changed at
 * `now`. Every other field is the original's, at the current versions.
 */
export async function copyCharacter(
  id: string,
  { id: copyId = crypto.randomUUID(), name, now = new Date().toISOString() }: CopyOf,
  database: GrimoireDb = db,
): Promise<CopiedCharacter> {
  return database.transaction('rw', database.characters, async () => {
    const stored = await openCharacter(id, database.characters);
    if (!stored.ok) return stored;
    const copy: AppCharacter = {
      ...stored.value,
      id: copyId,
      name,
      rev: 0,
      createdAt: now,
      updatedAt: now,
    };
    return saveCharacter(copy, database.characters);
  });
}

/** A file to save: its name and its text. */
export interface CharacterFile {
  name: string;
  text: string;
}

// Characters a file name may not hold on the phones and computers the app runs on.
const UNSAFE = /[\\/:*?"<>|\p{Cc}]+/gu;

/** The character as a JSON file, named after it; a name with nothing safe in it gives the id. */
export function characterFileOf(character: AppCharacter): CharacterFile {
  const base = character.name.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
  return {
    name: `${base === '' ? character.id : base}.json`,
    text: `${JSON.stringify(character, null, 2)}\n`,
  };
}

/** The stored character `id` as its file, or why it did not open. */
export async function exportCharacter(
  id: string,
  database: GrimoireDb = db,
): Promise<{ ok: true; file: CharacterFile } | Exclude<OpenedCharacter, { ok: true }>> {
  const stored = await openCharacter(id, database.characters);
  return stored.ok ? { ok: true, file: characterFileOf(stored.value) } : stored;
}

/** Every row a delete dropped, exactly as it was stored. */
export interface DeletedCharacter {
  character: CharacterRow;
  history: HistoryRow[];
  rolls: RollLogRow[];
}

/** What deleting gives: the rows it dropped, or no character with that id. */
export type DeleteResult =
  | { ok: true; deleted: DeletedCharacter }
  | Extract<OpenedCharacter, { code: 'notFound' }>;

/** Drops the stored character `id`, its changes and its rolls, in one transaction. */
export async function deleteCharacter(
  id: string,
  database: GrimoireDb = db,
): Promise<DeleteResult> {
  return database.transaction(
    'rw',
    database.characters,
    database.history,
    database.rollLog,
    async () => {
      const character = await database.characters.get(id);
      if (character === undefined) {
        return {
          ok: false,
          code: 'notFound',
          id,
          message: `No character is stored with id ${id}.`,
        };
      }
      const history = await historyRowsOf(id, database.history);
      const rolls = await rollRowsOf(id, database.rollLog);
      await database.history.bulkDelete(history.map((row) => row.id));
      await database.rollLog.bulkDelete(rolls.map((row) => row.id));
      await database.characters.delete(id);
      return { ok: true, deleted: { character, history, rolls } };
    },
  );
}

/** A row with the deleted character's id is stored again, so nothing is put back over it. */
export interface Taken {
  ok: false;
  code: 'taken';
  id: string;
  message: string;
}

/** Puts back every row a delete dropped, unchanged; refused when the id is stored again. */
export async function restoreCharacter(
  deleted: DeletedCharacter,
  database: GrimoireDb = db,
): Promise<{ ok: true } | Taken> {
  const { id } = deleted.character;
  return database.transaction(
    'rw',
    database.characters,
    database.history,
    database.rollLog,
    async () => {
      if ((await database.characters.get(id)) !== undefined) {
        return {
          ok: false,
          code: 'taken',
          id,
          message: `A character is stored with id ${id} again; nothing was put back.`,
        };
      }
      await database.characters.put(deleted.character);
      await database.history.bulkPut(deleted.history);
      await database.rollLog.bulkPut(deleted.rolls);
      return { ok: true };
    },
  );
}
