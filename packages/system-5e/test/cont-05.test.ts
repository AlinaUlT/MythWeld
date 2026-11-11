import { PACK_SCHEMA_VERSION } from '@grimoire/schema';
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
import { cantrip, feat, gear, klass, species, spell, weapon } from './entities.ts';

// CONT-05: what the fifth-edition schemas learned for the SRD values phase 1 found they could not
// hold. Each test names the SRD value a field is for (the numbers are the source's, measured on
// 5e-bits/5e-srd-api at `e6edf9a`, or read from foundryvtt/dnd5e at `7bfb3f1`, CONT-05 §8) and
// writes it into a made-up entity (pack `hb-test`, no rules text). Each entity is judged by the
// Zod schema and by the published JSON Schema, which must agree.

const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats.default(ajv);
const jsonValid = ajv.compile(fifthEditionPackJsonSchema());

function packOf(entity: object): unknown {
  return JSON.parse(
    JSON.stringify({
      id: 'hb-test',
      version: '1.0.0',
      schemaVersion: PACK_SCHEMA_VERSION,
      system: FIFTH_EDITION_SYSTEM,
      systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION,
      title: { en: 'Test pack' },
      ruleset: 'any',
      license: { name: 'Made up for the tests', redistributable: false },
      entities: [entity],
    }),
  );
}

/** Whether the Zod schema and the JSON Schema accept the entity. They must say the same. */
function accepted(entity: object): boolean {
  const file = packOf(entity);
  const zod = fifthEditionPackSchema.safeParse(file).success;
  expect(jsonValid(file), JSON.stringify(jsonValid.errors)).toBe(zod);
  return zod;
}

const at = (level: number, extra: object) => ({ atLevel: level, ...extra });

describe('CONT-05 an item of mounts and vehicles', () => {
  // 5e-SRD-Equipment.json (2014), equipment category `mounts-and-vehicles`: 40 entries, 9 under
  // "Mounts and Other Animals", 25 under "Tack, Harness, and Drawn Vehicles", 6 under
  // "Waterborne Vehicles". SRD 5.2.1 has none.
  it('has a category of its own, and a block no more than the others', () => {
    expect(accepted({ ...gear, category: 'transport' })).toBe(true);
    expect(accepted({ ...gear, category: 'vehicle' })).toBe(false);
  });
});

describe("CONT-05 a spell's duration, until dispelled or triggered", () => {
  // 5e-SRD-Spells.json (2024): Glyph of Warding and Symbol, "Until dispelled or triggered".
  it('is a kind of its own, with no number or unit', () => {
    expect(accepted({ ...spell, duration: { kind: 'untilDispelledOrTriggered' } })).toBe(true);
    expect(
      accepted({
        ...spell,
        duration: { kind: 'untilDispelledOrTriggered', value: 1, unit: 'day' },
      }),
    ).toBe(false);
    expect(accepted({ ...spell, duration: { kind: 'untilDispelled' } })).toBe(true);
  });
});

describe('CONT-05 a spell grant whose stat the person picks', () => {
  // SRD 5.2.1 `elven-lineage`, `gnomish-lineage`, `magic-initiate`: "Intelligence, Wisdom, or
  // Charisma is your spellcasting ability" (ENG-32 §8).
  const grant = (more: object) => ({
    ...feat,
    grants: [{ id: 'spark', kind: 'spell', fixed: ['hb-test:spell/ember-spark'], ...more }],
  });

  it('names the stats it picks from, two or more, each once', () => {
    expect(accepted(grant({ abilityFrom: ['int', 'wis', 'cha'] }))).toBe(true);
    expect(accepted(grant({ abilityFrom: ['int'] }))).toBe(false);
    expect(accepted(grant({ abilityFrom: ['int', 'int'] }))).toBe(false);
  });

  it('names one stat or a list to pick from, never both', () => {
    expect(accepted(grant({ ability: 'wis' }))).toBe(true);
    expect(accepted(grant({ ability: 'wis', abilityFrom: ['int', 'wis'] }))).toBe(false);
  });
});

