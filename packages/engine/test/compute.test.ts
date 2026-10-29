import {
  type Computed,
  compute,
  type GatherableEntity,
  type GrantOf,
  keyFinderOf,
  loadContentIndex,
  MAX_COMPUTE_PASSES,
  type SystemModule,
} from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import { describe, expect, expectTypeOf, it } from 'vitest';
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

// Tales, the made-up test system (ENG-27). Every expected value below is read by hand from its
// data: `tales/content.ts`, `tales/characters.ts`, and ENG-27's `tales/expected.ts`.

/** The value of an opener's result, or a failed test naming why it did not open. */
function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const pack = opened(openTalesPack(talesCore));
const { index } = loadContentIndex('tales', [pack]);
const ash = opened(openTalesCharacter(ashFile));
const brook = opened(openTalesCharacter(brookFile));

/** A character changed, then opened as a file would be, so it is still a valid character. */
function variant(base: TalesCharacter, change: Partial<TalesCharacter>): TalesCharacter {
  return opened(openTalesCharacter({ ...base, ...change }));
}

/** Tales' character, computed with its module. */
function computed(
  character: TalesCharacter,
  system: SystemModule<TalesCharacter, TalesEntity> = talesModule,
) {
  return compute(character, index, system);
}

/** The ids of the entities the character has, in order. */
function ids(result: Computed<TalesEntity>): string[] {
  return result.entities.map(({ entity }) => entity.id);
}

/** Type → key → the id of the entry it names. */
function keyedIds(result: Computed<TalesEntity>): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.entries(result.byKey).map(([type, keyed]) => [
      type,
      Object.fromEntries(Object.entries(keyed).map(([key, entity]) => [key, entity.id])),
    ]),
  );
}

/** The warnings without their log message. */
function codes<W extends { message: string }>(result: { warnings: readonly W[] }) {
  return result.warnings.map(({ message: _, ...warning }) => warning as WithoutMessage<W>);
}

/** Each kind of warning without its `message`. */
type WithoutMessage<W> = W extends unknown ? Omit<W, 'message'> : never;

/** Iron Will's two prerequisites, which neither Ash nor Brook meets (SHEET-14). */
const ironWillUnmet = [
  {
    code: 'unmetPrerequisite',
    entity: 'tales-core:talent/iron-will',
    prerequisite: { kind: 'level', min: 4 },
  },
  {
    code: 'unmetPrerequisite',
    entity: 'tales-core:talent/iron-will',
    prerequisite: { kind: 'proficiency', category: 'craft', key: 'rope' },
  },
];

/** A grant of Tales' pack, by entity id and grant id. */
function grantOf(id: string, grantId: string) {
  const grant = pack.entities
    .find((entity) => entity.id === id)
    ?.grants?.find((each) => {
      return each.id === grantId;
    });
  if (grant === undefined) throw new Error(`No grant ${id}#${grantId}`);
  return grant;
}

