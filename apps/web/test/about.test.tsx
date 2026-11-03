import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import i18n from '../src/i18n';
import { changeCharacter, currentToast, hideToast, undoToast } from '../src/shared/undo';
import { noteEntry } from '../src/sheet/changes';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { AboutList, ALIGNMENT_NOTE, wordsOf } from '../src/sheet/sections/AboutList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-53: golden A (a hill dwarf Life domain cleric 1, Acolyte) and golden B (a human fighter 1,
// Soldier) of SPEC §6.7 on the built-in packs. The names are the packs' (`srd-2014.ts`): the
// languages, skills and sizes are entries; an armor group, a weapon category and a tool kind with
// no entry are named by `about.json` or by the words of their key.

const a: AppCharacter = fifthEditionCharacterSchema.parse(goldenA);
const b: AppCharacter = fifthEditionCharacterSchema.parse(goldenB);
const t = i18n.getFixedT('en', 'about');

function drawn(character: AppCharacter, editing = false, drop?: string): string {
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const packs = installBuiltInPacks().packs;
  const content = contentOf(
    character,
    drop === undefined ? packs : packs.filter((each) => each.pack.id !== drop),
  );
  const sheet: SheetValue = {
    character,
    content,
    computed: compute(character, content.index, system.module),
    system,
    editing,
    roll: () => {},
    breakdown: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <AboutList />
      </SheetContext>
    </MemoryRouter>,
  );
}

/** The text of the row labelled `label`, tags removed. */
function rowOf(html: string, label: string): string | undefined {
  const found = new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>(.*?)</dd>`).exec(html);
  return found?.[1]?.replace(/<[^>]+>/g, '');
}

describe('SHEET-53 the About tab of golden A', () => {
  const html = drawn(a);

  it('names the character and the 2014 words for the species and the lineage', () => {
    expect(html).toContain('>About Golden A</h2>');
    expect(rowOf(html, t('terms.race'))).toBe('Dwarf');
    expect(rowOf(html, t('terms.subrace'))).toBe('Hill Dwarf');
    expect(rowOf(html, t('background'))).toBe('Acolyte');
    expect(rowOf(html, t('size'))).toBe('Medium');
  });

  it('lists the languages by name', () => {
    const languages = rowOf(html, t('languages'))?.split(', ').sort();
    expect(languages).toEqual(['Celestial', 'Common', 'Dwarvish', 'Elvish']);
  });

  it('lists the proficiencies by name, the group of an armor by its own words', () => {
    expect(rowOf(html, t('armor'))?.split(', ').sort()).toEqual([
      'Heavy armor',
      'Light armor',
      'Medium armor',
      // `shield` is also the key of the pack's item Shield, which names it (srd-2014.ts).
      'Shield',
    ]);
    expect(rowOf(html, t('weapons'))?.split(', ').sort()).toEqual([
      'Battleaxe',
      'Handaxe',
      'Light hammer',
      'Simple weapons',
      'Warhammer',
    ]);
    expect(rowOf(html, t('tools'))).toBe('Masons tools');
    expect(rowOf(html, t('skills'))?.split(', ').sort()).toEqual([
      'Insight',
      'Medicine',
      'Persuasion',
      'Religion',
    ]);
  });

  it('shows the alignment as text in play mode: "Not set" until it is written', () => {
    expect(rowOf(html, t('alignment'))).toBe('Not set');
    const written = drawn({ ...a, notes: { [ALIGNMENT_NOTE]: 'Neutral good' } });
    expect(rowOf(written, t('alignment'))).toBe('Neutral good');
    expect(written).not.toContain('<input');
  });

  it('shows the alignment as a field in edit mode, holding what is stored', () => {
    const html = drawn({ ...a, notes: { [ALIGNMENT_NOTE]: 'Neutral good' } }, true);
    expect(html).toMatch(/<input[^>]*value="Neutral good"/);
    expect(html).toContain(`>${t('alignment')}</label>`);
  });
});

describe('SHEET-53 the About tab of golden B and of a missing pack', () => {
  it('uses the 2024 word, and omits the lineage row of a character with none', () => {
    const html = drawn(b);
    expect(rowOf(html, t('terms.species'))).toBe('Human');
    expect(rowOf(html, t('background'))).toBe('Soldier');
    expect(html).not.toContain(t('terms.lineage'));
  });

  it('says "Missing: <id>" for a species and a background a pack no longer has', () => {
    const html = drawn(a, false, 'srd-2014');
    expect(rowOf(html, t('terms.race'))).toBe(t('missing', { id: 'srd-2014:species/dwarf' }));
    expect(rowOf(html, t('background'))).toBe(t('missing', { id: 'srd-2014:background/acolyte' }));
  });

  it('writes the words of a key: camel case split, first letter capital', () => {
    expect(wordsOf('masonsTools')).toBe('Masons tools');
    expect(wordsOf('lightHammer')).toBe('Light hammer');
    expect(wordsOf('shield')).toBe('Shield');
  });
});

describe('SHEET-53 the alignment is a note', () => {
  let database: GrimoireDb;
  let count = 0;

  beforeEach(async () => {
    count += 1;
    database = new GrimoireDb(`sheet-53-${count}`);
    await database.open();
    await saveCharacter(a, database.characters);
  });

  afterEach(async () => {
    const toast = currentToast();
    if (toast !== undefined) hideToast(toast);
    await database.delete();
  });

  const stored = async () => {
    const opened = await openCharacter(a.id, database.characters);
    if (!opened.ok) throw new Error('does not open');
    return opened.value.notes;
  };

  it('stores the alignment under notes.alignment, beside the free note, and Undo removes it', async () => {
    const now = '2026-11-03T12:00:00.000Z';
    const entry = noteEntry({ ...a, notes: {} }, 'Neutral good', now, ALIGNMENT_NOTE);
    if (entry === undefined) throw new Error('no change');
    expect(entry.subject).toBe('alignment');
    expect(entry.changes).toEqual([{ path: ['notes', 'alignment'], after: 'Neutral good' }]);
    expect((await changeCharacter(a.id, entry, now, database)).ok).toBe(true);
    expect(await stored()).toEqual({ alignment: 'Neutral good' });
    const toast = currentToast();
    if (toast === undefined) throw new Error('no toast');
    await undoToast(toast, now, database);
    expect(await stored()).toEqual({});
  });
});
