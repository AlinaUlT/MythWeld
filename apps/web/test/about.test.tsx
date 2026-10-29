import { compute } from '@grimoire/engine';
import {
  ALIGNMENT_NOTE,
  fifthEditionAbout,
  fifthEditionCharacterSchema,
} from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { AboutList } from '../src/sheet/sections/AboutList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-53: the About tab on the goldens of SPEC §6.7 and the built-in packs. B is a human soldier
// fighter 1 (2024), A a hill dwarf acolyte cleric 1 (2014), C a wizard 3 then paladin 3 (2014).

const packs = installBuiltInPacks().packs;

function sheetOf(golden: object): SheetValue {
  const character: AppCharacter = fifthEditionCharacterSchema.parse(golden);
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

const aboutOf = (golden: object) => {
  const { character, computed } = sheetOf(golden);
  return fifthEditionAbout(character, computed);
};
const keys = (list: { key: string }[]) => list.map(({ key }) => key);

function draw(sheet: SheetValue, node: ReactNode): string {
  return renderToStaticMarkup(<SheetContext value={sheet}>{node}</SheetContext>);
}

/** The text of the row labelled `label`, tags removed. */
function rowText(html: string, label: string): string {
  const row = new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>(.*?)</dd>`).exec(html);
  return (row?.[1] ?? 'no row').replace(/<[^>]+>/g, '');
}

describe('SHEET-53 what the About tab names', () => {
  it("names golden B's species and background from the packs, and its skills and training", () => {
    const about = aboutOf(goldenB);
    expect(about.species.map(({ id }) => id)).toEqual(['srd-2024:species/human']);
    expect(about.background.map(({ id }) => id)).toEqual(['srd-2024:background/soldier']);
    expect(new Set(keys(about.skills))).toEqual(
      new Set(['athletics', 'intimidation', 'insight', 'perception', 'survival']),
    );
    expect(keys(about.armor)).toEqual(['light', 'medium', 'heavy', 'shield']);
    expect(keys(about.weapons)).toEqual(['simple', 'martial']);
    expect(keys(about.tools)).toEqual(['playingCards']);
  });

  it("names golden A's languages, the dwarf's and the acolyte's, and the hill dwarf lineage", () => {
    const about = aboutOf(goldenA);
    expect(about.species.map(({ id }) => id)).toEqual([
      'srd-2014:species/dwarf',
      'srd-2014:lineage/hill-dwarf',
    ]);
    expect(new Set(keys(about.languages))).toEqual(
      new Set(['common', 'dwarvish', 'celestial', 'elvish']),
    );
    expect(about.languages.every(({ entity }) => entity !== undefined)).toBe(true);
    expect(about.alignment).toBeUndefined();
  });

  it('lists a key once, whatever number of sources give it', () => {
    const about = aboutOf(goldenC2014);
    expect(keys(about.weapons).filter((key) => key === 'simple')).toHaveLength(1);
    expect(new Set(keys(about.skills))).toEqual(new Set(['arcana', 'history']));
  });

  it('reads the alignment from the note, trimmed', () => {
    const written = { ...goldenB, notes: { [ALIGNMENT_NOTE]: '  Neutral good  ' } };
    expect(aboutOf(written).alignment).toBe('Neutral good');
  });
});

describe('SHEET-53 the About tab', () => {
  it("draws golden A's origin, languages and training by name", () => {
    const html = draw(sheetOf(goldenA), <AboutList />);
    expect(html).toContain('About Golden A');
    expect(rowText(html, 'Species')).toBe('Dwarf, Hill Dwarf');
    expect(rowText(html, 'Background')).toBe('Acolyte');
    expect(rowText(html, 'Languages')).toContain('Dwarvish');
    expect(rowText(html, 'Armor')).toBe('Light armor, Medium armor, Shield, Heavy armor');
    expect(rowText(html, 'Weapons')).toContain('Warhammer');
    expect(rowText(html, 'Skills')).toBe('Insight, Religion, Medicine, Persuasion');
  });

  it('writes a dash for a row with nothing, and the alignment as written', () => {
    const empty = draw(sheetOf(goldenB), <AboutList />);
    expect(rowText(empty, 'Alignment')).toBe('—');
    expect(rowText(empty, 'Languages')).toBe('—');
    const written = draw(
      sheetOf({ ...goldenB, notes: { [ALIGNMENT_NOTE]: 'Neutral good' } }),
      <AboutList />,
    );
    expect(rowText(written, 'Alignment')).toBe('Neutral good');
  });

  it('spells a key no pack names, rather than dropping it', () => {
    const html = draw(sheetOf(goldenB), <AboutList />);
    expect(rowText(html, 'Tools')).toBe('Playing cards');
  });
});
