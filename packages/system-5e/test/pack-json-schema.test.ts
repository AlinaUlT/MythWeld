import { PACK_SCHEMA_VERSION, packJsonSchemaOf } from '@grimoire/schema';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_CHECKS_LEFT_OUT,
  FIFTH_EDITION_SCHEMA_VERSION,
  FIFTH_EDITION_SYSTEM,
  fifthEditionPackJsonSchema,
  fifthEditionPackSchema,
} from '../src/index.ts';
import { armor, background, cantrip, everyEntity, gear, klass, spell, weapon } from './entities.ts';

// The pack holds ENG-32's made-up entities (pack `hb-test`), so no rules fact is asserted.

const pack = {
  id: 'hb-test',
  version: '1.0.0',
  schemaVersion: PACK_SCHEMA_VERSION,
  system: FIFTH_EDITION_SYSTEM,
  systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
  title: { en: 'Test pack' },
  ruleset: 'any',
  license: { name: 'Made up for the tests', redistributable: false },
  entities: everyEntity,
};

/** The pack holding `entity` alone, as a file would hold it. */
function packOf(entity: object): unknown {
  return JSON.parse(JSON.stringify({ ...pack, entities: [entity] }));
}

/** `entity` with `field` removed. */
function without<T extends object>(entity: T, field: keyof T & string): Omit<T, typeof field> {
  const { [field]: _, ...rest } = entity;
  return rest;
}

const jsonSchema = fifthEditionPackJsonSchema();
const text = `${JSON.stringify(jsonSchema, null, 2)}\n`;
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats.default(ajv);
const jsonValid = ajv.compile(jsonSchema);

describe('ENG-38 fifth-edition pack JSON Schema', () => {
  it("is the pack schema's, read by a validator that accepts every made-up entity", () => {
    expect(jsonSchema).toEqual(
      packJsonSchemaOf(fifthEditionPackSchema, FIFTH_EDITION_CHECKS_LEFT_OUT),
    );
    expect(jsonSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(everyEntity).toHaveLength(21);
    expect(fifthEditionPackSchema.safeParse(pack).success).toBe(true);
    expect(jsonValid(pack), JSON.stringify(jsonValid.errors)).toBe(true);
  });

  it('writes a shared part once, in `$defs`, in printable ASCII', () => {
    expect(Object.keys(jsonSchema.$defs ?? {}).length).toBeGreaterThan(0);
    expect(text.length).toBeLessThan(100_000);
    expect(text).toMatch(/^[\n\x20-\x7e]*$/);
  });

  it('carries 6 checks a refinement makes into the JSON Schema', () => {
    const material = { v: true, s: false };
    const refused = [
      ['a distance range without `distance`', { ...cantrip, range: { kind: 'distance' } }],
      ['another range with `distance`', { ...cantrip, range: { kind: 'touch', distance: 5 } }],
      ['a timed duration without `unit`', { ...spell, duration: { kind: 'timed', value: 10 } }],
      ['a timed duration without `value`', { ...spell, duration: { kind: 'timed', unit: 'hour' } }],
      ['another duration with `value`', { ...spell, duration: { kind: 'instant', value: 1 } }],
      ['another duration with `unit`', { ...spell, duration: { kind: 'special', unit: 'day' } }],
      [
        '`mCost` without `m`',
        { ...spell, components: { ...material, mCost: spell.components.mCost } },
      ],
      ['`mConsumed` without `m`', { ...spell, components: { ...material, mConsumed: true } }],
      ['a weapon without its block', without(weapon, 'weapon')],
      ['a `weapon` block on gear', { ...gear, weapon: weapon.weapon }],
      ['armor without its block', without(armor, 'armor')],
      ['an `armor` block on gear', { ...gear, armor: armor.armor }],
      ['a cantrip scaling by slot', { ...cantrip, scaling: { kind: 'slot', formula: '1d8' } }],
      ['a spell scaling as a cantrip', { ...spell, scaling: { kind: 'cantrip', formula: '1d6' } }],
    ] as const;
    for (const [check, entity] of refused) {
      const json = packOf(entity);
      expect(fifthEditionPackSchema.safeParse(json).success, check).toBe(false);
      expect(jsonValid(json), check).toBe(false);
    }
    for (const entity of [cantrip, spell, weapon, armor, gear]) {
      expect(jsonValid(packOf(entity)), entity.id).toBe(true);
    }
  });

  it('lists in its description the 4 checks a JSON Schema cannot say', () => {
    const [own] = klass.grants;
    const [kit] = background.grants.filter((grant) => grant.id === 'kit');
    const twice = { ...kit, fixed: [kit?.fixed?.[0], kit?.fixed?.[0]] };
    const left = [
      [
        'a long range below the normal one',
        { ...weapon, weapon: { ...weapon.weapon, range: { normal: 60, long: 20 } } },
      ],
      ['a class level twice', { ...klass, levels: [{ level: 1 }, { level: 1 }] }],
      [
        'a multiclass grant id twice',
        {
          ...klass,
          multiclass: { grants: [klass.multiclass.grants[0], klass.multiclass.grants[0]] },
        },
      ],
      ["a multiclass grant id of the class's own", { ...klass, multiclass: { grants: [own] } }],
      ["an item grant's item twice", { ...background, grants: [twice] }],
    ] as const;
    for (const [check, entity] of left) {
      const json = packOf(entity);
      expect(fifthEditionPackSchema.safeParse(json).success, check).toBe(false);
      expect(jsonValid(json), check).toBe(true);
    }
    expect(jsonSchema.description).toBe(
      [
        'A content pack. The app checks these too, which this JSON Schema cannot say:',
        '- Entity ids are unique in `entities`; effect ids in `effects`; grant ids in `grants`.',
        "- A choice's `count` is no more than its list's length.",
        '- A pattern of an ability score grant has no more numbers than `from` has stats.',
        "- A weapon's long range is no shorter than its normal range.",
        '- A class gives each level once in `levels`.',
        "- Grant ids differ in a class's `multiclass.grants`, and from the ids in its `grants`.",
        "- An `item` grant's `fixed` list names each item once.",
      ].join('\n'),
    );
  });
});
