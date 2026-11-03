import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { FeatureList } from '../src/sheet/sections/FeatureList';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-48: the Features tab of golden B (a human fighter 1, Soldier: Second Wind has 2 uses, 1 back
// on a short rest, all on a long rest, SRD 5.2.1) and golden A (a hill dwarf Life cleric 1, 2014).
// The names are the packs'. The feat below is made up.

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
        <FeatureList />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const rowOf = (html: string, id: string) =>
  html.split(`data-feature="${id}"`)[1]?.split('</li>')[0] ?? '';

describe('SHEET-48 golden B’s features', () => {
  const html = drawn(goldenB);

  it('groups them under Human, Fighter and Soldier, each with its source line', () => {
    const headings = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((found) => found[1]);
    expect(headings).toEqual(['Human', 'Fighter', 'Soldier']);
    expect(text(html)).toContain('|species|');
    expect(text(html)).toContain('|class · level 1|');
    expect(text(html)).toContain('|background|');
  });

  it('says the fighter’s subclass is chosen at level 3, and lists the level 1 features', () => {
    expect(html).toContain('Subclass: chosen at level 3');
    for (const name of ['Second Wind', 'Weapon Mastery', 'Alert', 'Savage Attacker']) {
      expect(text(html)).toContain(`|${name}|`);
    }
  });

  it('shows Second Wind’s two uses, what comes back and when, and a Use button', () => {
    const row = rowOf(html, 'srd-2024:feature/fighter-second-wind');
    expect(row.match(/data-left="true"/g)).toHaveLength(2);
    expect(text(row)).toContain('|2 of 2 left|');
    expect(text(row)).toContain('back on a short rest');
    expect(text(row)).toContain('all on a long rest');
    expect(row).toContain('aria-label="Use secondWind"');
    expect(row).toContain('data-path="resources.secondWind.recovery.short"');
  });

  it('shows a use spent as an empty circle, and none left as a disabled button', () => {
    const spend = (spent: number) =>
      drawn({
        ...goldenB,
        state: { ...goldenB.state, resources: { secondWind: spent } },
      });
    const one = rowOf(spend(1), 'srd-2024:feature/fighter-second-wind');
    expect(text(one)).toContain('|1 of 2 left|');
    expect(one.match(/data-left="true"/g)).toHaveLength(1);
    expect(one.match(/data-left="false"/g)).toHaveLength(1);
    const none = rowOf(spend(2), 'srd-2024:feature/fighter-second-wind');
    expect(text(none)).toContain('|0 of 2 left|');
    expect(none).toMatch(/<button[^>]*disabled[^>]*aria-label="Use secondWind"/);
  });
});

describe('SHEET-48 golden A’s features', () => {
  const html = drawn(goldenA);

  it('uses the 2014 words: a race, and the Life subclass on the line below the class', () => {
    const headings = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((found) => found[1]);
    expect(headings).toEqual(['Dwarf', 'Cleric', 'Acolyte']);
    expect(text(html)).toContain('|race|');
    expect(html).toContain('Subclass: Life');
    expect(text(html)).toContain('|Disciple of Life|');
    expect(text(html)).toContain('|Dwarven Toughness|');
  });
});

describe('SHEET-48 a feat’s switch', () => {
  const feat = {
    id: 'character:feat/furious',
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Furious' },
    source: { pack: 'character' },
    effects: [
      {
        id: 'rage',
        target: 'checks.str.bonus',
        op: 'add',
        value: 1,
        toggle: { label: { en: 'Raging' }, default: false },
      },
    ],
  };
  const withFeat = (toggles: Record<string, boolean>) =>
    drawn({
      ...goldenB,
      localEntities: [feat],
      state: { ...goldenB.state, toggles },
      systemData: { ...goldenB.systemData, feats: [{ id: feat.id }] },
    });

  it('shows the character’s own feats last, with the switch in its default state', () => {
    const html = withFeat({});
    const headings = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((found) => found[1]);
    expect(headings).toEqual(['Human', 'Fighter', 'Soldier', 'Feats']);
    expect(html).toContain('role="switch"');
    expect(html).toMatch(/role="switch" aria-checked="false"/);
    expect(text(html)).toContain('|Raging|');
  });

  it('shows the stored switch over the default', () => {
    expect(withFeat({ 'character:feat/furious#rage': true })).toMatch(
      /role="switch" aria-checked="true"/,
    );
  });
});

describe('SHEET-48 a character with no features', () => {
  it('says so', () => {
    const html = drawn({
      ...goldenB,
      systemData: { ...goldenB.systemData, classes: [], species: undefined, background: undefined },
    });
    expect(html).toContain('No features yet.');
  });
});
