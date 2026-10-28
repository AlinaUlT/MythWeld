import { compute, loadContentIndex, type SystemModule } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  ashExpected,
  ash as ashFile,
  brookExpected,
  brook as brookFile,
  openTalesCharacter,
  openTalesPack,
  type TalesCharacter,
  type TalesEntity,
  talesCore,
} from '../../schema/test/tales/index.ts';
import { talesModule } from './tales-module.ts';

// Tales, the made-up test system (ENG-27). Every expected value is read by hand from its data:
// Ash is level 2, with the knacks `climb` and `sneak` and the lore `stars`; Brook is level 3, with
// nerve 8 (base 9, above its maximum 8), the calling Seeker and the talent Iron Will, whose
// prerequisites (level 4, the craft `rope`) it does not meet (ENG-27's `unmetPrerequisites`).

/** The value of an opener's result, or a failed test naming why it did not open. */
function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const pack = opened(openTalesPack(talesCore));
const { index } = loadContentIndex('tales', [pack]);
const ash = opened(openTalesCharacter(ashFile));
const brook = opened(openTalesCharacter(brookFile));

const IRON_WILL = 'tales-core:talent/iron-will';
const TEST = 'character:talent/test';

type Module = SystemModule<TalesCharacter, TalesEntity>;

/** A prerequisite of Tales, its proficiency categories its own. */
type Prerequisite = NonNullable<TalesEntity['prerequisites']>[number];

/** Tales' character, computed with its module. */
function computed(character: TalesCharacter, system: Module = talesModule) {
  return compute(character, index, system);
}

/** The prerequisite warnings, without their log message. */
function prerequisiteCodes(character: TalesCharacter, system: Module = talesModule) {
  return computed(character, system).warnings.flatMap(({ message: _, ...warning }) =>
    warning.code === 'unmetPrerequisite' || warning.code === 'prerequisiteFormula' ? [warning] : [],
  );
}

/** The character with one more talent of its own, `character:talent/test`, asking `prerequisites`. */
function asking(base: TalesCharacter, prerequisites: Prerequisite[]): TalesCharacter {
  const test: TalesEntity = {
    id: TEST,
    type: 'talent',
    ruleset: 'any',
    name: { en: 'Test' },
    tier: 1,
    prerequisites,
    source: { pack: 'character' },
  };
  return opened(
    openTalesCharacter({
      ...base,
      localEntities: [...base.localEntities, test],
      systemData: { ...base.systemData, talents: [...base.systemData.talents, TEST] },
    }),
  );
}

/** The unmet ones of `prerequisites`, when Brook (or `base`) has the test talent asking them. */
function unmetOf(prerequisites: Prerequisite[], base = brook) {
  return prerequisiteCodes(asking(base, prerequisites)).flatMap((warning) =>
    warning.code === 'unmetPrerequisite' && warning.entity === TEST ? [warning.prerequisite] : [],
  );
}

