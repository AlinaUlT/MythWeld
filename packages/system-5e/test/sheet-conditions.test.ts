import { type Computed, compute, finderOf, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  conditionsToAdd,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  fatalLevelOf,
  type fifthEditionCharacterSchema,
  fifthEditionConditions,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
  removeConditionOf,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenC2014, goldenC2024, srd2014, srd2024 } from './golden/index.ts';

// SHEET-42: what the sheet names of the conditions. Golden C (level 6, both editions) with
// conditions of the character's own, made up (a name and a number, no text of a book), and the
// golden 2024 pack's Exhaustion (maxLevel 6, ENG-10). Every expected value was worked out by hand.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = CharacterInput['localEntities'][number];
type Stored = CharacterInput['state']['conditions'];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);
const source = { pack: 'character' };

const EXHAUSTION = 'srd-2024:condition/exhaustion';

function withOwn(
  golden: CharacterInput,
  localEntities: EntityInput[],
  conditions: Stored,
): FifthEditionCharacter {
  const character = {
    ...golden,
    localEntities,
    state: { ...golden.state, conditions, toggles: {} },
    systemData: {
      ...golden.systemData,
      feats: localEntities.flatMap(({ id, type }) => (type === 'feat' ? [{ id }] : [])),
    },
  };
  return opened(openFifthEditionCharacter(character));
}

function shownOf(character: FifthEditionCharacter) {
  const index = (character.ruleset === '2014' ? index2014 : index2024).index;
  const computed: Computed<FifthEditionEntity> = compute(character, index, fifthEditionModule);
  return fifthEditionConditions(character, computed, finderOf(character, index));
}

const condition = (key: string, grants: unknown[] = []): EntityInput =>
  ({
    id: `character:condition/${key}`,
    type: 'condition',
    key,
    ruleset: 'any',
    name: { en: key },
    source,
    effects: [],
    grants,
  }) as EntityInput;

const calm = {
  id: 'character:feat/calm',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'calm' },
  source,
  effects: [{ id: 'no-dazed', target: 'defenses.conditionImmune', op: 'append', value: 'dazed' }],
} as EntityInput;

const dazed = condition('dazed');
const DAZED = 'character:condition/dazed';

const stamp = {
  id: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  at: '2026-11-04T10:00:00.000Z',
  by: { role: 'player', name: 'Wren' },
} as const;

describe('SHEET-42 the conditions the sheet shows', () => {
  it('shows none for a character that has none', () => {
    expect(shownOf(withOwn(goldenC2014, [], []))).toEqual({ had: [], missing: [] });
  });

  it('shows a stored condition with no levels at level 1, stored', () => {
    expect(shownOf(withOwn(goldenC2014, [dazed], [{ id: DAZED }])).had).toEqual([
      { id: DAZED, level: 1, max: 1, stored: true, givenBy: [], withheld: false, fatal: false },
    ]);
  });

  it('shows exhaustion at its stored level out of 6, death only at 6 (ENG-67)', () => {
    const at = (level: number) => shownOf(withOwn(goldenC2024, [], [{ id: EXHAUSTION, level }]));
    expect(at(2).had).toEqual([
      {
        id: EXHAUSTION,
        level: 2,
        max: 6,
        stored: true,
        givenBy: [],
        withheld: false,
        fatal: false,
      },
    ]);
    expect(at(5).had[0]?.fatal).toBe(false);
    expect(at(6).had[0]).toMatchObject({ level: 6, fatal: true });
  });

  it('knows exhaustion is the condition whose highest level is death', () => {
    const find = finderOf(withOwn(goldenC2024, [], []), index2024.index);
    const exhaustion = find(EXHAUSTION);
    expect(exhaustion && fatalLevelOf(exhaustion)).toBe(6);
    expect(fatalLevelOf(dazed as FifthEditionEntity)).toBeUndefined();
  });

  it('shows a condition another entry gives as not stored, with what gives it', () => {
    const reeling = condition('reeling', [
      { id: 'give', kind: 'entity', fixed: ['character:condition/incapacitated'] },
    ]);
    const incapacitated = condition('incapacitated');
    const shown = shownOf(
      withOwn(goldenC2014, [reeling, incapacitated], [{ id: 'character:condition/reeling' }]),
    );
    expect(shown.had.map(({ id, stored, givenBy }) => [id, stored, givenBy])).toEqual([
      ['character:condition/reeling', true, []],
      ['character:condition/incapacitated', false, ['character:condition/reeling']],
    ]);
  });

  it('marks a condition the character is immune to as without effect, still stored', () => {
    const shown = shownOf(withOwn(goldenC2014, [calm, dazed], [{ id: DAZED }]));
    expect(shown.had).toEqual([
      { id: DAZED, level: 1, max: 1, stored: true, givenBy: [], withheld: true, fatal: false },
    ]);
  });

  it('names a stored condition no entry holds as missing', () => {
    const shown = shownOf(withOwn(goldenC2014, [], [{ id: 'srd-2014:condition/nothing' }]));
    expect(shown).toEqual({ had: [], missing: ['srd-2014:condition/nothing'] });
  });

  it('offers the conditions not stored yet: own first, then the packs', () => {
    const own = withOwn(goldenC2024, [dazed], []);
    expect(conditionsToAdd(own, index2024.index).map(({ id }) => id)).toEqual([DAZED, EXHAUSTION]);
    const stored = withOwn(goldenC2024, [dazed], [{ id: DAZED }, { id: EXHAUSTION, level: 1 }]);
    expect(conditionsToAdd(stored, index2024.index)).toEqual([]);
  });

  it('ends a stored condition, whether or not a pack still has it', () => {
    const stored = withOwn(
      goldenC2024,
      [dazed],
      [{ id: DAZED }, { id: 'srd-2024:condition/gone' }],
    );
    const index = index2024.index;
    const ended = removeConditionOf(stored, index, { id: DAZED }, stamp);
    expect(ended.ok && ended.entry).toMatchObject({ action: 'removeCondition', subject: DAZED });
    expect(ended.ok && ended.character.state.conditions).toEqual([
      { id: 'srd-2024:condition/gone' },
    ]);
    const gone = removeConditionOf(stored, index, { id: 'srd-2024:condition/gone' }, stamp);
    expect(gone.ok && gone.character.state.conditions).toEqual([{ id: DAZED }]);
    expect(removeConditionOf(stored, index, { id: EXHAUSTION }, stamp)).toMatchObject({
      ok: false,
      code: 'unchanged',
    });
  });
});
