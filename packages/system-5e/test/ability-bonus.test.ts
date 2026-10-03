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

// ENG-35: whose ability score increases a character takes. Every expected score is a golden's
// stored base plus the increases its fixtures give, added by hand: the 2014 dwarf `con +2` and hill
// dwarf `wis +1` (`srd-2014.ts`), the 2024 Soldier `[2, 1]` over the two stats chosen
// (`srd-2024.ts`). The mixed characters are test data built on goldens A and B.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type BonusSource = CharacterInput['systemData']['abilities']['bonusSource'];

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

/** A character with another bonus source. */
function storing(character: CharacterInput, bonusSource: BonusSource): CharacterInput {
  const { systemData } = character;
  return {
    ...character,
    systemData: { ...systemData, abilities: { ...systemData.abilities, bonusSource } },
  };
}

/** Both SRD packs, with mixing on. */
const mixing = { allowMixedRulesets: true, packs: ['srd-2014', 'srd-2024'] };

const DWARF = 'srd-2014:species/dwarf';
const HILL_DWARF = 'srd-2014:lineage/hill-dwarf';
const SOLDIER = 'srd-2024:background/soldier';
const SOLDIER_INCREASES = `${SOLDIER}#ability-scores`;

/** Golden A, the 2014 hill dwarf, with the 2024 Soldier as its background. */
function dwarfSoldier(bonusSource: BonusSource, soldierStats: string[] = ['str', 'dex']) {
  return storing(
    {
      ...goldenA,
      ...mixing,
      choices: {
        ...goldenA.choices,
        [`${SOLDIER}#tools`]: ['dice'],
        ...(soldierStats.length > 0 && { [SOLDIER_INCREASES]: soldierStats }),
      },
      systemData: { ...goldenA.systemData, background: { id: SOLDIER } },
    },
    bonusSource,
  );
}

/** Golden B, the 2024 Soldier, with the 2014 dwarf and hill dwarf as its species. */
function soldierDwarf(bonusSource: BonusSource) {
  return storing(
    {
      ...goldenB,
      ...mixing,
      choices: {
        ...goldenB.choices,
        [`${DWARF}#subrace`]: [HILL_DWARF],
        'srd-2014:feature/tool-proficiency#tools': ['masonsTools'],
      },
      systemData: { ...goldenB.systemData, species: { id: DWARF } },
    },
    bonusSource,
  );
}

/** Each named stat's score. */
function scores(result: Computed<FifthEditionEntity>, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, result.values[`abilities.${key}.score`]]));
}

/** The parts of the `abilityScore` grants that apply. */
function increaseParts(result: Computed<FifthEditionEntity>): string[] {
  return result.grants.flatMap(({ part, grant }) => (grant.kind === 'abilityScore' ? [part] : []));
}

/** The `characterRule` warnings, without their log message. */
function ruleWarnings(result: Computed<FifthEditionEntity>) {
  return result.warnings.flatMap(({ message: _, ...warning }) =>
    warning.code === 'characterRule' ? [warning] : [],
  );
}

const FROM_BOTH = {
  code: 'characterRule',
  rule: 'abilityBonusesFromBoth',
  data: { species: DWARF, background: SOLDIER },
};

