import {
  docPathSchema,
  entityBaseSchema,
  entityKeySchema,
  packJsonSchemaOf,
  RESERVED_KEYS,
  UNSAFE_PATH_STEPS,
} from '@grimoire/schema';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ash, openTalesCharacter, talesCore, talesPackSchema } from './tales/index.ts';

// Tales, the made-up test system (ENG-27). No real game.

const MESSAGE = 'Is the name of a field every object has; a key never is.';

/** The paths of every issue when `value` is parsed by `schema`, or `[]` when it passes. */
function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

/** The paths of every issue an opener refused a file for, or `[]` when it opened. */
function refusedAt(opened: ReturnType<typeof openTalesCharacter>): string[] {
  if (opened.ok) return [];
  if (opened.code !== 'invalid') return [opened.code];
  return opened.error.issues.map((issue) => issue.path.join('.'));
}

/** A Tales stat with this key. */
function stat(pack: string, key: string) {
  return {
    id: `${pack}:ability/odd`,
    type: 'ability',
    key,
    ruleset: 'any',
    name: { en: 'Odd' },
    abbr: { en: 'ODD' },
    order: 9,
    source: { pack },
  };
}

describe('ENG-40 a key is never a field every object has', () => {
  it("lists every camelCase name of Object.prototype, measured, and 'prototype'", () => {
    const measured = Object.getOwnPropertyNames(Object.prototype).filter((name) =>
      /^[a-z][a-zA-Z0-9]*$/.test(name),
    );
    expect(measured).toHaveLength(7);
    expect([...RESERVED_KEYS].sort()).toEqual([...measured, 'prototype'].sort());
  });

  it('refuses each reserved name with one issue that says why, and takes longer words', () => {
    for (const key of RESERVED_KEYS) {
      const result = entityKeySchema.safeParse(key);
      expect(
        result.error?.issues.map((issue) => issue.message),
        key,
      ).toEqual([MESSAGE]);
    }
    const taken = ['str', 'san', 'sleightOfHand', 'd20'];
    for (const key of [...taken, 'toStrings', 'myConstructor', 'prototypes', 'valueOfGold']) {
      expect(entityKeySchema.safeParse(key).success, key).toBe(true);
    }
    for (const key of ['Str', '1st', '']) {
      expect(entityKeySchema.safeParse(key).error?.issues, key).toHaveLength(1);
    }
  });

  it("refuses a reserved name at the key's own path, wherever a key is taken", () => {
    const entity = { id: 'tales:stat/odd', type: 'stat', ruleset: 'any', name: { en: 'Odd' } };
    const withKey = (key: string) => ({ ...entity, key, source: { pack: 'tales' } });
    expect(issuePaths(entityBaseSchema, withKey('toString'))).toEqual(['key']);
    expect(issuePaths(entityBaseSchema, withKey('odd'))).toEqual([]);

    const character = (change: object) => openTalesCharacter({ ...ash, ...change });
    const refused = [
      [{ abilities: { base: { ...ash.abilities.base, toString: 3 } } }, 'abilities.base.toString'],
      [{ state: { ...ash.state, resources: { constructor: 1 } } }, 'state.resources.constructor'],
      [{ notes: { valueOf: 'A note.' } }, 'notes.valueOf'],
    ] as const;
    for (const [change, path] of refused) {
      expect(refusedAt(character(change)), path).toEqual([path]);
    }
    expect(refusedAt(character({ notes: { values: 'A note.' } }))).toEqual([]);
  });

  it("is carried into the pack's JSON Schema", () => {
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats.default(ajv);
    const jsonValidPack = ajv.compile(packJsonSchemaOf(talesPackSchema));
    const packWith = (key: string) => ({
      ...talesCore,
      entities: [...talesCore.entities, stat('tales-core', key)],
    });
    const at = talesCore.entities.length;
    expect(issuePaths(talesPackSchema, packWith('toString'))).toEqual([`entities.${at}.key`]);
    expect(jsonValidPack(packWith('toString'))).toBe(false);
    expect(issuePaths(talesPackSchema, packWith('tough'))).toEqual([]);
    expect(jsonValidPack(packWith('tough')), JSON.stringify(jsonValidPack.errors)).toBe(true);
  });

  it("refuses ENG-30's character: its own stat keyed `constructor` no longer opens", () => {
    const own = (key: string) =>
      openTalesCharacter({ ...ash, localEntities: [stat('character', key)] });
    expect(refusedAt(own('constructor'))).toEqual(['localEntities.0.key']);
    expect(refusedAt(own('odd'))).toEqual([]);
  });

  it("refuses every step a log entry's path may not take, so a key is always one it may", () => {
    for (const step of UNSAFE_PATH_STEPS) {
      expect(entityKeySchema.safeParse(step).success, step).toBe(false);
    }
    for (const key of ['luck', 'focus', 'toStrings', 'prototypes']) {
      expect(entityKeySchema.safeParse(key).success, key).toBe(true);
      expect(docPathSchema.safeParse(['state', 'resources', key]).success, key).toBe(true);
    }
  });
});
