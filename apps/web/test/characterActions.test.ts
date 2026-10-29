import 'fake-indexeddb/auto';
import { changeTo, entryOf } from '@grimoire/engine';
import type { LogEntry, RollRecord } from '@grimoire/schema';
import { fifthEditionCharacterSchema, HP_CURRENT_PATH } from '@grimoire/system-5e';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import {
  characterFileOf,
  copyCharacter,
  deleteCharacter,
  exportCharacter,
  restoreCharacter,
} from '../src/db/characterActions';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { readHistory, recordChange } from '../src/db/history';
import { logRoll, readRollLog } from '../src/db/rollLog';
import { settlesOpen, swipeOffset } from '../src/lib/swipe';
import { characterOpenerOf } from '../src/systems';

// Golden A (12 hit points) and golden B of SPEC §6.7 are the stored characters; golden A takes
// two hits and makes one roll, golden B one roll, so a delete is seen to drop only A's rows.

const a = fifthEditionCharacterSchema.parse(goldenA);
const b = fifthEditionCharacterSchema.parse(goldenB);
const at = '2026-10-01T18:00:00.000Z';
const now = '2026-10-05T09:30:00.000Z';
const COPY = '7d444840-9dc0-41d1-9a4b-4d2b1a7c0f1e';

/** The uuid of change or roll `n`. */
function idOf(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Golden A's hit points from `from` to `after`, as change `n`. */
function hurt(n: number, from: number, after: number): LogEntry {
  const character = {
    ...a,
    systemData: {
      ...a.systemData,
      state: { ...a.systemData.state, hp: { current: from, temp: 0 } },
    },
  };
  return entryOf(
    { id: idOf(n), at, by: { role: 'player', name: 'Wren' } },
    {
      action: 'applyDamage',
      subject: 'hp',
      changes: [changeTo(character, HP_CURRENT_PATH, after)],
    },
  );
}

/** Roll `n` of `actorId`: a d20 that gave 14. */
function roll(n: number, actorId: string): RollRecord {
  return {
    id: idOf(n),
    rolledAt: new Date(Date.UTC(2026, 9, 1, 18, 0, n)).toISOString(),
    by: { role: 'player', name: 'Wren', actorId },
    label: 'Sneak',
    visibility: 'public',
    total: 14,
    breakdown: [
      {
        label: 'Sneak',
        formula: '1d20',
        value: 14,
        dice: [
          { at: 0, text: '1d20', count: 1, faces: 20, results: [14], kept: [true], total: 14 },
        ],
        own: false,
      },
    ],
  };
}

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-25-${count}`);
  await database.open();
  await saveCharacter(a, database.characters);
  await saveCharacter(b, database.characters);
});

afterEach(async () => {
  await database.delete();
});

describe('SHEET-25 copy', () => {
  it('stores a copy with a new id, its name, revision 0 and the time it was made', async () => {
    await recordChange(a.id, hurt(1, 12, 9), at, database);
    const result = await copyCharacter(a.id, { id: COPY, name: 'Golden A (copy)', now }, database);
    expect(result.ok).toBe(true);
    const copy = fifthEditionCharacterSchema.parse(await database.characters.get(COPY));
    expect(copy.name).toBe('Golden A (copy)');
    expect(copy.rev).toBe(0);
    expect(copy.createdAt).toBe(now);
    expect(copy.updatedAt).toBe(now);
    // Everything else is the original's as stored now: 9 hit points after the hit.
    expect(copy.systemData.state.hp.current).toBe(9);
    const stored = fifthEditionCharacterSchema.parse(await database.characters.get(a.id));
    const { id: _, name: __, rev: ___, createdAt: ____, updatedAt: _____, ...rest } = copy;
    expect(stored).toMatchObject(rest);
    // The original stays, and its changes stay its own.
    expect(stored.rev).toBe(1);
    expect((await readHistory(COPY, database)).entries).toEqual([]);
    expect((await readHistory(a.id, database)).entries).toHaveLength(1);
    expect(await database.characters.count()).toBe(3);
  });

  it('copies nothing for an id no row has', async () => {
    expect(await copyCharacter(COPY, { name: 'X' }, database)).toMatchObject({
      ok: false,
      code: 'notFound',
    });
    expect(await database.characters.count()).toBe(2);
  });
});

describe('SHEET-25 export', () => {
  it('gives the stored character as JSON that opens to the same character', async () => {
    const result = await exportCharacter(b.id, database);
    if (!result.ok) throw new Error(result.message);
    expect(result.file.name).toBe(`${b.name}.json`);
    expect(result.file.text.endsWith('}\n')).toBe(true);
    const opened = characterOpenerOf('5e')?.(JSON.parse(result.file.text));
    expect(opened).toMatchObject({ ok: true, value: b });
  });

  it('keeps a file name the device can save, or the id when the name has nothing else', () => {
    expect(characterFileOf({ ...a, name: 'Iren: the "Bold" / 2' }).name).toBe(
      'Iren the Bold 2.json',
    );
    expect(characterFileOf({ ...a, name: '???' }).name).toBe(`${a.id}.json`);
  });

  it('exports nothing for an id no row has', async () => {
    expect(await exportCharacter(COPY, database)).toMatchObject({ ok: false, code: 'notFound' });
  });
});

describe('SHEET-25 delete and its undo', () => {
  beforeEach(async () => {
    await recordChange(a.id, hurt(1, 12, 9), at, database);
    await recordChange(a.id, hurt(2, 9, 7), at, database);
    await logRoll(roll(3, a.id), database.rollLog);
    await logRoll(roll(4, b.id), database.rollLog);
  });

  it("drops the character, its changes and its rolls, and no other character's", async () => {
    const stored = await database.characters.get(a.id);
    const result = await deleteCharacter(a.id, database);
    if (!result.ok) throw new Error(result.message);
    expect(result.deleted.character).toEqual(stored);
    expect(result.deleted.history.map((row) => row.id)).toEqual([idOf(1), idOf(2)]);
    expect(result.deleted.rolls.map((row) => row.id)).toEqual([idOf(3)]);
    expect(await openCharacter(a.id, database.characters)).toMatchObject({ code: 'notFound' });
    expect(await database.history.count()).toBe(0);
    expect((await readRollLog(a.id, database.rollLog)).rolls).toEqual([]);
    expect((await readRollLog(b.id, database.rollLog)).rolls).toEqual([roll(4, b.id)]);
    expect(await database.characters.get(b.id)).toEqual(b);
  });

  it('puts every dropped row back as it was', async () => {
    const before = {
      character: await database.characters.get(a.id),
      history: await database.history.toArray(),
      rolls: await database.rollLog.toArray(),
    };
    const result = await deleteCharacter(a.id, database);
    if (!result.ok) throw new Error(result.message);
    expect(await restoreCharacter(result.deleted, database)).toEqual({ ok: true });
    expect(await database.characters.get(a.id)).toEqual(before.character);
    expect(await database.history.toArray()).toEqual(before.history);
    expect(await database.rollLog.toArray()).toEqual(before.rolls);
    // The kept changes still undo: the history is whole again.
    expect((await readHistory(a.id, database)).entries.map((entry) => entry.id)).toEqual([
      idOf(2),
      idOf(1),
    ]);
  });

  it('puts nothing back over a character stored with the same id again', async () => {
    const result = await deleteCharacter(a.id, database);
    if (!result.ok) throw new Error(result.message);
    await saveCharacter({ ...a, name: 'Saved again' }, database.characters);
    expect(await restoreCharacter(result.deleted, database)).toMatchObject({
      ok: false,
      code: 'taken',
      id: a.id,
    });
    expect((await database.characters.get(a.id))?.name).toBe('Saved again');
    expect(await database.history.count()).toBe(0);
  });

  it('deletes nothing for an id no row has', async () => {
    expect(await deleteCharacter(COPY, database)).toMatchObject({ ok: false, code: 'notFound' });
    expect(await database.characters.count()).toBe(2);
    expect(await database.history.count()).toBe(2);
  });
});

describe('SHEET-25 the swipe', () => {
  it('follows the finger between closed and the tray, and settles open past half', () => {
    expect(swipeOffset(0, -100, 240)).toBe(-100);
    expect(swipeOffset(0, -400, 240)).toBe(-240);
    expect(swipeOffset(0, 50, 240)).toBe(0);
    expect(swipeOffset(-240, 100, 240)).toBe(-140);
    expect(settlesOpen(-120, 240)).toBe(true);
    expect(settlesOpen(-119, 240)).toBe(false);
  });
});
