import {
  type ComputeWarning,
  compute,
  type DerivedStep,
  loadContentIndex,
  type SystemModule,
} from '@grimoire/engine';
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

// Tales, the made-up test system (ENG-27). Ash's and Brook's maximums are ENG-27's expected
// values; every other expected value is worked out by hand from Tales' rules (`tales/system.ts`),
// its data and the variants written here. Ash: level 2, grit mod 3, nerve mod 1, climb total 5
// before ENG-17's effects (ENG-28), and warden `luck` `@abilities.nerve.mod + 1`.

/** The value of an opener's result, or a failed test naming why it did not open. */
function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const pack = opened(openTalesPack(talesCore));
const { index } = loadContentIndex('tales', [pack]);
const ash = opened(openTalesCharacter(ashFile));
const brook = opened(openTalesCharacter(brookFile));

type Module = SystemModule<TalesCharacter, TalesEntity>;

/** A talent of the character's own whose grants give these resources, each by its formula. */
function talent(slug: string, resources: [key: string, max: string][]): TalesEntity {
  return {
    id: `character:talent/${slug}`,
    type: 'talent',
    ruleset: 'any',
    name: { en: slug },
    tier: 1,
    grants: resources.map(([key, max]) => ({
      id: key.toLowerCase(),
      kind: 'resource',
      key,
      label: { en: key },
      uses: { max, recovery: [{ on: 'scene', amount: 'all' }] },
    })),
    source: { pack: 'character' },
  };
}

/** Ash with talents of its own, taken in this order, after its calling's. */
function ashWith(...talents: TalesEntity[]): TalesCharacter {
  return opened(
    openTalesCharacter({
      ...ash,
      localEntities: talents,
      systemData: { ...ash.systemData, talents: talents.map(({ id }) => id) },
    }),
  );
}

/** Tales' character, computed with its module. Every breakdown adds up to its value. */
function computed(character: TalesCharacter, system: Module = talesModule) {
  const result = compute(character, index, system);
  for (const [path, steps] of Object.entries(result.breakdown)) {
    const sum = steps.reduce((total, step) => total + step.change, 0);
    expect(sum, path).toBe(result.values[path]);
  }
  expect(Object.keys(result.breakdown)).toEqual(Object.keys(result.values));
  return result;
}

/** Each warning without its log message; a formula's as its key, part and inner code. */
function codes(result: { warnings: readonly ComputeWarning[] }) {
  return result.warnings.map(({ message: _, ...warning }) =>
    warning.code === 'resourceFormula'
      ? { code: warning.code, key: warning.key, part: warning.part, inner: warning.warning.code }
      : warning,
  );
}

/** A `grant` step of a talent of Ash's own. */
function ownStep(slug: string, key: string, formula: string, value: number, change: number) {
  const source = `character:talent/${slug}`;
  return {
    kind: 'grant',
    part: `${source}#${key.toLowerCase()}`,
    source,
    label: { en: slug },
    formula,
    value,
    change,
  };
}

/** The warden's `luck` step, worth 2 on Ash. */
const wardenLuck = {
  kind: 'grant',
  part: 'tales-core:calling/warden#luck',
  source: 'tales-core:calling/warden',
  label: { en: 'Warden' },
  formula: '@abilities.nerve.mod + 1',
  value: 2,
  change: 2,
};

