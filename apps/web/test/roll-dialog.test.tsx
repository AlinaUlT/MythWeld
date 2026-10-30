import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { RollDialog } from '../src/shared/RollDialog';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-39: the roll dialog's first view, for numbers the goldens of SPEC §6.7 and ENG-16 settle:
// golden B (2024 fighter 1) has initiative +3 and a greatsword whose attack is +5, damage +3;
// golden A (2014 hill dwarf cleric 1) has a spell attack of +5. The dialog does the rolling in a
// browser; `roll.spec.ts` proves it there.

const packs = installBuiltInPacks().packs;

function dialog(golden: object, path: string): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse(golden);
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const computed = compute(character, content.index, system.module);
  const sheet: SheetValue = {
    character,
    content,
    computed,
    system,
    editing: false,
    roll: () => {},
    breakdown: () => {},
  };
  return renderToStaticMarkup(
    <SheetContext value={sheet}>
      <RollDialog path={path} onClose={() => {}} />
    </SheetContext>,
  );
}

const pressed = (markup: string) =>
  [...markup.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)].map(
    ([, on, text]) => [text, on],
  );

describe('SHEET-39 the roll dialog', () => {
  it('opens on initiative as a dialog: its formula, both modes off, nothing rolled yet', () => {
    const markup = dialog(goldenB, 'init.total');
    expect(markup).toMatch(/role="dialog" aria-modal="true"/);
    expect(markup).toContain('>Initiative</h2>');
    expect(markup).toContain('d20 + 3');
    expect(pressed(markup)).toEqual([
      ['Advantage', 'false'],
      ['Disadvantage', 'false'],
    ]);
    expect(markup).toContain('>Roll<');
    expect(markup).not.toContain('data-testid="roll-total"');
    expect(markup).not.toContain('Roll damage');
    expect(markup).toContain('aria-label="Close"');
  });

  it('names a weapon attack by its weapon, with the bonus the sheet computed', () => {
    const markup = dialog(goldenB, 'attacks.greatsword.hit');
    expect(markup).toContain('>Greatsword attack</h2>');
    expect(markup).toContain('d20 + 5');
  });

  it("names a spell attack by its class: golden A's is +5", () => {
    const markup = dialog(goldenA, 'classes.cleric.spell.attack');
    expect(markup).toContain('>Cleric spell attack</h2>');
    expect(markup).toContain('d20 + 5');
  });

  it('names a save and a skill by their entries', () => {
    expect(dialog(goldenB, 'abilities.str.save')).toContain('Strength save');
    expect(dialog(goldenB, 'skills.perception.total')).toContain('>Perception</h2>');
  });

  it('says so for a number that rolls nothing, and offers no roll', () => {
    const markup = dialog(goldenB, 'ac.total');
    expect(markup).toContain('This number cannot be rolled.');
    expect(markup).not.toContain('>Roll<');
  });
});
