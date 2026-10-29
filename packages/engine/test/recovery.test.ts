import {
  compute,
  conditionsRecoveredOn,
  loadContentIndex,
  recoveredOn,
  recoveryOf,
} from '@grimoire/engine';
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
    expect(recovered(ash, ['scene'])).toEqual({ changes: [{ path: LUCK, before: 1, after: 0 }] });
    expect(recovered(ash, ['session'])).toEqual({ changes: [] });
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
    expect(amount('-1')).toEqual({ changes: [] });
    // SHEET-20: a formula's warning is `compute()`'s, not the recovery's.
    expect(amount('@nope')).toEqual({ changes: [] });
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

// SHEET-20: the amount a resource gets back on a recovery event is a computed path, with a
// breakdown, effects and overrides; a rest gives back what it says. Every value is worked out by
// hand in SHEET-20 §3 from Tales' content: Ash's nerve mod is 1, a spark's maximum is 3.

const SCENE = 'resources.spark.recovery.scene';

/** Ash's own sparks (`ashWithSparks`) with these effects on the first, and these overrides. */
function ashWithChanges(
  recoveries: Recovery[],
  spent: number,
  effects: NonNullable<TalesEntity['effects']>,
  overrides: TalesCharacter['overrides'] = [],
): TalesCharacter {
  const sparks = ashWithSparks(recoveries, spent);
  const [first, ...rest] = sparks.localEntities;
  if (first === undefined) throw new Error('No spark.');
  return opened(
    openTalesCharacter({ ...sparks, localEntities: [{ ...first, effects }, ...rest], overrides }),
  );
}

/** The step a spark's grant gives its amount. */
function sparkStep(at: number, formula: string, value: number, change: number) {
  return {
    kind: 'grant',
    part: `character:talent/spark-${at}#uses`,
    source: `character:talent/spark-${at}`,
    label: { en: `Spark ${at}` },
    formula,
    value,
    change,
  };
}

