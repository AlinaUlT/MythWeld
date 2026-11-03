import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { SpellList } from '../src/sheet/sections/SpellList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-46: the Spells tab of golden A (2014, SPEC §6.7: a cleric 1 with spell save DC 13, attack +5,
// two level 1 slots, the Life domain's Bless and Cure Wounds always prepared) and golden C (a wizard
// 3 and paladin 3: four level 1 and three level 2 slots, SRD 5.1's multiclass table). The spells
// below are made up.

void i18n;
const packs = installBuiltInPacks().packs;

function drawn(golden: object): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse(golden);
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
        <SpellList />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '|')
    .replace(/\|+/g, '|')
    .replaceAll('&#x27;', "'");
const columnOf = (html: string, level: string) =>
  html.split(`data-slot="${level}"`)[1]?.split('data-slot=')[0]?.split('</section>')[0] ?? '';
const spellOf = (html: string, id: string) =>
  html.split(`data-spell="${id}"`)[1]?.split('</li>')[0] ?? '';

const spell = (slug: string, level: number, ruleset: string) => ({
  id: `character:spell/${slug}`,
  type: 'spell',
  ruleset,
  name: { en: slug },
  source: { pack: 'character' },
  level,
  school: 'evocation',
  castingTime: { value: 1, unit: 'action' },
  range: { kind: 'self' },
  components: { v: true, s: true },
  duration: { kind: 'instant' },
  concentration: false,
  ritual: false,
  classes: ['cleric'],
});

describe('SHEET-46 the Spells tab of golden A', () => {
  const html = drawn(goldenA);

  it('shows spellcasting at a glance: Save DC 13 and Attack +5', () => {
    expect(text(html)).toContain('|Spellcasting|');
    expect(text(html)).toContain('|Cleric · WIS|');
    expect(text(html)).toMatch(/\|Save DC\|13\|/);
    expect(text(html)).toMatch(/\|Attack\|\+5\|/);
    expect(html).toContain('data-path="classes.cleric.spell.dc"');
  });

  it('draws the slots as a column of level 1 with two circles, both left', () => {
    const column = columnOf(html, '1');
    expect(text(html)).toContain('|Level 1|');
    expect(column.match(/data-left="true"/g)).toHaveLength(2);
    expect(column).not.toContain('data-left="false"');
    expect(text(column)).toContain('2 of 2 left');
    expect(html).not.toContain('data-slot="2"');
  });

  it('shows a spent slot as a hollow circle and says how many are left', () => {
    const spent = drawn({
      ...goldenA,
      systemData: {
        ...goldenA.systemData,
        state: { ...goldenA.systemData.state, slotsSpent: { 1: 1 } },
      },
    });
    const column = columnOf(spent, '1');
    expect(column.match(/data-left="true"/g)).toHaveLength(1);
    expect(column.match(/data-left="false"/g)).toHaveLength(1);
    expect(text(column)).toContain('1 of 2 left');
    expect(column).toContain('aria-label="Give back a Level 1 slot"');
    expect(column).toContain('aria-label="Spend a Level 1 slot"');
  });

  it('lists the Life domain’s spells as granted, with their source and that they are prepared', () => {
    expect(text(html)).toContain('|From your features|');
    for (const id of ['srd-2014:spell/bless', 'srd-2014:spell/cure-wounds']) {
      const row = text(spellOf(html, id));
      expect(row).toContain('Level 1 · from Life · always prepared');
    }
    expect(text(spellOf(html, 'srd-2014:spell/bless'))).toContain('|Bless|');
    expect(html).not.toContain('role="alert"');
  });
});

describe('SHEET-46 a multiclass caster', () => {
  it('has a column for each level of its slots: four of level 1, three of level 2', () => {
    const html = drawn(goldenC2014);
    expect(columnOf(html, '1').match(/data-left="true"/g)).toHaveLength(4);
    expect(columnOf(html, '2').match(/data-left="true"/g)).toHaveLength(3);
    expect(html).not.toContain('data-slot="3"');
  });
});

