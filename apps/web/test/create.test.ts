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
  withItem,
  withPack,
  withRuleset,
} from '../src/pages/create/draft';
import { itemWarnings, warningsAbout } from '../src/pages/create/warnings';
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
      items: [],
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

describe('SHEET-28 the equipment step', () => {
  const U1 = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const U2 = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
  const mixed = {
    ...newDraft(form, packs),
    packs: ['srd-2024', 'srd-2014'],
    mix: true,
  };
  const chain = 'srd-2024:item/chain-mail' as const;

  it("offers the rules base's items, or both editions' when mixing", () => {
    const { entities } = indexOf(mixed);
    const ids = (mix: boolean) =>
      optionsOf(entities, 'item', { ...mixed, mix }).map(({ id }) => id);
    const own = ids(false);
    expect(own.length).toBeGreaterThan(2);
    expect(own.every((id) => id.startsWith('srd-2024:'))).toBe(true);
    expect(own).toContain('srd-2024:item/greatsword');
    const both = ids(true);
    expect(both).toEqual(expect.arrayContaining([...own, 'srd-2014:item/shield']));
    expect(both).toEqual(
      expect.arrayContaining(['srd-2014:item/chain-mail', 'srd-2014:item/warhammer']),
    );
    expect(both.length).toBe(own.length + 3);
  });

  it('adds a row of one, not worn, and one more to a row already listed', () => {
    const one = withItem(newDraft(form, packs), chain, U1);
    expect(one.items).toEqual([{ uid: U1, id: chain, qty: 1, equipped: false }]);
    const two = withItem(withItem(one, 'srd-2024:item/greatsword', U2), chain, 'not-used');
    expect(two.items).toEqual([
      { uid: U1, id: chain, qty: 2, equipped: false },
      { uid: U2, id: 'srd-2024:item/greatsword', qty: 1, equipped: false },
    ]);
  });

  it('stops a row at 999', () => {
    const full = {
      ...newDraft(form, packs),
      items: [{ uid: U1, id: chain, qty: 999, equipped: false }],
    };
    expect(withItem(full, chain, U2).items[0]?.qty).toBe(999);
  });

  it('asks the module for each row as typed', () => {
    const draft = {
      ...newDraft(form, packs),
      items: [{ uid: U1, id: chain, qty: 2, equipped: true }],
    };
    expect(askOf(draft, [], { ...made, unnamed: 'x' }).items).toEqual([
      { uid: U1, itemId: chain, qty: 2, equipped: true },
    ]);
  });

  it("changes golden B's AC from 11 to 16 when its chain mail is worn, and not when carried", () => {
    // SRD chain mail: AC 16, no Dex (the fixture pack's `baseAC: 16`, `dexCap: 0`).
    const base = {
      ...newDraft(form, packs),
      species: 'srd-2024:species/human',
      background: 'srd-2024:background/soldier',
      classes: [{ id: 'srd-2024:class/fighter', level: 1 }],
      scores: { str: '15', dex: '13', con: '14', int: '8', wis: '12', cha: '10' },
    } as const;
    const stats = statsOf(indexOf(base), base).map(({ key }) => key);
    const ac = (equipped: boolean) =>
      form.make(
        askOf({ ...base, items: [{ uid: U1, id: chain, qty: 1, equipped }] }, stats, {
          ...made,
          unnamed: 'x',
        }),
        indexOf(base),
      ).computed;
    expect(ac(true).values['ac.total']).toBe(16);
    expect(ac(false).values['ac.total']).toBe(11);
    expect(ac(true).warnings).toEqual([]);
  });

  it('warns under an item no ticked pack holds, or of the other edition, worn or not', () => {
    const { entities } = indexOf(mixed);
    expect(itemWarnings(entities, chain, mixed)).toEqual([]);
    expect(itemWarnings(entities, 'srd-2014:item/shield', mixed)).toEqual([
      { key: 'otherRuleset', values: { ruleset: '2014' } },
    ]);
    expect(itemWarnings(entities, 'srd-2014:item/shield', { ...mixed, mix: false })).toEqual([
      { key: 'otherRulesetNotMixing', values: { ruleset: '2014' } },
    ]);
    const only = indexOf(newDraft(form, packs)).entities;
    expect(itemWarnings(only, 'srd-2014:item/shield', mixed)).toEqual([
      { key: 'missing', values: { id: 'srd-2014:item/shield' } },
    ]);
  });
});
