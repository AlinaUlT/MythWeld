import {
  type Computed,
  type ComputeWarning,
  compute,
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
  type TalesExpected,
  talesCore,
} from '../../schema/test/tales/index.ts';
import { talesModule } from './tales-module.ts';

// Tales, the made-up test system (ENG-27). Every expected value below is worked out by hand from
// Tales' rules (`tales/system.ts`), its data (`tales/content.ts`, `tales/characters.ts`) and the
// variants written here; ENG-27's `tales/expected.ts` gives Ash's and Brook's.

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

/** A character changed, then opened as a file would be, so it is still a valid character. */
function variant(base: TalesCharacter, change: Partial<TalesCharacter>): TalesCharacter {
  return opened(openTalesCharacter({ ...base, ...change }));
}

/** Ash with talents of its own, which its part names after its calling. */
function ashWith(talents: TalesEntity[], change: Partial<TalesCharacter> = {}): TalesCharacter {
  return variant(ash, {
    localEntities: talents,
    systemData: { ...ash.systemData, talents: talents.map(({ id }) => id) },
    ...change,
  });
}

/** A talent of the character's own with these effects and grants. */
function talent(
  slug: string,
  effects: TalesEntity['effects'],
  grants?: TalesEntity['grants'],
): TalesEntity {
  return {
    id: `character:talent/${slug}`,
    type: 'talent',
    ruleset: 'any',
    name: { en: slug },
    tier: 1,
    effects,
    ...(grants && { grants }),
    source,
  };
}

/** Tales' character, computed with its module. Every breakdown adds up to its value. */
function computed(character: TalesCharacter, system: SystemModule<TalesCharacter> = talesModule) {
  const result = compute(character, index, system);
  for (const [path, steps] of Object.entries(result.breakdown)) {
    const sum = steps.reduce((total, step) => total + step.change, 0);
    expect(sum, path).toBe(result.values[path]);
  }
  return result;
}

/** The score of each stat. */
function scores(result: Computed<TalesEntity>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(result.values).flatMap(([path, value]) => {
      const [, key, field] = path.split('.');
      return field === 'score' ? [[key, value]] : [];
    }),
  );
}

/** Each warning without its log message; a formula's as its part, field and inner code. */
function codes(result: { warnings: readonly ComputeWarning[] }) {
  return result.warnings.map(({ message: _, ...warning }) =>
    warning.code === 'formula'
      ? { code: 'formula', part: warning.part, field: warning.field, inner: warning.warning.code }
      : warning,
  );
}

