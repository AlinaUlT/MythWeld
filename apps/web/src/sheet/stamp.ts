// SHEET-46: who makes a change from the sheet, when, and the new entry's id. The engine has no
// clock and no random source, so the screen gives them (ENG-26); the player is the sheet's
// character (SHEET-23's changes are the player's, a game master's come with the table link).
import type { LogStamp } from '@grimoire/engine';
import type { AppCharacter } from '../systems';

/** The stamp of a change `character`'s player makes now. */
export function playerStamp(character: AppCharacter, now = new Date()): LogStamp {
  return {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    by: { role: 'player', name: character.name, actorId: character.id },
  };
}
