import { describe, expect, it } from 'vitest';
import {
  type CastAsk,
  castSpell,
  endConcentration,
  type FifthEditionCharacter,
  regainSlot,
  type SlotAsk,
  spendSlot,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  copyOf,
  done,
  frozen,
  hexer,
  indexOf,
  ownSpell,
  PACT,
  refused,
  slot,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB, goldenC2014, goldenC2024 } from './golden/index.ts';

// ENG-20: slots and concentration. Golden A (2014): cleric 1, two level 1 slots, Bless
// (concentration) and Cure Wounds. Golden C: wizard 3 and paladin 3, slots 4, 3 in 2014 and 4, 3,
// 2 in 2024 (ENG-15). Golden B as the made-up hexer 3: two pact slots of level 2. The spells
// `character:` are made up. Every value was worked out by hand in ENG-20 §3.

const BLESS = 'srd-2014:spell/bless';
const CURE = 'srd-2014:spell/cure-wounds';
const SPARK = ownSpell('spark', 1, false);
const GLIMMER = ownSpell('glimmer', 1, true);
const SURGE = ownSpell('surge', 2, false);
const BLAST = ownSpell('blast', 3, false);
const FLICKER = ownSpell('flicker', 0, false);
const OWN = [SPARK, GLIMMER, SURGE, BLAST, FLICKER];

/** A golden character with the made-up spells, and its trackers set. */
const caster = (golden: CharacterInput, trackers: Parameters<typeof withTrackers>[1] = {}) =>
  withTrackers(golden, trackers, { localEntities: OWN });

/** Golden B as hexer 3, with the made-up spells. */
const pactCaster = (pactSlotsSpent = 0) =>
  withTrackers(
    goldenB,
    { pactSlotsSpent },
    {
      localEntities: [hexer, ...OWN],
      systemData: {
        ...goldenB.systemData,
        classes: [{ id: 'character:class/hexer', level: 3, hp: ['max', 1, 1] }],
      },
    },
  );

/** A cast on `character`, from its edition's pack. */
const cast = (character: FifthEditionCharacter, spell: string, slotAsk?: SlotAsk) => {
  const ask: CastAsk = { spell, ...(slotAsk !== undefined && { slot: slotAsk }) };
  return castSpell(character, indexOf(character), ask, stamp);
};

/** A slot spent with no spell on `character`. */
const spend = (character: FifthEditionCharacter, slotAsk: SlotAsk) =>
  spendSlot(character, indexOf(character), { slot: slotAsk }, stamp);

