import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { NumberPad, type NumberPadMode } from '../src/sheet/panels/NumberPad';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-40: the number pad on golden B (SPEC §6.7: a human fighter 1 of the 2024 rules, 12 hit
// points), with 5 temporary hit points where the board V3-TempHP draws them ("12 / 12 +5"). The
// pad's typing and its changes are the e2e test's; here, what it shows before a digit is typed.

void i18n;
const packs = installBuiltInPacks().packs;

function drawn(mode: NumberPadMode, temp = 0, current = 12): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...goldenB,
    systemData: {
      ...goldenB.systemData,
      state: { ...goldenB.systemData.state, hp: { current, temp } },
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
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <NumberPad mode={mode} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-40 the number pad', () => {
  it('opens in the mode of the dock button, with Damage, Heal and Temp HP to switch to', () => {
    const damage = drawn('damage');
    expect(text(damage)).toContain('|Damage|Heal|Temp HP|');
    expect(damage).toMatch(/aria-pressed="true"[^>]*>Damage</);
    expect(drawn('heal')).toMatch(/aria-pressed="true"[^>]*>Heal</);
  });

  it('shows the hit points before any digit: "12 / 12 → 12 / 12", and the amount 0', () => {
    const html = text(drawn('damage'));
    expect(html).toContain('|12 / 12 → 12 / 12|');
    expect(html).toContain('|0|');
  });

  it('shows temporary hit points in their own colour next to the hit points: "+5"', () => {
    const html = drawn('heal', 5);
    expect(text(html)).toContain('|12 / 12 → 12 / 12|+5|');
    expect(html).toContain('text-temp');
  });

  it('has the twelve keys of board V3-Keypad: 1 to 9, Clear, 0 and Delete', () => {
    const html = drawn('damage');
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      expect(html).toContain(`aria-label="${key}"`);
    }
    expect(html).toContain('aria-label="Clear"');
    expect(html).toContain('aria-label="Delete the last digit"');
  });

  it('names the action by the mode, and cannot apply an amount of 0', () => {
    for (const [mode, label] of [
      ['damage', 'Take 0 damage'],
      ['heal', 'Heal 0'],
    ] as const) {
      const html = drawn(mode);
      expect(text(html)).toContain(`|${label}|`);
      expect(html).toMatch(new RegExp(`disabled=""[^>]*>${label}<`));
    }
  });
});
