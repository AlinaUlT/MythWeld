import 'fake-indexeddb/auto';
import { changeTo, entryOf } from '@grimoire/engine';
import { historyRowOf, type LogEntry } from '@grimoire/schema';
import { fifthEditionCharacterSchema, HP_CURRENT_PATH, HP_TEMP_PATH } from '@grimoire/system-5e';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { HISTORY_LIMIT, readHistory, recordChange, undoChange } from '../src/db/history';
import type { AppCharacter } from '../src/systems';

// Golden A (12 hit points, rev 0) and golden C (30 hit points) of SPEC §6.7 are the stored
// characters. Change n is made n minutes after 18:00, so its id and its time both name its place;
// each takes one hit point or sets the temporary ones, by hand, as a screen's action would.

const a = fifthEditionCharacterSchema.parse(goldenA);
const c = fifthEditionCharacterSchema.parse(goldenC2014);

/** The uuid of change `n`. */
function idOf(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** The time of change `n`. */
function timeOf(n: number): string {
  return new Date(Date.UTC(2026, 9, 1, 18, n)).toISOString();
}

/** Change `n` to `character`: the place `path` set to `after`. */
function change(n: number, character: AppCharacter, path: string[], after: number): LogEntry {
  return entryOf(
    { id: idOf(n), at: timeOf(n), by: { role: 'player', name: 'Wren' } },
    { action: 'applyDamage', subject: 'hp', changes: [changeTo(character, path, after)] },
  );
}

/** The current hit points stored for `id`. */
async function hpOf(id: string): Promise<number> {
  return fifthEditionCharacterSchema.parse(await database.characters.get(id)).systemData.state.hp
    .current;
}

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-23-${count}`);
  await database.open();
  await saveCharacter(a, database.characters);
  await saveCharacter(c, database.characters);
});

afterEach(async () => {
  await database.delete();
});

describe('SHEET-23 the history', () => {
  it('applies a change to the stored character, one revision on, and keeps its entry', async () => {
    const entry = change(1, a, HP_CURRENT_PATH, 11);
    const result = await recordChange(a.id, entry, timeOf(2), database);
    const changed = {
      ...a,
      rev: 1,
      updatedAt: timeOf(2),
      systemData: {
        ...a.systemData,
        state: { ...a.systemData.state, hp: { current: 11, temp: 0 } },
      },
    };
    expect(result).toEqual({ ok: true, character: changed, entry });
    expect(await database.characters.get(a.id)).toEqual(changed);
    expect(await database.history.toArray()).toEqual([historyRowOf(a.id, entry)]);
    expect(await readHistory(a.id, database)).toEqual({ entries: [entry], refused: [] });
  });

  it('keeps the last 50 changes of a character, newest first', async () => {
    for (let n = 1; n <= 51; n += 1) {
      const stored = fifthEditionCharacterSchema.parse(await database.characters.get(a.id));
      const result = await recordChange(
        a.id,
        change(n, stored, HP_TEMP_PATH, n),
        timeOf(n),
        database,
      );
      expect(result.ok).toBe(true);
    }
    expect(HISTORY_LIMIT).toBe(50);
    expect(await database.history.count()).toBe(50);
    expect(await database.history.get(idOf(1))).toBeUndefined();
    const { entries } = await readHistory(a.id, database);
    expect(entries.map(({ id }) => id)).toEqual(
      Array.from({ length: 50 }, (_, index) => idOf(51 - index)),
    );
    expect((await database.characters.get(a.id))?.rev).toBe(51);
  });

  it("drops none of another character's changes", async () => {
    expect(
      (await recordChange(c.id, change(100, c, HP_CURRENT_PATH, 29), timeOf(0), database)).ok,
    ).toBe(true);
    for (let n = 1; n <= 51; n += 1) {
      const stored = fifthEditionCharacterSchema.parse(await database.characters.get(a.id));
      await recordChange(a.id, change(n, stored, HP_TEMP_PATH, n), timeOf(n), database);
    }
    expect(await database.history.count()).toBe(51);
    expect((await readHistory(c.id, database)).entries.map(({ id }) => id)).toEqual([idOf(100)]);
  });

  it('refuses a change made over a newer one, and writes nothing', async () => {
    await recordChange(a.id, change(1, a, HP_CURRENT_PATH, 11), timeOf(1), database);
    // Made from the screen's copy before change 1: 12 to 10, but the store holds 11.
    const result = await recordChange(a.id, change(2, a, HP_CURRENT_PATH, 10), timeOf(2), database);
    expect(result).toMatchObject({ ok: false, code: 'changed', expected: 12, found: 11 });
    expect(await hpOf(a.id)).toBe(11);
    expect((await database.characters.get(a.id))?.rev).toBe(1);
    expect(await database.history.count()).toBe(1);
  });

  it('refuses a change to no stored character, a broken entry, or a result the schema refuses', async () => {
    const missing = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
    expect(
      await recordChange(missing, change(1, a, HP_CURRENT_PATH, 11), timeOf(1), database),
    ).toMatchObject({ ok: false, code: 'notFound', id: missing });
    const broken = { ...change(1, a, HP_CURRENT_PATH, 11), id: 'change-1' };
    expect(await recordChange(a.id, broken, timeOf(1), database)).toMatchObject({
      ok: false,
      code: 'badEntry',
    });
    // Hit points of one and a half: a JSON value, but not one the character's schema takes.
    expect(
      await recordChange(a.id, change(1, a, HP_CURRENT_PATH, 1.5), timeOf(1), database),
    ).toMatchObject({ ok: false, code: 'invalid' });
    expect(await database.characters.get(a.id)).toEqual(a);
    expect(await database.history.count()).toBe(0);
  });

  it('undoes a kept change, one revision on, and drops it from the history', async () => {
    const entry = change(1, a, HP_CURRENT_PATH, 11);
    await recordChange(a.id, entry, timeOf(1), database);
    const result = await undoChange(entry.id, timeOf(2), database);
    const undone = { ...a, rev: 2, updatedAt: timeOf(2) };
    expect(result).toEqual({ ok: true, character: undone, entry });
    expect(await database.characters.get(a.id)).toEqual(undone);
    expect(await database.history.count()).toBe(0);
    expect(await undoChange(entry.id, timeOf(3), database)).toMatchObject({
      ok: false,
      code: 'noEntry',
      id: entry.id,
    });
  });

  it('refuses to undo a change a later one wrote over, and writes nothing', async () => {
    const first = change(1, a, HP_CURRENT_PATH, 11);
    await recordChange(a.id, first, timeOf(1), database);
    const stored = fifthEditionCharacterSchema.parse(await database.characters.get(a.id));
    await recordChange(a.id, change(2, stored, HP_CURRENT_PATH, 10), timeOf(2), database);
    expect(await undoChange(first.id, timeOf(3), database)).toMatchObject({
      ok: false,
      code: 'changed',
      expected: 11,
      found: 10,
    });
    expect(await hpOf(a.id)).toBe(10);
    expect((await database.characters.get(a.id))?.rev).toBe(2);
    expect(await database.history.count()).toBe(2);
  });

  it('lists a newer row as refused, and leaves it as it was', async () => {
    const entry = change(1, a, HP_CURRENT_PATH, 11);
    await recordChange(a.id, entry, timeOf(1), database);
    const newer = { ...historyRowOf(a.id, change(2, a, HP_TEMP_PATH, 5)), schemaVersion: 2 };
    await database.history.put(newer);
    expect(await readHistory(a.id, database)).toEqual({
      entries: [entry],
      refused: [{ id: idOf(2), code: 'newer', message: expect.any(String) }],
    });
    expect(await undoChange(idOf(2), timeOf(3), database)).toMatchObject({
      ok: false,
      code: 'badEntry',
    });
    expect(await database.history.get(idOf(2))).toEqual(newer);
  });
});

describe('SHEET-53 the alignment is written through the history', () => {
  const written = (n: number, character: AppCharacter, after: string | undefined) =>
    entryOf(
      { id: idOf(n), at: timeOf(n), by: { role: 'player', name: 'Wren' } },
      {
        action: 'setAlignment',
        subject: 'alignment',
        changes: [changeTo(character, ['systemData', 'alignment'], after)],
      },
    );

  it('sets the alignment, changes it, clears it, and undoes each', async () => {
    const stored = async () =>
      fifthEditionCharacterSchema.parse(await database.characters.get(a.id)).systemData.alignment;
    expect(await stored()).toBeUndefined();

    const first = await recordChange(a.id, written(1, a, 'Neutral good'), timeOf(1), database);
    expect(first.ok).toBe(true);
    expect(await stored()).toBe('Neutral good');

    const current = fifthEditionCharacterSchema.parse(await database.characters.get(a.id));
    expect((await recordChange(a.id, written(2, current, undefined), timeOf(2), database)).ok).toBe(
      true,
    );
    expect(await stored()).toBeUndefined();

    expect((await undoChange(idOf(2), timeOf(3), database)).ok).toBe(true);
    expect(await stored()).toBe('Neutral good');
    expect((await undoChange(idOf(1), timeOf(4), database)).ok).toBe(true);
    expect(await stored()).toBeUndefined();
  });
});
