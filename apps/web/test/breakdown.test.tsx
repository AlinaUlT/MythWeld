import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { BreakdownSheet } from '../src/shared/BreakdownSheet';
import { breakdownOf, pathName, stepsAt } from '../src/sheet/breakdown';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-33: a number's breakdown on golden B (SPEC §6.7: a human fighter 1, Soldier). Athletics +5
// is Strength's modifier +3 and the proficiency bonus +2; Strength 17 is the base 15 and the
// Soldier's +2 (fixtures-2024.test.ts). The words are the English ones the app loads.

const t = i18n.getFixedT('en', 'breakdown');
const packs = installBuiltInPacks().packs;

function sheetOf(extra: object = {}): SheetValue {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({ ...goldenB, ...extra });
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
    cast: () => {},
  };
}

function drawn(sheet: SheetValue, path: string, format?: 'plain' | 'signed' | 'distance'): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <BreakdownSheet path={path} {...(format && { format })} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-33 a number’s breakdown', () => {
  const sheet = sheetOf();

  it('names each part of Athletics +5: Strength’s modifier +3 and the proficiency bonus +2', () => {
    const view = breakdownOf(sheet.computed, sheet.system, 'skills.athletics.total', t);
    expect(view.name).toBe('Athletics');
    expect(view.total).toBe(5);
    expect(view.lines.map(({ label, change }) => [label, change])).toEqual([
      ['Strength modifier', 3],
      ['Proficiency bonus', 2],
    ]);
  });

  it('reads the summary line and one line for each part, in the sheet’s sign format', () => {
    const html = drawn(sheet, 'skills.athletics.total', 'signed');
    expect(html).toContain('Where this number comes from');
    expect(html).toContain('Athletics +5 = Strength modifier +3, Proficiency bonus +2');
    expect(text(html)).toContain('|Strength modifier|+3|');
    expect(text(html)).toContain('|Proficiency bonus|+2|');
  });

  it('writes a plain number’s base without a sign and each source with one: Strength 17', () => {
    const view = breakdownOf(sheet.computed, sheet.system, 'abilities.str.score', t);
    expect(view.name).toBe('Strength score');
    expect(view.lines.map(({ label, change }) => [label, change])).toEqual([
      ['Base', 15],
      ['Soldier', 2],
    ]);
    expect(drawn(sheet, 'abilities.str.score')).toContain(
      'Strength score 17 = Base 15, Soldier +2',
    );
  });

  it('labels a manual edit, with the person’s note, and shows the edited number', () => {
    const edited = sheetOf({
      overrides: [{ path: 'skills.athletics.total', value: 9, note: 'house rule' }],
    });
    const view = breakdownOf(edited.computed, edited.system, 'skills.athletics.total', t);
    expect(view.total).toBe(9);
    const last = view.lines.at(-1);
    expect(last).toEqual({
      label: 'Manual edit',
      change: 4,
      first: false,
      manual: true,
      note: 'house rule',
    });
    const html = drawn(edited, 'skills.athletics.total', 'signed');
    expect(html).toContain(
      'Athletics +9 = Strength modifier +3, Proficiency bonus +2, Manual edit +4',
    );
    expect(html).toContain('Replaces the computed number');
    expect(html).toContain('house rule');
  });

  it('reads a path as an own field: a name Object has no breakdown and does not throw', () => {
    for (const path of ['toString', 'constructor', '__proto__', 'abilities.nothing.mod', '']) {
      expect(stepsAt(sheet.computed, path)).toEqual([]);
      const html = drawn(sheet, path);
      expect(html).toContain('No steps are kept for this number.');
    }
  });

  it('names a path from its entries: a stat, a skill, a missing key in the words of its key', () => {
    const name = (path: string) => pathName(sheet.computed, sheet.system, path, t);
    expect(name('abilities.str.mod')).toBe('Strength modifier');
    expect(name('checks.dex.total')).toBe('Dexterity check');
    expect(name('skills.sleightOfHand.total')).toBe('Sleight of Hand');
    expect(name('skills.madeUp.total')).toBe('Made up');
    expect(name('prof')).toBe('Proficiency bonus');
    expect(name('skills.athletics.prof')).toBe('Athletics proficiency');
    expect(name('ac.total')).toBe('AC');
  });

  it('keeps a rule step, a level and a formula named, never blank', () => {
    const view = breakdownOf(sheet.computed, sheet.system, 'skills.perception.passive', t);
    expect(view.lines.map(({ label }) => label)).toEqual(['Passive base', 'Perception']);
    expect(view.total).toBe(13);
  });
});