/** Freezes an object and everything in it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

const source = { pack: 'character' };

describe('ENG-11 gathering a character’s entities', () => {
  it.each<[string, TalesCharacter, TalesExpected]>([
    ['Ash', ash, ashExpected],
    ['Brook', brook, brookExpected],
  ])(
    '%s: the entities, unmade choices and missing ids ENG-27 expects',
    (_, character, expected) => {
      const result = computed(character);
      expect(ids(result)).toEqual(expected.entities);
      expect(result.pendingChoices.map(({ part }) => part)).toEqual(expected.pendingChoices);
      const missing = result.warnings.flatMap((each) => (each.code === 'missing' ? [each.id] : []));
      expect(missing).toEqual(expected.missing);
    },
  );

  it('Ash: where each entity came from, its grants, proficiencies, resource, keys, conditions', () => {
    const result = computed(ash);
    expect(result.entities.map(({ entity, level, from }) => [entity.id, level, from])).toEqual([
      ['tales-core:calling/warden', 2, ['character']],
      ['tales-core:talent/night-warden', 2, ['tales-core:calling/warden#pick-talent']],
      ['tales-core:talent/quick-step', 2, ['tales-core:talent/night-warden#step']],
      ['tales-core:condition/weary', 2, ['character']],
    ]);
    expect(result.grants.map(({ part, chosen }) => [part, chosen])).toEqual([
      ['tales-core:calling/warden#sturdy', []],
      ['tales-core:calling/warden#climber', []],
      ['tales-core:calling/warden#pick-knack', ['sneak']],
      ['tales-core:calling/warden#luck', []],
      ['tales-core:calling/warden#pick-talent', ['tales-core:talent/night-warden']],
      ['tales-core:talent/night-warden#step', []],
      ['tales-core:talent/night-warden#stars', []],
    ]);
    expect(result.proficiencies).toEqual([
      { category: 'knack', key: 'climb', from: 'tales-core:calling/warden#climber' },
      { category: 'knack', key: 'sneak', from: 'tales-core:calling/warden#pick-knack' },
      { category: 'lore', key: 'stars', level: 2, from: 'tales-core:talent/night-warden#stars' },
    ]);
    expect(result.resources).toEqual([
      {
        key: 'luck',
        label: { en: 'Luck' },
        uses: { max: '@abilities.nerve.mod + 1', recovery: [{ on: 'scene', amount: 'all' }] },
        from: 'tales-core:calling/warden#luck',
      },
    ]);
    expect(keyedIds(result)).toEqual({
      ability: {
        grit: 'tales-core:ability/grit',
        wits: 'tales-core:ability/wits',
        nerve: 'tales-core:ability/nerve',
      },
      skill: {
        climb: 'tales-core:skill/climb',
        sneak: 'tales-core:skill/sneak',
        steady: 'tales-core:skill/steady',
      },
      condition: { weary: 'tales-core:condition/weary', lost: 'tales-core:condition/lost' },
      calling: { warden: 'tales-core:calling/warden' },
    });
    expect(result.conditions).toEqual({
      weary: { id: 'tales-core:condition/weary', level: 1 },
      lost: { id: 'tales-core:condition/lost', level: 0 },
    });
    expect(result.warnings).toEqual([]);
  });

  it('Brook: an unmade choice with its options, a missing id, a boon that gives nothing', () => {
    const result = computed(brook);
    expect(result.pendingChoices).toEqual([
      {
        part: 'tales-core:calling/seeker#knacks',
        grant: grantOf('tales-core:calling/seeker', 'knacks'),
        chosen: [],
        options: ['climb', 'sneak', 'steady'],
      },
    ]);
    expect(codes(result)).toEqual([
      { code: 'missing', id: 'tales-core:talent/gone-missing', from: 'character' },
      ...ironWillUnmet,
    ]);
    expect(result.warnings[0]?.message).toBe(
      'Missing: tales-core:talent/gone-missing (given by character).',
    );
    expect(result.proficiencies).toEqual([]);
    expect(result.resources.map(({ key, from }) => [key, from])).toEqual([
      ['focus', 'tales-core:calling/seeker#focus'],
    ]);
    const boon = result.grants.find(({ part }) => part === 'tales-core:calling/seeker#blessing');
    expect(boon?.grant.kind).toBe('boon');
    expect(ids(result)).not.toContain('tales-core:talent/deep-lungs');
    expect(keyedIds(result).skill?.climb).toBe('tales-core:skill/climb-anew');
    expect(keyedIds(result).calling).toEqual({
      warden: 'tales-core:calling/warden',
      seeker: 'tales-core:calling/seeker',
    });
    expect(result.conditions).toEqual({
      weary: { id: 'tales-core:condition/weary', level: 0 },
      lost: { id: 'tales-core:condition/lost', level: 1 },
    });
  });

  it("measures a grant's atLevel against the character's level, or the entity's own", () => {
    const atOne = computed(variant(ash, { systemData: { ...ash.systemData, level: 1 } }));
    expect(ids(atOne)).toEqual(['tales-core:calling/warden', 'tales-core:condition/weary']);
    expect(atOne.grants.map(({ part }) => part)).not.toContain(
      'tales-core:calling/warden#pick-talent',
    );
    expect(atOne.pendingChoices).toEqual([]);

    const ownLevel: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      entities: (character) => [{ id: character.systemData.calling, level: 1 }],
    };
    expect(ids(computed(ash, ownLevel))).toEqual([
      'tales-core:calling/warden',
      'tales-core:condition/weary',
    ]);

    const unmade = computed(variant(ash, { choices: {} }));
    expect(unmade.pendingChoices.map(({ part, options }) => [part, options])).toEqual([
      ['tales-core:calling/warden#pick-knack', ['sneak', 'steady']],
      [
        'tales-core:calling/warden#pick-talent',
        ['tales-core:talent/night-warden', 'tales-core:talent/deep-lungs'],
      ],
    ]);
  });

  it('uses too few, too many and unoffered items, with a warning, never a block', () => {
    const one = computed(
      variant(brook, { choices: { 'tales-core:calling/seeker#knacks': ['climb'] } }),
    );
    expect(one.pendingChoices.map(({ chosen, options }) => [chosen, options])).toEqual([
      [['climb'], ['sneak', 'steady']],
    ]);
    expect(one.proficiencies.map(({ key }) => key)).toEqual(['climb']);

    const three = computed(
      variant(brook, {
        choices: { 'tales-core:calling/seeker#knacks': ['climb', 'sneak', 'steady'] },
      }),
    );
    expect(three.pendingChoices).toEqual([]);
    expect(three.proficiencies.map(({ key }) => key)).toEqual(['climb', 'sneak']);
    expect(codes(three)).toContainEqual({
      code: 'tooManyChosen',
      part: 'tales-core:calling/seeker#knacks',
      count: 2,
      chosen: 3,
    });

    const climbing = computed(
      variant(ash, {
        choices: { ...ash.choices, 'tales-core:calling/warden#pick-knack': ['climb'] },
      }),
    );
    expect(codes(climbing)).toEqual([
      { code: 'notAnOption', part: 'tales-core:calling/warden#pick-knack', item: 'climb' },
    ]);
    expect(climbing.proficiencies.map(({ key, from }) => [key, from.split('#')[1]])).toEqual([
      ['climb', 'climber'],
      ['climb', 'pick-knack'],
      ['stars', 'stars'],
    ]);

    const willing = computed(
      variant(ash, {
        choices: {
          ...ash.choices,
          'tales-core:calling/warden#pick-talent': ['tales-core:talent/iron-will'],
        },
      }),
    );
    expect(ids(willing)).toContain('tales-core:talent/iron-will');
    expect(codes(willing)).toEqual([
      {
        code: 'notAnOption',
        part: 'tales-core:calling/warden#pick-talent',
        item: 'tales-core:talent/iron-will',
      },
      {
        code: 'otherRuleset',
        entity: 'tales-core:talent/iron-will',
        ruleset: 'second-age',
        mixingAllowed: false,
      },
      ...ironWillUnmet,
    ]);

    const gone = computed(
      variant(ash, {
        choices: {
          ...ash.choices,
          'tales-core:calling/warden#pick-talent': ['tales-core:talent/gone'],
        },
      }),
    );
    expect(codes(gone)).toEqual([
      {
        code: 'missing',
        id: 'tales-core:talent/gone',
        from: 'tales-core:calling/warden#pick-talent',
      },
    ]);
    expect(gone.pendingChoices.map(({ chosen, options }) => [chosen, options])).toEqual([
      [[], ['tales-core:talent/night-warden', 'tales-core:talent/deep-lungs']],
    ]);
  });

  it('offers what a filter finds in the rulesets in use, and warns when it finds too few', () => {
    const drifter: TalesEntity = {
      id: 'character:calling/drifter',
      type: 'calling',
      key: 'drifter',
      ruleset: 'any',
      name: { en: 'Drifter' },
      die: 4,
      grants: [
        {
          id: 'any-knack',
          kind: 'proficiency',
          category: 'knack',
          choose: { count: 1, from: { type: 'skill' } },
        },
        { id: 'talents', kind: 'entity', choose: { count: 4, from: { type: 'talent' } } },
      ],
      source,
    };
    const base = variant(ash, {
      choices: {},
      localEntities: [drifter],
      systemData: { level: 2, calling: drifter.id, talents: ['tales-core:talent/quick-step'] },
    });
    const options = (result: Computed<TalesEntity>) =>
      result.pendingChoices.map(({ part, options }) => [part.split('#')[1], options]);

    const unmixed = computed(base);
    expect(options(unmixed)).toEqual([
      ['any-knack', ['climb', 'sneak', 'steady']],
      ['talents', ['tales-core:talent/night-warden', 'tales-core:talent/deep-lungs']],
    ]);
    expect(codes(unmixed)).toEqual([
      { code: 'fewOptions', part: 'character:calling/drifter#talents', needed: 4, found: 2 },
    ]);

    const mixed = computed(variant(base, { allowMixedRulesets: true }));
    expect(options(mixed)).toEqual([
      ['any-knack', ['climb', 'sneak', 'steady']],
      [
        'talents',
        [
          'tales-core:talent/night-warden',
          'tales-core:talent/deep-lungs',
          'tales-core:talent/iron-will',
        ],
      ],
    ]);
    expect(codes(mixed)).toEqual([
      { code: 'fewOptions', part: 'character:calling/drifter#talents', needed: 4, found: 3 },
    ]);
  });

  it('keeps a stat distribution pending until it is made, then passes its items through', () => {
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
    const base = variant(brook, {
      localEntities: [tinker],
      state: { ...brook.state, toggles: {} }, // its lucky charm is gone, so is its switch
      systemData: { level: 1, calling: tinker.id, talents: [] },
    });
    expect(
      computed(base).pendingChoices.map(({ part, chosen, options }) => [part, chosen, options]),
    ).toEqual([['character:calling/tinker#knack-of-hands', [], ['grit', 'wits', 'nerve']]]);
    const made = computed(
      variant(base, { choices: { 'character:calling/tinker#knack-of-hands': ['wits', 'grit'] } }),
    );
    expect(made.pendingChoices).toEqual([]);
    expect(made.grants.map(({ part, chosen }) => [part, chosen])).toEqual([
      ['character:calling/tinker#knack-of-hands', ['wits', 'grit']],
    ]);
    expect(codes(made)).toEqual([]);
  });

  it('reads a key as the entry the character has, else its rules base’s', () => {
    const oldSeeker: TalesEntity = {
      id: 'character:calling/old-seeker',
      type: 'calling',
      key: 'seeker',
      ruleset: 'first-age',
      name: { en: 'Old seeker' },
      die: 6,
      source,
    };
    const mixed = variant(ash, { allowMixedRulesets: true, localEntities: [oldSeeker] });

    const asWarden = computed(mixed);
    expect(keyedIds(asWarden).calling?.seeker).toBe('character:calling/old-seeker');
    expect(keyedIds(asWarden).skill?.climb).toBe('tales-core:skill/climb');
    expect(codes(asWarden)).toEqual([]);

    const asSeeker = computed(
      variant(mixed, {
        choices: {},
        systemData: { ...ash.systemData, calling: 'tales-core:calling/seeker' },
      }),
    );
    expect(keyedIds(asSeeker).calling?.seeker).toBe('tales-core:calling/seeker');
    expect(codes(asSeeker)).toContainEqual({
      code: 'otherRuleset',
      entity: 'tales-core:calling/seeker',
      ruleset: 'second-age',
      mixingAllowed: true,
    });
  });

  it('warns when an own entity repeats a key in one ruleset, and keeps the pack’s', () => {
    const sneak: TalesEntity = {
      id: 'character:skill/sneak',
      type: 'skill',
      key: 'sneak',
      ruleset: 'first-age',
      name: { en: 'Sneak, my way' },
      ability: 'grit',
      source,
    };
    const trick: TalesEntity = { ...sneak, id: 'character:skill/trick', key: 'trick' };
    const twice: TalesEntity = { ...trick, id: 'character:skill/trick-again' };
    const otherType: TalesEntity = {
      id: 'character:calling/sneak',
      type: 'calling',
      key: 'sneak',
      ruleset: 'any',
      name: { en: 'Sneak' },
      die: 4,
      source,
    };
    const result = computed(variant(ash, { localEntities: [sneak, trick, twice, otherType] }));
    expect(codes(result)).toEqual([
      {
        code: 'repeatedKey',
        type: 'skill',
        key: 'sneak',
        entity: 'character:skill/sneak',
        kept: 'tales-core:skill/sneak',
      },
      {
        code: 'repeatedKey',
        type: 'skill',
        key: 'trick',
        entity: 'character:skill/trick-again',
        kept: 'character:skill/trick',
      },
    ]);
    expect(keyedIds(result).skill?.sneak).toBe('tales-core:skill/sneak');
    expect(keyedIds(result).skill?.trick).toBe('character:skill/trick');
  });

  it('gives each keyed condition a level, and a condition without a key no path', () => {
    const dazed: TalesEntity = {
      id: 'character:condition/dazed',
      type: 'condition',
      ruleset: 'any',
      name: { en: 'Dazed' },
      source,
    };
    const result = computed(
      variant(brook, {
        localEntities: [...brook.localEntities, dazed],
        state: {
          ...brook.state,
          conditions: [
            { id: 'tales-core:condition/weary', level: 5 },
            { id: 'tales-core:condition/lost', level: 2 },
            { id: dazed.id },
          ],
        },
      }),
    );
    expect(ids(result).slice(-3)).toEqual([
      'tales-core:condition/weary',
      'tales-core:condition/lost',
      'character:condition/dazed',
    ]);
    expect(result.conditions).toEqual({
      weary: { id: 'tales-core:condition/weary', level: 3 },
      lost: { id: 'tales-core:condition/lost', level: 1 },
    });
    expect(codes(result).filter(({ code }) => code === 'conditionLevel')).toEqual([
      { code: 'conditionLevel', entity: 'tales-core:condition/weary', level: 5, max: 3 },
      { code: 'conditionLevel', entity: 'tales-core:condition/lost', level: 2, max: 1 },
    ]);
  });

  it('gathers each entity once, so a loop of grants ends', () => {
    const talent = (slug: string, gives: string): TalesEntity => ({
      id: `character:talent/${slug}`,
      type: 'talent',
      ruleset: 'any',
      name: { en: slug },
      tier: 1,
      grants: [{ id: 'gives', kind: 'entity', fixed: [`character:talent/${gives}`] }],
      source,
    });
    const result = computed(
      variant(brook, {
        localEntities: [talent('ebb', 'flow'), talent('flow', 'ebb')],
        systemData: { ...brook.systemData, talents: ['character:talent/ebb'] },
      }),
    );
    expect(result.entities.map(({ entity, from }) => [entity.id, from])).toEqual([
      ['tales-core:calling/seeker', ['character']],
      ['character:talent/ebb', ['character', 'character:talent/flow#gives']],
      ['character:talent/flow', ['character:talent/ebb#gives']],
      ['tales-core:condition/lost', ['character']],
    ]);
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const character = deepFreeze(structuredClone(brook));
    deepFreeze(pack);
    const first = compute(character, index, talesModule);
    expect(compute(character, index, talesModule)).toEqual(first);
    expect(first).toEqual(computed(brook));
  });

  it("keeps a module's grant kinds in their own type", () => {
    type TalesGrant = NonNullable<TalesEntity['grants']>[number];
    expectTypeOf<GrantOf<TalesEntity>>().toEqualTypeOf<TalesGrant>();
    expectTypeOf<Computed<TalesEntity>['grants'][number]['grant']>().toEqualTypeOf<TalesGrant>();
    expectTypeOf<Extract<TalesGrant, { kind: 'boon' }>['boon']>().toEqualTypeOf<EntityId>();
  });

  describe('on entities of another made-up shape', () => {
    // Fields Tales has not: a type's own `category`, and a module kind `deal` with a choice.
    type Card = GatherableEntity & { category?: string };
    const card = (slug: string, category: string): Card => ({
      id: `cards:card/${slug}`,
      type: 'card',
      ruleset: 'any',
      name: { en: slug },
      category,
    });
    const hand: Card = {
      id: 'cards:hand/start',
      type: 'hand',
      ruleset: 'any',
      name: { en: 'Start' },
      grants: [
        {
          id: 'high',
          kind: 'entity',
          choose: { count: 1, from: { type: 'card', category: 'high' } },
        },
        {
          id: 'listed',
          kind: 'entity',
          choose: { count: 1, from: ['cards:card/two', 'cards:card/gone'] },
        },
        { id: 'deal', kind: 'deal', choose: { count: 1, from: { type: 'card' } } },
      ],
    };
    const cards = loadContentIndex('cards', [
      {
        id: 'cards',
        version: '1.0.0',
        system: 'cards',
        entities: [card('ace', 'high'), card('two', 'low'), hand],
      },
    ]).index;
    const player = (choices: Record<string, string[]>) => ({
      ruleset: 'one',
      allowMixedRulesets: false,
      abilities: { base: {} },
      choices,
      state: { conditions: [], toggles: {} },
      overrides: [],
      localEntities: [] as Card[],
    });
    const dealer: SystemModule<ReturnType<typeof player>> = {
      level: () => 1,
      entities: () => [{ id: 'cards:hand/start' }],
      statDefaults: () => ({ defaultMax: 1, modFormula: '@score', hasSave: false }),
      derive: () => ({}),
    };

    it("matches a filter's category, and looks up a pending list's ids", () => {
      const result = compute(player({}), cards, dealer);
      expect(result.pendingChoices.map(({ part, options }) => [part, options])).toEqual([
        ['cards:hand/start#high', ['cards:card/ace']],
        ['cards:hand/start#listed', ['cards:card/two']],
        ['cards:hand/start#deal', ['cards:card/ace', 'cards:card/two']],
      ]);
      expect(codes(result)).toEqual([
        { code: 'missing', id: 'cards:card/gone', from: 'cards:hand/start#listed' },
      ]);
    });

    it("passes a module kind's chosen ids through, without gathering them", () => {
      const result = compute(
        player({
          'cards:hand/start#high': ['cards:card/two'],
          'cards:hand/start#listed': ['cards:card/two'],
          'cards:hand/start#deal': ['cards:card/ace'],
        }),
        cards,
        dealer,
      );
      expect(result.entities.map(({ entity }) => entity.id)).toEqual([
        'cards:hand/start',
        'cards:card/two',
      ]);
      expect(result.grants.map(({ part, chosen }) => [part, chosen])).toEqual([
        ['cards:hand/start#high', ['cards:card/two']],
        ['cards:hand/start#listed', ['cards:card/two']],
        ['cards:hand/start#deal', ['cards:card/ace']],
      ]);
      expect(result.pendingChoices).toEqual([]);
      expect(codes(result)).toEqual([
        { code: 'notAnOption', part: 'cards:hand/start#high', item: 'cards:card/two' },
      ]);
    });
  });
});

describe("ENG-13 a module's rule for an entity's grants", () => {
  /** What `grantsOf` was asked: the character's name and the entity's id, in order. */
  const asked: string[] = [];

  /** Tales with a rule made up here: the warden gives a knack in place of its two choices. */
  const ruled: SystemModule<TalesCharacter, TalesEntity> = {
    ...talesModule,
    grantsOf: (character, entity) => {
      asked.push(`${character.name} ${entity.id}`);
      const own = entity.grants ?? [];
      if (entity.id !== 'tales-core:calling/warden') return own;
      return [
        ...own.filter(({ id }) => id !== 'pick-knack' && id !== 'pick-talent'),
        { id: 'steady', kind: 'proficiency', category: 'knack', fixed: ['steady'] },
      ];
    },
  };

  it('gathers what it gives under the part it names; what it leaves out gives nothing', () => {
    const result = computed(ash, ruled);
    // No talent: the warden's `pick-talent` is left out, so night-warden and quick-step are not.
    expect(ids(result)).toEqual(['tales-core:calling/warden', 'tales-core:condition/weary']);
    expect(result.grants.map(({ part, chosen }) => [part, chosen])).toEqual([
      ['tales-core:calling/warden#sturdy', []],
      ['tales-core:calling/warden#climber', []],
      ['tales-core:calling/warden#luck', []],
      ['tales-core:calling/warden#steady', []],
    ]);
    expect(result.proficiencies).toEqual([
      { category: 'knack', key: 'climb', from: 'tales-core:calling/warden#climber' },
      { category: 'knack', key: 'steady', from: 'tales-core:calling/warden#steady' },
    ]);
    // Ash's stored choices of the two left out are not read: nothing pending, no warning.
    expect(result.pendingChoices).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect([result.values['skills.sneak.prof'], result.values['skills.steady.prof']]).toEqual([
      0, 1,
    ]);
  });

  it('is asked once for each entity gathered, with the character', () => {
    asked.length = 0;
    computed(ash, ruled);
    expect(asked).toEqual(['Ash tales-core:calling/warden', 'Ash tales-core:condition/weary']);
    asked.length = 0;
    computed(brook, ruled);
    expect(asked).toEqual([
      'Brook tales-core:calling/seeker',
      'Brook character:talent/lucky-charm',
      'Brook tales-core:talent/iron-will',
      'Brook tales-core:condition/lost',
    ]);
  });
});

