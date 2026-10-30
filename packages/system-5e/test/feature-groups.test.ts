import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  type FeatureGroup,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type fifthEditionCharacterSchema,
  fifthEditionFeatureGroups,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2014, srd2024 } from './golden/index.ts';

// SHEET-48: the Features tab's groups. The goldens of SPEC §6.7 on the built-in packs: A a hill
// dwarf cleric 1 (Life domain), B a human fighter 1 with the Soldier background, the Defense
// fighting style and Second Wind, 2 uses (the 2024 SRD's Fighter table), 1 back on a short rest
// and all on a long rest (the pack's grant).

const packs = [srd2014, srd2024].map((file) => opened(openFifthEditionPack(file)));

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;

function groupsOf(golden: CharacterInput): FeatureGroup[] {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = loadContentIndex(
    FIFTH_EDITION_SYSTEM,
    packs.filter(({ id }) => character.packs.includes(id)),
  );
  return fifthEditionFeatureGroups(character, compute(character, index, fifthEditionModule));
}

const idsOf = (group: FeatureGroup | undefined) =>
  group?.features.map(({ entity }) => entity.id as string);

describe('SHEET-48 the Features tab groups', () => {
  it("groups golden B's features under Human, Fighter and Soldier, in that order", () => {
    const groups = groupsOf(goldenB);
    expect(groups.map(({ kind, source }) => [kind, source?.id])).toEqual([
      ['species', 'srd-2024:species/human'],
      ['class', 'srd-2024:class/fighter'],
      ['background', 'srd-2024:background/soldier'],
    ]);
    // Alert is the Human's origin feat; Defense is the Fighting Style feat: each under its giver.
    expect(idsOf(groups[0])).toContain('srd-2024:feat/alert');
    expect(idsOf(groups[1])).toEqual([
      'srd-2024:feature/fighter-fighting-style',
      'srd-2024:feat/defense',
      'srd-2024:feature/fighter-second-wind',
      'srd-2024:feature/fighter-weapon-mastery',
    ]);
    expect(idsOf(groups[2])).toEqual(['srd-2024:feat/savage-attacker']);
  });

  it("gives the Fighter its level 1 and no subclass line, and golden A's Cleric its Life domain", () => {
    const [, fighter] = groupsOf(goldenB);
    expect(fighter?.level).toBe(1);
    expect(fighter?.detail).toBeUndefined();
    const cleric = groupsOf(goldenA).find(({ kind }) => kind === 'class');
    expect(cleric?.source?.id).toBe('srd-2014:class/cleric');
    expect(cleric?.level).toBe(1);
    expect(cleric?.detail?.id).toBe('srd-2014:subclass/life');
    // The Life domain's own feature stands under the Cleric, not apart.
    expect(idsOf(cleric)).toContain('srd-2014:feature/disciple-of-life');
  });

  it("holds Second Wind's uses: 2 of 2, 1 back on a short rest, all on a long rest", () => {
    const [, fighter] = groupsOf(goldenB);
    const row = fighter?.features.find(({ entity }) => entity.id.endsWith('second-wind'));
    expect(row?.uses).toEqual([
      {
        key: 'secondWind',
        label: { en: 'Second Wind' },
        max: 2,
        spent: 0,
        left: 2,
        recovery: [
          { on: 'short', amount: 1, path: 'resources.secondWind.recovery.short' },
          { on: 'long', amount: 'all' },
        ],
      },
    ]);
    // Only the feature that gives the resource holds it.
    expect(fighter?.features.filter(({ uses }) => uses.length > 0)).toHaveLength(1);
  });

  it('counts the uses already spent', () => {
    const spent = { ...goldenB, state: { ...goldenB.state, resources: { secondWind: 1 } } };
    const [, fighter] = groupsOf(spent);
    const uses = fighter?.features.find(({ uses: held }) => held.length > 0)?.uses[0];
    expect([uses?.max, uses?.spent, uses?.left]).toEqual([2, 1, 1]);
  });

  it('puts a feat the character gave itself under the feats, with its switch', () => {
    const feat: FifthEditionCharacter['localEntities'][number] = {
      id: 'character:feat/test-stance',
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Test stance' },
      source: { pack: 'character' },
      effects: [
        {
          id: 'stance',
          target: 'ac.total',
          op: 'add',
          value: 1,
          toggle: { label: { en: 'Stance held' }, default: false },
        },
      ],
    };
    const had = (toggles: Record<string, boolean>) =>
      groupsOf({
        ...goldenB,
        localEntities: [feat],
        systemData: { ...goldenB.systemData, feats: [{ id: feat.id }] },
        state: { ...goldenB.state, toggles },
      });
    const part = 'character:feat/test-stance#stance';
    const off = had({}).at(-1);
    expect(off?.kind).toBe('feats');
    expect(off?.source).toBeUndefined();
    expect(off?.features[0]?.switches).toEqual([{ part, label: { en: 'Stance held' }, on: false }]);
    expect(had({ [part]: true }).at(-1)?.features[0]?.switches[0]?.on).toBe(true);
  });

  it('leaves a character with no features with no group', () => {
    const none = { ...goldenB, systemData: { ...goldenB.systemData, species: undefined } };
    expect(groupsOf(none).map(({ kind }) => kind)).not.toContain('species');
  });
});
