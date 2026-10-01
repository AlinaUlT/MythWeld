import { type LogEntry, logEntrySchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';

// A made-up game's change (ADR 004 item 4): Wren spends one luck, 1 used before, 2 after.
const entry = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  at: '2026-10-01T18:30:00.000Z',
  by: { role: 'player', name: 'Wren' },
  action: 'useResource',
  subject: 'luck',
  label: { en: 'Luck' },
  changes: [{ path: ['state', 'resources', 'luck'], before: 1, after: 2 }],
} satisfies LogEntry;

/** The entry with these changes. */
function withChanges(...changes: unknown[]) {
  return { ...entry, changes };
}

describe('ENG-30 log entry', () => {
  it('takes every field, values of any JSON kind, and a field not there before or after', () => {
    expect(logEntrySchema.parse(entry)).toEqual(entry);
    const { label: _, ...unnamed } = entry;
    expect(logEntrySchema.safeParse(unnamed).success).toBe(true);
    const actor = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const kinds = {
      ...withChanges(
        { path: ['state', 'resources', 'focus'], after: 2 },
        { path: ['state', 'resources', 'luck'], before: 1 },
        {
          path: ['state', 'conditions'],
          before: [{ id: 'tales-core:condition/weary', level: 1 }],
          after: [],
        },
        { path: ['state', 'toggles', 'tales-core:talent/night-warden#glow'], after: true },
        { path: ['notes', 'free'], before: 'Old.', after: null },
        { path: ['abilities'], before: { base: { grit: 6 } }, after: { base: { grit: 7 } } },
      ),
      by: { role: 'gm', name: 'The table', actorId: actor },
    };
    expect(logEntrySchema.parse(kinds)).toEqual(kinds);
  });

  it('refuses each broken entry', () => {
    const luck = ['state', 'resources', 'luck'];
    const broken: Record<string, unknown> = {
      'no changes': withChanges(),
      'an empty path': withChanges({ path: [], after: 1 }),
      'an empty step': withChanges({ path: ['state', '', 'luck'], after: 1 }),
      'a step __proto__': withChanges({ path: ['__proto__', 'polluted'], after: true }),
      'a step constructor': withChanges({ path: ['state', 'constructor'], after: 1 }),
      'a step prototype': withChanges({ path: ['prototype'], after: 1 }),
      'a path twice': withChanges({ path: luck, after: 1 }, { path: luck, after: 2 }),
      'a path inside a later one': withChanges(
        { path: luck, after: 1 },
        { path: ['state', 'resources'], after: {} },
      ),
      'a path inside an earlier one': withChanges(
        { path: ['state', 'resources'], after: {} },
        { path: luck, after: 1 },
      ),
      'NaN as a value': withChanges({ path: luck, after: Number.NaN }),
      'a function as a value': withChanges({ path: luck, after: () => 1 }),
      'a field a change does not have': withChanges({ path: luck, after: 1, note: 'x' }),
      'a field an entry does not have': { ...entry, rev: 1 },
      'an id that is not a uuid': { ...entry, id: 'entry-1' },
      'a time with no zone': { ...entry, at: '2026-10-01T18:30:00' },
      'an author with no role': { ...entry, by: { name: 'Wren' } },
      'an action that is not a key': { ...entry, action: 'use resource' },
      'an empty subject': { ...entry, subject: ' ' },
      'a label with no language': { ...entry, label: {} },
    };
    for (const [name, value] of Object.entries(broken)) {
      expect(logEntrySchema.safeParse(value).success, name).toBe(false);
    }
  });

  it('names the later of two changes that touch one place, and lets near places pass', () => {
    const result = logEntrySchema.safeParse(
      withChanges(
        { path: ['state', 'resources', 'luck'], after: 1 },
        { path: ['state', 'resources', 'lucky'], after: 1 },
        { path: ['state', 'resources'], after: {} },
      ),
    );
    expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
      { path: ['changes', 2, 'path'], message: 'Touches the place of change 0.' },
    ]);
  });
});
