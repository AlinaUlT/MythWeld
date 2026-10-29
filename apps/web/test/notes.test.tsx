import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { recordChange, undoChange } from '../src/db/history';
import '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { NOTE_KEYS, NotesText, storedNote } from '../src/sheet/sections/NotesText';
import { sheetSystemOf } from '../src/systems';

// SHEET-54: golden B (SPEC §6.7) has no notes. The writing goes through the history, as the box's
// blur does; the drawing is checked on the character with one note stored.

const packs = installBuiltInPacks().packs;
const b = fifthEditionCharacterSchema.parse(goldenB);

let database: GrimoireDb;
let count = 0;
beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-54-${count}`);
  await saveCharacter(b, database.characters);
});
afterEach(async () => {
  database.close();
  await GrimoireDb.delete(database.name);
});

function noteEntry(n: number, before: string | undefined, after: string | undefined) {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    at: new Date(Date.UTC(2026, 9, 1, 18, n)).toISOString(),
    by: { role: 'player' as const, name: 'Wren' },
    action: 'setNote',
    subject: 'backstory',
    changes: [{ path: ['notes', 'backstory'], before, after }],
  };
}

function drawn(notes: Record<string, string>): string {
  const character = fifthEditionCharacterSchema.parse({ ...goldenB, notes });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
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
  it('draws one box for each of the eight keys of SPEC §5.8, empty on a new character', () => {
    expect(NOTE_KEYS).toHaveLength(8);
    const html = drawn({});
    expect(html.match(/<textarea/g)).toHaveLength(8);
    expect(html).toContain('Appearance');
    expect(html).toContain('Allies and organizations');
  });

  it('shows a stored note in its own box', () => {
    expect(drawn({ backstory: 'Raised by dwarves.' })).toContain('Raised by dwarves.');
  });

  it('stores text that shows something and nothing for an emptied box', () => {
    expect(storedNote('Raised by dwarves.')).toBe('Raised by dwarves.');
    expect(storedNote('  \n ')).toBeUndefined();
    expect(storedNote('')).toBeUndefined();
  });

  it('writes a note, rewrites it, removes it, and undoes the removal', async () => {
    const set = await recordChange(
      b.id,
      noteEntry(1, undefined, 'Raised by dwarves.'),
      undefined,
      database,
    );
    expect(set.ok && set.character.notes).toEqual({ backstory: 'Raised by dwarves.' });
    const rewritten = await recordChange(
      b.id,
      noteEntry(2, 'Raised by dwarves.', 'Lost at sea.'),
      undefined,
      database,
    );
    expect(rewritten.ok && rewritten.character.notes).toEqual({ backstory: 'Lost at sea.' });
    const removed = await recordChange(
      b.id,
      noteEntry(3, 'Lost at sea.', undefined),
      undefined,
      database,
    );
    expect(removed.ok && removed.character.notes).toEqual({});
    const undone = await undoChange(noteEntry(3, undefined, undefined).id, undefined, database);
    expect(undone.ok && 'character' in undone && undone.character.notes).toEqual({
      backstory: 'Lost at sea.',
    });
  });
});