describe('ENG-20 slots and concentration', () => {
  it('spends the slot a cast uses, and holds a concentration spell', () => {
    const a = caster(goldenA);
    const bless = done(a, cast(a, BLESS, { level: 1 }));
    expect(bless.entry).toMatchObject({
      action: 'castSpell',
      subject: BLESS,
      label: { en: 'Bless' },
    });
    expect(bless.entry.changes).toEqual([
      { path: slot(1), after: 1 },
      { path: CONCENTRATION, after: BLESS },
    ]);
    const cure = done(bless.character, cast(bless.character, CURE, { level: 1 }));
    expect(cure.entry.changes).toEqual([{ path: slot(1), before: 1, after: 2 }]);
    expect(cure.character.systemData.state.concentration).toBe(BLESS);
    expect(refused(cast(cure.character, CURE, { level: 1 }))).toEqual({
      code: 'noSlotLeft',
      slot: { level: 1 },
      max: 2,
      spent: 2,
    });
  });

  it('casts with a higher slot the character has', () => {
    const c2014 = caster(goldenC2014);
    expect(done(c2014, cast(c2014, SPARK.id, { level: 2 })).entry.changes).toEqual([
      { path: slot(2), after: 1 },
    ]);
    expect(refused(cast(c2014, SPARK.id, { level: 3 }))).toEqual({
      code: 'noSlotLeft',
      slot: { level: 3 },
      max: 0,
      spent: 0,
    });
    const c2024 = caster(goldenC2024);
    expect(done(c2024, cast(c2024, SPARK.id, { level: 3 })).entry.changes).toEqual([
      { path: slot(3), after: 1 },
    ]);
  });

  it("refuses a slot below the spell's level, and a level outside 1 to 9", () => {
    const a = caster(goldenA);
    expect(refused(cast(a, SURGE.id, { level: 1 }))).toEqual({
      code: 'slotTooLow',
      slot: { level: 1 },
      slotLevel: 1,
      spellLevel: 2,
    });
    for (const level of [0, 10, 1.5]) {
      expect(refused(cast(a, SPARK.id, { level }))).toEqual({ code: 'badLevel', level });
    }
  });

  it('spends pact slots, which hold spells up to their level', () => {
    const b = pactCaster();
    const first = done(b, cast(b, SPARK.id, 'pact'));
    expect(first.entry.changes).toEqual([{ path: PACT, before: 0, after: 1 }]);
    const second = done(first.character, cast(first.character, SPARK.id, 'pact'));
    expect(second.entry.changes).toEqual([{ path: PACT, before: 1, after: 2 }]);
    expect(refused(cast(second.character, SPARK.id, 'pact'))).toEqual({
      code: 'noSlotLeft',
      slot: 'pact',
      max: 2,
      spent: 2,
    });
    expect(refused(cast(b, BLAST.id, 'pact'))).toEqual({
      code: 'slotTooLow',
      slot: 'pact',
      slotLevel: 2,
      spellLevel: 3,
    });
    expect(refused(cast(caster(goldenA), SPARK.id, 'pact'))).toEqual({
      code: 'noSlotLeft',
      slot: 'pact',
      max: 0,
      spent: 0,
    });
  });

  it('casts with no slot: only concentration changes, and a cast that changes nothing is refused', () => {
    const a = caster(goldenA);
    const bless = done(a, cast(a, BLESS));
    expect(bless.entry.changes).toEqual([{ path: CONCENTRATION, after: BLESS }]);
    expect(refused(cast(bless.character, BLESS))).toEqual({ code: 'unchanged' });
    expect(refused(cast(a, CURE))).toEqual({ code: 'unchanged' });
    expect(refused(cast(a, FLICKER.id))).toEqual({ code: 'unchanged' });
  });

  it('ends the concentration held when a new concentration spell is cast', () => {
    const a = caster(goldenA, { concentration: BLESS });
    expect(done(a, cast(a, GLIMMER.id)).entry.changes).toEqual([
      { path: CONCENTRATION, before: BLESS, after: GLIMMER.id },
    ]);
  });

  it('refuses a cantrip with a slot, a spell no pack has, and an entity that is not a spell', () => {
    const a = caster(goldenA);
    expect(refused(cast(a, FLICKER.id, { level: 1 }))).toEqual({
      code: 'cantripSlot',
      id: FLICKER.id,
    });
    expect(refused(cast(a, 'srd-2014:spell/nothing'))).toEqual({
      code: 'missing',
      id: 'srd-2014:spell/nothing',
    });
    expect(refused(cast(a, 'srd-2014:class/cleric', { level: 1 }))).toEqual({
      code: 'notASpell',
      id: 'srd-2014:class/cleric',
      type: 'class',
    });
  });

  it('spends a slot with no spell', () => {
    const a = caster(goldenA);
    const once = done(a, spend(a, { level: 1 }));
    expect(once.entry).toMatchObject({ action: 'spendSlot', subject: '1' });
    expect(once.entry.changes).toEqual([{ path: slot(1), after: 1 }]);
    const twice = done(once.character, spend(once.character, { level: 1 }));
    expect(refused(spend(twice.character, { level: 1 }))).toEqual({
      code: 'noSlotLeft',
      slot: { level: 1 },
      max: 2,
      spent: 2,
    });
    const b = pactCaster();
    const pact = done(b, spend(b, 'pact'));
    expect(pact.entry).toMatchObject({ action: 'spendSlot', subject: 'pact' });
    expect(pact.entry.changes).toEqual([{ path: PACT, before: 0, after: 1 }]);
  });

  it('gives spent slots back, never below none', () => {
    const a = caster(goldenA, { slotsSpent: { 1: 2 } });
    const regain = (amount: number | 'all') => regainSlot(a, { slot: { level: 1 }, amount }, stamp);
    const one = done(a, regain(1));
    expect(one.entry).toMatchObject({ action: 'regainSlot', subject: '1' });
    expect(one.entry.changes).toEqual([{ path: slot(1), before: 2, after: 1 }]);
    expect(done(a, regain('all')).entry.changes).toEqual([{ path: slot(1), before: 2, after: 0 }]);
    expect(done(a, regain(5)).entry.changes).toEqual([{ path: slot(1), before: 2, after: 0 }]);
    expect(refused(regain(0))).toEqual({ code: 'badCount', count: 0 });
    const none = caster(goldenA);
    expect(refused(regainSlot(none, { slot: { level: 1 }, amount: 1 }, stamp))).toEqual({
      code: 'unchanged',
    });
    expect(refused(regainSlot(none, { slot: { level: 10 }, amount: 1 }, stamp))).toEqual({
      code: 'badLevel',
      level: 10,
    });
    const b = pactCaster(2);
    expect(done(b, regainSlot(b, { slot: 'pact', amount: 'all' }, stamp)).entry.changes).toEqual([
      { path: PACT, before: 2, after: 0 },
    ]);
  });

  it('ends concentration, whether or not a pack still has the spell', () => {
    const a = caster(goldenA, { concentration: BLESS });
    const ended = done(a, endConcentration(a, indexOf(a), stamp));
    expect(ended.entry).toMatchObject({
      action: 'endConcentration',
      subject: BLESS,
      label: { en: 'Bless' },
    });
    expect(ended.entry.changes).toEqual([{ path: CONCENTRATION, before: BLESS }]);
    const none = caster(goldenA);
    expect(refused(endConcentration(none, indexOf(none), stamp))).toEqual({ code: 'unchanged' });
    const gone = caster(goldenA, { concentration: 'srd-2014:spell/nothing' });
    const result = done(gone, endConcentration(gone, indexOf(gone), stamp));
    expect(result.entry.label).toBeUndefined();
    expect(result.entry.changes).toEqual([
      { path: CONCENTRATION, before: 'srd-2014:spell/nothing' },
    ]);
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = caster(goldenA, { slotsSpent: { 1: 1 }, concentration: BLESS });
    const copy = copyOf(character);
    const ice = frozen(character);
    const index = indexOf(character);
    const frozenStamp = frozen(stamp);
    const level1 = frozen({ level: 1 });
    expect(castSpell(ice, index, frozen({ spell: GLIMMER.id, slot: level1 }), frozenStamp).ok).toBe(
      true,
    );
    expect(spendSlot(ice, index, frozen({ slot: level1 }), frozenStamp).ok).toBe(true);
    expect(regainSlot(ice, frozen({ slot: level1, amount: 'all' as const }), frozenStamp).ok).toBe(
      true,
    );
    expect(endConcentration(ice, index, frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
  });
});
