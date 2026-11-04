import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { Concentration } from '../src/sheet/sections/Concentration';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-41: the Combat tab's concentration, on golden A (SPEC §6.7, a cleric 1 of the 2014 rules)
// concentrating on Bless, a level 1 spell of SRD 5.1 that asks for concentration.

void i18n;
const packs = installBuiltInPacks().packs;

function drawn(concentration?: string): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...goldenA,
    systemData: {
      ...goldenA.systemData,
      state: {
        ...goldenA.systemData.state,
        ...(concentration !== undefined && { concentration }),
      },
    },
  });
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
        <Concentration />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-41 the Combat tab shows the concentration until it ends', () => {
  it('shows the spell held, its level and "End concentration"', () => {
    const html = drawn('srd-2014:spell/bless');
    expect(text(html)).toContain('|Concentration|');
    expect(text(html)).toContain('|Bless|Level 1|');
    expect(text(html)).toContain('|End concentration|');
    expect(html).toContain('data-concentration="srd-2014:spell/bless"');
  });

  it('shows nothing for a character who concentrates on nothing', () => {
    expect(drawn()).toBe('');
  });

  it('says "Missing: <id>" for a spell no pack holds, and still offers to end it', () => {
    const html = drawn('srd-2014:spell/no-such-spell');
    expect(text(html)).toContain('|Missing: srd-2014:spell/no-such-spell|');
    expect(text(html)).toContain('|End concentration|');
  });
});
