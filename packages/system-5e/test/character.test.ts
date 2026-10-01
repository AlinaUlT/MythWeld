import { type CharacterCore, compute, loadContentIndex, type SystemModule } from '@grimoire/engine';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  COINS,
  DEATH_SAVES,
  FIFTH_EDITION_CHARACTER_MIGRATIONS,
  FIFTH_EDITION_PACK_MIGRATIONS,
  FIFTH_EDITION_SCHEMA_VERSION,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type FifthEditionPack,
  fifthEditionCharacterSchema,
  fifthEditionEntitySchema,
  fifthEditionPackSchema,
  HIT_DIE_SIZES,
  type HouseRules,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';

// Every entity, roll and value below is made up for this test (pack `hb-test`): no name, number or
// text of a real book, so no rules fact is asserted. The shape is SPEC §5.8's, changed as ENG-33
// §4 says.

const source = { pack: 'hb-test' };

const SATCHEL = '1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5';
const FLOWER = '2d3e4f5a-6b7c-4d8e-9fa0-b1c2d3e4f5a6';
const LANTERN = '3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a6b7';

/** A roll a score method made, as ENG-26 records it. */
const roll = {
  id: '4f5a6b7c-8d9e-4fa0-b1c2-d3e4f5a6b7c8',
  rolledAt: '2026-10-01T09:00:00.000Z',
  by: { role: 'player', name: 'A. Player' },
  label: 'Scores',
  visibility: 'public',
  total: 13,
  breakdown: [
    {
      label: 'Three dice, best two',
      formula: '3d8kh2',
      value: 13,
      dice: [
        {
          at: 0,
          text: '3d8kh2',
          count: 3,
          faces: 8,
          keep: { which: 'highest', count: 2 },
          results: [7, 2, 6],
          kept: [true, false, true],
          total: 13,
        },
      ],
      own: false,
    },
  ],
};

/** A feat of the character's own. */
const luckyFind = {
  id: 'character:feat/lucky-find',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Lucky Find' },
  source: { pack: 'character' },
};

const systemData = {
  houseRules: {
    hitPointMethods: ['roll', 'avg'],
    abilityMax: 22,
    feats: 'ownAndOtherOptional',
    multiclass: true,
    encumbrance: 'simple',
    skillAbilitySwap: false,
    inspirationMax: 2,
  },
  abilities: { method: 'threeOfEight', rolls: [roll], bonusSource: 'both' },
  advancement: { mode: 'xp', xp: 450 },
  species: { id: 'hb-test:species/lantern-folk', size: 'small' },
  background: { id: 'hb-test:background/lamplighter' },
  classes: [
    {
      id: 'hb-test:class/warden',
      subclass: 'hb-test:subclass/night-watch',
      level: 3,
      hp: ['max', 'avg', 7],
    },
    { id: 'hb-test:class/scholar', level: 1, hp: ['avg'] },
  ],
  feats: [
    { id: 'hb-test:feat/steady-hand', replaces: 'hb-test:class/warden#improvement' },
    { id: 'character:feat/lucky-find' },
  ],
  spells: {
    'hb-test:class/scholar': {
      known: ['hb-test:spell/spark', 'hb-test:spell/mend'],
      prepared: ['hb-test:spell/mend'],
    },
    'hb-test:subclass/night-watch': { prepared: ['hb-test:spell/lantern-light'] },
  },
  inventory: [
    { uid: SATCHEL, itemId: 'hb-test:item/satchel', qty: 1, equipped: true, attuned: false },
    {
      uid: FLOWER,
      custom: { name: 'Pressed flower', weight: 0.5 },
      qty: 1,
      equipped: false,
      attuned: false,
      container: SATCHEL,
      note: 'From home.',
    },
    {
      uid: LANTERN,
      itemId: 'hb-test:item/lantern',
      qty: 0,
      equipped: false,
      attuned: true,
      container: SATCHEL,
    },
  ],
  currency: { cp: 12, sp: 0, ep: 0, gp: 3, pp: 0 },
  state: {
    hp: { current: 9, temp: 2 },
    hitDiceSpent: { d8: 1, d6: 0 },
    slotsSpent: { '1': 1, '2': 0 },
    pactSlotsSpent: 0,
    deathSaves: { success: 1, failure: 2 },
    concentration: 'hb-test:spell/lantern-light',
    inspiration: 2,
  },
};

