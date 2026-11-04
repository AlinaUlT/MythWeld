import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { SWIPE_PX, swipedTab } from '../src/pages/SheetPage';
import { AddPanel } from '../src/sheet/panels/AddPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { SheetDock } from '../src/sheet/SheetDock';
import { SectionList } from '../src/sheet/sections/SectionList';
import { SHEET_TABS, tabIdsOf, tabOf } from '../src/sheet/tabs';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-57: a custom section is a tab after the built-in ones, a list of entries of a name and free
// text. Golden B (SPEC §6.7) with a Mounts section holding Dapple and an empty Pets section.

const packs = installBuiltInPacks().packs;
const MOUNTS = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';
const PETS = '8e9f0a1b-2c3d-4e4f-9a5b-6c7d8e9f0a1b';
const DAPPLE = '6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f';
const sections = [
  {
    id: MOUNTS,
    name: 'Mounts',
    entries: [
      { id: DAPPLE, name: 'Dapple', text: 'Speed 60 ft\n19 hit points' },
      { id: '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a', name: 'Saddlebags' },
    ],
  },
  { id: PETS, name: 'Pets', entries: [] },
];

function drawn(editing: boolean, view: ReactNode, extra: object = { sections }): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({ ...goldenB, ...extra });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const sheet: SheetValue = {
    character,
    content,
    computed: compute(character, content.index, system.module),
    system,
    editing,
    roll: () => {},
    breakdown: () => {},
    cast: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{view}</SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-57 the tabs', () => {
  it('puts each section’s tab after the built-in ones, and finds one by its id', () => {
    const ids = tabIdsOf(sections);
    expect(ids).toEqual([...SHEET_TABS.map(({ id }) => id), MOUNTS, PETS]);
    expect(tabOf(PETS, sections)).toBe(PETS);
    // A section the character does not have is no tab: Main.
    expect(tabOf(PETS, [])).toBe('main');
    expect(tabOf('nope', sections)).toBe('main');
  });

  it('moves a swipe along the built-in tabs into the sections and back', () => {
    const ids = tabIdsOf(sections);
    expect(swipedTab('notes', -SWIPE_PX, 0, ids)).toBe(MOUNTS);
    expect(swipedTab(MOUNTS, -SWIPE_PX, 0, ids)).toBe(PETS);
    expect(swipedTab(PETS, -SWIPE_PX, 0, ids)).toBe(PETS);
    expect(swipedTab(PETS, SWIPE_PX, 0, ids)).toBe(MOUNTS);
    expect(swipedTab(MOUNTS, SWIPE_PX, 0, ids)).toBe('notes');
    // With no sections it is the built-in list: the last tab stays.
    expect(swipedTab('notes', -SWIPE_PX, 0)).toBe('notes');
  });

  it('draws a tab for each section in the dock, named by the person', () => {
    const html = drawn(
      false,
      <SheetDock tab={MOUNTS} sections={sections} onTab={() => {}} onNumberPad={() => {}} />,
    );
    expect(html.match(/role="tab"/g)).toHaveLength(SHEET_TABS.length + 2);
    expect(html).toContain(`id="sheet-tab-${MOUNTS}"`);
    expect(text(html)).toContain('|Mounts|');
    expect(text(html)).toContain('|Pets|');
    expect(html).toMatch(
      new RegExp(
        `aria-selected="true"[^>]*id="sheet-tab-${MOUNTS}"|id="sheet-tab-${MOUNTS}"[^>]*aria-selected="true"`,
      ),
    );
  });
});

describe('SHEET-57 a section’s tab', () => {
  it('lists the entries by name, with their words kept in lines', () => {
    const html = drawn(false, <SectionList id={MOUNTS} />);
    expect(html).toContain('aria-label="Mounts"');
    expect(text(html)).toContain('|Mounts|');
    expect(text(html)).toContain('|Dapple|Speed 60 ft\n19 hit points|');
    expect(text(html)).toContain('|Saddlebags|');
    expect(html).toContain('whitespace-pre-line');
  });

  it('says an empty section is empty', () => {
    expect(text(drawn(false, <SectionList id={PETS} />))).toContain('Nothing here yet.');
  });

  it('only reads in play mode, and adds and removes in edit mode', () => {
    const play = drawn(false, <SectionList id={MOUNTS} />);
    expect(play).not.toContain('<button');
    const edit = drawn(true, <SectionList id={MOUNTS} />);
    expect(edit).toContain('aria-label="Remove Dapple"');
    expect(text(edit)).toContain('|Add an entry|');
    expect(text(edit)).toContain('|Remove section|');
  });

  it('draws nothing for a section the character does not have', () => {
    expect(drawn(true, <SectionList id={MOUNTS} />, { sections: [] })).toBe('');
  });
});

describe('SHEET-57 the panel’s list', () => {
  it('offers a section and a companion beside the custom item and feature', () => {
    const html = drawn(true, <AddPanel onClose={() => {}} />);
    expect(text(html)).toContain('|Custom item|');
    expect(text(html)).toContain('|Custom feature|');
    expect(text(html)).toContain('|New section|Mounts, Pets, Familiars, Notes, or any list|');
    expect(text(html)).toContain('|Companion|Familiar, pet or mount, with a small stat block|');
  });

  it('opens a section’s own entry form at once, for that section', () => {
    const html = drawn(true, <AddPanel entryIn={PETS} onClose={() => {}} />);
    expect(html).toContain('aria-label="New entry"');
    expect(html).toMatch(new RegExp(`<option value="${PETS}" selected`));
    expect(text(html)).toContain('|Stat block or description|');
  });
});