describe('SHEET-20 a recovery amount computed with a breakdown', () => {
  it("computes a grant's amount on each event it names, with its step", () => {
    const computed = compute(brook, index, talesModule);
    expect(computed.values['resources.focus.recovery.session']).toBe(2);
    expect(computed.breakdown['resources.focus.recovery.session']).toEqual([
      {
        kind: 'grant',
        part: 'tales-core:calling/seeker#focus',
        source: 'tales-core:calling/seeker',
        label: { en: 'Seeker' },
        formula: '2',
        value: 2,
        change: 2,
      },
    ]);
    expect(recoveryOf(computed, 'focus')).toEqual([
      { on: 'session', amount: 2, path: 'resources.focus.recovery.session' },
    ]);
  });

  it('gives every use, and no path, for an amount of all', () => {
    const computed = compute(ash, index, talesModule);
    expect(Object.keys(computed.values).filter((path) => path.includes('.recovery.'))).toEqual([]);
    expect(recoveryOf(computed, 'luck')).toEqual([{ on: 'scene', amount: 'all' }]);
    expect(recoveryOf(computed, 'nope')).toEqual([]);
  });

  it('lists the events in the order the grants name them, all above any count', () => {
    const both = compute(
      ashWithSparks(
        [
          [
            { on: 'scene', amount: '1' },
            { on: 'session', amount: 'all' },
          ],
        ],
        0,
      ),
      index,
      talesModule,
    );
    expect(recoveryOf(both, 'spark')).toEqual([
      { on: 'scene', amount: 1, path: SCENE },
      { on: 'session', amount: 'all' },
    ]);
    const mixed = compute(
      ashWithSparks([[{ on: 'scene', amount: '1' }], [{ on: 'scene', amount: 'all' }]], 0),
      index,
      talesModule,
    );
    expect(recoveryOf(mixed, 'spark')).toEqual([{ on: 'scene', amount: 'all' }]);
    expect(mixed.breakdown[SCENE]).toEqual([sparkStep(1, '1', 1, 1)]);
  });

  it('gives a key two grants give the highest amount, each grant a step', () => {
    const twice = compute(
      ashWithSparks(
        [[{ on: 'scene', amount: '1' }], [{ on: 'scene', amount: '@abilities.nerve.mod + 1' }]],
        3,
      ),
      index,
      talesModule,
    );
    expect(twice.values[SCENE]).toBe(2);
    expect(twice.breakdown[SCENE]).toEqual([
      sparkStep(1, '1', 1, 1),
      sparkStep(2, '@abilities.nerve.mod + 1', 2, 1),
    ]);
    expect(recoveryOf(twice, 'spark')).toEqual([{ on: 'scene', amount: 2, path: SCENE }]);
  });

  it('counts an amount rounded down and never below 0, as a rest gives it', () => {
    const counted = (formula: string) =>
      recoveryOf(
        compute(ashWithSparks([[{ on: 'scene', amount: formula }]], 2), index, talesModule),
        'spark',
      );
    expect(counted('1.5')).toEqual([{ on: 'scene', amount: 1, path: SCENE }]);
    expect(counted('-1')).toEqual([{ on: 'scene', amount: 0, path: SCENE }]);
    expect(counted('@resources.spark.max')).toEqual([{ on: 'scene', amount: 3, path: SCENE }]);
  });

  it('warns a path an amount reads that is missing, on compute', () => {
    const computed = compute(
      ashWithSparks([[{ on: 'scene', amount: '@nope' }]], 2),
      index,
      talesModule,
    );
    expect(computed.values[SCENE]).toBe(0);
    expect(computed.warnings).toContainEqual(
      expect.objectContaining({ code: 'missingPath', path: 'nope', for: SCENE }),
    );
  });

  it('applies an effect on the amount, and a rest gives back what it says', () => {
    const more = ashWithChanges([[{ on: 'scene', amount: '1' }]], 3, [
      { id: 'more', target: SCENE, op: 'add', value: 1 },
    ]);
    const computed = compute(more, index, talesModule);
    expect(computed.values[SCENE]).toBe(2);
    expect(computed.breakdown[SCENE]).toMatchObject([
      sparkStep(1, '1', 1, 1),
      { kind: 'effect', part: 'character:talent/spark-1#more', value: 1, change: 1 },
    ]);
    expect(recoveryOf(computed, 'spark')).toEqual([{ on: 'scene', amount: 2, path: SCENE }]);
    expect(recoveredOn(more, computed, ['scene']).changes).toEqual([
      { path: SPARK, before: 3, after: 1 },
    ]);
  });

  it('lets a manual edit win, and a rest gives back what it says', () => {
    const edited = ashWithChanges(
      [[{ on: 'scene', amount: '1' }]],
      3,
      [],
      [{ path: SCENE, value: 3 }],
    );
    const computed = compute(edited, index, talesModule);
    expect(computed.values[SCENE]).toBe(3);
    expect(computed.breakdown[SCENE]?.at(-1)).toMatchObject({ kind: 'override', value: 3 });
    expect(recoveryOf(computed, 'spark')).toEqual([{ on: 'scene', amount: 3, path: SCENE }]);
    expect(recoveredOn(edited, computed, ['scene']).changes).toEqual([
      { path: SPARK, before: 3, after: 0 },
    ]);
  });
});

// ENG-61: the levels a stored condition loses on a system's recovery events, on Tales. Weary has
// levels 1 to 3 and loses 1 each `session`; lost has no levels and no recovery. Ash is weary at 1,
// its nerve modifier 1; Brook is lost. Every value is worked out by hand in ENG-61 §3.

const CONDITIONS = ['state', 'conditions'];
const WEARY = 'tales-core:condition/weary';
const LOST = 'tales-core:condition/lost';
const DIZZY = 'character:condition/dizzy';

type StoredCondition = TalesCharacter['state']['conditions'][number];
type ConditionEntity = Extract<TalesEntity, { type: 'condition' }>;

/** `character` with these stored conditions, and conditions of its own. */
function withConditions(
  character: TalesCharacter,
  conditions: StoredCondition[],
  own: ConditionEntity[] = [],
): TalesCharacter {
  return opened(
    openTalesCharacter({
      ...character,
      localEntities: [...character.localEntities, ...own],
      state: { ...character.state, conditions },
    }),
  );
}

/** A made-up condition of the character's own, levels 1 to 3 unless `maxLevel` says otherwise. */
function ownCondition(
  recovery: ConditionEntity['recovery'],
  slug = 'dizzy',
  maxLevel: number | undefined = 3,
): ConditionEntity {
  return {
    id: `character:condition/${slug}`,
    type: 'condition',
    ruleset: 'any',
    name: { en: slug },
    ...(maxLevel !== undefined && { maxLevel }),
    ...(recovery !== undefined && { recovery }),
    source: { pack: 'character' },
  };
}

/** What `character`'s conditions lose on `events`. */
function eased(character: TalesCharacter, events: readonly string[]) {
  return conditionsRecoveredOn(character, compute(character, index, talesModule), events);
}