describe('SHEET-14 an unmet prerequisite gives a warning', () => {
  it.each([
    ['Ash', ash, ashExpected],
    ['Brook', brook, brookExpected],
  ] as const)(
    "%s: the entities whose prerequisites are unmet are ENG-27's",
    (_, character, expected) => {
      const unmet = prerequisiteCodes(character).flatMap((warning) =>
        warning.code === 'unmetPrerequisite' ? [warning.entity] : [],
      );
      expect([...new Set(unmet)]).toEqual(expected.unmetPrerequisites);
    },
  );

  it("Brook: one warning for each of Iron Will's two prerequisites, in their order", () => {
    const result = computed(brook);
    const warnings = result.warnings.filter(({ code }) => code === 'unmetPrerequisite');
    expect(warnings).toEqual([
      {
        code: 'unmetPrerequisite',
        entity: IRON_WILL,
        prerequisite: { kind: 'level', min: 4 },
        message: `${IRON_WILL} has a prerequisite the character does not meet: level 4.`,
      },
      {
        code: 'unmetPrerequisite',
        entity: IRON_WILL,
        prerequisite: { kind: 'proficiency', category: 'craft', key: 'rope' },
        message: `${IRON_WILL} has a prerequisite the character does not meet: craft rope.`,
      },
    ]);
  });

  it('never blocks: Iron Will is had, and its `will` effect still adds 2', () => {
    const result = computed(brook);
    expect(result.entities.map(({ entity }) => entity.id)).toContain(IRON_WILL);
    expect(result.values['skills.steady.total']).toBe(7); // nerve 5 + 2 × 0 + `will` 2
    expect(result.breakdown['skills.steady.bonus']).toContainEqual(
      expect.objectContaining({ kind: 'effect', part: `${IRON_WILL}#will`, change: 2 }),
    );
  });

  it('an ability: met at the score, unmet above it; a stat the character lacks reads 0', () => {
    expect(
      unmetOf([
        { kind: 'ability', key: 'nerve', min: 8 },
        { kind: 'ability', key: 'nerve', min: 9 },
        { kind: 'ability', key: 'luck', min: 0 },
        { kind: 'ability', key: 'luck', min: 1 },
      ]),
    ).toEqual([
      { kind: 'ability', key: 'nerve', min: 9 }, // the score is its maximum 8, not the base 9
      { kind: 'ability', key: 'luck', min: 1 },
    ]);
  });

  it('an ability reads the score after a manual edit', () => {
    const edited = opened(
      openTalesCharacter({
        ...asking(brook, [{ kind: 'ability', key: 'nerve', min: 5 }]),
        overrides: [{ path: 'abilities.nerve.score', value: 4 }],
      }),
    );
    expect(prerequisiteCodes(edited).filter(({ entity }) => entity === TEST)).toEqual([
      {
        code: 'unmetPrerequisite',
        entity: TEST,
        prerequisite: { kind: 'ability', key: 'nerve', min: 5 },
      },
    ]);
  });

  it("a level: met at the character's level, unmet above it", () => {
    expect(
      unmetOf([
        { kind: 'level', min: 3 },
        { kind: 'level', min: 4 },
      ]),
    ).toEqual([{ kind: 'level', min: 4 }]);
  });

  it('an entity: met when had, unmet when not had or in no pack, with no other warning', () => {
    const asked: Prerequisite[] = [
      { kind: 'entity', id: 'tales-core:calling/seeker' },
      { kind: 'entity', id: 'tales-core:talent/deep-lungs' },
      { kind: 'entity', id: 'tales-core:talent/nowhere' },
    ];
    const character = asking(brook, asked);
    expect(unmetOf(asked)).toEqual([
      { kind: 'entity', id: 'tales-core:talent/deep-lungs' },
      { kind: 'entity', id: 'tales-core:talent/nowhere' },
    ]);
    expect(computed(character).warnings.map(({ code }) => code)).toEqual([
      'missing', // Brook's own talent no pack has (ENG-27), not the prerequisite's
      'unmetPrerequisite',
      'unmetPrerequisite',
      'unmetPrerequisite',
      'unmetPrerequisite',
    ]);
  });

  it('a proficiency: met when a grant gives its category and key, whatever its level', () => {
    expect(
      unmetOf(
        [
          { kind: 'proficiency', category: 'lore', key: 'stars' }, // Night Warden, level 2
          { kind: 'proficiency', category: 'knack', key: 'climb' },
          { kind: 'proficiency', category: 'lore', key: 'climb' },
          { kind: 'proficiency', category: 'knack', key: 'steady' },
        ],
        ash,
      ),
    ).toEqual([
      { kind: 'proficiency', category: 'lore', key: 'climb' },
      { kind: 'proficiency', category: 'knack', key: 'steady' },
    ]);
  });

  it('a formula: met when true, on the computed values', () => {
    const label = { en: 'Made up' };
    expect(
      unmetOf([
        { kind: 'formula', formula: '@abilities.nerve.score >= 8 && @level >= 3', label },
        { kind: 'formula', formula: '@abilities.nerve.score > 8 || @level > 3', label },
      ]),
    ).toEqual([{ kind: 'formula', formula: '@abilities.nerve.score > 8 || @level > 3', label }]);
  });

  it('a formula reading a missing path reads 0 with a warning; one that does not parse is unmet', () => {
    const label = { en: 'Made up' };
    const codes = prerequisiteCodes(
      asking(brook, [
        { kind: 'formula', formula: '@abilities.luck.score >= 0', label },
        { kind: 'formula', formula: '1 +', label },
      ]),
    ).filter(({ entity }) => entity === TEST);
    expect(
      codes.map((warning) =>
        warning.code === 'prerequisiteFormula'
          ? { code: warning.code, inner: warning.warning.code }
          : { code: warning.code, formula: warning.prerequisite },
      ),
    ).toEqual([
      { code: 'prerequisiteFormula', inner: 'missingPath' }, // 0 >= 0: met
      { code: 'prerequisiteFormula', inner: 'unexpected' },
      { code: 'unmetPrerequisite', formula: { kind: 'formula', formula: '1 +', label } },
    ]);
  });

  it("a module's `prerequisitesOf` gives what each entity asks, with the character", () => {
    const seen: string[] = [];
    const asked: Module = {
      ...talesModule,
      prerequisitesOf: (character, entity) => {
        seen.push(`${character.name}: ${entity.id}`);
        return entity.type === 'calling' ? [{ kind: 'level', min: 5 }] : [];
      },
    };
    expect(prerequisiteCodes(brook, asked)).toEqual([
      {
        code: 'unmetPrerequisite',
        entity: 'tales-core:calling/seeker',
        prerequisite: { kind: 'level', min: 5 },
      },
    ]);
    expect(seen).toEqual([
      'Brook: tales-core:calling/seeker',
      'Brook: character:talent/lucky-charm',
      `Brook: ${IRON_WILL}`,
      'Brook: tales-core:condition/lost',
    ]);
  });

  it('changes no value: Brook computes the same with no prerequisites asked', () => {
    const none: Module = { ...talesModule, prerequisitesOf: () => [] };
    const result = computed(brook, none);
    expect(result.warnings.map(({ code }) => code)).toEqual(['missing']);
    expect(result.values).toEqual(computed(brook).values);
    expect(result.breakdown).toEqual(computed(brook).breakdown);
  });
});
