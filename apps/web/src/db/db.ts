// SETUP-06: the one Dexie database. Version 1 has no tables.
// SHEET-07: version 2 brings every table phase 2 stores into (SPEC §11), so the rows that run in
// parallel never each claim the next version. A primary key can never change once a table exists,
// so each table's key is fixed here; the row that first stores into a table gives its row the
// rest of its fields. `entityIndex` is phase 3's (search) and arrives with it.
import type { StoredObject } from '@grimoire/schema';
import Dexie, { type EntityTable } from 'dexie';

// The IndexedDB name. Saved data lives under it, so it never changes, even if the app is renamed.
export const DB_NAME = 'grimoire';

/**
 * A stored character, the file at whatever versions it was saved; it migrates as it opens
 * (SHEET-10, `characters.ts`).
 */
export interface CharacterRow extends StoredObject {
  id: string;
}

/** An installed pack, keyed by its pack id. */
export interface PackRow {
  id: string;
}

/** One display choice of the person (SHEET-13), keyed by its name. */
export interface SettingRow {
  key: string;
}

/** One roll, keyed by its record's id; `characterId` is absent for a roll made off a sheet. */
export interface RollLogRow {
  id: string;
  characterId?: string;
  rolledAt: string;
}

/** One change to a character, keyed by its log entry's id. */
export interface HistoryRow {
  id: string;
  characterId: string;
  at: string;
}

/** A file the person added (a portrait, an uploaded PDF form), keyed by its uuid. */
export interface BlobRow {
  id: string;
}

export class GrimoireDb extends Dexie {
  characters!: EntityTable<CharacterRow, 'id'>;
  packs!: EntityTable<PackRow, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  rollLog!: EntityTable<RollLogRow, 'id'>;
  history!: EntityTable<HistoryRow, 'id'>;
  blobs!: EntityTable<BlobRow, 'id'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({});
    // The compound indexes give one character's rows in time order: its last 100 rolls (SPEC
    // §6.5) and its last 50 changes (SPEC §7.2).
    this.version(2).stores({
      characters: 'id',
      packs: 'id',
      settings: 'key',
      rollLog: 'id, [characterId+rolledAt]',
      history: 'id, [characterId+at]',
      blobs: 'id',
    });
  }
}

export const db = new GrimoireDb();