/** Every field a fifth-edition character can have. */
const character = {
  id: '5b0c1d2e-3f4a-4b5c-8d6e-7f8091a2b3c4',
  schemaVersion: 1,
  rev: 2,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:30:00.000Z',
  system: '5e',
  systemSchemaVersion: 1,
  ruleset: '2024',
  allowMixedRulesets: true,
  kind: 'pc',
  mode: 'guided',
  name: 'Tamsin',
  player: 'A. Player',
  packs: ['hb-test'],
  abilities: { base: { san: 12 } },
  choices: { 'hb-test:species/lantern-folk#lineage': ['hb-test:lineage/ember'] },
  state: { resources: {}, conditions: [], toggles: {} },
  overrides: [],
  localEntities: [luckyFind],
  notes: { backstory: 'Made up for the tests.' },
  systemData,
};

type Data = typeof systemData;

/** `character` with `change` applied to its `systemData`. */
function withData(change: Record<string, unknown>) {
  return { ...character, systemData: { ...systemData, ...change } };
}

/** The paths of every issue when `value` is parsed as a character, or `[]` when it passes. */
function issuePaths(value: unknown): string[] {
  const result = fifthEditionCharacterSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

/** The paths refused when `systemData` takes `change`. */
function refused(change: Record<string, unknown>): string[] {
  return issuePaths(withData(change));
}

const [warden, scholar] = systemData.classes;
const state = systemData.state;

describe('ENG-33 fifth-edition character', () => {
  it('parses a full character to an equal object', () => {
    expect(fifthEditionCharacterSchema.parse(character)).toEqual(character);
    expect(FIFTH_EDITION_SCHEMA_VERSION).toBe(1);
    expect(FIFTH_EDITION_CHARACTER_MIGRATIONS).toEqual([]);
    expect(FIFTH_EDITION_PACK_MIGRATIONS).toEqual([]);
    expect(HIT_DIE_SIZES).toEqual([6, 8, 10, 12]);
    expect(COINS).toEqual(['cp', 'sp', 'ep', 'gp', 'pp']);
    expect(DEATH_SAVES).toBe(3);
  });

  it('needs every field but the species and the background; its lists may be empty', () => {
    for (const field of Object.keys(systemData)) {
      const { [field as keyof Data]: _left, ...without } = systemData;
      const expected = ['species', 'background'].includes(field) ? [] : [`systemData.${field}`];
      expect(issuePaths({ ...character, systemData: without }), field).toEqual(expected);
    }
    const bare = withData({
      abilities: { method: 'manual', bonusSource: 'species' },
      advancement: { mode: 'milestone', xp: 0 },
      species: { id: 'hb-test:species/lantern-folk' },
      classes: [],
      feats: [],
      spells: {},
      inventory: [],
      state: { ...state, hitDiceSpent: {}, slotsSpent: {}, concentration: undefined },
    });
    expect(issuePaths(bare)).toEqual([]);
    expect(refused({ hitch: true })).toEqual(['systemData']);
  });

  it("keeps the house rules to their lists, and inspiration to the rules' maximum", () => {
    const rules = (change: Record<string, unknown>) =>
      refused({ houseRules: { ...systemData.houseRules, ...change } });
    expect(rules({ hitPointMethods: ['max'] })).toEqual([]);
    expect(rules({ hitPointMethods: [] })).toEqual(['systemData.houseRules.hitPointMethods']);
    expect(rules({ hitPointMethods: ['roll', 'roll'] })).toEqual([
      'systemData.houseRules.hitPointMethods',
    ]);
    expect(rules({ hitPointMethods: ['best'] })).toEqual([
      'systemData.houseRules.hitPointMethods.0',
    ]);
    for (const feats of ['none', 'own', 'all']) expect(rules({ feats })).toEqual([]);
    expect(rules({ feats: 'some' })).toEqual(['systemData.houseRules.feats']);
    expect(rules({ encumbrance: 'variant' })).toEqual([]);
    expect(rules({ encumbrance: 'heavy' })).toEqual(['systemData.houseRules.encumbrance']);
    expect(rules({ abilityMax: 0 })).toEqual(['systemData.houseRules.abilityMax']);
    // A maximum of 0 is refused, and puts the count of 2 above it too.
    expect(rules({ inspirationMax: 0 })).toEqual([
      'systemData.houseRules.inspirationMax',
      'systemData.state.inspiration',
    ]);
    expect(rules({ multiclass: 'yes' })).toEqual(['systemData.houseRules.multiclass']);
    expect(rules({ pointBuyBudget: 27 })).toEqual(['systemData.houseRules']);
    expect(refused({ state: { ...state, inspiration: 3 } })).toEqual([
      'systemData.state.inspiration',
    ]);
  });

  it("keeps the score method's key and rolls, the bonus source and the advancement", () => {
    const abilities = (change: Record<string, unknown>) =>
      refused({ abilities: { ...systemData.abilities, ...change } });
    for (const bonusSource of ['species', 'background']) {
      expect(abilities({ bonusSource })).toEqual([]);
    }
    expect(abilities({ bonusSource: 'race' })).toEqual(['systemData.abilities.bonusSource']);
    expect(abilities({ method: 'point buy' })).toEqual(['systemData.abilities.method']);
    expect(abilities({ rolls: [] })).toEqual(['systemData.abilities.rolls']);
    expect(abilities({ rolls: [{ ...roll, total: 12 }] })).toEqual([
      'systemData.abilities.rolls.0.total',
    ]);
    expect(refused({ advancement: { mode: 'milestone', xp: 450 } })).toEqual([]);
    expect(refused({ advancement: { mode: 'story', xp: 0 } })).toEqual([
      'systemData.advancement.mode',
    ]);
    expect(refused({ advancement: { mode: 'xp' } })).toEqual(['systemData.advancement.xp']);
    expect(refused({ advancement: { mode: 'xp', xp: -1 } })).toEqual(['systemData.advancement.xp']);
    expect(refused({ species: { id: 'hb-test:species/lantern-folk', lineage: 'x' } })).toEqual([
      'systemData.species',
    ]);
  });

  it('keeps classes to their levels, one hit points entry per level', () => {
    const classes = (...list: unknown[]) => refused({ classes: list });
    expect(classes(warden, warden)).toEqual(['systemData.classes.1.id']);
    expect(classes({ ...scholar, level: 0, hp: [] })).toEqual(['systemData.classes.0.level']);
    expect(classes({ ...scholar, level: 21, hp: Array(21).fill('avg') })).toEqual([
      'systemData.classes.0.level',
      'systemData.classes',
    ]);
    expect(classes({ ...warden, hp: ['max', 'avg'] })).toEqual(['systemData.classes.0.hp']);
    expect(classes({ ...scholar, hp: [12] })).toEqual([]);
    for (const entry of [0, 13, 2.5, 'roll']) {
      expect(classes({ ...scholar, hp: [entry] }), String(entry)).toEqual([
        'systemData.classes.0.hp.0',
      ]);
    }
    const twenty = { ...warden, level: 17, hp: Array(17).fill('avg') };
    expect(classes(twenty, { ...scholar, level: 3, hp: Array(3).fill('avg') })).toEqual([]);
    expect(classes(twenty, { ...scholar, level: 4, hp: Array(4).fill('avg') })).toEqual([
      'systemData.classes',
    ]);
  });

  it('keeps feats and spells once each', () => {
    const [steady, lucky] = systemData.feats;
    expect(refused({ feats: [steady, { id: steady?.id }] })).toEqual(['systemData.feats.1.id']);
    expect(refused({ feats: [steady, { ...lucky, replaces: steady?.replaces }] })).toEqual([
      'systemData.feats.1.replaces',
    ]);
    expect(refused({ feats: [{ ...steady, replaces: 'hb-test:class/warden' }] })).toEqual([
      'systemData.feats.0.replaces',
    ]);
    expect(refused({ feats: [{ ...lucky, via: 'bonus' }] })).toEqual(['systemData.feats.0']);

    const spells = (entry: unknown) => refused({ spells: { 'hb-test:class/scholar': entry } });
    expect(spells({ known: ['hb-test:spell/spark'] })).toEqual([]);
    const at = 'systemData.spells.hb-test:class/scholar';
    expect(spells({})).toEqual([at]);
    expect(spells({ known: [] })).toEqual([`${at}.known`]);
    expect(spells({ prepared: ['hb-test:spell/mend', 'hb-test:spell/mend'] })).toEqual([
      `${at}.prepared`,
    ]);
    expect(refused({ spells: { scholar: { known: ['hb-test:spell/spark'] } } })).toEqual([
      'systemData.spells.scholar',
    ]);
  });

  it("keeps the inventory's rows and containers whole", () => {
    const [satchel, flower, lantern] = systemData.inventory;
    const rows = (...list: unknown[]) => refused({ inventory: list });
    expect(rows({ ...satchel, custom: flower?.custom })).toEqual(['systemData.inventory.0']);
    expect(rows({ ...flower, custom: undefined, container: undefined })).toEqual([
      'systemData.inventory.0',
    ]);
    expect(rows(satchel, { ...lantern, uid: SATCHEL })).toEqual([
      'systemData.inventory.1.uid',
      'systemData.inventory.1.container',
    ]);
    expect(rows(satchel, { ...lantern, uid: 'lantern' })).toEqual(['systemData.inventory.1.uid']);
    expect(rows({ ...lantern, qty: -1, container: undefined })).toEqual([
      'systemData.inventory.0.qty',
    ]);
    expect(rows({ ...satchel, equipped: undefined })).toEqual(['systemData.inventory.0.equipped']);
    expect(rows({ ...flower, custom: { name: ' ' }, container: undefined })).toEqual([
      'systemData.inventory.0.custom.name',
    ]);
    expect(rows(satchel, flower, { ...lantern, container: FLOWER })).toEqual([]);
    expect(rows(flower)).toEqual(['systemData.inventory.0.container']);
    expect(rows({ ...satchel, container: SATCHEL })).toEqual(['systemData.inventory.0.container']);
    expect(rows({ ...satchel, container: FLOWER }, flower)).toEqual([
      'systemData.inventory.0.container',
      'systemData.inventory.1.container',
    ]);
    // The lantern leads into the loop of the other two, but is not part of it.
    expect(rows({ ...satchel, container: FLOWER }, flower, lantern)).toEqual([
      'systemData.inventory.0.container',
      'systemData.inventory.1.container',
    ]);
  });

  it('keeps money and the trackers to their bounds', () => {
    const { ep: _left, ...noElectrum } = systemData.currency;
    expect(refused({ currency: noElectrum })).toEqual(['systemData.currency.ep']);
    expect(refused({ currency: { ...systemData.currency, gc: 1 } })).toEqual([
      'systemData.currency',
    ]);
    expect(refused({ currency: { ...systemData.currency, gp: 1.5 } })).toEqual([
      'systemData.currency.gp',
    ]);
    const trackers = (change: Record<string, unknown>) =>
      refused({ state: { ...state, ...change } });
    expect(trackers({ hitDiceSpent: { d6: 1, d8: 1, d10: 1, d12: 1 } })).toEqual([]);
    expect(trackers({ hitDiceSpent: { d20: 1 } })).toEqual(['systemData.state.hitDiceSpent.d20']);
    expect(trackers({ hitDiceSpent: { d8: -1 } })).toEqual(['systemData.state.hitDiceSpent.d8']);
    expect(trackers({ slotsSpent: { '9': 1 } })).toEqual([]);
    for (const level of ['0', '10']) {
      expect(trackers({ slotsSpent: { [level]: 1 } }), level).toEqual([
        'systemData.state.slotsSpent',
      ]);
    }
    expect(trackers({ hp: { current: -1, temp: 0 } })).toEqual(['systemData.state.hp.current']);
    expect(trackers({ pactSlotsSpent: -1 })).toEqual(['systemData.state.pactSlotsSpent']);
    expect(trackers({ deathSaves: { success: 3, failure: 3 } })).toEqual([]);
    expect(trackers({ deathSaves: { success: 0, failure: 4 } })).toEqual([
      'systemData.state.deathSaves.failure',
    ]);
    expect(trackers({ concentration: 'lantern-light' })).toEqual([
      'systemData.state.concentration',
    ]);
    expect(trackers({ inspiration: -1 })).toEqual(['systemData.state.inspiration']);
    expect(trackers({ exhaustion: 1 })).toEqual(['systemData.state']);
  });

  it("is fifth edition's: its editions, its version, its entities", () => {
    expect(issuePaths({ ...character, ruleset: '2014' })).toEqual([]);
    expect(issuePaths({ ...character, ruleset: 'any' })).toEqual(['ruleset']);
    expect(issuePaths({ ...character, system: 'tales' })).toEqual(['system']);
    expect(issuePaths({ ...character, systemSchemaVersion: 2 })).toEqual(['systemSchemaVersion']);
    expect(issuePaths({ ...character, localEntities: [{ ...luckyFind, type: 'talent' }] })).toEqual(
      ['localEntities.0.type'],
    );
  });

  it('is read by the core: the species, background, classes and feats are gathered', () => {
    expectTypeOf<FifthEditionCharacter>().toExtend<CharacterCore<FifthEditionEntity>>();
    const entities = [
      {
        id: 'hb-test:ability/san',
        type: 'ability',
        key: 'san',
        ruleset: 'any',
        name: { en: 'Sanity' },
        abbr: { en: 'SAN' },
        order: 1,
        source,
      },
      {
        id: 'hb-test:species/lantern-folk',
        type: 'species',
        ruleset: '2024',
        name: { en: 'Lantern Folk' },
        size: ['small', 'medium'],
        speed: { walk: 30 },
        source,
        grants: [
          {
            id: 'lineage',
            kind: 'entity',
            choose: { count: 1, from: ['hb-test:lineage/ember', 'hb-test:lineage/frost'] },
          },
        ],
      },
      {
        id: 'hb-test:lineage/ember',
        type: 'lineage',
        ruleset: '2024',
        name: { en: 'Ember' },
        source,
      },
      {
        id: 'hb-test:lineage/frost',
        type: 'lineage',
        ruleset: '2024',
        name: { en: 'Frost' },
        source,
      },
      {
        id: 'hb-test:background/lamplighter',
        type: 'background',
        ruleset: '2024',
        name: { en: 'Lamplighter' },
        source,
      },
      ...['warden', 'scholar'].map((key) => ({
        id: `hb-test:class/${key}`,
        type: 'class',
        key,
        ruleset: '2024',
        name: { en: key },
        hitDie: 8,
        saves: ['san'],
        subclassLevel: 3,
        source,
      })),
      {
        id: 'hb-test:subclass/night-watch',
        type: 'subclass',
        key: 'nightWatch',
        classKey: 'warden',
        ruleset: '2024',
        name: { en: 'Night Watch' },
        source,
      },
      {
        id: 'hb-test:feat/steady-hand',
        type: 'feat',
        ruleset: '2024',
        name: { en: 'Steady Hand' },
        source,
      },
    ].map((entity) => fifthEditionEntitySchema.parse(entity));
    const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, [
      { id: 'hb-test', version: '1.0.0', system: FIFTH_EDITION_SYSTEM, entities },
    ]);
    // Only gathering is under test: a module that reads `systemData`, with no values of its own.
    const system: SystemModule<FifthEditionCharacter, FifthEditionEntity> = {
      level: (one) => one.systemData.classes.reduce((sum, entry) => sum + entry.level, 0),
      entities: ({ systemData: data }) => [
        ...[data.species, data.background].flatMap((entry) => (entry ? [{ id: entry.id }] : [])),
        ...data.classes.flatMap((entry) => [
          { id: entry.id, level: entry.level },
          ...(entry.subclass === undefined ? [] : [{ id: entry.subclass, level: entry.level }]),
        ]),
        ...data.feats.map((feat) => ({ id: feat.id })),
      ],
      statDefaults: { defaultMax: 30, modFormula: '0', hasSave: false },
      derive: () => ({}),
    };

    const computed = compute(fifthEditionCharacterSchema.parse(character), index, system);
    expect(computed.entities.map((had) => [had.entity.id, had.level])).toEqual([
      ['hb-test:species/lantern-folk', 4],
      ['hb-test:lineage/ember', 4],
      ['hb-test:background/lamplighter', 4],
      ['hb-test:class/warden', 3],
      ['hb-test:subclass/night-watch', 3],
      ['hb-test:class/scholar', 1],
      ['hb-test:feat/steady-hand', 4],
      ['character:feat/lucky-find', 4],
    ]);
    expect(computed.values.level).toBe(4);
    expect(computed.pendingChoices).toEqual([]);
    expect(computed.warnings).toEqual([]);
  });

  it('types its fields by its lists', () => {
    type Character = z.infer<typeof fifthEditionCharacterSchema>;
    expectTypeOf<Character>().toEqualTypeOf<FifthEditionCharacter>();
    expectTypeOf<Character['ruleset']>().toEqualTypeOf<'2014' | '2024'>();
    expectTypeOf<Character['systemSchemaVersion']>().toEqualTypeOf<1>();
    type Part = Character['systemData'];
    expectTypeOf<Part['classes'][number]['hp'][number]>().toEqualTypeOf<number | 'avg' | 'max'>();
    expectTypeOf<Part['currency']>().toEqualTypeOf<
      Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', number>
    >();
    expectTypeOf<keyof Part['state']['hitDiceSpent']>().toEqualTypeOf<
      'd6' | 'd8' | 'd10' | 'd12'
    >();
    expectTypeOf<Part['abilities']['bonusSource']>().toEqualTypeOf<
      'species' | 'background' | 'both'
    >();
    expectTypeOf<HouseRules['feats']>().toEqualTypeOf<
      'none' | 'own' | 'ownAndOtherOptional' | 'all'
    >();
    expectTypeOf<FifthEditionPack['ruleset']>().toEqualTypeOf<'2014' | '2024' | 'any'>();
  });
});

