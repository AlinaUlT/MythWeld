import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import '../src/i18n';
import { currentToast, hideToast, undoToast } from '../src/shared/undo';
import { spendUse, switchFeature } from '../src/sheet/featureActions';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { FeatureList } from '../src/sheet/sections/FeatureList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-48: board V3-Features. Golden B is a human fighter 1 (Soldier, Defense): Second Wind has
// 2 uses, 1 back on a short rest, all on a long rest (the 2024 SRD's Fighter table and the pack's
// grant). Golden A is a hill dwarf cleric 1 with the Life domain.

const packs = installBuiltInPacks().packs;

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

const spentGoldenB = (spent: number) => ({
  ...goldenB,
  state: { ...goldenB.state, resources: { secondWind: spent } },
});

describe('SHEET-48 the Features tab', () => {
  it('draws golden B under Human, Fighter and Soldier, each named with what it is', () => {
    const html = draw(sheetOf(goldenB), <FeatureList />);
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2><span[^>]*>([^<]*)</g)];
    expect(headings.map(([, name, kind]) => [name, kind])).toEqual([
      ['Human', 'species'],
      ['Fighter', 'class · level 1'],
      ['Soldier', 'background'],
    ]);
    expect(text(html)).toContain('Savage Attacker');
    expect(text(html)).toContain('Defense');
  });

  it("shows Second Wind's uses, their recovery and a Use button", () => {
    const html = draw(sheetOf(goldenB), <FeatureList />);
    expect(text(html)).toContain('1 back on a short rest, all on a long rest');
    expect(text(html)).toContain('2 of 2 left');
    expect(html).toContain('aria-label="Second Wind: 2 of 2 uses left"');
    // Two full circles, none empty.
    expect(html.match(/size-4 rounded-full border-2 border-strong bg-strong/g)).toHaveLength(2);
    expect(html).toMatch(/<button[^>]*>Use<\/button>/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Use<\/button>/);
  });

  it('empties the circles as uses are spent, and disables Use at none', () => {
    const one = draw(sheetOf(spentGoldenB(1)), <FeatureList />);
    expect(text(one)).toContain('1 of 2 left');
    expect(one.match(/size-4 rounded-full border-2 border-strong bg-strong/g)).toHaveLength(1);
    expect(one.match(/size-4 rounded-full border-2 border-strong "/g)).toHaveLength(1);
    const none = draw(sheetOf(spentGoldenB(2)), <FeatureList />);
    expect(text(none)).toContain('0 of 2 left');
    expect(none).toMatch(/<button[^>]*\sdisabled=""[^>]*>Use<\/button>/);
  });

  it("names the Cleric's subclass on the line below its name", () => {
    const html = text(draw(sheetOf(goldenA), <FeatureList />));
    expect(html).toContain('Cleric class · level 1 Subclass: Life');
    expect(html).toContain('Dwarf species');
    expect(html).toContain('Acolyte background');
  });

  it('opens no description until a row is tapped', () => {
    expect(draw(sheetOf(goldenB), <FeatureList />)).not.toContain('See full description');
  });
});

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-48-${count}`);
  await database.open();
  await saveCharacter(fifthEditionCharacterSchema.parse(goldenB), database.characters);
});

afterEach(async () => {
  const toast = currentToast();
  if (toast) hideToast(toast);
  await database.delete();
});

async function storedSpent(): Promise<number | undefined> {
  const opened = await openCharacter(goldenB.id, database.characters);
  if (!opened.ok) throw new Error('not stored');
  return opened.value.state.resources.secondWind;
}

describe('SHEET-48 the Use button and the switches', () => {
  it('spends one use of Second Wind, with a toast that undoes it', async () => {
    const sheet = sheetOf(goldenB);
    const result = await spendUse(sheet.character, sheet.computed, 'secondWind', database);
    expect(result?.ok).toBe(true);
    expect(await storedSpent()).toBe(1);
    expect(currentToast()?.kind).toBe('changed');
    const toast = currentToast();
    if (toast === undefined) throw new Error('no toast');
    await undoToast(toast, undefined, database);
    expect(await storedSpent()).toBeUndefined();
  });

  it('refuses a use when none is left, and writes nothing', async () => {
    const spent = sheetOf(spentGoldenB(2));
    expect(await spendUse(spent.character, spent.computed, 'secondWind', database)).toBeUndefined();
    expect(await storedSpent()).toBeUndefined();
  });

  it('refuses a switch that is not a toggled effect of the character', async () => {
    const sheet = sheetOf(goldenB);
    const part = 'srd-2024:feat/defense#nope';
    expect(
      await switchFeature(sheet.character, sheet.computed, part, true, database),
    ).toBeUndefined();
  });
});
