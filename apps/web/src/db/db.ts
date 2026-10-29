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

/** One display choice of the person, keyed by its name; its value is checked as it is read (SHEET-13). */
export interface SettingRow {
  key: string;
  value: unknown;
}

/**
 * One roll, keyed by its record's id, at whatever version it was logged (SHEET-37, `rollLog.ts`);
 * `characterId` is absent for a roll made off a sheet.
 */
export interface RollLogRow extends StoredObject {
  id: string;
  characterId?: string;
  rolledAt: string;
}

/**
 * One change to a character, keyed by its log entry's id, at whatever version it was kept
 * (SHEET-23, `history.ts`).
 */
export interface HistoryRow extends StoredObject {
  id: string;
  characterId: string;
  at: string;
}

/** The frames of a portrait's token, one slot each (SHEET-03), in the board's order. */
export const TOKEN_FRAMES = ['thin', 'ring', 'double'] as const;
export type TokenFrame = (typeof TOKEN_FRAMES)[number];

/**
 * A file the person added (a portrait, an uploaded PDF form), keyed by its uuid. SHEET-56: a
 * portrait's row also holds the frame the person picked for its token, so Copy and Delete carry
 * it with the picture.
 */
export interface BlobRow {
  id: string;
  data: Blob;
  type: string;
  frame?: TokenFrame;
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
