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
import { Attacks } from '../src/sheet/sections/Attacks';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-44: the Combat tab's attacks. Golden B (SPEC §6.7, a 2024 fighter 1): a greatsword, +5 to
// hit, 2d6 +3 slashing, mastery Graze. Golden A (a 2014 cleric 1): a warhammer, +3 to hit, 1d8 +1
// bludgeoning, no mastery.

void i18n;
const packs = installBuiltInPacks().packs;

function drawn(golden: object, equipped = true): string {
  const base = golden as { systemData: { inventory: { equipped: boolean }[] } };
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...golden,
    systemData: {
      ...base.systemData,
      inventory: base.systemData.inventory.map((row) => ({
        ...row,
        equipped: equipped && row.equipped,
      })),
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
        <Attacks />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-44 the Combat tab lists the attacks', () => {
  it("shows golden B's greatsword: +5 to hit, 2d6 +3 slashing, mastery Graze", () => {
    const html = drawn(goldenB);
    expect(text(html)).toContain('|Attacks|');
    expect(text(html)).toContain('|Greatsword|Melee · Mastery: Graze|');
    expect(text(html)).toContain('|Damage|2d6|Damage bonus|+3|Slashing|');
    expect(text(html)).toMatch(/\|Attack\|\+5\|/);
    expect(html).toContain('data-path="attacks.greatsword.hit"');
    expect(html).toContain('data-path="attacks.greatsword.damage"');
  });

  it("shows golden A's warhammer: +3 to hit, 1d8 +1 bludgeoning, no mastery", () => {
    const html = drawn(goldenA);
    expect(text(html)).toContain('|Warhammer|Melee|');
    expect(text(html)).toContain('|Damage|1d8|Damage bonus|+1|Bludgeoning|');
    expect(text(html)).toMatch(/\|Attack\|\+3\|/);
    expect(text(html)).not.toContain('Mastery');
  });

  it('says where to equip a weapon when none is equipped', () => {
    expect(text(drawn(goldenB, false))).toContain('|No attack. Equip a weapon on the Gear tab.|');
  });
});