describe("CONT-05 a spell's growth by every other slot level and by one damage", () => {
  const slot = (scaling: object) => ({ ...spell, scaling });

  // 5e-SRD-Spells.json (2014): Flame Blade `damage_at_slot_level` 2: 3d6, 4: 4d6, 6: 5d6, 8: 6d6,
  // "1d6 for every two slot levels above 2nd"; Spiritual Weapon 1d8 for every two slot levels.
  it('has a step in slot levels, from two', () => {
    expect(accepted(slot({ kind: 'slot', formula: '1d6', every: 2 }))).toBe(true);
    expect(accepted(slot({ kind: 'slot', formula: '1d6', every: 1 }))).toBe(false);
    expect(accepted({ ...cantrip, scaling: { kind: 'cantrip', formula: '1d6', every: 2 } })).toBe(
      false,
    );
  });

  // 2014 Flame Strike: "the fire damage or the radiant damage (your choice) increases by 1d6";
  // 2024: "The Fire damage and the Radiant damage increase by 1d6".
  it('names the damage that grows, and whether the caster picks one of them', () => {
    const both = { kind: 'slot', formula: '1d6', damageTypes: ['fire', 'radiant'] };
    expect(accepted(slot(both))).toBe(true);
    expect(accepted(slot({ ...both, pickOne: true }))).toBe(true);
    expect(accepted(slot({ kind: 'slot', formula: '1d6', pickOne: true }))).toBe(false);
    expect(accepted(slot({ ...both, damageTypes: ['fire'], pickOne: true }))).toBe(false);
    expect(accepted(slot({ ...both, damageTypes: ['fire', 'fire'] }))).toBe(false);
  });
});

describe("CONT-05 a cantrip's growth by character level", () => {
  const upgraded = (upgrades: object[]) => ({ ...cantrip, upgrades });

  // SRD 5.2.1 Eldritch Blast: "two beams at level 5, three beams at level 11, and four beams at
  // level 17".
  it('counts beams', () => {
    expect(
      accepted(upgraded([at(5, { beams: 2 }), at(11, { beams: 3 }), at(17, { beams: 4 })])),
    ).toBe(true);
  });

  // SRD 5.2.1 Shillelagh: "The damage die changes when you reach levels 5 (d10), 11 (d12), and 17
  // (2d6)".
  it('changes the damage die', () => {
    expect(
      accepted(upgraded([at(5, { die: '1d10' }), at(11, { die: '1d12' }), at(17, { die: '2d6' })])),
    ).toBe(true);
  });

  // SRD 5.2.1 Spare the Dying: "The range doubles when you reach levels 5 (30 feet), 11 (60 feet),
  // and 17 (120 feet)", from a base of 15 feet.
  it('changes the range, in feet', () => {
    expect(
      accepted(upgraded([at(5, { range: 30 }), at(11, { range: 60 }), at(17, { range: 120 })])),
    ).toBe(true);
    expect(accepted(upgraded([at(5, { range: 0 })]))).toBe(false);
  });

  // SRD 5.2.1 True Strike: "extra Radiant damage when you reach levels 5 (1d6), 11 (2d6), and 17
  // (3d6)", none before level 5.
  it('adds a damage, with none before its first step', () => {
    const extra = (formula: string) => ({ extraDamage: { formula, type: 'radiant' } });
    expect(
      accepted(upgraded([at(5, extra('1d6')), at(11, extra('2d6')), at(17, extra('3d6'))])),
    ).toBe(true);
  });

  it('gives each level once, which the JSON Schema lists but cannot say', () => {
    const twice = packOf(upgraded([at(5, { beams: 2 }), at(5, { beams: 3 })]));
    expect(fifthEditionPackSchema.safeParse(twice).success).toBe(false);
    expect(jsonValid(twice)).toBe(true);
    expect(FIFTH_EDITION_CHECKS_LEFT_OUT).toContain("A cantrip's `upgrades` give each level once.");
  });

  it('refuses a step with nothing in it, a level out of range and a spell above 0', () => {
    expect(accepted(upgraded([at(5, {})]))).toBe(false);
    expect(accepted(upgraded([at(21, { beams: 2 })]))).toBe(false);
    expect(accepted(upgraded([at(0, { beams: 2 })]))).toBe(false);
    expect(accepted(upgraded([]))).toBe(false);
    expect(accepted({ ...spell, upgrades: [at(5, { beams: 2 })] })).toBe(false);
  });
});

