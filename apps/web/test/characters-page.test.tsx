import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { listLineText } from '../src/pages/CharactersPage';

// The goldens of SPEC §6.7, named from the built-in packs (SHEET-08), as the list card shows them.

const t = i18n.getFixedT('en', 'characters');
const { packs } = installBuiltInPacks();

describe('SHEET-24 the list card', () => {
  it('names the species, then each class with its level, from the packs', () => {
    expect(listLineText(fifthEditionCharacterSchema.parse(goldenB), t, packs)).toBe(
      'Human · Fighter 1',
    );
    expect(listLineText(fifthEditionCharacterSchema.parse(goldenA), t, packs)).toBe(
      'Dwarf · Cleric 1',
    );
    expect(listLineText(fifthEditionCharacterSchema.parse(goldenC2014), t, packs)).toBe(
      'Wizard 3 · Paladin 3',
    );
  });

  it('reads an id no pack holds as missing, and never throws', () => {
    const character = fifthEditionCharacterSchema.parse(goldenB);
    expect(listLineText(character, t, [])).toBe(
      'Missing: srd-2024:species/human · Missing: srd-2024:class/fighter 1',
    );
  });

  it('says the day it was created in the language of the screen', () => {
    expect(t('created', { date: new Date(2026, 9, 2, 12) })).toBe('Created Oct 2, 2026');
  });
});
