import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { shownWeight } from '../src/settings/units';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { Coins } from '../src/sheet/sections/Coins';
import { Items } from '../src/sheet/sections/Items';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-50: the Gear tab's items on golden B (SPEC §6.7): chain mail (55 lb) and a greatsword
// (6 lb), both worn (SRD 5.2.1's weights). The charms are made up and need attunement.
// SHEET-51: its coins: golden B holds none, so each test sets the counts it draws.

void i18n;
const packs = installBuiltInPacks().packs;
const CHAIN = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';
const SWORD = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d';

function drawn(change: object = {}, Section: () => ReactNode = Items): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({ ...goldenB, ...change });
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
        <Section />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const rowOf = (html: string, uid: string) =>
  html.split(`data-row="${uid}"`)[1]?.split('</li>')[0] ?? '';
const inventory = (rows: object[]) => ({ systemData: { ...goldenB.systemData, inventory: rows } });

describe('SHEET-50 the Gear tab of golden B', () => {
  const html = drawn();

  it('lists what is carried, its weight by row and in all', () => {
    expect(text(html)).toContain('|Items|');
    expect(text(html)).toContain('|Carrying 61 lb|');
    expect(text(rowOf(html, CHAIN))).toContain('|Chain Mail|');
    expect(text(rowOf(html, CHAIN))).toContain('×1 · 55 lb');
    expect(text(rowOf(html, SWORD))).toContain('|Greatsword|');
    expect(text(rowOf(html, SWORD))).toContain('×1 · 6 lb');
  });

  it('shows each item worn, with no attunement switch for an item that asks for none', () => {
    for (const uid of [CHAIN, SWORD]) {
      const row = rowOf(html, uid);
      expect(row).toMatch(/role="switch" aria-checked="true" aria-labelledby/);
      expect(text(row)).toContain('|Worn|');
      expect(text(row)).not.toContain('Attuned');
    }
    expect(html).not.toContain('role="alert"');
  });

  it('gives each row its quantity, its place and a way to take it away', () => {
    const row = rowOf(html, CHAIN);
    expect(row).toContain('aria-label="One less Chain Mail"');
    expect(row).toContain('aria-label="One more Chain Mail"');
    expect(row).toMatch(/aria-label="One less Chain Mail"[^>]*disabled/);
    expect(text(row)).toContain('|Not in anything|');
    expect(row).toContain('aria-label="Remove Chain Mail"');
    // A row is not offered as its own container.
    expect(row).not.toContain(`value="${CHAIN}"`);
    expect(row).toContain(`value="${SWORD}"`);
  });
});

describe('SHEET-50 a row inside another, and rows that need more words', () => {
  const inside = inventory(
    goldenB.systemData.inventory.map((row) =>
      row.uid === SWORD ? { ...row, container: CHAIN } : row,
    ),
  );
  const html = drawn(inside);

  it('draws a row under the one it is inside, indented, and says how many it holds', () => {
    expect(text(rowOf(html, CHAIN))).toContain('1 inside');
    expect(rowOf(html, SWORD)).toBeDefined();
    expect(html).toMatch(new RegExp(`data-row="${SWORD}"[^>]*padding-inline-start:16px`));
    expect(html).toMatch(new RegExp(`data-row="${CHAIN}"[^>]*padding-inline-start:0px`));
    expect(text(html)).toContain('|Carrying 61 lb|');
  });

  it('offers a held row only the rows that are not inside it', () => {
    expect(rowOf(html, CHAIN)).not.toContain(`value="${SWORD}"`);
    expect(rowOf(html, SWORD)).toContain(`value="${CHAIN}" selected`);
  });
});

describe('SHEET-50 attunement, warnings and a missing item', () => {
  const charm = (n: number) => ({
    id: `character:item/charm-${n}`,
    type: 'item',
    ruleset: 'any',
    name: { en: `Charm ${n}` },
    source: { pack: 'character' },
    category: 'gear',
    magic: { rarity: 'rare', attunement: true },
  });
  const row = (n: number) => ({
    uid: `e1000000-0000-4000-8000-00000000000${n}`,
    itemId: `character:item/charm-${n}`,
    qty: 1,
    equipped: true,
    attuned: true,
  });
  const html = drawn({
    localEntities: [1, 2, 3, 4].map(charm),
    ...inventory([...goldenB.systemData.inventory, ...[1, 2, 3, 4].map(row)]),
  });

  it('shows the attunement switch of a charm that asks for it, on', () => {
    const one = rowOf(html, row(1).uid);
    expect(text(one)).toContain('|Attuned|');
    expect(one).toMatch(
      /aria-checked="true"[^>]*aria-labelledby[^>]*>.*Attuned|Attuned.*aria-checked="true"/s,
    );
  });

  it('warns in amber of a fourth attunement and never blocks it', () => {
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(text(html)).toContain('Attuned to 4 magic items: no more than 3 at a time.');
  });

  it('says a row whose item no pack holds is missing, and still lists it', () => {
    const lost = drawn(
      inventory([
        {
          uid: 'e1000000-0000-4000-8000-000000000007',
          itemId: 'srd-2024:item/nothing',
          qty: 2,
          equipped: false,
          attuned: false,
        },
      ]),
    );
    expect(text(lost)).toContain('Missing: srd-2024:item/nothing');
    expect(text(lost)).toContain('×2');
  });

  it('says nothing is carried when the inventory is empty', () => {
    expect(drawn(inventory([]))).toContain('Nothing is carried.');
  });
});