describe("CONT-05 a spell's healing of another kind", () => {
  // 5e-SRD-Spells.json (2014) Aid `heal_at_slot_level` 2: 5 … 9: 40, "hit point maximum and current
  // hit points"; SRD 5.2.1 Aid "Hit Point maximum and current Hit Points increase by 5"; 2014 and
  // 2024 Heroes' Feast raise the maximum by 2d10 (dnd5e: the `maximum` type).
  it('raises the maximum and the current hit points together', () => {
    expect(accepted({ ...spell, healing: { formula: '5', kind: 'maxHp' } })).toBe(true);
    expect(accepted({ ...spell, healing: { formula: '2d10', kind: 'max' } })).toBe(false);
  });

  // SRD 5.2.1 Arcane Vigor (dnd5e `spells24`): "Roll one or two of your unexpended Hit Point Dice"
  // plus the spellcasting modifier.
  it('rolls up to a number of the target’s Hit Dice', () => {
    const vigor = (hitDice: number) => ({
      ...spell,
      healing: { formula: '@mod', kind: 'hp', hitDice },
    });
    expect(accepted(vigor(2))).toBe(true);
    expect(accepted(vigor(0))).toBe(false);
  });

  // Heroism (both SRDs): temporary hit points equal to the casting modifier "at the start of each of
  // its turns". 5e-SRD-Spells.json (2014) Regenerate `heal_at_slot_level` 7: "4d8 + 15" and, "at
  // the start of each of its turns", 1 hit point (SRD 5.2.1 the same).
  it('heals at the start of each turn, beside or instead of the first healing', () => {
    expect(
      accepted({
        ...spell,
        healing: undefined,
        healingEachTurn: { formula: '@mod', kind: 'tempHp' },
      }),
    ).toBe(true);
    expect(
      accepted({
        ...spell,
        healing: { formula: '4d8 + 15', kind: 'hp' },
        healingEachTurn: { formula: '1', kind: 'hp' },
      }),
    ).toBe(true);
    expect(accepted({ ...spell, healingEachTurn: { formula: '1', kind: 'life' } })).toBe(false);
  });
});

describe('CONT-05 a magic weapon that is a kind of weapon', () => {
  // dnd5e `type.baseItem`: a "Longsword, +1" is a longsword for a proficiency and a mastery.
  it('names the key of the weapon it is a kind of', () => {
    const magic = (baseKey: string) => ({ ...weapon, weapon: { ...weapon.weapon, baseKey } });
    expect(accepted(magic('longsword'))).toBe(true);
    expect(accepted(magic('Long Sword'))).toBe(false);
  });
});

describe("CONT-05 a mastery choice's filter", () => {
  // SRD 5.2.1 barbarian: mastery of "Melee weapons" (a tag the import gives each melee weapon);
  // paladin, ranger and rogue: weapons "with which you have proficiency" (ENG-16 §11).
  const mastery = (from: object) => ({
    ...feat,
    grants: [
      { id: 'drills', kind: 'proficiency', category: 'mastery', choose: { count: 2, from } },
    ],
  });

  it('says melee by a tag, and proficient by a flag', () => {
    expect(accepted(mastery({ type: 'item', category: 'weapon', tag: 'melee' }))).toBe(true);
    expect(accepted(mastery({ type: 'item', category: 'weapon', proficient: true }))).toBe(true);
    expect(accepted(mastery({ type: 'item', category: 'weapon', proficient: 'yes' }))).toBe(false);
    expect(accepted(mastery({ proficient: true }))).toBe(false);
  });
});

describe('CONT-05 a prerequisite of a feature by its name', () => {
  // SRD 5.2.1: the four fighting style feats ask for the "Fighting Style" feature, Boon of Spell
  // Recall for "Spellcasting" (5e-SRD-Feats.json `prerequisites.feature_named`; ENG-10 §11).
  it('names the feature in words, and not nothing', () => {
    const asks = (name: string) => ({
      ...feat,
      prerequisites: [{ kind: 'featureNamed', name }],
    });
    expect(accepted(asks('Fighting Style'))).toBe(true);
    expect(accepted(asks('Spellcasting'))).toBe(true);
    expect(accepted(asks(' '))).toBe(false);
    expect(accepted({ ...feat, prerequisites: [{ kind: 'featureNamed' }] })).toBe(false);
  });
});

describe('CONT-05 what the schemas already held', () => {
  // SRD 5.2.1 human: Medium in 5e-database, Medium or Small in the SRD's text (ENG-10 §11). The
  // species' `size` is a list the person picks from, as the tiefling's Small or Medium is.
  it('a species with two sizes to pick from', () => {
    expect(accepted({ ...species, size: ['medium', 'small'] })).toBe(true);
  });

  // SRD 5.2.1 Ability Score Improvement, Magic Initiate and Skilled are repeatable; the class gives
  // Ability Score Improvement at levels 4, 8, 12 and 16, one grant for each (ENG-33 §11).
  it('a repeatable feat, and a class that gives it at four levels', () => {
    expect(accepted({ ...feat, repeatable: true })).toBe(true);
    const improvement = (level: number) => ({
      id: `improvement${level}`,
      kind: 'entity',
      fixed: ['hb-test:feat/steady-hands'],
      atLevel: level,
    });
    expect(
      accepted({ ...klass, grants: [...klass.grants, ...[4, 8, 12, 16].map(improvement)] }),
    ).toBe(true);
  });
});
