import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  openFifthEditionCharacter,
  openFifthEditionPack,
  SIZE_PATH,
} from '../src/index.ts';
import { opened, standingIn } from './golden/checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenC2024,
  goldenD,
  srd2014,
  srd2024,
} from './golden/index.ts';

// ENG-48: the character's size. The rule is ENG-48 §8's: a species has one size, or offers
// several and the person chooses one when choosing the species. The goldens' sizes are their
// fixtures' (the 2014 dwarf: Medium; the 2024 human: Medium or Small, golden B storing Medium).
// The character's own entities (`character:`) are made up, no text of a book.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type Species = CharacterInput['systemData']['species'];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** A character opened as a file would be, then computed on its edition's pack. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  const one = opened(openFifthEditionCharacter(character));
  const { index } = one.ruleset === '2014' ? index2014 : index2024;
  return compute(one, index, standingIn);
}

/** A golden with another species entry, and entities of its own. */
function withSpecies(
  golden: CharacterInput,
  species: Species,
  change: Partial<CharacterInput> = {},
): Computed<FifthEditionEntity> {
  return computed({ ...golden, ...change, systemData: { ...golden.systemData, species } });
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

/** The step of a size an entity gives. */
function given(source: string, en: string, key: string) {
  return { kind: 'entity', source, label: { en }, key };
}

const DWARF = 'srd-2014:species/dwarf';
const HUMAN = 'srd-2024:species/human';
const source = { pack: 'character' };

describe('ENG-48 the size comes from the species', () => {
  it("gives each golden its species' size: one size, or the one stored", () => {
    for (const golden of [goldenA, goldenB, goldenB4, goldenD]) {
      const result = computed(golden);
      const step =
        golden === goldenA ? given(DWARF, 'Dwarf', 'medium') : given(HUMAN, 'Human', 'medium');
      expect(result.keys[SIZE_PATH]).toEqual({ key: 'medium', steps: [step] });
      expect(result.pendingKeys).toEqual([]);
      expect(result.warnings).toEqual([]);
    }
    for (const golden of [goldenC2014, goldenC2024]) {
      // No species: no size, and nothing to choose.
      const result = computed(golden);
      expect(result.keys[SIZE_PATH]).toBeUndefined();
      expect(result.pendingKeys).toEqual([]);
      expect(result.warnings).toEqual([]);
    }
  });

  it('of several sizes, takes the one stored; with none stored, the size is pending', () => {
    const small = withSpecies(goldenB, { id: HUMAN, size: 'small' });
    expect(small.keys[SIZE_PATH]).toEqual({
      key: 'small',
      steps: [given(HUMAN, 'Human', 'small')],
    });
    expect(small.pendingKeys).toEqual([]);

    const none = withSpecies(goldenB, { id: HUMAN });
    expect(none.keys[SIZE_PATH]).toBeUndefined();
    expect(none.pendingKeys).toEqual([{ path: SIZE_PATH, options: ['medium', 'small'] }]);
    expect(none.warnings).toEqual([]);
    // The other values do not read the size: golden B's speed and AC as before.
    expect(none.values).toMatchObject({ 'speed.walk': 30, 'ac.total': 17 });
  });

  it('warns of a stored size the species does not offer, and does not use it', () => {
    const large = withSpecies(goldenB, { id: HUMAN, size: 'large' });
    expect(large.keys[SIZE_PATH]).toBeUndefined();
    expect(large.pendingKeys).toEqual([{ path: SIZE_PATH, options: ['medium', 'small'] }]);
    expect(codes(large)).toEqual([
      {
        code: 'stepRule',
        path: SIZE_PATH,
        rule: 'sizeNotOffered',
        data: { size: 'large', from: HUMAN },
      },
    ]);

    // The dwarf's one size is used in its place.
    const dwarf = withSpecies(goldenA, { id: DWARF, size: 'small' });
    expect(dwarf.keys[SIZE_PATH]?.key).toBe('medium');
    expect(dwarf.pendingKeys).toEqual([]);
    expect(codes(dwarf)).toEqual([
      {
        code: 'stepRule',
        path: SIZE_PATH,
        rule: 'sizeNotOffered',
        data: { size: 'small', from: DWARF },
      },
    ]);
  });

  describe("a lineage's own sizes", () => {
    const kin: EntityInput = {
      id: 'character:species/kin',
      type: 'species',
      ruleset: 'any',
      name: { en: 'Kin' },
      source,
      size: ['medium', 'small'],
      speed: { walk: 30 },
      grants: [{ id: 'lineage', kind: 'entity', fixed: ['character:lineage/wee-kin'] }],
    };
    const weeKin: EntityInput = {
      id: 'character:lineage/wee-kin',
      type: 'lineage',
      ruleset: 'any',
      name: { en: 'Wee Kin' },
      source,
      size: ['small', 'tiny'],
    };
    const own = { localEntities: [kin, weeKin] };

    it("come before the species': its choice, pending, a warning", () => {
      const tiny = withSpecies(goldenC2024, { id: kin.id, size: 'tiny' }, own);
      expect(tiny.keys[SIZE_PATH]).toEqual({
        key: 'tiny',
        steps: [given(weeKin.id, 'Wee Kin', 'tiny')],
      });
      expect(tiny.pendingKeys).toEqual([]);
      expect(tiny.warnings).toEqual([]);

      const none = withSpecies(goldenC2024, { id: kin.id }, own);
      expect(none.pendingKeys).toEqual([{ path: SIZE_PATH, options: ['small', 'tiny'] }]);

      // Medium is the species', not the lineage's.
      const medium = withSpecies(goldenC2024, { id: kin.id, size: 'medium' }, own);
      expect(medium.keys[SIZE_PATH]).toBeUndefined();
      expect(codes(medium)).toEqual([
        {
          code: 'stepRule',
          path: SIZE_PATH,
          rule: 'sizeNotOffered',
          data: { size: 'medium', from: weeKin.id },
        },
      ]);
    });
  });

  describe('an effect or an override', () => {
    const shrink: EntityInput = {
      id: 'character:feat/shrink',
      type: 'feat',
      ruleset: 'any',
      name: { en: 'Shrink' },
      source,
      effects: [
        { id: 'small', target: SIZE_PATH, op: 'set', value: 'small' },
        { id: 'large', target: SIZE_PATH, op: 'set', value: 'large' },
        { id: 'add', target: SIZE_PATH, op: 'add', value: 1 },
      ],
    };
    const part = (id: string) => `${shrink.id}#${id}`;
    const setSmall = {
      kind: 'effect',
      part: part('small'),
      source: shrink.id,
      label: { en: 'Shrink' },
      key: 'small',
    };
    /** Golden B with the feat, its species entry and its overrides. */
    const shrunk = (species: Species, overrides: CharacterInput['overrides'] = []) =>
      computed({
        ...goldenB,
        localEntities: [shrink],
        overrides,
        systemData: { ...goldenB.systemData, species, feats: [{ id: shrink.id }] },
      });

    it("sets one of the species' sizes; another, or a number, warns", () => {
      const result = shrunk({ id: HUMAN, size: 'medium' });
      expect(result.keys[SIZE_PATH]).toEqual({
        key: 'small',
        steps: [given(HUMAN, 'Human', 'medium'), setSmall],
      });
      expect(codes(result)).toEqual([
        {
          code: 'unknownKey',
          part: part('large'),
          target: SIZE_PATH,
          key: 'large',
          keys: ['medium', 'small'],
        },
        { code: 'notAKey', part: part('add'), op: 'add', target: SIZE_PATH },
      ]);

      // With no size chosen, the effect gives one, and the choice stays to make.
      const none = shrunk({ id: HUMAN });
      expect(none.keys[SIZE_PATH]).toEqual({ key: 'small', steps: [setSmall] });
      expect(none.pendingKeys).toEqual([{ path: SIZE_PATH, options: ['medium', 'small'] }]);
    });

    it("wins when it names one of the species' sizes; another warns", () => {
      const result = shrunk({ id: HUMAN, size: 'small' }, [
        { path: SIZE_PATH, value: 'medium', note: 'Grown' },
      ]);
      expect(result.keys[SIZE_PATH]).toEqual({
        key: 'medium',
        steps: [
          given(HUMAN, 'Human', 'small'),
          setSmall,
          { kind: 'override', key: 'medium', note: 'Grown' },
        ],
      });

      const large = shrunk({ id: HUMAN, size: 'medium' }, [{ path: SIZE_PATH, value: 'large' }]);
      expect(large.keys[SIZE_PATH]?.key).toBe('small');
      expect(codes(large)).toContainEqual({
        code: 'overrideNotAKey',
        path: SIZE_PATH,
        value: 'large',
        keys: ['medium', 'small'],
      });
    });
  });

  it('stays pure: frozen inputs give equal results', () => {
    const character = deepFreeze(
      opened(
        openFifthEditionCharacter({
          ...goldenB,
          systemData: { ...goldenB.systemData, species: { id: HUMAN } },
        }),
      ),
    );
    const { index } = index2024;
    deepFreeze(index);
    expect(compute(character, index, standingIn)).toEqual(compute(character, index, standingIn));
  });
});

/** Freezes an object and everything in it. */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}
