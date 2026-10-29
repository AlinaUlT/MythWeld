// SHEET-56: a character's portrait (ADR 009 item 6): the person's image, an animated picture or a
// short video included, kept as a row of the blobs table on the device (ADR 005 item 10) and named
// by the character's `portraitBlobId`. The row also holds the token's frame. Nothing is sent
// anywhere. A portrait is stored with the character in one transaction, so a refused character
// leaves no stray blob; replacing or removing it drops the blob it had.
import { openCharacter, saveCharacter } from './characters';
import { db, type GrimoireDb, TOKEN_FRAMES, type TokenFrame } from './db';
import { revised } from './history';

/** The largest portrait file, in bytes: a short video fits, a camera's full roll does not. */
export const PORTRAIT_MAX_BYTES = 10 * 1024 * 1024;

/** The media types a portrait may be; no SVG, which can carry script. */
export const PORTRAIT_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
];

/** Why a file cannot be a portrait, or `undefined` when it can. */
export function portraitRefusal(file: Pick<Blob, 'size' | 'type'>): 'type' | 'size' | undefined {
  if (!PORTRAIT_TYPES.includes(file.type)) return 'type';
  return file.size > PORTRAIT_MAX_BYTES ? 'size' : undefined;
}

export function isTokenFrame(value: unknown): value is TokenFrame {
  return TOKEN_FRAMES.some((frame) => frame === value);
}

/** What changing a portrait gives: the new blob id (none after removing), or why nothing changed. */
export type PortraitResult =
  | { ok: true; blobId: string | undefined }
  | { ok: false; code: 'type' | 'size' | 'notStored'; message: string };

const notStored = (id: string): PortraitResult => ({
  ok: false,
  code: 'notStored',
  message: `Character ${id} is not stored, or does not open.`,
});

/** Makes `file` the portrait of the stored character `characterId`, with the token's `frame`. */
export async function setPortrait(
  characterId: string,
  file: Blob,
  frame: TokenFrame,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<PortraitResult> {
  const refusal = portraitRefusal(file);
  if (refusal !== undefined) {
    return { ok: false, code: refusal, message: `The file is refused: ${refusal}.` };
  }
  return database.transaction('rw', database.characters, database.blobs, async () => {
    const stored = await openCharacter(characterId, database.characters);
    if (!stored.ok) return notStored(characterId);
    const blobId = crypto.randomUUID();
    await database.blobs.put({ id: blobId, data: file, type: file.type, frame });
    const saved = await saveCharacter(
      revised({ ...stored.value, portraitBlobId: blobId }, now),
      database.characters,
    );
    if (!saved.ok) throw new Error(saved.message);
    const before = stored.value.portraitBlobId;
    if (before !== undefined) await database.blobs.delete(before);
    return { ok: true, blobId };
  });
}

/** Takes the portrait off the stored character `characterId` and drops its blob. */
export async function removePortrait(
  characterId: string,
  now = new Date().toISOString(),
  database: GrimoireDb = db,
): Promise<PortraitResult> {
  return database.transaction('rw', database.characters, database.blobs, async () => {
    const stored = await openCharacter(characterId, database.characters);
    if (!stored.ok) return notStored(characterId);
    const { portraitBlobId, ...rest } = stored.value;
    if (portraitBlobId === undefined) return { ok: true, blobId: undefined };
    const saved = await saveCharacter(
      revised(rest as typeof stored.value, now),
      database.characters,
    );
    if (!saved.ok) throw new Error(saved.message);
    await database.blobs.delete(portraitBlobId);
    return { ok: true, blobId: undefined };
  });
}

/** Sets the token's frame on the portrait of the stored character `characterId`. */
export async function setTokenFrame(
  characterId: string,
  frame: TokenFrame,
  database: GrimoireDb = db,
): Promise<PortraitResult> {
  return database.transaction('rw', database.characters, database.blobs, async () => {
    const stored = await openCharacter(characterId, database.characters);
    if (!stored.ok) return notStored(characterId);
    const blobId = stored.value.portraitBlobId;
    if (blobId !== undefined) await database.blobs.update(blobId, { frame });
    return { ok: true, blobId };
  });
}
