// SHEET-56: choosing a portrait. The picture and the frame go to the blob row the character's
// `portraitBlobId` names, made when the character has none; a new id is a change to the character
// like any other (`changeCharacter`, with its "Undo"). A later picture or frame replaces what the
// row holds, with no toast: the bytes cannot be kept in a log entry (ENG-30 holds JSON).

import { type OpenedCharacter, openCharacter } from '../db/characters';
import type { GrimoireDb } from '../db/db';
import { db } from '../db/db';
import type { ChangeResult } from '../db/history';
import type { PortraitFrame, PortraitPicture } from '../db/portraits';
import { changeCharacter } from '../shared/undo';
import { playerEntry } from './changes';

/** What the person chose: a frame, and a new picture when they picked one. */
export interface PortraitChoice {
  frame: PortraitFrame;
  picture?: PortraitPicture;
}

/** The id of the row that holds the portrait, or why nothing was stored. */
export type SavedPortrait =
  | { ok: true; id: string }
  | Exclude<OpenedCharacter, { ok: true }>
  | Exclude<ChangeResult, { ok: true }>;

/**
 * Stores `choice` for the character `characterId`: into its portrait row, which is made, and
 * named in the character, when it had none. When naming it fails, the new row is dropped.
 */
export async function savePortrait(
  characterId: string,
  choice: PortraitChoice,
  database: GrimoireDb = db,
  now?: string,
): Promise<SavedPortrait> {
  const opened = await openCharacter(characterId, database.characters);
  if (!opened.ok) return opened;
  const character = opened.value;
  const id = character.portraitBlobId ?? crypto.randomUUID();
  const kept = await database.blobs.get(id);
  await database.blobs.put({
    ...kept,
    id,
    kind: 'portrait',
    frame: choice.frame,
    ...(choice.picture !== undefined && { bytes: choice.picture.bytes, type: choice.picture.type }),
  });
  if (character.portraitBlobId === undefined) {
    const entry = playerEntry(character, 'setPortrait', 'portrait', [
      { path: ['portraitBlobId'], after: id },
    ]);
    const changed = await changeCharacter(characterId, entry, now, database);
    if (!changed.ok) {
      await database.blobs.delete(id);
      return changed;
    }
  }
  return { ok: true, id };
}
