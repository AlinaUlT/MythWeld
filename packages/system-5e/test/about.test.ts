import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  ABOUT_LISTS,
  FIFTH_EDITION_SYSTEM,
  fifthEditionAbout,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenC2014, srd2014, srd2024 } from './golden/index.ts';

// SHEET-53: the About tab's data. Golden A is a hill dwarf Life domain cleric 1 with the Acolyte
// background (SPEC §6.7); every list below was read off the grants of its entities in the SRD 5.1
// pack (`packages/content/src/packs/srd-2014.ts`), not copied from a run: the dwarf gives the
// languages common and dwarvish and, with its Dwarven Combat Training, four weapons; the tool
// proficiency feature the masonsTools the golden chose; the Acolyte insight and religion and the
// two languages the golden chose; the cleric light and medium armor, shields, simple weapons and
// the two skills the golden chose; the Life domain's Bonus Proficiency heavy armor.

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

function aboutOf(golden: Parameters<typeof openFifthEditionCharacter>[0]) {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = character.ruleset === '2014' ? index2014 : index2024;
  return fifthEditionAbout(character, compute(character, index, fifthEditionModule));
}

const sorted = (keys: readonly string[]) => [...keys].sort();

describe('SHEET-53 the origin details of golden A', () => {
  const about = aboutOf(goldenA);

  it('names the species, its lineage, the background and the size', () => {
    expect(about.species).toBe('srd-2014:species/dwarf');
    expect(about.lineages).toEqual(['srd-2014:lineage/hill-dwarf']);
    expect(about.background).toBe('srd-2014:background/acolyte');
    expect(about.size).toBe('medium');
  });

  it('lists the languages, each once', () => {
    expect(sorted(about.lists.languages)).toEqual(['celestial', 'common', 'dwarvish', 'elvish']);
  });

  it('lists the armor, weapon, tool and skill proficiencies', () => {
    expect(sorted(about.lists.armor)).toEqual(['heavy', 'light', 'medium', 'shield']);
    expect(sorted(about.lists.weapons)).toEqual([
      'battleaxe',
      'handaxe',
      'lightHammer',
      'simple',
      'warhammer',
    ]);
    expect(about.lists.tools).toEqual(['masonsTools']);
    expect(sorted(about.lists.skills)).toEqual(['insight', 'medicine', 'persuasion', 'religion']);
  });
});

describe('SHEET-53 the origin details of other characters', () => {
  it('names the 2024 golden B: human, Soldier, Medium, and the fighter weapons and armor', () => {
    // SRD 5.2.1 pack: the fighter's armor `light, medium, heavy, shield`, weapons `simple,
    // martial`; the Soldier's skills athletics and intimidation (srd-2024.ts).
    const about = aboutOf(goldenB);
    expect(about.species).toBe('srd-2024:species/human');
    expect(about.background).toBe('srd-2024:background/soldier');
    expect(about.size).toBe('medium');
    expect(sorted(about.lists.armor)).toEqual(['heavy', 'light', 'medium', 'shield']);
    expect(sorted(about.lists.weapons)).toEqual(['martial', 'simple']);
    expect(about.lists.skills).toEqual(expect.arrayContaining(['athletics', 'intimidation']));
  });

  it('has no species, background, lineage or size for golden C, who has none', () => {
    const about = aboutOf(goldenC2014);
    expect(about.species).toBeUndefined();
    expect(about.background).toBeUndefined();
    expect(about.lineages).toEqual([]);
    expect(about.size).toBeUndefined();
    expect(about.lists.languages).toEqual([]);
  });

  it('names each list by a category and the entity type that names its keys', () => {
    expect(ABOUT_LISTS).toEqual({
      languages: { category: 'language', type: 'language' },
      armor: { category: 'armor', type: 'item' },
      weapons: { category: 'weapon', type: 'item' },
      tools: { category: 'tool', type: 'toolKind' },
      skills: { category: 'skill', type: 'skill' },
    });
  });
});
