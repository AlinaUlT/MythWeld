import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionChecks,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenB, srd2024 } from './golden/index.ts';

// SHEET-32: what the Main tab names. Golden B (SPEC §6.7) is a human fighter 1 with the 2024 pack:
// its modifiers, saves and skills are SPEC §6.7's, computed by hand there.

const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

function shownFor(overrides: readonly { path: string; value: string }[] = []) {
  const character = opened(openFifthEditionCharacter({ ...goldenB, overrides }));
  const computed = compute(character, index, fifthEditionModule);
  return { computed, shown: fifthEditionChecks(computed) };
}

const names = (skills: readonly { name: { en?: string } }[]) => skills.map(({ name }) => name.en);

describe('SHEET-32 the Main tab names', () => {
  const { computed, shown } = shownFor();

  it('each stat in its order, with its check, score and save paths', () => {
    expect(shown.stats.map(({ key }) => key)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    expect(shown.stats[0]).toEqual({
      key: 'str',
      name: { en: 'Strength' },
      abbr: { en: 'STR' },
      check: 'checks.str.total',
      score: 'abilities.str.score',
      save: { total: 'abilities.str.save', prof: 'abilities.str.saveProf' },
    });
    // Golden B: the saves are Strength +5 and Constitution +4 (SPEC §6.7).
    expect(computed.values['abilities.str.save']).toBe(5);
    expect(computed.values['abilities.con.save']).toBe(4);
    expect(computed.values['abilities.str.saveProf']).toBe(1);
    expect(computed.values['abilities.dex.saveProf']).toBe(0);
  });

  it("groups the skills under their stat, each group by name, with Perception's passive", () => {
    expect(shown.groups.map(({ stat }) => stat)).toEqual(['str', 'dex', 'int', 'wis', 'cha']);
    expect(names(shown.groups[1]?.skills ?? [])).toEqual([
      'Acrobatics',
      'Sleight of Hand',
      'Stealth',
    ]);
    expect(names(shown.groups[3]?.skills ?? [])).toEqual([
      'Animal Handling',
      'Insight',
      'Medicine',
      'Perception',
      'Survival',
    ]);
    expect(shown.groups[3]?.name).toEqual({ en: 'Wisdom' });
    expect(shown.passives.map(({ passive }) => passive)).toEqual(['skills.perception.passive']);
    // Golden B: Athletics +5, Perception +3, passive Perception 13 (SPEC §6.7).
    expect(computed.values['skills.athletics.total']).toBe(5);
    expect(computed.values['skills.perception.passive']).toBe(13);
    expect(computed.values['skills.athletics.prof']).toBe(1);
  });

  it("moves a skill to the stat its key path names, not the skill's own", () => {
    const moved = shownFor([{ path: 'skills.athletics.ability', value: 'cha' }]).shown;
    expect(moved.groups.map(({ stat }) => stat)).toEqual(['dex', 'int', 'wis', 'cha']);
    expect(names(moved.groups[3]?.skills ?? [])).toEqual([
      'Athletics',
      'Deception',
      'Intimidation',
      'Performance',
      'Persuasion',
    ]);
  });

  it('names no stat or skill when the packs hold none', () => {
    const empty = fifthEditionChecks({ ...computed, byKey: {}, values: {}, keys: {} });
    expect(empty).toEqual({ stats: [], groups: [], passives: [] });
  });
});
