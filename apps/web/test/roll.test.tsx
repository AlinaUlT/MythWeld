import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB, goldenB4 } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { typedDie } from '../src/shared/dice';
import { RollDialog } from '../src/shared/RollDialog';
import {
  d20Text,
  damageFormula,
  damageText,
  keptFace,
  NO_SWITCHES,
  rollTestWith,
  signsOf,
} from '../src/sheet/roll';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-39: the roll dialog's rules and its first look, on golden B (a human fighter 1: Athletics
// +5, a greatsword with 2d6), golden B4 (Remarkable Athlete: advantage on Athletics) and golden A
// (2014: inspiration is spent for advantage). The dice are scripted (`typedDie`); the expected
// totals are worked out by hand from the faces and SPEC §6.7's bonuses.

void i18n;
const packs = installBuiltInPacks().packs;
const roller = { actorId: 'c', name: 'Golden B' };
const stamp = { id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', now: new Date('2026-11-03T12:00:00Z') };

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
    cast: () => {},
  };
}

function testOf(sheet: SheetValue, path: string) {
  const test = sheet.system.rollTest(sheet.computed, path);
  if (test === undefined) throw new Error(`${path} does not roll`);
  return test;
}

function rolled(sheet: SheetValue, path: string, mode: number, faces: number[]) {
  const made = rollTestWith({
    system: sheet.system,
    computed: sheet.computed,
    test: testOf(sheet, path),
    name: 'Test',
    mode,
    die: typedDie(faces),
    roller,
    ...stamp,
  });
  if (made === undefined) throw new Error('no roll');
  return made;
}