describe('ENG-44 the module looks up ids', () => {
  const lookedUp = [
    'tales-core:calling/seeker',
    'character:talent/lucky-charm',
    'tales-core:x/none',
  ];

  it("finds a pack's entity and the character's own as gathering does; `undefined` for none", () => {
    const found: Record<string, (string | undefined)[]> = {};
    const looking: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      entities: (character, find, findKey, without) => {
        found.entities = lookedUp.map((id) => find(id)?.name.en);
        return talesModule.entities(character, find, findKey, without);
      },
      derive: (input) => {
        found.derive = lookedUp.map((id) => input.find(id)?.name.en);
        return talesModule.derive(input);
      },
      keys: (input) => {
        found.keys = lookedUp.map((id) => input.find(id)?.name.en);
        return talesModule.keys?.(input) ?? {};
      },
    };
    const result = computed(brook, looking);
    // Brook's pack has the seeker; the lucky charm is Brook's own; no one has the third.
    const names = ['Seeker', 'Lucky charm', undefined];
    expect(found).toEqual({ entities: names, derive: names, keys: names });
    expect(result.values).toEqual(computed(brook).values);
  });
});

describe("ENG-49 ids a module's grant names, looked up once", () => {
  /** Brook's one warning: a talent no pack has, named by the character (ENG-27). */
  const brookMissing = { code: 'missing', id: 'tales-core:talent/gone-missing', from: 'character' };

  /** Brook with one more talent, of its own, `character:talent/wish`, which has `grants`. */
  function wishing(grants: GrantOf<TalesEntity>[], change: Partial<TalesCharacter> = {}) {
    const wish: TalesEntity = {
      id: 'character:talent/wish',
      type: 'talent',
      ruleset: 'any',
      name: { en: 'Wish' },
      tier: 1,
      grants,
      source,
    };
    return variant(brook, {
      localEntities: [...brook.localEntities, wish],
      systemData: { ...brook.systemData, talents: [...brook.systemData.talents, wish.id] },
      ...change,
    });
  }
  const boonOf = (boon: EntityId, atLevel?: number): GrantOf<TalesEntity> => ({
    id: 'wish',
    kind: 'boon',
    boon,
    ...(atLevel !== undefined && { atLevel }),
  });

  it("warns for a boon's talent no pack has, from the boon's part, and gathers no boon's talent", () => {
    const result = computed(wishing([boonOf('tales-core:talent/gone')]));
    expect(codes(result)).toEqual([
      brookMissing,
      { code: 'missing', id: 'tales-core:talent/gone', from: 'character:talent/wish#wish' },
      ...ironWillUnmet,
    ]);
    expect(result.warnings[1]?.message).toBe(
      'Missing: tales-core:talent/gone (given by character:talent/wish#wish).',
    );
    expect(ids(result)).toContain('character:talent/wish');
    expect(ids(result)).not.toContain('tales-core:talent/gone');
    expect(result.grants.map(({ part }) => part)).toContain('character:talent/wish#wish');

    // Deep Lungs is in the pack: no warning, and still not gathered.
    const found = computed(wishing([boonOf('tales-core:talent/deep-lungs')]));
    expect(codes(found)).toEqual([brookMissing, ...ironWillUnmet]);
    expect(ids(found)).not.toContain('tales-core:talent/deep-lungs');
  });

  it('looks nothing up without namedIds, nor for a grant not reached', () => {
    const gone = wishing([boonOf('tales-core:talent/gone')]);
    const { namedIds: _, ...unnamed } = talesModule;
    expect(codes(computed(gone, unnamed))).toEqual([brookMissing, ...ironWillUnmet]);
    // Brook is level 3.
    expect(codes(computed(wishing([boonOf('tales-core:talent/gone', 4)])))).toEqual([
      brookMissing,
      ...ironWillUnmet,
    ]);
    const dormant: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      entities: (character, find, findKey, without) =>
        talesModule
          .entities(character, find, findKey, without)
          .map((entity) =>
            entity.id === 'character:talent/wish' ? { ...entity, dormant: true } : entity,
          ),
    };
    expect(codes(computed(gone, dormant))).toEqual([brookMissing, ...ironWillUnmet]);
    const leftOut: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      grantsOf: (_, entity) => (entity.id === 'character:talent/wish' ? [] : (entity.grants ?? [])),
    };
    expect(codes(computed(gone, leftOut))).toEqual([brookMissing, ...ironWillUnmet]);
  });

  it('warns once per id and place: a missing chosen id once, one id from two places twice', () => {
    const pick: GrantOf<TalesEntity> = {
      id: 'pick',
      kind: 'entity',
      choose: { count: 1, from: ['tales-core:talent/gone', 'tales-core:talent/deep-lungs'] },
    };
    const result = computed(
      wishing([boonOf('tales-core:talent/gone'), pick], {
        choices: { 'character:talent/wish#pick': ['tales-core:talent/gone'] },
      }),
    );
    expect(codes(result)).toEqual([
      brookMissing,
      { code: 'missing', id: 'tales-core:talent/gone', from: 'character:talent/wish#wish' },
      { code: 'missing', id: 'tales-core:talent/gone', from: 'character:talent/wish#pick' },
      ...ironWillUnmet,
    ]);
    expect(
      result.pendingChoices.map(({ part, chosen, options }) => [part, chosen, options]),
    ).toEqual([
      ['tales-core:calling/seeker#knacks', [], ['climb', 'sneak', 'steady']],
      ['character:talent/wish#pick', [], ['tales-core:talent/deep-lungs']],
    ]);

    const twice = computed(
      variant(brook, {
        systemData: {
          ...brook.systemData,
          talents: [...brook.systemData.talents, 'tales-core:talent/gone-missing'],
        },
      }),
    );
    expect(codes(twice)).toEqual([brookMissing, ...ironWillUnmet]);
  });

  it('is pure: frozen inputs give the result of unfrozen ones', () => {
    const gone = () => wishing([boonOf('tales-core:talent/gone')]);
    expect(computed(deepFreeze(gone()))).toEqual(computed(gone()));
  });
});

