import { describe, expect, it, vi } from 'vitest';
import { DB_NAME, db } from '../src/db/db';
import { requestPersistentStorage } from '../src/db/persist';

describe('SETUP-06 database', () => {
  it('is named grimoire, at version 1, with no tables yet', () => {
    expect(DB_NAME).toBe('grimoire');
    expect(db.name).toBe('grimoire');
    expect(db.verno).toBe(1);
    expect(db.tables).toEqual([]);
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
