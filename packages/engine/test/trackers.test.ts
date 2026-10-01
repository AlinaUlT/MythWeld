import {
  type ActionResult,
  applyEntry,
  compute,
  type LogStamp,
  loadContentIndex,
  regainResource,
  removeCondition,
  resourceUses,
  reverseEntry,
  setCondition,
  setToggle,
  useResource,
} from '@grimoire/engine';
import { type LogEntry, logEntrySchema } from '@grimoire/schema';
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

// Tales, the made-up test system (ENG-27). Ash: luck max 2 (nerve mod 1 + 1) with 1 used, Weary
// at level 1 (of 3), Night Warden's `glow` off by default. Brook: focus max 6 (level 3 × 2) with
// none used, Lost (no levels), its own `charm` on. Every value after a change is worked out by
// hand from Tales' rules (`tales/system.ts`) and ENG-27's expected values.

/** The value of an opener's result, or a failed test naming why it did not open. */
function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const pack = opened(openTalesPack(talesCore));
const { index } = loadContentIndex('tales', [pack]);
const ash = opened(openTalesCharacter(ashFile));
const brook = opened(openTalesCharacter(brookFile));
const computed = (character: TalesCharacter) => compute(character, index, talesModule);

const stamp: LogStamp = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  at: '2026-10-01T18:30:00.000Z',
  by: { role: 'player', name: 'Wren' },
};

const WEARY = 'tales-core:condition/weary';
const LOST = 'tales-core:condition/lost';
const GLOW = 'tales-core:talent/night-warden#glow';
const CHARM = 'character:talent/lucky-charm#charm';
const LUCK = ['state', 'resources', 'luck'];

/** A result that changed the character; a failed test with its message when it did not. */
function changed<C>(result: ActionResult<C>) {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  expect(logEntrySchema.parse(result.entry)).toEqual(result.entry);
  return result;
}

/** A refusal, of an action or of applying an entry, without its log message. */
function refusal(result: { ok: true } | { ok: false; code: string; message: string }) {
  if (result.ok) throw new Error('It ran.');
  const { message, ...rest } = result;
  expect(message).toMatch(/\S/);
  return rest;
}

/** The entry's fields other than `stamp`'s, after checking those are `stamp`'s. */
function made(entry: LogEntry) {
  const { id, at, by, ...rest } = entry;
  expect({ id, at, by }).toEqual(stamp);
  return rest;
}

