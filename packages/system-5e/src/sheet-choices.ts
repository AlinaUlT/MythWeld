import { changeTo } from '@grimoire/engine';
import type { LogChange } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import { SIZE_PATH } from './size';

// SHEET-36: a pending key (ENG-48): a key path whose own key is a choice not yet made. Where the
// answer is stored is the module's: the size is `systemData.species.size`, not `choices`. The
// choices badge answers each one from its list of keys (SPEC §7.2, "What needs choosing").

/** How a pending key is answered: the entry type that names its keys, and the change that stores one. */
export interface PendingKeyAnswer {
  /** The entry type each of its keys names (`size`), so the screen can name them. */
  type: string;
  /** The change that stores `key`, or `undefined` when the character has no place to keep it. */
  answer(character: FifthEditionCharacter, key: string): LogChange[] | undefined;
}

/** The place a size is stored (ENG-48 §3). */
const SIZE_STORED = ['systemData', 'species', 'size'] as const;

/** How the pending key at `path` is answered, or `undefined` for a path this module cannot answer. */
export function fifthEditionPendingKey(path: string): PendingKeyAnswer | undefined {
  if (path !== SIZE_PATH) return undefined;
  return {
    type: 'size',
    answer: (character, key) =>
      character.systemData.species === undefined
        ? undefined
        : [changeTo(character, SIZE_STORED, key)],
  };
}
