import { compute } from '@grimoire/engine';
import type { CheckSkill, CheckStat } from '@grimoire/system-5e';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { Abilities } from '../src/sheet/sections/Abilities';
import { SavingThrows } from '../src/sheet/sections/SavingThrows';
import { Skills } from '../src/sheet/sections/Skills';
import { groupSkills, inColumns } from '../src/sheet/skillGroups';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-32: the Main tab's abilities, saving throws, skills and passive values. The values are
// the goldens' (SPEC §6.7), computed by hand in `golden-values.test.ts`: B a human fighter 1
// (modifiers +3 +1 +2 −1 +1 +0, scores 17 13 15 8 12 10, saves STR +5 and CON +4, Athletics +5,
// Intimidation +2, Perception, Survival and Insight +3, passive Perception 13), A a hill dwarf
// cleric 1 (Wisdom save +5, Insight and Medicine +5).

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

/** The text of every element whose `data-path` is `path`, tags removed. */
function textAt(html: string, path: string): string[] {
  return [
    ...html.matchAll(
      new RegExp(`data-path="${path.replaceAll('.', '\\.')}"[^>]*>(.*?)</button>`, 'g'),
    ),
  ].map(([, inner]) =>
    (inner ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** The proficiency mark inside the button whose `data-path` is `path`. */
function markAt(html: string, path: string): string | undefined {
  const inner = new RegExp(`data-path="${path.replaceAll('.', '\\.')}"[^>]*>(.*?)</button>`).exec(
    html,
  );
  return /data-mark="(\w+)"/.exec(inner?.[1] ?? '')?.[1];
}

const marksOf = (html: string) => [...html.matchAll(/data-mark="(\w+)"/g)].map(([, mark]) => mark);

describe('SHEET-32 the Main tab shows every check bonus', () => {
  const b = sheetOf(goldenB);
  const a = sheetOf(goldenA);

  it("draws golden B's six ability tiles: check bonus large, score small", () => {
    const html = draw(b, <Abilities />);
    expect(html).toContain(`>${en.checks.abilities}</h2>`);
    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    expect(keys.map((key) => textAt(html, `checks.${key}.total`)[0])).toEqual([
      'STR +3',
      'DEX +1',
      'CON +2',
      'INT −1',
      'WIS +1',
      'CHA +0',
    ]);
    expect(keys.map((key) => textAt(html, `abilities.${key}.score`)[0])).toEqual([
      'Strength score 17',
      'Dexterity score 13',
      'Constitution score 15',
      'Intelligence score 8',
      'Wisdom score 12',
      'Charisma score 10',
    ]);
  });

  it("draws golden B's saving throws with a dot for each proficient one", () => {
    const html = draw(b, <SavingThrows />);
    expect(html).toContain(`>${en.checks.savingThrows}</h2>`);
    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    expect(keys.map((key) => textAt(html, `abilities.${key}.save`)[0])).toEqual([
      'STR +5',
      'DEX +1',
      'CON +4',
      'INT −1',
      'WIS +1',
      'CHA +0',
    ]);
    expect(marksOf(html)).toEqual(['full', 'none', 'full', 'none', 'none', 'none']);
    expect(html).toContain(`aria-label="${en.checks.proficiency.full}"`);
  });

  it("draws golden A's Wisdom save as +5 with proficiency", () => {
    expect(textAt(draw(a, <SavingThrows />), 'abilities.wis.save')).toEqual(['WIS +5']);
  });

  it("draws golden B's skills under the stat each uses, and its passive Perception", () => {
    const html = draw(b, <Skills />);
    expect(html).toContain(`>${en.checks.skills}</h2>`);
    expect(textAt(html, 'skills.athletics.total')).toEqual(['Athletics +5']);
    expect(textAt(html, 'skills.intimidation.total')).toEqual(['Intimidation +2']);
    expect(textAt(html, 'skills.perception.total')).toEqual(['Perception +3']);
    expect(textAt(html, 'skills.survival.total')).toEqual(['Survival +3']);
    expect(textAt(html, 'skills.insight.total')).toEqual(['Insight +3']);
    expect(textAt(html, 'skills.acrobatics.total')).toEqual(['Acrobatics +1']);
    expect(textAt(html, 'skills.arcana.total')).toEqual(['Arcana −1']);
    expect(markAt(html, 'skills.athletics.total')).toBe('full');
    expect(markAt(html, 'skills.arcana.total')).toBe('none');
    expect(textAt(html, 'skills.perception.passive')).toEqual(['Passive Perception 13']);
    // 18 skills, five of them proficient.
    expect(marksOf(html)).toHaveLength(18);
    expect(marksOf(html).filter((mark) => mark === 'full')).toHaveLength(5);
    // The stat headings, in the stats' order.
    const headings = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map(([, text]) => text);
    expect(headings).toEqual(['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Charisma']);
  });

  it("draws golden A's Insight and Medicine as +5", () => {
    const html = draw(a, <Skills />);
    expect(textAt(html, 'skills.insight.total')).toEqual(['Insight +5']);
    expect(textAt(html, 'skills.medicine.total')).toEqual(['Medicine +5']);
  });

  it('lists a skill under the stat the key path names now', () => {
    const moved: SheetValue = {
      ...b,
      computed: {
        ...b.computed,
        keys: { ...b.computed.keys, 'skills.athletics.ability': { key: 'dex', steps: [] } },
      },
    };
    const html = draw(moved, <Skills />);
    const dexterity = html.slice(html.indexOf('>Dexterity<'), html.indexOf('>Intelligence<'));
    expect(dexterity).toContain('data-path="skills.athletics.total"');
    expect(html).not.toContain('>Strength<');
  });

  it('draws a number with no value as "—", not a crash', () => {
    const { 'skills.arcana.total': _, ...values } = b.computed.values;
    const html = draw({ ...b, computed: { ...b.computed, values } }, <Skills />);
    expect(textAt(html, 'skills.arcana.total')).toEqual(['Arcana —']);
  });

  it('draws nothing for a sheet with no stats or skills', () => {
    const empty: SheetValue = {
      ...b,
      system: { ...b.system, checks: () => ({ stats: [], skills: [] }) },
    };
    for (const Section of [Abilities, SavingThrows, Skills]) {
      expect(draw(empty, <Section />)).toBe('');
    }
  });
});

describe('SHEET-32 the skills in two columns', () => {
  const stat = (key: string): CheckStat => ({
    key,
    name: { en: key },
    abbr: { en: key },
    check: `checks.${key}.total`,
    score: `abilities.${key}.score`,
  });
  const skill = (key: string, ability: string): CheckSkill => ({
    key,
    name: { en: key },
    ability,
    total: `skills.${key}.total`,
    prof: `skills.${key}.prof`,
  });
  const stats = ['str', 'dex', 'con'].map(stat);
  const nameOf = ({ name }: CheckSkill) => name.en ?? '';

  it('groups by stat in the stats order, each group by name', () => {
    const groups = groupSkills(
      stats,
      [skill('b', 'dex'), skill('c', 'str'), skill('a', 'dex')],
      nameOf,
    );
    expect(groups.map(({ ability, skills }) => [ability, skills.map(({ key }) => key)])).toEqual([
      ['str', ['c']],
      ['dex', ['a', 'b']],
    ]);
  });

  it('puts a skill of a stat the character lacks last, with no stat', () => {
    const groups = groupSkills(stats, [skill('x', 'san'), skill('c', 'con')], nameOf);
    expect(groups.map(({ ability, stat: own }) => [ability, own?.key])).toEqual([
      ['con', 'con'],
      ['san', undefined],
    ]);
  });

  it("splits golden B's 18 skills as the board does: 9 and 9 skills, whole groups", () => {
    const { stats: all, skills } = sheetOf(goldenB).system.checks(sheetOf(goldenB).computed);
    const columns = inColumns(groupSkills(all, skills, nameOf));
    expect(columns.map((column) => column.map(({ ability }) => ability))).toEqual([
      ['str', 'dex', 'int'],
      ['wis', 'cha'],
    ]);
    expect(
      columns.map((column) => column.reduce((sum, { skills: own }) => sum + own.length, 0)),
    ).toEqual([9, 9]);
  });

  it('gives one column when there are no groups, and keeps a lone group whole', () => {
    expect(inColumns([])).toEqual([[], []]);
    const only = groupSkills(stats, [skill('a', 'str')], nameOf);
    expect(inColumns(only)).toEqual([only, []]);
  });
});
