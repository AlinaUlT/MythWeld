import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionGrantedCasting,
  fifthEditionModule,
  fifthEditionSlots,
  fifthEditionSpells,
} from '../src/index.ts';
import { type CharacterInput, indexOf, ownSpell, withTrackers } from './action-checks.ts';
import { goldenA, goldenC2014 } from './golden/index.ts';

// SHEET-46: what the Spells tab names. Golden A (2014): a hill dwarf cleric 1 of the Life domain,
// two level 1 slots, Bless and Cure Wounds always prepared by the domain's spell grant (ENG-15's
// golden values), Intelligence 8 (modifier −1), proficiency bonus +2. Golden C (2014): wizard 3
// and paladin 3, caster level 4, slots 4 and 3 (SRD 5.1's multiclass table). The feat and its
// spells are made up; their uses take the shape ENG-57 §8 gives the SRD traits (once, back on a
// long rest).

const BLESS = 'srd-2014:spell/bless';
const CURE_WOUNDS = 'srd-2014:spell/cure-wounds';
const CLERIC = 'srd-2014:class/cleric';
const LIFE = 'srd-2014:subclass/life';
const DOMAIN_SPELLS = `${LIFE}#domain-spells-1`;
const FEAT = 'character:feat/gifted';
const SPARK = ownSpell('spark', 1, false);

type EntityInput = FifthEditionCharacter['localEntities'][number];
type Grants = NonNullable<Extract<EntityInput, { type: 'feat' }>['grants']>;

const sparkGrant = {
  id: 'spark',
  kind: 'spell',
  fixed: [SPARK.id],
  ability: 'int',
  key: 'giftedSpark',
  uses: { max: '1', recovery: [{ on: 'long' as const, amount: 'all' as const }] },
} satisfies Grants[number];

/** The made-up feat with `grants`. */
function gifted(grants: Grants) {
  return {
    id: FEAT,
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Gifted' },
    source: { pack: 'character' },
    grants,
  } satisfies EntityInput;
}

/** Golden A with the feat, its spell, and its trackers set. */
function withFeat(grants: Grants, trackers: Parameters<typeof withTrackers>[1] = {}) {
  return withTrackers(goldenA, trackers, {
    localEntities: [SPARK, gifted(grants)],
    systemData: { ...goldenA.systemData, feats: [...goldenA.systemData.feats, { id: FEAT }] },
  });
}

function sheetOf(golden: CharacterInput | FifthEditionCharacter) {
  const character = withTrackers(golden as CharacterInput, {});
  const computed = compute(character, indexOf(character), fifthEditionModule);
  return { character, computed, index: indexOf(character) };
}

describe('SHEET-46 the slot grid', () => {
  it('golden A: one column, level 1, two slots, none spent', () => {
    const { character, computed } = sheetOf(goldenA);
    expect(fifthEditionSlots(character, computed)).toEqual([
      { key: '1', level: 1, path: 'spell.slots.level1', max: 2, spent: 0, left: 2 },
    ]);
  });

  it('golden A with one slot spent: one left', () => {
    const character = withTrackers(goldenA, { slotsSpent: { '1': 1 } });
    const computed = compute(character, indexOf(character), fifthEditionModule);
    expect(fifthEditionSlots(character, computed)).toEqual([
      { key: '1', level: 1, path: 'spell.slots.level1', max: 2, spent: 1, left: 1 },
    ]);
  });

  it('golden C: a column for levels 1 and 2 only, 4 and 3 slots; none for level 3', () => {
    const { character, computed } = sheetOf(goldenC2014);
    expect(fifthEditionSlots(character, computed).map(({ key, max }) => [key, max])).toEqual([
      ['1', 4],
      ['2', 3],
    ]);
  });

  it('keeps more spent than the maximum as stored, with none left', () => {
    const character = withTrackers(goldenC2014, { slotsSpent: { '2': 5 } });
    const computed = compute(character, indexOf(character), fifthEditionModule);
    const second = fifthEditionSlots(character, computed).find(({ key }) => key === '2');
    expect(second).toMatchObject({ max: 3, spent: 5, left: 0 });
  });

  it('has no column for a character that casts nothing', () => {
    const fighter = { ...goldenA, systemData: { ...goldenA.systemData, classes: [] } };
    const character = withTrackers(fighter as CharacterInput, {});
    const computed = compute(character, indexOf(character), fifthEditionModule);
    expect(fifthEditionSlots(character, computed)).toEqual([]);
  });
});

