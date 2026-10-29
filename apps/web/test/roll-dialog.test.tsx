import { compute, type DieSource, parseRoll } from '@grimoire/engine';
import { rollRecordSchema } from '@grimoire/schema';
import { criticalDamage, fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { RollDialog } from '../src/shared/RollDialog';
import { damageDiceOf, fieldsOfFormula, naturalOf, rollTestWith } from '../src/shared/rollTest';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-39: the roll dialog on the goldens of SPEC §6.7. Golden B (2024): STR 17, DEX 13, a human
// fighter 1 with a greatsword and chain mail; Athletics +5 (+3 and proficiency +2), initiative +3,
// greatsword to hit +5 (+3 and +2), to damage +3, Stealth +1 with chain mail's disadvantage.
// Golden A (2014): a cleric 1, spell attack +5. The sums are worked out by hand.

const packs = installBuiltInPacks().packs;
void i18n;

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

function draw(sheet: SheetValue, node: ReactNode): string {
  return renderToStaticMarkup(<SheetContext value={sheet}>{node}</SheetContext>);
}

const dialog = (sheet: SheetValue, path: string) =>
  draw(sheet, <RollDialog path={path} onClose={() => {}} />);

/** A die that shows the faces given, in order, then 1. */
function script(...faces: number[]): DieSource {
  let next = 0;
  return () => faces[next++] ?? 1;
}

const ID = '00000000-0000-4000-8000-000000000039';
const NOW = new Date(Date.UTC(2026, 9, 29, 18, 0, 0));

function rolled(sheet: SheetValue, path: string, dice: string, die: DieSource) {
  return rollTestWith({
    label: 'Athletics',
    path,
    dice,
    diceLabel: 'd20',
    addLabel: 'Athletics',
    addPath: path,
    read: (at) =>
      Object.hasOwn(sheet.computed.values, at) ? sheet.computed.values[at] : undefined,
    die,
    roller: { actorId: sheet.character.id, name: sheet.character.name },
    id: ID,
    now: NOW,
  });
}

describe('SHEET-39 a roll of a number on the sheet', () => {
  const b = sheetOf(goldenB);

  it('records the d20 and the number: 14 + 5 = 19, with the character as roller', () => {
    const made = rolled(b, 'skills.athletics.total', '1d20', script(14));
    expect(made.warnings).toEqual([]);
    expect(rollRecordSchema.safeParse(made.record).success).toBe(true);
    expect(made.record).toMatchObject({
      id: ID,
      path: 'skills.athletics.total',
      by: { role: 'player', actorId: goldenB.id },
      total: 19,
    });
    expect(made.record.breakdown.map(({ formula, value }) => [formula, value])).toEqual([
      ['1d20', 14],
      ['@skills.athletics.total', 5],
    ]);
    expect(made.natural).toBe(14);
  });

  it('reads the natural face a roll with advantage keeps, and with disadvantage', () => {
    expect(rolled(b, 'init.total', '2d20kh1', script(7, 15)).natural).toBe(15);
    expect(rolled(b, 'init.total', '2d20kl1', script(7, 15)).natural).toBe(7);
    expect(rolled(b, 'init.total', '2d20kh1', script(7, 15)).record.total).toBe(18);
  });

  it('counts a path the sheet does not have as 0, with a warning', () => {
    const made = rolled(b, 'skills.nothing.total', '1d20', script(10));
    expect(made.record.total).toBe(10);
    expect(made.warnings.map(({ warning }) => warning.code)).toEqual(['missingPath']);
  });

  it('asks one field per d20, in the order written', () => {
    expect(fieldsOfFormula('2d20kh1').map(({ faces, n }) => [faces, n])).toEqual([
      [20, 1],
      [20, 2],
    ]);
    expect(fieldsOfFormula('1d20')).toHaveLength(1);
    expect(fieldsOfFormula('not a roll')).toEqual([]);
  });

  it("doubles a critical hit's damage dice and rolls the bonus once", () => {
    const test = b.system.rolls.test('attacks.greatsword.hit', b.computed);
    const damage = test?.damage;
    if (damage === undefined) throw new Error('no damage');
    const rollDamage = (critical: boolean, die: DieSource) => {
      const dice = damageDiceOf(damage.formula, critical, criticalDamage);
      return rollTestWith({
        label: 'Greatsword damage',
        path: damage.bonusPath,
        dice,
        diceLabel: 'Damage dice',
        addLabel: 'Damage bonus',
        addPath: damage.bonusPath,
        read: (at) => b.computed.values[at],
        die,
        roller: { name: 'Golden B' },
        id: ID,
        now: NOW,
      });
    };
    // 2d6 + 3 with 3 and 4; the critical 4d6 + 3 with 3, 4, 5 and 6.
    expect(rollDamage(false, script(3, 4)).record.total).toBe(10);
    expect(rollDamage(true, script(3, 4, 5, 6)).record.total).toBe(21);
    expect(damageDiceOf('2d6', true, criticalDamage)).toMatchObject({ text: '4d6' });
    expect(damageDiceOf('2d6', false, criticalDamage)).toBe('2d6');
    // A formula that cannot be doubled is rolled as it is.
    expect(damageDiceOf('2d6 +', true, criticalDamage)).toBe('2d6 +');
    expect(parseRoll('2d6 +').ok).toBe(false);
    expect(naturalOf(rollDamage(false, script(3, 4)).record)).toBe(3);
  });
});

describe('SHEET-39 the dialog before the first roll', () => {
  const b = sheetOf(goldenB);

  it("names the test and writes its formula: golden B's Athletics is d20 + 5", () => {
    const markup = dialog(b, 'skills.athletics.total');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('>Athletics</h2>');
    expect(markup).toContain('1d20 + 5');
    expect(markup).toContain(en.roll.advantage);
    expect(markup).toContain(en.roll.disadvantage);
    expect(markup).toContain('Rolling with no advantage or disadvantage.');
    expect(markup).not.toContain('roll-total');
    expect(markup).toContain(`>${en.roll.roll}<`);
  });

  it("writes initiative's +3, a save, a check and an attack with their names", () => {
    expect(dialog(b, 'init.total')).toContain('1d20 + 3');
    expect(dialog(b, 'init.total')).toContain('>Initiative</h2>');
    expect(dialog(b, 'abilities.str.save')).toContain('>Strength saving throw</h2>');
    expect(dialog(b, 'checks.dex.total')).toContain('>Dexterity check</h2>');
    const attack = dialog(b, 'attacks.greatsword.hit');
    expect(attack).toContain('>Greatsword attack</h2>');
    expect(attack).toContain('1d20 + 5');
    // Damage is offered after the attack is rolled, never before.
    expect(attack).not.toContain(en.roll.rollDamage);
  });

  it("takes the sheet's own disadvantage: Stealth in chain mail rolls two d20 and keeps the lower", () => {
    const markup = dialog(b, 'skills.stealth.total');
    expect(markup).toContain('2d20kl1 + 1');
    expect(markup).toContain('The sheet gives disadvantage. Rolling with disadvantage.');
  });

  it('offers inspiration for advantage in 2014 rules only, and only while it is held', () => {
    const withInspiration = (golden: typeof goldenA | typeof goldenB, held: number) => ({
      ...golden,
      systemData: {
        ...golden.systemData,
        state: { ...golden.systemData.state, inspiration: held },
      },
    });
    const text = 'Spend inspiration for advantage (1 held)';
    expect(dialog(sheetOf(withInspiration(goldenA, 1)), 'init.total')).toContain(text);
    expect(dialog(sheetOf(withInspiration(goldenA, 0)), 'init.total')).not.toContain(
      'Spend inspiration',
    );
    // 2024's Heroic Inspiration rerolls a die; that is not this dialog's.
    expect(dialog(sheetOf(withInspiration(goldenB, 1)), 'init.total')).not.toContain(
      'Spend inspiration',
    );
  });

  it("rolls a caster's spell attack: golden A's cleric, d20 + 5", () => {
    const markup = dialog(sheetOf(goldenA), 'classes.cleric.spell.attack');
    expect(markup).toContain('>Spell attack</h2>');
    expect(markup).toContain('1d20 + 5');
  });

  it('says a number does not roll, for a path that is none of the tests or is missing', () => {
    for (const path of ['ac.total', 'skills.nothing.total', 'toString', '']) {
      const markup = dialog(b, path);
      expect(markup).toContain(en.roll.noRoll);
      expect(markup).not.toContain('roll-formula');
    }
  });
});