describe("ENG-35 a module's rules see the whole character", () => {
  /** Brook's one warning: a talent no pack has, named by the character (ENG-27). */
  const brookMissing = { code: 'missing', id: 'tales-core:talent/gone-missing', from: 'character' };

  it('gives `grantsOf` the finder gathering uses', () => {
    const lookedUp = [
      'tales-core:calling/seeker',
      'character:talent/lucky-charm',
      'tales-core:x/none',
    ];
    const found: (string | undefined)[][] = [];
    const looking: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      grantsOf: (_, entity, find) => {
        found.push(lookedUp.map((id) => find(id)?.name.en));
        return entity.grants ?? [];
      },
    };
    const result = computed(brook, looking);
    // Asked once per entity Brook has (ENG-13): four, each finding what Brook's packs hold.
    expect(found).toEqual(Array.from({ length: 4 }, () => ['Seeker', 'Lucky charm', undefined]));
    expect(result.values).toEqual(computed(brook).values);
  });

  it('warns what `ruleWarnings` gives as `characterRule`, after every other warning', () => {
    const ruled: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      ruleWarnings: ({ character, gathered }) => [
        {
          rule: 'entitiesCounted',
          data: { name: character.name, entities: gathered.entities.length },
          message: 'A rule made up here, given data.',
        },
        { rule: 'noData', message: 'A rule made up here, without data.' },
      ],
    };
    const result = computed(brook, ruled);
    expect(codes(result)).toEqual([
      brookMissing,
      ...ironWillUnmet,
      { code: 'characterRule', rule: 'entitiesCounted', data: { name: 'Brook', entities: 4 } },
      { code: 'characterRule', rule: 'noData' },
    ]);
    expect(result.warnings.map(({ message }) => message).slice(3)).toEqual([
      'A rule made up here, given data.',
      'A rule made up here, without data.',
    ]);
    expect(result.values).toEqual(computed(brook).values);
  });

  it('adds no warning for a module without `ruleWarnings`', () => {
    expect(talesModule.ruleWarnings).toBeUndefined();
    expect(codes(computed(brook))).toEqual([brookMissing, ...ironWillUnmet]);
  });
});

