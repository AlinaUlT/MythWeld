import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { FeatureList, MAX_DOTS, recoveryLabel } from '../src/sheet/sections/FeatureList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-48: the Features tab on the goldens of SPEC §6.7: B a human fighter 1 whose Second Wind
// has 2 uses (board V3-Features: "1 back on a short rest, all on a long rest"), A a hill dwarf
// cleric 1, C wizard 3 then paladin 3 with no species and no background.

const packs = installBuiltInPacks().packs;
const t = i18n.getFixedT('en', 'features');

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

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The headings of the groups, in order. */
const headings = (html: string) => [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map(([, h]) => h);

describe('SHEET-48 the Features tab groups features by source', () => {
  it('golden B: the species, the class, the background, in that order, each with its kind', () => {
    const html = draw(sheetOf(goldenB), <FeatureList />);
    expect(headings(html)).toEqual(['Human', 'Fighter', 'Soldier']);
    expect(html.match(/data-source="[a-z]+"/g)).toEqual([
      'data-source="species"',
      'data-source="class"',
      'data-source="background"',
    ]);
    expect(text(html)).toContain('Fighter class · level 1 Subclass: chosen at a later level');
  });

  it('golden B: every feature a source gave is a row under it, a feat a feature gave too', () => {
    const html = draw(sheetOf(goldenB), <FeatureList />);
    const groups = html.split('<section').slice(1);
    const rows = (group: string | undefined) =>
      [
        ...(group ?? '').matchAll(
          /aria-expanded="false"[^>]*>.*?<span[^>]*font-bold[^>]*>(.*?)<\/span>/g,
        ),
      ].map(([, name]) => name);
    expect(rows(groups[0])).toEqual(['Resourceful', 'Skillful', 'Versatile', 'Alert']);
    expect(rows(groups[1])).toEqual(['Fighting Style', 'Defense', 'Second Wind', 'Weapon Mastery']);
    expect(rows(groups[2])).toEqual(['Savage Attacker']);
  });

  it("golden B: Second Wind shows its two uses, what comes back on each rest, and 'Use'", () => {
    const html = draw(sheetOf(goldenB), <FeatureList />);
    const body = text(html);
    expect(body).toContain('1 back on a short rest, all on a long rest');
    expect(body).toContain('2 of 2 left');
    expect(html.match(/data-filled="true"/g)).toHaveLength(2);
    expect(html).not.toContain('data-filled="false"');
    expect(html).toContain('aria-label="2 of 2 uses left"');
    expect(html).not.toContain('disabled=""');
  });

  it('golden B with both uses spent: no dot filled, "Use" disabled', () => {
    const spent = sheetOf({
      ...goldenB,
      state: { ...goldenB.state, resources: { secondWind: 2 } },
    });
    const html = draw(spent, <FeatureList />);
    expect(text(html)).toContain('0 of 2 left');
    expect(html).not.toContain('data-filled="true"');
    expect(html.match(/data-filled="false"/g)).toHaveLength(2);
    expect(html).toContain('disabled=""');
  });

  it('golden A: the lineage under the species, the chosen subclass under the class', () => {
    const sheet = sheetOf(goldenA);
    const name = (id: string) => {
      const found = sheet.content.index.get(id);
      return found.ok ? found.entity.name.en : id;
    };
    const body = text(draw(sheet, <FeatureList />));
    expect(headings(draw(sheet, <FeatureList />))).toEqual(['Dwarf', 'Cleric', 'Acolyte']);
    expect(body).toContain(`Lineage: ${name('srd-2014:lineage/hill-dwarf')}`);
    expect(body).toContain(`Subclass: ${name('srd-2014:subclass/life')}`);
  });

  it('golden C: each class with its level, no species and no background, no subclass chosen', () => {
    const html = draw(sheetOf(goldenC2014), <FeatureList />);
    expect(headings(html)).toEqual(['Wizard', 'Paladin']);
    expect(text(html)).toContain('Wizard class · level 3 Subclass: not chosen yet');
    expect(text(html)).toContain('Paladin class · level 3 Subclass: not chosen yet');
    expect(text(html).match(/No features listed\./g)).toHaveLength(2);
  });

  it('draws a toggled effect as a switch that shows its stored state, else its default', () => {
    const feat = {
      id: 'character:feat/focus',
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Focus' },
      source: { pack: 'character' },
      effects: [
        {
          id: 'focused',
          target: 'ac.bonus',
          op: 'add',
          value: 1,
          toggle: { label: { en: 'Focused' }, default: false },
        },
      ],
    };
    const given = {
      ...goldenB,
      localEntities: [feat],
      systemData: { ...goldenB.systemData, feats: [{ id: feat.id }] },
    };
    const off = draw(sheetOf(given), <FeatureList />);
    expect(headings(off).at(-1)).toBe('Feats');
    expect(off).toContain('role="switch" aria-checked="false"');
    expect(text(off)).toContain('Focused Off');
    const on = draw(
      sheetOf({
        ...given,
        state: { ...goldenB.state, toggles: { 'character:feat/focus#focused': true } },
      }),
      <FeatureList />,
    );
    expect(on).toContain('role="switch" aria-checked="true"');
    expect(text(on)).toContain('Focused On');
  });
});

describe('SHEET-48 the recovery label', () => {
  const path = 'resources.x.recovery.short';
  it('reads each event in the order the grants name them', () => {
    expect(
      recoveryLabel(
        [
          { on: 'short', amount: 1, path },
          { on: 'long', amount: 'all' },
        ],
        t,
      ),
    ).toBe('1 back on a short rest, all on a long rest');
    expect(recoveryLabel([{ on: 'dawn', amount: 'all' }], t)).toBe('all at dawn');
    expect(recoveryLabel([{ on: 'dawn', amount: 2, path }], t)).toBe('2 back at dawn');
  });

  it('names an event the locale has no words for as it is, and no recovery as nothing', () => {
    expect(recoveryLabel([{ on: 'eclipse', amount: 'all' }], t)).toBe('all on eclipse');
    expect(recoveryLabel([], t)).toBe('');
  });

  it('draws dots up to the most there is room for', () => {
    expect(MAX_DOTS).toBe(10);
  });
});
