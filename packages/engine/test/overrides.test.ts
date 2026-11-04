import {
  applyEntry,
  clearOverride,
  compute,
  type LogStamp,
  loadContentIndex,
  reverseEntry,
  setOverride,
} from '@grimoire/engine';
import { logEntrySchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import {
  ash as ashFile,
  openTalesCharacter,
  openTalesPack,
  type TalesCharacter,
  talesCore,
} from '../../schema/test/tales/index.ts';
import { talesModule } from './tales-module.ts';

// SHEET-34: the manual edit as an action, on Tales' Ash (ENG-27), the made-up test system. Ash's
// wits score is 5 with a modifier of 2 (floor(5 / 2)); with the score set to 12 by hand the
// modifier is floor(12 / 2) = 6, `nimble` adds the wits modifier to climbing, and climbing is grit
// modifier 3 + 2 × 1 + 6 - 1 = 10 (ENG-17's test of the same edit has the same 12 and 6). Without
// the edit climbing is 6 (ENG-27's expected values).

function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const { index } = loadContentIndex('tales', [opened(openTalesPack(talesCore))]);
const ash = opened(openTalesCharacter(ashFile));
const computed = (character: TalesCharacter) => compute(character, index, talesModule);
const stamp: LogStamp = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  at: '2026-11-04T12:00:00.000Z',
  by: { role: 'player', name: 'Wren' },
};

const WITS = 'abilities.wits.score';

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result).toMatchObject({ ok: true });
  return result as Extract<T, { ok: true }>;
}

describe('SHEET-34 setOverride', () => {
  const before = computed(ash);

  it('stores the edit, one entry that changes the list of edits, and every number follows', () => {
    expect(before.values[WITS]).toBe(5);
    expect(before.values['skills.climb.total']).toBe(6);
    const made = ok(
      setOverride(ash, before, { path: WITS, value: 12, note: 'Belt of power' }, stamp),
    );
    expect(made.character.overrides).toEqual([{ path: WITS, value: 12, note: 'Belt of power' }]);
    expect(made.entry).toMatchObject({ action: 'setOverride', subject: WITS });
    expect(made.entry.changes).toEqual([
      {
        path: ['overrides'],
        before: [],
        after: [{ path: WITS, value: 12, note: 'Belt of power' }],
      },
    ]);
    expect(logEntrySchema.safeParse(made.entry).success).toBe(true);
    const after = computed(made.character);
    expect(after.values[WITS]).toBe(12);
    expect(after.values['abilities.wits.mod']).toBe(6);
    expect(after.values['skills.climb.total']).toBe(10);
    // The breakdown labels it as a manual edit (step "override", SPEC §6.1 step 7).
    expect(after.breakdown[WITS]?.at(-1)).toMatchObject({ kind: 'override', value: 12, change: 7 });
    expect(after.warnings).toEqual([]);
  });

  it('replaces the edit of the same path where it stands and keeps the others', () => {
    const first = ok(setOverride(ash, before, { path: WITS, value: 12 }, stamp)).character;
    const both = ok(
      setOverride(first, computed(first), { path: 'abilities.grit.score', value: 9 }, stamp),
    ).character;
    const again = ok(
      setOverride(both, computed(both), { path: WITS, value: 14, note: '  Wish  ' }, stamp),
    ).character;
    expect(again.overrides).toEqual([
      { path: WITS, value: 14, note: 'Wish' },
      { path: 'abilities.grit.score', value: 9 },
    ]);
  });

  it('leaves the note out when it shows no character', () => {
    const made = ok(setOverride(ash, before, { path: WITS, value: 12, note: '   ' }, stamp));
    expect(made.character.overrides).toEqual([{ path: WITS, value: 12 }]);
  });

  it('refuses a path with no number, the level, and a value that is not a number', () => {
    expect(setOverride(ash, before, { path: 'no.such.path', value: 1 }, stamp)).toMatchObject({
      ok: false,
      code: 'notANumber',
    });
    expect(setOverride(ash, before, { path: 'constructor', value: 1 }, stamp)).toMatchObject({
      ok: false,
      code: 'notANumber',
    });
    expect(setOverride(ash, before, { path: 'level', value: 5 }, stamp)).toMatchObject({
      ok: false,
      code: 'fixedPath',
    });
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(setOverride(ash, before, { path: WITS, value }, stamp)).toMatchObject({
        ok: false,
        code: 'badValue',
      });
    }
  });

  it('refuses the same edit again as unchanged', () => {
    const made = ok(setOverride(ash, before, { path: WITS, value: 12, note: 'Belt' }, stamp));
    expect(
      setOverride(
        made.character,
        computed(made.character),
        { path: WITS, value: 12, note: 'Belt' },
        stamp,
      ),
    ).toMatchObject({ ok: false, code: 'unchanged' });
  });

  it('its entry applies again and reverses to the character it came from', () => {
    const made = ok(setOverride(ash, before, { path: WITS, value: 12 }, stamp));
    expect(ok(applyEntry(ash, made.entry)).character).toEqual(made.character);
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(ash);
  });
});

describe('SHEET-34 clearOverride', () => {
  it('takes the edit away and the computed numbers come back', () => {
    const edited = ok(setOverride(ash, computed(ash), { path: WITS, value: 12 }, stamp)).character;
    const made = ok(clearOverride(edited, WITS, stamp));
    expect(made.character.overrides).toEqual([]);
    expect(made.entry).toMatchObject({ action: 'clearOverride', subject: WITS });
    expect(computed(made.character).values[WITS]).toBe(5);
    expect(computed(made.character).values['skills.climb.total']).toBe(6);
    expect(ok(reverseEntry(made.character, made.entry)).character).toEqual(edited);
  });

  it('refuses a path that has no edit', () => {
    expect(clearOverride(ash, WITS, stamp)).toMatchObject({ ok: false, code: 'noOverride' });
  });
});