describe('ENG-62 an entry by its type and key', () => {
  /** A condition of the character's own, of every age. */
  const ownCondition = (name: string, key: string): TalesEntity => ({
    id: `character:condition/${key}-own` as EntityId,
    type: 'condition',
    key,
    ruleset: 'any',
    name: { en: name },
    source,
  });

  /** The id of the entry `character` finds by `type` and `key`. */
  const foundId = (character: TalesCharacter, type: string, key: string) =>
    keyFinderOf(character, index)(type, key)?.id;

  it("finds the rules base's entry, an every-age one, and nothing for a type or key no entry has", () => {
    expect(foundId(ash, 'skill', 'climb')).toBe('tales-core:skill/climb');
    expect(foundId(brook, 'skill', 'climb')).toBe('tales-core:skill/climb-anew');
    expect(foundId(ash, 'condition', 'lost')).toBe('tales-core:condition/lost');
    expect(foundId(brook, 'condition', 'lost')).toBe('tales-core:condition/lost');
    expect(foundId(ash, 'condition', 'gone')).toBeUndefined();
    expect(foundId(ash, 'skill', 'lost')).toBeUndefined();
  });

  it("finds another age's entry only when the character mixes rulesets", () => {
    // The seeker is second age only; Ash is first age.
    expect(foundId(ash, 'calling', 'seeker')).toBeUndefined();
    const mixing = variant(ash, { allowMixedRulesets: true });
    expect(foundId(mixing, 'calling', 'seeker')).toBe('tales-core:calling/seeker');
  });

  it("finds the character's own entries after its packs'", () => {
    const own = variant(ash, {
      localEntities: [ownCondition('Lost again', 'lost'), ownCondition('Dazed', 'dazed')],
    });
    expect(foundId(own, 'condition', 'lost')).toBe('tales-core:condition/lost');
    expect(foundId(own, 'condition', 'dazed')).toBe('character:condition/dazed-own');
  });

  it("gives the module's `entities` the finder: an entry it names by key is had", () => {
    const naming: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      entities: (character, find, findKey, without) => {
        const lost = findKey('condition', 'lost');
        return [
          ...talesModule.entities(character, find, findKey, without),
          ...(lost === undefined ? [] : [{ id: lost.id }]),
        ];
      },
    };
    const before = computed(ash);
    const after = computed(ash, naming);
    const lost = after.entities.find(({ entity }) => entity.id === 'tales-core:condition/lost');
    expect(lost?.from).toEqual(['character']);
    expect(ids(before)).not.toContain('tales-core:condition/lost');
    expect(after.values['conditions.lost.level']).toBe(1);
    expect(after.breakdown['conditions.lost.level']).toEqual([
      {
        kind: 'condition',
        source: 'tales-core:condition/lost',
        label: { en: 'Lost' },
        value: 1,
        change: 1,
      },
    ]);
    expect(after.values).toEqual({ ...before.values, 'conditions.lost.level': 1 });
    expect(after.warnings).toEqual(before.warnings);
  });
});

