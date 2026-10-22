import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_RULES,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  fifthEditionModule,
  gainInspiration,
  INSPIRATION_LONG_REST_PATH,
  isDead,
  longRest,
  openFifthEditionPack,
  shortRest,
  spendInspiration,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  copyOf,
  done,
  findOf,
  frozen,
  HP,
  hitDice,
  INSPIRATION,
  indexOf,
  ownSpell,
  refused,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2024 } from './golden/index.ts';

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
    expect(isDead(dead, findOf(dead))).toBe(true);
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

// ENG-64: a long rest gives the inspiration a trait names. Golden B (2024) is the human: 12 hit
// points, one d10, CON +2, stored with a maximum of 1 and none held. The test index gives its
// Resourceful SRD 5.2.1's rule as one effect, as the import will (ENG-64 §4); Cheer is a made-up
// feat with the same effect. Every value was worked out by hand in ENG-64 §3, never copied from a
// run.

const RESOURCEFUL = 'srd-2024:feature/resourceful';
const EXHAUSTION = 'srd-2024:condition/exhaustion';
const GLIMMER = ownSpell('glimmer', 1, true);

/** One more inspiration on a long rest: Resourceful's rule (ENG-64 §8). */
const heroic = (id: string) => ({
  id,
  target: INSPIRATION_LONG_REST_PATH,
  op: 'add' as const,
  value: 1,
});

/** Golden B's pack, its Resourceful carrying its effect. */
const index2024Resourceful = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(
    openFifthEditionPack({
      ...srd2024,
      entities: srd2024.entities.map((entity) =>
        entity.id === RESOURCEFUL ? { ...entity, effects: [heroic('heroic-inspiration')] } : entity,
      ),
    }),
  ),
]).index;

/** A made-up feat that gives one more inspiration on a long rest. */
const CHEER: FifthEditionCharacter['localEntities'][number] = {
  id: 'character:feat/cheer',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Cheer' },
  source: { pack: 'character' },
  effects: [heroic('cheer')],
};

/** What a test changes beside the hit points and the inspiration held. */
interface Asked {
  /** The house rules' maximum; the golden's 1 when not given. */
  max?: number;
  /** Whether the character has Cheer. */
  cheer?: boolean;
  /** The number `inspiration.longRest` is overridden to. */
  override?: number;
}

/** A golden character, golden B unless given, at `current` hit points holding `inspiration`. */
function holdingAt(
  current: number,
  inspiration: number,
  { max, cheer = false, override }: Asked = {},
  golden: CharacterInput = goldenB,
): FifthEditionCharacter {
  const { systemData } = golden;
  return withTrackers(
    golden,
    { current, inspiration },
    {
      ...(cheer && { localEntities: [CHEER] }),
      ...(override !== undefined && {
        overrides: [{ path: INSPIRATION_LONG_REST_PATH, value: override }],
      }),
      systemData: {
        ...systemData,
        houseRules: { ...systemData.houseRules, ...(max !== undefined && { inspirationMax: max }) },
        feats: [...systemData.feats, ...(cheer ? [{ id: CHEER.id }] : [])],
      },
    },
  );
}

/** A long rest on `character`, from the test index unless given. */
const rest = (character: FifthEditionCharacter, index = index2024Resourceful) =>
  longRest(character, index, stamp);

/** The change a rest makes to the inspiration held. */
const given = (before: number, after: number) => ({ path: INSPIRATION, before, after });

/** Hit points 3 → 12: golden A's and golden B's maximum. */
const healed = { path: HP, before: 3, after: 12 };