/** Ash with talents of its own, each granting a resource of this maximum. */
function ashWith(resources: [key: string, max: string][]): TalesCharacter {
  const talents: TalesEntity[] = resources.map(([key, max]) => ({
    id: `character:talent/${key.toLowerCase()}`,
    type: 'talent',
    ruleset: 'any',
    name: { en: key },
    tier: 1,
    grants: [
      {
        id: 'uses',
        kind: 'resource',
        key,
        label: { en: key },
        uses: { max, recovery: [{ on: 'scene', amount: 'all' }] },
      },
    ],
    source: { pack: 'character' },
  }));
  return opened(
    openTalesCharacter({
      ...ash,
      localEntities: talents,
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

describe('ENG-30 tracker actions', () => {
  it("counts a resource's uses left from its maximum and the uses spent", () => {
    expect(resourceUses(ash, computed(ash), 'luck')).toEqual({ max: 2, spent: 1, left: 1 });
    expect(resourceUses(brook, computed(brook), 'focus')).toEqual({ max: 6, spent: 0, left: 6 });
    expect(resourceUses(brook, computed(brook), 'breath')).toBeUndefined();
    const odd = ashWith([
      ['spark', '2.5'],
      ['dark', '-1'],
    ]);
    expect(resourceUses(odd, computed(odd), 'spark')).toEqual({ max: 2.5, spent: 0, left: 2 });
    expect(resourceUses(odd, computed(odd), 'dark')).toEqual({ max: -1, spent: 0, left: 0 });
  });

  it('spends uses that are left, and refuses the rest', () => {
    const used = changed(useResource(ash, computed(ash), { key: 'luck', count: 1 }, stamp));
    expect(used.character.state.resources).toEqual({ luck: 2 });
    expect(made(used.entry)).toEqual({
      action: 'useResource',
      subject: 'luck',
      label: { en: 'Luck' },
      changes: [{ path: LUCK, before: 1, after: 2 }],
    });
    const once = { key: 'luck', count: 1 };
    const again = useResource(used.character, computed(used.character), once, stamp);
    expect(refusal(again)).toEqual({
      ok: false,
      code: 'notEnough',
      key: 'luck',
      left: 0,
      count: 1,
    });

    const focus = changed(useResource(brook, computed(brook), { key: 'focus', count: 2 }, stamp));
    expect(focus.entry.changes).toEqual([{ path: ['state', 'resources', 'focus'], after: 2 }]);
    expect(refusal(useResource(brook, computed(brook), { key: 'focus', count: 7 }, stamp))).toEqual(
      { ok: false, code: 'notEnough', key: 'focus', left: 6, count: 7 },
    );

    for (const count of [0, -1, 1.5]) {
      expect(refusal(useResource(ash, computed(ash), { key: 'luck', count }, stamp))).toEqual({
        ok: false,
        code: 'badCount',
        count,
      });
    }
    expect(
      refusal(useResource(brook, computed(brook), { key: 'breath', count: 1 }, stamp)),
    ).toEqual({ ok: false, code: 'noResource', key: 'breath' });

    const odd = ashWith([
      ['spark', '2.5'],
      ['dark', '-1'],
    ]);
    const spark = changed(useResource(odd, computed(odd), { key: 'spark', count: 2 }, stamp));
    expect(spark.character.state.resources).toEqual({ luck: 1, spark: 2 });
    expect(
      refusal(useResource(odd, computed(odd), { key: 'spark', count: 3 }, stamp)),
    ).toMatchObject({ code: 'notEnough', left: 2 });
    expect(
      refusal(useResource(odd, computed(odd), { key: 'dark', count: 1 }, stamp)),
    ).toMatchObject({ code: 'notEnough', left: 0 });
  });

  it('gives uses back, never below none spent', () => {
    for (const amount of [1, 'all', 5] as const) {
      const regained = changed(regainResource(ash, computed(ash), { key: 'luck', amount }, stamp));
      expect(made(regained.entry), String(amount)).toEqual({
        action: 'regainResource',
        subject: 'luck',
        label: { en: 'Luck' },
        changes: [{ path: LUCK, before: 1, after: 0 }],
      });
    }
    expect(
      refusal(regainResource(brook, computed(brook), { key: 'focus', amount: 1 }, stamp)),
    ).toEqual({ ok: false, code: 'unchanged' });
    for (const amount of [0, 1.5]) {
      expect(refusal(regainResource(ash, computed(ash), { key: 'luck', amount }, stamp))).toEqual({
        ok: false,
        code: 'badCount',
        count: amount,
      });
    }

    const kept = opened(
      openTalesCharacter({ ...ash, state: { ...ash.state, resources: { luck: 1, old: 2 } } }),
    );
    const old = changed(regainResource(kept, computed(kept), { key: 'old', amount: 'all' }, stamp));
    expect(made(old.entry)).toEqual({
      action: 'regainResource',
      subject: 'old',
      changes: [{ path: ['state', 'resources', 'old'], before: 2, after: 0 }],
    });
  });

  it("sets a condition's level, or adds the condition, as its levels allow", () => {
    const weary = changed(setCondition(ash, index, { id: WEARY, level: 2 }, stamp));
    expect(made(weary.entry)).toEqual({
      action: 'setCondition',
      subject: WEARY,
      label: { en: 'Weary' },
      changes: [
        {
          path: ['state', 'conditions'],
          before: [{ id: WEARY, level: 1 }],
          after: [{ id: WEARY, level: 2 }],
        },
      ],
    });
    // wits mod 2 + 2 × knack 1 + `shadow` 1 - Weary 2
    expect(computed(weary.character).values['skills.sneak.total']).toBe(3);

    const lost = changed(setCondition(ash, index, { id: LOST }, stamp));
    expect(lost.character.state.conditions).toEqual([{ id: WEARY, level: 1 }, { id: LOST }]);

    expect(refusal(setCondition(ash, index, { id: WEARY, level: 4 }, stamp))).toEqual({
      ok: false,
      code: 'badLevel',
      id: WEARY,
      level: 4,
      max: 3,
    });
    expect(refusal(setCondition(ash, index, { id: LOST, level: 2 }, stamp))).toMatchObject({
      code: 'badLevel',
      max: 1,
    });
    for (const level of [0, 1.5]) {
      expect(refusal(setCondition(ash, index, { id: WEARY, level }, stamp))).toMatchObject({
        code: 'badLevel',
        level,
      });
    }
    expect(refusal(setCondition(ash, index, { id: WEARY, level: 1 }, stamp))).toEqual({
      ok: false,
      code: 'unchanged',
    });
    expect(refusal(setCondition(ash, index, { id: 'tales-core:condition/gone' }, stamp))).toEqual({
      ok: false,
      code: 'missing',
      id: 'tales-core:condition/gone',
    });
    const talent = 'tales-core:talent/quick-step';
    expect(refusal(setCondition(ash, index, { id: talent }, stamp))).toEqual({
      ok: false,
      code: 'notACondition',
      id: talent,
      type: 'talent',
    });
  });

  it('takes a condition away, its entry found or not', () => {
    const rested = changed(removeCondition(ash, index, { id: WEARY }, stamp));
    expect(made(rested.entry)).toEqual({
      action: 'removeCondition',
      subject: WEARY,
      label: { en: 'Weary' },
      changes: [{ path: ['state', 'conditions'], before: [{ id: WEARY, level: 1 }], after: [] }],
    });
    // wits mod 2 + 2 × knack 1 + `shadow` 1
    expect(computed(rested.character).values['skills.sneak.total']).toBe(5);
    expect(refusal(removeCondition(ash, index, { id: LOST }, stamp))).toEqual({
      ok: false,
      code: 'unchanged',
    });

    const gone = 'tales-core:condition/gone';
    const haunted = opened(
      openTalesCharacter({ ...ash, state: { ...ash.state, conditions: [{ id: gone }] } }),
    );
    const cleared = changed(removeCondition(haunted, index, { id: gone }, stamp));
    expect(made(cleared.entry)).toEqual({
      action: 'removeCondition',
      subject: gone,
      changes: [{ path: ['state', 'conditions'], before: [{ id: gone }], after: [] }],
    });
  });

  it('sets the switch of a toggled effect the character has', () => {
    const glowing = changed(setToggle(ash, computed(ash), { part: GLOW, on: true }, stamp));
    expect(made(glowing.entry)).toEqual({
      action: 'setToggle',
      subject: GLOW,
      label: { en: 'Glowing' },
      changes: [{ path: ['state', 'toggles', GLOW], after: true }],
    });
    const values = computed(glowing.character).values;
    expect(values['abilities.grit.score']).toBe(8); // base 6 + `sturdy` 1 + `glow` 1
    expect(values['skills.climb.total']).toBe(7); // grit mod 4 + 2 × 1 + `nimble` 2 - Weary 1

    expect(refusal(setToggle(ash, computed(ash), { part: GLOW, on: false }, stamp))).toEqual({
      ok: false,
      code: 'unchanged',
    });
    const held = changed(setToggle(brook, computed(brook), { part: CHARM, on: false }, stamp));
    expect(made(held.entry)).toEqual({
      action: 'setToggle',
      subject: CHARM,
      label: { en: 'Held' },
      changes: [{ path: ['state', 'toggles', CHARM], before: true, after: false }],
    });
    const shadow = 'tales-core:talent/night-warden#shadow';
    for (const [character, part] of [
      [ash, shadow],
      [brook, GLOW],
    ] as const) {
      expect(refusal(setToggle(character, computed(character), { part, on: true }, stamp))).toEqual(
        { ok: false, code: 'noToggle', part },
      );
    }
  });

  it('reverses each action, back to the character before it, sharing what did not change', () => {
    const odd = ashWith([['spark', '2.5']]);
    const actions: [string, TalesCharacter, ActionResult<TalesCharacter>][] = [
      ['use luck', ash, useResource(ash, computed(ash), { key: 'luck', count: 1 }, stamp)],
      ['use focus', brook, useResource(brook, computed(brook), { key: 'focus', count: 2 }, stamp)],
      ['use spark', odd, useResource(odd, computed(odd), { key: 'spark', count: 2 }, stamp)],
      ['regain', ash, regainResource(ash, computed(ash), { key: 'luck', amount: 'all' }, stamp)],
      ['level', ash, setCondition(ash, index, { id: WEARY, level: 3 }, stamp)],
      ['add', ash, setCondition(ash, index, { id: LOST }, stamp)],
      ['remove', brook, removeCondition(brook, index, { id: LOST }, stamp)],
      ['on', ash, setToggle(ash, computed(ash), { part: GLOW, on: true }, stamp)],
      ['off', brook, setToggle(brook, computed(brook), { part: CHARM, on: false }, stamp)],
    ];
    for (const [name, before, result] of actions) {
      const { character, entry } = changed(result);
      expect(reverseEntry(character, entry), name).toStrictEqual({ ok: true, character: before });
      expect(applyEntry(before, entry), name).toStrictEqual({ ok: true, character });
      expect(character.abilities, name).toBe(before.abilities);
      expect(character.systemData, name).toBe(before.systemData);
      expect(character.state, name).not.toBe(before.state);
    }
  });

  it('refuses to apply or reverse over a value that changed since', () => {
    const used = changed(useResource(ash, computed(ash), { key: 'luck', count: 1 }, stamp));
    const all = { key: 'luck', amount: 'all' } as const;
    const regained = changed(regainResource(used.character, computed(used.character), all, stamp));
    expect(refusal(reverseEntry(regained.character, used.entry))).toEqual({
      ok: false,
      code: 'changed',
      path: LUCK,
      expected: 2,
      found: 0,
    });
    expect(refusal(applyEntry(regained.character, used.entry))).toEqual({
      ok: false,
      code: 'changed',
      path: LUCK,
      expected: 1,
      found: 0,
    });
  });

  it('applies a pending entry later, its value after edited', () => {
    const pending = changed(useResource(brook, computed(brook), { key: 'focus', count: 2 }, stamp));
    const changes = pending.entry.changes.map((change) => ({ ...change, after: 3 }));
    const edited = { ...pending.entry, changes };
    expect(logEntrySchema.safeParse(edited).success).toBe(true);
    const applied = applyEntry(brook, edited);
    expect(applied.ok && applied.character.state.resources).toEqual({ focus: 3 });

    const spent = opened(
      openTalesCharacter({ ...brook, state: { ...brook.state, resources: { focus: 1 } } }),
    );
    expect(refusal(applyEntry(spent, edited))).toStrictEqual({
      ok: false,
      code: 'changed',
      path: ['state', 'resources', 'focus'],
      found: 1,
    });
  });

  it('compares values as JSON: fields in any order', () => {
    const sent = {
      ...stamp,
      action: 'setCondition',
      subject: WEARY,
      changes: [
        {
          path: ['state', 'conditions'],
          before: [{ level: 1, id: WEARY }],
          after: [{ level: 2, id: WEARY }],
        },
      ],
    };
    const applied = applyEntry(ash, logEntrySchema.parse(sent));
    expect(applied.ok && applied.character.state.conditions).toEqual([{ id: WEARY, level: 2 }]);
  });

  it('refuses a path that is not a place in the character, and never reaches a prototype', () => {
    const at = (path: string[]) =>
      ({ ...stamp, action: 'test', subject: 'test', changes: [{ path, after: 1 }] }) as LogEntry;
    for (const path of [
      [...LUCK, 'x'],
      ['name', 'x'],
      ['nothing', 'here'],
      ['state', 'conditions', '0'],
      [],
      ['state', ''],
      ['__proto__', 'polluted'],
      ['state', '__proto__'],
      ['state', '__proto__', 'polluted'],
      ['constructor', 'prototype', 'polluted'],
    ]) {
      expect(refusal(applyEntry(ash, at(path))), path.join('.')).toEqual({
        ok: false,
        code: 'badPath',
        path,
      });
      expect(refusal(reverseEntry(ash, at(path))).code, path.join('.')).toBe('badPath');
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('changes nothing it is given', () => {
    const ashNow = frozen(ash);
    const brookNow = frozen(brook);
    const ashComputed = frozen(computed(ash));
    const brookComputed = frozen(computed(brook));
    const stampNow = frozen(stamp);
    const results = [
      useResource(ashNow, ashComputed, { key: 'luck', count: 1 }, stampNow),
      useResource(brookNow, brookComputed, { key: 'focus', count: 2 }, stampNow),
      regainResource(ashNow, ashComputed, { key: 'luck', amount: 1 }, stampNow),
      setCondition(ashNow, index, { id: WEARY, level: 2 }, stampNow),
      setCondition(ashNow, index, { id: LOST }, stampNow),
      removeCondition(ashNow, index, { id: WEARY }, stampNow),
      setToggle(ashNow, ashComputed, { part: GLOW, on: true }, stampNow),
      setToggle(brookNow, brookComputed, { part: CHARM, on: false }, stampNow),
    ];
    for (const result of results) {
      const { character, entry } = changed(result);
      const entryNow = frozen(entry);
      const back = reverseEntry(frozen(character), entryNow);
      expect(back.ok).toBe(true);
      expect(applyEntry(back.ok ? back.character : ashNow, entryNow).ok).toBe(true);
      expect(entryNow).toEqual(entry);
    }
    expect(ashNow).toEqual(ash);
    expect(brookNow).toEqual(brook);
    expect(ashComputed).toEqual(computed(ash));
    expect(brookComputed).toEqual(computed(brook));
    expect(stampNow).toEqual(stamp);
  });
});
