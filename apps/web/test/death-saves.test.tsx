import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { RollDialog } from '../src/shared/RollDialog';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { DeathSaves } from '../src/sheet/sections/DeathSaves';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-43: the Combat tab's death saves on golden B (SPEC §6.7, a 2024 fighter 1, 12 hit points):
// it shows for a dying, stable, dead or knocked-out character and for no one else.

void i18n;
const packs = installBuiltInPacks().packs;

interface Stored {
  hp?: { current: number; temp: number };
  deathSaves?: { success: number; failure: number; stable: boolean };
  knockedOut?: 'resting' | 'interrupted';
  conditions?: { id: string; level?: number }[];
}

function sheetOf({ hp, deathSaves, knockedOut, conditions }: Stored): SheetValue {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...goldenB,
    state: { ...goldenB.state, conditions: conditions ?? goldenB.state.conditions },
    systemData: {
      ...goldenB.systemData,
      state: {
        ...goldenB.systemData.state,
        ...(hp !== undefined && { hp }),
        ...(deathSaves !== undefined && { deathSaves }),
        ...(knockedOut !== undefined && { knockedOut }),
      },
    },
  });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  return {
    character,
    content,
    computed: compute(character, content.index, system.module),
    system,
    editing: false,
    roll: () => {},
    breakdown: () => {},
  };
}

const draw = (sheet: SheetValue, node = <DeathSaves />) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{node}</SheetContext>
    </MemoryRouter>,
  );
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const down = { current: 0, temp: 0 };

describe('SHEET-43 the death saves tracker', () => {
  it('shows for no one above 0 hit points', () => {
    expect(draw(sheetOf({}))).toBe('');
  });

  it('follows a dying character: its circles, Roll death save and Stabilize', () => {
    const html = draw(sheetOf({ hp: down, deathSaves: { success: 2, failure: 1, stable: false } }));
    expect(html).toContain('data-death-state="dying"');
    expect(text(html)).toContain('|Death saves|Successes|');
    expect(html).toContain('aria-label="Successes: 2 of 3"');
    expect(html).toContain('aria-label="Failures: 1 of 3"');
    expect(html.match(/data-filled="true"/g)).toHaveLength(3);
    expect(text(html)).toContain('|Roll death save|Stabilize|');
  });

  it('says a stable character makes no saves, and offers its 1 hit point after 1d4 hours', () => {
    const html = text(
      draw(sheetOf({ hp: down, deathSaves: { success: 0, failure: 0, stable: true } })),
    );
    expect(html).toContain('|Stable|');
    expect(html).toContain('|Regain 1 hit point|');
    expect(html).not.toContain('Roll death save');
  });

  it('offers a revival to the dead', () => {
    const html = text(
      draw(sheetOf({ hp: down, deathSaves: { success: 0, failure: 3, stable: false } })),
    );
    expect(html).toContain('|Dead|');
    expect(html).toContain('|Revive with 1 hit point|Revive with full hit points|');
  });

  it('shows a character dead of exhaustion at its highest level, whatever its hit points', () => {
    const html = draw(sheetOf({ conditions: [{ id: 'srd-2024:condition/exhaustion', level: 6 }] }));
    expect(html).toContain('data-death-state="dead"');
  });

  it('offers first aid to a knocked-out character at 1 hit point', () => {
    const html = text(draw(sheetOf({ hp: { current: 1, temp: 0 }, knockedOut: 'resting' })));
    expect(html).toContain('|Knocked out at 1 hit point|');
    expect(html).toContain('|First aid given|');
  });
});

describe('SHEET-43 the death save rolls in the roll dialog', () => {
  it('is a d20 with no number added, named "Death save"', () => {
    const html = draw(
      sheetOf({ hp: down }),
      <RollDialog path="deathSave.mode" onClose={() => {}} />,
    );
    expect(html).toContain('1d20 (Death save)');
  });
});
