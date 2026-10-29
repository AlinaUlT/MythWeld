import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  fifthEditionModule,
  fifthEditionSlotChange,
  fifthEditionSlotGrid,
  fifthEditionSpellcasting,
  fifthEditionSpells,
  type SlotColumn,
} from '../src/index.ts';
import { hexer, indexOf, ownSpell, stamp, withTrackers } from './action-checks.ts';
import { goldenA, goldenB, goldenC2014, goldenC2024 } from './golden/index.ts';

// SHEET-46: the slot grid and the spell list. Golden A (2014): cleric 1, two level 1 slots.
// Golden C: wizard 3 and paladin 3, slots 4, 3 in 2014 and 4, 3, 2 in 2024 (ENG-20's header). Golden B as the made-up hexer 3: two pact slots of level 2. The
// spells and feats `character:` are made up. Every value was worked out by hand in SHEET-46 §3.

type EntityInput = FifthEditionCharacter['localEntities'][number];
type CharacterInput = Parameters<typeof withTrackers>[0];

const source = { pack: 'character' };
const SPARK = ownSpell('spark', 1, false);
const GLIMMER = ownSpell('glimmer', 1, true);
const FLICKER = ownSpell('flicker', 0, false);
const SURGE = ownSpell('surge', 2, false);
const OWN = [SPARK, GLIMMER, FLICKER, SURGE];
const BLESS = 'srd-2014:spell/bless';
const CURE = 'srd-2014:spell/cure-wounds';
const longAll = [{ on: 'long' as const, amount: 'all' as const }];

/** A made-up ring that gives one slot of level 3, to a character who has none of that level. */
const ring: EntityInput = {
  id: 'character:feat/ring',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Ring' },
  source,
  effects: [{ id: 'slot', target: 'spell.slots.level3', op: 'add', value: 1 }],
};

/** A made-up feat that gives Spark with 1 use a long rest, Glimmer with a slot, and a missing spell. */
const gifted: EntityInput = {
  id: 'character:feat/gifted',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Gifted' },
  source,
  grants: [
    {
      id: 'spark',
      kind: 'spell',
      fixed: [SPARK.id],
      key: 'giftedSpark',
      uses: { max: '1', recovery: longAll },
    },
    { id: 'plain', kind: 'spell', fixed: [GLIMMER.id] },
    { id: 'gone', kind: 'spell', fixed: ['character:spell/gone'] },
  ],
};

const computedOf = (character: FifthEditionCharacter) =>
  compute(character, indexOf(character), fifthEditionModule);

/** The grid of `character`, computed on its edition's pack. */
const gridOf = (character: FifthEditionCharacter) =>
  fifthEditionSlotGrid(character, computedOf(character));

/** The spell list of `character`, computed on its edition's pack. */
const listOf = (character: FifthEditionCharacter) =>
  fifthEditionSpells(character, indexOf(character), computedOf(character));

/** Golden A's Life domain gives Bless and Cure Wounds, always prepared, from its subclass. */
const LIFE = 'srd-2014:subclass/life';
const domainRows = [BLESS, CURE].map((id) => ({
  id,
  from: { kind: 'grant', source: LIFE, part: `${LIFE}#domain-spells-1` },
  alwaysPrepared: true,
}));
/** The rows without the Life domain's. */
const withoutDomain = (rows: ReturnType<typeof listOf>) =>
  rows.filter(({ from }) => from.source !== LIFE);

/** A golden character with the made-up spells and entities, its trackers set. */
function made(
  golden: CharacterInput,
  trackers: Parameters<typeof withTrackers>[1] = {},
  more: Partial<CharacterInput> = {},
): FifthEditionCharacter {
  return withTrackers(golden, trackers, { localEntities: OWN, ...more });
}

