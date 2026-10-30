// SHEET-48: the Features tab's two actions, each an engine action (ENG-30) whose log entry goes
// through `changeCharacter`, so the "Undo" toast follows it (SHEET-23). A refusal changes nothing:
// the tab only offers what the engine accepts, so it has no message of its own for one.
import { setToggle, useResource as spendResource } from '@grimoire/engine';
import type { Roller } from '@grimoire/schema';
import type { GrimoireDb } from '../db/db';
import type { ChangeResult } from '../db/history';
import { changeCharacter } from '../shared/undo';
import type { AppCharacter, AppComputed } from '../systems';

/** Who changes the character, and when: the player at the sheet, now. */
function stampOf(character: AppCharacter) {
  const by: Roller = { role: 'player', name: character.name, actorId: character.id };
  return { id: crypto.randomUUID(), at: new Date().toISOString(), by };
}

/** Spends one use of the resource `key`; `undefined` when the engine refuses. */
export async function spendUse(
  character: AppCharacter,
  computed: AppComputed,
  key: string,
  database?: GrimoireDb,
): Promise<ChangeResult | undefined> {
  const made = spendResource(character, computed, { key, count: 1 }, stampOf(character));
  return made.ok ? changeCharacter(character.id, made.entry, undefined, database) : undefined;
}

/** Sets the switch of the toggled effect `part`; `undefined` when the engine refuses. */
export async function switchFeature(
  character: AppCharacter,
  computed: AppComputed,
  part: string,
  on: boolean,
  database?: GrimoireDb,
): Promise<ChangeResult | undefined> {
  const made = setToggle(character, computed, { part, on }, stampOf(character));
  return made.ok ? changeCharacter(character.id, made.entry, undefined, database) : undefined;
}
