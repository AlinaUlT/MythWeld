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
import { formatNumber } from '../src/sheet/SheetNumber';
import { Items } from '../src/sheet/sections/Items';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-50: the Gear tab. Golden B (SPEC §6.7) carries chain mail (55 lb) and a greatsword (6 lb),
// both worn: 61 lb in all. The rows added here are made up; every value below was worked out by
// hand in the ticket, never copied from a run.

const packs = installBuiltInPacks().packs;
const t = i18n.getFixedT('en', 'sheet');

const CHAIN_MAIL = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';
const GREATSWORD = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d';

type Row = AppCharacter['systemData']['inventory'][number];

const uid = (n: number) => `a7000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const plain = (n: number, name: string, extra: Partial<Row> = {}): Row => ({
  uid: uid(n),
  custom: { name },
  qty: 1,
  equipped: false,
  attuned: false,
  ...extra,
});
const charm = (n: number) => ({
  id: `character:item/charm-${n}`,
  type: 'item',
  ruleset: 'any',
  name: { en: `Charm ${n}` },
  source: { pack: 'character' },
  category: 'gear',
  magic: { rarity: 'rare', attunement: true },
});

/** A made-up light armor, so a second armor can be worn beside the chain mail. */
const leather = {
  id: 'character:item/leather',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Leather' },
  source: { pack: 'character' },
  category: 'armor',
  armor: { group: 'light', baseAC: 11, dexCap: null },
};

function sheetOf(more: Row[] = [], options: { replace?: boolean; editing?: boolean } = {}) {
  const base = options.replace ? [] : goldenB.systemData.inventory;
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...goldenB,
    localEntities: [...[1, 2, 3, 4].map(charm), leather],
    systemData: { ...goldenB.systemData, inventory: [...base, ...more] },
  });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const computed = compute(character, content.index, system.module);
  const sheet: SheetValue = {
    character,
    content,
    computed,
    system,
    editing: options.editing ?? false,
    roll: () => {},
    breakdown: () => {},
  };
  return sheet;
}

function draw(sheet: SheetValue, node: ReactNode): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{node}</SheetContext>
    </MemoryRouter>,
  );
}

/** The text of the element whose `data-path` is `path`, tags removed. */
function textAt(html: string, path: string): string | undefined {
  const found = new RegExp(`data-path="${path.replace(/\./g, '\\.')}"[^>]*>(.*?)</button>`).exec(
    html,
  );
  return found?.[1]
    ?.replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('SHEET-50 weights are shown in the unit the person chose', () => {
  it('keeps pounds to a hundredth and shows kilograms to a tenth', () => {
    expect(shownWeight(61, 'lb')).toEqual({ value: 61, unit: 'lb' });
    expect(shownWeight(0.25, 'lb')).toEqual({ value: 0.25, unit: 'lb' });
    // 61 × 0.45359237 = 27.669…, 55 × … = 24.947…, 6 × … = 2.721…
    expect(shownWeight(61, 'kg')).toEqual({ value: 27.7, unit: 'kg' });
    expect(shownWeight(55, 'kg')).toEqual({ value: 24.9, unit: 'kg' });
    expect(shownWeight(6, 'kg')).toEqual({ value: 2.7, unit: 'kg' });
  });

  it('writes a weight with its unit, and none as a dash', () => {
    expect(formatNumber(61, 'weight', t, 'ft')).toBe('61 lb');
    expect(formatNumber(61, 'weight', t, 'ft', 'kg')).toBe('27.7 kg');
    expect(formatNumber(undefined, 'weight', t, 'ft')).toBe('—');
  });
});

describe('SHEET-50 the Gear tab', () => {
  it("lists golden B's two worn rows with what each weighs and 61 lb in all", () => {
    const html = draw(sheetOf(), <Items />);
    expect(html).toContain('>Gear</h2>');
    expect(html).toContain('Chain Mail');
    expect(html).toContain('Greatsword');
    expect(textAt(html, 'weight.carried')).toBe('Carrying 61 lb');
    expect(textAt(html, `weight.row.${CHAIN_MAIL}`)).toBe('Weight 55 lb');
    expect(textAt(html, `weight.row.${GREATSWORD}`)).toBe('Weight 6 lb');
    expect(html).toContain('aria-pressed="true" aria-label="Worn: Chain Mail"');
    expect(html).toContain('aria-pressed="true" aria-label="Worn: Greatsword"');
    // Neither needs attunement, so neither has the switch; the count is of what is attuned.
    expect(html).not.toContain('aria-label="Attuned: Chain Mail"');
    expect(html).toContain('Attuned 0 of 3');
    expect(html).not.toContain('role="alert"');
  });

  it('shows an unworn row as not pressed, and a row with no weight as a dash', () => {
    const html = draw(sheetOf([plain(1, 'Lantern')]), <Items />);
    expect(html).toContain('aria-pressed="false" aria-label="Worn: Lantern"');
    // A custom row has no known item, so its attunement can be set.
    expect(html).toContain('aria-pressed="false" aria-label="Attuned: Lantern"');
    expect(html).toContain('>—</span>');
    expect(textAt(html, 'weight.carried')).toBe('Carrying 61 lb');
  });

  it('says a row no pack has by its id', () => {
    const missing: Row = {
      uid: uid(2),
      itemId: 'character:item/nope',
      qty: 1,
      equipped: false,
      attuned: false,
    };
    expect(draw(sheetOf([missing]), <Items />)).toContain('Missing: character:item/nope');
  });

  it('draws a container with its rows under it, and what they weigh', () => {
    // A pack (5 lb) holding 3 rations (2 lb each): the pack holds 6; carried 61 + 5 + 6 = 72.
    const rows = [
      plain(1, 'Pack', { custom: { name: 'Pack', weight: 5 } }),
      plain(2, 'Rations', { custom: { name: 'Rations', weight: 2 }, qty: 3, container: uid(1) }),
    ];
    const html = draw(sheetOf(rows), <Items />);
    expect(textAt(html, `weight.in.${uid(1)}`)).toBe('Inside 6 lb');
    expect(textAt(html, `weight.row.${uid(2)}`)).toBe('Weight 6 lb');
    expect(textAt(html, 'weight.carried')).toBe('Carrying 72 lb');
    expect(html).toContain('×3');
    // The rations are drawn inside the pack's own item.
    const pack = html.indexOf(`data-row="${uid(1)}"`);
    const rations = html.indexOf(`data-row="${uid(2)}"`);
    expect(rations).toBeGreaterThan(pack);
    expect(html.slice(pack, rations)).toContain('border-l');
  });

  it('offers the container select only in edit mode', () => {
    const rows = [plain(1, 'Pack')];
    expect(draw(sheetOf(rows), <Items />)).not.toContain('<select');
    const html = draw(sheetOf(rows, { editing: true }), <Items />);
    expect(html).toContain('aria-label="Where Pack is carried"');
    expect(html).toContain('>Carried loose</option>');
    expect(html).toContain('>In Chain Mail</option>');
    // A row is offered to every other row, never to itself: the two worn rows, not the pack.
    expect(html.match(/>In Pack<\/option>/g)).toHaveLength(2);
  });

  it('warns of a fourth attuned row and of two copies, and a second armor worn', () => {
    const attuned = (n: number, itemId = `character:item/charm-${n}`): Row => ({
      uid: uid(10 + n),
      itemId,
      qty: 1,
      equipped: true,
      attuned: true,
    });
    const html = draw(sheetOf([1, 2, 3, 4].map((n) => attuned(n))), <Items />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Attuned to 4 magic items; no more than 3 at a time.');
    expect(html).toContain('Attuned 4 of 3');
    const copies = draw(sheetOf([attuned(1), { ...attuned(1), uid: uid(20) }]), <Items />);
    expect(copies).toContain('Attuned to 2 copies of Charm 1; no more than one copy of an item.');
    const second: Row = {
      uid: uid(30),
      itemId: leather.id,
      qty: 1,
      equipped: true,
      attuned: false,
    };
    expect(draw(sheetOf([second]), <Items />)).toContain(
      'Leather counts for nothing: Chain Mail is already worn, and only one counts at a time.',
    );
  });

  it('says there is nothing carried for an empty inventory', () => {
    const html = draw(sheetOf([], { replace: true }), <Items />);
    expect(html).toContain('Nothing carried yet.');
    expect(html).not.toContain('<ul');
    expect(textAt(html, 'weight.carried')).toBe('Carrying 0 lb');
  });
});
