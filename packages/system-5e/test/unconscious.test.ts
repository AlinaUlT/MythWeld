import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  applyDamage,
  applyHealing,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionEntitySchema,
  fifthEditionModule,
  isDown,
  openFifthEditionPack,
  revive,
  rollDeathSave,
  shortRest,
  stabilize,
  UNCONSCIOUS_CONDITION,
} from '../src/index.ts';
import { type CharacterInput, done, indexOf, stamp, withTrackers } from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2014, srd2024 } from './golden/index.ts';

// ENG-62: the Unconscious condition at 0 hit points. Golden A (2014) walks 25 feet and golden B
// (2024) 30; both have a hit point maximum of 12 (SPEC §6.7). The Unconscious entries are written
// here, a name and a number only: each sets `speed.all.mul` to 0 (SRD 5.1 "can't move", SRD 5.2.1
// "Your Speed is 0", ENG-62 §8). Every expected value was worked out by hand in ENG-62 §3.

type EntityInput = z.input<typeof fifthEditionEntitySchema>;
type Edition = '2014' | '2024';

const UNCONSCIOUS_2014 = 'srd-2014:condition/unconscious';
const UNCONSCIOUS_2024 = 'srd-2024:condition/unconscious';

/** An edition's Unconscious condition: its key, and its speed set to 0. */
function unconscious(ruleset: Edition): Extract<EntityInput, { type: 'condition' }> {
  return {
    id: ruleset === '2014' ? UNCONSCIOUS_2014 : UNCONSCIOUS_2024,
    type: 'condition',
    key: UNCONSCIOUS_CONDITION,
    ruleset,
    name: { en: 'Unconscious' },
    source: { pack: `srd-${ruleset}` },
    effects: [{ id: 'speed-0', target: 'speed.all.mul', op: 'set', value: 0 }],
  };
}

const with2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(
    openFifthEditionPack({ ...srd2014, entities: [...srd2014.entities, unconscious('2014')] }),
  ),
]).index;
const with2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(
    openFifthEditionPack({ ...srd2024, entities: [...srd2024.entities, unconscious('2024')] }),
  ),
]).index;

/** The pack of the character's edition, with its Unconscious entry. */
const withEntry = (character: FifthEditionCharacter) =>
  character.ruleset === '2014' ? with2014 : with2024;

/** Each golden, its walking speed, and its Unconscious entry's id. */
const GOLDENS = [
  { golden: goldenA, walk: 25, id: UNCONSCIOUS_2014 },
  { golden: goldenB, walk: 30, id: UNCONSCIOUS_2024 },
] as const;

/** The character computed from its edition's pack with the Unconscious entry. */
const computed = (character: FifthEditionCharacter) =>
  compute(character, withEntry(character), fifthEditionModule);

/** The Unconscious condition's level, as a formula reads it. */
const level = (result: Computed<FifthEditionEntity>) =>
  result.values[`conditions.${UNCONSCIOUS_CONDITION}.level`];

/** How many times the character has the entity `id`. */
const had = (result: Computed<FifthEditionEntity>, id: string) =>
  result.entities.filter(({ entity }) => entity.id === id);

/** The warnings without their log message. */
const codes = (result: Computed<FifthEditionEntity>) =>
  result.warnings.map(({ message: _, ...warning }) => warning);

/** A path's steps, each as its part (or kind) and its change. */
const parts = (result: Computed<FifthEditionEntity>, path: string) =>
  (result.breakdown[path] ?? []).map((step) =>
    step.kind === 'effect' ? `${step.part} ${step.change}` : `${step.kind} ${step.change}`,
  );

/** A golden at `current` hit points storing the condition `id`, and no other. */
const storing = (golden: CharacterInput, current: number, id: EntityId) =>
  withTrackers(golden, { current }, { state: { ...golden.state, conditions: [{ id }] } });

