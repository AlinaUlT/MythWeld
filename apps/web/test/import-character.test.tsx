import 'fake-indexeddb/auto';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { deleteCharacter, exportCharacter } from '../src/db/characterActions';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { IMPORT_MAX_BYTES, importCharacterFile } from '../src/db/importCharacter';
import i18n from '../src/i18n';
import { ImportFile } from '../src/pages/ImportFile';
import { ToastView } from '../src/shared/ToastHost';

// SHEET-26: golden B (2024) and golden A (2014) of SPEC §6.7 are the files. An older file is
// golden B with the fields the later versions added taken out (ENG-58's `deathSaves.stable`,
// ENG-56's `languageSource`), so its migrated result is golden B itself.

const b = fifthEditionCharacterSchema.parse(goldenB);
const now = '2026-11-03T16:00:00.000Z';
const t = i18n.getFixedT('en', 'characters');

/** Golden B as a file text, with `change` applied to a copy of its object first. */
// biome-ignore lint/suspicious/noExplicitAny: a test edits a file's JSON at will.
type Json = Record<string, any>;

function fileOf(change: (file: Json) => void = () => {}): string {
  const file = JSON.parse(JSON.stringify(goldenB));
  change(file);
  return JSON.stringify(file);
}

describe('SHEET-26 importing a character file', () => {
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

  const rows = () => database.characters.toArray();

  it("restores an exported character exactly: the export's text, imported, is the stored row", async () => {
    await saveCharacter(b, database.characters);
    const exported = await exportCharacter(b.id, database);
    if (!exported.ok) throw new Error('not exported');
    const before = await database.characters.get(b.id);
    await deleteCharacter(b.id, database);
    expect(await rows()).toEqual([]);
    const result = await importCharacterFile(exported.file.text, database, now);
    expect(result).toMatchObject({ ok: true, again: false, from: {} });
    expect(await database.characters.get(b.id)).toEqual(before);
  });

  it('migrates an older file and stores it at the current versions', async () => {
    const old = fileOf((file) => {
      file.systemSchemaVersion = 2;
      delete file.systemData.languageSource;
      delete file.systemData.state.deathSaves.stable;
    });
    const result = await importCharacterFile(old, database, now);
    if (!result.ok) throw new Error(result.message);
    expect(result.from).toMatchObject({ systemSchemaVersion: 2 });
    expect(result.character).toEqual(b);
    expect(await database.characters.get(b.id)).toEqual(b);
  });

  it('stores a 2014 character too, opening it at once', async () => {
    const result = await importCharacterFile(JSON.stringify(goldenA), database, now);
    expect(result.ok).toBe(true);
    expect((await openCharacter(goldenA.id, database.characters)).ok).toBe(true);
  });

  it('never replaces a character with the same id: it is stored as a new one', async () => {
    await saveCharacter({ ...b, name: 'Mine' }, database.characters);
    const result = await importCharacterFile(fileOf(), database, now);
    if (!result.ok) throw new Error(result.message);
    expect(result.again).toBe(true);
    expect(result.character.id).not.toBe(b.id);
    expect(result.character).toMatchObject({ name: 'Golden B', updatedAt: now });
    const stored = await rows();
    expect(stored).toHaveLength(2);
    expect(stored.find((row) => row.id === b.id)).toMatchObject({ name: 'Mine' });
  });

  it('brings no rolls, no changes and no picture, and keeps the id of a picture it names', async () => {
    const portrait = '0f1e2d3c-4b5a-4697-8877-665544332211';
    const result = await importCharacterFile(
      fileOf((file) => {
        file.portraitBlobId = portrait;
      }),
      database,
      now,
    );
    expect(result.ok).toBe(true);
    expect((await database.characters.get(b.id))?.portraitBlobId).toBe(portrait);
    expect(await database.rollLog.count()).toBe(0);
    expect(await database.history.count()).toBe(0);
    expect(await database.blobs.count()).toBe(0);
  });

  it('refuses text that is not JSON, or JSON that is not one character, storing nothing', async () => {
    expect(await importCharacterFile('{', database, now)).toMatchObject({ code: 'notJson' });
    expect(await importCharacterFile('', database, now)).toMatchObject({ code: 'notJson' });
    for (const text of ['[]', 'null', '"x"', '42']) {
      expect(await importCharacterFile(text, database, now)).toMatchObject({
        ok: false,
        code: 'notACharacter',
      });
    }
    expect(await rows()).toEqual([]);
  });

  it('refuses a file of a system the app does not have, or that names none', async () => {
    const other = fileOf((file) => {
      file.system = 'zz';
    });
    expect(await importCharacterFile(other, database, now)).toMatchObject({
      code: 'unknownSystem',
    });
    const none = fileOf((file) => {
      delete file.system;
    });
    expect(await importCharacterFile(none, database, now)).toMatchObject({ code: 'unknownSystem' });
    expect(await rows()).toEqual([]);
  });

  it('refuses a file saved by a newer version, in either version field', async () => {
    const newerCore = fileOf((file) => {
      file.schemaVersion = 4;
    });
    const newerSystem = fileOf((file) => {
      file.systemSchemaVersion = 12;
    });
    for (const text of [newerCore, newerSystem]) {
      expect(await importCharacterFile(text, database, now)).toMatchObject({
        ok: false,
        code: 'newer',
      });
    }
    expect(await rows()).toEqual([]);
  });

  it('refuses a file that fails the schema, with the reason in its message, storing nothing', async () => {
    const noName = fileOf((file) => {
      delete file.name;
    });
    const result = await importCharacterFile(noName, database, now);
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    expect(result.ok ? '' : result.message).toContain('name');
    const badScore = fileOf((file) => {
      file.abilities.base.str = 'strong';
    });
    expect(await importCharacterFile(badScore, database, now)).toMatchObject({ code: 'invalid' });
    const badId = fileOf((file) => {
      file.id = 'not-a-uuid';
    });
    expect(await importCharacterFile(badId, database, now)).toMatchObject({ code: 'invalid' });
    expect(await rows()).toEqual([]);
  });

  it('refuses text over the limit before it reads it', async () => {
    const big = 'x'.repeat(IMPORT_MAX_BYTES + 1);
    expect(await importCharacterFile(big, database, now)).toMatchObject({ code: 'tooBig' });
    expect(await rows()).toEqual([]);
  });
});

describe('SHEET-26 what a person sees', () => {
  it('draws "Import file" as a button with a hidden file input for JSON', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ImportFile />
      </MemoryRouter>,
    );
    expect(html).toContain(`${t('import')}</button>`);
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="application/json,.json"');
    expect(html).not.toContain('role="alert"');
  });

  it('words every refusal, and the toast of an import', () => {
    const codes = [
      'tooBig',
      'notJson',
      'notACharacter',
      'newer',
      'invalid',
      'unknownSystem',
      'failed',
    ] as const;
    for (const code of codes) {
      expect(t(`importRefused.${code}`, { max: 5 })).not.toContain('importRefused');
    }
    const tt = i18n.getFixedT('en', 'toast');
    const plain = renderToStaticMarkup(
      <ToastView toast={{ kind: 'imported', name: 'Golden B', again: false }} />,
    );
    expect(plain).toContain(tt('imported', { name: 'Golden B' }));
    expect(plain).not.toContain('<button');
    const again = renderToStaticMarkup(
      <ToastView toast={{ kind: 'imported', name: 'Golden B', again: true }} />,
    );
    expect(again).toContain('imported as a new character');
  });
});
