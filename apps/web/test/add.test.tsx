import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { storedWeight } from '../src/settings/units';
import { AddPanel } from '../src/sheet/panels/AddPanel';
import { SheetAdd } from '../src/sheet/SheetAdd';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { FeatureList } from '../src/sheet/sections/FeatureList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-52: the "+" and its panel in edit mode, a custom feature's remove button, and the weight a
// person types in kilograms stored in pounds. Golden B (SPEC §6.7); the made-up feature has text only.

const packs = installBuiltInPacks().packs;
const ID = 'character:feat/custom-1a2b3c4d';
const own = {
  id: ID,
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Keen Eyes' },
  text: { en: 'You notice what others miss.' },
  source: { pack: 'character' },
};

function drawn(editing: boolean, view: ReactNode, extra: object = {}): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({ ...goldenB, ...extra });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const sheet: SheetValue = {
    character,
    content,
    computed: compute(character, content.index, system.module),
    system,
    editing,
    roll: () => {},
    breakdown: () => {},
    cast: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{view}</SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const withOwn = {
  localEntities: [own],
  systemData: { ...goldenB.systemData, feats: [...goldenB.systemData.feats, { id: ID }] },
};

describe('SHEET-52 the "+" and its panel', () => {
  it('shows the "+" in edit mode only', () => {
    expect(drawn(true, <SheetAdd onAdd={() => {}} />)).toContain('aria-label="Add to the sheet"');
    expect(drawn(false, <SheetAdd onAdd={() => {}} />)).toBe('');
  });

  it('opens on a list of what can be added: a custom item and a custom feature', () => {
    const html = drawn(true, <AddPanel onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(text(html)).toContain('|Add to the sheet|');
    expect(text(html)).toContain('|Custom item|Armor, weapon or gear of your own|');
    expect(text(html)).toContain('|Custom feature|A trait or feat of your own, as text|');
  });
});

describe('SHEET-52 a custom feature on the Features tab', () => {
  it('has a remove button in edit mode, and none in play mode or on a pack’s feat', () => {
    const edit = drawn(true, <FeatureList />, withOwn);
    expect(edit).toContain('aria-label="Remove Keen Eyes"');
    expect(edit).not.toContain('aria-label="Remove Savage Attacker"');
    expect(drawn(false, <FeatureList />, withOwn)).not.toContain('aria-label="Remove');
  });

  it('lists it under the feats by its own name', () => {
    const html = drawn(false, <FeatureList />, withOwn);
    expect(text(html)).toContain('|Feats|');
    expect(text(html)).toContain('Keen Eyes');
  });
});

describe('SHEET-52 a weight typed in the person’s unit', () => {
  // 1 lb is exactly 0.45359237 kg, so 1 kg is 2.2046 lb: 2 kg is 4.4092 lb and 0.5 kg is 1.1023 lb.
  it('stores pounds as typed, and kilograms as pounds to a hundredth', () => {
    expect(storedWeight(10, 'lb')).toBe(10);
    expect(storedWeight(2, 'kg')).toBe(4.41);
    expect(storedWeight(0.5, 'kg')).toBe(1.1);
    expect(storedWeight(1, 'kg')).toBe(2.2);
  });
});