describe('ENG-35 the ability-bonus source', () => {
  it('takes the side stored when both sides give, or both with a warning', () => {
    const stats = ['str', 'dex', 'con', 'wis'];
    const species = computed(dwarfSoldier('species'));
    expect(scores(species, stats)).toEqual({ str: 13, dex: 10, con: 16, wis: 16 });
    expect(increaseParts(species)).toEqual([
      `${DWARF}#ability-scores`,
      `${HILL_DWARF}#ability-scores`,
    ]);
    expect(ruleWarnings(species)).toEqual([]);

    const background = computed(dwarfSoldier('background'));
    expect(scores(background, stats)).toEqual({ str: 15, dex: 11, con: 14, wis: 15 });
    expect(increaseParts(background)).toEqual([SOLDIER_INCREASES]);
    expect(ruleWarnings(background)).toEqual([]);

    const both = computed(dwarfSoldier('both'));
    expect(scores(both, stats)).toEqual({ str: 15, dex: 11, con: 16, wis: 16 });
    expect(increaseParts(both)).toEqual([
      `${DWARF}#ability-scores`,
      `${HILL_DWARF}#ability-scores`,
      SOLDIER_INCREASES,
    ]);
    expect(ruleWarnings(both)).toEqual([FROM_BOTH]);
    const warning = both.warnings.find(({ code }) => code === 'characterRule');
    expect(warning?.message).toBe(
      `Ability score increases apply from both "${DWARF}" and "${SOLDIER}": the bonus source is "both".`,
    );
    // Each score's breakdown still adds up to it, an increase a step of its own.
    expect(both.breakdown['abilities.str.score']).toEqual([
      { kind: 'base', value: 13, change: 13 },
      {
        kind: 'grant',
        part: SOLDIER_INCREASES,
        source: SOLDIER,
        label: { en: 'Soldier' },
        value: 2,
        change: 2,
      },
    ]);
  });

  it("leaves out only the other side's increases: no pending choice, the rest still given", () => {
    const pending = (result: Computed<FifthEditionEntity>) =>
      result.pendingChoices.map(({ part }) => part);
    // The Soldier's increases not yet placed: pending only when the background's apply.
    expect(pending(computed(dwarfSoldier('species', [])))).toEqual([]);
    expect(pending(computed(dwarfSoldier('background', [])))).toEqual([SOLDIER_INCREASES]);
    expect(pending(computed(dwarfSoldier('both', [])))).toEqual([SOLDIER_INCREASES]);

    // The Soldier's skills, the hill dwarf's own trait: given whichever side is left out.
    for (const source of ['species', 'background'] as const) {
      const result = computed(dwarfSoldier(source));
      const skills = result.proficiencies.filter(({ category }) => category === 'skill');
      expect(
        skills.filter(({ from }) => from === `${SOLDIER}#skills`).map(({ key }) => key),
      ).toEqual(['athletics', 'intimidation']);
      expect(result.entities.map(({ entity }) => entity.id)).toContain(
        'srd-2014:feature/dwarven-toughness',
      );
    }
  });

  it('applies the one side that gives whatever is stored, and warns for nothing', () => {
    // The 2014 Acolyte gives no increases: golden A keeps its dwarf's.
    for (const source of ['background', 'both'] as const) {
      const result = computed(storing(goldenA, source));
      expect(scores(result, ['con', 'wis'])).toEqual({ con: 16, wis: 16 });
      expect(result.warnings).toEqual([]);
    }
    // No background at all: the same.
    const { background: _, ...noBackground } = goldenA.systemData;
    const alone = computed(storing({ ...goldenA, systemData: noBackground }, 'background'));
    expect(scores(alone, ['con', 'wis'])).toEqual({ con: 16, wis: 16 });
    expect(alone.warnings).toEqual([]);
    // The 2024 human gives none: golden B keeps its Soldier's.
    for (const source of ['species', 'both'] as const) {
      const result = computed(storing(goldenB, source));
      expect(scores(result, ['str', 'con'])).toEqual({ str: 17, con: 15 });
      expect(result.warnings).toEqual([]);
    }
  });

  it('counts a side as giving only once its increase applies at the character level', () => {
    // Made up here: a species whose one increase comes at level 4.
    const lateKin: FifthEditionCharacter['localEntities'][number] = {
      id: 'character:species/late-kin',
      type: 'species',
      ruleset: 'any',
      name: { en: 'Late kin' },
      source: { pack: 'character' },
      size: ['medium'],
      speed: { walk: 30 },
      grants: [
        {
          id: 'ability-scores',
          kind: 'abilityScore',
          mode: 'fixed',
          atLevel: 4,
          values: { wis: 1 },
        },
      ],
    };
    const withKin = (golden: CharacterInput, bonusSource: BonusSource) =>
      storing(
        {
          ...golden,
          localEntities: [lateKin],
          systemData: { ...golden.systemData, species: { id: lateKin.id } },
        },
        bonusSource,
      );
    const stats = ['str', 'con', 'wis'];
    // Golden B, level 1: the kin gives nothing yet, so the Soldier's apply though `species` is stored.
    expect(scores(computed(withKin(goldenB, 'species')), stats)).toEqual({
      str: 17,
      con: 15,
      wis: 12,
    });
    // Golden B4, level 4, with its own +2 STR: both sides give, and the stored side is taken.
    expect(scores(computed(withKin(goldenB4, 'species')), stats)).toEqual({
      str: 17,
      con: 14,
      wis: 13,
    });
    expect(scores(computed(withKin(goldenB4, 'background')), stats)).toEqual({
      str: 19,
      con: 15,
      wis: 12,
    });
  });

  it("counts a lineage's increase, fixed or chosen, on its species' side", () => {
    // Made up here: a species with no increase whose lineage gives `str +1`.
    const strongKin: FifthEditionCharacter['localEntities'][number] = {
      id: 'character:lineage/strong-kin',
      type: 'lineage',
      ruleset: 'any',
      name: { en: 'Strong kin' },
      source: { pack: 'character' },
      grants: [{ id: 'ability-scores', kind: 'abilityScore', mode: 'fixed', values: { str: 1 } }],
    };
    const lineage = { id: 'lineage', kind: 'entity' } as const;
    const ways = {
      fixed: { ...lineage, fixed: [strongKin.id] },
      chosen: { ...lineage, choose: { count: 1, from: [strongKin.id] } },
    };
    for (const [way, grant] of Object.entries(ways)) {
      const kin: FifthEditionCharacter['localEntities'][number] = {
        id: 'character:species/kin',
        type: 'species',
        ruleset: 'any',
        name: { en: 'Kin' },
        source: { pack: 'character' },
        size: ['medium'],
        speed: { walk: 30 },
        grants: [grant],
      };
      const withKin = (bonusSource: BonusSource) =>
        storing(
          {
            ...goldenB,
            choices: { ...goldenB.choices, [`${kin.id}#lineage`]: [strongKin.id] },
            localEntities: [kin, strongKin],
            systemData: { ...goldenB.systemData, species: { id: kin.id } },
          },
          bonusSource,
        );
      // Golden B's bases `str 15, con 14`; the Soldier's `str +2, con +1`.
      const stats = ['str', 'con'];
      expect([way, scores(computed(withKin('background')), stats)]).toEqual([
        way,
        { str: 17, con: 15 },
      ]);
      expect([way, scores(computed(withKin('species')), stats)]).toEqual([
        way,
        { str: 16, con: 14 },
      ]);
    }
  });

  it("stores the rules base's source in every golden, which takes its side in a mix", () => {
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
        character.systemData.abilities.bonusSource,
        rulesOf(character).abilityBonusSource,
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

    // Golden B, a 2024 character, with the 2014 dwarf: its default takes the Soldier's.
    const stats = ['str', 'con', 'wis'];
    expect(scores(computed(soldierDwarf('background')), stats)).toEqual({
      str: 17,
      con: 15,
      wis: 12,
    });
    expect(scores(computed(soldierDwarf('species')), stats)).toEqual({ str: 15, con: 16, wis: 13 });
    expect(ruleWarnings(computed(soldierDwarf('both')))).toEqual([FROM_BOTH]);
  });
});
