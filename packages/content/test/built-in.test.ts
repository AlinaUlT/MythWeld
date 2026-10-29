import { loadContentIndex } from '@grimoire/engine';
import {
  FIFTH_EDITION_SCHEMA_VERSION,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionPack,
  openFifthEditionPack,
} from '@grimoire/system-5e';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_PACKS, srd2014, srd2024 } from '../src/index.ts';

// SHEET-08: the app's built-in packs are the golden fixtures (SPEC §12 stage 2), each under an open
// license the public build may carry (SPEC §3, ADR 003). Counts are the fixtures' own (ENG-09 §8,
// ENG-10 §8) with the simple types SHEET-08 §4 adds: 66 + 8 and 57 + 9.

/** A built-in pack opened as the app opens a file, or the test fails with why it did not open. */
function opened(file: unknown): FifthEditionPack {
  const result = openFifthEditionPack(file);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe('SHEET-08 the built-in mini-pack', () => {
  it('is the two SRD packs, each opening at the current version as it is', () => {
    expect(BUILT_IN_PACKS).toEqual([srd2014, srd2024]);
    for (const file of BUILT_IN_PACKS) {
      expect(openFifthEditionPack(file)).toEqual({
        ok: true,
        value: file,
        from: { schemaVersion: 2, systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION },
      });
    }
    expect(BUILT_IN_PACKS.map((file) => opened(file).id)).toEqual(['srd-2014', 'srd-2024']);
  });

  it('carries only CC-BY-4.0 packs the public build may carry', () => {
    for (const pack of BUILT_IN_PACKS.map(opened)) {
      expect(pack.license, pack.id).toEqual({
        spdx: 'CC-BY-4.0',
        name: 'Creative Commons Attribution 4.0 International',
        url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
        redistributable: true,
      });
    }
  });

  it('holds only its own entities, each of its own edition', () => {
    for (const pack of BUILT_IN_PACKS.map(opened)) {
      const others = pack.entities.filter(
        (entity) =>
          entity.source.pack !== pack.id ||
          !entity.id.startsWith(`${pack.id}:`) ||
          entity.ruleset !== pack.ruleset,
      );
      expect(others.map((entity) => entity.id)).toEqual([]);
    }
  });

  it('loads into one content index with nothing refused or warned', () => {
    const { index, refused, warnings } = loadContentIndex(
      FIFTH_EDITION_SYSTEM,
      BUILT_IN_PACKS.map(opened),
    );
    expect(refused).toEqual([]);
    expect(warnings).toEqual([]);
    expect(index.entities).toHaveLength(74 + 66);
  });

  it('names each size, school, creature type and feat category its entities name', () => {
    const named = (pack: FifthEditionPack, type: string) =>
      pack.entities.filter((entity) => entity.type === type).map((entity) => entity.key);
    const srd51 = opened(srd2014);
    const srd521 = opened(srd2024);
    const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
    expect(named(srd51, 'size')).toEqual(sizes);
    expect(named(srd51, 'spellSchool')).toEqual(['enchantment', 'evocation']);
    expect(named(srd521, 'size')).toEqual(sizes);
    expect(named(srd521, 'creatureType')).toEqual(['humanoid']);
    expect(named(srd521, 'featCategory')).toEqual(['origin', 'fightingStyle']);
  });
});