describe('SHEET-50 weight in the unit the person chose', () => {
  it('shows pounds as stored, and kilograms from the pound’s exact definition, to a tenth', () => {
    expect(shownWeight(61, 'lb')).toEqual({ value: 61, unit: 'lb' });
    // 0.45359237 kg to the pound: 61 lb = 27.669 kg, 55 lb = 24.948 kg, 6 lb = 2.722 kg.
    expect(shownWeight(61, 'kg')).toEqual({ value: 27.7, unit: 'kg' });
    expect(shownWeight(55, 'kg')).toEqual({ value: 24.9, unit: 'kg' });
    expect(shownWeight(6, 'kg')).toEqual({ value: 2.7, unit: 'kg' });
    expect(shownWeight(0, 'kg')).toEqual({ value: 0, unit: 'kg' });
  });
});

describe('SHEET-51 the Gear tab’s coins', () => {
  const coinsOf = (currency: object) =>
    drawn({ systemData: { ...goldenB.systemData, currency } }, Coins);
  const rowOfCoin = (html: string, coin: string) =>
    html.split(`data-coin="${coin}"`)[1]?.split('</li>')[0] ?? '';
  const html = coinsOf({ cp: 0, sp: 3, ep: 0, gp: 12, pp: 1200 });

  it('lists the five coins from the lowest, each with its count', () => {
    expect(text(html)).toContain('|Coins|');
    const order = ['cp', 'sp', 'ep', 'gp', 'pp'].map((coin) => html.indexOf(`data-coin="${coin}"`));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > (order[i - 1] ?? 0)))).toBe(true);
    expect(text(rowOfCoin(html, 'gp'))).toContain('|12|');
    expect(text(rowOfCoin(html, 'sp'))).toContain('|3|');
    // A count is written with its thousands apart.
    expect(text(rowOfCoin(html, 'pp'))).toContain('|1,200|');
  });

  it('gives each coin a − and a + for the steps 1 and 10, named by the coin', () => {
    const gold = rowOfCoin(html, 'gp');
    for (const label of ['Take 10 gold', 'Take 1 gold', 'Add 1 gold', 'Add 10 gold']) {
      expect(gold).toContain(`aria-label="${label}"`);
    }
    expect(text(gold)).toContain('|−10|−1|');
    expect(text(gold)).toContain('|+1|+10|');
  });

  it('turns a − off when it would take the count below 0', () => {
    const gold = rowOfCoin(html, 'gp');
    // 12 gold: a step of 10 is possible; 3 silver: a step of 10 is not, a step of 1 is.
    expect(gold).not.toMatch(/aria-label="Take 10 gold"[^>]*disabled/);
    const silver = rowOfCoin(html, 'sp');
    expect(silver).toMatch(/aria-label="Take 10 silver"[^>]*disabled/);
    expect(silver).not.toMatch(/aria-label="Take 1 silver"[^>]*disabled/);
    const copper = rowOfCoin(html, 'cp');
    expect(copper).toMatch(/aria-label="Take 1 copper"[^>]*disabled/);
    expect(copper).not.toMatch(/aria-label="Add 1 copper"[^>]*disabled/);
  });
});

describe('SHEET-52 a custom item', () => {
  const ROPE = 'e1000000-0000-4000-8000-0000000000aa';
  const html = drawn(
    inventory([
      ...goldenB.systemData.inventory,
      {
        uid: ROPE,
        custom: { name: 'Rope', weight: 10 },
        qty: 2,
        equipped: false,
        attuned: false,
        note: '50 feet of hemp',
      },
    ]),
  );

  it('is listed by its own name with its weight and its words', () => {
    const row = rowOf(html, ROPE);
    expect(text(row)).toContain('|Rope|');
    expect(text(row)).toContain('×2 · 20 lb');
    expect(text(row)).toContain('|50 feet of hemp|');
    // Chain mail 55 + greatsword 6 + 2 ropes of 10 = 81.
    expect(text(html)).toContain('|Carrying 81 lb|');
  });

  it('can be counted, kept in something and removed as any row, but not worn', () => {
    const row = rowOf(html, ROPE);
    expect(row).toContain('aria-label="One more Rope"');
    expect(row).toContain('aria-label="Remove Rope"');
    expect(text(row)).not.toContain('Worn');
  });
});
