import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionModule,
  fifthEditionSlots,
  fifthEditionSpellRows,
} from '../src/index.ts';
import { type CharacterInput, hexer, indexOf, ownSpell, withTrackers } from './action-checks.ts';
import { goldenA, goldenB, goldenC2014, goldenC2024 } from './golden/index.ts';

// SHEET-46: the Spells tab's slot grid and spell list. The slot counts are SPEC §6.7's: golden A
// (cleric 1, 2014) has 2 level 1 slots; golden C (wizard 3, then paladin 3) has 4 and 3 in 2014
// and 4, 3 and 2 in 2024. The made-up spells and feat take the shapes of ENG-57's test.

type EntityInput = FifthEditionCharacter['localEntities'][number];
type Grants = NonNullable<Extract<EntityInput, { type: 'feat' }>['grants']>;

const SPARK = ownSpell('spark', 1, false);
const GLIMMER = ownSpell('glimmer', 0, false);
const OTHER = { ...ownSpell('other', 2, false), ruleset: '2024' } as EntityInput;
const GONE = 'character:spell/gone';
const CLERIC = 'srd-2014:class/cleric';
const FEAT = 'character:feat/gifted';
const longAll = [{ on: 'long' as const, amount: 'all' as const }];
const sparkGrant = {
  id: 'spark',
  kind: 'spell',
  fixed: [SPARK.id],
  key: 'giftedSpark',
  uses: { max: '1', recovery: [...longAll, { on: 'short' as const, amount: '1' }] },
} satisfies Grants[number];
const plainGrant = { id: 'plain', kind: 'spell', fixed: [GLIMMER.id] } satisfies Grants[number];

const gifted = {
  id: FEAT,
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Gifted' },
  source: { pack: 'character' },
  grants: [sparkGrant, plainGrant],
} satisfies EntityInput;

/** A golden character with the made-up spells and feat, its trackers set. */
function caster(
  golden: CharacterInput,
  trackers: Parameters<typeof withTrackers>[1] = {},
  more: Partial<CharacterInput> = {},
): FifthEditionCharacter {
  return withTrackers(golden, trackers, {
    localEntities: [SPARK, GLIMMER, OTHER, gifted],
    ...more,
  });
}

const computed = (character: FifthEditionCharacter) =>
  compute(character, indexOf(character), fifthEditionModule);
const slots = (character: FifthEditionCharacter) =>
  fifthEditionSlots(character, computed(character));
const rows = (character: FifthEditionCharacter) =>
  fifthEditionSpellRows(character, computed(character), indexOf(character));

describe('SHEET-46 the slot grid', () => {
  it('golden A: one column, level 1, 2 slots, both there', () => {
    expect(slots(caster(goldenA))).toEqual([{ key: '1', level: 1, pact: false, max: 2, left: 2 }]);
  });

  it('counts the spent slots out of each column, never below 0', () => {
    const spent = caster(goldenA, { slotsSpent: { '1': 1 } });
    expect(slots(spent)[0]).toMatchObject({ max: 2, left: 1 });
    const over = caster(goldenA, { slotsSpent: { '1': 5 } });
    expect(slots(over)[0]).toMatchObject({ max: 2, left: 0 });
  });

  it('golden C: 4 and 3 slots in 2014, 4, 3 and 2 in 2024; a level with none has no column', () => {
    const grid = (golden: CharacterInput) =>
      slots(caster(golden)).map(({ level, max }) => [level, max]);
    expect(grid(goldenC2014)).toEqual([
      [1, 4],
      [2, 3],
    ]);
    expect(grid(goldenC2024)).toEqual([
      [1, 4],
      [2, 3],
      [3, 2],
    ]);
  });

  it('a character with no slots has no column', () => {
    expect(slots(caster(goldenB))).toEqual([]);
  });

  it('puts pact magic in a column of its own, after the levels: 2 slots of level 2', () => {
    const pact = caster(
      goldenB,
      { pactSlotsSpent: 1 },
      {
        localEntities: [hexer],
        systemData: {
          ...goldenB.systemData,
          classes: [{ id: 'character:class/hexer', level: 3, hp: ['max', 1, 1] }],
        },
      },
    );
    expect(slots(pact)).toEqual([{ key: 'pact', level: 2, pact: true, max: 2, left: 1 }]);
  });
});

describe('SHEET-46 the spell list', () => {
  const withSpells = (spells: CharacterInput['systemData']['spells'], trackers = {}) =>
    caster(goldenA, trackers, {
      systemData: { ...goldenA.systemData, spells, feats: [{ id: FEAT }] },
    });

  it('lists what a class prepared, then what a feature grants, by level, a cantrip first', () => {
    const list = rows(withSpells({ [CLERIC]: { prepared: ['srd-2014:spell/bless', SPARK.id] } }));
    expect(list.map(({ id, from, level }) => [id, from, level])).toEqual([
      [GLIMMER.id, 'grant', 0],
      ['srd-2014:spell/bless', 'class', 1],
      [SPARK.id, 'class', 1],
      // Golden A's Life domain grants these two (SPEC §6.7's "domain spells").
      ['srd-2014:spell/bless', 'grant', 1],
      ['srd-2014:spell/cure-wounds', 'grant', 1],
      [SPARK.id, 'grant', 1],
    ]);
  });

  it('gives a granted spell its source, and its own uses with their recovery', () => {
    const list = rows(withSpells({}, { resources: { giftedSpark: 1 } }));
    const spark = list.find(({ id }) => id === SPARK.id);
    expect(spark).toMatchObject({
      from: 'grant',
      source: FEAT,
      grant: `${FEAT}#spark`,
      uses: { key: 'giftedSpark', max: 1, left: 0, recovery: ['long', 'short'] },
    });
    // A grant without uses is a plain row.
    const glimmer = list.find(({ id }) => id === GLIMMER.id);
    expect(glimmer?.uses).toBeUndefined();
  });

  it('marks a known spell of a class that prepares, when it is not prepared', () => {
    const list = rows(
      withSpells({ [CLERIC]: { known: [SPARK.id, 'srd-2014:spell/bless'], prepared: [SPARK.id] } }),
    );
    const own = list.filter(({ from }) => from === 'class');
    expect(own.map(({ id, prepared }) => [id, prepared])).toEqual([
      [SPARK.id, true],
      ['srd-2014:spell/bless', false],
    ]);
  });

  it("warns of a spell of the other edition, and not of one of 'any'", () => {
    const list = rows(withSpells({ [CLERIC]: { prepared: [OTHER.id, SPARK.id] } }));
    const flags = Object.fromEntries(list.map(({ id, otherRuleset }) => [id, otherRuleset]));
    expect(flags[OTHER.id]).toBe(true);
    expect(flags[SPARK.id]).toBe(false);
    expect(list.find(({ id }) => id === OTHER.id)?.ruleset).toBe('2024');
  });

  it('keeps a spell no pack has as a row, last, with no name', () => {
    const list = rows(withSpells({ [CLERIC]: { prepared: [GONE, SPARK.id] } }));
    const last = list.at(-1);
    expect(last).toMatchObject({ id: GONE, otherRuleset: false });
    expect(last?.name).toBeUndefined();
    expect(last?.level).toBeUndefined();
  });

  it('is empty for a character that has no spells', () => {
    expect(rows(caster(goldenB, {}, { localEntities: [] }))).toEqual([]);
  });
});
