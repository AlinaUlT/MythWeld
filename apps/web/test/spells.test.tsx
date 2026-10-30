import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { SpellList } from '../src/sheet/sections/SpellList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-46: the Spells tab on the goldens of SPEC §6.7 and the built-in packs. Golden A is a hill
// dwarf cleric 1 (2014): Wisdom, spell save DC 13, attack +5, two level 1 slots, Bless and Cure
// Wounds granted by the Life domain. Golden C is wizard 3 and paladin 3 (2014): slots 4 and 3.
// Golden B is a fighter. The feat and the spells it gives are made up (ENG-57 §8's shapes).

const packs = installBuiltInPacks().packs;
const words = en.spells;

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
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{node}</SheetContext>
    </MemoryRouter>,
  );
}

const tab = (golden: object) => draw(sheetOf(golden), <SpellList />);

/** The text of an element opening with `open`, tags removed, spaces squeezed. */
function textOf(html: string, open: string): string[] {
  return [...html.matchAll(new RegExp(`${open}[^>]*>(.*?)</(?:button|li)>`, 'g'))].map(
    ([, inner]) =>
      (inner ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
  );
}

const spark = {
  id: 'character:spell/spark',
  type: 'spell',
  ruleset: 'any',
  name: { en: 'Spark' },
  source: { pack: 'character' },
  level: 1,
  school: 'evocation',
  castingTime: { value: 1, unit: 'action' },
  range: { kind: 'self' },
  components: { v: true, s: true },
  duration: { kind: 'instant' },
  concentration: false,
  ritual: false,
  classes: ['cleric'],
};
const gifted = {
  id: 'character:feat/gifted',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Gifted' },
  source: { pack: 'character' },
  grants: [
    {
      id: 'spark',
      kind: 'spell',
      fixed: [spark.id],
      ability: 'int',
      key: 'giftedSpark',
      uses: { max: '1', recovery: [{ on: 'long', amount: 'all' }] },
    },
  ],
};
const withGift = (spent: number) => ({
  ...goldenA,
  localEntities: [spark, gifted],
  state: { ...goldenA.state, resources: spent === 0 ? {} : { giftedSpark: spent } },
  systemData: { ...goldenA.systemData, feats: [{ id: gifted.id }] },
});

describe('SHEET-46 the Spells tab', () => {
  it("golden A: WIS, save DC 13 and attack +5, as the header's numbers are", () => {
    const html = tab(goldenA);
    expect(html).toContain('WIS');
    expect(textOf(html, 'data-path="classes\\.cleric\\.spell\\.dc"')).toEqual(['Save DC 13']);
    expect(textOf(html, 'data-path="classes\\.cleric\\.spell\\.attack"')).toEqual(['Attack +5']);
  });

  it('golden A: one column "Level 1" of two filled circles, none spent', () => {
    const html = tab(goldenA);
    expect(html).toContain('aria-label="Level 1: 2 of 2 slots left"');
    expect(html.match(/data-slot="left"/g)).toHaveLength(2);
    expect(html).not.toContain('data-slot="spent"');
    expect(html).toContain('data-path="spell.slots.level1"');
  });

  it('shows a spent slot as a hollow circle before those left', () => {
    const html = tab({
      ...goldenA,
      systemData: {
        ...goldenA.systemData,
        state: { ...goldenA.systemData.state, slotsSpent: { '1': 1 } },
      },
    });
    expect(html).toContain('aria-label="Level 1: 1 of 2 slots left"');
    expect(html.match(/data-slot="(?:spent|left)"/g)).toEqual([
      'data-slot="spent"',
      'data-slot="left"',
    ]);
  });

  it('golden C: columns for levels 1 and 2 with 4 and 3 slots, and a line for each class', () => {
    const html = tab(goldenC2014);
    expect(html).toContain('aria-label="Level 1: 4 of 4 slots left"');
    expect(html).toContain('aria-label="Level 2: 3 of 3 slots left"');
    expect(html).not.toContain('Level 3:');
    expect(html).toContain('INT');
    expect(html).toContain('CHA');
  });

  it("lists golden A's granted spells with their source and no limit", () => {
    const rows = textOf(tab(goldenA), '<li class="[^"]*"');
    expect(rows).toEqual([
      'Bless Level 1 · from Life 2014',
      'Cure Wounds Level 1 · from Life 2014',
    ]);
  });

  it('marks a spell a grant gives with its own uses "no spell slot" with its limit', () => {
    const rows = textOf(tab(withGift(0)), '<li class="[^"]*"');
    expect(rows).toContain('Spark Level 1 · from Gifted · no spell slot · 1/LR');
  });

  it('says how many uses are left once one is spent', () => {
    const rows = textOf(tab(withGift(1)), '<li class="[^"]*"');
    expect(rows).toContain('Spark Level 1 · from Gifted · no spell slot · 1/LR · 0 left');
  });

  it("adds a line for the stat the grant's spells are cast with: INT, DC 9, attack +1", () => {
    const html = tab(withGift(0));
    expect(textOf(html, 'data-path="abilities\\.int\\.spell\\.dc"')).toEqual(['Save DC 9']);
    expect(textOf(html, 'data-path="abilities\\.int\\.spell\\.attack"')).toEqual(['Attack +1']);
    expect(html).toContain(words.casting.granted);
  });

  it('lists a class list by level then name, prepared before known, and says a missing spell is', () => {
    const rows = textOf(
      tab({
        ...goldenA,
        systemData: {
          ...goldenA.systemData,
          spells: {
            'srd-2014:class/cleric': {
              known: ['srd-2014:spell/nope'],
              prepared: ['srd-2014:spell/cure-wounds', 'srd-2014:spell/bless'],
            },
          },
        },
      }),
      '<li class="[^"]*"',
    ).slice(0, 3);
    expect(rows).toEqual([
      'Bless Level 1 · Prepared 2014',
      'Cure Wounds Level 1 · Prepared 2014',
      'Missing: srd-2014:spell/nope Known',
    ]);
  });

  it('warns, and never blocks, on a spell of the other edition', () => {
    const html = tab({
      ...goldenA,
      localEntities: [{ ...spark, ruleset: '2024' }],
      systemData: {
        ...goldenA.systemData,
        spells: { 'srd-2014:class/cleric': { prepared: [spark.id] } },
      },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('A 2024 spell on a 2014 character');
    expect(html).toContain('Spark');
  });

  it('says a fighter has no spells and no slots', () => {
    const html = tab(goldenB);
    expect(html).toContain(words.empty);
    expect(html).not.toContain('data-slot=');
  });
});