describe('ENG-12 stat scores in the base phase', () => {
  it.each<[string, TalesCharacter, TalesExpected]>([
    ['Ash', ash, ashExpected],
    ['Brook', brook, brookExpected],
  ])("%s: each stat's score and maximum are ENG-27's expected values", (_, character, expected) => {
    const isStatPath = ([path]: [string, unknown]) =>
      /^abilities\.[a-z][a-zA-Z0-9]*\.(score|max)$/.test(path);
    const statPaths = Object.entries(expected.values).filter(isStatPath);
    expect(statPaths).toHaveLength(6);
    const result = computed(character);
    expect(Object.fromEntries(Object.entries(result.values).filter(isStatPath))).toEqual(
      Object.fromEntries(statPaths),
    );
    expect(codes(result).map(({ code }) => code)).toEqual(expected.missing.map(() => 'missing'));
  });

  it('Brook: the breakdown of a base, a grant, a toggled effect, a cap and each maximum', () => {
    const { breakdown } = computed(brook);
    expect(breakdown['abilities.grit.score']).toEqual([
      { kind: 'base', value: 5, change: 5 },
      {
        kind: 'effect',
        part: 'character:talent/lucky-charm#charm',
        source: 'character:talent/lucky-charm',
        label: { en: 'Lucky charm' },
        op: 'add',
        value: 1,
        change: 1,
      },
    ]);
    expect(breakdown['abilities.wits.score']).toEqual([
      { kind: 'base', value: 6, change: 6 },
      {
        kind: 'grant',
        part: 'tales-core:calling/seeker#keen',
        source: 'tales-core:calling/seeker',
        label: { en: 'Seeker' },
        value: 2,
        change: 2,
      },
    ]);
    expect(breakdown['abilities.nerve.score']).toEqual([
      { kind: 'base', value: 9, change: 9 },
      { kind: 'cap', value: 8, change: -1 },
    ]);
    expect(breakdown['abilities.nerve.max']).toEqual([
      { kind: 'default', of: 'stat', value: 8, change: 8 },
    ]);
    expect(breakdown['abilities.grit.max']).toEqual([
      { kind: 'default', of: 'system', value: 10, change: 10 },
    ]);
  });

  it("applies a toggled effect when it is switched on, or by the toggle's default", () => {
    const glow = { 'tales-core:talent/night-warden#glow': true };
    expect(scores(computed(variant(ash, { state: { ...ash.state, toggles: glow } }))).grit).toBe(8);
    const charmOff = { 'character:talent/lucky-charm#charm': false };
    expect(
      scores(computed(variant(brook, { state: { ...brook.state, toggles: charmOff } }))).grit,
    ).toBe(5);

    const bright = talent('bright', [
      {
        id: 'shine',
        target: 'abilities.wits.score',
        op: 'add',
        value: 1,
        toggle: { label: { en: 'Shining' }, default: true },
      },
    ]);
    expect(scores(computed(ashWith([bright]))).wits).toBe(6);
    const off = { ...ash.state, toggles: { 'character:talent/bright#shine': false } };
    expect(scores(computed(ashWith([bright], { state: off }))).wits).toBe(5);
  });

  describe('a stat distribution', () => {
    const tinker: TalesEntity = {
      id: 'character:calling/tinker',
      type: 'calling',
      key: 'tinker',
      ruleset: 'any',
      name: { en: 'Tinker' },
      die: 6,
      grants: [
        {
          id: 'knack-of-hands',
          kind: 'abilityScore',
          mode: 'distribute',
          from: ['grit', 'wits', 'nerve'],
          patterns: [
            [2, 1],
            [1, 1, 1],
          ],
        },
      ],
      source,
    };
    const part = 'character:calling/tinker#knack-of-hands';
    const tinkering = (chosen: string[]) =>
      computed(
        variant(brook, {
          abilities: { base: { grit: 3, wits: 3, nerve: 3 } },
          choices: { [part]: chosen },
          localEntities: [tinker],
          state: { ...brook.state, toggles: {} }, // its lucky charm is gone, so is its switch
          systemData: { level: 1, calling: tinker.id, talents: [] },
        }),
      );

    it('gives the i-th item the i-th number of the pattern with as many numbers', () => {
      const twoOne = tinkering(['wits', 'grit']);
      expect(scores(twoOne)).toEqual({ grit: 4, wits: 5, nerve: 3 });
      expect(twoOne.breakdown['abilities.wits.score']).toEqual([
        { kind: 'base', value: 3, change: 3 },
        {
          kind: 'grant',
          part,
          source: 'character:calling/tinker',
          label: { en: 'Tinker' },
          value: 2,
          change: 2,
        },
      ]);
      expect(scores(tinkering(['grit', 'wits', 'nerve']))).toEqual({ grit: 4, wits: 4, nerve: 4 });
      expect(codes(twoOne)).toEqual([]);
    });

    it('stays pending, giving nothing, while no pattern has as many numbers as items', () => {
      const one = tinkering(['nerve']);
      expect(scores(one)).toEqual({ grit: 3, wits: 3, nerve: 3 });
      expect(
        one.pendingChoices.map(({ part, chosen, options }) => [part, chosen, options]),
      ).toEqual([[part, ['nerve'], ['grit', 'wits']]]);
      expect(codes(one)).toEqual([]);
    });

    it('uses the first items its longest pattern takes, and an item not offered, with warnings', () => {
      const four = tinkering(['wits', 'grit', 'nerve', 'luck']);
      expect(scores(four)).toEqual({ grit: 4, wits: 4, nerve: 4 });
      expect(four.pendingChoices).toEqual([]);
      expect(four.grants.map(({ chosen }) => chosen)).toEqual([['wits', 'grit', 'nerve']]);
      expect(codes(four)).toEqual([{ code: 'tooManyChosen', part, count: 3, chosen: 4 }]);

      const stranger = tinkering(['wits', 'luck']);
      expect(scores(stranger)).toEqual({ grit: 3, wits: 5, nerve: 3 });
      expect(codes(stranger)).toEqual([
        { code: 'notAnOption', part, item: 'luck' },
        { code: 'noStat', key: 'luck', from: part },
      ]);
    });
  });

  it('applies mul, add, min, max and set in that order, unless a priority says otherwise', () => {
    const drill = (plusPriority?: number) =>
      talent('drill', [
        {
          id: 'plus',
          target: 'abilities.wits.score',
          op: 'add',
          value: 1,
          ...(plusPriority !== undefined && { priority: plusPriority }),
        },
        { id: 'twice', target: 'abilities.wits.score', op: 'mul', value: 2 },
        { id: 'raise', target: 'abilities.nerve.score', op: 'max', value: 6 },
        { id: 'lower', target: 'abilities.nerve.score', op: 'min', value: 3 },
        { id: 'fix', target: 'abilities.grit.score', op: 'set', value: 7 },
        { id: 'more', target: 'abilities.grit.score', op: 'add', value: 1 },
      ]);
    const low = { abilities: { base: { grit: 2, wits: 2, nerve: 2 } } };
    const result = computed(ashWith([drill()], low));
    expect(scores(result)).toEqual({ grit: 7, wits: 5, nerve: 6 });
    const step = (id: string, op: string, value: number, change: number) => ({
      kind: 'effect',
      part: `character:talent/drill#${id}`,
      source: 'character:talent/drill',
      label: { en: 'drill' },
      op,
      value,
      change,
    });
    expect(result.breakdown['abilities.wits.score']).toEqual([
      { kind: 'base', value: 2, change: 2 },
      step('twice', 'mul', 2, 2),
      step('plus', 'add', 1, 1),
    ]);
    expect(result.breakdown['abilities.nerve.score']).toEqual([
      { kind: 'base', value: 2, change: 2 },
      step('lower', 'min', 3, 0),
      step('raise', 'max', 6, 4),
    ]);
    expect(result.breakdown['abilities.grit.score']).toEqual([
      { kind: 'base', value: 2, change: 2 },
      {
        kind: 'grant',
        part: 'tales-core:calling/warden#sturdy',
        source: 'tales-core:calling/warden',
        label: { en: 'Warden' },
        value: 1,
        change: 1,
      },
      step('more', 'add', 1, 1),
      step('fix', 'set', 7, 3),
    ]);
    expect(scores(computed(ashWith([drill(5)], low))).wits).toBe(6);
  });

  it('caps a score at its maximum, which effects on the maximum change', () => {
    const stronger = {
      id: 'stronger',
      target: 'abilities.grit.score',
      op: 'add',
      value: 4,
    } as const;
    const capped = computed(ashWith([talent('mighty', [stronger])]));
    expect(capped.values['abilities.grit.score']).toBe(10);
    expect(capped.breakdown['abilities.grit.score']?.at(-1)).toEqual({
      kind: 'cap',
      value: 10,
      change: -1,
    });

    const higher = {
      id: 'higher',
      target: 'abilities.grit.max',
      op: 'add',
      value: 2,
      label: { en: 'Higher limit' },
    } as const;
    const raised = computed(ashWith([talent('mighty', [stronger, higher])]));
    expect(raised.values['abilities.grit.max']).toBe(12);
    expect(raised.values['abilities.grit.score']).toBe(11);
    expect(raised.breakdown['abilities.grit.max']).toEqual([
      { kind: 'default', of: 'system', value: 10, change: 10 },
      {
        kind: 'effect',
        part: 'character:talent/mighty#higher',
        source: 'character:talent/mighty',
        label: { en: 'Higher limit' },
        op: 'add',
        value: 2,
        change: 2,
      },
    ]);
  });

  it("evaluates an effect's `when` and value with the character's level", () => {
    const late = talent('late', [
      {
        id: 'grow',
        target: 'abilities.wits.score',
        op: 'add',
        value: '@level',
        when: '@level >= 3',
      },
    ]);
    expect(scores(computed(ashWith([late]))).wits).toBe(5);
    const atThree = computed(
      ashWith([late], { systemData: { ...ash.systemData, level: 3, talents: [late.id] } }),
    );
    expect(scores(atThree).wits).toBe(8);
    expect(atThree.breakdown['abilities.wits.score']?.at(-1)).toMatchObject({
      part: 'character:talent/late#grow',
      value: 3,
      change: 3,
    });
    expect(codes(atThree)).toEqual([]);
  });

  it('refuses a base-phase formula that names any path but levels, read or not', () => {
    const greedy = talent('greedy', [
      {
        id: 'reads-score',
        target: 'abilities.wits.score',
        op: 'add',
        value: '@abilities.grit.score',
      },
      {
        id: 'untaken',
        target: 'abilities.wits.score',
        op: 'add',
        value: '@level > 9 ? @skills.climb.total : 1',
      },
      {
        id: 'both',
        target: 'abilities.wits.score',
        op: 'add',
        value: '@stats.luck',
        when: '@abilities.grit.mod > 1',
      },
      {
        id: 'by-calling',
        target: 'abilities.wits.score',
        op: 'add',
        value: 'floor(@calling.level / 2)',
      },
    ]);
    const result = computed(ashWith([greedy]));
    expect(scores(result).wits).toBe(5);
    const refused = (id: string, paths: string[]) => ({
      code: 'notInBasePhase',
      part: `character:talent/greedy#${id}`,
      paths,
    });
    expect(codes(result)).toEqual([
      refused('reads-score', ['abilities.grit.score']),
      refused('untaken', ['skills.climb.total']),
      refused('both', ['abilities.grit.mod', 'stats.luck']),
      refused('by-calling', ['calling.level']),
    ]);

    const withCallingLevel: SystemModule<TalesCharacter> = {
      ...talesModule,
      basePath: (_, path) => (path === 'calling.level' ? 3 : undefined),
    };
    const allowed = computed(ashWith([greedy]), withCallingLevel);
    expect(scores(allowed).wits).toBe(6);
    expect(codes(allowed)).toEqual([
      refused('reads-score', ['abilities.grit.score']),
      refused('untaken', ['skills.climb.total']),
      refused('both', ['abilities.grit.mod', 'stats.luck']),
    ]);
  });

  it("passes on a formula's warnings; one that does not parse is not applied", () => {
    const broken = talent('broken', [
      { id: 'cut', target: 'abilities.wits.score', op: 'add', value: '1 +' },
      { id: 'endless', target: 'abilities.wits.score', op: 'add', value: '1 / 0' },
      { id: 'unclear', target: 'abilities.wits.score', op: 'add', value: 2, when: '2 +' },
    ]);
    const result = computed(ashWith([broken]));
    expect(scores(result).wits).toBe(5);
    expect(result.breakdown['abilities.wits.score']).toEqual([
      { kind: 'base', value: 5, change: 5 },
      {
        kind: 'effect',
        part: 'character:talent/broken#endless',
        source: 'character:talent/broken',
        label: { en: 'broken' },
        op: 'add',
        value: 0,
        change: 0,
      },
    ]);
    const part = (id: string) => `character:talent/broken#${id}`;
    expect(codes(result)).toEqual([
      { code: 'formula', part: part('cut'), field: 'value', inner: 'unexpected' },
      { code: 'formula', part: part('endless'), field: 'value', inner: 'notFinite' },
      { code: 'formula', part: part('unclear'), field: 'when', inner: 'unexpected' },
    ]);
  });

  it('warns on a stat no entry defines, a stat with no base, an effect with no number', () => {
    const odd = talent(
      'odd',
      [
        { id: 'to-luck', target: 'abilities.luck.score', op: 'add', value: 1 },
        { id: 'yes', target: 'abilities.wits.score', op: 'set', value: true },
        { id: 'words', target: 'abilities.wits.score', op: 'append', value: 'more' },
        { id: 'aside', target: 'abilities.wits.score', op: 'note', value: { en: 'Aside' } },
        { id: 'edge', target: 'abilities.wits.score', op: 'advantage', value: true },
        {
          id: 'sometimes',
          target: 'abilities.wits.score',
          op: 'add',
          value: 5,
          situational: { en: 'In the dark' },
        },
        { id: 'later', target: 'abilities.wits.score', op: 'add', value: 5, phase: 'derived' },
        { id: 'early', target: 'skills.sneak.bonus', op: 'add', value: 5, phase: 'base' },
        { id: 'modded', target: 'abilities.wits.mod', op: 'add', value: 5 },
      ],
      [{ id: 'lucky', kind: 'abilityScore', mode: 'fixed', values: { luck: 1, wits: 1 } }],
    );
    const result = computed(ashWith([odd], { abilities: { base: { grit: 6, wits: 5, luck: 3 } } }));
    // wits: 5 + `lucky` 1 in the base phase; ENG-17 then applies `later` 5 (`early`, `modded` too)
    expect(scores(result)).toEqual({ grit: 7, wits: 11, nerve: 0 });
    const part = (id: string) => `character:talent/odd#${id}`;
    const target = 'abilities.wits.score';
    expect(codes(result)).toEqual([
      { code: 'noBaseScore', key: 'nerve' },
      { code: 'noStat', key: 'luck', from: 'character' },
      { code: 'noStat', key: 'luck', from: part('lucky') },
      { code: 'noStat', key: 'luck', from: part('to-luck') },
      { code: 'notANumber', part: part('yes'), op: 'set', target },
      { code: 'notANumber', part: part('words'), op: 'append', target },
      { code: 'notANumber', part: part('aside'), op: 'note', target },
      { code: 'notANumber', part: part('edge'), op: 'advantage', target },
    ]);
    expect(result.warnings[0]?.message).toBe(
      'The stat "nerve" has no base score stored; 0 is used.',
    );
  });

  it("computes a character's own stat as it does a pack's, with its own maximum", () => {
    const heart: TalesEntity = {
      id: 'character:ability/heart',
      type: 'ability',
      key: 'heart',
      ruleset: 'any',
      name: { en: 'Heart' },
      abbr: { en: 'HRT' },
      order: 3,
      defaultMax: 5,
      source,
    };
    const brave = talent(
      'brave',
      [],
      [{ id: 'braver', kind: 'abilityScore', mode: 'fixed', values: { heart: 1 } }],
    );
    const character = variant(ash, {
      abilities: { base: { ...ash.abilities.base, heart: 3 } },
      localEntities: [heart, brave],
      systemData: { ...ash.systemData, talents: [brave.id] },
    });
    const result = computed(character);
    expect(result.values['abilities.heart.score']).toBe(4);
    expect(result.values['abilities.heart.max']).toBe(5);
    expect(result.breakdown['abilities.heart.max']).toEqual([
      { kind: 'default', of: 'stat', value: 5, change: 5 },
    ]);
    expect(codes(result)).toEqual([]);
  });
});
