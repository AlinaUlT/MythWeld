import { compute, type LogStamp, loadContentIndex, reverseEntry } from '@grimoire/engine';
import { logEntrySchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  type LevelUpAsk,
  type LevelUpResult,
  levelUp,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenB4, srd2014, srd2024 } from './golden/index.ts';

// ENG-36: level-up as one log entry. Golden B (2024): fighter 1, a d10, CON 15 (+2), 12 of 12 hit
// points; a level's average is 10 / 2 + 1 = 6, so each one adds 6 + 2 = 8. Golden A (2014):
// cleric 1, a d8, CON 16 (+3), Dwarven Toughness +1 per level, 12 of 12; its average level adds
// 5 + 3 + 1 = 9. Golden B4's values are SPEC §6.7's; every other value was worked out by hand from
// these, never copied from a run. The feat `sturdy` is the character's own, made up.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

const indexOf = (character: FifthEditionCharacter) =>
  character.ruleset === '2014' ? index2014.index : index2024.index;

/** A character opened as a file would be. */
const open = (character: CharacterInput) => opened(openFifthEditionCharacter(character));

const stamp: LogStamp = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  at: '2026-10-02T20:00:00.000Z',
  by: { role: 'player', name: 'Wren' },
};

const FIGHTER = 'srd-2024:class/fighter';
const WIZARD = 'srd-2024:class/wizard';
const CHAMPION = 'srd-2024:subclass/champion';
const CLERIC = 'srd-2014:class/cleric';
const ASI_4 = 'srd-2024:class/fighter#ability-scores-4';
const KINDS = 'srd-2024:feature/fighter-weapon-mastery#kinds';
const KINDS_4 = 'srd-2024:feature/fighter-weapon-mastery#kinds-4';
const CLASSES = ['systemData', 'classes'];
const HP = ['systemData', 'state', 'hp', 'current'];

/** The level-up of `character` with `ask`, on its edition's pack. */
const up = (character: FifthEditionCharacter, ask: LevelUpAsk): LevelUpResult =>
  levelUp(character, indexOf(character), ask, stamp);

/** A level-up that happened: its entry parses, and its character opens unchanged. */
function done(result: LevelUpResult) {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  expect(logEntrySchema.parse(result.entry)).toEqual(result.entry);
  expect(open(result.character)).toEqual(result.character);
  return result;
}

/** A refusal without its log message, which must be there. */
function refused(result: LevelUpResult) {
  if (result.ok) throw new Error('The level-up happened.');
  const { ok: _, message, ...refusal } = result;
  expect(message).not.toBe('');
  return refusal;
}

/** Path → value, as `compute()` gives them for the character. */
function valuesOf(character: FifthEditionCharacter, paths: readonly string[]) {
  const { values } = compute(character, indexOf(character), fifthEditionModule);
  return Object.fromEntries(paths.map((path) => [path, values[path]]));
}

/** The character after `entry` is reversed on it. */
function reversed(character: FifthEditionCharacter, entry: Parameters<typeof reverseEntry>[1]) {
  const result = reverseEntry(character, entry);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.character;
}

/** Golden B with these current hit points, overrides and own entities. */
function goldenBWith(
  current: number,
  overrides: CharacterInput['overrides'] = [],
): FifthEditionCharacter {
  const state = { ...goldenB.systemData.state, hp: { current, temp: 0 } };
  return open({ ...goldenB, overrides, systemData: { ...goldenB.systemData, state } });
}

/** A copy of a JSON value. */
const jsonCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Freezes an object and everything in it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** A feat: 2 more hit points per level. */
const sturdy: EntityInput = {
  id: 'character:feat/sturdy',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Sturdy' },
  source: { pack: 'character' },
  effects: [{ id: 'hit-points', target: 'hp.max.bonus', op: 'add', value: '2 * @level' }],
};

