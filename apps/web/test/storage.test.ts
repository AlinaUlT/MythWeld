import { describe, expect, it, vi } from 'vitest';
import { DB_NAME, db } from '../src/db/db';
import { requestPersistentStorage } from '../src/db/persist';

describe('SETUP-06 database', () => {
  it('is named grimoire', () => {
    expect(DB_NAME).toBe('grimoire');
    expect(db.name).toBe('grimoire');
  });
});

describe('SHEET-07 phase 2 tables', () => {
  it('arrive together in version 2, each with its primary key and indexes', () => {
    expect(db.verno).toBe(2);
    const tables = db.tables.map(({ name, schema }) => ({
      name,
      key: schema.primKey.keyPath,
      indexes: schema.indexes.map((index) => index.keyPath),
    }));
    expect(tables).toEqual([
      { name: 'characters', key: 'id', indexes: [] },
      { name: 'packs', key: 'id', indexes: [] },
      { name: 'settings', key: 'key', indexes: [] },
      { name: 'rollLog', key: 'id', indexes: [['characterId', 'rolledAt']] },
      { name: 'history', key: 'id', indexes: [['characterId', 'at']] },
      { name: 'blobs', key: 'id', indexes: [] },
    ]);
  });

  it('key every table by a value the row carries, never by an auto-increment', () => {
    expect(
      db.tables.filter((table) => table.schema.primKey.auto).map((table) => table.name),
    ).toEqual([]);
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
