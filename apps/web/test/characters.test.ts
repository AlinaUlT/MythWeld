import 'fake-indexeddb/auto';
import { FIFTH_EDITION_SCHEMA_VERSION, fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { countCharacters, openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { CHARACTER_OPENERS, characterOpenerOf } from '../src/systems';

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

describe('SHEET-10 systems the app carries', () => {
  it("finds a system's opener by its id, and nothing for another name", () => {
    expect(Object.keys(CHARACTER_OPENERS)).toEqual(['5e']);
    expect(characterOpenerOf('5e')).toBe(CHARACTER_OPENERS['5e']);
    for (const name of ['tales', 'toString', '__proto__', 5, undefined]) {
      expect(characterOpenerOf(name)).toBeUndefined();
    }
  });
});
