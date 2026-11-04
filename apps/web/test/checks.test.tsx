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
import { Abilities } from '../src/sheet/sections/Abilities';
import { SavingThrows } from '../src/sheet/sections/SavingThrows';
import { Skills } from '../src/sheet/sections/Skills';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-32: the Main tab's three sections on the built-in packs. Golden B (a human fighter 1,
// Soldier) and golden A (a hill dwarf cleric 1, Acolyte) of SPEC §6.7: every expected number is
// SPEC §6.7's, computed by hand there (modifiers, saves, skills, passive Perception).

// The words are the English ones the app loads.
void i18n;

const a: AppCharacter = fifthEditionCharacterSchema.parse(goldenA);
const b: AppCharacter = fifthEditionCharacterSchema.parse(goldenB);

function drawn(character: AppCharacter, drop?: string): string {
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const packs = installBuiltInPacks().packs;
  const content = contentOf(
    character,
    drop === undefined ? packs : packs.filter((each) => each.pack.id !== drop),
  );
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
        <Abilities />
        <SavingThrows />
        <Skills />
      </SheetContext>
    </MemoryRouter>,
  );
}

/** The text of the number button at `path`, tags removed. */
function at(html: string, path: string): string | undefined {
  const found = new RegExp(`<button[^>]*data-path="${path}"[^>]*>(.*?)</button>`).exec(html);
  return found?.[1]?.replace(/<[^>]+>/g, '');
}

describe('SHEET-32 the Main tab of golden B', () => {
  const html = drawn(b);

  it('shows each ability tile: its abbreviation, check bonus and score', () => {
    expect(at(html, 'checks.str.total')).toBe('STR+3');
    expect(at(html, 'checks.dex.total')).toBe('DEX+1');
    expect(at(html, 'checks.con.total')).toBe('CON+2');
    expect(at(html, 'checks.int.total')).toBe('INT−1');
    expect(at(html, 'checks.wis.total')).toBe('WIS+1');
    expect(at(html, 'checks.cha.total')).toBe('CHA+0');
    expect(at(html, 'abilities.str.score')).toBe('Strength score17');
    expect(at(html, 'abilities.int.score')).toBe('Intelligence score8');
  });

  it('shows each save with its proficiency dot: Strength +5 and Constitution +4', () => {
    expect(at(html, 'abilities.str.save')).toBe('STR+5');
    expect(at(html, 'abilities.con.save')).toBe('CON+4');
    expect(at(html, 'abilities.dex.save')).toBe('DEX+1');
    expect(at(html, 'abilities.int.save')).toBe('INT−1');
  });

  it('shows the skills under their stat with the SPEC §6.7 totals, and passive Perception 13', () => {
    expect(at(html, 'skills.athletics.total')).toBe('Athletics+5');
    expect(at(html, 'skills.intimidation.total')).toBe('Intimidation+2');
    expect(at(html, 'skills.perception.total')).toBe('Perception+3');
    expect(at(html, 'skills.survival.total')).toBe('Survival+3');
    expect(at(html, 'skills.insight.total')).toBe('Insight+3');
    expect(at(html, 'skills.acrobatics.total')).toBe('Acrobatics+1');
    expect(at(html, 'skills.perception.passive')).toBe('Passive Perception13');
    const headings = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((found) => found[1]);
    expect(headings).toEqual(['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Charisma']);
  });

  it('marks a proficient skill and a save, and not the rest', () => {
    expect(html).toContain('aria-label="Proficient"');
    expect(html).toContain('aria-label="Not proficient"');
    expect(html.match(/data-prof="proficient"/g)).toHaveLength(2 + 5);
    expect(html).not.toContain('data-prof="expertise"');
  });

  it('gives every number a button a press can open (a roll or a breakdown)', () => {
    const paths = [...html.matchAll(/data-path="([^"]+)"/g)].map((found) => found[1]);
    // 6 checks + 6 scores + 6 saves + 18 skills + 1 passive.
    expect(paths).toHaveLength(37);
    expect(new Set(paths).size).toBe(37);
  });
});

describe('SHEET-32 the Main tab of golden A', () => {
  it('shows the 2014 pack’s numbers: Insight +5 and passive Perception 13', () => {
    const html = drawn(a);
    expect(at(html, 'skills.insight.total')).toBe('Insight+5');
    expect(at(html, 'skills.perception.passive')).toBe('Passive Perception13');
  });
});

describe('SHEET-32 the Main tab without its pack', () => {
  it('draws nothing, and does not throw, when the pack is not on the device', () => {
    expect(drawn(b, 'srd-2024')).toBe('');
  });
});
