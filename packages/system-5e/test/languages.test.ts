import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
  rulesOf,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenC2024,
  goldenD,
  goldenE,
  hbLocal,
  srd2014,
  srd2024,
} from './golden/index.ts';

// ENG-56: where a character's starting languages come from. Every expected language is a grant's
// own key: the 2014 dwarf's `common`, `dwarvish` and the Acolyte's two chosen ones (`srd-2014.ts`,
// golden A's `celestial`, `elvish`), and the made-up entities' below. The 2024 fixtures give no
// language (ENG-10 §8), so the 2024 place is a made-up background shaped as dnd5e's 2024 ones
// (ENG-56 §8). The mixed characters are test data built on the goldens.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type LanguageSource = CharacterInput['systemData']['languageSource'];
type Local = FifthEditionCharacter['localEntities'][number];

/** The packs a character may name, each opened once, by id. */
const PACKS = new Map(
  [srd2014, srd2024, hbLocal].map((file) => {
    const pack = opened(openFifthEditionPack(file));
    return [pack.id, pack];
  }),
);

/** A character opened as a file would be, then computed on the packs it names. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  const one = opened(openFifthEditionCharacter(character));
  const packs = one.packs.flatMap((id) => PACKS.get(id) ?? []);
  return compute(one, loadContentIndex(FIFTH_EDITION_SYSTEM, packs).index, fifthEditionModule);
}

/** A character with another place for its starting languages. */
function storing(character: CharacterInput, languageSource: LanguageSource): CharacterInput {
  return { ...character, systemData: { ...character.systemData, languageSource } };
}

const DWARF = 'srd-2014:species/dwarf';
const DWARF_LANGUAGES = `${DWARF}#languages`;
const ACOLYTE = 'srd-2014:background/acolyte';
const ACOLYTE_LANGUAGES = `${ACOLYTE}#languages`;
const HUMAN = 'srd-2024:species/human';
const WAYFARER = 'character:background/wayfarer';
const WAYFARER_LANGUAGES = `${WAYFARER}#languages`;

/**
 * Made up here: a background of `ruleset` that gives `common` and two languages chosen from three,
 * as dnd5e's 2024 backgrounds give `common` and two standard ones.
 */
function wayfarer(ruleset: '2024' | 'any'): Local {
  return {
    id: WAYFARER,
    type: 'background',
    ruleset,
    name: { en: 'Wayfarer' },
    source: { pack: 'character' },
    grants: [
      {
        id: 'languages',
        kind: 'proficiency',
        category: 'language',
        fixed: ['common'],
        choose: { count: 2, from: ['dwarvish', 'elvish', 'giant'] },
      },
    ],
  };
}

/** Both SRD packs, with mixing on. */
const mixing = { allowMixedRulesets: true, packs: ['srd-2014', 'srd-2024'] };

/** The character with the Wayfarer of `ruleset` as its background, `chosen` its two languages. */
function withWayfarer(
  character: CharacterInput,
  ruleset: '2024' | 'any',
  chosen: string[] = ['giant', 'elvish'],
): CharacterInput {
  return {
    ...character,
    ...mixing,
    localEntities: [...character.localEntities, wayfarer(ruleset)],
    choices: { ...character.choices, ...(chosen.length > 0 && { [WAYFARER_LANGUAGES]: chosen }) },
    systemData: { ...character.systemData, background: { id: WAYFARER } },
  };
}

/** The character with the 2014 dwarf and hill dwarf as its species. */
function withDwarf(character: CharacterInput): CharacterInput {
  return {
    ...character,
    ...mixing,
    choices: {
      ...character.choices,
      [`${DWARF}#subrace`]: ['srd-2014:lineage/hill-dwarf'],
      'srd-2014:feature/tool-proficiency#tools': ['masonsTools'],
    },
    systemData: { ...character.systemData, species: { id: DWARF } },
  };
}

/** Each language the character speaks, with the grant that gives it. */
function spoken(result: Computed<FifthEditionEntity>): [string, string][] {
  return result.proficiencies.flatMap(({ category, key, from }) =>
    category === 'language' ? [[key, from]] : [],
  );
}

const DWARF_SPOKEN = [
  ['common', DWARF_LANGUAGES],
  ['dwarvish', DWARF_LANGUAGES],
];
const WAYFARER_SPOKEN = [
  ['common', WAYFARER_LANGUAGES],
  ['giant', WAYFARER_LANGUAGES],
  ['elvish', WAYFARER_LANGUAGES],
];
const ACOLYTE_SPOKEN = [
  ['celestial', ACOLYTE_LANGUAGES],
  ['elvish', ACOLYTE_LANGUAGES],
];

/** The parts of the grants that apply. */
function parts(result: Computed<FifthEditionEntity>): string[] {
  return result.grants.map(({ part }) => part);
}

/** The parts of the choices not yet made. */
function pending(result: Computed<FifthEditionEntity>): string[] {
  return result.pendingChoices.map(({ part }) => part);
}

/** The `characterRule` warnings, without their log message. */
function ruleWarnings(result: Computed<FifthEditionEntity>) {
  return result.warnings.flatMap(({ message: _, ...warning }) =>
    warning.code === 'characterRule' ? [warning] : [],
  );
}

