import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { SWIPE_PX, swipedTab } from '../src/pages/SheetPage';
import { shownDistance } from '../src/settings/units';
import { ToastHost } from '../src/shared/ToastHost';
import { Inspiration } from '../src/sheet/header/Inspiration';
import { ActionsMenu } from '../src/sheet/panels/ActionsMenu';
import { ChoicesPanel } from '../src/sheet/panels/ChoicesPanel';
import { NumberPad } from '../src/sheet/panels/NumberPad';
import { RestPanel } from '../src/sheet/panels/RestPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { SheetDice } from '../src/sheet/SheetDice';
import { barShares, SheetDock } from '../src/sheet/SheetDock';
import { SheetHeader } from '../src/sheet/SheetHeader';
import { formatNumber, numberAt } from '../src/sheet/SheetNumber';
import { SpellList } from '../src/sheet/sections/SpellList';
import { SHEET_TABS, tabOf } from '../src/sheet/tabs';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// The goldens of SPEC §6.7 on the built-in packs: B a human fighter 1 (AC 17, initiative +3,
// speed 30, proficiency +2, passive Perception 13, 12 hit points), A a hill dwarf cleric 1
// (Wisdom, spell save DC 13, spell attack +5), C wizard 3 then paladin 3.

const packs = installBuiltInPacks().packs;
const t = i18n.getFixedT('en', 'sheet');

function sheetOf(golden: object, editing = false): SheetValue {
  const character: AppCharacter = fifthEditionCharacterSchema.parse(golden);
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const computed = compute(character, content.index, system.module);
  return { character, content, computed, system, editing, roll: () => {}, breakdown: () => {} };
}

function draw(sheet: SheetValue, node: ReactNode): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{node}</SheetContext>
    </MemoryRouter>,
  );
}

const noop = () => {};
const header = (sheet: SheetValue) =>
  draw(sheet, <SheetHeader onChoices={noop} onRest={noop} onEdit={noop} onActions={noop} />);

