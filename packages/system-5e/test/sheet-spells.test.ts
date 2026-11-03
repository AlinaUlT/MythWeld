import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionModule,
  fifthEditionSpells,
  PACT_LEVEL_PATH,
  PACT_SLOTS_PATH,
} from '../src/index.ts';
import { indexOf, open, ownSpell, withTrackers } from './action-checks.ts';
import { goldenA, goldenC2014 } from './golden/index.ts';

// SHEET-46: what the Spells tab names. Golden A (2014, SPEC §6.7) is a cleric 1 with two level 1
// slots and the Life domain's Bless and Cure Wounds, always prepared (SRD 5.1). Golden C is a
// wizard 3 and paladin 3: SRD 5.1's multiclass spellcaster table gives caster level 3 + 3 ÷ 2
// rounded down = 4, which has four level 1 and three level 2 slots. The feat and its spell are made
// up; the pact slots are given to the view as a computed value would be.

type EntityInput = FifthEditionCharacter['localEntities'][number];

const shown = (character: FifthEditionCharacter) =>
  fifthEditionSpells(character, compute(character, indexOf(character), fifthEditionModule));

describe('SHEET-46 the slot grid', () => {
  it('has a column for each level the character has slots of, with the spent ones', () => {
    expect(shown(open(goldenA)).slots).toEqual([
      { slot: { level: 1 }, level: 1, max: 2, spent: 0 },
    ]);
    expect(shown(withTrackers(goldenA, { slotsSpent: { 1: 1 } })).slots[0]?.spent).toBe(1);
  });

  it('follows a multiclass caster: four level 1 and three level 2 slots', () => {
    expect(shown(open(goldenC2014)).slots.map(({ level, max }) => [level, max])).toEqual([
      [1, 4],
      [2, 3],
    ]);
  });

  it('never shows more spent than there are', () => {
    expect(shown(withTrackers(goldenA, { slotsSpent: { 1: 5 } })).slots[0]?.spent).toBe(2);
  });

  it('adds pact magic’s slots as a column of their own', () => {
    const view = fifthEditionSpells(open(goldenA), {
      values: { [PACT_SLOTS_PATH]: 2, [PACT_LEVEL_PATH]: 2 },
      grants: [],
    });
    expect(view.slots).toEqual([{ slot: 'pact', level: 2, max: 2, spent: 0 }]);
    const spent = fifthEditionSpells(withTrackers(goldenA, { pactSlotsSpent: 1 }), {
      values: { [PACT_SLOTS_PATH]: 2, [PACT_LEVEL_PATH]: 2 },
      grants: [],
    });
    expect(spent.slots[0]?.spent).toBe(1);
  });

  it('has none for a character with no slots', () => {
    expect(
      shown(open({ ...goldenA, systemData: { ...goldenA.systemData, classes: [] } })).slots,
    ).toEqual([]);
  });
});

describe('SHEET-46 the spells of a class and of its grants', () => {
  it('gives the Life domain’s spells as granted, always prepared, with no uses of their own', () => {
    expect(shown(open(goldenA)).granted).toEqual([
      {
        spell: 'srd-2014:spell/bless',
        part: 'srd-2014:subclass/life#domain-spells-1',
        from: 'srd-2014:subclass/life',
        alwaysPrepared: true,
      },
      {
        spell: 'srd-2014:spell/cure-wounds',
        part: 'srd-2014:subclass/life#domain-spells-1',
        from: 'srd-2014:subclass/life',
        alwaysPrepared: true,
      },
    ]);
  });

  it('lists what each class or subclass knows and has prepared, in the order stored', () => {
    const cleric = 'srd-2014:class/cleric';
    const view = shown(
      open({
        ...goldenA,
        systemData: {
          ...goldenA.systemData,
          spells: {
            [cleric]: { prepared: ['srd-2014:spell/bless'], known: ['srd-2014:spell/cure-wounds'] },
          },
        },
      }),
    );
    expect(view.lists).toEqual([
      { owner: cleric, known: ['srd-2014:spell/cure-wounds'], prepared: ['srd-2014:spell/bless'] },
    ]);
    expect(shown(open(goldenA)).lists).toEqual([]);
  });

  it('pairs a spell a grant gives with the key of its own uses', () => {
    const feat = {
      id: 'character:feat/gifted',
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Gifted' },
      source: { pack: 'character' },
      grants: [
        {
          id: 'spark',
          kind: 'spell',
          fixed: ['character:spell/spark'],
          key: 'giftedSpark',
          uses: { max: '1', recovery: [{ on: 'long', amount: 'all' }] },
        },
      ],
    } satisfies EntityInput;
    const view = shown(
      open({
        ...goldenA,
        localEntities: [feat, ownSpell('spark', 1, false)],
        systemData: { ...goldenA.systemData, feats: [{ id: feat.id }] },
      }),
    );
    expect(view.granted.find(({ spell }) => spell === 'character:spell/spark')).toEqual({
      spell: 'character:spell/spark',
      part: 'character:feat/gifted#spark',
      from: 'character:feat/gifted',
      key: 'giftedSpark',
      alwaysPrepared: false,
    });
  });
});
