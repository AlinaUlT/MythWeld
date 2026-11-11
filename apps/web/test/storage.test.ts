import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, db, GrimoireDb } from '../src/db/db';
import { requestPersistentStorage } from '../src/db/persist';

describe('SETUP-06 database', () => {
  it('is named grimoire', () => {
    expect(DB_NAME).toBe('grimoire');
    expect(db.name).toBe('grimoire');
  });
});

// CONT-02: the tables, as the database holds them now. SHEET-07's six are as version 2 made them;
// version 3 adds `bookmarks` and `entityIndex`.
const TABLES = {
  characters: { key: 'id', indexes: [] },
  packs: { key: 'id', indexes: [] },
  settings: { key: 'key', indexes: [] },
  rollLog: { key: 'id', indexes: [['characterId', 'rolledAt']] },
  history: { key: 'id', indexes: [['characterId', 'at']] },
  blobs: { key: 'id', indexes: [] },
  bookmarks: { key: 'id', indexes: ['addedAt'] },
  entityIndex: { key: 'id', indexes: ['packId', 'type'] },
};

function tablesOf(database: GrimoireDb) {
  return Object.fromEntries(
    database.tables.map(({ name, schema }) => [
      name,
      { key: schema.primKey.keyPath, indexes: schema.indexes.map((index) => index.keyPath) },
    ]),
  );
}

describe('SHEET-07 and CONT-02 tables', () => {
  it('are the six of phase 2 and the two of phase 3, each with its primary key and indexes', () => {
    expect(db.verno).toBe(3);
    expect(tablesOf(db)).toEqual(TABLES);
  });

  it('key every table by a value the row carries, never by an auto-increment', () => {
    expect(
      db.tables.filter((table) => table.schema.primKey.auto).map((table) => table.name),
    ).toEqual([]);
  });
});

describe('CONT-02 the upgrade from version 2', () => {
  const opened: Dexie[] = [];
  afterEach(async () => {
    for (const database of opened.splice(0)) {
      database.close();
      await Dexie.delete(database.name);
    }
  });

  // The database as SHEET-07 left it, written out here so a later edit of `db.ts` cannot change it.
  async function versionTwo(name: string): Promise<Dexie> {
    const old = new Dexie(name);
    opened.push(old);
    old.version(1).stores({});
    old.version(2).stores({
      characters: 'id',
      packs: 'id',
      settings: 'key',
      rollLog: 'id, [characterId+rolledAt]',
      history: 'id, [characterId+at]',
      blobs: 'id',
    });
    await old.open();
    return old;
  }

  it('keeps every row a version 2 database holds and adds both tables empty', async () => {
    const name = 'cont-02-upgrade';
    const old = await versionTwo(name);
    await old.table('characters').put({ id: 'c1', name: 'Kept' });
    await old.table('packs').put({ id: 'srd-2014' });
    await old.table('settings').put({ key: 'theme', value: 'dark' });
    await old
      .table('rollLog')
      .put({ id: 'r1', characterId: 'c1', rolledAt: '2026-11-11T10:00:00Z' });
    await old.table('history').put({ id: 'h1', characterId: 'c1', at: '2026-11-11T10:00:00Z' });
    await old.table('blobs').put({ id: 'b1', kind: 'portrait' });
    expect(old.verno).toBe(2);
    old.close();

    const upgraded = new GrimoireDb(name);
    opened.push(upgraded);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);
    expect(tablesOf(upgraded)).toEqual(TABLES);
    expect(await upgraded.characters.toArray()).toEqual([{ id: 'c1', name: 'Kept' }]);
    expect(await upgraded.packs.toArray()).toEqual([{ id: 'srd-2014' }]);
    expect(await upgraded.settings.toArray()).toEqual([{ key: 'theme', value: 'dark' }]);
    expect(await upgraded.rollLog.count()).toBe(1);
    expect(await upgraded.history.count()).toBe(1);
    expect(await upgraded.blobs.toArray()).toEqual([{ id: 'b1', kind: 'portrait' }]);
    expect(await upgraded.bookmarks.count()).toBe(0);
    expect(await upgraded.entityIndex.count()).toBe(0);
  });

  it('opens a database that never existed straight at version 3, with both tables empty', async () => {
    const fresh = new GrimoireDb('cont-02-fresh');
    opened.push(fresh);
    await fresh.open();
    expect(fresh.verno).toBe(3);
    expect(await fresh.bookmarks.count()).toBe(0);
    expect(await fresh.entityIndex.count()).toBe(0);
  });

  it('reads the new tables by their indexes: bookmarks by time, the index by pack and by type', async () => {
    const database = new GrimoireDb('cont-02-indexes');
    opened.push(database);
    await database.bookmarks.bulkPut([
      { id: 'srd-2014:spell:fireball', addedAt: '2026-11-11T09:00:00Z' },
      { id: 'srd-2024:spell:fireball', addedAt: '2026-11-11T08:00:00Z' },
    ]);
    expect((await database.bookmarks.orderBy('addedAt').toArray()).map((row) => row.id)).toEqual([
      'srd-2024:spell:fireball',
      'srd-2014:spell:fireball',
    ]);
    await database.entityIndex.bulkPut([
      { id: 'srd-2014:spell:fireball', packId: 'srd-2014', type: 'spell' },
      { id: 'srd-2014:condition:blinded', packId: 'srd-2014', type: 'condition' },
      { id: 'srd-2024:spell:fireball', packId: 'srd-2024', type: 'spell' },
    ]);
    expect(await database.entityIndex.where('packId').equals('srd-2014').count()).toBe(2);
    expect(await database.entityIndex.where('type').equals('spell').count()).toBe(2);
    // A pack's rows go together when the packs in use change.
    await database.entityIndex.where('packId').equals('srd-2014').delete();
    expect((await database.entityIndex.toArray()).map((row) => row.id)).toEqual([
      'srd-2024:spell:fireball',
    ]);
  });
});

describe('SETUP-06 persistent storage', () => {
  it('asks when storage is not persistent yet, and passes on a yes', async () => {
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) };
    await expect(requestPersistentStorage(storage)).resolves.toBe('granted');
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('passes on a no', async () => {
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => false) };
    await expect(requestPersistentStorage(storage)).resolves.toBe('denied');
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again once storage is persistent', async () => {
    const storage = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) };
    await expect(requestPersistentStorage(storage)).resolves.toBe('granted');
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('reports unsupported when the browser has no Storage API', async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBe('unsupported');
    await expect(requestPersistentStorage({})).resolves.toBe('unsupported');
    // Node has `navigator` but no `navigator.storage`: the default argument takes the same path.
    await expect(requestPersistentStorage()).resolves.toBe('unsupported');
  });
});
