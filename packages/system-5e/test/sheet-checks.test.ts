import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type fifthEditionCharacterSchema,
  fifthEditionChecks,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
  proficiencyMark,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenE, hbLocal, srd2014, srd2024 } from './golden/index.ts';

// SHEET-32: the Main tab's stats, saves, skills and passive values. The values are the golden
// tests' (SPEC §6.7), computed by hand there: B a human fighter 1 (modifiers +3 +1 +2 −1 +1 +0,
// saves STR +5 and CON +4, Athletics +5), A a hill dwarf cleric 1 (WIS save +5), E golden B with
// the homebrew stat SAN 14 and its skill Composure.

const packs = [srd2014, srd2024, hbLocal].map((file) => opened(openFifthEditionPack(file)));

function checksOf(golden: z.input<typeof fifthEditionCharacterSchema>) {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = loadContentIndex(
    FIFTH_EDITION_SYSTEM,
    packs.filter(({ id }) => character.packs.includes(id)),
  );
  const computed = compute(character, index, fifthEditionModule);
  return { computed, checks: fifthEditionChecks(computed) };
}

const at = (values: Readonly<Record<string, unknown>>, paths: readonly string[]) =>
  paths.map((path) => values[path]);

describe('SHEET-32 the Main tab names stats, saves and skills', () => {
  it("golden B's six stats, by order, with their checks, scores and saves", () => {
    const { computed, checks } = checksOf(goldenB);
    expect(checks.stats.map(({ key }) => key)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    expect(checks.stats.map(({ abbr }) => abbr.en)).toEqual([
      'STR',
      'DEX',
      'CON',
      'INT',
      'WIS',
      'CHA',
    ]);
    expect(
      at(
        computed.values,
        checks.stats.map(({ check }) => check),
      ),
    ).toEqual([3, 1, 2, -1, 1, 0]);
    expect(
      at(
        computed.values,
        checks.stats.map(({ score }) => score),
      ),
    ).toEqual([17, 13, 15, 8, 12, 10]);
    const saves = checks.stats.map(({ save }) => save);
    expect(
      at(
        computed.values,
        saves.map((save) => save?.total ?? ''),
      ),
    ).toEqual([5, 1, 4, -1, 1, 0]);
    expect(
      at(
        computed.values,
        saves.map((save) => save?.prof ?? ''),
      ),
    ).toEqual([1, 0, 1, 0, 0, 0]);
  });

  it("golden A's Wisdom save is +5 with proficiency", () => {
    const { computed, checks } = checksOf(goldenA);
    const wis = checks.stats.find(({ key }) => key === 'wis');
    expect(wis?.save && at(computed.values, [wis.save.total, wis.save.prof])).toEqual([5, 1]);
  });

  it("golden B's skills: Athletics +5, Perception +3, Intimidation +2, Acrobatics +1", () => {
    const { computed, checks } = checksOf(goldenB);
    expect(checks.skills).toHaveLength(18);
    const skill = (key: string) => checks.skills.find((each) => each.key === key);
    const read = (key: string) => {
      const found = skill(key);
      return found && at(computed.values, [found.total, found.prof]);
    };
    expect(read('athletics')).toEqual([5, 1]);
    expect(read('perception')).toEqual([3, 1]);
    expect(read('intimidation')).toEqual([2, 1]);
    expect(read('acrobatics')).toEqual([1, 0]);
    expect(skill('athletics')?.ability).toBe('str');
    expect(skill('athletics')?.name.en).toBe('Athletics');
  });

  it('only Perception shows a passive value: 13 on golden B', () => {
    const { computed, checks } = checksOf(goldenB);
    const passive = checks.skills.flatMap(({ key, passive: path }) => (path ? [[key, path]] : []));
    expect(passive).toEqual([['perception', 'skills.perception.passive']]);
    expect(computed.values['skills.perception.passive']).toBe(13);
  });

  it('a stat of its own acts as the six: SAN 14 after them, with a save, and Composure on it', () => {
    const { computed, checks } = checksOf(goldenE);
    expect(checks.stats.map(({ key }) => key)).toEqual([
      'str',
      'dex',
      'con',
      'int',
      'wis',
      'cha',
      'san',
    ]);
    const san = checks.stats.at(-1);
    expect(san?.name.en).toBe('Sanity');
    expect(san && at(computed.values, [san.check, san.score])).toEqual([2, 14]);
    expect(san?.save && at(computed.values, [san.save.total, san.save.prof])).toEqual([2, 0]);
    const composure = checks.skills.find(({ key }) => key === 'composure');
    expect(composure?.ability).toBe('san');
    expect(composure && at(computed.values, [composure.total, composure.prof])).toEqual([2, 0]);
  });

  it("a skill's stat is the key path's, not the skill's own field", () => {
    const { computed } = checksOf(goldenB);
    const moved = {
      ...computed,
      keys: { ...computed.keys, 'skills.athletics.ability': { key: 'dex', steps: [] } },
    };
    const found = fifthEditionChecks(moved).skills.find(({ key }) => key === 'athletics');
    expect(found?.ability).toBe('dex');
  });

  it('a stat with no save has none in the list', () => {
    const { computed } = checksOf(goldenB);
    const { 'abilities.int.save': _, ...rest } = computed.values;
    const checks = fifthEditionChecks({ ...computed, values: rest });
    expect(checks.stats.map(({ key, save }) => [key, save !== undefined])).toEqual([
      ['str', true],
      ['dex', true],
      ['con', true],
      ['int', false],
      ['wis', true],
      ['cha', true],
    ]);
  });

  it('a proficiency level is marked none, half, proficient or expertise', () => {
    expect([undefined, 0, 0.5, 1, 2, 3].map(proficiencyMark)).toEqual([
      'none',
      'none',
      'half',
      'full',
      'expert',
      'expert',
    ]);
  });
});
