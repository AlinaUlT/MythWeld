import { setCondition } from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import {
  type FifthEditionCharacter,
  INCAPACITATED_CONDITION,
  setConditionLevel,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  carrying,
  done,
  indexOf,
  ownSpell,
  refused,
  type SpellId,
  stamp,
  unattuned,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// SHEET-62: a set condition that leaves the character incapacitated ends its concentration in
// the same entry (both SRDs, SHEET-62 §8). Golden A (2014) concentrates on Bless, golden B (2024)
// on the made-up `ward`. The conditions and the feat are made up, names and numbers only: the
// Unconscious one grants the Incapacitated one, as both SRDs' Unconscious does (SHEET-17 §8).
// Every expected value was worked out by hand in SHEET-62.

type EntityInput = FifthEditionCharacter['localEntities'][number];

const source = { pack: 'character' };
const BLESS: SpellId = 'srd-2014:spell/bless';
const WARD = ownSpell('ward', 1, true);
const INCAPACITATED: EntityId = 'character:condition/incapacitated';
const UNCONSCIOUS: EntityId = 'character:condition/unconscious';
const DAZED: EntityId = 'character:condition/dazed';
const EXHAUSTION_2024: EntityId = 'srd-2024:condition/exhaustion';
const CONDITIONS = ['state', 'conditions'];

/** A made-up condition with this key, these effects and these grants. */
const condition = (key: string, grants: unknown[] = []): EntityInput =>
  ({
    id: `character:condition/${key}`,
    type: 'condition',
    key,
    ruleset: 'any',
    name: { en: key },
    source,
    grants,
  }) as EntityInput;

const incapacitated = condition(INCAPACITATED_CONDITION);
/** The Unconscious condition, granting the Incapacitated one, or nothing. */
const unconscious = (grants: boolean) =>
  condition('unconscious', grants ? [{ id: 'inert', kind: 'entity', fixed: [INCAPACITATED] }] : []);
const dazed = condition('dazed');

/** A made-up feat: immune to the Incapacitated condition. */
const steady = {
  id: 'character:feat/steady',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'steady' },
  source,
  effects: [
    { id: 'no-inert', target: 'defenses.conditionImmune', op: 'append', value: 'incapacitated' },
  ],
} as EntityInput;

const OWN = [incapacitated, unconscious(true), dazed];

/** `golden` concentrating on `spell`, with these own entities, storing `stored`. */
const holding = (
  golden: CharacterInput,
  spell: SpellId | undefined,
  own: EntityInput[] = OWN,
  stored: EntityId[] = [],
  feats: EntityInput[] = [],
) =>
  withTrackers(golden, spell === undefined ? {} : { concentration: spell }, {
    localEntities: [...own, ...feats, ...(golden === goldenB ? [WARD] : [])],
    state: { ...golden.state, conditions: stored.map((id) => ({ id })) },
    systemData: { ...golden.systemData, feats: feats.map(({ id }) => ({ id })) },
  });

/** The module's set on `character`, and the core's. */
const setBoth = (character: FifthEditionCharacter, ask: { id: string; level?: number }) => ({
  module: setConditionLevel(character, indexOf(character), ask, stamp),
  core: setCondition(character, indexOf(character), ask, stamp),
});

/** The change to the stored conditions from `before` to `after`. */
const stored = (before: EntityId[], after: EntityId[]) => ({
  path: CONDITIONS,
  before: before.map((id) => ({ id })),
  after: after.map((id) => ({ id })),
});

describe('SHEET-62 gaining the Incapacitated condition ends concentration', () => {
  for (const [golden, spell] of [
    [goldenA, BLESS],
    [goldenB, WARD.id as SpellId],
  ] as const) {
    it(`${golden.ruleset}: ends it when the Incapacitated condition is set`, () => {
      const character = holding(golden, spell);
      const result = done(character, setBoth(character, { id: INCAPACITATED }).module);
      expect(result.entry).toMatchObject({ action: 'setCondition', subject: INCAPACITATED });
      expect(result.entry.changes).toEqual([
        stored([], [INCAPACITATED]),
        { path: CONCENTRATION, before: spell },
      ]);
      expect(result.character.systemData.state.concentration).toBeUndefined();
    });

    it(`${golden.ruleset}: ends it when a condition that grants it is set`, () => {
      const character = holding(golden, spell);
      const result = done(character, setBoth(character, { id: UNCONSCIOUS }).module);
      expect(result.entry.changes).toEqual([
        stored([], [UNCONSCIOUS]),
        { path: CONCENTRATION, before: spell },
      ]);
    });
  }

  it('gives the core result when the condition set does not incapacitate', () => {
    const character = holding(goldenA, BLESS);
    const plain = setBoth(character, { id: DAZED });
    expect(plain.module).toEqual(plain.core);
    const pack = holding(goldenA, BLESS, [incapacitated, unconscious(false)]);
    const asleep = setBoth(pack, { id: UNCONSCIOUS });
    expect(asleep.module).toEqual(asleep.core);
  });

  it('gives the core result when the character concentrates on nothing', () => {
    const character = holding(goldenA, undefined);
    const result = setBoth(character, { id: INCAPACITATED });
    expect(result.module).toEqual(result.core);
  });

  it('keeps it when the character is immune to the Incapacitated condition', () => {
    const character = holding(goldenA, BLESS, OWN, [], [steady]);
    const result = setBoth(character, { id: INCAPACITATED });
    expect(result.module).toEqual(result.core);
    expect(result.module.ok && result.module.character.systemData.state.concentration).toBe(BLESS);
  });

  it('ends it held while already incapacitated, on any condition set', () => {
    // A cast while incapacitated warns and happens (SHEET-17), so the two can be stored together.
    const character = holding(goldenA, BLESS, OWN, [INCAPACITATED]);
    const result = done(character, setBoth(character, { id: DAZED }).module);
    expect(result.entry.changes).toEqual([
      stored([INCAPACITATED], [INCAPACITATED, DAZED]),
      { path: CONCENTRATION, before: BLESS },
    ]);
  });

  it('ends it before the attunements when the level also kills', () => {
    const conditions = [{ id: INCAPACITATED }, { id: EXHAUSTION_2024, level: 5 }];
    const character = carrying(goldenB, { concentration: WARD.id as SpellId }, true, {
      localEntities: [...OWN, WARD],
      state: { ...goldenB.state, conditions },
    });
    const result = done(character, setBoth(character, { id: EXHAUSTION_2024, level: 6 }).module);
    expect(result.entry.changes).toEqual([
      {
        path: CONDITIONS,
        before: conditions,
        after: [{ id: INCAPACITATED }, { id: EXHAUSTION_2024, level: 6 }],
      },
      { path: CONCENTRATION, before: WARD.id },
      unattuned(goldenB),
    ]);
  });

  it('keeps the core refusals', () => {
    const character = holding(goldenA, BLESS, OWN, [INCAPACITATED]);
    const again = setConditionLevel(character, indexOf(character), { id: INCAPACITATED }, stamp);
    expect(refused(again)).toEqual({ code: 'unchanged' });
  });
});
