// SETUP-06: the one Dexie database. Version 1 has no tables: each table arrives with the ticket
// that first stores into it (SPEC §11 lists them), as a new version with its own primary key.
import Dexie from 'dexie';

// The IndexedDB name. Saved data lives under it, so it never changes, even if the app is renamed.
export const DB_NAME = 'grimoire';

export class GrimoireDb extends Dexie {
  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({});
  }
}

export const db = new GrimoireDb();
