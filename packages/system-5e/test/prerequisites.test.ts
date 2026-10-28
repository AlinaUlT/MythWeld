import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenC2014, goldenC2024, srd2014, srd2024 } from './golden/index.ts';

// SHEET-14: both SRDs' Multiclassing, "Prerequisites" (§8 of the ticket): a character with more
// than one class meets each class's multiclass prerequisites, its first class's included. Golden
// C is wizard 3, then paladin 3, with Strength 13, Intelligence 15 and Charisma 14, no species and
// no background; the fixtures give the wizard Intelligence 13, the paladin Strength 13 and
// Charisma 13, and the 2024 fighter "Strength 13 or Dexterity 13". The scores changed below are
// test data.

type Input = z.input<typeof fifthEditionCharacterSchema>;

const PACKS = new Map(
  [srd2014, srd2024].map((file) => {
    const pack = opened(openFifthEditionPack(file));
    return [pack.id, pack];
  }),
);

/** The character's warnings, without their log message. */
function warningsOf(input: Input) {
  const character = opened(openFifthEditionCharacter(input));
  const { index } = loadContentIndex(
    FIFTH_EDITION_SYSTEM,
    character.packs.flatMap((id) => PACKS.get(id) ?? []),
  );
  return compute(character, index, fifthEditionModule).warnings.map(
    ({ message: _, ...warning }) => warning,
  );
}

/** The golden with some base scores changed. */
function scored(golden: Input, scores: Record<string, number>, change: Partial<Input> = {}): Input {
  return { ...golden, abilities: { base: { ...golden.abilities.base, ...scores } }, ...change };
}

/** An unmet `ability` prerequisite of a class. */
function unmet(entity: string, key: string) {
  return { code: 'unmetPrerequisite', entity, prerequisite: { kind: 'ability', key, min: 13 } };
}

const GOLDEN_C = [
  ['2014', goldenC2014],
  ['2024', goldenC2024],
] as const;

describe("SHEET-14 a multiclass character meets each class's multiclass prerequisites", () => {
  it.each(GOLDEN_C)('golden C (%s) meets them all: no warning', (_, golden) => {
    expect(warningsOf(golden)).toEqual([]);
  });

  it.each(GOLDEN_C)(
    "golden C (%s): each score below 13 warns, the first class's too",
    (ruleset, golden) => {
      const wizard = `srd-${ruleset}:class/wizard`;
      const paladin = `srd-${ruleset}:class/paladin`;
      expect(warningsOf(scored(golden, { int: 12 }))).toEqual([unmet(wizard, 'int')]);
      expect(warningsOf(scored(golden, { str: 12 }))).toEqual([unmet(paladin, 'str')]);
      expect(warningsOf(scored(golden, { cha: 12 }))).toEqual([unmet(paladin, 'cha')]);
      expect(warningsOf(scored(golden, { int: 12, str: 12, cha: 12 }))).toEqual([
        unmet(wizard, 'int'),
        unmet(paladin, 'str'),
        unmet(paladin, 'cha'),
      ]);
    },
  );

  it.each(GOLDEN_C)(
    'golden C (%s) as a wizard only asks none, whatever its scores',
    (_, golden) => {
      const classes = golden.systemData.classes.slice(0, 1);
      const single = scored(golden, { int: 8 }, { systemData: { ...golden.systemData, classes } });
      expect(warningsOf(single)).toEqual([]);
    },
  );

  it('the 2024 fighter asks Strength 13 or Dexterity 13', () => {
    const fighter = {
      id: 'srd-2024:class/fighter',
      level: 1,
      hp: ['avg'],
    } satisfies Input['systemData']['classes'][number];
    const withFighter: Input = {
      ...goldenC2024,
      systemData: {
        ...goldenC2024.systemData,
        classes: [...goldenC2024.systemData.classes, fighter],
      },
    };
    const prerequisite = {
      kind: 'formula',
      formula: '@abilities.str.score >= 13 || @abilities.dex.score >= 13',
      label: { en: 'Strength 13 or Dexterity 13' },
    };
    const prerequisites = (input: Input) =>
      warningsOf(input).filter(({ code }) => code === 'unmetPrerequisite');
    expect(prerequisites(withFighter)).toEqual([]); // Strength 13
    expect(prerequisites(scored(withFighter, { str: 12 }))).toEqual([
      unmet('srd-2024:class/paladin', 'str'),
      { code: 'unmetPrerequisite', entity: 'srd-2024:class/fighter', prerequisite },
    ]);
    expect(prerequisites(scored(withFighter, { str: 12, dex: 13 }))).toEqual([
      unmet('srd-2024:class/paladin', 'str'),
    ]);
  });
});
