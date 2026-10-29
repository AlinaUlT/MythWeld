import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { BreakdownSheet } from '../src/shared/BreakdownSheet';
import { breakdownOf, pathName } from '../src/shared/breakdown';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// The goldens of SPEC §6.7 on the built-in packs: B a human fighter 1 (initiative +3, speed 30,
// AC 17), A a hill dwarf cleric 1 (AC 18, in chain mail and a shield).

const packs = installBuiltInPacks().packs;
const t = i18n.getFixedT('en', 'breakdown');

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

function draw(sheet: SheetValue, path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <BreakdownSheet path={path} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

/** The rows of a drawn breakdown as "name amount", tags removed. */
function rows(html: string): string[] {
  return [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, inner]) =>
    (inner ?? '')
      .replace(/<\/span><span/g, '</span> <span')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

describe('SHEET-33 a number’s breakdown', () => {
  it("names each part of golden B's initiative +3, and the parts add up to it", () => {
    const sheet = sheetOf(goldenB);
    const found = breakdownOf(sheet.computed, 'init.total', t);
    expect(found.name).toBe('Initiative');
    expect(found.value).toBe(3);
    expect(found.lines.map(({ name, change }) => [name, change])).toEqual([
      ['DEX check total', 1],
      ['Initiative bonus', 2],
    ]);
    expect(found.lines.reduce((sum, { change }) => sum + change, 0)).toBe(3);
    expect(found.manual).toBe(false);
    expect(rows(draw(sheet, 'init.total'))).toEqual([
      'DEX check total +1',
      'Initiative bonus +2',
      'Total +3',
    ]);
  });

  it("names golden A's armor class 18 by the armor and the shield", () => {
    const html = draw(sheetOf(goldenA), 'ac.total');
    expect(html).toContain(`>${en.breakdown.title}</h2>`);
    expect(rows(html)).toEqual(['Base armor class +16', 'Armor class bonus +2', 'Total 18']);
    expect(html).not.toContain(en.breakdown.manual);
  });

  it('names the entry that gave a number, and what kind of step it was', () => {
    const found = breakdownOf(sheetOf(goldenA).computed, 'ac.base', t);
    expect(found.lines).toEqual([{ name: 'Chain Mail', change: 16, manual: false }]);
    const speed = breakdownOf(sheetOf(goldenB).computed, 'speed.walk', t);
    expect(speed.value).toBe(30);
    expect(speed.lines).toEqual([{ name: 'Human', change: 30, manual: false }]);
  });

  it('writes a distance in feet by default', () => {
    const sheet = sheetOf(goldenB);
    const html = draw(sheet, 'speed.walk');
    expect(rows(html)).toEqual(['Human 30 ft', 'Total 30 ft']);
  });

  it('labels a manual edit and shows its note', () => {
    const sheet = sheetOf({
      ...goldenB,
      overrides: [{ path: 'ac.total', value: 20, note: 'Ring of protection' }],
    });
    const found = breakdownOf(sheet.computed, 'ac.total', t);
    expect(found.value).toBe(20);
    expect(found.manual).toBe(true);
    const html = draw(sheet, 'ac.total');
    expect(html).toContain(en.breakdown.manual);
    expect(rows(html).at(-2)).toBe('Manual edit Ring of protection +3');
    expect(rows(html).at(-1)).toBe('Total 20');
  });

  it('reads only own fields: a path like toString has no breakdown and no value', () => {
    const sheet = sheetOf(goldenB);
    for (const path of ['toString', 'constructor', '__proto__', 'nothing.here']) {
      const found = breakdownOf(sheet.computed, path, t);
      expect(found.value).toBeUndefined();
      expect(found.lines).toEqual([]);
      expect(rows(draw(sheet, path))).toEqual([]);
      expect(draw(sheet, path)).toContain(en.breakdown.empty);
    }
  });

  it('names a path by its key and field, and shows any other path as it is', () => {
    const { computed } = sheetOf(goldenB);
    expect(pathName('abilities.str.mod', computed, t)).toBe('STR modifier');
    expect(pathName('skills.athletics.bonus', computed, t)).toBe('Athletics bonus');
    expect(pathName('prof', computed, t)).toBe('Proficiency bonus');
    expect(pathName('classes.fighter.level', computed, t)).toBe('Fighter level');
    expect(pathName('abilities.nope.mod', computed, t)).toBe('abilities.nope.mod');
    expect(pathName('toString', computed, t)).toBe('toString');
  });

  it('names a rule the module has no words for by its own name', () => {
    expect(t('rules.other', { rule: 'newRule' })).toBe('Rule: newRule');
  });
});
