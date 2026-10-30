// SHEET-56: a character's portrait on the device (ADR 009 item 6, ADR 005 item 10). The person's
// file, an image, an animated picture or a short video, is kept as it came in the `blobs` table,
// and the character's `portraitBlobId` names it. Setting one drops the one it replaces, unless
// another character names it too (a copy has its own, SHEET-25, but a row that was imported may
// not). Nothing here leaves the device.
import { type NotFound, openCharacter, type SavedCharacter, saveCharacter } from './characters';
import { type BlobRow, db, type GrimoireDb } from './db';

/** The largest file kept as a portrait; a phone holds a few of them, not a film. */
export const PORTRAIT_MAX_BYTES = 10 * 1024 * 1024;

/** Why a file was not kept: it is not a picture or a video, or it is too large. */
export interface PortraitRefused {
  ok: false;
  code: 'notMedia' | 'tooBig';
}

export type PortraitResult = SavedCharacter | NotFound | PortraitRefused;

/** What a portrait file is, by the media type it came with; anything else is not one. */
export function portraitKind(type: string): 'image' | 'video' | undefined {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  return undefined;
}

/** The refusal for `file`, or nothing when it can be kept. */
export function refusalFor(file: Blob): PortraitRefused | undefined {
  if (portraitKind(file.type) === undefined) return { ok: false, code: 'notMedia' };
  if (file.size > PORTRAIT_MAX_BYTES) return { ok: false, code: 'tooBig' };
  return undefined;
}

/** Drops blob `id` when no stored character names it any more. */
async function dropIfUnused(id: string | undefined, database: GrimoireDb): Promise<void> {
  if (id === undefined) return;
  const used = await database.characters.filter((row) => row.portraitBlobId === id).count();
  if (used === 0) await database.blobs.delete(id);
}

/** The stored portrait file `id`, or nothing when no blob holds it (missing, never an error). */
export async function readPortrait(
  id: string,
  database: GrimoireDb = db,
): Promise<BlobRow | undefined> {
  const row = await database.blobs.get(id);
  return row?.data instanceof Blob ? row : undefined;
}

/**
 * Keeps `file` as the portrait of the stored character `characterId`, one revision on, and drops
 * the file it replaces. A file that is not a picture or a video, or is over `PORTRAIT_MAX_BYTES`,
 * is refused and nothing is written.
 */
export async function setPortrait(
  characterId: string,
  file: Blob,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<PortraitResult> {
  const refused = refusalFor(file);
  if (refused !== undefined) return refused;
  return database.transaction('rw', database.characters, database.blobs, async () => {
    const opened = await openCharacter(characterId, database.characters);
    if (!opened.ok) return opened;
    const before = opened.value.portraitBlobId;
    const id = crypto.randomUUID();
    await database.blobs.put({ id, type: file.type, data: file });
    const saved = await saveCharacter(
      { ...opened.value, portraitBlobId: id, rev: opened.value.rev + 1, updatedAt: now },
      database.characters,
    );
    if (saved.ok) await dropIfUnused(before, database);
    else await database.blobs.delete(id);
    return saved;
  });
}

/** Takes the portrait off the stored character `characterId`, one revision on, and drops its file. */
export async function clearPortrait(
  characterId: string,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<SavedCharacter | NotFound> {
  return database.transaction('rw', database.characters, database.blobs, async () => {
    const opened = await openCharacter(characterId, database.characters);
    if (!opened.ok) return opened;
    const { portraitBlobId, ...rest } = opened.value;
    if (portraitBlobId === undefined) return opened;
    const saved = await saveCharacter(
      { ...rest, rev: opened.value.rev + 1, updatedAt: now },
      database.characters,
    );
    if (saved.ok) await dropIfUnused(portraitBlobId, database);
    return saved;
  });
}

/**
 * The first frame of a picture as a still picture, for an animated one while motion is stopped
 * (ADR 015 item 9: CSS cannot stop it). When the browser cannot decode it, the file itself.
 */
export async function stillFrameOf(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const still = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
    return still ?? file;
  } catch {
    return file;
  }
}
