import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { ActionsMenu } from '../src/sheet/panels/ActionsMenu';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-58: the sheet's "⋯" menu on golden B (SPEC §6.7), in the order ADR 013 item 2 and BRIEF P4
// give: Level up, Link for the DM, Export, Copy, Transfer, Rules options, Change history, Delete.

const packs = installBuiltInPacks().packs;

function drawn(): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse(goldenB);
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
    cast: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <ActionsMenu onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

describe('SHEET-58 the sheet’s "⋯" menu', () => {
  const html = drawn();
  const rows = [...html.matchAll(/<button[^>]*data-testid[^>]*>|<button[^>]*>.*?<\/button>/g)]
    .map(([row]) => ({
      disabled: /^<button[^>]* disabled=""/.test(row),
      text: row
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter(({ text }) => text !== '');

  it('is a dialog named by the character', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('>Golden B</h2>');
  });

  it('lists the rows top to bottom, five of them coming later and not tappable', () => {
    expect(rows.filter(({ text }) => text !== 'Close')).toEqual([
      { disabled: true, text: 'Level up Coming later' },
      { disabled: true, text: 'Link for the DM Coming later' },
      { disabled: false, text: 'Export A file of this character' },
      { disabled: false, text: 'Copy' },
      { disabled: true, text: 'Transfer Coming later' },
      { disabled: true, text: 'Rules options Coming later' },
      { disabled: true, text: 'Change history Coming later' },
      { disabled: false, text: 'Delete Undo stays available for a moment' },
    ]);
  });
});
