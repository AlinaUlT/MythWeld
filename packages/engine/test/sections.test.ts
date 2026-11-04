import {
  addSection,
  addSectionEntry,
  applyEntry,
  type LogStamp,
  removeSection,
  removeSectionEntry,
  reverseEntry,
} from '@grimoire/engine';
import { logEntrySchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import {
  ash as ashFile,
  openTalesCharacter,
  type TalesCharacter,
} from '../../schema/test/tales/index.ts';

// SHEET-57: a character's own lists, on Tales' Ash (ENG-27), the made-up test system, which has
// none. A companion with its stat block is an entry with text. The ids are the app's: made up here.

function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const ash = opened(openTalesCharacter(ashFile));
const stamp: LogStamp = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  at: '2026-11-04T12:00:00.000Z',
  by: { role: 'player', name: 'Wren' },
};
const MOUNTS = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';
const PETS = '8e9f0a1b-2c3d-4e4f-9a5b-6c7d8e9f0a1b';
const DAPPLE = '6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f';
const SADDLE = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result).toMatchObject({ ok: true });
  return result as Extract<T, { ok: true }>;
}

/** Ash with a Mounts section holding Dapple, and an empty Pets section. */
function stocked(): TalesCharacter {
  const withMounts = ok(addSection(ash, { id: MOUNTS, name: 'Mounts' }, stamp)).character;
  const withDapple = ok(
    addSectionEntry(
      withMounts,
      { section: MOUNTS, id: DAPPLE, name: 'Dapple', text: 'Speed 60, 19 hit points' },
      stamp,
    ),
  ).character;
  return ok(addSection(withDapple, { id: PETS, name: 'Pets' }, stamp)).character;
}

describe('SHEET-57 addSection', () => {
  it('adds an empty list at the end as one entry that changes only the lists', () => {
    expect(ash.sections).toEqual([]);
    const made = ok(addSection(ash, { id: MOUNTS, name: '  Mounts ' }, stamp));
    expect(made.character.sections).toEqual([{ id: MOUNTS, name: 'Mounts', entries: [] }]);
    expect({ ...made.character, sections: [] }).toEqual(ash);
    expect(made.entry).toMatchObject({
      action: 'addSection',
      subject: MOUNTS,
      label: { en: 'Mounts' },
    });
    expect(made.entry.changes).toEqual([
      { path: ['sections'], before: [], after: [{ id: MOUNTS, name: 'Mounts', entries: [] }] },
    ]);
    expect(logEntrySchema.safeParse(made.entry).success).toBe(true);
  });

  it('keeps the order: a second section goes after the first', () => {
    expect(stocked().sections.map(({ name }) => name)).toEqual(['Mounts', 'Pets']);
  });

  it('refuses a name that shows nothing and an id that is used, by a section or an entry', () => {
    expect(addSection(ash, { id: MOUNTS, name: '   ' }, stamp)).toMatchObject({
      ok: false,
      code: 'noName',
    });
    const had = stocked();
    expect(addSection(had, { id: MOUNTS, name: 'Again' }, stamp)).toMatchObject({
      ok: false,
      code: 'idUsed',
    });
    expect(addSection(had, { id: DAPPLE, name: 'Again' }, stamp)).toMatchObject({
      ok: false,
      code: 'idUsed',
    });
  });

  it('its entry applies again and reverses to the character it came from', () => {
    const made = ok(addSection(ash, { id: MOUNTS, name: 'Mounts' }, stamp));
    expect(ok(applyEntry(ash, made.entry)).character).toEqual(made.character);
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(ash);
  });
});

describe('SHEET-57 addSectionEntry', () => {
  it('adds a name and its words at the end of its own section only', () => {
    const had = stocked();
    expect(had.sections[0]?.entries).toEqual([
      { id: DAPPLE, name: 'Dapple', text: 'Speed 60, 19 hit points' },
    ]);
    expect(had.sections[1]?.entries).toEqual([]);
    const made = ok(
      addSectionEntry(
        had,
        { section: MOUNTS, id: SADDLE, name: ' Saddlebags ', text: '  ' },
        stamp,
      ),
    );
    expect(made.character.sections[0]?.entries).toEqual([
      { id: DAPPLE, name: 'Dapple', text: 'Speed 60, 19 hit points' },
      { id: SADDLE, name: 'Saddlebags' },
    ]);
    expect(made.entry).toMatchObject({
      action: 'addEntry',
      subject: SADDLE,
      label: { en: 'Saddlebags' },
    });
  });

  it('refuses a section that is not there, a name that shows nothing and an id that is used', () => {
    const had = stocked();
    expect(addSectionEntry(had, { section: SADDLE, id: SADDLE, name: 'x' }, stamp)).toMatchObject({
      ok: false,
      code: 'noSection',
    });
    expect(addSectionEntry(had, { section: PETS, id: SADDLE, name: ' ' }, stamp)).toMatchObject({
      ok: false,
      code: 'noName',
    });
    expect(addSectionEntry(had, { section: PETS, id: DAPPLE, name: 'Twin' }, stamp)).toMatchObject({
      ok: false,
      code: 'idUsed',
    });
  });

  it('its entry reverses to the lists it came from', () => {
    const had = stocked();
    const made = ok(addSectionEntry(had, { section: PETS, id: SADDLE, name: 'Cat' }, stamp));
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(had);
  });
});

describe('SHEET-57 removeSectionEntry and removeSection', () => {
  it('takes an entry from its section and leaves the rest', () => {
    const made = ok(removeSectionEntry(stocked(), { section: MOUNTS, id: DAPPLE }, stamp));
    expect(made.character.sections.map(({ name, entries }) => [name, entries.length])).toEqual([
      ['Mounts', 0],
      ['Pets', 0],
    ]);
    expect(made.entry).toMatchObject({ action: 'removeEntry', subject: DAPPLE });
    expect(made.entry.label).toEqual({ en: 'Dapple' });
  });

  it('takes a section with its entries', () => {
    const had = stocked();
    const made = ok(removeSection(had, { id: MOUNTS }, stamp));
    expect(made.character.sections.map(({ name }) => name)).toEqual(['Pets']);
    expect(made.entry).toMatchObject({ action: 'removeSection', label: { en: 'Mounts' } });
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(had);
  });

  it('refuses what is not there', () => {
    const had = stocked();
    expect(removeSection(had, { id: SADDLE }, stamp)).toMatchObject({
      ok: false,
      code: 'noSection',
    });
    expect(removeSectionEntry(had, { section: SADDLE, id: DAPPLE }, stamp)).toMatchObject({
      ok: false,
      code: 'noSection',
    });
    expect(removeSectionEntry(had, { section: PETS, id: DAPPLE }, stamp)).toMatchObject({
      ok: false,
      code: 'noEntry',
    });
  });
});
