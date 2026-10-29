import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_HEADER_NUMBERS,
  FIFTH_EDITION_SYSTEM,
  fifthEditionCasting,
  type fifthEditionCharacterSchema,
  fifthEditionClassLine,
  fifthEditionHitPoints,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenC2014, srd2014, srd2024 } from './golden/index.ts';

// The goldens of SPEC §6.7: A a hill dwarf cleric 1 (spell save DC 13, attack +5), B a human
// fighter 1 (AC 17, initiative +3, speed 30, proficiency +2, passive Perception 13), C wizard 3
// then paladin 3. The values are SPEC §6.7's; the paths are the ones the golden tests read.

const packs = [srd2014, srd2024].map((file) => opened(openFifthEditionPack(file)));

function sheetOf(golden: z.input<typeof fifthEditionCharacterSchema>) {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = loadContentIndex(
    FIFTH_EDITION_SYSTEM,
    packs.filter(({ id }) => character.packs.includes(id)),
  );
  return { character, computed: compute(character, index, fifthEditionModule) };
}

describe('SHEET-30 the sheet header', () => {
  it("golden B's stats row: AC 17, initiative +3, speed 30, proficiency +2, passive 13", () => {
    const { computed } = sheetOf(goldenB);
    const row = FIFTH_EDITION_HEADER_NUMBERS.map(({ key, path }) => [key, computed.values[path]]);
    expect(row).toEqual([
      ['ac', 17],
      ['init', 3],
      ['speed', 30],
      ['prof', 2],
      ['passive', 13],
    ]);
    // Each number shown has its breakdown (SPEC §6.1).
    for (const { path } of FIFTH_EDITION_HEADER_NUMBERS) {
      expect(Object.hasOwn(computed.breakdown, path)).toBe(true);
    }
  });

  it('writes initiative and proficiency with their sign; a tap rolls only initiative', () => {
    const formats = FIFTH_EDITION_HEADER_NUMBERS.map(({ key, format, rolls }) => [
      key,
      format,
      rolls === true,
    ]);
    expect(formats).toEqual([
      ['ac', 'plain', false],
      ['init', 'signed', true],
      ['speed', 'distance', false],
      ['prof', 'signed', false],
      ['passive', 'plain', false],
    ]);
  });

  it('names each class with its level, and no species', () => {
    expect(fifthEditionClassLine(sheetOf(goldenB).character)).toEqual([
      { id: 'srd-2024:class/fighter', level: 1 },
    ]);
    expect(fifthEditionClassLine(sheetOf(goldenC2014).character)).toEqual([
      { id: 'srd-2014:class/wizard', level: 3 },
      { id: 'srd-2014:class/paladin', level: 3 },
    ]);
  });

  it('golden A casts with Wisdom: spell save DC 13, spell attack +5', () => {
    const { character, computed } = sheetOf(goldenA);
    const casting = fifthEditionCasting(character, computed);
    expect(casting).toEqual([
      {
        source: 'srd-2014:class/cleric',
        ability: 'wis',
        dc: 'classes.cleric.spell.dc',
        attack: 'classes.cleric.spell.attack',
      },
    ]);
    expect(casting.map(({ dc, attack }) => [computed.values[dc], computed.values[attack]])).toEqual(
      [[13, 5]],
    );
  });

  it('golden B casts nothing; golden C casts by both classes, in the order taken', () => {
    const b = sheetOf(goldenB);
    expect(fifthEditionCasting(b.character, b.computed)).toEqual([]);
    const c = sheetOf(goldenC2014);
    expect(
      fifthEditionCasting(c.character, c.computed).map(({ source, ability }) => [source, ability]),
    ).toEqual([
      ['srd-2014:class/wizard', 'int'],
      ['srd-2014:class/paladin', 'cha'],
    ]);
  });

  it("reads the stored hit points and the maximum's path: golden B 12 of 12", () => {
    const { character, computed } = sheetOf(goldenB);
    const hp = fifthEditionHitPoints(character);
    expect(hp).toEqual({ current: 12, temp: 0, maxPath: 'hp.max' });
    expect(computed.values[hp.maxPath]).toBe(12);
  });
});