describe('SHEET-46 spells known and prepared, and their edition', () => {
  const cleric = 'srd-2014:class/cleric';
  const stored = (extra: object, spells: object, mix = false) => ({
    ...goldenA,
    allowMixedRulesets: mix,
    localEntities: [spell('flame', 1, '2024'), spell('mote', 0, 'any')],
    ...extra,
    systemData: { ...goldenA.systemData, spells },
  });

  it('shows a class’s lists: prepared first, then the known ones that are not prepared', () => {
    const html = drawn(
      stored(
        {},
        {
          [cleric]: {
            prepared: ['srd-2014:spell/bless'],
            known: ['srd-2014:spell/bless', 'character:spell/mote', 'srd-2014:spell/cure-wounds'],
          },
        },
      ),
    );
    expect(text(html)).toContain('|Cleric|Prepared|');
    expect(text(html)).toContain('|Known|');
    const known = text(html.split('|Known|')[0] ? html.slice(html.indexOf('Known')) : html);
    // A cantrip comes before a level 1 spell; a prepared spell is not listed again as known.
    expect(known.indexOf('Cantrip')).toBeLessThan(known.indexOf('Cure Wounds'));
    expect(html.match(/data-spell="srd-2014:spell\/bless"/g)).toHaveLength(2);
  });

  it('warns of a spell of the other edition, mixing off, and says it is mixed, mixing on', () => {
    const off = drawn(stored({}, { [cleric]: { known: ['character:spell/flame'] } }));
    expect(text(spellOf(off, 'character:spell/flame'))).toContain(
      'From the 2024 rules, and mixing editions is off. It may not fit.',
    );
    expect(text(spellOf(off, 'character:spell/flame'))).toContain('Level 1 · 2024');
    const on = drawn(stored({}, { [cleric]: { known: ['character:spell/flame'] } }, true));
    expect(text(spellOf(on, 'character:spell/flame'))).toContain(
      "From the 2024 rules, not this character's rules base. It may not fit.",
    );
    expect(drawn(stored({}, { [cleric]: { known: ['character:spell/mote'] } }))).not.toContain(
      'role="alert"',
    );
  });

  it('says a spell no pack holds is missing, and an owner as well', () => {
    const html = drawn(
      stored(
        {},
        {
          [cleric]: { known: ['srd-2014:spell/nothing'] },
          'srd-2014:class/nobody': { known: ['character:spell/mote'] },
        },
      ),
    );
    expect(text(html)).toContain('Missing: srd-2014:spell/nothing');
    expect(text(html)).toContain('Missing: srd-2014:class/nobody');
  });
});

describe('SHEET-46 a spell with uses of its own', () => {
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
        fixed: ['character:spell/spark'],
        key: 'giftedSpark',
        uses: { max: '1', recovery: [{ on: 'long', amount: 'all' }] },
      },
    ],
  };
  const gifted = (spent: number) =>
    drawn({
      ...goldenA,
      localEntities: [feat, spell('spark', 1, 'any')],
      state: { ...goldenA.state, resources: { giftedSpark: spent } },
      systemData: { ...goldenA.systemData, feats: [{ id: feat.id }] },
    });

  it('shows "1/LR" and "no spell slot", and the uses left', () => {
    const row = spellOf(gifted(0), 'character:spell/spark');
    expect(text(row)).toContain('Level 1 · 1/LR · no spell slot · from Gifted');
    expect(text(row)).toContain('1 of 1 uses left');
    expect(text(spellOf(gifted(1), 'character:spell/spark'))).toContain('0 of 1 uses left');
  });
});

describe('SHEET-46 a character who casts nothing', () => {
  it('says there are no spells', () => {
    expect(drawn(goldenB)).toContain('No spells yet.');
  });
});
