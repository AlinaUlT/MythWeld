import 'fake-indexeddb/auto';
import { FIFTH_EDITION_SCHEMA_VERSION, fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import {
  characterFileName,
  copyCharacter,
  deleteCharacter,
  exportCharacter,
  restoreCharacter,
} from '../src/db/characterActions';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { type CharacterRow, GrimoireDb, type HistoryRow, type RollLogRow } from '../src/db/db';
import i18n from '../src/i18n';
import { ACTIONS_PX, cardOffset, SWIPE_PX, swipedOpen } from '../src/pages/CharactersPage';
import { ActionRows } from '../src/shared/CharacterActions';
import { ToastView } from '../src/shared/ToastHost';
import { currentToast, deleteWithUndo, hideToast, type Toast, undoToast } from '../src/shared/undo';

// Golden A and golden B of SPEC §6.7 are the stored characters; the rolls, changes and portrait
// rows are the app's own, made here.

const a = fifthEditionCharacterSchema.parse(goldenA);
const b = fifthEditionCharacterSchema.parse(goldenB);
const at = '2026-10-29T12:00:00.000Z';
const portrait = '0f1e2d3c-4b5a-4697-8877-665544332211';
const t = i18n.getFixedT('en', 'actions');

/** Row `n` of a table keyed by its id, for `characterId`, at minute `n`. */
const idOf = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const timeOf = (n: number) => `2026-10-29T10:${String(n).padStart(2, '0')}:00.000Z`;
const rollRow = (n: number, characterId: string) =>
  ({ id: idOf(n), characterId, rolledAt: timeOf(n), schemaVersion: 1 }) as RollLogRow;
const historyRow = (n: number, characterId: string): HistoryRow => ({
  id: idOf(n),
  characterId,
  at: timeOf(n),
});

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-25-${count}`);
  await database.open();
  await saveCharacter({ ...a, portraitBlobId: portrait }, database.characters);
  await saveCharacter(b, database.characters);
  await database.blobs.put({ id: portrait, bytes: 'the portrait' } as never);
  await database.rollLog.bulkPut([rollRow(1, a.id), rollRow(2, a.id), rollRow(3, b.id)]);
  await database.history.bulkPut([historyRow(4, a.id), historyRow(5, b.id)]);
});

afterEach(async () => {
  const toast = currentToast();
  if (toast !== undefined) hideToast(toast);
  await database.delete();
});

describe('SHEET-25 Copy', () => {
  it('stores a new character with its own id, revision 0, made now, under the new name', async () => {
    const copied = await copyCharacter(a.id, 'Golden A (copy)', at, database);
    if (!copied.ok) throw new Error(copied.message);
    const copy = copied.value;
    expect(copy.id).not.toBe(a.id);
    expect(copy.portraitBlobId).not.toBe(portrait);
    expect(copy).toEqual({
      ...a,
      id: copy.id,
      rev: 0,
      createdAt: at,
      updatedAt: at,
      name: 'Golden A (copy)',
      portraitBlobId: copy.portraitBlobId,
    });
    expect(await openCharacter(copy.id, database.characters)).toMatchObject({ ok: true });
    // Its own portrait, the same picture; the first's is untouched.
    expect(await database.blobs.get(copy.portraitBlobId as string)).toEqual({
      id: copy.portraitBlobId,
      bytes: 'the portrait',
    });
    expect(await database.blobs.get(portrait)).toEqual({ id: portrait, bytes: 'the portrait' });
    // The rolls and the changes stay with the first.
    expect(await database.rollLog.where({ characterId: copy.id }).count()).toBe(0);
    expect(await database.history.where({ characterId: copy.id }).count()).toBe(0);
    expect(await database.characters.count()).toBe(3);
  });

  it('keeps a portrait id no blob holds as it was, and makes no blob', async () => {
    await database.blobs.clear();
    const copied = await copyCharacter(a.id, 'Copy', at, database);
    expect(copied.ok && copied.value.portraitBlobId).toBe(portrait);
    expect(await database.blobs.count()).toBe(0);
  });

  it('copies nothing of a character that is not stored, or does not open', async () => {
    const missing = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
    expect(await copyCharacter(missing, 'Copy', at, database)).toMatchObject({
      ok: false,
      code: 'notFound',
    });
    await database.characters.put({
      ...b,
      systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION + 1,
    } as CharacterRow);
    expect(await copyCharacter(b.id, 'Copy', at, database)).toMatchObject({
      ok: false,
      code: 'newer',
    });
    expect(await database.characters.count()).toBe(2);
  });

  it('names the copy "<name> (copy)"', () => {
    expect(t('copyName', { name: 'Iren' })).toBe('Iren (copy)');
  });
});

describe('SHEET-25 Export', () => {
  it('gives the stored row as it was saved, as JSON, in a file named after it', async () => {
    const exported = await exportCharacter(b.id, database);
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.file.fileName).toBe('Golden B.json');
    expect(JSON.parse(exported.file.text)).toEqual(b);
    expect(exported.file.text.endsWith('}\n')).toBe(true);
  });

  it('gives a row that does not open as it is, so the person keeps it', async () => {
    const newer = { ...b, systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION + 1 };
    await database.characters.put(newer as CharacterRow);
    const exported = await exportCharacter(b.id, database);
    expect(exported.ok && JSON.parse(exported.file.text)).toEqual(newer);
  });

  it('names a file safely on every system', () => {
    expect(characterFileName('Iren')).toBe('Iren.json');
    expect(characterFileName('A/B: "C"?')).toBe('A_B_ _C__.json');
    expect(characterFileName(' Tom. ')).toBe('Tom.json');
    expect(characterFileName('...')).toBe('character.json');
    expect(characterFileName(undefined)).toBe('character.json');
  });

  it('refuses an id with no row', async () => {
    expect(await exportCharacter(idOf(99), database)).toMatchObject({
      ok: false,
      code: 'notFound',
    });
  });
});

describe('SHEET-25 Delete', () => {
  it("drops the character, its rolls, its changes and its portrait, and none of another's", async () => {
    const result = await deleteCharacter(a.id, database);
    if (!result.ok) throw new Error(result.message);
    expect(await database.characters.get(a.id)).toBeUndefined();
    expect((await database.rollLog.toArray()).map(({ id }) => id)).toEqual([idOf(3)]);
    expect((await database.history.toArray()).map(({ id }) => id)).toEqual([idOf(5)]);
    expect(await database.blobs.count()).toBe(0);
    expect(await database.characters.get(b.id)).toEqual(b);
    expect(result.deleted.rolls.map(({ id }) => id)).toEqual([idOf(1), idOf(2)]);
    expect(result.deleted.changes.map(({ id }) => id)).toEqual([idOf(4)]);
  });

  it('keeps a portrait another character names too', async () => {
    await saveCharacter({ ...b, portraitBlobId: portrait }, database.characters);
    const result = await deleteCharacter(a.id, database);
    expect(result.ok && result.deleted.blobs).toEqual([]);
    expect(await database.blobs.get(portrait)).toBeDefined();
  });

  it('puts every row back as it was', async () => {
    const before = {
      characters: await database.characters.toArray(),
      rollLog: await database.rollLog.toArray(),
      history: await database.history.toArray(),
      blobs: await database.blobs.toArray(),
    };
    const result = await deleteCharacter(a.id, database);
    if (!result.ok) throw new Error(result.message);
    await restoreCharacter(result.deleted, database);
    expect({
      characters: await database.characters.toArray(),
      rollLog: await database.rollLog.toArray(),
      history: await database.history.toArray(),
      blobs: await database.blobs.toArray(),
    }).toEqual(before);
  });

  it('deletes a row that does not open as well, and refuses an id with no row', async () => {
    await database.characters.put({ ...b, system: 'pf2e' } as CharacterRow);
    expect((await deleteCharacter(b.id, database)).ok).toBe(true);
    expect(await database.characters.count()).toBe(1);
    expect(await deleteCharacter(b.id, database)).toMatchObject({ ok: false, code: 'notFound' });
  });

  it('shows "<name> deleted" with Undo, and Undo brings the character back', async () => {
    expect(await deleteWithUndo(a.id, 'Golden A', database)).toEqual({ ok: true });
    const toast = currentToast() as Toast;
    expect(toast.kind).toBe('deleted');
    const text = renderToStaticMarkup(<ToastView toast={toast} />);
    expect(text).toContain('Golden A deleted');
    expect(text).toContain('Undo');
    expect(await undoToast(toast, at, database)).toEqual({ ok: true });
    expect(currentToast()).toBeUndefined();
    expect(await database.characters.get(a.id)).toEqual({ ...a, portraitBlobId: portrait });
    expect(await database.rollLog.count()).toBe(3);
  });

  it('says so, with no Undo, when the character cannot be brought back', async () => {
    await deleteWithUndo(a.id, 'Golden A', database);
    const toast = currentToast() as Toast;
    database.close();
    expect(await undoToast(toast, at, database)).toEqual({ ok: false });
    const failed = currentToast() as Toast;
    expect(failed).toEqual({ kind: 'notRestored', name: 'Golden A' });
    const text = renderToStaticMarkup(<ToastView toast={failed} />);
    expect(text).toContain('Golden A could not be brought back');
    expect(text).not.toContain('Undo');
    await database.open();
  });
});

describe('SHEET-25 the Actions list and the swipe', () => {
  it('lists Link for the DM, Export, Copy, Transfer, Delete; two are coming later', () => {
    const html = renderToStaticMarkup(
      <ActionRows target={{ id: a.id, name: 'Golden A', opens: true }} onClose={() => {}} />,
    );
    const rows = [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map(([row]) => ({
      disabled: /^<button[^>]* disabled=""/.test(row),
      text: row
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }));
    expect(rows).toEqual([
      { disabled: true, text: 'Link for the DM Coming later' },
      { disabled: false, text: 'Export A file of this character' },
      { disabled: false, text: 'Copy' },
      { disabled: true, text: 'Transfer Coming later' },
      { disabled: false, text: 'Delete Undo stays available for a moment' },
    ]);
  });

  it('offers no Copy for a character that does not open', () => {
    const html = renderToStaticMarkup(
      <ActionRows target={{ id: a.id, name: 'Golden A', opens: false }} onClose={() => {}} />,
    );
    expect(html).toMatch(
      /<button[^>]* disabled=""[^>]*>(?:(?!<\/button>).)*Only a character that opens/,
    );
  });

  it('opens a card past the swipe distance left, and closes it past it right', () => {
    expect(SWIPE_PX).toBe(56);
    expect(swipedOpen(false, -SWIPE_PX)).toBe(true);
    expect(swipedOpen(false, -SWIPE_PX + 1)).toBe(false);
    expect(swipedOpen(false, 200)).toBe(false);
    expect(swipedOpen(true, SWIPE_PX)).toBe(false);
    expect(swipedOpen(true, SWIPE_PX - 1)).toBe(true);
    expect(swipedOpen(true, -200)).toBe(true);
  });

  it('draws a dragged card between closed and its four actions open', () => {
    expect(ACTIONS_PX).toBe(4 * 60);
    expect(cardOffset(false, -100)).toBe(-100);
    expect(cardOffset(false, -500)).toBe(-240);
    expect(cardOffset(false, 30)).toBe(0);
    expect(cardOffset(true, 0)).toBe(-240);
    expect(cardOffset(true, 100)).toBe(-140);
  });
});