describe("ENG-56 the starting languages' place", () => {
  it('takes the side stored when both sides give, leaving the other out', () => {
    // Golden A, the 2014 dwarf, with the 2024 Wayfarer: 2014's place and 2024's both give.
    const species = computed(storing(withWayfarer(goldenA, '2024'), 'species'));
    expect(spoken(species)).toEqual(DWARF_SPOKEN);
    expect(parts(species)).not.toContain(WAYFARER_LANGUAGES);
    expect(ruleWarnings(species)).toEqual([]);

    const background = computed(storing(withWayfarer(goldenA, '2024'), 'background'));
    expect(spoken(background)).toEqual(WAYFARER_SPOKEN);
    expect(parts(background)).not.toContain(DWARF_LANGUAGES);
    expect(ruleWarnings(background)).toEqual([]);

    // The side left out keeps its other grants: the dwarf's increase, its traits.
    for (const result of [species, background]) {
      expect(result.values['abilities.con.score']).toBe(16);
      expect(parts(result)).toContain(`${DWARF}#traits`);
    }
  });

  it('asks for a choice only on the side taken', () => {
    const unchosen = (source: LanguageSource) =>
      pending(computed(storing(withWayfarer(goldenA, '2024', []), source)));
    expect(unchosen('species')).toEqual([]);
    expect(unchosen('background')).toEqual([WAYFARER_LANGUAGES]);
  });

  it('applies the one side that gives whatever is stored; other languages add', () => {
    // Golden A: the 2014 Acolyte's two are not starting languages, so only the dwarf gives.
    for (const source of ['species', 'background'] as const) {
      const result = computed(storing(goldenA, source));
      expect(spoken(result)).toEqual([...DWARF_SPOKEN, ...ACOLYTE_SPOKEN]);
      expect(result.warnings).toEqual([]);
    }
    // Golden B with the dwarf: the 2024 Soldier's fixture gives no language.
    const soldier = computed(storing(withDwarf(goldenB), 'background'));
    expect(spoken(soldier)).toEqual(DWARF_SPOKEN);
    expect(ruleWarnings(soldier)).toEqual([]);
    // Golden B with the dwarf and the 2014 Acolyte: the Acolyte's add to the dwarf's.
    const acolyte = withDwarf(goldenB);
    const withAcolyte = computed(
      storing(
        {
          ...acolyte,
          choices: { ...acolyte.choices, [ACOLYTE_LANGUAGES]: ['celestial', 'elvish'] },
          systemData: { ...acolyte.systemData, background: { id: ACOLYTE } },
        },
        'background',
      ),
    );
    expect(spoken(withAcolyte)).toEqual([...DWARF_SPOKEN, ...ACOLYTE_SPOKEN]);
    expect(ruleWarnings(withAcolyte)).toEqual([]);
  });

  it('counts a side as giving only once its starting languages apply at the level', () => {
    // Made up here: a 2014 species whose one language comes at level 4.
    const lateKin: Local = {
      id: 'character:species/late-kin',
      type: 'species',
      ruleset: '2014',
      name: { en: 'Late kin' },
      source: { pack: 'character' },
      size: ['medium'],
      speed: { walk: 30 },
      grants: [
        {
          id: 'languages',
          kind: 'proficiency',
          category: 'language',
          atLevel: 4,
          fixed: ['giant'],
        },
      ],
    };
    const withKin = (golden: CharacterInput, source: LanguageSource) =>
      storing(
        withWayfarer(
          {
            ...golden,
            localEntities: [lateKin],
            systemData: { ...golden.systemData, species: { id: lateKin.id } },
          },
          '2024',
        ),
        source,
      );
    // Golden A, level 1: the kin gives nothing yet, so the Wayfarer's apply though `species` is
    // stored.
    expect(spoken(computed(withKin(goldenA, 'species')))).toEqual(WAYFARER_SPOKEN);
    // Golden C 2014, level 6: both sides give, and the stored side is taken.
    const kinPart = `${lateKin.id}#languages`;
    expect(spoken(computed(withKin(goldenC2014, 'species')))).toEqual([['giant', kinPart]]);
    expect(spoken(computed(withKin(goldenC2014, 'background')))).toEqual(WAYFARER_SPOKEN);
  });

  it("counts a lineage's starting languages on its species' side", () => {
    // Made up here: a 2014 species with no languages whose 2014 lineage gives `giant`.
    const farKin: Local = {
      id: 'character:lineage/far-kin',
      type: 'lineage',
      ruleset: '2014',
      name: { en: 'Far kin' },
      source: { pack: 'character' },
      grants: [{ id: 'languages', kind: 'proficiency', category: 'language', fixed: ['giant'] }],
    };
    const kin: Local = {
      id: 'character:species/kin',
      type: 'species',
      ruleset: '2014',
      name: { en: 'Kin' },
      source: { pack: 'character' },
      size: ['medium'],
      speed: { walk: 30 },
      grants: [{ id: 'lineage', kind: 'entity', fixed: [farKin.id] }],
    };
    const withKin = (source: LanguageSource) =>
      storing(
        withWayfarer(
          {
            ...goldenB,
            localEntities: [kin, farKin],
            systemData: { ...goldenB.systemData, species: { id: kin.id } },
          },
          '2024',
        ),
        source,
      );
    expect(spoken(computed(withKin('species')))).toEqual([['giant', `${farKin.id}#languages`]]);
    expect(spoken(computed(withKin('background')))).toEqual(WAYFARER_SPOKEN);
  });

  it("stores the rules base's place in every golden, which takes its side in a mix", () => {
    const goldens: CharacterInput[] = [
      goldenA,
      goldenB,
      goldenB4,
      goldenC2014,
      goldenC2024,
      goldenD,
      goldenE,
    ];
    const stored = goldens.map((golden) => {
      const character: FifthEditionCharacter = opened(openFifthEditionCharacter(golden));
      return [
        character.name,
        character.systemData.languageSource,
        rulesOf(character).languageSource,
      ];
    });
    expect(stored).toEqual([
      ['Golden A', 'species', 'species'],
      ['Golden B', 'background', 'background'],
      ['Golden B4', 'background', 'background'],
      ['Golden C (2014)', 'species', 'species'],
      ['Golden C (2024)', 'background', 'background'],
      ['Golden D', 'background', 'background'],
      ['Golden E', 'background', 'background'],
    ]);

    // Golden B, a 2024 character, with the 2014 dwarf and the Wayfarer: its default takes the
    // Wayfarer's.
    const mixed = withWayfarer(withDwarf(goldenB), '2024');
    expect(spoken(computed(mixed))).toEqual(WAYFARER_SPOKEN);
    expect(spoken(computed(storing(mixed, 'species')))).toEqual(DWARF_SPOKEN);
  });

  it('reads an entity of `any` by the rules base', () => {
    // Beside golden A's dwarf, a 2014 character: an `any` background's languages add.
    for (const source of ['species', 'background'] as const) {
      const result = computed(storing(withWayfarer(goldenA, 'any'), source));
      expect(spoken(result)).toEqual([...DWARF_SPOKEN, ...WAYFARER_SPOKEN]);
      expect(ruleWarnings(result)).toEqual([]);
    }
    // On golden B, a 2024 character, with the dwarf: it is 2024's place.
    const mixed = withWayfarer(withDwarf(goldenB), 'any');
    expect(spoken(computed(storing(mixed, 'background')))).toEqual(WAYFARER_SPOKEN);
    expect(spoken(computed(storing(mixed, 'species')))).toEqual(DWARF_SPOKEN);
  });

  it('warns when a mix of editions gives no starting languages', () => {
    // Golden A, a 2014 character, with the 2024 human: only the Acolyte's two, and the warning.
    const human = computed({
      ...goldenA,
      ...mixing,
      systemData: { ...goldenA.systemData, species: { id: HUMAN, size: 'medium' } },
    });
    expect(spoken(human)).toEqual(ACOLYTE_SPOKEN);
    expect(ruleWarnings(human)).toEqual([
      { code: 'characterRule', rule: 'noStartingLanguages', data: { entity: HUMAN } },
    ]);
    const warning = human.warnings.find(({ code }) => code === 'characterRule');
    expect(warning?.message).toBe(
      `No species, lineage or background gives starting languages by its edition's rules; "${HUMAN}" is of another edition.`,
    );
    // Golden B, a 2024 character, with the 2014 Acolyte: the Acolyte is the first of another
    // edition.
    const acolyte = computed({
      ...goldenB,
      ...mixing,
      choices: { ...goldenB.choices, [ACOLYTE_LANGUAGES]: ['celestial', 'elvish'] },
      systemData: { ...goldenB.systemData, background: { id: ACOLYTE } },
    });
    expect(ruleWarnings(acolyte)).toEqual([
      { code: 'characterRule', rule: 'noStartingLanguages', data: { entity: ACOLYTE } },
    ]);
    // One edition, or no origin at all: no warning, though none gives.
    for (const golden of [goldenB, goldenC2014, goldenC2024]) {
      expect(ruleWarnings(computed(golden))).toEqual([]);
    }
    // An origin of `any` is of no other edition: golden B with a Wayfarer of `any` that gives no
    // language.
    const silent = { ...wayfarer('any'), grants: [] };
    const anyOrigin = computed({
      ...goldenB,
      localEntities: [silent],
      systemData: { ...goldenB.systemData, background: { id: WAYFARER } },
    });
    expect(ruleWarnings(anyOrigin)).toEqual([]);
  });

  it("opens a golden of version 3 with its rules base's place", () => {
    for (const [golden, place] of [
      [goldenA, 'species'],
      [goldenB, 'background'],
    ] as const) {
      const { languageSource: _, ...unplaced } = golden.systemData;
      const old = { ...golden, systemSchemaVersion: 3, systemData: unplaced };
      const character: FifthEditionCharacter = opened(openFifthEditionCharacter(old));
      expect([golden.name, character.systemData.languageSource]).toEqual([golden.name, place]);
    }
  });
});
