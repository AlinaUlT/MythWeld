import 'fake-indexeddb/auto';
import { FIFTH_EDITION_SCHEMA_VERSION, fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { exportCharacter } from '../src/db/characterActions';
import { IMPORT_MAX_BYTES, type ImportSource, importCharacter } from '../src/db/characterImport';
import { saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import i18n from '../src/i18n';
import { issueLines, reasonText } from '../src/shared/CharacterImport';

// SHEET-26: golden A and golden B of SPEC §6.7 are the characters in the files. Their expected
// values are the goldens themselves; no number is copied from the code's output.

const a = fifthEditionCharacterSchema.parse(goldenA);
const b = fifthEditionCharacterSchema.parse(goldenB);
const now = '2026-10-29T12:00:00.000Z';
const t = i18n.getFixedT('en', 'characters');
const copyName = (name: string) => `${name} (copy)`;

/** A file holding `text`, as the picker gives it. */
const fileOf = (text: string): ImportSource => ({ size: text.length, text: async () => text });
const fileJson = (value: unknown) => fileOf(JSON.stringify(value));

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
  database = new GrimoireDb(`sheet-26-${count}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

const imported = (source: ImportSource) => importCharacter(source, copyName, now, database);
const stored = () => database.characters.toArray();

describe('SHEET-26 Import', () => {
  it('stores a file of the current versions as it is: same id, revision and times', async () => {
    const result = await imported(fileJson(goldenB));
    expect(result).toEqual({ ok: true, character: b, renamed: false });
    expect(await stored()).toEqual([b]);
  });

  it('migrates an older file to the current versions, and leaves the file as it was', async () => {
    const text = JSON.stringify(version2());
    const result = await imported(fileOf(text));
    expect(result).toMatchObject({ ok: true, renamed: false });
    const [row] = await stored();
    expect(row).toMatchObject({
      id: goldenA.id,
      schemaVersion: 2,
      systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
    });
    expect(fifthEditionCharacterSchema.parse(row)).toEqual(a);
    expect(text).toBe(JSON.stringify(version2()));
  });

  it('opens a file that starts with a byte-order mark', async () => {
    const result = await imported(fileOf(`﻿${JSON.stringify(goldenA)}`));
    expect(result).toMatchObject({ ok: true });
    expect(await stored()).toEqual([a]);
  });

  it('never replaces a stored character: a file with a taken id is stored as a new one', async () => {
    const edited = { ...a, rev: 7, name: 'Edited on this device' };
    await saveCharacter(edited, database.characters);
    const result = await imported(fileJson(goldenA));
    if (!result.ok) throw new Error(result.message);
    expect(result.renamed).toBe(true);
    expect(result.character).toEqual({
      ...a,
      id: result.character.id,
      rev: 0,
      createdAt: now,
      updatedAt: now,
      name: `${a.name} (copy)`,
    });
    expect(result.character.id).not.toBe(goldenA.id);
    const rows = await stored();
    expect(rows).toHaveLength(2);
    expect(await database.characters.get(goldenA.id)).toEqual(edited);
  });

  it('round-trips: an exported character imports into a clean database as the same character', async () => {
    await saveCharacter(b, database.characters);
    const exported = await exportCharacter(goldenB.id, database);
    if (!exported.ok) throw new Error(exported.message);
    const clean = new GrimoireDb('sheet-26-clean');
    try {
      await clean.open();
      const result = await importCharacter(fileOf(exported.file.text), copyName, now, clean);
      expect(result).toEqual({ ok: true, character: b, renamed: false });
      expect(await clean.characters.toArray()).toEqual([b]);
    } finally {
      await clean.delete();
    }
  });
});

describe('SHEET-26 Import refusals', () => {
  /** Stores golden A, imports `source`, and checks the table is as it was. */
  async function refused(source: ImportSource) {
    await saveCharacter(a, database.characters);
    const result = await imported(source);
    expect(await stored()).toEqual([a]);
    if (result.ok) throw new Error('The file was imported.');
    expect(result.message).not.toBe('');
    return result;
  }

  it('refuses a file larger than 5 MB without reading it', async () => {
    let read = false;
    const result = await refused({
      size: IMPORT_MAX_BYTES + 1,
      text: async () => {
        read = true;
        return '{}';
      },
    });
    expect(result).toMatchObject({ code: 'tooLarge', size: IMPORT_MAX_BYTES + 1 });
    expect(read).toBe(false);
    expect(reasonText(result, t)).toBe('The file is larger than 5 MB.');
  });

  it('refuses a file that cannot be read', async () => {
    const result = await refused({
      size: 1,
      text: async () => {
        throw new Error('gone');
      },
    });
    expect(result).toMatchObject({ code: 'unreadable' });
    expect(reasonText(result, t)).toBe('The file could not be read.');
  });

  it('refuses text that is not JSON', async () => {
    const result = await refused(fileOf('{"name": '));
    expect(result).toMatchObject({ code: 'notJson' });
    expect(reasonText(result, t)).toBe('The file is not JSON text.');
  });

  it.each([
    ['a list', '[]'],
    ['a number', '12'],
    ['null', 'null'],
    ['an object with no system', '{"id": "x"}'],
    ['an object whose system is not text', '{"system": 5}'],
  ])('refuses %s as not a character file', async (_, text) => {
    const result = await refused(fileOf(text));
    expect(result).toMatchObject({ code: 'notACharacter' });
    expect(reasonText(result, t)).toBe('The file is not a character file.');
  });

  it('refuses a system the app does not carry', async () => {
    const result = await refused(fileJson({ ...goldenA, system: 'tales' }));
    expect(result).toMatchObject({ code: 'unknownSystem', system: 'tales' });
    expect(reasonText(result, t)).toBe('It is made for a game system this app does not have.');
  });

  it("refuses a version above the app's, naming the field and both numbers", async () => {
    const found = FIFTH_EDITION_SCHEMA_VERSION + 1;
    const result = await refused(fileJson({ ...goldenA, systemSchemaVersion: found }));
    expect(result).toMatchObject({
      code: 'newer',
      field: 'systemSchemaVersion',
      found,
      current: FIFTH_EDITION_SCHEMA_VERSION,
    });
    expect(reasonText(result, t)).toBe(
      `It was saved by a newer version of the app: its systemSchemaVersion is ${found}, and this app reads up to ${FIFTH_EDITION_SCHEMA_VERSION}. Update the app to import it.`,
    );
  });

  it('refuses a file that fails the schema, listing the first five checks and the rest', async () => {
    const broken = {
      ...goldenA,
      name: 7,
      rev: -1,
      createdAt: 'yesterday',
      ruleset: '2099',
      mode: 'lazy',
      kind: 3,
      packs: 'srd',
    };
    const { id: _, ...noId } = broken;
    const result = await refused(fileJson(noId));
    expect(result.code).toBe('invalid');
    if (result.code !== 'invalid') return;
    const lines = issueLines(result, t);
    expect(result.error.issues.length).toBeGreaterThan(5);
    expect(lines).toHaveLength(6);
    expect(lines.at(-1)).toBe(`and ${result.error.issues.length - 5} more`);
    expect(lines.slice(0, 5).every((line) => line.includes(': '))).toBe(true);
    expect(reasonText(result, t)).toBe('Its data failed these checks:');
  });

  it('lists a check on the whole file as "the file"', async () => {
    const result = await refused(fileJson({ system: a.system }));
    if (result.code !== 'invalid') throw new Error(result.code);
    expect(issueLines(result, t).length).toBeGreaterThan(0);
    expect(issueLines({ ok: false, code: 'notJson', message: '' }, t)).toEqual([]);
  });
});
