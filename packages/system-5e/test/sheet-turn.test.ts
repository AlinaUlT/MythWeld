import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import { type FifthEditionCharacter, fifthEditionModule, fifthEditionTurn } from '../src/index.ts';
import { indexOf, withTrackers } from './action-checks.ts';
import { goldenB } from './golden/index.ts';

// SHEET-49: the Turn tab's groups. Golden B (2024: fighter 1) has Second Wind, a Bonus Action in
// SRD 5.2.1 ("As a Bonus Action, you can ..."), with uses of its own. The made-up feat `drill`
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
    expect(groups).toEqual([
      {
        timing: 'bonus',
        rows: [
          {
            id: 'srd-2024:feature/fighter-second-wind',
            source: { kind: 'class', source: 'srd-2024:class/fighter' },
            resources: ['secondWind'],
          },
        ],
      },
    ]);
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
      ['passive', ['character:feature/poise']],
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
    });
    const limited = turnOf(b).find(({ timing }) => timing === 'limited');
    expect(limited?.rows).toEqual([
      { id: 'character:feature/rally', source: { kind: 'feats' }, resources: ['rally'] },
    ]);
  });

  it('is empty for a character whose features say no timing and have no uses', () => {
    expect(
      turnOf(withTrackers(goldenB, {}, { systemData: { ...goldenB.systemData, classes: [] } })),
    ).toEqual([]);
  });
});