describe('SHEET-61 entities a module withholds', () => {
  const weary = 'tales-core:condition/weary';
  const lost = 'tales-core:condition/lost';
  const snaredId = 'character:condition/snared';

  /** A condition of the character's own that gives `lost`. */
  const snared: TalesEntity = {
    id: snaredId,
    type: 'condition',
    key: 'snared',
    ruleset: 'any',
    name: { en: 'Snared' },
    grants: [{ id: 'lose', kind: 'entity', fixed: [lost] }],
    source,
  };

  /** Tales' module, withholding these ids. */
  const withholding = (withheld: readonly string[]): SystemModule<TalesCharacter, TalesEntity> => ({
    ...talesModule,
    withheldEntities: () => withheld,
  });

  /** Ash with `snared` of its own, and these stored conditions. */
  const snaredAsh = (conditions: TalesCharacter['state']['conditions']) =>
    variant(ash, { localEntities: [snared], state: { ...ash.state, conditions } });

  /** Each withheld entity's id and where it was given. */
  const withheldOf = (result: Computed<TalesEntity>) =>
    result.withheld?.map(({ entity, from }) => [entity.id, from]);

  it('leaves a withheld condition out: its effects give nothing, its level reads 0', () => {
    const result = computed(ash, withholding([weary]));
    expect(ids(result)).not.toContain(weary);
    expect(withheldOf(result)).toEqual([[weary, ['character']]]);
    expect(result.values).toMatchObject({
      'conditions.weary.level': 0,
      'skills.all.bonus': 0,
      // Ash's, each without weary's -1: wits 2 + 2 × 1 + `shadow` 1.
      'skills.sneak.total': 5,
      // grit 3 + 2 × 1 + `nimble` 2.
      'skills.climb.total': 7,
      // nerve 1 + 2 × 0; passive 5 + 1.
      'skills.steady.total': 1,
      'skills.steady.passive': 6,
    });
    expect(result.breakdown['conditions.weary.level']).toEqual([]);
    // The stored condition is kept: it applies again once the module withholds it no more.
    expect(ash.state.conditions).toEqual([{ id: weary, level: 1 }]);
    expect(codes(result)).toEqual(codes(computed(ash)));
  });

  it("gives nothing of a withheld entity's grants, and names each place that gave it", () => {
    const both = snaredAsh([{ id: snaredId }, { id: lost }]);
    const noLost = computed(both, withholding([lost]));
    expect(ids(noLost)).toContain(snaredId);
    expect(ids(noLost)).not.toContain(lost);
    expect(withheldOf(noLost)).toEqual([[lost, [`${snaredId}#lose`, 'character']]]);
    expect(noLost.values['conditions.lost.level']).toBe(0);
    expect(noLost.values['conditions.snared.level']).toBe(1);

    // Withheld, `snared` gives no `lost`; the `lost` stored is had all the same.
    const noSnared = computed(both, withholding([snaredId]));
    expect(withheldOf(noSnared)).toEqual([[snaredId, ['character']]]);
    const had = noSnared.entities.find(({ entity }) => entity.id === lost);
    expect(had?.from).toEqual(['character']);
    expect(noSnared.values['conditions.lost.level']).toBe(1);
  });

  it('changes nothing without the hook, when it names none, or names an id no one gives', () => {
    expect(talesModule.withheldEntities).toBeUndefined();
    const plain = computed(ash);
    expect(plain).not.toHaveProperty('withheld');
    expect(computed(ash, withholding([]))).toEqual(plain);
    expect(computed(ash, withholding([lost, 'tales-core:condition/gone']))).toEqual(plain);
    // A missing id stored and withheld warns as any missing id does.
    const gone = variant(ash, {
      state: { ...ash.state, conditions: [{ id: 'tales-core:condition/gone' }] },
    });
    const result = computed(gone, withholding(['tales-core:condition/gone']));
    expect(result).not.toHaveProperty('withheld');
    expect(codes(result)).toEqual(codes(computed(gone)));
  });

  it('asks the module after each pass, until the ids it names are those left out', () => {
    const asked: [string[], unknown][] = [];
    const system: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      withheldEntities: (_, result) => {
        const left = result.withheld?.map(({ entity }) => entity.id) ?? [];
        asked.push([left, result.values['conditions.weary.level']]);
        return [weary, weary];
      },
    };
    const result = computed(ash, system);
    expect(asked).toEqual([
      [[], 1],
      [[weary], 0],
    ]);
    expect(result.values['skills.sneak.total']).toBe(5);
  });

  it('stops after its last pass, with a warning, when the ids never settle', () => {
    expect(MAX_COMPUTE_PASSES).toBe(8);
    let asked = 0;
    // Weary is withheld while it lowers the bonus, so each pass undoes the one before.
    const system: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      withheldEntities: (_, result) => {
        asked += 1;
        return result.values['skills.all.bonus'] === -1 ? [weary] : [];
      },
    };
    const result = computed(ash, system);
    expect(asked).toBe(8);
    // Passes 2, 4, 6 and 8 run without weary.
    expect(withheldOf(result)).toEqual([[weary, ['character']]]);
    expect(codes(result).at(-1)).toEqual({ code: 'withheldUnsettled', ids: [weary] });
  });
});

describe('SHEET-64 the entities hook gets what a pass leaves out', () => {
  it('gets none on the first pass, then the ids withheld', () => {
    const weary = 'tales-core:condition/weary';
    const seen: string[][] = [];
    const system: SystemModule<TalesCharacter, TalesEntity> = {
      ...talesModule,
      entities: (character, find, findKey, without) => {
        seen.push([...without]);
        return talesModule.entities(character, find, findKey, without);
      },
      withheldEntities: () => [weary],
    };
    computed(ash, system);
    expect(seen).toEqual([[], [weary]]);
  });
});
