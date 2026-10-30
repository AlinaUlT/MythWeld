import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { AboutList } from '../src/sheet/sections/AboutList';
import { sheetSystemOf } from '../src/systems';

// SHEET-53 on golden B (SPEC §6.7): a human fighter 1 with the Soldier background, whose class
// grants the armor and weapon training, and whose background chose the playing cards.

const packs = installBuiltInPacks().packs;
const t = i18n.getFixedT('en', 'about');

function drawn(golden: object, editing = false): string {
  const character = fifthEditionCharacterSchema.parse(golden);
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const computed = compute(character, content.index, system.module);
  const sheet: SheetValue = {
    character,
    content,
    computed,
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

/** The text of the row labelled `label`: what follows the label's element, tags removed. */
function rowText(html: string, label: string): string {
  const after = html.split(`>${label}</span>`)[1] ?? '';
  return (after.match(/<span[^>]*>(.*?)<\/span>/)?.[1] ?? '').replace(/<[^>]+>/g, '');
}

describe('SHEET-53 the About tab', () => {
  it("shows golden B's species, size, background and proficiencies", () => {
    const html = drawn(goldenB);
    expect(html).toContain('About Golden B');
    expect(rowText(html, t('species'))).toBe('Human');
    expect(rowText(html, t('size'))).toBe('Medium (Human)');
    expect(rowText(html, t('background'))).toBe('Soldier');
    expect(rowText(html, t('armor'))).toBe('Light armor, Medium armor, Heavy armor, Shields');
    expect(rowText(html, t('weapons'))).toBe('Simple weapons, Martial weapons');
    expect(rowText(html, t('tools'))).toBe('Playing cards');
  });

  it('shows the alignment as written, or says it is not set', () => {
    expect(rowText(drawn(goldenB), t('alignment'))).toBe(t('notSet'));
    const written = {
      ...goldenB,
      systemData: { ...goldenB.systemData, alignment: 'Neutral good' },
    };
    expect(rowText(drawn(written), t('alignment'))).toBe('Neutral good');
  });

  it('turns the alignment into a text field in edit mode', () => {
    const html = drawn(goldenB, true);
    expect(html).toContain('<input type="text"');
    expect(html).toContain(`placeholder="${t('alignmentPlaceholder')}"`);
    expect(drawn(goldenB)).not.toContain('<input');
  });
});