/** The text of every element whose `data-path` is `path`, tags removed. */
function textAt(html: string, path: string): string[] {
  return [
    ...html.matchAll(
      new RegExp(`data-path="${path.replace('.', '\\.')}"[^>]*>(.*?)</button>`, 'g'),
    ),
  ].map(([, inner]) =>
    (inner ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

describe('SHEET-30 the sheet header', () => {
  it("shows golden B's name, class line, edition and stats row from Computed", () => {
    const html = header(sheetOf(goldenB));
    expect(html).toContain('>Golden B</h1>');
    expect(html).toContain('Fighter 1');
    expect(html).toContain('>2024<');
    expect(textAt(html, 'ac.total')).toEqual(['17 AC']);
    expect(textAt(html, 'init.total')).toEqual(['+3 Init']);
    expect(textAt(html, 'speed.walk')).toEqual(['30 ft Speed']);
    expect(textAt(html, 'prof')).toEqual(['+2 Prof']);
    expect(textAt(html, 'skills.perception.passive')).toEqual(['13 Passive']);
    // A fighter casts nothing: no spellcasting line.
    expect(html).not.toContain(en.sheet.casting.dc);
  });

  it("shows golden A's spellcasting line: WIS, save DC 13, attack +5", () => {
    const html = header(sheetOf(goldenA));
    expect(html).toContain('WIS');
    expect(textAt(html, 'classes.cleric.spell.dc')).toEqual(['Save DC 13']);
    expect(textAt(html, 'classes.cleric.spell.attack')).toEqual(['Attack +5']);
  });

  it('names every class with its level, and a line per casting class', () => {
    const html = header(sheetOf(goldenC2014));
    expect(html).toContain('Wizard 3 · Paladin 3');
    expect(html).toContain('INT');
    expect(html).toContain('CHA');
  });

  it('shows the lock in play mode, and the pressed switch in edit mode', () => {
    expect(header(sheetOf(goldenB))).toContain('aria-pressed="false"');
    expect(header(sheetOf(goldenB, true))).toContain('aria-pressed="true"');
  });

  it('shows the choices badge only while a choice is pending', () => {
    const made = sheetOf(goldenB);
    const count = made.computed.pendingChoices.length + made.computed.pendingKeys.length;
    expect(count).toBe(0);
    expect(header(made)).not.toContain('choices to make');
    const unmade = sheetOf({ ...goldenB, choices: {} });
    const pending = unmade.computed.pendingChoices.length + unmade.computed.pendingKeys.length;
    expect(pending).toBeGreaterThan(0);
    expect(header(unmade)).toContain(`aria-label="${pending} choices to make"`);
    expect(header(unmade)).toContain(`>!${pending}<`);
  });
});

describe('SHEET-30 the dock', () => {
  const dock = (sheet: SheetValue) =>
    draw(sheet, <SheetDock tab="combat" onTab={noop} onNumberPad={noop} />);

  it("shows golden B's 12 of 12 hit points, Damage, Heal and the eight tabs", () => {
    const html = dock(sheetOf(goldenB));
    expect(textAt(html, 'hp.max')).toEqual(['Hit points 12 / 12']);
    expect(html).toContain('>Damage<');
    expect(html).toContain('>Heal<');
    const tabs = [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(([, name]) => name);
    expect(tabs).toEqual([
      'Main',
      'Turn',
      'Combat',
      'Spells',
      'Gear',
      'Features',
      'About',
      'Notes',
    ]);
    expect(html).toMatch(/aria-selected="true"[^>]*>Combat</);
  });

  it('shows temporary hit points in their own colour, as a number and a part of the bar', () => {
    const golden = structuredClone(goldenB) as typeof goldenB;
    golden.systemData.state.hp = { current: 12, temp: 5 };
    const html = dock(sheetOf(golden));
    expect(html).toContain('<span class="text-temp">+5</span>');
    expect(html).toMatch(/class="bg-temp" style="width:29\.41/);
    expect(html).toMatch(/class="bg-hp" style="width:70\.58/);
  });

  it('splits the bar over the maximum and the temporary hit points', () => {
    expect(barShares(12, 12, 0)).toEqual({ hp: 100, temp: 0 });
    expect(barShares(6, 12, 0)).toEqual({ hp: 50, temp: 0 });
    expect(barShares(0, 0, 0)).toEqual({ hp: 0, temp: 0 });
    const withTemp = barShares(12, 12, 5);
    expect(withTemp.hp).toBeCloseTo(70.588, 3);
    expect(withTemp.temp).toBeCloseTo(29.412, 3);
  });

  it('lifts the toast above the dock by its height', () => {
    expect(renderToStaticMarkup(<ToastHost />)).toContain(
      'bottom-[calc(var(--dock-height,0px)+16px)]',
    );
  });
});

describe('SHEET-30 numbers', () => {
  it('writes a number plain, with its sign, or as a distance in the chosen unit', () => {
    expect(formatNumber(3, 'signed', t, 'ft')).toBe('+3');
    expect(formatNumber(0, 'signed', t, 'ft')).toBe('+0');
    expect(formatNumber(-1, 'signed', t, 'ft')).toBe('−1');
    expect(formatNumber(17, 'plain', t, 'ft')).toBe('17');
    expect(formatNumber(30, 'distance', t, 'ft')).toBe('30 ft');
    expect(formatNumber(30, 'distance', t, 'm')).toBe('9 m');
    expect(formatNumber(25, 'distance', t, 'm')).toBe('7.5 m');
    expect(formatNumber(undefined, 'signed', t, 'ft')).toBe('—');
  });

  it('shows 5 feet as 1.5 m, and keeps feet as they are', () => {
    expect(shownDistance(5, 'm')).toEqual({ value: 1.5, unit: 'm' });
    expect(shownDistance(30, 'm')).toEqual({ value: 9, unit: 'm' });
    expect(shownDistance(35, 'ft')).toEqual({ value: 35, unit: 'ft' });
  });

  it("reads only Computed's own numbers", () => {
    const { computed } = sheetOf(goldenB);
    expect(numberAt(computed, 'ac.total')).toBe(17);
    expect(numberAt(computed, 'toString')).toBeUndefined();
    expect(numberAt(computed, 'no.such.path')).toBeUndefined();
  });
});

describe('SHEET-30 tabs', () => {
  it('keeps the tab in the address; Main for none or an unknown one', () => {
    expect(tabOf(null)).toBe('main');
    expect(tabOf('combat')).toBe('combat');
    expect(tabOf('nope')).toBe('main');
  });

  it('moves one tab on a sideways swipe, and not on a short or a mostly upright one', () => {
    expect(swipedTab('main', -SWIPE_PX, 0)).toBe('turn');
    expect(swipedTab('turn', SWIPE_PX, 0)).toBe('main');
    expect(swipedTab('main', SWIPE_PX, 0)).toBe('main');
    expect(swipedTab('notes', -SWIPE_PX, 0)).toBe('notes');
    expect(swipedTab('main', -(SWIPE_PX - 1), 0)).toBe('main');
    expect(swipedTab('main', -SWIPE_PX, SWIPE_PX)).toBe('main');
  });

  it('draws the dice button, its panel closed', () => {
    const html = draw(sheetOf(goldenB), <SheetDice />);
    expect(html).toContain(`aria-label="${en.sheet.dice}"`);
    expect(html).toContain('bottom-[calc(var(--dock-height,0px)+16px)]');
    expect(html).not.toContain('role="dialog"');
  });

  it('creates every section and panel empty, for the rows that fill them', () => {
    const sheet = sheetOf(goldenB);
    // Fourteen files; Conditions stands on two tabs. SHEET-46 filled the Spells tab's.
    const all = [...new Set(SHEET_TABS.flatMap(({ sections }): ComponentType[] => [...sections]))];
    expect(all).toHaveLength(14);
    const sections = all.filter((Section) => Section !== SpellList);
    expect(sections).toHaveLength(13);
    for (const Section of [...sections, Inspiration]) {
      expect(draw(sheet, <Section />)).toBe('');
    }
    for (const Panel of [RestPanel, ActionsMenu, ChoicesPanel]) {
      expect(draw(sheet, <Panel onClose={noop} />)).toBe('');
    }
    expect(draw(sheet, <NumberPad mode="damage" onClose={noop} />)).toBe('');
  });
});

describe('SHEET-68 squares', () => {
  // SRD 5.2.1, "Playing on a Grid": each square is 5 feet; a Speed of 30 feet is 6 squares.
  it('shows feet as whole 5-foot squares', () => {
    expect(shownDistance(30, 'sq')).toEqual({ value: 6, unit: 'sq' });
    expect(shownDistance(5, 'sq')).toEqual({ value: 1, unit: 'sq' });
    expect(shownDistance(0, 'sq')).toEqual({ value: 0, unit: 'sq' });
    // A leftover under 5 feet enters no square.
    expect(shownDistance(25, 'sq')).toEqual({ value: 5, unit: 'sq' });
    expect(shownDistance(4, 'sq')).toEqual({ value: 0, unit: 'sq' });
    expect(formatNumber(30, 'distance', t, 'sq')).toBe('6 sq');
  });
});

describe('SHEET-46 the Spells tab', () => {
  // Golden A (2014): cleric 1, Wisdom, spell save DC 13, spell attack +5, two level 1 slots, and
  // the Life domain's Bless and Cure Wounds. Golden C (2014): wizard 3 and paladin 3, slots 4, 3.
  const text = (html: string) =>
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  it("shows golden A's spellcasting at a glance, its two slots and its domain spells", () => {
    const html = draw(sheetOf(goldenA), <SpellList />);
    expect(text(html)).toContain('WIS');
    expect(textAt(html, 'classes.cleric.spell.dc')).toEqual(['Save DC 13']);
    expect(textAt(html, 'classes.cleric.spell.attack')).toEqual(['Attack +5']);
    expect(html.match(/data-slot-level="1"/g)).toHaveLength(2);
    expect(html.match(/data-slot-left="true"/g)).toHaveLength(2);
    expect(text(html)).toContain('Level 1');
    expect(html).toContain('Bless');
    expect(html).toContain('Cure Wounds');
    expect(text(html)).toContain('Always prepared');
    expect(text(html)).not.toContain('no spell slot');
  });

  it("draws golden C's slots by level, spent ones empty", () => {
    const sheet = sheetOf({
      ...goldenC2014,
      state: goldenC2014.state,
      systemData: {
        ...goldenC2014.systemData,
        state: { ...goldenC2014.systemData.state, slotsSpent: { '2': 1 } },
      },
    });
    const html = draw(sheet, <SpellList />);
    expect(html.match(/data-slot-level="1"/g)).toHaveLength(4);
    expect(html.match(/data-slot-level="2"/g)).toHaveLength(3);
    expect(html.match(/data-slot-level="2"[^>]*data-slot-left="true"/g)).toHaveLength(2);
    expect(html.match(/data-slot-level="2"[^>]*data-slot-left="false"/g)).toHaveLength(1);
    expect(text(html)).toContain('Level 2: 2 of 3 left');
  });

  it('says a spell a feature gives has no slot, with its limit and its source', () => {
    const feat = {
      id: 'character:feat/gifted',
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Gifted' },
      source: { pack: 'character' },
      grants: [
        {
          id: 'spark',
          kind: 'spell',
          fixed: ['character:spell/spark', 'character:spell/gone'],
          key: 'giftedSpark',
          uses: { max: '1', recovery: [{ on: 'long', amount: 'all' }] },
        },
      ],
    };
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
      classes: ['hexer'],
    };
    const html = draw(
      sheetOf({
        ...goldenB,
        localEntities: [feat, spark],
        systemData: { ...goldenB.systemData, feats: [{ id: feat.id }] },
      }),
      <SpellList />,
    );
    expect(text(html)).toContain('Spark Level 1 · from Gifted · no spell slot · 1/LR Pack');
    expect(text(html)).toContain('Missing: character:spell/gone');
    // A character who casts nothing has no glance and no grid, but this one's list.
    expect(html).not.toContain('data-slot-level');
  });

  it('says so when the character has no spells', () => {
    expect(text(draw(sheetOf(goldenB), <SpellList />))).toBe('No spells yet.');
  });
});
