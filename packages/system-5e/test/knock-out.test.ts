import { type Computed, compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  applyHealing,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  fifthEditionModule,
  firstAid,
  isKnockedOut,
  longRest,
  RULES_2014,
  RULES_2024,
  revive,
  rollDeathSave,
  setTempHp,
  shortRest,
  stabilize,
  UNCONSCIOUS_CONDITION,
} from '../src/index.ts';
import {
  type CharacterInput,
  copyOf,
  done,
  frozen,
  HP,
  indexOf,
  KNOCKED_OUT,
  refused,
  type SpellId,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';
import { UNCONSCIOUS_2024, withEntry } from './unconscious-entries.ts';

// ENG-65: SRD 5.2.1's knocking out, at 1 hit point. Golden A (2014) and golden B (2024) have a hit
// point maximum of 12 (SPEC §6.7); A walks 25 feet, B 30 (ENG-19); B has one d10 hit die and a
// Constitution modifier of +2 (ENG-61). The Unconscious entries are `unconscious-entries.ts`'s.
// Every expected value was worked out by hand in ENG-65 §3.

const GLIMMER: SpellId = 'character:spell/glimmer';

type Mark = 'resting' | 'interrupted';
const MARKS: readonly Mark[] = ['resting', 'interrupted'];

/** Golden B (or `golden`) knocked out at 1 hit point, with `mark`. */
const knockedOut = (mark: Mark = 'resting', golden: CharacterInput = goldenB) =>
  withTrackers(golden, { current: 1, knockedOut: mark });

/** Golden B dead, with a knock-out's mark left. */
const deadMarked = () =>
  withTrackers(goldenB, { current: 0, failure: 3, knockedOut: 'interrupted' });

/** The damage `amount` on `character` that knocks it out, from its edition's pack. */
const knock = (character: FifthEditionCharacter, amount: number) =>
  applyDamage(character, indexOf(character), { amount, knockOut: true }, stamp);

/** The damage `amount` on `character`, as any damage. */
const hit = (character: FifthEditionCharacter, amount: number) =>
  applyDamage(character, indexOf(character), { amount }, stamp);

/** The character computed from its edition's pack with the Unconscious entry. */
const computed = (character: FifthEditionCharacter) =>
  compute(character, withEntry(character), fifthEditionModule);

/** The Unconscious condition's level, as a formula reads it. */
const level = (result: Computed<FifthEditionEntity>) =>
  result.values[`conditions.${UNCONSCIOUS_CONDITION}.level`];

/** The Unconscious condition's level the character computes. */
const levelOf = (character: FifthEditionCharacter) => level(computed(character));

/** How many times the character has the entity `id`. */
const had = (result: Computed<FifthEditionEntity>, id: string) =>
  result.entities.filter(({ entity }) => entity.id === id);

/** The warnings without their log message. */
const codes = (result: Computed<FifthEditionEntity>) =>
  result.warnings.map(({ message: _, ...warning }) => warning);

/** The character's knock-out mark. */
const markOf = (character: FifthEditionCharacter) => character.systemData.state.knockedOut;

describe('ENG-65 knocked out at 1 hit point', () => {
  it('is a 2024 rule', () => {
    expect(RULES_2024.knockOutToOneHp).toBe(true);
    expect(RULES_2014.knockOutToOneHp).toBe(false);
  });

  it('leaves the character at 1 hit point, knocked out, when damage would drop it to 0', () => {
    const five = withTrackers(goldenB, { current: 5 });
    for (const amount of [9, 5]) {
      const result = done(five, knock(five, amount));
      expect(result.character.systemData.state.hp).toEqual({ current: 1, temp: 0 });
      expect(markOf(result.character)).toBe('resting');
      expect(isKnockedOut(result.character)).toBe(true);
      expect(result.character.systemData.state.deathSaves).toEqual(
        five.systemData.state.deathSaves,
      );
      expect(result.outcome).toEqual({ temp: 0, hp: 4, status: 'knockedOut', failures: 0 });
      expect(result.entry.changes).toEqual([
        { path: HP, before: 5, after: 1 },
        { path: KNOCKED_OUT, after: 'resting' },
      ]);
    }
  });

  it('gives no massive damage, takes the temporary hit points first, ends concentration', () => {
    const six = withTrackers(goldenB, { current: 6 });
    expect(done(six, hit(six, 18)).outcome.status).toBe('dead');
    const out = done(six, knock(six, 18));
    expect(out.character.systemData.state.hp.current).toBe(1);
    expect(markOf(out.character)).toBe('resting');
    expect(out.outcome).toEqual({ temp: 0, hp: 5, status: 'knockedOut', failures: 0 });

    const shielded = withTrackers(goldenB, { current: 5, temp: 3 });
    const through = done(shielded, knock(shielded, 9));
    expect(through.character.systemData.state.hp).toEqual({ current: 1, temp: 0 });
    expect(through.outcome).toEqual({ temp: 3, hp: 4, status: 'knockedOut', failures: 0 });

    const holding = withTrackers(goldenB, { current: 5, concentration: GLIMMER });
    const ended = done(holding, knock(holding, 9));
    expect(ended.character.systemData.state.concentration).toBeUndefined();
    expect(ended.outcome).toEqual({
      temp: 0,
      hp: 4,
      status: 'knockedOut',
      failures: 0,
      concentrationEnded: GLIMMER,
    });
  });

  it('knocks out again: nothing changes while resting; an interrupted rest starts again', () => {
    expect(refused(knock(knockedOut('resting'), 1))).toEqual({ code: 'unchanged' });
    const interrupted = knockedOut('interrupted');
    const again = done(interrupted, knock(interrupted, 1));
    expect(again.entry.changes).toEqual([
      { path: KNOCKED_OUT, before: 'interrupted', after: 'resting' },
    ]);
    expect(again.outcome).toEqual({ temp: 0, hp: 0, status: 'knockedOut', failures: 0 });
  });

  it('is refused when the damage does not drop the character to 0, and in 2014', () => {
    const five = withTrackers(goldenB, { current: 5 });
    const notToZero = [
      [five, 4],
      [withTrackers(goldenB, { current: 5, temp: 10 }), 9],
      [withTrackers(goldenB, { current: 0 }), 3],
    ] as const;
    for (const [character, amount] of notToZero) {
      const before = copyOf(character);
      expect(refused(knock(character, amount))).toEqual({ code: 'notDroppedToZero' });
      expect(character).toEqual(before);
    }
    expect(refused(knock(deadMarked(), 3))).toEqual({ code: 'dead' });
    expect(refused(knock(five, 0))).toEqual({ code: 'badAmount', amount: 0 });
    const a = withTrackers(goldenA, { current: 5 });
    expect(refused(knock(a, 9))).toEqual({ code: 'noKnockOut' });
    expect(done(a, hit(a, 9)).character.systemData.state.hp.current).toBe(0);
  });

  it('gives the Unconscious condition while knocked out, and to the living only', () => {
    for (const mark of MARKS) {
      const result = computed(knockedOut(mark));
      expect(level(result)).toBe(1);
      expect(result.breakdown[`conditions.${UNCONSCIOUS_CONDITION}.level`]).toEqual([
        {
          kind: 'condition',
          source: UNCONSCIOUS_2024,
          label: { en: 'Unconscious' },
          value: 1,
          change: 1,
        },
      ]);
      expect(had(result, UNCONSCIOUS_2024).map(({ from }) => from)).toEqual([['character']]);
      expect(result.values['speed.walk']).toBe(0);
      expect(result.warnings).toEqual([]);
    }
    const one = computed(withTrackers(goldenB, { current: 1 }));
    expect([level(one), one.values['speed.walk']]).toEqual([0, 30]);

    const storing = withTrackers(
      goldenB,
      { current: 0, knockedOut: 'interrupted' },
      { state: { ...goldenB.state, conditions: [{ id: UNCONSCIOUS_2024 }] } },
    );
    const once = computed(storing);
    expect([had(once, UNCONSCIOUS_2024).length, level(once)]).toEqual([1, 1]);

    const dead = computed(deadMarked());
    expect([level(dead), dead.values['speed.walk']]).toEqual([0, 30]);
    expect(had(dead, UNCONSCIOUS_2024)).toEqual([]);
    expect(isKnockedOut(deadMarked())).toBe(false);

    const a = computed(knockedOut('resting', goldenA));
    expect([level(a), a.values['speed.walk']]).toEqual([1, 0]);
  });

  it('warns when knocked out with no Unconscious condition in reach', () => {
    const out = knockedOut();
    const result = compute(out, indexOf(out), fifthEditionModule);
    expect(codes(result)).toEqual([
      { code: 'characterRule', rule: 'noUnconsciousCondition', data: { key: 'unconscious' } },
    ]);
    expect(level(result)).toBeUndefined();
    expect(result.values['speed.walk']).toBe(30);
  });

  it('ends when the character regains hit points: healing, a rest', () => {
    for (const mark of MARKS) {
      const out = knockedOut(mark);
      const healed = done(out, applyHealing(out, withEntry(out), { amount: 3 }, stamp));
      expect(healed.character.systemData.state.hp.current).toBe(4);
      expect(markOf(healed.character)).toBeUndefined();
      expect(healed.entry.changes).toEqual([
        { path: HP, before: 1, after: 4 },
        { path: KNOCKED_OUT, before: mark },
      ]);
      expect(levelOf(healed.character)).toBe(0);

      const rested = done(out, longRest(out, indexOf(out), stamp)).character;
      expect(rested.systemData.state.hp.current).toBe(12);
      expect(markOf(rested)).toBeUndefined();
    }
    // At a maximum of 1, healing regains no hit point: the knock-out stays.
    const one = withTrackers(
      goldenB,
      { current: 1, knockedOut: 'resting' },
      { overrides: [{ path: 'hp.max', value: 1 }] },
    );
    expect(refused(applyHealing(one, indexOf(one), { amount: 3 }, stamp))).toEqual({
      code: 'unchanged',
    });
  });

  it('ends at the end of its short rest, unless damage interrupted that rest', () => {
    const resting = knockedOut('resting');
    const woke = done(resting, shortRest(resting, indexOf(resting), {}, stamp));
    expect(woke.entry.changes).toEqual([{ path: KNOCKED_OUT, before: 'resting' }]);
    expect(woke.character.systemData.state.hp.current).toBe(1);
    expect(levelOf(woke.character)).toBe(0);

    const interrupted = knockedOut('interrupted');
    const index = indexOf(interrupted);
    expect(refused(shortRest(interrupted, index, {}, stamp))).toEqual({ code: 'unchanged' });
    const spent = shortRest(interrupted, index, { hitDice: [{ die: 10, roll: 6 }] }, stamp);
    const healed = done(interrupted, spent).character;
    expect(healed.systemData.state.hp.current).toBe(9);
    expect(markOf(healed)).toBeUndefined();
  });

  it('is interrupted by damage, and stays', () => {
    const shielded = withTrackers(goldenB, { current: 1, temp: 5, knockedOut: 'resting' });
    const absorbed = done(shielded, hit(shielded, 3));
    expect(absorbed.character.systemData.state.hp).toEqual({ current: 1, temp: 2 });
    expect(markOf(absorbed.character)).toBe('interrupted');
    expect(absorbed.outcome.status).toBe('knockedOut');
    expect(levelOf(absorbed.character)).toBe(1);

    const out = knockedOut('resting');
    const dropped = done(out, hit(out, 1));
    expect(dropped.character.systemData.state.hp.current).toBe(0);
    expect(markOf(dropped.character)).toBe('interrupted');
    expect(dropped.outcome).toMatchObject({ failures: 0, status: 'down' });
    expect(levelOf(dropped.character)).toBe(1);
  });

  it('ends with the hit point of a death save of 20, and with a revival', () => {
    const down = withTrackers(goldenB, { current: 0, knockedOut: 'interrupted' });
    const up = done(down, rollDeathSave(down, { natural: 20 }, stamp)).character;
    expect(up.systemData.state.hp.current).toBe(1);
    expect(markOf(up)).toBeUndefined();
    expect(markOf(done(down, rollDeathSave(down, { natural: 15 }, stamp)).character)).toBe(
      'interrupted',
    );
    const dead = deadMarked();
    const back = done(dead, revive(dead, indexOf(dead), { hp: 1 }, stamp)).character;
    expect(back.systemData.state.hp.current).toBe(1);
    expect(markOf(back)).toBeUndefined();
  });

  it('stays with temporary hit points and when stabilized', () => {
    const out = knockedOut();
    expect(markOf(done(out, setTempHp(out, { amount: 5 }, stamp)).character)).toBe('resting');
    const down = withTrackers(goldenB, { current: 0, knockedOut: 'interrupted' });
    const stable = done(down, stabilize(down, stamp)).character;
    expect(stable.systemData.state.deathSaves.stable).toBe(true);
    expect(markOf(stable)).toBe('interrupted');
  });

  it('ends with first aid', () => {
    for (const mark of MARKS) {
      const out = knockedOut(mark);
      const aided = done(out, firstAid(out, stamp));
      expect(aided.entry).toMatchObject({
        action: 'firstAid',
        subject: 'knockedOut',
        changes: [{ path: KNOCKED_OUT, before: mark }],
      });
      expect(levelOf(aided.character)).toBe(0);
    }
    const down = withTrackers(goldenB, { current: 0, knockedOut: 'interrupted' });
    const aided = done(down, firstAid(down, stamp)).character;
    expect(markOf(aided)).toBeUndefined();
    expect(levelOf(aided)).toBe(1);
    expect(refused(firstAid(withTrackers(goldenB, { current: 12 }), stamp))).toEqual({
      code: 'notKnockedOut',
    });
    expect(refused(firstAid(withTrackers(goldenB, { current: 0 }), stamp))).toEqual({
      code: 'notKnockedOut',
    });
    expect(refused(firstAid(deadMarked(), stamp))).toEqual({ code: 'dead' });
  });

  it('changes no frozen input', () => {
    const out = frozen(knockedOut('resting'));
    const five = frozen(withTrackers(goldenB, { current: 5 }));
    const ask = frozen({ amount: 9, knockOut: true });
    const before = [copyOf(out), copyOf(five)];
    expect(applyDamage(five, indexOf(five), ask, frozen(stamp)).ok).toBe(true);
    expect(firstAid(out, frozen(stamp)).ok).toBe(true);
    expect(shortRest(out, indexOf(out), frozen({}), frozen(stamp)).ok).toBe(true);
    expect(applyHealing(out, indexOf(out), frozen({ amount: 3 }), frozen(stamp)).ok).toBe(true);
    expect([out, five]).toEqual(before);
  });
});
