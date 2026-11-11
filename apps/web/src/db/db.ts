// SETUP-06: the one Dexie database. Version 1 has no tables.
// SHEET-07: version 2 brings every table phase 2 stores into (SPEC §11), so the rows that run in
// parallel never each claim the next version. A primary key can never change once a table exists,
// so each table's key is fixed here; the row that first stores into a table gives its row the
// rest of its fields.
// CONT-02: version 3 brings in the two tables phase 3 stores into (SPEC §11, ADR 014 item 13):
// `bookmarks` and `entityIndex`. Later phase 3 rows add fields to their rows, never a version; the
// indexes below are fixed here because an index too can only be added by a version.
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

/**
 * A file the person added (a portrait, an uploaded PDF form), keyed by its uuid. SHEET-56: a
 * portrait is `kind: 'portrait'` with its picture's `bytes` and `type` (a media type) and the
 * token `frame` the person picked; a row with a frame and no bytes is a frame chosen before an
 * image. Copy and Delete (SHEET-25) move the whole row, whatever it holds.
 */
export interface BlobRow {
  id: string;
  kind?: string;
  bytes?: ArrayBuffer;
  type?: string;
  frame?: string;
}

/**
 * One bookmark, keyed by the id of the entry or rule it marks, so an entry has at most one. It
 * lives on the device, outside any character (ADR 014 item 13). `addedAt` is an ISO time; it
 * orders the Bookmarks page (CONT-55 and CONT-56 give the row its other fields).
 */
export interface BookmarkRow {
  id: string;
  addedAt: string;
}

/**
 * One entity's entry in the search index, keyed by the entity's id (CONT-41 fills it). `packId`
 * lets a pack's rows be dropped and rebuilt when the packs in use change; `type` narrows a search
 * to one kind of entry.
 */
export interface EntityIndexRow {
  id: string;
  packId: string;
  type: string;
}

export class GrimoireDb extends Dexie {
  characters!: EntityTable<CharacterRow, 'id'>;
  packs!: EntityTable<PackRow, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  rollLog!: EntityTable<RollLogRow, 'id'>;
  history!: EntityTable<HistoryRow, 'id'>;
  blobs!: EntityTable<BlobRow, 'id'>;
  bookmarks!: EntityTable<BookmarkRow, 'id'>;
  entityIndex!: EntityTable<EntityIndexRow, 'id'>;

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
    // Only the new tables are named: Dexie keeps the others as version 2 made them. A person's
    // characters, packs, settings, rolls and history are not touched by the upgrade.
    this.version(3).stores({
      bookmarks: 'id, addedAt',
      entityIndex: 'id, packId, type',
    });
  }
}

export const db = new GrimoireDb();
