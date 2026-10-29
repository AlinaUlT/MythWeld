import { loadContentIndex } from '@grimoire/engine';
import { FIFTH_EDITION_SYSTEM, openFifthEditionPack } from '@grimoire/system-5e';
import { describe, expect, it } from 'vitest';
import * as golden from '../../system-5e/test/golden/index.ts';
import { BUILT_IN_PACKS, srd2014, srd2024 } from '../src/index.ts';

// SHEET-08: the phase 1 fixtures are the built-in packs (SPEC §12 stage 2). Each opens as a file
// does, carries its CC-BY-4.0 licence, and loads beside the other; the golden tests read the
// same objects.

/** A pack opened as the app opens a file, or the test fails with why it did not open. */
function opened(pack: unknown) {
  const result = openFifthEditionPack(pack);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe('SHEET-08 the built-in packs', () => {
  it('are the SRD 5.1 and SRD 5.2.1 packs, in load order', () => {
    expect(BUILT_IN_PACKS.map((pack) => [pack.id, pack.ruleset, pack.title.en])).toEqual([
      ['srd-2014', '2014', 'SRD 5.1'],
      ['srd-2024', '2024', 'SRD 5.2.1'],
    ]);
  });

  it('carry the CC-BY-4.0 licence, free to ship', () => {
    for (const pack of BUILT_IN_PACKS) {
      expect(pack.license).toEqual({
        spdx: 'CC-BY-4.0',
        name: 'Creative Commons Attribution 4.0 International',
        url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
        redistributable: true,
      });
    }
  });

  it('open as files and load together, nothing refused or warned', () => {
    const { loaded, refused, warnings, index } = loadContentIndex(
      FIFTH_EDITION_SYSTEM,
      BUILT_IN_PACKS.map(opened),
    );
    expect(loaded).toEqual(['srd-2014', 'srd-2024']);
    expect(refused).toEqual([]);
    expect(warnings).toEqual([]);
    expect(index.entities).toHaveLength(74 + 66);
  });

  it('are the data the golden tests read', () => {
    expect(golden.srd2014).toBe(srd2014);
    expect(golden.srd2024).toBe(srd2024);
  });

  it('give each found key a name: a size, a school, a creature type, a feat category', () => {
    const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, BUILT_IN_PACKS.map(opened));
    const names = (type: string) =>
      index.entities.filter((entity) => entity.type === type).map((entity) => entity.name.en);
    const sizes = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    expect(names('size')).toEqual([...sizes, ...sizes]);
    expect(names('spellSchool')).toEqual(['Enchantment', 'Evocation']);
    expect(names('creatureType')).toEqual(['Humanoid']);
    expect(names('featCategory')).toEqual(['Origin Feat', 'Fighting Style Feat']);
  });
});
