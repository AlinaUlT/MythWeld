// SHEET-26: importing a character file (SPEC §5.8, §12 stage 2). The file is the text SHEET-25's
// Export saved, or an older one: it runs through the opener of the system it names, so an older
// file migrates, and is stored at the current versions. A file that fails any check is refused
// with its reason and nothing of it is stored: not the row, not a part of it. A file whose id is
// already on the device never replaces that character (a person's saved data): it is stored under
// a new id. The file carries no rolls, no changes and no picture, so the character comes with
// none; its `portraitBlobId` names a picture this device may not hold, which shows as the letter
// and is never dropped (SPEC §8.2).
import type { AppCharacter } from '../systems';
import { openFile, saveCharacter } from './characters';
import { db, type GrimoireDb } from './db';

/** The largest file read as a character, in bytes: far above any character, below a film. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Why a file was not imported. `message` is for logs; the screen words each `code` itself. */
export interface ImportRefusal {
  ok: false;
  code: 'tooBig' | 'notJson' | 'notACharacter' | 'newer' | 'invalid' | 'unknownSystem';
  message: string;
}

/** What importing gives: the character as stored, or why nothing was stored. */
export type ImportResult =
  | {
      ok: true;
      character: AppCharacter;
      /** The file's id was on the device already, so the character has a new one. */
      again: boolean;
      /** The versions the file was saved at, when it was migrated: `schemaVersion`, … */
      from: Readonly<Record<string, number>>;
    }
  | ImportRefusal;

function refusal(code: ImportRefusal['code'], message: string): ImportRefusal {
  return { ok: false, code, message };
}

/** Stores the character the file `text` holds, or refuses it with nothing stored. */
export async function importCharacterFile(
  text: string,
  database: GrimoireDb = db,
  now = new Date().toISOString(),
): Promise<ImportResult> {
  if (text.length > IMPORT_MAX_BYTES) {
    return refusal('tooBig', `The file is over ${IMPORT_MAX_BYTES} bytes.`);
  }
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch (error) {
    return refusal('notJson', error instanceof Error ? error.message : 'The file is not JSON.');
  }
  if (typeof file !== 'object' || file === null || Array.isArray(file)) {
    return refusal('notACharacter', 'The file is JSON, but not one character.');
  }
  const opened = openFile(file);
  if (!opened.ok) return refusal(opened.code, opened.message);
  return database.transaction('rw', database.characters, async () => {
    const present = await database.characters.get(opened.value.id);
    const again = present !== undefined;
    const character: AppCharacter = again
      ? { ...opened.value, id: crypto.randomUUID(), updatedAt: now }
      : opened.value;
    const saved = await saveCharacter(character, database.characters);
    // The value was just opened, and a new id and time keep it valid; a refusal would be a bug.
    if (!saved.ok) return refusal('invalid', saved.message);
    return { ok: true, character: saved.value, again, from: opened.from } satisfies ImportResult;
  });
}
