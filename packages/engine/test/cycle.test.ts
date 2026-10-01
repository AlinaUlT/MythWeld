import {
  type ComputeWarning,
  compute,
  type DerivedStep,
  loadContentIndex,
  type SystemModule,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  ash as ashFile,
  brook as brookFile,
  openTalesCharacter,
  openTalesPack,
  type TalesCharacter,
  type TalesEntity,
  talesCore,
} from '../../schema/test/tales/index.ts';
import { talesModule } from './tales-module.ts';

// Tales, the made-up test system (ENG-27). Every expected value below is worked out by hand from
// Tales' rules (`tales/system.ts`), its data (`tales/content.ts`, `tales/characters.ts`) and the
// variants written here, and checked with python3. Ash before any variant: grit 7 (mod 3), wits 5
// (mod 2), level 2, `nimble` +2 on `skills.climb.bonus`, weary at level 1, so `skills.all.bonus`
// is -1. A stat of Ash's own comes after its three, in the order given.

/** The value of an opener's result, or a failed test naming why it did not open. */
function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const pack = opened(openTalesPack(talesCore));
const { index } = loadContentIndex('tales', [pack]);
const ash = opened(openTalesCharacter(ashFile));
const brook = opened(openTalesCharacter(brookFile));
const source = { pack: 'character' };

type Module = SystemModule<TalesCharacter, TalesEntity>;

/** A stat of the character's own, with its modifier formula. */
function stat(key: string, modFormula: string, order: number): TalesEntity {
  return {
    id: `character:ability/${key}`,
    type: 'ability',
    key,
    ruleset: 'any',
    name: { en: key },
    abbr: { en: key },
    order,
    modFormula,
    source,
  };
}

/** Ash with stats of its own (each with base score 4) and talents of its own. */
function ashWith(stats: [key: string, modFormula: string][], talents: TalesEntity[] = []) {
  return opened(
    openTalesCharacter({
      ...ash,
      localEntities: [
        ...stats.map(([key, modFormula], order) => stat(key, modFormula, 3 + order)),
        ...talents,
      ],
      abilities: {
        base: { ...ash.abilities.base, ...Object.fromEntries(stats.map(([key]) => [key, 4])) },
      },
      systemData: { ...ash.systemData, talents: talents.map(({ id }) => id) },
    }),
  );
}

