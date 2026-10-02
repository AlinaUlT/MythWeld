import {
  activeEffects,
  appendedNumbers,
  type BreakdownStep,
  type ComputeWarning,
  compute,
  type EffectWarning,
  loadContentIndex,
  type OwnPaths,
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
// variants written here, and checked with python3; ENG-27's `tales/expected.ts` gives Ash's and
// Brook's. Ash before any variant: grit 7 (mod 3), wits 5 (mod 2), nerve 4 (mod 1), level 2,
// weary at level 1, so `skills.all.bonus` is -1.

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

/** A talent of the character's own with these effects. */
function talent(slug: string, effects: TalesEntity['effects']): TalesEntity {
  return {
    id: `character:talent/${slug}`,
    type: 'talent',
    ruleset: 'any',
    name: { en: slug },
    tier: 1,
    effects,
    source,
  };
}

/** Ash with talents of its own, which its part names after its calling. */
function ashWith(talents: TalesEntity[], change: Partial<TalesCharacter> = {}): TalesCharacter {
  return variant(ash, {
    localEntities: talents,
    systemData: { ...ash.systemData, talents: talents.map(({ id }) => id) },
    ...change,
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

/** Each warning without its log message; a formula's as its part, field and inner code. */
function codes(result: { warnings: readonly ComputeWarning[] }) {
  return result.warnings.map(({ message: _, ...warning }) =>
    warning.code === 'formula'
      ? { code: 'formula', part: warning.part, field: warning.field, inner: warning.warning.code }
      : warning,
  );
}

/** The breakdown step of an effect of a talent of the character's own. */
function own(slug: string, id: string, op: string, value: number, change: number): BreakdownStep {
  return {
    kind: 'effect',
    part: `character:talent/${slug}#${id}`,
    source: `character:talent/${slug}`,
    label: { en: slug },
    op,
    value,
    change,
  } as BreakdownStep;
}

/** A `path` step of a total. */
function path(at: string, value: number, change = value): BreakdownStep {
  return { kind: 'path', path: at, value, change };
}

describe('ENG-17 derived-phase effects, toggles and overrides', () => {
  it.each<[string, TalesCharacter, TalesExpected, string[]]>([
    ['Ash', ash, ashExpected, []],
    ['Brook', brook, brookExpected, ['missing']],
  ])(
    '%s: every value ENG-27 expects, and no warning of its own',
    (_, character, expected, warned) => {
      const result = computed(character);
      for (const [at, value] of Object.entries(expected.values)) {
        expect(result.values[at], at).toBe(value);
      }
      expect(codes(result).map(({ code }) => code)).toEqual(warned);
    },
  );

  it('Ash and Brook: the values besides, with a step for each effect, override and condition', () => {
    const a = computed(ash);
    expect(a.values).toMatchObject({
      'skills.all.bonus': -1, // weary's `tired`: -1 × weary's level 1
      'skills.climb.bonus': 2, // `nimble`: wits mod 2
      'skills.sneak.bonus': 1, // `shadow`
      'conditions.weary.level': 1,
      'conditions.lost.level': 0,
    });
    expect(a.breakdown['skills.all.bonus']).toEqual([
      {
        kind: 'effect',
        part: 'tales-core:condition/weary#tired',
        source: 'tales-core:condition/weary',
        label: { en: 'Weary' },
        op: 'add',
        value: -1,
        change: -1,
      },
    ]);
    expect(a.breakdown['skills.climb.bonus']).toEqual([
      {
        kind: 'effect',
        part: 'tales-core:talent/quick-step#nimble',
        source: 'tales-core:talent/quick-step',
        label: { en: 'Quick Step' },
        op: 'add',
        value: 2,
        change: 2,
      },
    ]);
    expect(a.breakdown['conditions.weary.level']).toEqual([
      {
        kind: 'condition',
        source: 'tales-core:condition/weary',
        label: { en: 'Weary' },
        value: 1,
        change: 1,
      },
    ]);
    expect(a.breakdown['conditions.lost.level']).toEqual([]);

    const b = computed(brook);
    expect(b.values).toMatchObject({
      'skills.all.bonus': 0, // lost has no effect
      'skills.steady.bonus': 2, // `will`, its prerequisites unmet
      'conditions.weary.level': 0,
      'conditions.lost.level': 1, // no levels: 1
    });
    expect(b.breakdown['skills.sneak.total']).toEqual([
      path('abilities.wits.mod', 4),
      path('skills.sneak.prof', 0),
      path('skills.sneak.bonus', 0),
      path('skills.all.bonus', 0),
      { kind: 'override', value: 9, change: 5, note: 'Agreed at the table.' },
    ]);
    expect(b.breakdown['skills.steady.bonus']).toEqual([
      {
        kind: 'effect',
        part: 'tales-core:talent/iron-will#will',
        source: 'tales-core:talent/iron-will',
        label: { en: 'Iron Will' },
        op: 'add',
        value: 2,
        change: 2,
      },
    ]);
    expect(b.breakdown['conditions.lost.level']).toEqual([
      {
        kind: 'condition',
        source: 'tales-core:condition/lost',
        label: { en: 'Lost' },
        value: 1,
        change: 1,
      },
    ]);
  });

  it('applies by phase, then by priority, then in gathering order', () => {
    const drill = talent('drill', [
      { id: 'last', target: 'skills.steady.bonus', op: 'add', value: 1, phase: 'final' },
      { id: 'more', target: 'skills.steady.bonus', op: 'add', value: 4 },
      { id: 'twice', target: 'skills.steady.bonus', op: 'mul', value: 2 },
      { id: 'again', target: 'skills.steady.bonus', op: 'add', value: 1 },
      { id: 'early', target: 'skills.steady.bonus', op: 'add', value: '@level + 1', phase: 'base' },
      { id: 'cap', target: 'skills.steady.bonus', op: 'min', value: 22 },
      { id: 'fix', target: 'skills.steady.bonus', op: 'set', value: 10, priority: 5 },
    ]);
    const { values, breakdown, warnings } = computed(ashWith([drill]));
    expect(breakdown['skills.steady.bonus']).toEqual([
      own('drill', 'early', 'add', 3, 3), // base: level 2 + 1
      own('drill', 'fix', 'set', 10, 7), // derived, its own priority 5
      own('drill', 'twice', 'mul', 2, 10), // 10
      own('drill', 'more', 'add', 4, 4), // 20, before `again`: gathering order
      own('drill', 'again', 'add', 1, 1),
      own('drill', 'cap', 'min', 22, -3), // 30
      own('drill', 'last', 'add', 1, 1), // final, after every derived effect
    ]);
    expect(values['skills.steady.bonus']).toBe(23);
    expect(values['skills.steady.total']).toBe(23); // nerve 1 + 2 × 0 + 23 - 1
    expect(values['skills.steady.passive']).toBe(28); // the total read after its effects: 5 + 23
    expect(warnings).toEqual([]);
  });

  it("a stat's score takes derived effects and overrides after its cap; its modifier reads them", () => {
    const surge = talent('surge', [
      { id: 'rise', target: 'abilities.grit.score', op: 'add', value: 5, phase: 'derived' },
      { id: 'roof', target: 'abilities.grit.max', op: 'add', value: 2, phase: 'final' },
    ]);
    const result = computed(
      ashWith([surge], { overrides: [{ path: 'abilities.wits.score', value: 12 }] }),
    );
    expect(result.values).toMatchObject({
      'abilities.grit.score': 12, // 7 + 5, above its maximum: not capped
      'abilities.grit.max': 12, // 10 + 2
      'abilities.grit.mod': 6, // floor(12 / 2)
      'abilities.wits.score': 12, // the override, above its maximum 10
      'abilities.wits.mod': 6,
      'skills.climb.bonus': 6, // `nimble`: wits mod 6
      'skills.climb.total': 13, // grit 6 + 2 × 1 + 6 - 1
      'skills.sneak.total': 8, // wits 6 + 2 × 1 + 1 - 1
    });
    expect(result.breakdown['abilities.grit.score']).toEqual([
      { kind: 'base', value: 6, change: 6 },
      {
        kind: 'grant',
        part: 'tales-core:calling/warden#sturdy',
        source: 'tales-core:calling/warden',
        label: { en: 'Warden' },
        value: 1,
        change: 1,
      },
      own('surge', 'rise', 'add', 5, 5),
    ]);
    expect(result.breakdown['abilities.grit.max']).toEqual([
      { kind: 'default', of: 'system', value: 10, change: 10 },
      own('surge', 'roof', 'add', 2, 2),
    ]);
    expect(result.breakdown['abilities.wits.score']).toEqual([
      { kind: 'base', value: 5, change: 5 },
      { kind: 'override', value: 12, change: 7 },
    ]);
    expect(result.warnings).toEqual([]);

    const stretch = talent('stretch', [
      { id: 'wider', target: 'abilities.nerve.max', op: 'add', value: 2, phase: 'derived' },
    ]);
    const wider = computed(
      variant(brook, {
        localEntities: [...brook.localEntities, stretch],
        systemData: { ...brook.systemData, talents: [...brook.systemData.talents, stretch.id] },
      }),
    );
    expect(wider.values['abilities.nerve.max']).toBe(10); // 8 + 2
    expect(wider.values['abilities.nerve.score']).toBe(8); // capped by the base phase's 8
    expect(wider.breakdown['abilities.nerve.score']).toEqual([
      { kind: 'base', value: 9, change: 9 },
      { kind: 'cap', value: 8, change: -1 },
    ]);
    expect(codes(wider).map(({ code }) => code)).toEqual(['missing']);
  });

  it("an effect's formula reads any path: a module's, a condition's level; a missing one reads 0", () => {
    const reader = talent('reader', [
      { id: 'deep', target: 'skills.sneak.bonus', op: 'add', value: '@skills.steady.passive' },
      {
        id: 'heavy',
        target: 'skills.steady.bonus',
        op: 'add',
        value: '-2 * @conditions.weary.level',
      },
      { id: 'gone', target: 'skills.climb.bonus', op: 'add', value: '@nowhere.at.all' },
    ]);
    const result = computed(ashWith([reader]));
    expect(result.values).toMatchObject({
      'skills.steady.bonus': -2, // -2 × weary 1
      'skills.steady.total': -2, // nerve 1 + 2 × 0 - 2 - 1
      'skills.steady.passive': 3, // 5 - 2
      'skills.sneak.bonus': 4, // `shadow` 1 + `deep` 3, the passive value after its effects
      'skills.sneak.total': 7, // wits 2 + 2 × 1 + 4 - 1
      'skills.climb.bonus': 2, // `nimble` 2 + `gone` 0
    });
    expect(result.breakdown['skills.sneak.bonus']).toEqual([
      {
        kind: 'effect',
        part: 'tales-core:talent/night-warden#shadow',
        source: 'tales-core:talent/night-warden',
        label: { en: 'Night Warden' },
        op: 'add',
        value: 1,
        change: 1,
      },
      own('reader', 'deep', 'add', 3, 3),
    ]);
    expect(codes(result)).toEqual([
      { code: 'missingPath', path: 'nowhere.at.all', for: 'skills.climb.bonus' },
    ]);
  });

  it("a path an effect's formula reads while it is being computed reads 0, and warns", () => {
    const echo = talent('echo', [
      { id: 'back', target: 'skills.climb.bonus', op: 'add', value: '@skills.climb.total' },
    ]);
    const result = computed(ashWith([echo]));
    expect(result.values['skills.climb.total']).toBe(4); // grit 3 + 2 × 1 + bonus read as 0 - 1
    expect(result.values['skills.climb.bonus']).toBe(6); // `nimble` 2 + `back` 4
    expect(codes(result)).toEqual([
      {
        code: 'cycle',
        path: 'skills.climb.bonus',
        for: 'skills.climb.total',
        loop: [
          { path: 'skills.climb.bonus' },
          { path: 'skills.climb.total', by: 'character:talent/echo#back' },
          { path: 'skills.climb.bonus' },
        ],
      },
    ]);
  });

  it('a base-phase effect on another target applies first, its formulas read only base paths', () => {
    const early = talent('early', [
      { id: 'lvl', target: 'skills.steady.bonus', op: 'add', value: '@level', phase: 'base' },
      {
        id: 'peek',
        target: 'skills.steady.bonus',
        op: 'add',
        value: '@abilities.grit.mod',
        phase: 'base',
      },
      {
        id: 'call',
        target: 'skills.steady.bonus',
        op: 'add',
        value: '@calling.level',
        phase: 'base',
      },
    ]);
    const refused = (id: string, paths: string[]) => ({
      code: 'notInBasePhase',
      part: `character:talent/early#${id}`,
      paths,
    });
    const result = computed(ashWith([early]));
    expect(result.values['skills.steady.bonus']).toBe(2); // `lvl`: level 2
    expect(result.values['skills.steady.total']).toBe(2); // nerve 1 + 2 × 0 + 2 - 1
    expect(codes(result)).toEqual([
      refused('peek', ['abilities.grit.mod']),
      refused('call', ['calling.level']),
    ]);

    const withCallingLevel: Module = {
      ...talesModule,
      basePath: (_, at) => (at === 'calling.level' ? 3 : undefined),
    };
    const allowed = computed(ashWith([early]), withCallingLevel);
    expect(allowed.values['skills.steady.bonus']).toBe(5); // 2 + `call` 3
    expect(codes(allowed)).toEqual([refused('peek', ['abilities.grit.mod'])]);
  });

  it("passes on a formula's warnings; one that does not parse, or a false `when`, does not apply", () => {
    const shaky = talent('shaky', [
      { id: 'cut', target: 'skills.sneak.bonus', op: 'add', value: '1 +' },
      { id: 'endless', target: 'skills.sneak.bonus', op: 'add', value: '1 / 0' },
      { id: 'unclear', target: 'skills.sneak.bonus', op: 'add', value: 2, when: '2 +' },
      {
        id: 'when-weary',
        target: 'skills.sneak.bonus',
        op: 'add',
        value: 3,
        when: '@conditions.weary.level > 0',
      },
      {
        id: 'when-lost',
        target: 'skills.sneak.bonus',
        op: 'add',
        value: 4,
        when: '@conditions.lost.level > 0',
      },
    ]);
    const result = computed(ashWith([shaky]));
    expect(result.values['skills.sneak.bonus']).toBe(4); // `shadow` 1 + `endless` 0 + 3
    expect(result.values['skills.sneak.total']).toBe(7); // wits 2 + 2 × 1 + 4 - 1
    expect(result.breakdown['skills.sneak.bonus']).toMatchObject([
      { part: 'tales-core:talent/night-warden#shadow' },
      own('shaky', 'endless', 'add', 0, 0),
      own('shaky', 'when-weary', 'add', 3, 3),
    ]);
    const part = (id: string) => `character:talent/shaky#${id}`;
    expect(codes(result)).toEqual([
      { code: 'formula', part: part('cut'), field: 'value', inner: 'unexpected' },
      { code: 'formula', part: part('endless'), field: 'value', inner: 'notFinite' },
      { code: 'formula', part: part('unclear'), field: 'when', inner: 'unexpected' },
    ]);
  });

  it('warns on an effect that cannot change its target; one on a list or a roll is left alone', () => {
    const odd = talent('odd', [
      { id: 'typo', target: 'skills.clim.bonus', op: 'add', value: 1 },
      { id: 'no-stat', target: 'abilities.luck.score', op: 'add', value: 1, phase: 'derived' },
      { id: 'yes', target: 'skills.sneak.bonus', op: 'set', value: true },
      { id: 'words', target: 'skills.sneak.bonus', op: 'append', value: 'more' },
      { id: 'aside', target: 'skills.sneak.bonus', op: 'note', value: { en: 'Aside' } },
      { id: 'resist', target: 'defenses.resist', op: 'append', value: 'cold' },
      { id: 'edge', target: 'roll.init', op: 'advantage', value: true },
      { id: 'swap', target: 'skills.climb.ability', op: 'set', value: 'wits' },
      { id: 'older', target: 'level', op: 'add', value: 1 },
    ]);
    const result = computed(ashWith([odd]));
    expect(result.values.level).toBe(2);
    expect(result.values['skills.sneak.bonus']).toBe(1); // `shadow` only
    expect('abilities.luck.score' in result.values).toBe(false);
    const part = (id: string) => `character:talent/odd#${id}`;
    const target = 'skills.sneak.bonus';
    expect(codes(result)).toEqual([
      { code: 'fixedPath', path: 'level', by: part('older') },
      { code: 'notANumber', part: part('yes'), op: 'set', target },
      { code: 'notANumber', part: part('words'), op: 'append', target },
      { code: 'notANumber', part: part('aside'), op: 'note', target },
      { code: 'noTarget', part: part('typo'), target: 'skills.clim.bonus' },
      { code: 'noTarget', part: part('no-stat'), target: 'abilities.luck.score' },
    ]);
    expect(result.warnings.at(-2)?.message).toBe(
      '"character:talent/odd#typo" changes skills.clim.bonus, which the character has no value for; it is not applied.',
    );
  });

  it("applies a toggled effect when it is switched on, or by the toggle's default", () => {
    const focus = talent('focus', [
      {
        id: 'aim',
        target: 'skills.climb.bonus',
        op: 'add',
        value: 3,
        toggle: { label: { en: 'Aiming' }, default: false },
      },
      {
        id: 'calm',
        target: 'skills.steady.bonus',
        op: 'add',
        value: 1,
        toggle: { label: { en: 'Calm' }, default: true },
      },
    ]);
    const byDefault = computed(ashWith([focus]));
    expect(byDefault.values['skills.climb.bonus']).toBe(2); // `nimble` only
    expect(byDefault.values['skills.steady.bonus']).toBe(1);
    const switched = computed(
      ashWith([focus], {
        state: {
          ...ash.state,
          toggles: { 'character:talent/focus#aim': true, 'character:talent/focus#calm': false },
        },
      }),
    );
    expect(switched.values['skills.climb.bonus']).toBe(5); // 2 + 3
    expect(switched.values['skills.steady.bonus']).toBe(0);
    expect(byDefault.warnings).toEqual([]);
    expect(switched.warnings).toEqual([]);
  });

  it('warns on a stored switch that names no toggle of an entity the character has', () => {
    const kept = talent('kept', [
      { id: 'plain', target: 'skills.sneak.bonus', op: 'add', value: 1 },
    ]);
    const spare = talent('spare', [
      {
        id: 'flash',
        target: 'skills.sneak.bonus',
        op: 'add',
        value: 1,
        toggle: { label: { en: 'Flash' }, default: true },
      },
    ]);
    const toggles = {
      'tales-core:talent/night-warden#glow': false, // a toggle Ash has: no warning
      'character:talent/spare#flash': true, // an entity Ash does not have
      'character:talent/kept#none': true, // no such effect
      'character:talent/kept#plain': false, // an effect with no toggle
    };
    const result = computed(
      variant(ash, {
        localEntities: [kept, spare],
        systemData: { ...ash.systemData, talents: [kept.id] },
        state: { ...ash.state, toggles },
      }),
    );
    expect(result.values['skills.sneak.bonus']).toBe(2); // `shadow` 1 + `plain` 1, whatever stored
    expect(codes(result)).toEqual(
      [
        'character:talent/spare#flash',
        'character:talent/kept#none',
        'character:talent/kept#plain',
      ].map((part) => ({ code: 'toggleGone', part })),
    );
  });

  it('an override replaces a value after its effects; one that cannot apply warns', () => {
    const result = computed(
      variant(ash, {
        overrides: [
          { path: 'skills.climb.total', value: 1, note: 'Rolled low' },
          { path: 'conditions.weary.level', value: 3 },
          { path: 'skills.steady.passive', value: 'high' },
          { path: 'skills.sneak.bonus', value: true },
          { path: 'skills.swim.total', value: 3 },
          { path: 'level', value: 5 },
        ],
      }),
    );
    expect(result.values).toMatchObject({
      level: 2,
      'conditions.weary.level': 3, // overridden, read by weary's `tired`
      'skills.all.bonus': -3,
      'skills.climb.total': 1,
      'skills.sneak.bonus': 1, // `shadow`; the override is not a number
      'skills.sneak.total': 2, // wits 2 + 2 × 1 + 1 - 3
      'skills.steady.total': -2, // nerve 1 + 2 × 0 + 0 - 3
      'skills.steady.passive': 3, // 5 - 2; the override is not a number
    });
    expect(result.breakdown['skills.climb.total']).toEqual([
      path('abilities.grit.mod', 3),
      path('skills.climb.prof', 1, 2),
      path('skills.climb.bonus', 2),
      path('skills.all.bonus', -3),
      { kind: 'override', value: 1, change: -3, note: 'Rolled low' }, // 4 before it
    ]);
    expect(result.breakdown['conditions.weary.level']).toEqual([
      {
        kind: 'condition',
        source: 'tales-core:condition/weary',
        label: { en: 'Weary' },
        value: 1,
        change: 1,
      },
      { kind: 'override', value: 3, change: 2 },
    ]);
    expect(codes(result)).toEqual([
      { code: 'fixedPath', path: 'level', by: 'override' },
      { code: 'overrideNotANumber', path: 'skills.sneak.bonus', value: true },
      { code: 'overrideNotANumber', path: 'skills.steady.passive', value: 'high' },
      { code: 'overrideNoPath', path: 'skills.swim.total' },
    ]);
  });

  it("values: level, the stats, the resources, the conditions, then the module's", () => {
    expect(Object.keys(computed(ash).values)).toEqual([
      'level',
      'abilities.grit.score',
      'abilities.grit.max',
      'abilities.grit.mod',
      'abilities.wits.score',
      'abilities.wits.max',
      'abilities.wits.mod',
      'abilities.nerve.score',
      'abilities.nerve.max',
      'abilities.nerve.mod',
      'resources.luck.max',
      'conditions.weary.level',
      'conditions.lost.level',
      'skills.all.bonus',
      'skills.climb.prof',
      'skills.climb.bonus',
      'skills.climb.total',
      'skills.sneak.prof',
      'skills.sneak.bonus',
      'skills.sneak.total',
      'skills.steady.prof',
      'skills.steady.bonus',
      'skills.steady.total',
      'skills.steady.passive',
    ]);
    const taking: Module = {
      ...talesModule,
      derive: (input) => ({
        ...talesModule.derive(input),
        'conditions.weary.level': () => ({
          value: 9,
          steps: [{ kind: 'rule', rule: 'sneaky', value: 9, change: 9 }],
        }),
      }),
    };
    const taken = computed(ash, taking);
    expect(taken.values['conditions.weary.level']).toBe(1);
    expect(codes(taken)).toEqual([{ code: 'pathTaken', path: 'conditions.weary.level' }]);
  });
});

describe('ENG-43 a key path: the stat a skill uses', () => {
  /** The step of a talent's effect on a key path. */
  const setBy = (slug: string, id: string, key: string) => ({
    kind: 'effect',
    part: `character:talent/${slug}#${id}`,
    source: `character:talent/${slug}`,
    label: { en: slug },
    key,
  });
  /** The step of a skill's own stat. */
  const ownStat = (slug: string, name: string, key: string) => ({
    kind: 'entity',
    source: `tales-core:skill/${slug}`,
    label: { en: name },
    key,
  });
  const stats = ['grit', 'wits', 'nerve'];

  const shift = talent('shift', [
    { id: 'climb', target: 'skills.climb.ability', op: 'set', value: 'wits' },
    {
      id: 'steady',
      target: 'skills.steady.ability',
      op: 'set',
      value: 'grit',
      when: '@abilities.grit.mod >= 3',
    },
    { id: 'sneak-last', target: 'skills.sneak.ability', op: 'set', value: 'nerve', phase: 'final' },
    { id: 'sneak', target: 'skills.sneak.ability', op: 'set', value: 'grit', priority: 90 },
    {
      id: 'off',
      target: 'skills.climb.ability',
      op: 'set',
      value: 'nerve',
      toggle: { label: { en: 'Off' }, default: false },
    },
    {
      id: 'never',
      target: 'skills.steady.ability',
      op: 'set',
      value: 'nerve',
      when: '@level >= 3',
    },
  ]);

  it("gives each skill its own stat, and Ash's values as before", () => {
    const result = computed(ash);
    expect(result.keys).toEqual({
      'skills.climb.ability': { key: 'grit', steps: [ownStat('climb', 'Climb', 'grit')] },
      'skills.sneak.ability': { key: 'wits', steps: [ownStat('sneak', 'Sneak', 'wits')] },
      'skills.steady.ability': { key: 'nerve', steps: [ownStat('steady', 'Steady', 'nerve')] },
    });
    for (const [at, value] of Object.entries(ashExpected.values)) {
      expect(result.values[at], at).toBe(value);
    }
  });

  it('a set naming a stat changes the stat a total reads, in phase and priority order', () => {
    const result = computed(ashWith([shift]));
    expect(result.values).toMatchObject({
      'skills.climb.total': 5, // wits 2 + 2 × 1 + `nimble` 2 - 1
      'skills.steady.total': 2, // grit 3 + 2 × 0 - 1: its `when` is true, `never`'s false
      'skills.steady.passive': 7, // 5 + 2
      'skills.sneak.total': 3, // nerve 1 + 2 × 1 + `shadow` 1 - 1: `final` comes after priority 90
    });
    expect(result.keys).toEqual({
      'skills.climb.ability': {
        key: 'wits',
        steps: [ownStat('climb', 'Climb', 'grit'), setBy('shift', 'climb', 'wits')],
      },
      'skills.sneak.ability': {
        key: 'nerve',
        steps: [
          ownStat('sneak', 'Sneak', 'wits'),
          setBy('shift', 'sneak', 'grit'),
          setBy('shift', 'sneak-last', 'nerve'),
        ],
      },
      'skills.steady.ability': {
        key: 'grit',
        steps: [ownStat('steady', 'Steady', 'nerve'), setBy('shift', 'steady', 'grit')],
      },
    });
    expect(result.breakdown['skills.climb.total']).toEqual([
      path('abilities.wits.mod', 2),
      path('skills.climb.prof', 1, 2),
      path('skills.climb.bonus', 2),
      path('skills.all.bonus', -1),
    ]);
    expect(codes(result)).toEqual([]);

    // Switched on, `off` comes after `climb` at the same priority: nerve 1 + 2 + 2 - 1.
    const on = computed(
      ashWith([shift], { state: { ...ash.state, toggles: { [part('off')]: true } } }),
    );
    expect(on.values['skills.climb.total']).toBe(4);
    expect(on.keys['skills.climb.ability']?.key).toBe('nerve');
  });

  /** The part of one of `shift`'s effects. */
  function part(id: string): string {
    return `character:talent/shift#${id}`;
  }

  it('an override naming a stat wins; a wrong op, key or override warns and is not applied', () => {
    const muddle = talent('muddle', [
      { id: 'climb', target: 'skills.climb.ability', op: 'set', value: 'wits' },
      { id: 'add', target: 'skills.sneak.ability', op: 'add', value: 1 },
      { id: 'number', target: 'skills.sneak.ability', op: 'set', value: 2 },
      { id: 'note', target: 'skills.sneak.ability', op: 'note', value: { en: 'Quietly' } },
      { id: 'luck', target: 'skills.steady.ability', op: 'set', value: 'luck' },
      { id: 'swim', target: 'skills.swim.ability', op: 'add', value: 1 },
      { id: 'swim-set', target: 'skills.swim.ability', op: 'set', value: 'grit' },
    ]);
    const result = computed(
      ashWith([muddle], {
        overrides: [
          { path: 'skills.climb.ability', value: 'nerve', note: 'Held fast' },
          { path: 'skills.sneak.ability', value: 3 },
          { path: 'skills.steady.ability', value: 'luck' },
        ],
      }),
    );
    expect(result.values).toMatchObject({
      'skills.climb.total': 4, // nerve 1 + 2 × 1 + 2 - 1, over `climb`'s wits
      'skills.sneak.total': 4, // wits 2 + 2 × 1 + 1 - 1, unchanged
      'skills.steady.total': 0, // nerve 1 + 0 - 1, unchanged
    });
    expect(result.keys['skills.climb.ability']).toEqual({
      key: 'nerve',
      steps: [
        ownStat('climb', 'Climb', 'grit'),
        setBy('muddle', 'climb', 'wits'),
        { kind: 'override', key: 'nerve', note: 'Held fast' },
      ],
    });
    const of = (id: string) => `character:talent/muddle#${id}`;
    const sneak = 'skills.sneak.ability';
    expect(codes(result)).toEqual([
      { code: 'notAKey', part: of('add'), op: 'add', target: sneak },
      { code: 'notAKey', part: of('number'), op: 'set', target: sneak },
      { code: 'notAKey', part: of('note'), op: 'note', target: sneak },
      { code: 'overrideNotAKey', path: sneak, value: 3, keys: stats },
      {
        code: 'unknownKey',
        part: of('luck'),
        target: 'skills.steady.ability',
        key: 'luck',
        keys: stats,
      },
      { code: 'overrideNotAKey', path: 'skills.steady.ability', value: 'luck', keys: stats },
      // A skill Ash lacks: a number op warns as before; a set with a text, as any op, does not.
      { code: 'noTarget', part: of('swim'), target: 'skills.swim.ability' },
    ]);
  });
});

describe('ENG-48 a key path with no key of its own', () => {
  /** Tales' module with `tally.pose`, a key path whose own key is not chosen. */
  const posing: Module = {
    ...talesModule,
    keys: (input) => ({
      ...talesModule.keys?.(input),
      'tally.pose': { steps: [], keys: ['bold', 'wary'] },
    }),
  };
  const pending = [{ path: 'tally.pose', options: ['bold', 'wary'] }];
  const pose = talent('pose', [
    { id: 'wary', target: 'tally.pose', op: 'set', value: 'wary' },
    { id: 'calm', target: 'tally.pose', op: 'set', value: 'calm' },
  ]);
  const wary = {
    kind: 'effect',
    part: 'character:talent/pose#wary',
    source: 'character:talent/pose',
    label: { en: 'pose' },
    key: 'wary',
  };

  it('has no key until a set gives it one, and stays pending', () => {
    const none = computed(ash, posing);
    expect(none.keys['tally.pose']).toBeUndefined();
    expect(none.pendingKeys).toEqual(pending);
    expect(none.warnings).toEqual([]);

    const result = computed(ashWith([pose]), posing);
    expect(result.keys['tally.pose']).toEqual({ key: 'wary', steps: [wary] });
    expect(result.pendingKeys).toEqual(pending);
    expect(codes(result)).toEqual([
      {
        code: 'unknownKey',
        part: 'character:talent/pose#calm',
        target: 'tally.pose',
        key: 'calm',
        keys: ['bold', 'wary'],
      },
    ]);
  });

  it('an override naming one of its keys wins; one naming another warns', () => {
    const bold = computed(
      ashWith([pose], { overrides: [{ path: 'tally.pose', value: 'bold', note: 'Stood up' }] }),
      posing,
    );
    expect(bold.keys['tally.pose']).toEqual({
      key: 'bold',
      steps: [wary, { kind: 'override', key: 'bold', note: 'Stood up' }],
    });
    expect(bold.pendingKeys).toEqual(pending);

    const calm = computed(
      variant(ash, { overrides: [{ path: 'tally.pose', value: 'calm' }] }),
      posing,
    );
    expect(calm.keys['tally.pose']).toBeUndefined();
    expect(codes(calm)).toEqual([
      { code: 'overrideNotAKey', path: 'tally.pose', value: 'calm', keys: ['bold', 'wary'] },
    ]);
  });
});

/** Tales' module, naming each talent of the character's own with the paths given for its id. */
function naming(paths: Readonly<Record<string, OwnPaths>>, more: OwnPaths[] = []): Module {
  return {
    ...talesModule,
    entities: (character) => [
      ...talesModule.entities(character).map((named) => {
        const own = paths[named.id];
        return own === undefined ? named : { ...named, paths: own };
      }),
      // Named again after the others: the first naming's paths are kept.
      ...more.map((again) => ({ id: 'character:talent/lantern', paths: again })),
    ],
  };
}

describe("ENG-14 an entity's own paths", () => {
  // The lantern reads `@carried`, its own path, in the base phase (`warm`, a `when`) and in the
  // derived phase (`light`, a value); the moth reads it too, and has no such path.
  const lantern = talent('lantern', [
    { id: 'warm', target: 'abilities.grit.score', op: 'add', value: 1, when: '@carried' },
    { id: 'light', target: 'skills.sneak.bonus', op: 'add', value: '2 * @carried' },
  ]);
  const moth = talent('moth', [
    { id: 'drawn', target: 'skills.climb.bonus', op: 'add', value: 1, when: '@carried' },
  ]);
  const character = ashWith([lantern, moth]);
  // A derived-phase formula reads a missing path through the derived values, which warn (ENG-28).
  const mothWarning = { code: 'missingPath', path: 'carried', for: 'skills.climb.bonus' };

  it("are read first by the entity's own effects, in the base and the derived phase", () => {
    const result = computed(character, naming({ 'character:talent/lantern': { carried: 1 } }));
    expect(result.values).toMatchObject({
      // 7 + `warm` 1, allowed in the base phase; mod floor(8 / 2).
      'abilities.grit.score': 8,
      'abilities.grit.mod': 4,
      // wits 2 + 2 × 1 + `shadow` 1 + `light` 2 × 1 - 1.
      'skills.sneak.total': 6,
      // grit 4 + 2 × 1 + `nimble` 2 - 1; the moth's `drawn` reads no `@carried`.
      'skills.climb.total': 7,
    });
    expect(result.breakdown['abilities.grit.score']).toContainEqual(
      own('lantern', 'warm', 'add', 1, 1),
    );
    expect(codes(result)).toEqual([mothWarning]);
    const had = new Map(result.entities.map((each) => [each.entity.id, each]));
    expect(had.get('character:talent/lantern')?.paths).toEqual({ carried: 1 });
    expect(had.get('character:talent/moth')).not.toHaveProperty('paths');
  });

  it('give 0 as they are given: a `when` false, a value of 0', () => {
    const result = computed(character, naming({ 'character:talent/lantern': { carried: 0 } }));
    expect(result.values).toMatchObject({
      'abilities.grit.score': 7,
      // wits 2 + 2 × 1 + `shadow` 1 + `light` 0 - 1.
      'skills.sneak.total': 4,
      'skills.climb.total': 6,
    });
    expect(result.breakdown['skills.sneak.bonus']).toContainEqual(
      own('lantern', 'light', 'add', 0, 0),
    );
    expect(codes(result)).toEqual([mothWarning]);
  });

  it("are read by a key effect's `when` too (ENG-43)", () => {
    const compass = talent('compass', [
      { id: 'sight', target: 'skills.sneak.ability', op: 'set', value: 'grit', when: '@carried' },
    ]);
    const sneakWith = (carried: number) => {
      const result = computed(
        ashWith([compass]),
        naming({ 'character:talent/compass': { carried } }),
      );
      return [result.keys['skills.sneak.ability']?.key, result.values['skills.sneak.total']];
    };
    // Grit 3 + 2 × 1 + `shadow` 1 - 1; else wits 2 + 2 × 1 + 1 - 1.
    expect(sneakWith(1)).toEqual(['grit', 5]);
    expect(sneakWith(0)).toEqual(['wits', 4]);
  });

  it("are the first naming's when an entity is named twice", () => {
    const result = computed(
      character,
      naming({ 'character:talent/lantern': { carried: 1 } }, [{ carried: 0 }]),
    );
    expect(result.values['skills.sneak.total']).toBe(6);
    const lit = result.entities.find(({ entity }) => entity.id === 'character:talent/lantern');
    expect(lit).toMatchObject({ from: ['character'], paths: { carried: 1 } });
  });
});

describe('ENG-14 appended numbers', () => {
  // A list of formulas of Tales' own, `guard.formulas`, which no step computes. Ash: level 2,
  // wits mod 2. The lamp is named with `{ carried: 1 }`.
  const lamp = talent('lamp', [
    { id: 'a', target: 'guard.formulas', op: 'append', value: '10 + @abilities.wits.mod' },
    { id: 'b', target: 'guard.formulas', op: 'append', value: '14' },
    { id: 'c', target: 'guard.formulas', op: 'append', value: '20', when: '@level > 5' },
    { id: 'd', target: 'guard.formulas', op: 'append', value: '1 +' },
    { id: 'e', target: 'guard.formulas', op: 'append', value: '@carried * 3' },
    { id: 'f', target: 'guard.formulas', op: 'advantage', value: true },
    { id: 'g', target: 'guard.formulas', op: 'note', value: { en: 'Lit' } },
    { id: 'h', target: 'guard.formulas', op: 'set', value: 'high' },
    { id: 'i', target: 'guard.formulas', op: 'add', value: 1 },
    { id: 'j', target: 'skills.sneak.bonus', op: 'append', value: '1' },
  ]);
  const result = computed(ashWith([lamp]), naming({ 'character:talent/lamp': { carried: 1 } }));

  it("gives each append's formula worked out, in order; warns any other op giving no number", () => {
    const warnings: EffectWarning[] = [];
    const numbers = appendedNumbers(
      activeEffects(result.entities, {}),
      'guard.formulas',
      () => ({ read: (path) => result.values[path] }),
      (warning) => warnings.push(warning),
    );
    const by = (id: string) => ({
      part: `character:talent/lamp#${id}`,
      source: 'character:talent/lamp',
      label: { en: 'lamp' },
    });
    expect(numbers).toEqual([
      { value: 12, formula: '10 + @abilities.wits.mod', ...by('a') },
      { value: 14, formula: '14', ...by('b') },
      // `c`'s `when` is false at level 2; `d` does not parse.
      { value: 3, formula: '@carried * 3', ...by('e') },
    ]);
    expect(codes({ warnings })).toEqual([
      { code: 'formula', part: 'character:talent/lamp#d', field: 'value', inner: 'unexpected' },
      {
        code: 'notAppended',
        part: 'character:talent/lamp#f',
        op: 'advantage',
        target: 'guard.formulas',
      },
      {
        code: 'notAppended',
        part: 'character:talent/lamp#g',
        op: 'note',
        target: 'guard.formulas',
      },
      { code: 'notAppended', part: 'character:talent/lamp#h', op: 'set', target: 'guard.formulas' },
    ]);
  });

  it("leaves a number op to the phases' `noTarget`, and other targets to the phases", () => {
    // `j` appends to a number path, which gives no number (ENG-17); `i` adds to a path no step
    // computes, warned when the phases end.
    expect(codes(result)).toEqual([
      {
        code: 'notANumber',
        part: 'character:talent/lamp#j',
        op: 'append',
        target: 'skills.sneak.bonus',
      },
      { code: 'noTarget', part: 'character:talent/lamp#i', target: 'guard.formulas' },
    ]);
    expect(result.values['skills.sneak.total']).toBe(4);
  });
});
