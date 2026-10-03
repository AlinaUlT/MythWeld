import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_RULES,
  type FifthEditionCharacter,
  fifthEditionModule,
  gainInspiration,
  isDead,
  LONG_REST_INSPIRATION_PATH,
  longRest,
  shortRest,
  spendInspiration,
} from '../src/index.ts';
import {
  type CharacterInput,
  copyOf,
  done,
  frozen,
  HP,
  hitDice,
  INSPIRATION,
  indexOf,
  refused,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB, goldenB4, goldenC2024 } from './golden/index.ts';

// ENG-59: inspiration gained or spent, one at a time, up to the house rules' maximum. Golden A
// (2014) and golden B (2024) are stored with a maximum of 1 and none held; the owner's house rule
// is 3. Every value was worked out by hand in ENG-59's ticket, never copied from a run.

const GOLDENS = [goldenA, goldenB];

/** The golden holding `inspiration`, with its own maximum or the owner's house rule's. */
function holding(
  golden: CharacterInput,
  inspiration: number,
  owners = false,
): FifthEditionCharacter {
  const houseRules = owners ? DEFAULT_HOUSE_RULES : golden.systemData.houseRules;
  return withTrackers(
    golden,
    { inspiration },
    { systemData: { ...golden.systemData, houseRules } },
  );
}

/** The one change an action made to the inspiration held. */
const change = (before: number, after: number) => [{ path: INSPIRATION, before, after }];