describe('ENG-36 level-up', () => {
  const b = open(goldenB);
  const two = done(up(b, { class: FIGHTER, hp: 'avg' }));
  const three = done(up(two.character, { class: FIGHTER, hp: 'avg', subclass: CHAMPION }));
  const four = done(
    up(three.character, {
      class: FIGHTER,
      hp: 'avg',
      choices: { [ASI_4]: ['str'], [KINDS_4]: ['halberd'] },
    }),
  );

  it('raises the class a level, its hit points last, and the current ones by the rise', () => {
    const fighter2 = { id: FIGHTER, level: 2, hp: ['max', 'avg'] };
    expect(two.character.systemData.classes).toEqual([fighter2]);
    expect(two.entry).toEqual({
      ...stamp,
      action: 'levelUp',
      subject: FIGHTER,
      label: { en: 'Fighter' },
      changes: [
        { path: CLASSES, before: [{ id: FIGHTER, level: 1, hp: ['max'] }], after: [fighter2] },
        { path: HP, before: 12, after: 20 },
      ],
    });
    expect(valuesOf(two.character, ['level', 'hp.max'])).toEqual({ level: 2, 'hp.max': 20 });
  });

  it('takes golden B to golden B4 in three level-ups', () => {
    const currents = [two, three, four].map((each) => each.character.systemData.state.hp.current);
    expect(currents).toEqual([20, 28, 36]);
    expect(three.character.systemData.classes).toEqual([
      { id: FIGHTER, subclass: CHAMPION, level: 3, hp: ['max', 'avg', 'avg'] },
    ]);
    expect(four.entry.changes.map((change) => change.path)).toEqual([
      CLASSES,
      ['choices', ASI_4],
      ['choices', KINDS_4],
      HP,
    ]);
    const b4 = open(goldenB4);
    expect({ ...four.character, id: b4.id, name: b4.name }).toEqual(b4);
    // SPEC §6.7 B4: hit points 36 = 12 + 3 × (6 + 2); STR 19.
    expect(valuesOf(four.character, ['hp.max', 'abilities.str.score'])).toEqual({
      'hp.max': 36,
      'abilities.str.score': 19,
    });
  });

  it('is undone by reversing its entry, newest first, down to golden B', () => {
    expect(reversed(four.character, four.entry)).toEqual(three.character);
    expect(reversed(three.character, three.entry)).toEqual(two.character);
    expect(reversed(two.character, two.entry)).toEqual(b);
  });

  it('is not undone under a later level-up', () => {
    expect(reverseEntry(three.character, two.entry)).toMatchObject({
      ok: false,
      code: 'changed',
      path: CLASSES,
      expected: two.character.systemData.classes,
      found: three.character.systemData.classes,
    });
  });

  it("counts a per-level bonus in the rise, and keeps a class's spells", () => {
    const a = open(goldenA);
    const spells = { prepared: ['srd-2014:spell/cure-wounds' as const] };
    const result = done(up(a, { class: CLERIC, hp: 'avg', spells: { [CLERIC]: spells } }));
    expect(result.entry.changes).toEqual([
      {
        path: CLASSES,
        before: a.systemData.classes,
        after: [{ ...a.systemData.classes[0], level: 2, hp: ['max', 'avg'] }],
      },
      { path: ['systemData', 'spells', CLERIC], after: spells },
      // 12 + 5 + 3 + 1: the d8's average, CON, Dwarven Toughness's point for level 2.
      { path: HP, before: 12, after: 21 },
    ]);
    expect(valuesOf(result.character, ['hp.max'])).toEqual({ 'hp.max': 21 });
  });

  it('takes a roll or the maximum, and keeps the hit points lost', () => {
    const rolled = done(up(b, { class: FIGHTER, hp: 7 }));
    expect(rolled.character.systemData.classes[0]?.hp).toEqual(['max', 7]);
    // 12 + 7 + 2.
    expect(rolled.character.systemData.state.hp.current).toBe(21);
    // 12 + 10 + 2.
    expect(done(up(b, { class: FIGHTER, hp: 'max' })).character.systemData.state.hp.current).toBe(
      24,
    );
    // 5 of 12: 7 lost, still lost at 13 of 20.
    const hurt = done(up(goldenBWith(5), { class: FIGHTER, hp: 'avg' }));
    expect(hurt.entry.changes.at(-1)).toEqual({ path: HP, before: 5, after: 13 });
  });

  it('raises the current hit points in whole points, never below 0', () => {
    /** Golden B at `current` hit points with its own feat adding `formula` to the maximum. */
    const withFeat = (current: number, formula: string) => {
      const feat: EntityInput = {
        ...sturdy,
        id: 'character:feat/odd',
        effects: [{ id: 'hit-points', target: 'hp.max.bonus', op: 'add', value: formula }],
      };
      const state = { ...goldenB.systemData.state, hp: { current, temp: 0 } };
      const feats = [{ id: feat.id }];
      return open({
        ...goldenB,
        localEntities: [feat],
        systemData: { ...goldenB.systemData, feats, state },
      });
    };
    // Half a point per level: 12.5 → 21, a rise of 8.5; 12 + 8.5 = 20.5, so 20.
    const half = done(up(withFeat(12, '@level / 2'), { class: FIGHTER, hp: 'avg' }));
    expect(half.entry.changes.at(-1)).toEqual({ path: HP, before: 12, after: 20 });
    // Ten points off per level: 12 - 10 = 2 → 20 - 20 = 0, a rise of -2; 1 - 2 is below 0, so 0.
    const frail = done(up(withFeat(1, '0 - 10 * @level'), { class: FIGHTER, hp: 'avg' }));
    expect(frail.entry.changes.at(-1)).toEqual({ path: HP, before: 1, after: 0 });
  });

  it('leaves the current hit points when the maximum is overridden', () => {
    const fixed = goldenBWith(12, [{ path: 'hp.max', value: 30 }]);
    const result = done(up(fixed, { class: FIGHTER, hp: 'avg' }));
    expect(result.entry.changes.map((change) => change.path)).toEqual([CLASSES]);
    expect(result.character.systemData.state.hp.current).toBe(12);
    expect(valuesOf(result.character, ['hp.max'])).toEqual({ 'hp.max': 30 });
  });

  it('takes a new class last, at level 1', () => {
    const result = done(up(b, { class: WIZARD, hp: 'avg' }));
    expect(result.character.systemData.classes).toEqual([
      { id: FIGHTER, level: 1, hp: ['max'] },
      { id: WIZARD, level: 1, hp: ['avg'] },
    ]);
    expect(result.entry).toMatchObject({ subject: WIZARD, label: { en: 'Wizard' } });
    // 12 + 6 / 2 + 1 + 2.
    expect(valuesOf(result.character, ['level', 'hp.max'])).toEqual({ level: 2, 'hp.max': 18 });
    expect(result.character.systemData.state.hp.current).toBe(18);
  });

  it('takes a feat in place of an ability score improvement, after the feats it has', () => {
    const plain: EntityInput = { ...sturdy, id: 'character:feat/plain', effects: [] };
    const had = [{ id: plain.id }];
    const own = open({
      ...three.character,
      localEntities: [sturdy, plain],
      systemData: { ...three.character.systemData, feats: had },
    });
    const feats = [{ id: sturdy.id, replaces: ASI_4 }] as const;
    const result = done(up(own, { class: FIGHTER, hp: 'avg', feats }));
    expect(result.entry.changes).toEqual([
      expect.objectContaining({ path: CLASSES }),
      { path: ['systemData', 'feats'], before: had, after: [...had, ...feats] },
      // 28 + 8 for the level + 2 × 4 for the feat.
      { path: HP, before: 28, after: 44 },
    ]);
    expect(valuesOf(result.character, ['abilities.str.score', 'hp.max'])).toEqual({
      'abilities.str.score': 17,
      'hp.max': 44,
    });
  });

  it('keeps an earlier pick made again, and drops one that changes nothing', () => {
    const kinds = ['greatsword', 'greataxe', 'halberd'];
    const result = done(up(b, { class: FIGHTER, hp: 'avg', choices: { [KINDS]: kinds } }));
    expect(result.entry.changes[1]).toEqual({
      path: ['choices', KINDS],
      before: ['greatsword', 'greataxe', 'glaive'],
      after: kinds,
    });
    const same = { [KINDS]: ['greatsword', 'greataxe', 'glaive'] };
    const unchanged = done(up(b, { class: FIGHTER, hp: 'avg', choices: same }));
    expect(unchanged.entry.changes.map((change) => change.path)).toEqual([CLASSES, HP]);
  });

  it('refuses a level past 20', () => {
    const classes: CharacterInput['systemData']['classes'] = [
      { id: FIGHTER, level: 20, hp: ['max', ...Array.from({ length: 19 }, () => 'avg' as const)] },
    ];
    const top = open({ ...goldenB, systemData: { ...goldenB.systemData, classes } });
    expect(refused(up(top, { class: FIGHTER, hp: 'avg' }))).toEqual({
      code: 'maxLevel',
      level: 20,
    });
  });

  it('refuses an entity no pack has, or one of another type', () => {
    const nothing = 'srd-2024:class/nothing';
    expect(refused(up(b, { class: nothing, hp: 'avg' }))).toEqual({ code: 'missing', id: nothing });
    expect(refused(up(b, { class: CHAMPION, hp: 'avg' }))).toEqual({
      code: 'wrongType',
      id: CHAMPION,
      type: 'subclass',
      expected: 'class',
    });
    expect(refused(up(b, { class: FIGHTER, hp: 'avg', subclass: WIZARD }))).toEqual({
      code: 'wrongType',
      id: WIZARD,
      type: 'class',
      expected: 'subclass',
    });
    const noFeat = 'srd-2024:feat/nothing';
    expect(refused(up(b, { class: FIGHTER, hp: 'avg', feats: [{ id: noFeat }] }))).toEqual({
      code: 'missing',
      id: noFeat,
    });
    const feature = 'srd-2024:feature/fighter-second-wind';
    expect(refused(up(b, { class: FIGHTER, hp: 'avg', feats: [{ id: feature }] }))).toEqual({
      code: 'wrongType',
      id: feature,
      type: 'feature',
      expected: 'feat',
    });
  });

  it("refuses a roll the class's die cannot give", () => {
    for (const value of [11, 0, 1.5]) {
      expect(refused(up(b, { class: FIGHTER, hp: value }))).toEqual({
        code: 'badHitPoints',
        value,
        die: 10,
      });
    }
  });

  it("refuses another class's subclass, and a second subclass", () => {
    expect(refused(up(b, { class: WIZARD, hp: 'avg', subclass: CHAMPION }))).toEqual({
      code: 'otherClass',
      id: CHAMPION,
      classKey: 'fighter',
      expected: 'wizard',
    });
    const b4 = open(goldenB4);
    expect(refused(up(b4, { class: FIGHTER, hp: 'avg', subclass: CHAMPION }))).toEqual({
      code: 'hasSubclass',
      id: FIGHTER,
      subclass: CHAMPION,
    });
  });

  it('refuses a result the character schema refuses', () => {
    const result = refused(up(b, { class: FIGHTER, hp: 'avg', choices: { [ASI_4]: [] } }));
    expect(result).toMatchObject({ code: 'invalid' });
    const issues = 'issues' in result ? result.issues : [];
    expect(issues.map((issue) => issue.path)).toEqual([['choices', ASI_4]]);
  });

  it('changes nothing it is given', () => {
    const character = deepFreeze(jsonCopy(three.character));
    const ask: LevelUpAsk = deepFreeze({
      class: FIGHTER,
      hp: 'avg',
      choices: { [ASI_4]: ['str'], [KINDS_4]: ['halberd'] },
      feats: [{ id: 'srd-2024:feat/alert' }],
      spells: { [FIGHTER]: { known: ['srd-2024:spell/nothing'] } },
    });
    const copies = jsonCopy({ character, ask });
    const result = done(up(character, ask));
    expect(result.entry.changes).toHaveLength(6);
    expect({ character, ask }).toEqual(copies);
    expect(refused(up(character, { ...ask, hp: 11 }))).toMatchObject({ code: 'badHitPoints' });
    expect({ character, ask }).toEqual(copies);
  });
});