describe('ENG-29 resource maximums', () => {
  it("Ash and Brook: each resource's maximum and breakdown, as ENG-27 expects", () => {
    const ashResult = computed(ash);
    expect(ashResult.values['resources.luck.max']).toBe(ashExpected.values['resources.luck.max']);
    expect(ashResult.values['resources.luck.max']).toBe(2); // nerve mod 1 + 1
    expect(ashResult.breakdown['resources.luck.max']).toEqual([wardenLuck]);
    expect(ashResult.warnings).toEqual([]);

    const brookResult = computed(brook);
    expect(brookResult.values['resources.focus.max']).toBe(
      brookExpected.values['resources.focus.max'],
    );
    expect(brookResult.values['resources.focus.max']).toBe(6); // level 3 × 2
    expect(brookResult.breakdown['resources.focus.max']).toEqual([
      {
        kind: 'grant',
        part: 'tales-core:calling/seeker#focus',
        source: 'tales-core:calling/seeker',
        label: { en: 'Seeker' },
        formula: '@level * 2',
        value: 6,
        change: 6,
      },
    ]);
    expect(Object.keys(brookResult.values).filter((path) => path.startsWith('resources.'))).toEqual(
      ['resources.focus.max'],
    ); // the boon does not gather Deep Lungs, so no `breath`
    expect(brookResult.warnings.map(({ code }) => code)).toEqual(['missing']);
  });

  it('two grants of one key give one resource: the highest maximum, the first one higher', () => {
    const { values, breakdown, warnings } = computed(
      ashWith(talent('same', [['luck', '2']]), talent('less', [['luck', '1']])),
    );
    expect(values['resources.luck.max']).toBe(2); // warden 2, same 2, less 1
    expect(breakdown['resources.luck.max']).toEqual([
      wardenLuck,
      ownStep('same', 'luck', '2', 2, 0), // equal: adds nothing
      ownStep('less', 'luck', '1', 1, 0),
    ]);
    expect(warnings).toEqual([]);
  });

  it('the highest maximum whatever the order: last, or in between', () => {
    const more = talent('more', [['luck', '@level + 3']]); // 2 + 3 = 5
    const some = talent('some', [['luck', '3']]);
    const last = computed(ashWith(some, more));
    expect(last.values['resources.luck.max']).toBe(5);
    expect(last.breakdown['resources.luck.max']).toEqual([
      wardenLuck,
      ownStep('some', 'luck', '3', 3, 1), // 3 above warden's 2
      ownStep('more', 'luck', '@level + 3', 5, 2), // 5 above 3
    ]);
    const between = computed(ashWith(more, some));
    expect(between.values['resources.luck.max']).toBe(5);
    expect(between.breakdown['resources.luck.max']).toEqual([
      wardenLuck,
      ownStep('more', 'luck', '@level + 3', 5, 3), // 5 above warden's 2
      ownStep('some', 'luck', '3', 3, 0),
    ]);
    expect(between.warnings).toEqual([]);
  });

  it("a maximum reads a stat, @level, a module's path and another resource, in any order", () => {
    const { values, breakdown, warnings } = computed(
      ashWith(
        talent('tinker', [
          ['grip', '@abilities.grit.mod'],
          ['days', '@level * 3'],
          ['knack', '@skills.climb.total'],
          ['echo', '@resources.luck.max + @resources.later.max'],
          ['later', '1'],
        ]),
      ),
    );
    expect(values).toMatchObject({
      'resources.luck.max': 2,
      'resources.grip.max': 3, // grit mod
      'resources.days.max': 6, // level 2 × 3
      'resources.knack.max': 5, // climb total before ENG-17's effects: grit 3 + 2 × 1
      'resources.echo.max': 3, // luck 2 + later 1, given after it
      'resources.later.max': 1,
    });
    expect(breakdown['resources.echo.max']).toEqual([
      ownStep('tinker', 'echo', '@resources.luck.max + @resources.later.max', 3, 3),
    ]);
    expect(warnings).toEqual([]);
  });

  it('a formula that does not parse or is not finite gives 0; a missing path or a loop reads 0', () => {
    const result = computed(
      ashWith(
        talent('broken', [
          ['snap', '@level +'],
          ['nada', '1 / 0'],
          ['gone', '@nowhere.at.all + 1'],
          ['loop', '@resources.loop.max + 1'],
        ]),
      ),
    );
    expect(result.values).toMatchObject({
      'resources.snap.max': 0, // does not parse
      'resources.nada.max': 0, // not finite
      'resources.gone.max': 1, // the missing path reads 0, + 1
      'resources.loop.max': 1, // itself read in its loop as 0, + 1
    });
    expect(result.breakdown['resources.snap.max']).toEqual([
      ownStep('broken', 'snap', '@level +', 0, 0),
    ]);
    expect(codes(result)).toEqual([
      {
        code: 'resourceFormula',
        key: 'snap',
        part: 'character:talent/broken#snap',
        inner: 'unexpected',
      },
      {
        code: 'resourceFormula',
        key: 'nada',
        part: 'character:talent/broken#nada',
        inner: 'notFinite',
      },
      { code: 'missingPath', path: 'nowhere.at.all', for: 'resources.gone.max' },
      { code: 'cycle', path: 'resources.loop.max', for: 'resources.loop.max' },
    ]);
    expect(result.warnings[0]?.message).toMatch(
      /\(the maximum of the resource "snap", given by character:talent\/broken#snap\)\.$/,
    );
  });

  it("a module's step for a resource the character has is not used; for one it lacks, it is", () => {
    const sneaky: DerivedStep = () => ({
      value: 99,
      steps: [{ kind: 'rule', rule: 'sneaky', value: 99, change: 99 }],
    });
    const result = computed(ash, {
      ...talesModule,
      derive: (input) => ({
        ...talesModule.derive(input),
        'resources.luck.max': sneaky,
        'resources.spare.max': sneaky,
      }),
    });
    expect(result.values).toMatchObject({
      'resources.luck.max': 2,
      'resources.spare.max': 99, // Ash has no `spare`: the path is the module's
    });
    expect(codes(result)).toEqual([{ code: 'pathTaken', path: 'resources.luck.max' }]);
  });

  it("values: the stats, then each resource in the order its key is first given, then the module's", () => {
    const { values } = computed(
      ashWith(
        talent('first', [
          ['zest', '1'],
          ['luck', '1'],
        ]),
        talent('second', [['aim', '1']]),
      ),
    );
    expect(Object.keys(values).slice(9, 14)).toEqual([
      'abilities.nerve.mod',
      'resources.luck.max', // the warden gives it first
      'resources.zest.max',
      'resources.aim.max',
      'skills.all.bonus',
    ]);
  });
});
