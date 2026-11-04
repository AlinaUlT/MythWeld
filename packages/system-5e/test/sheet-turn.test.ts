import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import { type FifthEditionCharacter, fifthEditionModule, fifthEditionTurn } from '../src/index.ts';
import { indexOf, open, withTrackers } from './action-checks.ts';
import { goldenB } from './golden/index.ts';

// SHEET-49: the Turn tab's groups. Golden B (2024: fighter 1) has Second Wind, a Bonus Action in
// SRD 5.2.1 ("As a Bonus Action, you can ..."), with uses of its own.
// SHEET-76: golden B also has three feats, Savage Attacker (once per turn), Alert and Defense (always
// on). Alert adds the proficiency bonus to Initiative, +2 at level 1 (SPEC §6.7: Init +3 is Dexterity
// +1 and Alert +2); Defense adds +1 to AC (SPEC §6.7: AC 17 is chain mail 16 and Defense 1). The made-up feat `drill`
// gives made-up features, one for each timing, to see the order and what is left out. Every
// expected group and row follows from those names and timings, set by hand here.

type EntityInput = FifthEditionCharacter['localEntities'][number];

const source = { pack: 'character' };
const feature = (slug: string, activation?: string, uses?: string): EntityInput =>
  ({
    id: `character:feature/${slug}`,
    type: 'feature',
    ruleset: 'any',
    name: { en: slug },
    source,
    ...(activation !== undefined && { activation }),
    ...(uses !== undefined && {
      grants: [
        {
          id: 'uses',
          kind: 'resource',
          key: slug,
          label: { en: slug },
          uses: { max: uses, recovery: [{ on: 'long', amount: 'all' }] },
        },
      ],
    }),
  }) as EntityInput;

const FEATURES = [
  feature('quiet'),
  feature('surge', 'bonus', '2'),
  feature('sidestep', 'reaction'),
  feature('strike', 'action'),
  feature('knack', 'special'),
  feature('poise', 'passive'),
  feature('flourish', 'free'),
  feature('thrill', 'oncePerTurn'),
  feature('rally', undefined, '3'),
];

const drill: EntityInput = {
  id: 'character:feat/drill',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Drill' },
  source,
  grants: [{ id: 'all', kind: 'entity', fixed: FEATURES.map(({ id }) => id) }],
} as EntityInput;

const turnOf = (character: FifthEditionCharacter) =>
  fifthEditionTurn(character, compute(character, indexOf(character), fifthEditionModule));

describe('SHEET-49 the features by timing', () => {
  it('lists Second Wind under bonus actions, with the key of its uses', () => {
    const groups = turnOf(withTrackers(goldenB, {}));
    expect(groups.find(({ timing }) => timing === 'bonus')).toEqual({
      timing: 'bonus',
      rows: [
        {
          id: 'srd-2024:feature/fighter-second-wind',
          source: { kind: 'class', source: 'srd-2024:class/fighter' },
          resources: ['secondWind'],
          numbers: [],
        },
      ],
    });
  });

  it('SHEET-76 lists the feats by their timing: Savage Attacker once per turn, Alert and Defense always on', () => {
    const groups = turnOf(withTrackers(goldenB, {}));
    const ids = (timing: string) =>
      (groups.find((group) => group.timing === timing)?.rows ?? []).map(({ id }) => id).sort();
    expect(groups.map(({ timing }) => timing)).toEqual(['bonus', 'oncePerTurn', 'passive']);
    expect(ids('oncePerTurn')).toEqual(['srd-2024:feat/savage-attacker']);
    expect(ids('passive')).toEqual(['srd-2024:feat/alert', 'srd-2024:feat/defense']);
  });

  it('SHEET-76 gives an always-on feat the numbers its effects add: Alert +2 to Initiative, Defense +1 to AC', () => {
    const passive = turnOf(withTrackers(goldenB, {})).find(({ timing }) => timing === 'passive');
    const numbers = (id: string) => passive?.rows.find((row) => row.id === id)?.numbers;
    expect(numbers('srd-2024:feat/alert')).toEqual([
      { path: 'init.bonus', of: 'init.total', change: 2 },
    ]);
    expect(numbers('srd-2024:feat/defense')).toEqual([
      { path: 'ac.bonus', of: 'ac.total', change: 1 },
    ]);
  });

  it('SHEET-76 leaves out the number of an effect that does not apply: Defense with no armor worn', () => {
    const bare = {
      ...goldenB,
      systemData: {
        ...goldenB.systemData,
        inventory: goldenB.systemData.inventory.map((row) => ({ ...row, equipped: false })),
      },
    };
    const passive = turnOf(withTrackers(bare, {})).find(({ timing }) => timing === 'passive');
    expect(passive?.rows.find(({ id }) => id === 'srd-2024:feat/defense')?.numbers).toEqual([]);
    expect(passive?.rows.find(({ id }) => id === 'srd-2024:feat/alert')?.numbers).toHaveLength(1);
  });

  it('SHEET-76 reads no number for a row that is not always on', () => {
    const groups = turnOf(withTrackers(goldenB, {}));
    for (const group of groups.filter(({ timing }) => timing !== 'passive')) {
      for (const row of group.rows) expect(row.numbers, row.id).toEqual([]);
    }
  });

  it('groups by each feature’s activation, in the board’s order, leaving out what says nothing', () => {
    const b = withTrackers(
      goldenB,
      {},
      {
        localEntities: [drill, ...FEATURES],
        systemData: { ...goldenB.systemData, feats: [{ id: drill.id }] },
      },
    );
    const groups = turnOf(b);
    expect(groups.map(({ timing, rows }) => [timing, rows.map(({ id }) => id)])).toEqual([
      ['action', ['character:feature/strike']],
      ['bonus', ['srd-2024:feature/fighter-second-wind', 'character:feature/surge']],
      ['reaction', ['character:feature/sidestep']],
      ['free', ['character:feature/flourish']],
      ['oncePerTurn', ['srd-2024:feat/savage-attacker', 'character:feature/thrill']],
      ['passive', ['srd-2024:feat/alert', 'srd-2024:feat/defense', 'character:feature/poise']],
      ['special', ['character:feature/knack']],
      ['limited', ['character:feature/rally']],
    ]);
  });

  it('names where each feature comes from and the keys of its own uses', () => {
    const b = withTrackers(
      goldenB,
      {},
      {
        localEntities: [drill, ...FEATURES],
        systemData: { ...goldenB.systemData, feats: [{ id: drill.id }] },
      },
    );
    const bonus = turnOf(b).find(({ timing }) => timing === 'bonus');
    expect(bonus?.rows.at(-1)).toEqual({
      id: 'character:feature/surge',
      source: { kind: 'feats' },
      resources: ['surge'],
      numbers: [],
    });
    const limited = turnOf(b).find(({ timing }) => timing === 'limited');
    expect(limited?.rows).toEqual([
      {
        id: 'character:feature/rally',
        source: { kind: 'feats' },
        resources: ['rally'],
        numbers: [],
      },
    ]);
  });

  it('is empty for a character whose features say no timing and have no uses', () => {
    // No class, species or background: the feats they give (SHEET-76: they now say a timing) go too.
    const { species: _s, background: _b, ...rest } = goldenB.systemData;
    expect(turnOf(open({ ...goldenB, systemData: { ...rest, classes: [] } }))).toEqual([]);
  });
});