describe('SHEET-46 the slot grid', () => {
  it("gives golden A's two slots of level 1, then one spent", () => {
    expect(gridOf(made(goldenA))).toEqual([{ kind: 'slots', level: 1, max: 2, spent: 0, left: 2 }]);
    expect(gridOf(made(goldenA, { slotsSpent: { '1': 1 } }))).toEqual([
      { kind: 'slots', level: 1, max: 2, spent: 1, left: 1 },
    ]);
  });

  it('never shows fewer than none left, and skips a level with no slot', () => {
    const over = gridOf(made(goldenA, { slotsSpent: { '1': 3 } }));
    expect(over).toEqual([{ kind: 'slots', level: 1, max: 2, spent: 3, left: 0 }]);
    expect(gridOf(made(goldenB))).toEqual([]);
  });

  it("gives golden C's slots by level: 4, 3 in 2014 and 4, 3, 2 in 2024", () => {
    expect(gridOf(made(goldenC2014, { slotsSpent: { '2': 1 } }))).toEqual([
      { kind: 'slots', level: 1, max: 4, spent: 0, left: 4 },
      { kind: 'slots', level: 2, max: 3, spent: 1, left: 2 },
    ]);
    expect(gridOf(made(goldenC2024))).toEqual([
      { kind: 'slots', level: 1, max: 4, spent: 0, left: 4 },
      { kind: 'slots', level: 2, max: 3, spent: 0, left: 3 },
      { kind: 'slots', level: 3, max: 2, spent: 0, left: 2 },
    ]);
  });

  it('gives pact magic its own column, after the slots of its level', () => {
    const alone = made(
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
    expect(gridOf(alone)).toEqual([{ kind: 'pact', level: 2, max: 2, spent: 1, left: 1 }]);
    const beside = made(
      goldenC2024,
      {},
      {
        localEntities: [hexer],
        systemData: {
          ...goldenC2024.systemData,
          classes: [
            { id: 'srd-2024:class/wizard', level: 3, hp: ['max', 'avg', 'avg'] },
            { id: 'character:class/hexer', level: 3, hp: [1, 1, 1] },
          ],
        },
      },
    );
    expect(gridOf(beside)).toEqual([
      { kind: 'slots', level: 1, max: 4, spent: 0, left: 4 },
      { kind: 'slots', level: 2, max: 2, spent: 0, left: 2 },
      { kind: 'pact', level: 2, max: 2, spent: 0, left: 2 },
    ]);
  });

  it("follows the character's actual slots: a single higher-level slot has its column", () => {
    const withRing = made(
      goldenA,
      {},
      {
        localEntities: [ring],
        systemData: { ...goldenA.systemData, feats: [{ id: 'character:feat/ring' }] },
      },
    );
    expect(gridOf(withRing)).toEqual([
      { kind: 'slots', level: 1, max: 2, spent: 0, left: 2 },
      { kind: 'slots', level: 3, max: 1, spent: 0, left: 1 },
    ]);
  });
});

describe('SHEET-46 the spell list', () => {
  it("lists a class's prepared spells as stored, then the always prepared ones a grant gives", () => {
    const cleric = made(
      goldenA,
      {},
      {
        systemData: {
          ...goldenA.systemData,
          spells: { 'srd-2014:class/cleric': { prepared: [BLESS, CURE] } },
        },
      },
    );
    const rows = listOf(cleric);
    expect(rows.map(({ id, from, unprepared }) => ({ id, from, unprepared }))).toEqual([
      { id: BLESS, from: { kind: 'list', source: 'srd-2014:class/cleric' }, unprepared: false },
      { id: CURE, from: { kind: 'list', source: 'srd-2014:class/cleric' }, unprepared: false },
      ...domainRows.map(({ id, from }) => ({ id, from, unprepared: false })),
    ]);
    expect(rows.map(({ alwaysPrepared }) => alwaysPrepared)).toEqual([
      undefined,
      undefined,
      true,
      true,
    ]);
    expect(rows.map(({ spell }) => spell?.level)).toEqual([1, 1, 1, 1]);
  });

  it("marks a spellbook's spell that is known and not prepared", () => {
    const wizard = made(
      goldenC2014,
      {},
      {
        systemData: {
          ...goldenC2014.systemData,
          spells: {
            'srd-2014:class/wizard': { known: [SPARK.id, SURGE.id], prepared: [SPARK.id] },
          },
        },
      },
    );
    expect(listOf(wizard).map(({ id, unprepared }) => ({ id, unprepared }))).toEqual([
      { id: SPARK.id, unprepared: false },
      { id: SURGE.id, unprepared: true },
    ]);
  });

  it("lists a grant's spells with their source and, when it has uses, those uses", () => {
    const base = made(
      goldenA,
      {},
      {
        localEntities: [...OWN, gifted],
        systemData: { ...goldenA.systemData, feats: [{ id: gifted.id }] },
      },
    );
    const rows = withoutDomain(listOf(base));
    expect(rows.map(({ id, from, uses }) => ({ id, from, uses }))).toEqual([
      {
        id: SPARK.id,
        from: { kind: 'grant', source: gifted.id, part: `${gifted.id}#spark` },
        uses: { key: 'giftedSpark', max: 1, spent: 0, left: 1, recovery: longAll },
      },
      {
        id: GLIMMER.id,
        from: { kind: 'grant', source: gifted.id, part: `${gifted.id}#plain` },
        uses: undefined,
      },
      {
        id: 'character:spell/gone',
        from: { kind: 'grant', source: gifted.id, part: `${gifted.id}#gone` },
        uses: undefined,
      },
    ]);
    const spent = made(
      goldenA,
      { resources: { giftedSpark: 1 } },
      {
        localEntities: [...OWN, gifted],
        systemData: { ...goldenA.systemData, feats: [{ id: gifted.id }] },
      },
    );
    expect(withoutDomain(listOf(spent))[0]?.uses).toMatchObject({ max: 1, spent: 1, left: 0 });
  });

  it('keeps a spell no pack has, without its entry, so the sheet can say it is missing', () => {
    const rows = listOf(
      made(
        goldenA,
        {},
        {
          localEntities: [...OWN, gifted],
          systemData: { ...goldenA.systemData, feats: [{ id: gifted.id }] },
        },
      ),
    );
    const gone = rows.find(({ id }) => id === 'character:spell/gone');
    expect(gone?.spell).toBeUndefined();
  });

  it("names the ruleset of a spell that is not the character's, never one that is any", () => {
    const other = { ...ownSpell('echo', 1, false), ruleset: '2024' } as EntityInput;
    const rows = listOf(
      made(
        goldenA,
        {},
        {
          localEntities: [...OWN, other],
          systemData: {
            ...goldenA.systemData,
            spells: { 'srd-2014:class/cleric': { prepared: [SPARK.id, other.id] } },
          },
        },
      ),
    );
    expect(withoutDomain(rows).map(({ id, otherRuleset }) => ({ id, otherRuleset }))).toEqual([
      { id: SPARK.id, otherRuleset: undefined },
      { id: other.id, otherRuleset: '2024' },
    ]);
  });

  it('is empty for a character with no spells', () => {
    expect(listOf(made(goldenB))).toEqual([]);
  });
});

describe('SHEET-46 spellcasting at a glance', () => {
  /** A made-up feat that gives Spark cast with Intelligence. */
  const clever: EntityInput = {
    id: 'character:feat/clever',
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Clever' },
    source,
    grants: [{ id: 'spark', kind: 'spell', fixed: [SPARK.id], ability: 'int' }],
  };
  const castingOf = (character: FifthEditionCharacter) =>
    fifthEditionSpellcasting(character, computedOf(character));

  it("gives the casting class's row, then one for each stat a spell grant names", () => {
    const plain = made(goldenA);
    expect(castingOf(plain)).toEqual([
      {
        source: 'srd-2014:class/cleric',
        ability: 'wis',
        dc: 'classes.cleric.spell.dc',
        attack: 'classes.cleric.spell.attack',
      },
    ]);
    const clevered = made(
      goldenA,
      {},
      {
        localEntities: [...OWN, clever],
        systemData: { ...goldenA.systemData, feats: [{ id: clever.id }] },
      },
    );
    expect(castingOf(clevered)).toEqual([
      ...castingOf(plain),
      {
        source: clever.id,
        ability: 'int',
        dc: 'abilities.int.spell.dc',
        attack: 'abilities.int.spell.attack',
      },
    ]);
  });

  it('adds no row for a grant that names no stat, or for a character who casts nothing', () => {
    const gives = made(
      goldenB,
      {},
      {
        localEntities: [...OWN, gifted],
        systemData: { ...goldenB.systemData, feats: [{ id: gifted.id }] },
      },
    );
    expect(castingOf(gives)).toEqual([]);
    expect(castingOf(made(goldenB))).toEqual([]);
  });
});

describe('SHEET-46 a tap on a circle of the grid', () => {
  const change = (character: FifthEditionCharacter, column: SlotColumn, spend: boolean) =>
    fifthEditionSlotChange(character, indexOf(character), column, spend, stamp);
  const level1: SlotColumn = { kind: 'slots', level: 1, max: 2, spent: 0, left: 2 };

  it('spends one slot of the level, and gives one back', () => {
    const spent = change(made(goldenA), level1, true);
    expect(spent).toMatchObject({ ok: true, entry: { action: 'spendSlot', subject: '1' } });
    const back = change(made(goldenA, { slotsSpent: { '1': 2 } }), level1, false);
    expect(back).toMatchObject({ ok: true, entry: { action: 'regainSlot', subject: '1' } });
    if (!back.ok) throw new Error('refused');
    expect(back.entry.changes).toEqual([
      { path: ['systemData', 'state', 'slotsSpent', '1'], before: 2, after: 1 },
    ]);
  });

  it('spends and gives back a pact slot', () => {
    const column: SlotColumn = { kind: 'pact', level: 2, max: 2, spent: 0, left: 2 };
    const pact = made(
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
    expect(change(pact, column, true)).toMatchObject({ ok: true, entry: { subject: 'pact' } });
    expect(change(pact, column, false)).toMatchObject({
      ok: true,
      entry: { action: 'regainSlot', subject: 'pact' },
    });
  });

  it('is refused with none left to spend, and with none spent to give back', () => {
    expect(change(made(goldenA, { slotsSpent: { '1': 2 } }), level1, true)).toMatchObject({
      ok: false,
      code: 'noSlotLeft',
    });
    expect(change(made(goldenA), level1, false)).toMatchObject({ ok: false, code: 'unchanged' });
  });
});
