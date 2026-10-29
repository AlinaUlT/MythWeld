import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  type DamageAsk,
  type FifthEditionCharacter,
  type FifthEditionEntity,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  done,
  FAILURE,
  HP,
  indexOf,
  refused,
  type SpellId,
  stamp,
  TEMP,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// SHEET-16: damage of a type meets the character's defenses. Golden A (2014) and golden B (2024)
// have a hit point maximum of 12 (SPEC §6.7); the 2014 pack has the damage type `bludgeoning`, the
// 2024 pack `slashing`, neither has `rust`. The feats are made up, no text of a book. Each value
// was worked out by hand in SHEET-16 §3, never copied from a run.

type EntityInput = FifthEditionCharacter['localEntities'][number];
type List = 'resist' | 'immune' | 'vuln';

const GLIMMER: SpellId = 'character:spell/glimmer';

/** A made-up feat that appends `type` to each list given. */
function feat(slug: string, type: string, lists: readonly List[]): FifthEditionEntity {
  return {
    id: `character:feat/${slug}`,
    type: 'feat',
    ruleset: 'any',
    name: { en: slug },
    source: { pack: 'character' },
    effects: lists.map((list) => ({
      id: list,
      target: `defenses.${list}`,
      op: 'append',
      value: type,
    })),
  } as EntityInput as FifthEditionEntity;
}

/** What a character set up for a test holds, beside its trackers. */
interface Setup {
  current?: number;
  temp?: number;
  concentration?: SpellId;
  /** The hit point maximum, by a manual override. */
  max?: number;
  overrides?: CharacterInput['overrides'];
}

/** The golden with a feat giving these defenses to `type`, and the setup's trackers. */
function defended(
  golden: CharacterInput,
  type: string,
  lists: readonly List[],
  setup: Setup = {},
): FifthEditionCharacter {
  const { max, overrides = [], ...trackers } = setup;
  const own = feat('guard', type, lists);
  return withTrackers(golden, trackers, {
    localEntities: [own],
    overrides: [...(max === undefined ? [] : [{ path: 'hp.max', value: max }]), ...overrides],
    systemData: {
      ...golden.systemData,
      feats: [...golden.systemData.feats, { id: own.id }],
    },
  });
}

/** `amount` damage of `type` (none when undefined) on `character`, from its edition's pack. */
const hit = (
  character: FifthEditionCharacter,
  amount: number,
  type?: string,
  more: Omit<DamageAsk, 'amount' | 'type'> = {},
) =>
  applyDamage(
    character,
    indexOf(character),
    { amount, ...(type !== undefined && { type }), ...more },
    stamp,
  );

const step = (list: List, type: string, amount: number) => ({
  list,
  path: `defenses.${list}.${type}`,
  amount,
});

