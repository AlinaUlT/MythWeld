import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { AddConditionPanel, ConditionPanel } from '../src/sheet/panels/ConditionPanels';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { Conditions } from '../src/sheet/sections/Conditions';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-42: the conditions on golden B (SPEC §6.7, a human fighter 1 of the 2024 rules, 12 hit
// points) with the 2024 pack's Exhaustion (6 levels), and on golden A (2014), which the 2024
// condition does not fit. Others are made up and stored as the character's own.

void i18n;
const packs = installBuiltInPacks().packs;
const EXHAUSTION = 'srd-2024:condition/exhaustion';

function sheetOf(
  golden: object,
  conditions: { id: string; level?: number }[],
  more: object = {},
): SheetValue {
  const base = golden as { state: object };
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...golden,
    state: { ...base.state, conditions },
    ...more,
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
    cast: () => {},
  };
}

const draw = (sheet: SheetValue, node: ReactNode) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{node}</SheetContext>
    </MemoryRouter>,
  );
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const noop = () => {};

describe('SHEET-42 the Conditions section', () => {
  it('says "No conditions" and offers "Add" when the character has none', () => {
    const html = text(draw(sheetOf(goldenB, []), <Conditions />));
    expect(html).toContain('|Conditions|Add|');
    expect(html).toContain('|No conditions|');
  });

  it('shows exhaustion with its level, and death at 6 with no number', () => {
    const two = text(draw(sheetOf(goldenB, [{ id: EXHAUSTION, level: 2 }]), <Conditions />));
    expect(two).toContain('|Exhaustion 2|');
    expect(two).not.toContain('No conditions');
    const six = text(draw(sheetOf(goldenB, [{ id: EXHAUSTION, level: 6 }]), <Conditions />));
    expect(six).toContain('|Exhaustion · death|');
    expect(six).not.toContain('Exhaustion 6');
  });

  it('shows a stored condition no pack holds as missing', () => {
    const html = text(draw(sheetOf(goldenB, [{ id: 'srd-2024:condition/gone' }]), <Conditions />));
    expect(html).toContain('|Missing: srd-2024:condition/gone|');
  });

  it("shows the condition's panel: its levels 1 to 6, 6 as death, and Remove", () => {
    const sheet = sheetOf(goldenB, [{ id: EXHAUSTION, level: 2 }]);
    const html = draw(sheet, <ConditionPanel id={EXHAUSTION} onClose={noop} />);
    for (const level of [1, 2, 3, 4, 5]) expect(html).toContain(`Set Exhaustion to level ${level}`);
    expect(html).toContain('Set Exhaustion to level 6');
    expect(text(html)).toContain('|6 · death|');
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Set Exhaustion to level 2"/);
    expect(text(html)).toContain('|Remove|');
    expect(text(html)).not.toContain('is death. It gives no number');
  });

  it('says in the panel that exhaustion 6 is death and gives no number', () => {
    const sheet = sheetOf(goldenB, [{ id: EXHAUSTION, level: 6 }]);
    expect(text(draw(sheet, <ConditionPanel id={EXHAUSTION} onClose={noop} />))).toContain(
      '|Exhaustion at this level is death. It gives no number.|',
    );
  });

  it('offers only Remove for a condition no pack holds', () => {
    const sheet = sheetOf(goldenB, [{ id: 'srd-2024:condition/gone' }]);
    const html = draw(sheet, <ConditionPanel id="srd-2024:condition/gone" onClose={noop} />);
    expect(text(html)).toContain('|Missing: srd-2024:condition/gone|');
    expect(text(html)).toContain('|Remove|');
  });

  it('lists the conditions to add, and none once they are all stored', () => {
    const html = draw(sheetOf(goldenB, []), <AddConditionPanel onClose={noop} />);
    expect(text(html)).toContain('|Add a condition|');
    expect(html).toContain(`data-condition="${EXHAUSTION}"`);
    const full = draw(sheetOf(goldenB, [{ id: EXHAUSTION }]), <AddConditionPanel onClose={noop} />);
    expect(text(full)).toContain('|No condition left to add.|');
  });

  it("warns that a condition of the other edition may not fit the character's rules base", () => {
    // A condition of the character's own, written for the 2014 rules, on a 2024 character.
    const old = {
      id: 'character:condition/dazed',
      type: 'condition',
      key: 'dazed',
      ruleset: '2014',
      name: { en: 'Dazed' },
      source: { pack: 'character' },
    };
    const html = draw(
      sheetOf(goldenB, [], { localEntities: [old] }),
      <AddConditionPanel onClose={noop} />,
    );
    expect(html).toContain('data-condition="character:condition/dazed"');
    expect(text(html)).toContain('|Dazed · 2014|');
    expect(text(html)).toContain(
      '|From the 2014 rules, and mixing editions is off. It may not fit.|',
    );
  });
});
