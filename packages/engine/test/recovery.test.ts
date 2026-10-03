import { compute, loadContentIndex, recoveredOn } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  ash as ashFile,
  brook as brookFile,
  openTalesCharacter,
  openTalesPack,
  type TalesCharacter,
  type TalesEntity,
  talesCore,
} from '../../schema/test/tales/index.ts';
import { talesModule } from './tales-module.ts';

// ENG-21: the uses a resource gets back on a system's recovery events, on Tales (ENG-27). Ash: luck
// max 2 with 1 spent, back all on `scene`; nerve mod 1. Brook: focus max 6, back 2 on `session`.
// Every value is worked out by hand in ENG-21 §3 from Tales' content.

/** The value of an opener's result, or a failed test naming why it did not open. */
function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const pack = opened(openTalesPack(talesCore));
const { index } = loadContentIndex('tales', [pack]);
const ash = opened(openTalesCharacter(ashFile));
const brook = opened(openTalesCharacter(brookFile));
const LUCK = ['state', 'resources', 'luck'];
const FOCUS = ['state', 'resources', 'focus'];
const SPARK = ['state', 'resources', 'spark'];

/** A Tales resource grant's recoveries, with Tales' events. */
type ResourceGrant = Extract<NonNullable<TalesEntity['grants']>[number], { kind: 'resource' }>;
type Recovery = ResourceGrant['uses']['recovery'];

/** `character` with `resources` spent, its other trackers as they are. */
function spending(character: TalesCharacter, resources: Record<string, number>): TalesCharacter {
  return opened(openTalesCharacter({ ...character, state: { ...character.state, resources } }));
}

/** What `character` gets back on `events`. */
function recovered(character: TalesCharacter, events: readonly string[]) {
  return recoveredOn(character, compute(character, index, talesModule), events);
}

/** Ash with talents of its own, each granting `spark` with these recoveries, and `spent` used. */
function ashWithSparks(recoveries: Recovery[], spent: number): TalesCharacter {
  const talents: TalesEntity[] = recoveries.map((recovery, at) => ({
    id: `character:talent/spark-${at + 1}`,
    type: 'talent',
    ruleset: 'any',
    name: { en: `Spark ${at + 1}` },
    tier: 1,
    grants: [
      {
        id: 'uses',
        kind: 'resource',
        key: 'spark',
        label: { en: 'Spark' },
        uses: { max: '3', recovery },
      },
    ],
    source: { pack: 'character' },
  }));
  return opened(
    openTalesCharacter({
      ...ash,
      localEntities: talents,
      state: { ...ash.state, resources: { spark: spent } },
      systemData: { ...ash.systemData, talents: talents.map(({ id }) => id) },
    }),
  );
}

/** A copy that throws on any change, at every depth. */
function frozen<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (each: unknown) => {
    if (typeof each !== 'object' || each === null) return;
    Object.freeze(each);
    for (const inner of Object.values(each)) freeze(inner);
  };
  freeze(copy);
  return copy;
}

describe('ENG-21 resources back on recovery events', () => {
  it("gives back a resource's uses on the events its grant names", () => {
    expect(recovered(ash, ['scene'])).toEqual({
      changes: [{ path: LUCK, before: 1, after: 0 }],
      warnings: [],
    });
    expect(recovered(ash, ['session'])).toEqual({ changes: [], warnings: [] });
    expect(recovered(spending(brook, { focus: 5 }), ['session']).changes).toEqual([
      { path: FOCUS, before: 5, after: 3 },
    ]);
    expect(recovered(spending(brook, { focus: 1 }), ['session']).changes).toEqual([
      { path: FOCUS, before: 1, after: 0 },
    ]);
  });

  it('recovers each grant by the first of the events it names', () => {
    const both = ashWithSparks(
      [
        [
          { on: 'scene', amount: '1' },
          { on: 'session', amount: 'all' },
        ],
      ],
      2,
    );
    expect(recovered(both, ['scene', 'session']).changes).toEqual([
      { path: SPARK, before: 2, after: 1 },
    ]);
    expect(recovered(both, ['session', 'scene']).changes).toEqual([
      { path: SPARK, before: 2, after: 0 },
    ]);
  });

  it('gives a key two grants give the most either gives back', () => {
    const one: Recovery = [{ on: 'scene', amount: '1' }];
    const twice = (other: Recovery) => recovered(ashWithSparks([one, other], 3), ['scene']).changes;
    expect(twice([{ on: 'scene', amount: 'all' }])).toEqual([{ path: SPARK, before: 3, after: 0 }]);
    expect(twice([{ on: 'scene', amount: '2' }])).toEqual([{ path: SPARK, before: 3, after: 1 }]);
    expect(twice([{ on: 'session', amount: 'all' }])).toEqual([
      { path: SPARK, before: 3, after: 2 },
    ]);
    // The grants' order does not change it.
    const reversed = recovered(ashWithSparks([[{ on: 'scene', amount: 'all' }], one], 3), [
      'scene',
    ]);
    expect(reversed.changes).toEqual([{ path: SPARK, before: 3, after: 0 }]);
  });

  it('evaluates an amount on the computed values, rounded down and never below 0', () => {
    const amount = (formula: string) =>
      recovered(ashWithSparks([[{ on: 'scene', amount: formula }]], 2), ['scene']);
    expect(amount('@abilities.nerve.mod').changes).toEqual([{ path: SPARK, before: 2, after: 1 }]);
    expect(amount('1.5').changes).toEqual([{ path: SPARK, before: 2, after: 1 }]);
    expect(amount('-1')).toEqual({ changes: [], warnings: [] });
    const missing = amount('@nope');
    expect(missing.changes).toEqual([]);
    expect(missing.warnings).toMatchObject([
      {
        code: 'recoveryFormula',
        key: 'spark',
        part: 'character:talent/spark-1#uses',
        warning: { code: 'missingPath', path: 'nope' },
      },
    ]);
    expect(missing.warnings[0]?.message).toMatch(/\S/);
  });

  it('leaves a key no grant gives, and a key with none spent', () => {
    expect(recovered(spending(ash, { luck: 1, old: 2 }), ['scene']).changes).toEqual([
      { path: LUCK, before: 1, after: 0 },
    ]);
    expect(recovered(spending(ash, {}), ['scene']).changes).toEqual([]);
    expect(recovered(spending(ash, { luck: 0 }), ['scene']).changes).toEqual([]);
  });

  it('changes nothing it is given', () => {
    const character = frozen(ash);
    const computed = frozen(compute(ash, index, talesModule));
    const events = frozen(['scene']);
    expect(recoveredOn(character, computed, events).changes).toEqual([
      { path: LUCK, before: 1, after: 0 },
    ]);
    expect(character).toEqual(ash);
  });
});