describe('ENG-64 a long rest gives the inspiration a trait names', () => {
  it('gives every character the path at 0, which an effect adds to', () => {
    expect(INSPIRATION_LONG_REST_PATH).toBe('inspiration.longRest');
    for (const golden of [goldenA, goldenB]) {
      const character = withTrackers(golden, {});
      const { values, breakdown } = compute(character, indexOf(character), fifthEditionModule);
      expect(values[INSPIRATION_LONG_REST_PATH]).toBe(0);
      expect(breakdown[INSPIRATION_LONG_REST_PATH]).toEqual([]);
    }
    const one = compute(holdingAt(12, 0), index2024Resourceful, fifthEditionModule);
    expect(one.values[INSPIRATION_LONG_REST_PATH]).toBe(1);
    expect(one.breakdown[INSPIRATION_LONG_REST_PATH]).toEqual([
      expect.objectContaining({
        kind: 'effect',
        part: `${RESOURCEFUL}#heroic-inspiration`,
        op: 'add',
        value: 1,
        change: 1,
      }),
    ]);
    expect(one.warnings).toEqual([]);
    const two = compute(
      holdingAt(12, 0, { cheer: true }),
      index2024Resourceful,
      fifthEditionModule,
    );
    expect(two.values[INSPIRATION_LONG_REST_PATH]).toBe(2);
    expect(two.breakdown[INSPIRATION_LONG_REST_PATH]).toEqual([
      expect.objectContaining({ kind: 'effect', part: `${RESOURCEFUL}#heroic-inspiration` }),
      expect.objectContaining({ kind: 'effect', part: `${CHEER.id}#cheer` }),
    ]);
  });

  it('gives one on a long rest, in its one entry', () => {
    const full = holdingAt(12, 0);
    const { entry, outcome } = done(full, rest(full));
    expect(entry).toMatchObject({ action: 'longRest', subject: 'rest' });
    expect(entry.changes).toEqual([given(0, 1)]);
    expect(outcome).toEqual({ hitDice: [], warnings: [] });

    const low = holdingAt(3, 0);
    expect(done(low, rest(low)).entry.changes).toEqual([healed, given(0, 1)]);

    const tired = withTrackers(
      goldenB,
      { current: 3, concentration: 'character:spell/glimmer' },
      {
        localEntities: [GLIMMER],
        state: { ...goldenB.state, conditions: [{ id: EXHAUSTION, level: 2 }] },
      },
    );
    expect(done(tired, rest(tired)).entry.changes).toEqual([
      healed,
      {
        path: ['state', 'conditions'],
        before: [{ id: EXHAUSTION, level: 2 }],
        after: [{ id: EXHAUSTION, level: 1 }],
      },
      given(0, 1),
      { path: CONCENTRATION, before: 'character:spell/glimmer' },
    ]);
  });

  it('keeps none past the maximum, and counts it', () => {
    const held = holdingAt(3, 1);
    const { entry, outcome } = done(held, rest(held));
    expect(entry.changes).toEqual([healed]);
    expect(outcome).toEqual({ hitDice: [], warnings: [], inspirationOver: 1 });
    expect(refused(rest(holdingAt(12, 1)))).toEqual({ code: 'unchanged' });
  });

  it("gives one up to the owner's 3", () => {
    expect(DEFAULT_HOUSE_RULES.inspirationMax).toBe(3);
    for (const held of [0, 1, 2]) {
      const before = holdingAt(3, held, { max: 3 });
      const { entry, outcome } = done(before, rest(before));
      expect(entry.changes).toEqual([healed, given(held, held + 1)]);
      expect(outcome.inspirationOver).toBeUndefined();
    }
    const full = holdingAt(3, 3, { max: 3 });
    const { entry, outcome } = done(full, rest(full));
    expect(entry.changes).toEqual([healed]);
    expect(outcome.inspirationOver).toBe(1);
  });

  it('adds up two sources, up to the maximum', () => {
    const cases: [number, number, ReturnType<typeof given>, number | undefined][] = [
      [3, 0, given(0, 2), undefined],
      [3, 2, given(2, 3), 1],
      [1, 0, given(0, 1), 1],
    ];
    for (const [max, held, change, over] of cases) {
      const before = holdingAt(3, held, { max, cheer: true });
      const { entry, outcome } = done(before, rest(before));
      expect(entry.changes, `max ${max}, held ${held}`).toEqual([healed, change]);
      expect(outcome.inspirationOver, `max ${max}, held ${held}`).toBe(over);
    }
  });

  it('rounds down, never takes inspiration away, and reads no edition', () => {
    const half = holdingAt(3, 0, { max: 3, override: 1.5 });
    expect(done(half, rest(half)).entry.changes).toEqual([healed, given(0, 1)]);
    const below = holdingAt(3, 1, { max: 3, override: -1 });
    const { entry, outcome } = done(below, rest(below));
    expect(entry.changes).toEqual([healed]);
    expect(outcome).toEqual({ hitDice: [], warnings: [] });
    const a = holdingAt(3, 0, { max: 3, override: 2 }, goldenA);
    expect(done(a, rest(a, indexOf(a))).entry.changes).toEqual([healed, given(0, 2)]);
  });

  it('gives none without the effect, on a short rest, or when the rest is refused', () => {
    const low = holdingAt(3, 0);
    const plain = done(low, rest(low, indexOf(low)));
    expect(plain.entry.changes).toEqual([healed]);
    expect(plain.outcome).toEqual({ hitDice: [], warnings: [] });

    const ask = { hitDice: [{ die: 10, roll: 6 }] };
    const short = done(low, shortRest(low, index2024Resourceful, ask, stamp));
    expect(short.entry.changes).toEqual([
      { path: HP, before: 3, after: 11 },
      { path: hitDice(10), after: 1 },
    ]);
    expect(short.outcome).toEqual({ hitDice: [{ die: 10, roll: 6, hp: 8 }], warnings: [] });

    expect(refused(rest(holdingAt(0, 0)))).toEqual({ code: 'tooFewHitPoints', hp: 0, min: 1 });
    const dead = withTrackers(goldenB, { current: 0, failure: 3 });
    expect(isDead(dead, findOf(dead))).toBe(true);
    expect(refused(rest(dead))).toEqual({ code: 'dead' });
  });

  it('changes nothing it is given: frozen inputs', () => {
    const character = holdingAt(3, 0);
    const copy = copyOf(character);
    const ice = frozen(character);
    const frozenStamp = frozen(stamp);
    expect(longRest(ice, index2024Resourceful, frozenStamp).ok).toBe(true);
    expect(ice).toEqual(copy);
    expect(frozenStamp).toEqual(stamp);
  });
});