/** A fifth-edition pack with one entity. */
const pack = {
  id: 'hb-test',
  version: '1.0.0',
  schemaVersion: 1,
  system: '5e',
  systemSchemaVersion: 1,
  title: { en: 'Test pack' },
  ruleset: 'any',
  license: { name: 'Made up for the tests', redistributable: false },
  entities: [luckyFind].map((entity) => ({ ...entity, id: 'hb-test:feat/lucky-find', source })),
};

describe('ENG-33 fifth-edition files open through both chains', () => {
  it('opens a current character and refuses a newer one', () => {
    expect(openFifthEditionCharacter(character)).toEqual({
      ok: true,
      value: character,
      from: { schemaVersion: 1, systemSchemaVersion: 1 },
    });
    expect(openFifthEditionCharacter({ ...character, systemSchemaVersion: 2 })).toMatchObject({
      ok: false,
      code: 'newer',
      field: 'systemSchemaVersion',
      found: 2,
      current: 1,
    });
  });

  it("opens a current pack of fifth edition's entities and refuses a newer one", () => {
    expect(fifthEditionPackSchema.parse(pack)).toEqual(pack);
    expect(openFifthEditionPack(pack)).toEqual({
      ok: true,
      value: pack,
      from: { schemaVersion: 1, systemSchemaVersion: 1 },
    });
    expect(openFifthEditionPack({ ...pack, systemSchemaVersion: 2 })).toMatchObject({
      ok: false,
      code: 'newer',
      field: 'systemSchemaVersion',
      found: 2,
      current: 1,
    });
    const talent = { ...pack.entities[0], id: 'hb-test:talent/lucky-find', type: 'talent' };
    const opened = openFifthEditionPack({ ...pack, entities: [talent] });
    expect(opened.ok).toBe(false);
    expect(opened.ok === false && opened.code).toBe('invalid');
    expect(
      fifthEditionPackSchema.safeParse({ ...pack, entities: [talent] }).error?.issues[0]?.path,
    ).toEqual(['entities', 0, 'type']);
  });
});