describe('ENG-62 the Unconscious condition at 0 hit points', () => {
  it('is down at 0 hit points and alive: dying, stable or with temporary hit points', () => {
    for (const { golden } of GOLDENS) {
      expect(isDown(withTrackers(golden, { current: 0 }))).toBe(true);
      expect(isDown(withTrackers(golden, { current: 0, stable: true }))).toBe(true);
      expect(isDown(withTrackers(golden, { current: 0, temp: 5 }))).toBe(true);
      expect(isDown(withTrackers(golden, { current: 0, failure: 3 }))).toBe(false);
      expect(isDown(withTrackers(golden, { current: 1 }))).toBe(false);
      expect(isDown(withTrackers(golden, { current: 12 }))).toBe(false);
    }
    expect(UNCONSCIOUS_CONDITION).toBe('unconscious');
  });

  it('gives the condition at 0 hit points: its level, its step, its effect on speed', () => {
    for (const { golden, walk, id } of GOLDENS) {
      const up = computed(withTrackers(golden, { current: 12 }));
      expect([level(up), up.values['speed.walk']]).toEqual([0, walk]);
      const result = computed(withTrackers(golden, { current: 0 }));
      expect(level(result)).toBe(1);
      expect(result.breakdown[`conditions.${UNCONSCIOUS_CONDITION}.level`]).toEqual([
        { kind: 'condition', source: id, label: { en: 'Unconscious' }, value: 1, change: 1 },
      ]);
      expect(had(result, id).map(({ from }) => from)).toEqual([['character']]);
      expect(result.values['speed.walk']).toBe(0);
      expect(parts(result, 'speed.all.mul')).toEqual(['rule 1', `${id}#speed-0 -1`]);
      expect(result.warnings).toEqual([]);
    }
  });

  it('keeps it while stable and with temporary hit points; not for the dead, nor above 0', () => {
    for (const { golden, walk, id } of GOLDENS) {
      for (const down of [
        withTrackers(golden, { current: 0, stable: true }),
        withTrackers(golden, { current: 0, temp: 5 }),
      ]) {
        const result = computed(down);
        expect([level(result), result.values['speed.walk']]).toEqual([1, 0]);
      }
      for (const notDown of [
        withTrackers(golden, { current: 0, failure: 3 }),
        withTrackers(golden, { current: 1 }),
        withTrackers(golden, { current: 12 }),
      ]) {
        const result = computed(notDown);
        expect([level(result), result.values['speed.walk']]).toEqual([0, walk]);
        expect(had(result, id)).toEqual([]);
      }
    }
  });

  it('follows the hit points through every action, and none stores it', () => {
    const levelOf = (character: FifthEditionCharacter) => level(computed(character));
    const six = withTrackers(goldenA, { current: 6 });
    const dropped = done(six, applyDamage(six, with2014, { amount: 6 }, stamp)).character;
    expect(dropped.systemData.state.hp.current).toBe(0);
    expect(dropped.state.conditions).toEqual([]);
    expect([levelOf(six), levelOf(dropped)]).toEqual([0, 1]);
    // `done` has reversed the entry back to `six`, level 0.
    const healed = done(dropped, applyHealing(dropped, with2014, { amount: 3 }, stamp)).character;
    expect(levelOf(healed)).toBe(0);

    const dying = withTrackers(goldenA, { current: 0, failure: 2 });
    expect(levelOf(dying)).toBe(1);
    expect(levelOf(done(dying, rollDeathSave(dying, { natural: 20 }, stamp)).character)).toBe(0);
    const dead = done(dying, rollDeathSave(dying, { natural: 5 }, stamp)).character;
    expect(levelOf(dead)).toBe(0);
    const rested = done(
      dying,
      shortRest(dying, with2014, { hitDice: [{ die: 8, roll: 5 }] }, stamp),
    );
    expect(rested.character.systemData.state.hp.current).toBe(8);
    expect(levelOf(rested.character)).toBe(0);
    // SRD 5.1's knocking out: damage to 0, then stable.
    const knockedOut = done(dropped, stabilize(dropped, stamp)).character;
    expect(knockedOut.systemData.state.deathSaves.stable).toBe(true);
    expect(levelOf(knockedOut)).toBe(1);
    expect(levelOf(done(dead, revive(dead, with2014, { hp: 1 }, stamp)).character)).toBe(0);
  });

  it('counts a stored Unconscious condition too: once at 0 hit points, and above 0', () => {
    for (const { golden, id } of GOLDENS) {
      const both = computed(storing(golden, 0, id));
      expect(had(both, id)).toHaveLength(1);
      expect(level(both)).toBe(1);
      expect(level(computed(storing(golden, 12, id)))).toBe(1);
    }
  });

  it("takes another edition's entry only when the character mixes rulesets", () => {
    const only2024 = { ...srd2024, entities: [unconscious('2024')] };
    const index = loadContentIndex(FIFTH_EDITION_SYSTEM, [
      opened(openFifthEditionPack(srd2014)),
      opened(openFifthEditionPack(only2024)),
    ]).index;
    const kept = compute(withTrackers(goldenA, { current: 0 }), index, fifthEditionModule);
    expect(level(kept)).toBeUndefined();
    expect(codes(kept)).toEqual([
      { code: 'characterRule', rule: 'noUnconsciousCondition', data: { key: 'unconscious' } },
    ]);
    const mixing = withTrackers(goldenA, { current: 0 }, { allowMixedRulesets: true });
    const mixed = compute(mixing, index, fifthEditionModule);
    expect(level(mixed)).toBe(1);
    expect(had(mixed, UNCONSCIOUS_2024)).toHaveLength(1);
    expect(codes(mixed)).toEqual([
      { code: 'otherRuleset', entity: UNCONSCIOUS_2024, ruleset: '2024', mixingAllowed: true },
    ]);
  });

  it('warns at 0 hit points when no pack it can use has the condition, and never breaks', () => {
    for (const { golden, walk } of GOLDENS) {
      const down = withTrackers(golden, { current: 0 });
      const result = compute(down, indexOf(down), fifthEditionModule);
      expect(codes(result)).toEqual([
        { code: 'characterRule', rule: 'noUnconsciousCondition', data: { key: 'unconscious' } },
      ]);
      expect(level(result)).toBeUndefined();
      expect(result.values['speed.walk']).toBe(walk);
      for (const notDown of [
        withTrackers(golden, { current: 12 }),
        withTrackers(golden, { current: 0, failure: 3 }),
      ]) {
        expect(compute(notDown, indexOf(notDown), fifthEditionModule).warnings).toEqual([]);
      }
    }
  });
});