describe('ENG-59 inspiration', () => {
  it('gains one up to the golden maximum of 1, in both editions', () => {
    for (const golden of GOLDENS) {
      const before = holding(golden, 0);
      expect(before.systemData.houseRules.inspirationMax).toBe(1);
      const gained = done(before, gainInspiration(before, stamp));
      expect(gained.entry).toMatchObject({ action: 'gainInspiration', subject: 'inspiration' });
      expect(gained.entry.label).toBeUndefined();
      expect(gained.entry.changes).toEqual(change(0, 1));
      expect(gained.character.systemData.state.inspiration).toBe(1);

      expect(refused(gainInspiration(gained.character, stamp))).toEqual({ code: 'atMax', max: 1 });
    }
  });

  it("gains one at a time up to the owner's 3, then refuses", () => {
    expect(DEFAULT_HOUSE_RULES.inspirationMax).toBe(3);
    for (const golden of GOLDENS) {
      for (const held of [0, 1, 2]) {
        const before = holding(golden, held, true);
        expect(done(before, gainInspiration(before, stamp)).entry.changes).toEqual(
          change(held, held + 1),
        );
      }
      const full = holding(golden, 3, true);
      expect(refused(gainInspiration(full, stamp))).toEqual({ code: 'atMax', max: 3 });
    }
  });

  it('spends one, and refuses when none is held', () => {
    for (const golden of GOLDENS) {
      const one = holding(golden, 1);
      const spent = done(one, spendInspiration(one, stamp));
      expect(spent.entry).toMatchObject({ action: 'spendInspiration', subject: 'inspiration' });
      expect(spent.entry.label).toBeUndefined();
      expect(spent.entry.changes).toEqual(change(1, 0));

      const three = holding(golden, 3, true);
      expect(done(three, spendInspiration(three, stamp)).entry.changes).toEqual(change(3, 2));

      expect(refused(spendInspiration(spent.character, stamp))).toEqual({
        code: 'noInspiration',
      });
    }
  });

  it('gains and spends for a dead character as for any other', () => {
    const dead = withTrackers(goldenA, { current: 0, failure: 3, inspiration: 0 });
    expect(isDead(dead)).toBe(true);
    const gained = done(dead, gainInspiration(dead, stamp));
    expect(gained.entry.changes).toEqual(change(0, 1));
    const spent = done(gained.character, spendInspiration(gained.character, stamp));
    expect(spent.entry.changes).toEqual(change(1, 0));
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = holding(goldenB, 1, true);
    const copy = copyOf(character);
    const ice = frozen(character);
    const frozenStamp = frozen(stamp);
    expect(gainInspiration(ice, frozenStamp).ok).toBe(true);
    expect(spendInspiration(ice, frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
    expect(frozenStamp).toEqual(stamp);
  });
});

// ENG-64: a long rest gives the inspiration `inspiration.longRest` counts, up to the house rules'
// maximum; the rest above it is lost. Golden B (2024) is a human, whose Resourceful adds 1 (SRD
// 5.2.1, ENG-64 §8): 12 hit points, one d10, CON +2. Golden A (2014) is a dwarf: 12 hit points, no
// trait on the path. The feat `character:feat/inspiring` is made up. Every value was worked out by
// hand in ENG-64 §3, never copied from a run.

type OwnEntity = FifthEditionCharacter['localEntities'][number];

/** A made-up feat whose effect adds `value` to the inspiration a long rest gives. */
function inspiring(value: number): OwnEntity {
  return {
    id: 'character:feat/inspiring',
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Inspiring' },
    source: { pack: 'character' },
    effects: [{ id: 'more', target: LONG_REST_INSPIRATION_PATH, op: 'add', value }],
  };
}

/** How a golden rests: its hit points, the inspiration held and its maximum, a feat, overrides. */
interface Resting {
  current?: number;
  held?: number;
  max?: number;
  feat?: number;
  overrides?: CharacterInput['overrides'];
}

/** A golden at 3 hit points holding none of a maximum of 1, unless `resting` says otherwise. */
function rester(golden: CharacterInput, resting: Resting = {}): FifthEditionCharacter {
  const { current = 3, held = 0, max = 1, feat, overrides } = resting;
  const own = feat === undefined ? [] : [inspiring(feat)];
  return withTrackers(
    golden,
    { current, inspiration: held },
    {
      ...(overrides !== undefined && { overrides }),
      ...(own.length > 0 && { localEntities: own }),
      systemData: {
        ...golden.systemData,
        houseRules: { ...golden.systemData.houseRules, inspirationMax: max },
        feats: [...golden.systemData.feats, ...own.map(({ id }) => ({ id }))],
      },
    },
  );
}

/** A long rest on `character`. */
const long = (character: FifthEditionCharacter) => longRest(character, indexOf(character), stamp);

/** The inspiration a long rest gives `character`, and the steps that say why. */
function given(character: FifthEditionCharacter) {
  const { values, breakdown } = compute(character, indexOf(character), fifthEditionModule);
  return {
    value: values[LONG_REST_INSPIRATION_PATH],
    steps: breakdown[LONG_REST_INSPIRATION_PATH],
  };
}

/** A long rest that happened: its changes, and the inspiration it lost. */
function rested(character: FifthEditionCharacter) {
  const rest = done(character, long(character));
  expect(rest.entry).toMatchObject({ action: 'longRest', subject: 'rest' });
  return { changes: rest.entry.changes, lost: rest.outcome.inspirationLost };
}

/** The hit points from 3 to the golden's 12. */
const FILLED = { path: HP, before: 3, after: 12 };

describe('ENG-64 a long rest gives the inspiration a trait names', () => {
  it('computes inspiration.longRest: 0 with no step, 1 from the human Resourceful', () => {
    expect(LONG_REST_INSPIRATION_PATH).toBe('inspiration.longRest');
    const none = { value: 0, steps: [] };
    expect(given(rester(goldenA))).toEqual(none);
    expect(given(rester(goldenC2024))).toEqual(none);
    const resourceful = {
      value: 1,
      steps: [
        {
          kind: 'effect',
          part: 'srd-2024:feature/resourceful#heroic-inspiration',
          source: 'srd-2024:feature/resourceful',
          label: { en: 'Resourceful' },
          op: 'add',
          value: 1,
          change: 1,
        },
      ],
    };
    expect(given(rester(goldenB))).toEqual(resourceful);
    expect(given(rester(goldenB4))).toEqual(resourceful);
    const zero = rester(goldenB, { overrides: [{ path: LONG_REST_INSPIRATION_PATH, value: 0 }] });
    expect(given(zero).value).toBe(0);
  });

  it('adds no warning to golden B', () => {
    const b = rester(goldenB, { current: 12 });
    expect(compute(b, indexOf(b), fifthEditionModule).warnings).toEqual([]);
  });

  it('gains it with the hit points, in one entry, and when nothing else is spent', () => {
    expect(rested(rester(goldenB))).toEqual({
      changes: [FILLED, { path: INSPIRATION, before: 0, after: 1 }],
      lost: 0,
    });
    expect(rested(rester(goldenB, { current: 12 }))).toEqual({
      changes: [{ path: INSPIRATION, before: 0, after: 1 }],
      lost: 0,
    });
  });

  it('loses the gain above the maximum, and still rests', () => {
    expect(rested(rester(goldenB, { held: 1 }))).toEqual({ changes: [FILLED], lost: 1 });
    expect(refused(long(rester(goldenB, { held: 1, current: 12 })))).toEqual({
      code: 'unchanged',
    });
  });

  it("gains up to the owner's 3", () => {
    expect(DEFAULT_HOUSE_RULES.inspirationMax).toBe(3);
    for (const held of [0, 1, 2]) {
      expect(rested(rester(goldenB, { held, max: 3 }))).toEqual({
        changes: [FILLED, { path: INSPIRATION, before: held, after: held + 1 }],
        lost: 0,
      });
    }
    expect(rested(rester(goldenB, { held: 3, max: 3 }))).toEqual({ changes: [FILLED], lost: 1 });
  });

  it('gains what every effect adds, up to the maximum', () => {
    expect(rested(rester(goldenB, { feat: 2, max: 3 }))).toEqual({
      changes: [FILLED, { path: INSPIRATION, before: 0, after: 3 }],
      lost: 0,
    });
    expect(rested(rester(goldenB, { feat: 2, max: 3, held: 1 }))).toEqual({
      changes: [FILLED, { path: INSPIRATION, before: 1, after: 3 }],
      lost: 1,
    });
    expect(rested(rester(goldenB, { feat: 2 }))).toEqual({
      changes: [FILLED, { path: INSPIRATION, before: 0, after: 1 }],
      lost: 2,
    });
  });

  it('gains a whole count, never below 0', () => {
    expect(rested(rester(goldenB, { feat: 0.5, max: 3 }))).toEqual({
      changes: [FILLED, { path: INSPIRATION, before: 0, after: 1 }],
      lost: 0,
    });
    expect(rested(rester(goldenB, { feat: -2, max: 3 }))).toEqual({ changes: [FILLED], lost: 0 });
  });

  it('reads no edition: a 2014 character gains what its effect adds', () => {
    expect(rested(rester(goldenA, { feat: 2, max: 3 }))).toEqual({
      changes: [FILLED, { path: INSPIRATION, before: 0, after: 2 }],
      lost: 0,
    });
    expect(rested(rester(goldenA))).toEqual({ changes: [FILLED], lost: 0 });
  });

  it('gains none when an override sets the path to 0', () => {
    const zero = rester(goldenB, { overrides: [{ path: LONG_REST_INSPIRATION_PATH, value: 0 }] });
    expect(rested(zero)).toEqual({ changes: [FILLED], lost: 0 });
  });

  it('gives none on a short rest', () => {
    const b = rester(goldenB);
    const rest = done(b, shortRest(b, indexOf(b), { hitDice: [{ die: 10, roll: 6 }] }, stamp));
    expect(rest.entry.changes).toEqual([
      { path: HP, before: 3, after: 11 },
      { path: hitDice(10), after: 1 },
    ]);
    expect(rest.outcome.inspirationLost).toBe(0);
    const full = rester(goldenB, { current: 12 });
    expect(refused(shortRest(full, indexOf(full), {}, stamp))).toEqual({ code: 'unchanged' });
  });

  it('refuses as before: at 0 hit points, and dead', () => {
    expect(refused(long(rester(goldenB, { current: 0 })))).toEqual({
      code: 'tooFewHitPoints',
      hp: 0,
      min: 1,
    });
    const dead = withTrackers(goldenB, { current: 0, failure: 3, inspiration: 0 });
    expect(refused(long(dead))).toEqual({ code: 'dead' });
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = rester(goldenB, { feat: 2, max: 3, held: 1 });
    const copy = copyOf(character);
    const ice = frozen(character);
    const frozenStamp = frozen(stamp);
    expect(longRest(ice, indexOf(ice), frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
    expect(frozenStamp).toEqual(stamp);
  });
});
