// SHEET-30: what every section and panel of the sheet reads: the character as stored, its content,
// what `compute()` gave, whether edit mode is on, and how to open a number's roll or breakdown.
// The frame gives it; a section never computes or loads on its own.
import { createContext, useContext } from 'react';
import type { CharacterContent } from '../content/packs';
import type { AppCharacter, AppComputed, SheetSystem } from '../systems';

export interface SheetValue {
  character: AppCharacter;
  content: CharacterContent;
  computed: AppComputed;
  system: SheetSystem;
  /** Edit mode; play mode, the default, changes only the trackers (SPEC §7.2). */
  editing: boolean;
  /** Opens the roll dialog for the number at `path` (SHEET-39). */
  roll(path: string): void;
  /** Opens the breakdown of the number at `path` (SHEET-33). */
  breakdown(path: string): void;
}

export const SheetContext = createContext<SheetValue | undefined>(undefined);

/** The open sheet; only a piece drawn inside the sheet's frame calls it. */
export function useSheet(): SheetValue {
  const sheet = useContext(SheetContext);
  if (sheet === undefined) throw new Error('useSheet is called outside the sheet.');
  return sheet;
}
