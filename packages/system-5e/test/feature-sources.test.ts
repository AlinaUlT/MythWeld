import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type fifthEditionCharacterSchema,
  fifthEditionFeatureSources,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import {
  goldenA,
  goldenB,
  goldenC2014,
  goldenE,
  hbLocal,
  srd2014,
  srd2024,
} from './golden/index.ts';

// SHEET-48: the Features tab's groups on the goldens of SPEC §6.7. The ids are the ones the packs
// give each golden, read from `compute()` on the built-in packs, not from the function under test.

const packs = [srd2014, srd2024, hbLocal].map((file) => opened(openFifthEditionPack(file)));

function sourcesOf(golden: z.input<typeof fifthEditionCharacterSchema>) {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = loadContentIndex(
    FIFTH_EDITION_SYSTEM,
    packs.filter(({ id }) => character.packs.includes(id)),
  );
  const computed = compute(character, index, fifthEditionModule);
  return { computed, sources: fifthEditionFeatureSources(character, computed) };
}

const idsOf = (entries: readonly { id: string }[]) => entries.map(({ id }) => id);

describe('SHEET-48 features by source', () => {
  it('golden A: the dwarf with its lineage, the cleric with its subclass, the acolyte', () => {
    const { sources } = sourcesOf(goldenA);
    expect(sources.map(({ kind }) => kind)).toEqual(['species', 'class', 'background']);
    const [species, cleric, acolyte] = sources;
    expect(species?.entity?.id).toBe('srd-2014:species/dwarf');
    expect(species?.subline).toMatchObject({
      kind: 'lineage',
      entity: { id: 'srd-2014:lineage/hill-dwarf' },
    });
    expect(idsOf(species?.entries ?? [])).toEqual([
      'srd-2014:feature/darkvision',
      'srd-2014:feature/dwarven-resilience',
      'srd-2014:feature/stonecunning',
      'srd-2014:feature/dwarven-combat-training',
      'srd-2014:feature/tool-proficiency',
      'srd-2014:feature/dwarven-toughness',
    ]);
    expect(cleric?.entity?.id).toBe('srd-2014:class/cleric');
    expect(cleric?.level).toBe(1);
    expect(cleric?.subline).toMatchObject({
      kind: 'subclass',
      entity: { id: 'srd-2014:subclass/life' },
    });
    expect(idsOf(cleric?.entries ?? [])).toEqual([
      'srd-2014:feature/spellcasting-cleric',
      'srd-2014:feature/divine-domain',
      'srd-2014:feature/domain-spells-1',
      'srd-2014:feature/bonus-proficiency',
      'srd-2014:feature/disciple-of-life',
    ]);
    expect(idsOf(acolyte?.entries ?? [])).toEqual(['srd-2014:feature/shelter-of-the-faithful']);
  });

  it('golden B: a feat a trait, a feature or the background gave stays under its giver', () => {
    const { sources } = sourcesOf(goldenB);
    expect(sources.map(({ kind }) => kind)).toEqual(['species', 'class', 'background']);
    const [human, fighter, soldier] = sources;
    expect(idsOf(human?.entries ?? [])).toEqual([
      'srd-2024:feature/resourceful',
      'srd-2024:feature/skillful',
      'srd-2024:feature/versatile',
      'srd-2024:feat/alert',
    ]);
    expect(human?.subline).toBeUndefined();
    expect(fighter?.level).toBe(1);
    expect(idsOf(fighter?.entries ?? [])).toEqual([
      'srd-2024:feature/fighter-fighting-style',
      'srd-2024:feat/defense',
      'srd-2024:feature/fighter-second-wind',
      'srd-2024:feature/fighter-weapon-mastery',
    ]);
    expect(idsOf(soldier?.entries ?? [])).toEqual(['srd-2024:feat/savage-attacker']);
  });

  it('a class below its subclass level says so; at the level, with none chosen, it says that', () => {
    const fighter = sourcesOf(goldenB).sources.find(({ kind }) => kind === 'class');
    expect(fighter?.subline).toEqual({ kind: 'subclassLater' });
    // Wizard 3 and paladin 3 chose no subclass, and both have reached the level that gives one.
    const classes = sourcesOf(goldenC2014).sources;
    expect(classes.map(({ kind }) => kind)).toEqual(['class', 'class']);
    expect(classes.map(({ level }) => level)).toEqual([3, 3]);
    expect(classes.map(({ entity }) => entity?.id)).toEqual([
      'srd-2014:class/wizard',
      'srd-2014:class/paladin',
    ]);
    expect(classes.map(({ subline }) => subline)).toEqual([
      { kind: 'subclassUnchosen' },
      { kind: 'subclassUnchosen' },
    ]);
  });

  it('golden E: a feat given by hand is its own group, after the background', () => {
    const { sources } = sourcesOf(goldenE);
    expect(sources.map(({ kind }) => kind)).toEqual(['species', 'class', 'background', 'feats']);
    const feats = sources.at(-1);
    expect(feats?.entity).toBeUndefined();
    expect(idsOf(feats?.entries ?? [])).toEqual(['hb-local:feat/arcane-scholar']);
  });

  it('names an id a grant of a source gave that no pack has, under that source', () => {
    const { computed } = sourcesOf(goldenB);
    const character = opened(openFifthEditionCharacter(goldenB));
    const sources = fifthEditionFeatureSources(character, {
      ...computed,
      warnings: [
        ...computed.warnings,
        {
          code: 'missing',
          id: 'srd-2024:feat/gone',
          from: 'srd-2024:feature/versatile#feat',
          message: 'Missing: srd-2024:feat/gone',
        },
      ],
    });
    expect(sources.map(({ missing }) => missing)).toEqual([['srd-2024:feat/gone'], [], []]);
  });

  it('keeps no feats group for a character that took none, and no group for what it does not have', () => {
    expect(sourcesOf(goldenB).sources.some(({ kind }) => kind === 'feats')).toBe(false);
    const none = fifthEditionFeatureSources(opened(openFifthEditionCharacter(goldenB)), {
      entities: [],
      warnings: [],
    });
    expect(none).toEqual([]);
  });
});
