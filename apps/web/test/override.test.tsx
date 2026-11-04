import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { BreakdownSheet } from '../src/shared/BreakdownSheet';
import { typedNumber } from '../src/shared/OverrideEditor';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-34: "Override by hand" under a number's breakdown, on golden B (SPEC §6.7): Strength 17 is
// the base 15 and the Soldier's +2. An edit of 20 moves it by 20 - 17 = 3, and the modifier is
// floor((20 - 10) / 2) = 5 (SRD 5.2.1 "Ability Scores and Modifiers", read by the 5e module).

const packs = installBuiltInPacks().packs;

function drawn(path: string, extra: object = {}, editing = true): string {
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
      <SheetContext value={sheet}>
        <BreakdownSheet path={path} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const STR = 'abilities.str.score';

describe('SHEET-34 the form under a breakdown', () => {
  it('offers the field, the note and Save in edit mode, with the number as it is now', () => {
    const html = drawn(STR);
    expect(text(html)).toContain('|Override by hand|Number|');
    expect(html).toMatch(/<input[^>]*value="17"/);
    expect(text(html)).toContain('|Note|');
    expect(text(html)).toContain('|Save|');
    // No edit yet: nothing to remove.
    expect(html).not.toContain('Remove manual edit');
  });

  it('says in play mode that Edit unlocks it, and draws no field', () => {
    const html = drawn(STR, {}, false);
    expect(text(html)).toContain('Turn on Edit to override this number by hand.');
    expect(html).not.toContain('<form');
  });

  it('shows a stored edit: the field holds it, the note too, and it can be removed', () => {
    const html = drawn(STR, { overrides: [{ path: STR, value: 20, note: 'Belt of power' }] });
    expect(html).toMatch(/<input[^>]*value="20"/);
    expect(html).toMatch(/<input[^>]*value="Belt of power"/);
    expect(text(html)).toContain('|Remove manual edit|');
    // The breakdown labels it, with its note, and the total is the edit.
    expect(text(html)).toContain('Strength score 20 = Base 15, Soldier +2, Manual edit +3');
    expect(html).toContain('data-manual');
    expect(text(html)).toContain('|Belt of power|');
  });

  it('offers no form for the level, which an edit cannot change, or for a path with no number', () => {
    expect(drawn('level')).not.toContain('<form');
    expect(drawn('no.such.path')).not.toContain('<form');
  });
});

describe('SHEET-34 the number a person types', () => {
  it('reads digits with a sign or a point, and a minus sign', () => {
    expect(typedNumber('12')).toBe(12);
    expect(typedNumber(' 7 ')).toBe(7);
    expect(typedNumber('-1')).toBe(-1);
    expect(typedNumber('−1')).toBe(-1);
    expect(typedNumber('+4')).toBe(4);
    expect(typedNumber('1.5')).toBe(1.5);
    expect(typedNumber('0')).toBe(0);
  });

  it('reads nothing else', () => {
    for (const text of ['', ' ', 'abc', '1e3', '1,5', '.5', '5.', '--1', '1 2', '0x10']) {
      expect(typedNumber(text)).toBeUndefined();
    }
  });
});