describe('SHEET-16 damage by its type', () => {
  it('takes damage with no type as it is, with no `defended`', () => {
    const before = defended(goldenA, 'bludgeoning', ['resist']);
    const result = done(before, hit(before, 7));
    expect(result.entry.changes).toEqual([{ path: HP, before: 12, after: 5 }]);
    expect(result.outcome).toEqual({ temp: 0, hp: 7, status: 'up', failures: 0 });
  });

  it('halves damage the character resists, rounded down (2014: 7 bludgeoning takes 3)', () => {
    const before = defended(goldenA, 'bludgeoning', ['resist']);
    const result = done(before, hit(before, 7, 'bludgeoning'));
    expect(result.entry.changes).toEqual([{ path: HP, before: 12, after: 9 }]);
    expect(result.outcome).toEqual({
      temp: 0,
      hp: 3,
      status: 'up',
      failures: 0,
      defended: {
        dealt: 7,
        type: 'bludgeoning',
        steps: [step('resist', 'bludgeoning', 3)],
        amount: 3,
        missing: false,
      },
    });
  });

  it("halves, then doubles (SRD 5.2.1's example: 23 slashing comes to 11, then 22)", () => {
    const before = defended(goldenB, 'slashing', ['resist', 'vuln'], { max: 40, current: 40 });
    const result = done(before, hit(before, 23, 'slashing'));
    expect(result.entry.changes).toEqual([{ path: HP, before: 40, after: 18 }]);
    expect(result.outcome.defended).toEqual({
      dealt: 23,
      type: 'slashing',
      steps: [step('resist', 'slashing', 11), step('vuln', 'slashing', 22)],
      amount: 22,
      missing: false,
    });
  });

  it('measures massive damage on the doubled damage: 9 bludgeoning at 6 of 12 kills', () => {
    const before = defended(goldenA, 'bludgeoning', ['vuln'], { current: 6 });
    const dead = done(before, hit(before, 9, 'bludgeoning'));
    expect(dead.outcome).toMatchObject({ hp: 6, status: 'dead', failures: 3 });
    expect(dead.entry.changes).toContainEqual({ path: FAILURE, before: 0, after: 3 });
    // Without the type, 3 is left over, below the maximum.
    const down = done(before, hit(before, 9));
    expect(down.outcome).toEqual({ temp: 0, hp: 6, status: 'down', failures: 0 });
  });

  it('takes the temporary hit points from the damage left: 14 resisted is 7, 5 of them temporary', () => {
    const before = defended(goldenA, 'bludgeoning', ['resist'], { temp: 5 });
    const result = done(before, hit(before, 14, 'bludgeoning'));
    expect(result.entry.changes).toEqual([
      { path: TEMP, before: 5, after: 0 },
      { path: HP, before: 12, after: 10 },
    ]);
    expect(result.outcome).toMatchObject({ temp: 5, hp: 2 });
  });

  it('gives the concentration DC from the damage taken: 44 resisted is 22, DC 11, at 50 of 50', () => {
    const setup = { max: 50, current: 50, concentration: GLIMMER };
    const before = defended(goldenB, 'slashing', ['resist'], setup);
    const typed = done(before, hit(before, 44, 'slashing'));
    expect(typed.outcome).toMatchObject({ hp: 22, status: 'up', concentrationDc: 11 });
    expect(typed.entry.changes.map(({ path }) => path)).not.toContain(CONCENTRATION);
    // Without the type, or without the defense, the DC is half of 44.
    expect(done(before, hit(before, 44)).outcome).toMatchObject({ hp: 44, concentrationDc: 22 });
    const bare = defended(goldenB, 'slashing', [], setup);
    expect(done(bare, hit(bare, 44, 'slashing')).outcome).toMatchObject({
      hp: 44,
      concentrationDc: 22,
    });
  });

  it('refuses damage the defenses leave at 0, as `noDamage`', () => {
    const resisted = defended(goldenA, 'bludgeoning', ['resist']);
    expect(refused(hit(resisted, 1, 'bludgeoning'))).toEqual({
      code: 'noDamage',
      defended: {
        dealt: 1,
        type: 'bludgeoning',
        steps: [step('resist', 'bludgeoning', 0)],
        amount: 0,
        missing: false,
      },
    });
    // Immunity takes it all; resistance and vulnerability do not apply after it.
    const immune = defended(goldenB, 'slashing', ['immune', 'resist', 'vuln']);
    expect(refused(hit(immune, 30, 'slashing'))).toEqual({
      code: 'noDamage',
      defended: {
        dealt: 30,
        type: 'slashing',
        steps: [step('immune', 'slashing', 0)],
        amount: 0,
        missing: false,
      },
    });
  });

  it('applies no defense of another type', () => {
    const before = defended(goldenB, 'slashing', ['immune']);
    const result = done(before, hit(before, 5, 'bludgeoning'));
    expect(result.entry.changes).toEqual([{ path: HP, before: 12, after: 7 }]);
    // The 2024 pack has no `bludgeoning`.
    expect(result.outcome.defended).toEqual({
      dealt: 5,
      type: 'bludgeoning',
      steps: [],
      amount: 5,
      missing: true,
    });
  });

  it('applies a defense to a type no entry has, and says it is missing', () => {
    const before = defended(goldenA, 'rust', ['resist']);
    const result = done(before, hit(before, 9, 'rust'));
    expect(result.outcome.defended).toEqual({
      dealt: 9,
      type: 'rust',
      steps: [step('resist', 'rust', 4)],
      amount: 4,
      missing: true,
    });
  });

  it('applies no defense an override takes away', () => {
    const before = defended(goldenA, 'bludgeoning', ['resist'], {
      overrides: [{ path: 'defenses.resist.bludgeoning', value: 0 }],
    });
    const result = done(before, hit(before, 7, 'bludgeoning'));
    expect(result.outcome).toMatchObject({ hp: 7, defended: { steps: [], amount: 7 } });
  });

  it('refuses a type that is not a key', () => {
    const before = defended(goldenA, 'bludgeoning', ['resist']);
    expect(refused(hit(before, 7, 'Not a key'))).toEqual({ code: 'badType', type: 'Not a key' });
  });

  it('knocks out by the damage left (2024): 30 resisted drops 12 to 0, 20 resisted does not', () => {
    const before = defended(goldenB, 'slashing', ['resist']);
    const knocked = done(before, hit(before, 30, 'slashing', { knockOut: true }));
    expect(knocked.outcome).toMatchObject({ hp: 11, status: 'knockedOut' });
    expect(refused(hit(before, 20, 'slashing', { knockOut: true }))).toEqual({
      code: 'notDroppedToZero',
    });
  });
});
