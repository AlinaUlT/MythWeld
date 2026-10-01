import {
  LOCALE_OVERLAY_MIGRATIONS,
  LOCALE_OVERLAY_SCHEMA_VERSION,
  type Migration,
  type Opened,
  openerOf,
  openLocaleOverlay,
  PACK_MIGRATIONS,
  PACK_SCHEMA_VERSION,
  packOpenerOf,
  packSchemaOf,
  systemEntitySchemaOf,
  systemListsOf,
  systemSchemasOf,
} from '@grimoire/schema';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

// A made-up stored file, now at version 3. Version 1 had `title`; version 2 renamed it `name`;
// version 3 added `tags`. The steps do not touch `schemaVersion`: the frame writes it.
const noteSchema = z.strictObject({
  schemaVersion: z.literal(3),
  name: z.string(),
  tags: z.array(z.string()),
});
const toV2 = vi.fn<Migration>(({ title, ...rest }) => ({ ...rest, name: title }));
const toV3 = vi.fn<Migration>((file) => ({ ...file, tags: [] }));
const openNote = openerOf(noteSchema, [{ field: 'schemaVersion', migrations: [toV2, toV3] }]);

/** `value` and everything inside it, frozen: a change throws in strict mode. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** The paths of a refusal's issues, or `[]` when the file opened. */
function refusedPaths(opened: Opened<unknown>): string[] {
  if (opened.ok || opened.code !== 'invalid') return [];
  return opened.error.issues.map((issue) => issue.path.join('.'));
}

// A made-up system's pack, for the pack's opener. No real game.
const talesLists = systemListsOf({
  editions: ['first-age'],
  proficiencyCategories: ['lore'],
  proficiencyLevels: [1],
  recoveryEvents: ['scene'],
});
const tales = systemSchemasOf(talesLists, []);
const openTalesPack = packOpenerOf(
  packSchemaOf({
    system: 'tales',
    ruleset: tales.rulesetSchema,
    entity: systemEntitySchemaOf(tales, []),
  }),
);
const pack = {
  id: 'tales-core',
  version: '1.0.0',
  schemaVersion: 1,
  system: 'tales',
  title: { en: 'Tales core' },
  ruleset: 'any',
  license: { name: 'Made up for a test', redistributable: false },
  entities: [],
};
const overlay = {
  schemaVersion: 1,
  packId: 'tales-core',
  locale: 'ru',
  texts: { 'tales-core:talent/night-warden': { text: 'Текст.' } },
};