/** Tales' module with more steps after its own. */
function withSteps(more: Record<string, DerivedStep>): Module {
  return { ...talesModule, derive: (input) => ({ ...talesModule.derive(input), ...more }) };
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

/** Each warning without its log message. */
function codes(result: { warnings: readonly ComputeWarning[] }) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

describe('ENG-18 a formula loop names its paths', () => {
  it('names every path of a loop through a modifier, a grant, a module step and an effect', () => {
    const knot: TalesEntity = {
      id: 'character:talent/knot',
      type: 'talent',
      ruleset: 'any',
      name: { en: 'Knot' },
      tier: 1,
      grants: [
        {
          id: 'charm',
          kind: 'resource',
          key: 'charm',
          label: { en: 'Charm' },
          uses: { max: '@skills.climb.total', recovery: [{ on: 'scene', amount: 'all' }] },
        },
      ],
      effects: [
        { id: 'pull', target: 'skills.climb.bonus', op: 'add', value: '@abilities.fate.mod' },
      ],
      source,
    };
    const result = computed(ashWith([['fate', '@resources.charm.max + 1']], [knot]));
    expect(result.values).toMatchObject({
      'skills.climb.bonus': 2, // `nimble` 2 + `pull` 0, fate read inside its loop
      'skills.climb.total': 6, // grit 3 + 2 × 1 + 2 - 1
      'resources.charm.max': 6, // the climb total
      'abilities.fate.mod': 7, // charm 6 + 1
    });
    expect(codes(result)).toEqual([
      {
        code: 'cycle',
        path: 'abilities.fate.mod',
        for: 'skills.climb.bonus',
        loop: [
          { path: 'abilities.fate.mod' },
          { path: 'resources.charm.max' },
          { path: 'skills.climb.total', by: 'character:talent/knot#charm' },
          { path: 'skills.climb.bonus' },
          { path: 'abilities.fate.mod', by: 'character:talent/knot#pull' },
        ],
      },
    ]);
    expect(result.warnings[0]?.message).toBe(
      '@abilities.fate.mod is read for skills.climb.bonus while it is being computed; 0 is used. ' +
        'The loop: @abilities.fate.mod → @resources.charm.max → ' +
        '@skills.climb.total (read by "character:talent/knot#charm") → @skills.climb.bonus → ' +
        '@abilities.fate.mod (read by "character:talent/knot#pull").',
    );
  });

  it('a path that reads into a loop from outside it is not on the loop', () => {
    const result = computed(
      ashWith([
        ['lead', '@abilities.luck.mod + 1'],
        ['luck', '@abilities.hope.mod + 1'],
        ['hope', '@abilities.luck.mod + 1'],
      ]),
    );
    expect(result.values).toMatchObject({
      'abilities.lead.mod': 3, // luck 2 + 1
      'abilities.luck.mod': 2, // hope 1 + 1
      'abilities.hope.mod': 1, // luck read inside its loop as 0, + 1
    });
    expect(codes(result)).toEqual([
      {
        code: 'cycle',
        path: 'abilities.luck.mod',
        for: 'abilities.hope.mod',
        loop: [
          { path: 'abilities.luck.mod' },
          { path: 'abilities.hope.mod' },
          { path: 'abilities.luck.mod' },
        ],
      },
    ]);
    expect(result.warnings[0]?.message).toBe(
      '@abilities.luck.mod is read for abilities.hope.mod while it is being computed; 0 is used. ' +
        'The loop: @abilities.luck.mod → @abilities.hope.mod → @abilities.luck.mod.',
    );
  });

  it('two loops through one path give two warnings, each naming its own', () => {
    const result = computed(
      ashWith([
        ['hub', '@abilities.left.mod + @abilities.right.mod'],
        ['left', '@abilities.hub.mod + 1'],
        ['right', '@abilities.hub.mod + 2'],
      ]),
    );
    expect(result.values).toMatchObject({
      'abilities.hub.mod': 3, // left 1 + right 2
      'abilities.left.mod': 1, // hub read inside its loop as 0, + 1
      'abilities.right.mod': 2, // hub read inside its loop as 0, + 2
    });
    expect(codes(result)).toEqual([
      {
        code: 'cycle',
        path: 'abilities.hub.mod',
        for: 'abilities.left.mod',
        loop: [
          { path: 'abilities.hub.mod' },
          { path: 'abilities.left.mod' },
          { path: 'abilities.hub.mod' },
        ],
      },
      {
        code: 'cycle',
        path: 'abilities.hub.mod',
        for: 'abilities.right.mod',
        loop: [
          { path: 'abilities.hub.mod' },
          { path: 'abilities.right.mod' },
          { path: 'abilities.hub.mod' },
        ],
      },
    ]);
  });

  it("a module's step that reads through `readBy` names the part; the loop's first path has no `by`", () => {
    // The parts are only names here: a step of a module that evaluates a pack's formula passes its own.
    const plain: DerivedStep = (read, readBy) => {
      const grit = readBy('character:talent/knot#grit')('abilities.grit.mod');
      const echo = read('echo');
      return {
        value: grit + echo,
        steps: [
          { kind: 'path', path: 'abilities.grit.mod', value: grit, change: grit },
          { kind: 'path', path: 'echo', value: echo, change: echo },
        ],
      };
    };
    const result = computed(
      ash,
      withSteps({
        relay: (_, readBy) => {
          const value = readBy('character:talent/knot#relay')('echo');
          return { value, steps: [{ kind: 'path', path: 'echo', value, change: value }] };
        },
        echo: (_, readBy) => {
          const value = readBy('character:talent/knot#ring')('echo') + 1;
          return { value, steps: [{ kind: 'rule', rule: 'echo', value, change: value }] };
        },
        plain,
      }),
    );
    expect(result.values).toMatchObject({
      relay: 1, // echo
      echo: 1, // itself read inside its loop as 0, + 1
      plain: 4, // grit 3, read by a part with no loop, + echo 1
    });
    expect(codes(result)).toEqual([
      {
        code: 'cycle',
        path: 'echo',
        for: 'echo',
        loop: [{ path: 'echo' }, { path: 'echo', by: 'character:talent/knot#ring' }],
      },
    ]);
  });

  it('Ash and Brook, with no loop, get no `cycle`', () => {
    for (const character of [ash, brook]) {
      const result = computed(character);
      expect(result.warnings.filter(({ code }) => code === 'cycle')).toEqual([]);
    }
  });
});
