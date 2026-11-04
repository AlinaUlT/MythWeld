import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { BreakdownSheet } from '../src/shared/BreakdownSheet';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-35: "Base calculation" under the AC breakdown, on golden B (SPEC §6.7): chain mail 16,
// Defense +1, so AC 17. A feat of its own, Plated, appends 13 + DEX 1 = 14 (+1 = 15), as ENG-47's
// made-up feats do. The calculations are SHEET-21's candidates; the pick is the module's action.

const packs = installBuiltInPacks().packs;
const plated = {
  id: 'character:feat/plated',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Plated' },
  source: { pack: 'character' },
  effects: [
    { id: 'plated', target: 'ac.formulas', op: 'append', value: '13 + @abilities.dex.mod' },
  ],
};
const PLATED = 'character:feat/plated#plated';
const withPlated = {
  localEntities: [plated],
  systemData: { ...goldenB.systemData, feats: [{ id: 'character:feat/plated' }] },
};

function drawn(path: string, extra: object = {}, editing = true): string {
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
      <SheetContext value={sheet}>
        <BreakdownSheet path={path} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const radios = (html: string) =>
  [
    ...html.matchAll(
      /<button[^>]*role="radio"[^>]*aria-checked="(true|false)"[^>]*>(.*?)<\/button>/g,
    ),
  ].map(([, on, inner]) => [on, text(inner ?? '')]);

describe('SHEET-35 the base calculation under the AC breakdown', () => {
  it('offers nothing when only one calculation applies', () => {
    expect(drawn('ac.total')).not.toContain('Base calculation');
  });

  it('lists the highest and each calculation with its number; none pinned, Highest is on', () => {
    const html = drawn('ac.total', withPlated);
    expect(text(html)).toContain('|Base calculation|');
    expect(radios(html)).toEqual([
      ['true', '|Highest|'],
      ['false', '|Chain Mail|16|'],
      ['false', '|Plated|14|'],
    ]);
  });

  it('turns the pinned calculation on and draws the number it gives', () => {
    const html = drawn('ac.total', {
      ...withPlated,
      systemData: { ...withPlated.systemData, acCalc: PLATED },
    });
    expect(radios(html).map(([on]) => on)).toEqual(['false', 'false', 'true']);
    expect(text(html)).toContain('|AC 15 = AC base 14, AC bonus +1|');
    expect(html).not.toContain('data-testid="base-not-applying"');
  });

  it('is on the base number too, and not on another number', () => {
    expect(drawn('ac.base', withPlated)).toContain('Base calculation');
    expect(drawn('abilities.str.score', withPlated)).not.toContain('Base calculation');
  });

  it('is locked in play mode: the rows are off, and Edit is named', () => {
    const html = drawn('ac.total', withPlated, false);
    expect(html.match(/role="radio"[^>]*disabled=""/g)).toHaveLength(3);
    expect(text(html)).toContain('Turn on Edit to pick the calculation.');
  });

  it('warns about a pin that does not apply now, with the highest on', () => {
    const html = drawn('ac.total', {
      ...withPlated,
      systemData: { ...withPlated.systemData, acCalc: 'character:feat/gone#plated' },
    });
    expect(radios(html).map(([on]) => on)).toEqual(['true', 'false', 'false']);
    expect(text(html)).toContain(
      'The calculation you picked does not apply now; the highest one counts.',
    );
  });
});
