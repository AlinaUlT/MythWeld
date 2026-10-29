import { describe, expect, it } from 'vitest';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import {
  askOf,
  levelsLeft,
  newDraft,
  optionsOf,
  scoreOf,
  statsOf,
  subclassOptionsOf,
  typedScore,
  withPack,
  withRuleset,
} from '../src/pages/create/draft';
import { warningsAbout } from '../src/pages/create/warnings';
import { MANUAL_FORM_SYSTEMS } from '../src/systems';

// The built-in packs (SHEET-08) and golden B's inputs (SPEC §6.7). The id and time are test data.

const { packs } = installBuiltInPacks();
const [form] = MANUAL_FORM_SYSTEMS;
if (form === undefined) throw new Error('No manual form system.');
const made = { id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', at: '2026-10-29T12:00:00.000Z' };

function indexOf(draft: { system: string; packs: readonly string[] }) {
  return contentOf(draft, packs).index;
}

describe('SHEET-27 the manual form', () => {
  it('starts on the newest rules base with its pack, mixing off, nothing picked', () => {
    expect(newDraft(form, packs)).toEqual({
      system: '5e',
      ruleset: '2024',
      packs: ['srd-2024'],
      mix: false,
      name: '',
      classes: [],
      scores: {},
    });
  });

  it("takes the other rules base's pack without mixing, and keeps the packs when mixing", () => {
    const draft = newDraft(form, packs);
    expect(withRuleset(draft, '2014', packs).packs).toEqual(['srd-2014']);
    const both = withPack({ ...draft, mix: true }, 'srd-2014', true, packs);
    expect(both.packs).toEqual(['srd-2014', 'srd-2024']);
    expect(withRuleset(both, '2014', packs).packs).toEqual(['srd-2014', 'srd-2024']);
    expect(withPack(both, 'srd-2024', false, packs).packs).toEqual(['srd-2014']);
  });

  it("offers the rules base's entries, or both editions' when mixing", () => {
    const draft = { ...newDraft(form, packs), packs: ['srd-2014', 'srd-2024'] };
    const { entities } = indexOf(draft);
    const ids = (mix: boolean, type: 'species' | 'class') =>
      optionsOf(entities, type, { ...draft, mix }).map(({ id }) => id);
    expect(ids(false, 'species')).toEqual(['srd-2024:species/human']);
    expect(ids(true, 'species')).toEqual(['srd-2014:species/dwarf', 'srd-2024:species/human']);
    expect(ids(false, 'class')).toEqual([
      'srd-2024:class/fighter',
      'srd-2024:class/paladin',
      'srd-2024:class/wizard',
    ]);
    expect(
      subclassOptionsOf(entities, 'srd-2024:class/fighter', draft).map(({ id }) => id),
    ).toEqual(['srd-2024:subclass/champion']);
    expect(subclassOptionsOf(entities, 'srd-2024:class/wizard', draft)).toEqual([]);
  });

  it('asks a score for each stat the packs hold, in order, and none with no pack', () => {
    const draft = newDraft(form, packs);
    expect(statsOf(indexOf(draft), draft).map(({ key }) => key)).toEqual([
      'str',
      'dex',
      'con',
      'int',
      'wis',
      'cha',
    ]);
    expect(statsOf(indexOf({ ...draft, packs: [] }), draft)).toEqual([]);
  });

  it('reads a whole number, and counts 10 while a field holds none', () => {
    expect([typedScore('15'), typedScore(' -2 '), typedScore('−3')]).toEqual([15, -2, -3]);
    expect([typedScore(''), typedScore('1.5'), typedScore('abc')]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(scoreOf({ scores: { str: 'x' } }, 'str')).toBe(10);
    expect(scoreOf({ scores: {} }, 'dex')).toBe(10);
  });

  it('adds the levels up to 20', () => {
    expect(levelsLeft([], 20)).toBe(20);
    expect(
      levelsLeft(
        [
          { id: 'p:class/a', level: 3 },
          { id: 'p:class/b', level: 17 },
        ],
        20,
      ),
    ).toBe(0);
  });

  it("makes golden B's inputs into HP 12, AC 11, initiative +1, named, at full hit points", () => {
    const draft = {
      ...newDraft(form, packs),
      name: ' Iren ',
      species: 'srd-2024:species/human',
      background: 'srd-2024:background/soldier',
      classes: [{ id: 'srd-2024:class/fighter', level: 1 }],
      scores: { str: '15', dex: '13', con: '14', int: '8', wis: '12', cha: '10' },
    } as const;
    const stats = statsOf(indexOf(draft), draft).map(({ key }) => key);
    const ask = askOf(draft, stats, { ...made, unnamed: 'Unnamed character' });
    expect(ask.name).toBe('Iren');
    expect(ask.scores).toEqual({ str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 });
    const { character, computed } = form.make(ask, indexOf(draft));
    expect([
      computed.values['hp.max'],
      computed.values['ac.total'],
      computed.values['init.total'],
    ]).toEqual([12, 11, 1]);
    expect(character.systemData.state.hp.current).toBe(12);
    expect(computed.warnings).toEqual([]);
  });

  it('names an empty name, so nothing blocks Create', () => {
    const draft = newDraft(form, packs);
    expect(askOf(draft, [], { ...made, unnamed: 'Unnamed character' }).name).toBe(
      'Unnamed character',
    );
  });

  it('shows each warning under the pick it is about, worded by its key', () => {
    const draft = {
      ...newDraft(form, packs),
      packs: ['srd-2024', 'srd-2014'],
      mix: true,
      species: 'srd-2014:species/dwarf',
      classes: [
        { id: 'srd-2024:class/fighter', level: 1 },
        { id: 'srd-2014:class/wizard', level: 1 },
      ],
    } as const;
    const stats = statsOf(indexOf(draft), draft).map(({ key }) => key);
    const { computed } = form.make(askOf(draft, stats, { ...made, unnamed: 'x' }), indexOf(draft));
    expect(warningsAbout(computed, 'srd-2014:species/dwarf')).toEqual([
      { key: 'otherRuleset', values: { ruleset: '2014' } },
    ]);
    expect(warningsAbout(computed, 'srd-2024:class/fighter')).toEqual([
      { key: 'prerequisiteNamed', values: { label: 'Strength 13 or Dexterity 13' } },
    ]);
    expect(warningsAbout(computed, 'srd-2014:class/wizard')).toEqual([
      { key: 'otherRuleset', values: { ruleset: '2014' } },
      { key: 'prerequisiteScore', values: { stat: 'Intelligence', min: 13 } },
    ]);
  });

  it('says a pick no ticked pack holds is missing, and that mixing is off', () => {
    const draft = { ...newDraft(form, packs), species: 'srd-2014:species/dwarf' } as const;
    const ask = askOf(draft, [], { ...made, unnamed: 'x' });
    const { computed } = form.make(ask, indexOf(draft));
    expect(warningsAbout(computed, 'srd-2014:species/dwarf')).toEqual([
      { key: 'missing', values: { id: 'srd-2014:species/dwarf' } },
    ]);
    const both = { ...draft, packs: ['srd-2024', 'srd-2014'] };
    const result = form.make(askOf(both, [], { ...made, unnamed: 'x' }), indexOf(both));
    expect(warningsAbout(result.computed, 'srd-2014:species/dwarf')).toEqual([
      { key: 'otherRulesetNotMixing', values: { ruleset: '2014' } },
    ]);
  });
});