function dialog(sheet: SheetValue, path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <RollDialog path={path} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

describe('SHEET-39 the mode of a roll', () => {
  const b = sheetOf(goldenB);
  const b4 = sheetOf(goldenB4);
  const mode = (sheet: SheetValue, path: string, on = NO_SWITCHES) => {
    const test = testOf(sheet, path);
    const offered = sheet.system.situational(sheet.computed, test.targets);
    return sheet.system.rollMode(signsOf(sheet.computed, test, offered, on));
  };

  it('is the sheet’s sources and the dialog’s own: Athletics is straight for B, advantage for B4', () => {
    expect(mode(b, 'skills.athletics.total')).toBe(0);
    expect(mode(b4, 'skills.athletics.total')).toBe(1);
    expect(mode(b, 'skills.athletics.total', { ...NO_SWITCHES, advantage: true })).toBe(1);
    expect(mode(b, 'skills.athletics.total', { ...NO_SWITCHES, disadvantage: true })).toBe(-1);
  });

  it('cancels any advantage with any disadvantage, the sheet’s and the dialog’s together', () => {
    expect(mode(b4, 'skills.athletics.total', { ...NO_SWITCHES, disadvantage: true })).toBe(0);
    expect(
      mode(b, 'skills.athletics.total', { ...NO_SWITCHES, advantage: true, disadvantage: true }),
    ).toBe(0);
    expect(mode(b, 'skills.athletics.total', { ...NO_SWITCHES, inspiration: true })).toBe(1);
  });

  it('keeps the chain mail’s disadvantage on Stealth among the sheet’s sources', () => {
    expect(mode(b, 'skills.stealth.total')).toBe(-1);
    expect(mode(b, 'skills.stealth.total', { ...NO_SWITCHES, advantage: true })).toBe(0);
  });
});

describe('SHEET-39 the roll', () => {
  const b = sheetOf(goldenB);

  it('rolls d20 + 5 for Athletics: a 14 gives 19, and the record is the character’s', () => {
    expect(d20Text(b.system, 0, 5)).toBe('1d20 + 5');
    const made = rolled(b, 'skills.athletics.total', 0, [14]);
    expect(made.record.total).toBe(19);
    expect(made.face).toBe(14);
    expect(made.outcome).toBeUndefined();
    expect(made.record.label).toBe('Test');
    expect(made.record.path).toBe('skills.athletics.total');
    expect(made.record.by).toEqual({ role: 'player', name: 'Golden B', actorId: 'c' });
  });

  it('keeps the higher of two d20 with advantage, the lower with disadvantage', () => {
    expect(d20Text(b.system, 1, 5)).toBe('2d20kh1 + 5');
    const high = rolled(b, 'skills.athletics.total', 1, [14, 9]);
    expect([high.face, high.record.total]).toEqual([14, 19]);
    expect(high.record.breakdown[0]?.dice[0]?.kept).toEqual([true, false]);
    expect(d20Text(b.system, -1, 5)).toBe('2d20kl1 + 5');
    const low = rolled(b, 'skills.athletics.total', -1, [14, 9]);
    expect([low.face, low.record.total]).toEqual([9, 14]);
  });

  it('writes a negative number with its sign and leaves a zero out', () => {
    expect(d20Text(b.system, 0, -1)).toBe('1d20 - 1');
    expect(d20Text(b.system, 0, 0)).toBe('1d20');
    expect(rolled(b, 'checks.int.total', 0, [10]).record.total).toBe(9);
  });

  it('reads the kept face from a record with none kept as nothing', () => {
    const made = rolled(b, 'skills.athletics.total', 0, [14]);
    const none = {
      ...made.record,
      breakdown: [
        {
          ...made.record.breakdown[0],
          dice: [{ ...made.record.breakdown[0]?.dice[0], kept: [false] }],
        },
      ],
    };
    expect(keptFace(none as typeof made.record)).toBeUndefined();
  });

  it('scores a greatsword attack by its natural face: 20 hits hard, 1 misses, 11 is by total', () => {
    const attack = 'attacks.greatsword.hit';
    expect(rolled(b, attack, 0, [20]).outcome).toBe('criticalHit');
    expect(rolled(b, attack, 0, [1]).outcome).toBe('automaticMiss');
    const middle = rolled(b, attack, 0, [11]);
    expect(middle.outcome).toBe('byTotal');
    // SPEC §6.7 golden B: Strength +3 and proficiency +2 add up to +5 to hit.
    expect(middle.record.total).toBe(16);
  });

  it('doubles the damage dice on a critical hit: 2d6 + 3 becomes 4d6 + 3', () => {
    expect(damageText('2d6', 3)).toBe('2d6 + 3');
    const normal = damageFormula(b.system, '2d6 + 3', false);
    const critical = damageFormula(b.system, '2d6 + 3', true);
    expect(normal?.text).toBe('2d6 + 3');
    expect(critical?.text).toContain('4d6');
    expect(damageFormula(b.system, 'not a roll', true)).toBeUndefined();
  });
});

describe('SHEET-39 the dialog', () => {
  it('shows the formula with the test’s name, the switches and a Roll button', () => {
    const html = dialog(sheetOf(goldenB), 'skills.athletics.total');
    expect(html).toContain('>1d20 + 5 (Athletics)</p>');
    expect(html).toContain('>Advantage<');
    expect(html).toContain('>Disadvantage<');
    expect(html).toContain('>Roll<');
    expect(html).not.toContain('Roll again');
    expect(html).not.toContain('data-testid="roll-result"');
  });

  it('shows the sheet’s advantage as a source and the d20 it rolls', () => {
    const html = dialog(sheetOf(goldenB4), 'skills.athletics.total');
    expect(html).toContain('2d20kh1 + 6 (Athletics)');
    expect(html).toContain('Rolling with advantage');
    expect(html).toContain(': advantage</li>');
  });

  it('offers a spent inspiration in 2014, where it gives advantage, and not in 2024', () => {
    const held = (golden: typeof goldenA | typeof goldenB) => ({
      ...golden,
      systemData: {
        ...golden.systemData,
        state: { ...golden.systemData.state, inspiration: 1 },
      },
    });
    expect(dialog(sheetOf(held(goldenA)), 'skills.insight.total')).toContain('Spend inspiration');
    expect(dialog(sheetOf(goldenA), 'skills.insight.total')).not.toContain('Spend inspiration');
    expect(dialog(sheetOf(held(goldenB)), 'skills.insight.total')).not.toContain(
      'Spend inspiration',
    );
  });

  it('says a number that does not roll does not, and never throws on an odd path', () => {
    for (const path of ['ac.total', 'toString', '__proto__', '']) {
      expect(dialog(sheetOf(goldenB), path)).toContain('This number does not roll.');
    }
  });
});
