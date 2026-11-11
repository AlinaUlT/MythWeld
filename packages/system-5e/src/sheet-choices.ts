import { applyEntry, type ContentIndex, changeTo, compute } from '@grimoire/engine';
import type { LogChange, LogEntry } from '@grimoire/schema';
import { HP_CURRENT_PATH } from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';
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

// SHEET-85: a pick can raise the maximum hit points (the hill dwarf's Dwarven Toughness, +1). The
// form stores the current hit points at the maximum it computes at creation, before any pick. So
// a character at full hit points follows the maximum up, and one below full keeps what it has
// (SPEC §6.7 golden A: 12 hit points once the hill dwarf is picked; ADR 019 item 1).
// SHEET-88: a pick taken back can lower the maximum; the current hit points then never stay above it.

/** The whole-number maximum hit points of `character`, or `undefined` when it has none to speak of. */
function maximumOf(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
): number | undefined {
  const max = compute(character, index, fifthEditionModule).values['hp.max'];
  return typeof max === 'number' && Number.isInteger(max) && max > 0 ? max : undefined;
}

/**
 * `entry`, with one change more when it moves the maximum hit points under the current ones: a
 * character at full follows a maximum that rises, and a character above a maximum that falls goes
 * down to it. The change is in the same entry, so one "Undo" gives both back. Any other entry
 * comes back as it is: the character is below full when the maximum rises (so a character at 0 is
 * not healed), the maximum falls but is still at or above the current hit points, or the entry
 * cannot be applied.
 */
export function followMaximum(
  character: FifthEditionCharacter,
  entry: LogEntry,
  index: ContentIndex<FifthEditionEntity>,
): LogEntry {
  const before = maximumOf(character, index);
  if (before === undefined) return entry;
  const { current } = character.systemData.state.hp;
  const applied = applyEntry(character, entry);
  if (!applied.ok) return entry;
  const after = maximumOf(applied.character, index);
  if (after === undefined) return entry;
  const follows = after > before ? current === before : after < before && current > after;
  if (!follows) return entry;
  return { ...entry, changes: [...entry.changes, changeTo(character, HP_CURRENT_PATH, after)] };
}
