import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionFeatures,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2014, srd2024 } from './golden/index.ts';

// SHEET-48: the groups of the Features tab. Golden B (SPEC §6.7) is a human fighter 1 with the
// Soldier background; golden A a hill dwarf Life cleric 1 with the Acolyte background. Which
// features each gives is the packs' (SRD 5.2.1 and 5.1): the human's three traits, the fighter's
// level 1 features (Fighting Style, Second Wind, Weapon Mastery), the cleric's, the Life domain's.
// The feat below is made up.

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

function groupsOf(golden: typeof goldenA | typeof goldenB, extra: object = {}) {
  const character = opened(openFifthEditionCharacter({ ...golden, ...extra }));
  const { index } = golden === goldenA ? index2014 : index2024;
  const computed = compute(character, index, fifthEditionModule);
  return { computed, groups: fifthEditionFeatures(character, computed) };
}

const ids = (rows: readonly { id: string }[]) => rows.map(({ id }) => id);

describe('SHEET-48 golden B’s features by source', () => {
  const { groups } = groupsOf(goldenB);

  it('groups the species, the class and the background, in that order', () => {
    expect(groups.map(({ kind, source }) => [kind, source])).toEqual([
      ['species', 'srd-2024:species/human'],
      ['class', 'srd-2024:class/fighter'],
      ['background', 'srd-2024:background/soldier'],
    ]);
  });

  it('keeps a feat a feature gives with the group of that feature: Versatile gives Alert', () => {
    expect(ids(groups[0]?.rows ?? [])).toEqual([
      'srd-2024:feature/resourceful',
      'srd-2024:feature/skillful',
      'srd-2024:feature/versatile',
      'srd-2024:feat/alert',
    ]);
    expect(ids(groups[2]?.rows ?? [])).toEqual(['srd-2024:feat/savage-attacker']);
  });

  it('gives the fighter its level and its level 1 features, Second Wind with its uses', () => {
    const fighter = groups[1];
    expect(fighter?.level).toBe(1);
    expect(ids(fighter?.rows ?? [])).toEqual([
      'srd-2024:feature/fighter-fighting-style',
      'srd-2024:feat/defense',
      'srd-2024:feature/fighter-second-wind',
      'srd-2024:feature/fighter-weapon-mastery',
    ]);
    expect(fighter?.rows.find(({ id }) => id.endsWith('second-wind'))?.resources).toEqual([
      'secondWind',
    ]);
    expect(fighter?.rows.flatMap(({ resources }) => resources)).toEqual(['secondWind']);
  });

  it('says the subclass is chosen at the level the class names: the fighter’s third', () => {
    expect(groups[1]?.subclass).toEqual({ chosenAt: 3 });
  });
});

describe('SHEET-48 golden A’s features by source', () => {
  const { groups } = groupsOf(goldenA);

  it('puts a lineage’s traits with the species, and a subclass’s with its class', () => {
    expect(groups.map(({ kind }) => kind)).toEqual(['species', 'class', 'background']);
    expect(ids(groups[0]?.rows ?? [])).toContain('srd-2014:feature/dwarven-toughness');
    expect(ids(groups[0]?.rows ?? [])).toContain('srd-2014:feature/darkvision');
    expect(ids(groups[1]?.rows ?? [])).toEqual([
      'srd-2014:feature/spellcasting-cleric',
      'srd-2014:feature/divine-domain',
      'srd-2014:feature/domain-spells-1',
      'srd-2014:feature/bonus-proficiency',
      'srd-2014:feature/disciple-of-life',
    ]);
    expect(groups[1]?.subclass).toEqual({ chosen: 'srd-2014:subclass/life' });
    expect(ids(groups[2]?.rows ?? [])).toEqual(['srd-2014:feature/shelter-of-the-faithful']);
  });
});

describe('SHEET-48 the character’s own feats', () => {
  const feat = {
    id: 'character:feat/furious',
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Furious' },
    source: { pack: 'character' },
    effects: [
      {
        id: 'rage',
        target: 'checks.str.bonus',
        op: 'add',
        value: 1,
        toggle: { label: { en: 'Raging' }, default: false },
      },
    ],
  };
  const { groups } = groupsOf(goldenB, {
    localEntities: [feat],
    systemData: { ...goldenB.systemData, feats: [{ id: feat.id }] },
  });

  it('are a group of their own, last, with their switches by part id', () => {
    expect(groups.map(({ kind }) => kind)).toEqual(['species', 'class', 'background', 'feats']);
    expect(groups[3]?.rows).toEqual([
      {
        id: 'character:feat/furious',
        resources: [],
        toggles: [{ part: 'character:feat/furious#rage', label: { en: 'Raging' }, default: false }],
      },
    ]);
  });
});

describe('SHEET-48 a character with no class and no features', () => {
  it('has no group at all', () => {
    const { groups } = groupsOf(goldenB, {
      systemData: { ...goldenB.systemData, classes: [], species: undefined, background: undefined },
    });
    expect(groups).toEqual([]);
  });
});
