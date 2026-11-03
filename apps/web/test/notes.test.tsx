import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import '../src/i18n';
import i18n from '../src/i18n';
import { currentToast, hideToast, undoToast } from '../src/shared/undo';
import { FREE_NOTE, noteEntry } from '../src/sheet/changes';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { NotesText } from '../src/sheet/sections/NotesText';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-54: golden B of SPEC §6.7 is the stored character; its note is the test's own text.

const b: AppCharacter = fifthEditionCharacterSchema.parse(goldenB);
const withNote = (text: string): AppCharacter => ({ ...b, notes: { [FREE_NOTE]: text } });
const t = i18n.getFixedT('en', 'notes');
const at = '2026-11-03T10:00:00.000Z';

function drawn(character: AppCharacter): string {
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, installBuiltInPacks().packs);
  const sheet: SheetValue = {
    character,
    content,
    computed: compute(character, content.index, system.module),
    system,
    editing: false,
    roll: () => {},
    breakdown: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <NotesText />
      </SheetContext>
    </MemoryRouter>,
  );
}

describe('SHEET-54 the Notes tab', () => {
  it('draws an empty field with its label and placeholder for a character with no note', () => {
    const html = drawn(b);
    expect(html).toContain(`>${t('label')}</label>`);
    expect(html).toContain(`placeholder="${t('placeholder')}"`);
    expect(html).toMatch(/<textarea[^>]*><\/textarea>/);
  });

  it("draws the stored note's text in the field", () => {
    expect(drawn(withNote('Met the smith at dusk.'))).toContain(
      '>Met the smith at dusk.</textarea>',
    );
  });

  it('makes a change that sets the note, from nothing and from another text', () => {
    const first = noteEntry(b, 'Hello', at);
    expect(first?.action).toBe('setNote');
    expect(first?.subject).toBe('free');
    expect(first?.changes).toEqual([{ path: ['notes', 'free'], after: 'Hello' }]);
    expect(first?.by).toEqual({ role: 'player', name: 'Golden B', actorId: b.id });
    expect(noteEntry(withNote('Hello'), 'Hello again', at)?.changes).toEqual([
      { path: ['notes', 'free'], before: 'Hello', after: 'Hello again' },
    ]);
  });

  it('makes no change for the same text, nor for text with no visible character', () => {
    expect(noteEntry(withNote('Hello'), 'Hello', at)).toBeUndefined();
    expect(noteEntry(b, '', at)).toBeUndefined();
    expect(noteEntry(b, ' \n\t ', at)).toBeUndefined();
  });

  it('removes the note when its text is cleared', () => {
    expect(noteEntry(withNote('Hello'), '  ', at)?.changes).toEqual([
      { path: ['notes', 'free'], before: 'Hello' },
    ]);
  });
});

describe('SHEET-54 saving the note', () => {
  let database: GrimoireDb;
  let count = 0;

  beforeEach(async () => {
    count += 1;
    database = new GrimoireDb(`sheet-54-${count}`);
    await database.open();
    await saveCharacter(b, database.characters);
  });

  afterEach(async () => {
    const toast = currentToast();
    if (toast !== undefined) hideToast(toast);
    await database.delete();
  });

  async function stored() {
    const opened = await openCharacter(b.id, database.characters);
    if (!opened.ok) throw new Error('does not open');
    return opened.value;
  }

  it('stores the text, shows the "Note saved" toast, and Undo takes the text back', async () => {
    const { changeCharacter } = await import('../src/shared/undo');
    const entry = noteEntry(b, 'Met the smith at dusk.', at);
    if (entry === undefined) throw new Error('no change');
    const result = await changeCharacter(b.id, entry, at, database);
    expect(result.ok).toBe(true);
    expect((await stored()).notes).toEqual({ free: 'Met the smith at dusk.' });
    const toast = currentToast();
    expect(toast?.kind).toBe('changed');
    expect(i18n.getFixedT('en', 'toast')('done.setNote')).toBe('Note saved');
    if (toast === undefined) throw new Error('no toast');
    expect((await undoToast(toast, at, database)).ok).toBe(true);
    expect((await stored()).notes).toEqual({});
  });

  it('removes the key when the text is cleared, and Undo puts the text back', async () => {
    const { changeCharacter } = await import('../src/shared/undo');
    await saveCharacter(withNote('Keep me.'), database.characters);
    const entry = noteEntry(withNote('Keep me.'), '', at);
    if (entry === undefined) throw new Error('no change');
    await changeCharacter(b.id, entry, at, database);
    expect((await stored()).notes).toEqual({});
    const toast = currentToast();
    if (toast === undefined) throw new Error('no toast');
    await undoToast(toast, at, database);
    expect((await stored()).notes).toEqual({ free: 'Keep me.' });
  });

  it('refuses a change made over a newer note, and writes nothing', async () => {
    const { changeCharacter } = await import('../src/shared/undo');
    await saveCharacter(withNote('Newer'), database.characters);
    const entry = noteEntry(withNote('Older'), 'Mine', at);
    if (entry === undefined) throw new Error('no change');
    const result = await changeCharacter(b.id, entry, at, database);
    expect(result.ok).toBe(false);
    expect((await stored()).notes).toEqual({ free: 'Newer' });
  });
});
