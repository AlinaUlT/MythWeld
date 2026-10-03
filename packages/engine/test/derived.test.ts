import {
  type ComputeWarning,
  compute,
  type DerivedStep,
  type EffectWarning,
  evaluateNumber,
  loadContentIndex,
  type StatOf,
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

// Tales, the made-up test system (ENG-27). Every expected value below is worked out by hand from
// Tales' rules (`tales/system.ts`), its data (`tales/content.ts`, `tales/characters.ts`) and the
// variants written here; ENG-27's `tales/expected.ts` gives Ash's and Brook's. Since ENG-17 the
// values include the effects and overrides; a total's own step, before them, is written beside it.

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

/** A character changed, then opened as a file would be, so it is still a valid character. */
function variant(base: TalesCharacter, change: Partial<TalesCharacter>): TalesCharacter {
  return opened(openTalesCharacter({ ...base, ...change }));
}

/** Ash with stats of its own, each with this base score. */
function ashWithStats(stats: [key: string, modFormula: string | undefined, base: number][]) {
  return variant(ash, {
    localEntities: stats.map(([key, modFormula], order) => ({
      id: `character:ability/${key}`,
      type: 'ability',
      key,
      ruleset: 'any',
      name: { en: key },
      abbr: { en: key },
      order: 3 + order,
      ...(modFormula !== undefined && { modFormula }),
      source,
    })),
    abilities: {
      base: { ...ash.abilities.base, ...Object.fromEntries(stats.map(([key, , n]) => [key, n])) },
    },
  });
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

/** Each warning without its log message; a formula's as its key, `of` and inner code. */
function codes(result: { warnings: readonly ComputeWarning[] }) {
  return result.warnings.map(({ message: _, ...warning }) =>
    warning.code === 'modFormula'
      ? { code: 'modFormula', key: warning.key, of: warning.of, inner: warning.warning.code }
      : warning,
  );
}

/** Tales' module with more steps after its own. */
function withSteps(more: (input: Parameters<Module['derive']>[0]) => Record<string, DerivedStep>) {
  return {
    ...talesModule,
    derive: (input) => ({ ...talesModule.derive(input), ...more(input) }),
  } satisfies Module;
}

describe('ENG-28 derived values a system module supplies', () => {
  it("Ash: level, modifiers, knack levels and totals as ENG-27's", () => {
    const { values, warnings } = computed(ash);
    for (const path of Object.keys(ashExpected.values)) {
      expect(values[path], path).toBe(ashExpected.values[path]);
    }
    expect(values).toEqual({
      level: 2,
      'abilities.grit.score': 7,
      'abilities.grit.max': 10,
      'abilities.grit.mod': 3, // floor(7 / 2)
      'abilities.wits.score': 5,
      'abilities.wits.max': 10,
      'abilities.wits.mod': 2, // floor(5 / 2)
      'abilities.nerve.score': 4,
      'abilities.nerve.max': 8,
      'abilities.nerve.mod': 1, // 4 - 3, its own formula
      'resources.luck.max': 2, // nerve mod 1 + 1 (ENG-29)
      'conditions.weary.level': 1, // stored (ENG-17)
      'conditions.lost.level': 0, // not had
      'skills.all.bonus': -1, // weary's `tired`: -1 × weary's level 1 (ENG-17)
      'skills.climb.prof': 1, // warden `climber`
      'skills.climb.bonus': 2, // `nimble`: wits mod 2 (ENG-17)
      'skills.climb.total': 6, // first-age climb on grit: 3 + 2 × 1 + 2 - 1 (before effects: 5)
      'skills.sneak.prof': 1, // warden `pick-knack`
      'skills.sneak.bonus': 1, // `shadow` (ENG-17)
      'skills.sneak.total': 4, // wits 2 + 2 × 1 + 1 - 1 (before effects: 4)
      'skills.steady.prof': 0,
      'skills.steady.bonus': 0,
      'skills.steady.total': 0, // nerve 1 + 2 × 0 + 0 - 1 (before effects: 1)
      'skills.steady.passive': 5, // 5 + 0 (before effects: 6)
    });
    expect(warnings).toEqual([]);
  });

  it("Brook: level, modifiers, knack levels and totals as ENG-27's", () => {
    const { values, warnings } = computed(brook);
    for (const path of Object.keys(brookExpected.values)) {
      expect(values[path], path).toBe(brookExpected.values[path]);
    }
    expect(values).toMatchObject({
      level: 3,
      'abilities.grit.mod': 3, // floor(6 / 2)
      'abilities.wits.mod': 4, // floor(8 / 2)
      'abilities.nerve.mod': 5, // 8 - 3
      'skills.climb.total': 4, // second-age climb on wits: 4 + 2 × 0
      'skills.sneak.total': 9, // the override (before it: wits 4 + 2 × 0 = 4)
      'skills.steady.total': 7, // nerve 5 + 2 × 0 + `will` 2 (before effects: 5)
      'skills.steady.passive': 12, // 5 + 7 (before effects: 10)
    });
    expect(warnings.map(({ code }) => code)).toEqual(['missing']);
  });

  it('Ash: the breakdown of the level, a modifier of each kind, a knack, a total, a passive', () => {
    const { breakdown } = computed(ash);
    expect(breakdown.level).toEqual([{ kind: 'level', value: 2, change: 2 }]);
    expect(breakdown['abilities.grit.mod']).toEqual([
      { kind: 'formula', formula: 'floor(@score / 2)', of: 'system', value: 3, change: 3 },
    ]);
    expect(breakdown['abilities.nerve.mod']).toEqual([
      { kind: 'formula', formula: '@score - 3', of: 'stat', value: 1, change: 1 },
    ]);
    expect(breakdown['skills.climb.prof']).toEqual([
      {
        kind: 'grant',
        part: 'tales-core:calling/warden#climber',
        source: 'tales-core:calling/warden',
        label: { en: 'Warden' },
        value: 1,
        change: 1,
      },
    ]);
    expect(breakdown['skills.steady.prof']).toEqual([]);
    expect(breakdown['skills.climb.total']).toEqual([
      { kind: 'path', path: 'abilities.grit.mod', value: 3, change: 3 },
      { kind: 'path', path: 'skills.climb.prof', value: 1, change: 2 },
      { kind: 'path', path: 'skills.climb.bonus', value: 2, change: 2 }, // `nimble` (ENG-17)
      { kind: 'path', path: 'skills.all.bonus', value: -1, change: -1 }, // weary (ENG-17)
    ]);
    expect(breakdown['skills.steady.passive']).toEqual([
      { kind: 'rule', rule: 'passiveBase', value: 5, change: 5 },
      { kind: 'path', path: 'skills.steady.total', value: 0, change: 0 },
    ]);
  });

  it("a skill's knack level is its highest knack grant's; an equal one keeps the first", () => {
    const trained: TalesEntity = {
      id: 'character:talent/trained',
      type: 'talent',
      ruleset: 'any',
      name: { en: 'Trained' },
      tier: 1,
      grants: [
        { id: 'expert', kind: 'proficiency', category: 'knack', fixed: ['climb'], level: 3 },
        { id: 'also', kind: 'proficiency', category: 'knack', fixed: ['sneak'] },
        { id: 'lore', kind: 'proficiency', category: 'lore', fixed: ['steady'], level: 2 },
      ],
      source,
    };
    const character = variant(ash, {
      localEntities: [trained],
      systemData: { ...ash.systemData, talents: [trained.id] },
    });
    const { values, breakdown } = computed(character);
    expect(values['skills.climb.prof']).toBe(3); // `expert` 3 over warden `climber` 1
    expect(values['skills.climb.total']).toBe(10); // grit 3 + 2 × 3 + `nimble` 2 - weary 1
    expect(breakdown['skills.climb.prof']).toEqual([
      {
        kind: 'grant',
        part: 'character:talent/trained#expert',
        source: 'character:talent/trained',
        label: { en: 'Trained' },
        value: 3,
        change: 3,
      },
    ]);
    expect(values['skills.sneak.prof']).toBe(1);
    expect(breakdown['skills.sneak.prof']).toMatchObject([
      { part: 'tales-core:calling/warden#pick-knack' },
    ]);
    expect(values['skills.steady.prof']).toBe(0); // a `lore` grant is not a knack
  });

  it("a stat's own formula reads @score and @level; one that does not parse gives 0", () => {
    const result = computed(
      ashWithStats([
        ['luck', '@score + @level', 3],
        ['hope', '@score +', 4],
        ['doom', '@score / 0', 5],
        ['calm', undefined, 9],
      ]),
    );
    expect(result.values).toMatchObject({
      'abilities.luck.mod': 5, // 3 + level 2
      'abilities.hope.mod': 0, // does not parse
      'abilities.doom.mod': 0, // not finite
      'abilities.calm.mod': 4, // Tales' floor(9 / 2)
    });
    expect(result.breakdown['abilities.hope.mod']).toEqual([
      { kind: 'formula', formula: '@score +', of: 'stat', value: 0, change: 0 },
    ]);
    expect(result.breakdown['abilities.calm.mod']).toEqual([
      { kind: 'formula', formula: 'floor(@score / 2)', of: 'system', value: 4, change: 4 },
    ]);
    expect(codes(result)).toEqual([
      { code: 'modFormula', key: 'hope', of: 'stat', inner: 'unexpected' },
      { code: 'modFormula', key: 'doom', of: 'stat', inner: 'notFinite' },
    ]);
  });

  it("gives each stat to the module's steps, its save its own or else the system's", () => {
    const seen: [string, boolean][][] = [];
    const watching = (hasSave: boolean): Module => ({
      ...talesModule,
      statDefaults: (character) => ({ ...talesModule.statDefaults(character), hasSave }),
      derive: (input) => {
        seen.push(input.stats.map((stat: StatOf<TalesEntity>) => [stat.key, stat.hasSave]));
        expect(input.stats.map(({ entity }) => entity.id)).toEqual([
          'tales-core:ability/grit',
          'tales-core:ability/wits',
          'tales-core:ability/nerve',
        ]);
        return talesModule.derive(input);
      },
    });
    computed(ash, watching(true));
    computed(ash, watching(false));
    expect(seen).toEqual([
      [
        ['grit', true],
        ['wits', true],
        ['nerve', false], // its own `hasSave: false`
      ],
      [
        ['grit', false],
        ['wits', false],
        ['nerve', false],
      ],
    ]);
  });

  it("computes a path when first read, in any order, each once; a formula reads a module's", () => {
    const calls: string[] = [];
    const counted =
      (path: string, step: DerivedStep): DerivedStep =>
      (read, readBy, readKey) => {
        calls.push(path);
        return step(read, readBy, readKey);
      };
    const module = withSteps(() => ({
      'tally.c': counted('c', (read) => {
        const b = read('tally.b');
        return {
          value: b + 1,
          steps: [{ kind: 'path', path: 'tally.b', value: b, change: b + 1 }],
        };
      }),
      'tally.b': counted('b', (read) => {
        const a = read('tally.a');
        const prof = read('skills.sneak.prof');
        return {
          value: a + prof,
          steps: [
            { kind: 'path', path: 'tally.a', value: a, change: a },
            { kind: 'path', path: 'skills.sneak.prof', value: prof, change: prof },
          ],
        };
      }),
      'tally.a': counted('a', () => ({
        value: 1,
        steps: [{ kind: 'rule', rule: 'one', value: 1, change: 1 }],
      })),
    }));
    const result = computed(ashWithStats([['luck', '@tally.c + @score', 2]]), module);
    expect(calls).toEqual(['c', 'b', 'a']);
    expect(result.values).toMatchObject({
      'abilities.luck.mod': 5, // tally.c 3 + score 2
      'tally.c': 3, // tally.b 2 + 1
      'tally.b': 2, // tally.a 1 + sneak's knack 1
      'tally.a': 1,
    });
    expect(Object.keys(result.values).slice(-3)).toEqual(['tally.c', 'tally.b', 'tally.a']);
    expect(Object.keys(result.values).slice(0, 4)).toEqual([
      'level',
      'abilities.grit.score',
      'abilities.grit.max',
      'abilities.grit.mod',
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('a path nothing gives reads 0 and warns, naming the path that read it', () => {
    const swim: TalesEntity = {
      id: 'character:skill/swim',
      type: 'skill',
      key: 'swim',
      ruleset: 'any',
      name: { en: 'Swim' },
      ability: 'luck',
      source,
    };
    const result = computed(
      variant(ash, { localEntities: [swim] }),
      withSteps(() => ({
        lost: (read) => {
          const value = read('nowhere.at.all');
          return { value, steps: [{ kind: 'path', path: 'nowhere.at.all', value, change: value }] };
        },
      })),
    );
    expect(result.values['skills.swim.total']).toBe(-1); // 0 + 2 × 0 + 0 - weary 1
    expect(result.values.lost).toBe(0);
    expect(codes(result)).toEqual([
      { code: 'missingPath', path: 'abilities.luck.mod', for: 'skills.swim.total' },
      { code: 'missingPath', path: 'nowhere.at.all', for: 'lost' },
    ]);
  });

  it('a path read while it is being computed reads 0 and warns; nothing throws', () => {
    const result = computed(
      ashWithStats([
        ['luck', '@abilities.hope.mod + 1', 0],
        ['hope', '@abilities.luck.mod + 1', 0],
        ['self', '@abilities.self.mod + @score', 4],
      ]),
    );
    expect(result.values).toMatchObject({
      'abilities.luck.mod': 2, // hope 1 + 1
      'abilities.hope.mod': 1, // luck read in its loop as 0, + 1
      'abilities.self.mod': 4, // itself read as 0, + 4
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
      {
        code: 'cycle',
        path: 'abilities.self.mod',
        for: 'abilities.self.mod',
        loop: [{ path: 'abilities.self.mod' }, { path: 'abilities.self.mod' }],
      },
    ]);
  });

  it("a module's step for a path the core gives is not used, and warns", () => {
    const sneaky: DerivedStep = () => ({
      value: 99,
      steps: [{ kind: 'rule', rule: 'sneaky', value: 99, change: 99 }],
    });
    const result = computed(
      ash,
      withSteps(() => ({
        level: sneaky,
        'abilities.grit.score': sneaky,
        'abilities.grit.max': sneaky,
        'abilities.grit.mod': sneaky,
        'abilities.luck.mod': sneaky,
      })),
    );
    expect(result.values).toMatchObject({
      level: 2,
      'abilities.grit.score': 7,
      'abilities.grit.max': 10,
      'abilities.grit.mod': 3,
      'abilities.luck.mod': 99, // `luck` is not a stat Ash has: the path is the module's
    });
    expect(codes(result)).toEqual(
      ['level', 'abilities.grit.score', 'abilities.grit.max', 'abilities.grit.mod'].map((path) => ({
        code: 'pathTaken',
        path,
      })),
    );
  });
});

describe("ENG-13 a step's formula warnings", () => {
  it('warns of each as `stepFormula`, naming its path; an override still applies after', () => {
    /** A step evaluating a formula, its warnings returned with its number. */
    const evaluating =
      (formula: string): DerivedStep =>
      (read) => {
        const { value, warnings } = evaluateNumber(formula, read);
        return {
          value,
          steps: [{ kind: 'formula', formula, of: 'system', value, change: value }],
          warnings,
        };
      };
    const result = computed(
      variant(ash, { overrides: [{ path: 'omens', value: 4 }] }),
      withSteps(() => ({
        riddle: evaluating('@abilities.grit.mod +'),
        omens: evaluating('1 / 0'),
        clear: evaluating('@abilities.grit.mod + 1'),
      })),
    );
    expect(result.values).toMatchObject({ riddle: 0, omens: 4, clear: 4 });
    expect(result.breakdown.omens).toEqual([
      { kind: 'formula', formula: '1 / 0', of: 'system', value: 0, change: 0 },
      { kind: 'override', value: 4, change: 4 },
    ]);
    expect(codes(result)).toEqual([
      {
        code: 'stepFormula',
        path: 'riddle',
        warning: expect.objectContaining({ code: 'unexpected' }),
      },
      {
        code: 'stepFormula',
        path: 'omens',
        warning: expect.objectContaining({ code: 'notFinite' }),
      },
    ]);
  });
});

describe('ENG-43 a step reads a key path', () => {
  it('reads its key; a path no module gives as a key is undefined; a number stays a number', () => {
    const read: (string | undefined)[] = [];
    const system: Module = {
      ...withSteps(() => ({
        'tally.sneak': (value, _, readKey) => {
          const stat = readKey('skills.sneak.ability');
          read.push(stat, readKey('tally.nothing'));
          const mod = value(`abilities.${stat}.mod`);
          return {
            value: mod,
            steps: [{ kind: 'path', path: `abilities.${stat}.mod`, value: mod, change: mod }],
          };
        },
      })),
      keys: (input) => ({
        ...talesModule.keys?.(input),
        level: { key: 'grit', steps: [], keys: ['grit'] },
        'skills.all.bonus': { key: 'grit', steps: [], keys: ['grit'] },
      }),
    };
    const result = computed(ash, system);
    expect(read).toEqual(['wits', undefined]);
    // Ash's wits 5, its modifier 2; weary's -1 on every skill.
    expect(result.values).toMatchObject({ 'tally.sneak': 2, level: 2, 'skills.all.bonus': -1 });
    expect(Object.keys(result.keys)).toEqual([
      'skills.climb.ability',
      'skills.sneak.ability',
      'skills.steady.ability',
    ]);
    expect(codes(result)).toEqual([
      { code: 'pathTaken', path: 'level' },
      { code: 'pathTaken', path: 'skills.all.bonus' },
    ]);
  });
});

describe('ENG-48 a key path with no key of its own', () => {
  it('is pending with its keys as the options, reads as no key, and warns its rules once', () => {
    const read: (string | undefined)[] = [];
    /** A step that notes the key it reads and is 0. */
    const reads: DerivedStep = (_, __, readKey) => {
      read.push(readKey('tally.pose'));
      return { value: 0, steps: [] };
    };
    const system: Module = {
      ...withSteps(() => ({ 'tally.a': reads, 'tally.b': reads })),
      keys: (input) => ({
        ...talesModule.keys?.(input),
        'tally.pose': {
          steps: [],
          keys: ['bold', 'wary'],
          ruleWarnings: [{ rule: 'stale', data: { pose: 'calm' }, message: 'Calm is gone.' }],
        },
        'tally.grip': { key: 'grit', steps: [], keys: ['grit'] },
      }),
    };
    const result = computed(ash, system);
    expect(read).toEqual([undefined, undefined]);
    expect(Object.keys(result.keys)).toEqual([
      'skills.climb.ability',
      'skills.sneak.ability',
      'skills.steady.ability',
      'tally.grip',
    ]);
    expect(result.pendingKeys).toEqual([{ path: 'tally.pose', options: ['bold', 'wary'] }]);
    expect(result.warnings).toEqual([
      {
        code: 'stepRule',
        path: 'tally.pose',
        rule: 'stale',
        data: { pose: 'calm' },
        message: 'Calm is gone.',
      },
    ]);
  });

  it('none is pending when every key path has its own key', () => {
    const result = computed(ash);
    expect(Object.keys(result.keys)).toHaveLength(3);
    expect(result.pendingKeys).toEqual([]);
  });
});

describe("ENG-14 a step's own warnings", () => {
  it('warns each rule warning as `stepRule`, naming its path; effect warnings pass as they are', () => {
    const notAppended: EffectWarning = {
      code: 'notAppended',
      part: 'tales-core:talent/quick-step#nimble',
      op: 'note',
      target: 'guard.formulas',
      message: 'Made up for the test.',
    };
    const result = computed(
      ash,
      withSteps(() => ({
        guard: () => ({
          value: 3,
          steps: [{ kind: 'rule', rule: 'guard', value: 3, change: 3 }],
          ruleWarnings: [
            { rule: 'tooLow', data: { least: 5, part: 'warden' }, message: 'Below 5.' },
            { rule: 'unsure', message: 'Unsure.' },
          ],
          effectWarnings: [notAppended],
        }),
        calm: () => ({ value: 0, steps: [] }),
      })),
    );
    expect(result.values.guard).toBe(3);
    expect(result.warnings).toEqual([
      {
        code: 'stepRule',
        path: 'guard',
        rule: 'tooLow',
        data: { least: 5, part: 'warden' },
        message: 'Below 5.',
      },
      { code: 'stepRule', path: 'guard', rule: 'unsure', message: 'Unsure.' },
      notAppended,
    ]);
  });
});