/** Ash with its own dizzy condition at 3, which recovers by `recovery`, on `events`. */
function dizzyAt3(recovery: ConditionEntity['recovery'], events: readonly string[]) {
  return eased(withConditions(ash, [{ id: DIZZY, level: 3 }], [ownCondition(recovery)]), events);
}

describe('ENG-61 conditions lowered on recovery events', () => {
  it("lowers a stored condition's level on the events its entry names", () => {
    expect(eased(ash, ['session'])).toEqual({
      changes: [{ path: CONDITIONS, before: [{ id: WEARY, level: 1 }], after: [] }],
      warnings: [],
    });
    expect(eased(ash, ['scene'])).toEqual({ changes: [], warnings: [] });
    expect(eased(withConditions(ash, [{ id: WEARY, level: 3 }]), ['session']).changes).toEqual([
      { path: CONDITIONS, before: [{ id: WEARY, level: 3 }], after: [{ id: WEARY, level: 2 }] },
    ]);
    // Stored above its maximum of 3: lowered from 3.
    expect(eased(withConditions(ash, [{ id: WEARY, level: 5 }]), ['session']).changes).toEqual([
      { path: CONDITIONS, before: [{ id: WEARY, level: 5 }], after: [{ id: WEARY, level: 2 }] },
    ]);
  });

  it('leaves a condition whose entry has no recovery', () => {
    expect(eased(brook, ['session'])).toEqual({ changes: [], warnings: [] });
    expect(eased(brook, ['scene'])).toEqual({ changes: [], warnings: [] });
  });

  it('lowers each condition by the first of the events it names', () => {
    const both: ConditionEntity['recovery'] = [
      { on: 'scene', amount: '1' },
      { on: 'session', amount: 'all' },
    ];
    expect(dizzyAt3(both, ['scene', 'session']).changes).toEqual([
      { path: CONDITIONS, before: [{ id: DIZZY, level: 3 }], after: [{ id: DIZZY, level: 2 }] },
    ]);
    expect(dizzyAt3(both, ['session', 'scene']).changes).toEqual([
      { path: CONDITIONS, before: [{ id: DIZZY, level: 3 }], after: [] },
    ]);
  });

  it('evaluates an amount on the computed values, rounded down and never below 0', () => {
    const amount = (formula: string) => dizzyAt3([{ on: 'scene', amount: formula }], ['scene']);
    const to = (after: StoredCondition[]) => [
      { path: CONDITIONS, before: [{ id: DIZZY, level: 3 }], after },
    ];
    expect(amount('@abilities.nerve.mod').changes).toEqual(to([{ id: DIZZY, level: 2 }]));
    expect(amount('1.5').changes).toEqual(to([{ id: DIZZY, level: 2 }]));
    expect(amount('5').changes).toEqual(to([]));
    expect(amount('-1')).toEqual({ changes: [], warnings: [] });
    const missing = amount('@nope');
    expect(missing.changes).toEqual([]);
    expect(missing.warnings).toMatchObject([
      {
        code: 'conditionRecoveryFormula',
        condition: DIZZY,
        warning: { code: 'missingPath', path: 'nope' },
      },
    ]);
    expect(missing.warnings[0]?.message).toMatch(/\S/);
  });

  it('removes a condition with no levels', () => {
    const dazed = ownCondition([{ on: 'session', amount: '1' }], 'dazed', undefined);
    const character = withConditions(ash, [{ id: dazed.id }], [dazed]);
    expect(eased(character, ['session']).changes).toEqual([
      { path: CONDITIONS, before: [{ id: dazed.id }], after: [] },
    ]);
  });

  it('keeps the order, and a condition no entry matches', () => {
    const gone = 'tales-core:condition/gone';
    const character = withConditions(ash, [{ id: WEARY, level: 2 }, { id: gone }, { id: LOST }]);
    expect(eased(character, ['session'])).toEqual({
      changes: [
        {
          path: CONDITIONS,
          before: [{ id: WEARY, level: 2 }, { id: gone }, { id: LOST }],
          after: [{ id: WEARY, level: 1 }, { id: gone }, { id: LOST }],
        },
      ],
      warnings: [],
    });
  });

  it('changes nothing it is given', () => {
    const character = frozen(ash);
    const computed = frozen(compute(ash, index, talesModule));
    const events = frozen(['session']);
    expect(conditionsRecoveredOn(character, computed, events).changes).toEqual([
      { path: CONDITIONS, before: [{ id: WEARY, level: 1 }], after: [] },
    ]);
    expect(character).toEqual(ash);
  });
});
