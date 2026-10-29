// SHEET-48: a tracker's button on the sheet makes its change through the engine's action and
// records it through `changeCharacter`, so the "Undo" toast follows (SHEET-23). The action takes
// the stamp, since the engine has no clock and no random source (ENG-26).
import type { ActionResult, LogStamp } from '@grimoire/engine';
import { changeCharacter } from '../shared/undo';
import type { AppCharacter } from '../systems';

/** Runs `make` for the open character, and records the change it gives; a refusal changes nothing. */
export function act(
  character: AppCharacter,
  make: (stamp: LogStamp) => ActionResult<AppCharacter>,
): void {
  const made = make({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    by: { role: 'player', name: character.name, actorId: character.id },
  });
  if (!made.ok) {
    console.error(made.message);
    return;
  }
  changeCharacter(character.id, made.entry).then(
    (recorded) => {
      if (!recorded.ok) console.error(recorded.message);
    },
    (error: unknown) => console.error(error),
  );
}
