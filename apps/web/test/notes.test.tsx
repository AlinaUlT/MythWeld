import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { recordChange, undoChange } from '../src/db/history';
import '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { NOTE_KEYS, NotesText, noteEntry, noteOf } from '../src/sheet/sections/NotesText';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-54: golden B (SPEC §6.7) with its stored notes empty, then with one note set by hand.

const packs = installBuiltInPacks().packs;
const id = '00000000-0000-4000-8000-000000000001';
const at = '2026-10-01T18:00:00.000Z';

function sheetOf(character: AppCharacter): SheetValue {
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const computed = compute(character, content.index, system.module);
  return {
    character,
    content,
    computed,
    system,
    editing: false,
    roll: () => {},
    breakdown: () => {},
  };
}

const b = fifthEditionCharacterSchema.parse(goldenB);
const withNote = { ...b, notes: { bonds: 'My sister Ada' } };

describe('SHEET-54 the Notes tab', () => {
  it('shows a box for each note of SPEC §5.8, with the stored text', () => {
    const html = renderToStaticMarkup(
      <SheetContext value={sheetOf(withNote)}>
        <NotesText />
      </SheetContext>,
    );
    expect(NOTE_KEYS).toHaveLength(8);
    expect(html.match(/<textarea/g)).toHaveLength(8);
    for (const label of [
      'Appearance',
      'Personality',
      'Ideals',
      'Bonds',
      'Flaws',
      'Backstory',
      'Allies',
    ]) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain('My sister Ada</textarea>');
  });

  it('makes no change when the text is the stored one, or a blank where there was none', () => {
    expect(noteEntry(withNote, 'bonds', 'My sister Ada', id, at)).toBeUndefined();
    expect(noteEntry(b, 'free', '  \n ', id, at)).toBeUndefined();
  });

  it('adds, edits and removes a note as one change at notes.<key>', () => {
    expect(noteEntry(b, 'free', 'Owes the guild', id, at)?.changes).toEqual([
      { path: ['notes', 'free'], after: 'Owes the guild' },
    ]);
    expect(noteEntry(withNote, 'bonds', 'My sister Ada, lost', id, at)?.changes).toEqual([
      { path: ['notes', 'bonds'], before: 'My sister Ada', after: 'My sister Ada, lost' },
    ]);
    expect(noteEntry(withNote, 'bonds', ' ', id, at)?.changes).toEqual([
      { path: ['notes', 'bonds'], before: 'My sister Ada' },
    ]);
    expect(noteOf(b, 'free')).toBe('');
    expect(noteOf(withNote, 'bonds')).toBe('My sister Ada');
  });

  describe('stored', () => {
    let database: GrimoireDb;
    beforeEach(async () => {
      database = new GrimoireDb(`notes-${crypto.randomUUID()}`);
      await saveCharacter(b, database.characters);
    });
    afterEach(async () => {
      database.close();
      await GrimoireDb.delete(database.name);
    });

    it('writes the note, and an undo takes it away again', async () => {
      const entry = noteEntry(b, 'free', 'Owes the guild', id, at);
      if (entry === undefined) throw new Error('no entry');
      const written = await recordChange(b.id, entry, at, database);
      expect(written.ok && noteOf(written.character, 'free')).toBe('Owes the guild');
      const undone = await undoChange(id, at, database);
      expect(undone.ok && Object.hasOwn(undone.character.notes, 'free')).toBe(false);
    });
  });
});
