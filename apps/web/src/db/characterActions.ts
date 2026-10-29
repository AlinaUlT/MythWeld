// SHEET-25: what a character's Actions do to the device (ADR 008 item 4). Copy stores a new
// character, with its own id, made from the stored one, and a copy of its portrait; nothing else
// of the first comes with it. Export gives the stored row as it was saved, at its versions, so a
// row the app does not open is still a file the person keeps; importing it migrates it
// (SHEET-26). Delete drops the row, its rolls, its changes and its portrait in one transaction,
// and gives back all it dropped, so "Undo" puts each row back as it was.
import Dexie from 'dexie';
import { type NotFound, openCharacter, type SavedCharacter, saveCharacter } from './characters';
import {
  type BlobRow,
  type CharacterRow,
  db,
  type GrimoireDb,
  type HistoryRow,
  type RollLogRow,
} from './db';

/** Every row a deleted character had on the device. */
export interface DeletedCharacter {
  character: CharacterRow;
  rolls: RollLogRow[];
  changes: HistoryRow[];
  blobs: BlobRow[];
}

/** A character file to save: its name and its text. */
export interface CharacterFile {
  fileName: string;
  text: string;
}

/** What Copy gives: the copy as stored, or why nothing was stored. */
export type CopiedCharacter = SavedCharacter | NotFound;

/** The portrait blob id a stored row names, when it names one. */
function portraitOf(row: CharacterRow): string | undefined {
  return typeof row.portraitBlobId === 'string' ? row.portraitBlobId : undefined;
}

/** The range of one character's rows in an index keyed by `[characterId+<time>]`. */
function rangeOf(characterId: string): [unknown[], unknown[]] {
  return [
    [characterId, Dexie.minKey],
    [characterId, Dexie.maxKey],
  ];
}

/** Characters that may not be in a file name on a phone or a computer, and control characters. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes.
const NOT_IN_FILE_NAME = /[\u0000-\u001f\u007f<>:"/\\|?*]/g;

/** The file name for a character called `name`: `<name>.json`, safe on every system. */
export function characterFileName(name: unknown): string {
  const safe =
    typeof name === 'string' ? name.replace(NOT_IN_FILE_NAME, '_').trim().replace(/\.+$/, '') : '';
  return `${safe === '' ? 'character' : safe}.json`;
}

/**
 * Stores a copy of the stored character `id`, named `name`: a new id, revision 0, made and
 * changed at `now`, and its own copy of the portrait. Its rolls and changes stay with the first.
 */
export async function copyCharacter(
  id: string,
  name: string,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<CopiedCharacter> {
  return database.transaction('rw', database.characters, database.blobs, async () => {
    const opened = await openCharacter(id, database.characters);
    if (!opened.ok) return opened;
    const { portraitBlobId, ...first } = opened.value;
    const portrait =
      portraitBlobId === undefined ? undefined : await database.blobs.get(portraitBlobId);
    const copiedPortrait = portrait === undefined ? undefined : crypto.randomUUID();
    const copy = {
      ...first,
      id: crypto.randomUUID(),
      rev: 0,
      createdAt: now,
      updatedAt: now,
      name,
      // A portrait id no blob holds stays as it was: missing, never dropped.
      ...(portraitBlobId !== undefined && { portraitBlobId: copiedPortrait ?? portraitBlobId }),
    };
    const saved = await saveCharacter(copy, database.characters);
    if (saved.ok && portrait !== undefined && copiedPortrait !== undefined) {
      await database.blobs.put({ ...portrait, id: copiedPortrait });
    }
    return saved;
  });
}

/** The stored character `id` as a file: its row as it was saved, whether it opens or not. */
export async function exportCharacter(
  id: string,
  database: GrimoireDb = db,
): Promise<{ ok: true; file: CharacterFile } | NotFound> {
  const row = await database.characters.get(id);
  if (row === undefined) {
    return { ok: false, code: 'notFound', id, message: `No character is stored with id ${id}.` };
  }
  return {
    ok: true,
    file: { fileName: characterFileName(row.name), text: `${JSON.stringify(row, null, 2)}\n` },
  };
}

/**
 * Drops the stored character `id`, its rolls, its changes and its portrait, unless another
 * character names that portrait too, in one transaction; gives back every row it dropped.
 */
export async function deleteCharacter(
  id: string,
  database: GrimoireDb = db,
): Promise<{ ok: true; deleted: DeletedCharacter } | NotFound> {
  const { characters, rollLog, history, blobs } = database;
  return database.transaction<{ ok: true; deleted: DeletedCharacter } | NotFound>(
    'rw',
    [characters, rollLog, history, blobs],
    async () => {
      const character = await characters.get(id);
      if (character === undefined) {
        return {
          ok: false,
          code: 'notFound',
          id,
          message: `No character is stored with id ${id}.`,
        };
      }
      const rolls: RollLogRow[] = await rollLog
        .where('[characterId+rolledAt]')
        .between(...rangeOf(id))
        .toArray();
      const changes: HistoryRow[] = await history
        .where('[characterId+at]')
        .between(...rangeOf(id))
        .toArray();
      const portrait = portraitOf(character);
      const shared =
        portrait !== undefined &&
        (await characters.filter((row) => row.id !== id && portraitOf(row) === portrait).count()) >
          0;
      const blob = portrait === undefined || shared ? undefined : await blobs.get(portrait);
      await characters.delete(id);
      await rollLog.bulkDelete(rolls.map((row) => row.id));
      await history.bulkDelete(changes.map((row) => row.id));
      if (blob !== undefined) await blobs.delete(blob.id);
      return {
        ok: true,
        deleted: { character, rolls, changes, blobs: blob === undefined ? [] : [blob] },
      };
    },
  );
}

/** Puts back every row `deleteCharacter` dropped, as it was, in one transaction. */
export async function restoreCharacter(
  deleted: DeletedCharacter,
  database: GrimoireDb = db,
): Promise<void> {
  const { characters, rollLog, history, blobs } = database;
  await database.transaction('rw', [characters, rollLog, history, blobs], async () => {
    await characters.put(deleted.character);
    await rollLog.bulkPut(deleted.rolls);
    await history.bulkPut(deleted.changes);
    await blobs.bulkPut(deleted.blobs);
  });
}
