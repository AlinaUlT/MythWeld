import 'fake-indexeddb/auto';
import { FIFTH_EDITION_SCHEMA_VERSION, fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import {
  countCharacters,
  listCharacters,
  openCharacter,
  saveCharacter,
} from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import {
  CHARACTER_LIST_LINES,
  CHARACTER_OPENERS,
  characterOpenerOf,
  listLineOf,
} from '../src/systems';

// Golden A of SPEC §6.7 is the saved character; the older and broken rows are made from it.

const saved = fifthEditionCharacterSchema.parse(goldenA);

/** Golden A as a file of fifth edition's version 2 stores it: no `languageSource`, no `stable`. */
function version2() {
  const { languageSource: _, ...data } = goldenA.systemData;
  const { stable: __, ...deathSaves } = data.state.deathSaves;
  return {
    ...goldenA,
    systemSchemaVersion: 2,
    systemData: { ...data, state: { ...data.state, deathSaves } },
  };
}

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-10-${count}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

describe('SHEET-10 characters on the device', () => {
  it('stores a saved character and opens it as it was saved', async () => {
    const result = await saveCharacter(saved, database.characters);
    expect(result).toEqual({
      ok: true,
      value: saved,
      from: { schemaVersion: 2, systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION },
    });
    expect(await database.characters.get(goldenA.id)).toEqual(saved);
    expect(await openCharacter(goldenA.id, database.characters)).toEqual(result);
  });

  it('opens an older row migrated to the current versions, and leaves the row as it was', async () => {
    const old = version2();
    await database.characters.put(old);
    expect(await openCharacter(goldenA.id, database.characters)).toEqual({
      ok: true,
      value: saved,
      from: { schemaVersion: 2, systemSchemaVersion: 2 },
    });
    expect(saved.systemData.languageSource).toBe('species');
    expect(saved.systemData.state.deathSaves.stable).toBe(false);
    expect(await database.characters.get(goldenA.id)).toEqual(old);
  });

  it('stores the current versions over an older row on the next save', async () => {
    await database.characters.put(version2());
    const opened = await openCharacter(goldenA.id, database.characters);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    await saveCharacter(opened.value, database.characters);
    expect(await database.characters.get(goldenA.id)).toMatchObject({
      schemaVersion: 2,
      systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
    });
    expect(await database.characters.count()).toBe(1);
  });

  it('refuses a row saved by a newer app, and leaves it as it was', async () => {
    const newer = { ...goldenA, systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION + 1 };
    await database.characters.put(newer);
    expect(await openCharacter(goldenA.id, database.characters)).toMatchObject({
      ok: false,
      code: 'newer',
      field: 'systemSchemaVersion',
      found: FIFTH_EDITION_SCHEMA_VERSION + 1,
      current: FIFTH_EDITION_SCHEMA_VERSION,
    });
    expect(await database.characters.get(goldenA.id)).toEqual(newer);
  });

  it('refuses a row its schema does not read, and leaves it as it was', async () => {
    const broken = { ...goldenA, name: 7 };
    await database.characters.put(broken);
    const opened = await openCharacter(goldenA.id, database.characters);
    expect(opened).toMatchObject({ ok: false, code: 'invalid' });
    expect(
      opened.ok === false && opened.code === 'invalid' && opened.error.issues[0]?.path,
    ).toEqual(['name']);
    expect(await database.characters.get(goldenA.id)).toEqual(broken);
  });

  it('refuses a row of a system the app does not carry, and leaves it as it was', async () => {
    const other = { ...goldenA, system: 'tales' };
    const none = { id: '6c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5', name: 'No system' };
    await database.characters.bulkPut([other, none]);
    expect(await openCharacter(other.id, database.characters)).toMatchObject({
      ok: false,
      code: 'unknownSystem',
      system: 'tales',
    });
    expect(await openCharacter(none.id, database.characters)).toMatchObject({
      ok: false,
      code: 'unknownSystem',
      system: undefined,
    });
    expect(await database.characters.bulkGet([other.id, none.id])).toEqual([other, none]);
  });

  it('says when no row has the id', async () => {
    expect(await openCharacter(goldenA.id, database.characters)).toMatchObject({
      ok: false,
      code: 'notFound',
      id: goldenA.id,
    });
  });

  it('stores nothing its schema refuses', async () => {
    const broken = { ...saved, abilities: { base: { str: 13.5 } } };
    expect(await saveCharacter(broken, database.characters)).toMatchObject({
      ok: false,
      code: 'invalid',
    });
    expect(await database.characters.count()).toBe(0);
  });
});

describe('SHEET-12 the count of stored characters', () => {
  it('counts every stored row, one that does not open too', async () => {
    expect(await countCharacters(database.characters)).toBe(0);
    await saveCharacter(saved, database.characters);
    expect(await countCharacters(database.characters)).toBe(1);
    const none = { id: '6c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5', name: 'No system' };
    await database.characters.put(none);
    expect(await openCharacter(none.id, database.characters)).toMatchObject({ ok: false });
    expect(await countCharacters(database.characters)).toBe(2);
  });
});

describe('SHEET-24 listing the characters on the device', () => {
  const savedB = fifthEditionCharacterSchema.parse(goldenB);

  it('lists nothing from an empty table', async () => {
    expect(await listCharacters(database.characters)).toEqual([]);
  });

  it('lists every row opened, the newest change first, and writes none', async () => {
    const older = { ...saved, updatedAt: '2026-10-01T09:00:00.000Z' };
    const newer = { ...savedB, updatedAt: '2026-10-03T09:00:00.000Z' };
    const old = { ...version2(), id: '6c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5' };
    await database.characters.bulkPut([older, newer, old]);
    const listed = await listCharacters(database.characters);
    // Golden A's own `updatedAt` is 2026-10-02, between the two.
    expect(listed.map(({ id }) => id)).toEqual([newer.id, old.id, older.id]);
    expect(listed.map(({ name }) => name)).toEqual(['Golden B', 'Golden A', 'Golden A']);
    expect(listed[0]?.opened).toEqual({
      ok: true,
      value: newer,
      from: { schemaVersion: 2, systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION },
    });
    expect(listed[1]?.opened).toMatchObject({ ok: true, from: { systemSchemaVersion: 2 } });
    expect(await database.characters.toArray()).toEqual([older, newer, old].sort(byId));
  });

  it('lists a row that does not open with its reason and its stored name', async () => {
    const newer = { ...goldenA, systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION + 1 };
    const broken = { ...goldenB, abilities: 'none' };
    const other = { ...goldenA, id: '6c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5', system: 'tales' };
    const bare = { id: '00000000-0000-4000-8000-000000000001', name: 7 };
    await database.characters.bulkPut([newer, broken, other, bare]);
    const listed = await listCharacters(database.characters);
    // A, its copy and B share an `updatedAt`, so their ids order them; the bare row has no time.
    expect(listed.map(({ id, name, opened }) => [id, name, opened.ok || opened.code])).toEqual([
      [goldenA.id, 'Golden A', 'newer'],
      [other.id, 'Golden A', 'unknownSystem'],
      [goldenB.id, 'Golden B', 'invalid'],
      [bare.id, undefined, 'unknownSystem'],
    ]);
    expect(await database.characters.count()).toBe(4);
  });
});

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);

describe('SHEET-10 systems the app carries', () => {
  it("finds a system's opener by its id, and nothing for another name", () => {
    expect(Object.keys(CHARACTER_OPENERS)).toEqual(['5e']);
    expect(characterOpenerOf('5e')).toBe(CHARACTER_OPENERS['5e']);
    for (const name of ['tales', 'toString', '__proto__', 5, undefined]) {
      expect(characterOpenerOf(name)).toBeUndefined();
    }
  });
});

describe('SHEET-24 each system names its list line', () => {
  it("reads the line of the character's own system", () => {
    expect(Object.keys(CHARACTER_LIST_LINES)).toEqual(['5e']);
    expect(listLineOf(fifthEditionCharacterSchema.parse(goldenB))).toEqual([
      { id: 'srd-2024:species/human' },
      { id: 'srd-2024:class/fighter', level: 1 },
    ]);
  });
});
