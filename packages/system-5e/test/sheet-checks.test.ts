import {
  clearOverride,
  compute,
  type LogStamp,
  loadContentIndex,
  setKeyOverride,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionChecks,
  fifthEditionKeyOf,
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

describe('SHEET-79 a skill’s stat set by hand', () => {
  const stamp: LogStamp = {
    id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    at: '2026-11-04T12:00:00.000Z',
    by: { role: 'player', name: 'Wren' },
  };
  const character = opened(openFifthEditionCharacter(goldenB));
  const before = compute(character, index, fifthEditionModule);

  it('names the key path behind a skill’s total and passive value, and no other number', () => {
    expect(fifthEditionKeyOf(before, 'skills.athletics.total')).toBe('skills.athletics.ability');
    expect(fifthEditionKeyOf(before, 'skills.perception.passive')).toBe(
      'skills.perception.ability',
    );
    for (const path of [
      'skills.athletics.prof',
      'ac.total',
      'abilities.str.mod',
      'skills.none.total',
      'skills.athletics',
      'constructor.total',
      'skills.athletics.total.x',
    ]) {
      expect(fifthEditionKeyOf(before, path), path).toBeUndefined();
    }
  });

  it('moves Athletics to Dexterity: golden B has Dexterity +1 and proficiency +2, so +3 (it is +5 on Strength)', () => {
    const keys = fifthEditionChecks(before).stats.map(({ key }) => key);
    expect(before.values['skills.athletics.total']).toBe(5);
    const made = setKeyOverride(
      character,
      before,
      { path: 'skills.athletics.ability', key: 'dex', keys, note: 'Agile' },
      stamp,
    );
    if (!made.ok) throw new Error(made.message);
    const after = compute(made.character, index, fifthEditionModule);
    expect(after.keys['skills.athletics.ability']?.key).toBe('dex');
    expect(after.values['skills.athletics.total']).toBe(3);
    expect(
      fifthEditionChecks(after)
        .groups.find(({ stat }) => stat === 'dex')
        ?.skills.map(({ key }) => key),
    ).toContain('athletics');
    const cleared = clearOverride(made.character, 'skills.athletics.ability', stamp);
    if (!cleared.ok) throw new Error(cleared.message);
    expect(
      compute(cleared.character, index, fifthEditionModule).values['skills.athletics.total'],
    ).toBe(5);
  });
});