describe('ENG-06 migration frame', () => {
  it('opens a file of the current version as it is', () => {
    toV2.mockClear();
    toV3.mockClear();
    const file = { schemaVersion: 3, name: 'Map', tags: ['old'] };
    expect(openNote(file)).toEqual({ ok: true, value: file, from: { schemaVersion: 3 } });
    expect(toV2).not.toHaveBeenCalled();
    expect(toV3).not.toHaveBeenCalled();
  });

  it('runs each step from the version found, and writes each new version', () => {
    toV2.mockClear();
    toV3.mockClear();
    expect(openNote({ schemaVersion: 1, title: 'Map' })).toEqual({
      ok: true,
      value: { schemaVersion: 3, name: 'Map', tags: [] },
      from: { schemaVersion: 1 },
    });
    expect(toV2).toHaveBeenCalledExactlyOnceWith({ schemaVersion: 1, title: 'Map' });
    expect(toV3).toHaveBeenCalledExactlyOnceWith({ schemaVersion: 2, name: 'Map' });

    toV2.mockClear();
    toV3.mockClear();
    expect(openNote({ schemaVersion: 2, name: 'Map' })).toEqual({
      ok: true,
      value: { schemaVersion: 3, name: 'Map', tags: [] },
      from: { schemaVersion: 2 },
    });
    expect(toV2).not.toHaveBeenCalled();
    expect(toV3).toHaveBeenCalledOnce();
  });

  it('never changes the file passed in', () => {
    const file = deepFreeze({ schemaVersion: 1, title: 'Map' });
    expect(openNote(file).ok).toBe(true);
    expect(file).toEqual({ schemaVersion: 1, title: 'Map' });
  });

  it('refuses a newer file before any step runs', () => {
    toV2.mockClear();
    toV3.mockClear();
    expect(openNote({ schemaVersion: 4, name: 'Map', tags: [], more: true })).toEqual({
      ok: false,
      code: 'newer',
      field: 'schemaVersion',
      found: 4,
      current: 3,
      message:
        'The file was saved by a newer version of the app: its "schemaVersion" is 4, and this app reads up to 3.',
    });
    expect(toV2).not.toHaveBeenCalled();
    expect(toV3).not.toHaveBeenCalled();
  });

  it('leaves a version that is not a whole number from 1 to the schema', () => {
    toV2.mockClear();
    for (const schemaVersion of [undefined, 0, -1, 2.5, '1', null]) {
      const opened = openNote({ schemaVersion, title: 'Map' });
      expect(opened.ok, String(schemaVersion)).toBe(false);
      expect(refusedPaths(opened), String(schemaVersion)).toContain('schemaVersion');
    }
    for (const file of [null, 'a note', 3, [{ schemaVersion: 1 }]]) {
      expect(refusedPaths(openNote(file)), JSON.stringify(file)).toEqual(['']);
    }
    expect(toV2).not.toHaveBeenCalled();
  });

  it('refuses a migrated file that the schema does not take', () => {
    const opened = openNote({ schemaVersion: 1, title: 5 });
    expect(refusedPaths(opened)).toEqual(['name']);
    expect(opened.ok === false && opened.code === 'invalid' && opened.message).toContain(
      '→ at name',
    );
  });

  it('runs two chains, each on its own field', () => {
    const pairSchema = z.strictObject({
      schemaVersion: z.literal(2),
      systemSchemaVersion: z.literal(3),
      core: z.string(),
      own: z.string(),
    });
    const coreStep = vi.fn<Migration>(({ old, ...rest }) => ({ ...rest, core: old }));
    const ownSteps = [
      vi.fn<Migration>(({ mine, ...rest }) => ({ ...rest, own: mine })),
      vi.fn<Migration>((file) => ({ ...file, own: `${file.own}!` })),
    ];
    const openPair = openerOf(pairSchema, [
      { field: 'schemaVersion', migrations: [coreStep] },
      { field: 'systemSchemaVersion', migrations: ownSteps },
    ]);
    expect(openPair({ schemaVersion: 1, systemSchemaVersion: 2, old: 'a', own: 'b' })).toEqual({
      ok: true,
      value: { schemaVersion: 2, systemSchemaVersion: 3, core: 'a', own: 'b!' },
      from: { schemaVersion: 1, systemSchemaVersion: 2 },
    });
    expect(coreStep).toHaveBeenCalledOnce();
    expect(ownSteps[0]).not.toHaveBeenCalled();
    expect(ownSteps[1]).toHaveBeenCalledExactlyOnceWith({
      schemaVersion: 2,
      systemSchemaVersion: 2,
      core: 'a',
      own: 'b',
    });

    coreStep.mockClear();
    const newer = openPair({ schemaVersion: 1, systemSchemaVersion: 4, old: 'a', own: 'b' });
    expect(newer).toMatchObject({ ok: false, code: 'newer', field: 'systemSchemaVersion' });
    expect(coreStep).not.toHaveBeenCalled();
  });

  it('checks itself when it is built', () => {
    expect(() => openerOf(noteSchema, [{ field: 'schemaVersion', migrations: [toV2] }])).toThrow(
      'The schema\'s "schemaVersion" is 3, but its migrations lead to version 2.',
    );
    expect(() => openerOf(noteSchema, [{ field: 'version', migrations: [] }])).toThrow(
      'The schema\'s "version" is not one number literal.',
    );
    for (const schemaVersion of [z.int(), z.literal([1, 2]), z.literal('1')]) {
      const schema = z.strictObject({ schemaVersion });
      expect(() => openerOf(schema, [{ field: 'schemaVersion', migrations: [] }])).toThrow(
        'The schema\'s "schemaVersion" is not one number literal.',
      );
    }
  });

  it('types what it opens by the schema', () => {
    expectTypeOf(openNote).returns.toEqualTypeOf<
      Opened<{ schemaVersion: 3; name: string; tags: string[] }>
    >();
  });
});

describe('ENG-06 the openers of packs and overlays', () => {
  it('open the current version, with no migration yet', () => {
    expect(PACK_MIGRATIONS).toEqual([]);
    expect(LOCALE_OVERLAY_MIGRATIONS).toEqual([]);
    expect(openTalesPack(pack)).toEqual({ ok: true, value: pack, from: { schemaVersion: 1 } });
    expect(openLocaleOverlay(overlay)).toEqual({
      ok: true,
      value: overlay,
      from: { schemaVersion: 1 },
    });
  });

  it('refuse a file from a newer app with the numbers the screen needs', () => {
    expect(openTalesPack({ ...pack, schemaVersion: PACK_SCHEMA_VERSION + 1 })).toMatchObject({
      ok: false,
      code: 'newer',
      field: 'schemaVersion',
      found: 2,
      current: 1,
    });
    expect(
      openLocaleOverlay({ ...overlay, schemaVersion: LOCALE_OVERLAY_SCHEMA_VERSION + 1 }),
    ).toMatchObject({ ok: false, code: 'newer', found: 2, current: 1 });
  });

  it('refuse a file the schema does not take, on its path', () => {
    expect(refusedPaths(openTalesPack({ ...pack, system: 'deep' }))).toEqual(['system']);
    expect(refusedPaths(openLocaleOverlay({ ...overlay, locale: 'de' }))).toEqual(['locale']);
  });
});