describe('SHEET-46 the spells', () => {
  it("golden A: the domain's two spells, granted, with the grant's part and no limit", () => {
    const { character, computed, index } = sheetOf(goldenA);
    const rows = fifthEditionSpells(character, computed, index);
    expect(rows.map(({ id, spell, from }) => [id, spell?.level, from])).toEqual([
      [BLESS, 1, { kind: 'grant', source: LIFE, part: DOMAIN_SPELLS }],
      [CURE_WOUNDS, 1, { kind: 'grant', source: LIFE, part: DOMAIN_SPELLS }],
    ]);
  });

  it('lists a class list once: prepared ones as prepared, the rest as known, a missing one bare', () => {
    const character = withTrackers(
      goldenA,
      {},
      {
        systemData: {
          ...goldenA.systemData,
          spells: {
            [CLERIC]: { known: [BLESS, 'srd-2014:spell/nope'], prepared: [BLESS, CURE_WOUNDS] },
          },
        },
      },
    );
    const computed = compute(character, indexOf(character), fifthEditionModule);
    const own = fifthEditionSpells(character, computed, indexOf(character)).filter(
      ({ from }) => from.kind === 'class',
    );
    expect(own.map(({ id, spell, from }) => [id, spell !== undefined, from])).toEqual([
      [BLESS, true, { kind: 'class', source: CLERIC, state: 'prepared' }],
      [CURE_WOUNDS, true, { kind: 'class', source: CLERIC, state: 'prepared' }],
      ['srd-2014:spell/nope', false, { kind: 'class', source: CLERIC, state: 'known' }],
    ]);
  });

  it("a grant's own uses are its limit: the maximum, the spent, what is left, what gives them back", () => {
    const character = withFeat([sparkGrant], { resources: { giftedSpark: 1 } });
    const computed = compute(character, indexOf(character), fifthEditionModule);
    const spark = fifthEditionSpells(character, computed, indexOf(character)).find(
      ({ id }) => id === SPARK.id,
    );
    expect(spark?.from).toEqual({
      kind: 'grant',
      source: FEAT,
      part: `${FEAT}#spark`,
      limit: {
        key: 'giftedSpark',
        max: 1,
        spent: 1,
        left: 0,
        recovery: [{ on: 'long', amount: 'all' }],
      },
    });
  });

  it('a grant without uses has no limit: its spell is cast with a slot', () => {
    const plain = { id: 'plain', kind: 'spell', fixed: [SPARK.id] } satisfies Grants[number];
    const { character, computed, index } = sheetOf(withFeat([plain]));
    const spark = fifthEditionSpells(character, computed, index).find(({ id }) => id === SPARK.id);
    expect(spark?.from).toEqual({ kind: 'grant', source: FEAT, part: `${FEAT}#plain` });
  });
});

describe("SHEET-46 a granted spell's own casting", () => {
  it('names a stat a grant gives its spells: Intelligence 8, DC 8 − 1 + 2 = 9, attack −1 + 2 = +1', () => {
    const { computed } = sheetOf(withFeat([sparkGrant]));
    const lines = fifthEditionGrantedCasting(computed);
    expect(lines).toEqual([
      {
        source: 'int',
        ability: 'int',
        dc: 'abilities.int.spell.dc',
        attack: 'abilities.int.spell.attack',
      },
    ]);
    expect(computed.values['abilities.int.spell.dc']).toBe(9);
    expect(computed.values['abilities.int.spell.attack']).toBe(1);
  });

  it('names none when no grant names a stat: golden A', () => {
    expect(fifthEditionGrantedCasting(sheetOf(goldenA).computed)).toEqual([]);
  });
});
