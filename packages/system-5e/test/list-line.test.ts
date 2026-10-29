import { describe, expect, it } from 'vitest';
import { fifthEditionListLine, openFifthEditionCharacter } from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenC2014 } from './golden/index.ts';

// The goldens of SPEC §6.7: A a hill dwarf cleric 1, B a human fighter 1, C wizard 3 then
// paladin 3 with no species.

describe('SHEET-24 the list line', () => {
  it('names the species, then each class with its level', () => {
    expect(fifthEditionListLine(opened(openFifthEditionCharacter(goldenB)))).toEqual([
      { id: 'srd-2024:species/human' },
      { id: 'srd-2024:class/fighter', level: 1 },
    ]);
  });

  it('names the species, not the lineage chosen for it', () => {
    expect(fifthEditionListLine(opened(openFifthEditionCharacter(goldenA)))).toEqual([
      { id: 'srd-2014:species/dwarf' },
      { id: 'srd-2014:class/cleric', level: 1 },
    ]);
  });

  it('names the classes in the order taken when there is no species', () => {
    expect(fifthEditionListLine(opened(openFifthEditionCharacter(goldenC2014)))).toEqual([
      { id: 'srd-2014:class/wizard', level: 3 },
      { id: 'srd-2014:class/paladin', level: 3 },
    ]);
  });
});
