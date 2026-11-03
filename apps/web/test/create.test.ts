import { describe, expect, it } from 'vitest';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import {
  askOf,
  type Draft,
  levelsLeft,
  newDraft,
  optionsOf,
  scoreOf,
  statsOf,
  subclassOptionsOf,
  typedScore,
  withItem,
  withItemQty,
  withoutItem,
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
  const chain = 'srd-2024:item/chain-mail';
  const old = 'srd-2014:item/shield';
  const uid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

  it('offers the rules base’s items, or both editions’ when mixing, by name', () => {
    const draft = { ...newDraft(form, packs), packs: ['srd-2014', 'srd-2024'] };
    const { entities } = indexOf(draft);
    const ids = (mix: boolean) =>
      optionsOf(entities, 'item', { ...draft, mix }).map(({ id }) => id);
    const g = (slug: string) => `srd-2024:item/${slug}`;
    // The packs' source: SRD 5.2.1's five items, SRD 5.1's three; sorted by name, then id.
    expect(ids(false)).toEqual([chain, g('glaive'), g('greataxe'), g('greatsword'), g('halberd')]);
    expect(ids(true)).toEqual([
      'srd-2014:item/chain-mail',
      chain,
      g('glaive'),
      g('greataxe'),
      g('greatsword'),
      g('halberd'),
      old,
      'srd-2014:item/warhammer',
    ]);
  });

  it('adds a row, adds to its quantity on a second pick, keeps 1 to 999, and removes it', () => {
    const none = newDraft(form, packs);
    const one = withItem(none, chain, uid(1));
    expect(one.items).toEqual([{ uid: uid(1), id: chain, qty: 1 }]);
    const two = withItem(one, chain, uid(2));
    expect(two.items).toEqual([{ uid: uid(1), id: chain, qty: 2 }]);
    expect(withItemQty(two, chain, -5).items[0]?.qty).toBe(1);
    expect(withItemQty(two, chain, 5000).items[0]?.qty).toBe(999);
    expect(withoutItem(two, chain).items).toEqual([]);
    expect(none.items).toEqual([]);
  });

  it('stores each item as an unworn, unattuned inventory row, in the order listed', () => {
    let draft: Draft = {
      ...newDraft(form, packs),
      classes: [{ id: 'srd-2024:class/fighter', level: 1 }],
      scores: { str: '15', dex: '13', con: '14', int: '8', wis: '12', cha: '10' },
    };
    draft = withItem(draft, chain, uid(1));
    draft = withItem(draft, 'srd-2024:item/greatsword', uid(2));
    draft = withItemQty(draft, 'srd-2024:item/greatsword', 1);
    const keys = statsOf(indexOf(draft), draft).map(({ key }) => key);
    const ask = askOf(draft, keys, { ...made, unnamed: 'x' });
    const { character, computed } = form.make(ask, indexOf(draft));
    expect(character.systemData.inventory).toEqual([
      { uid: uid(1), itemId: chain, qty: 1, equipped: false, attuned: false },
      { uid: uid(2), itemId: 'srd-2024:item/greatsword', qty: 2, equipped: false, attuned: false },
    ]);
    expect(computed.warnings).toEqual([]);
  });

  it('says an item of the other edition is, with mixing on or off, and one no pack holds is missing', () => {
    const both = { ...newDraft(form, packs), packs: ['srd-2024', 'srd-2014'] };
    const { entities } = indexOf(both);
    expect(itemWarnings(entities, both, chain)).toEqual([]);
    expect(itemWarnings(entities, both, old)).toEqual([
      { key: 'otherRulesetNotMixing', values: { ruleset: '2014' } },
    ]);
    expect(itemWarnings(entities, { ...both, mix: true }, old)).toEqual([
      { key: 'otherRuleset', values: { ruleset: '2014' } },
    ]);
    const only = indexOf(newDraft(form, packs)).entities;
    expect(itemWarnings(only, both, old)).toEqual([{ key: 'missing', values: { id: old } }]);
  });
});
