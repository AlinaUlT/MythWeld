import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { TurnList } from '../src/sheet/sections/TurnList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-49: the Turn tab. Golden B (SPEC §6.7, a 2024 fighter 1): a greatsword, +5 to hit, 2d6 +3
// slashing, mastery Graze; Second Wind, a Bonus Action in SRD 5.2.1, 2 uses. Golden A (a 2014 cleric
// 1): a warhammer, +3 to hit, 1d8 +1 bludgeoning; no feature of its pack names a timing.

void i18n;
const packs = installBuiltInPacks().packs;

function drawn(golden: object): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse(golden);
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
        <TurnList />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-49 the Turn tab', () => {
  it('has the board’s title and hint', () => {
    const html = text(drawn(goldenB));
    expect(html).toContain('|On your turn|a reminder, from your features|');
  });

  it('lists the attack first under Action, and Second Wind under Bonus action', () => {
    const html = drawn(goldenB);
    expect(html.indexOf('data-timing="action"')).toBeLessThan(html.indexOf('data-timing="bonus"'));
    const action = text(html.split('data-timing="action"')[1]?.split('</section>')[0] ?? '');
    expect(action).toContain('Attack: Greatsword');
    expect(action).toContain('+5');
    expect(action).toContain('2d6');
    expect(action).toContain('+3');
    expect(action).toContain('Mastery: Graze');
    const bonus = text(html.split('data-timing="bonus"')[1]?.split('</section>')[0] ?? '');
    expect(bonus).toContain('Second Wind');
    expect(bonus).toContain('Fighter · 2 of 2 left');
  });

  it('opens a group for the attacks of a character whose features name no action', () => {
    const html = text(drawn(goldenA));
    expect(html).toContain('|Action|');
    expect(html).toContain('Attack: Warhammer');
    expect(html).not.toContain('|Bonus action|');
  });

  it('says so when there is nothing to list', () => {
    const empty = {
      ...goldenA,
      systemData: { ...goldenA.systemData, classes: [], inventory: [] },
    };
    expect(text(drawn(empty))).toContain('Nothing to remind you of yet.');
  });
});
