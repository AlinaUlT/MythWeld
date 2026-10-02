import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  ATTACK_SPELL_BONUS_PATH,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionEntitySchema,
  fifthEditionModule,
  grantCastingStat,
  openFifthEditionCharacter,
  openFifthEditionPack,
  statSpellPath,
} from '../src/index.ts';
import { cantrip } from './entities.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, goldenE, hbLocal, srd2014, srd2024 } from './golden/index.ts';

// ENG-51: a spell a grant gives with its own stat has that stat's save DC and attack bonus. The
// rule is ENG-51 §8's: both SRDs' "8 + your spellcasting ability modifier + your proficiency
// bonus", which names no class. The feats (`character:`) are made up, no text of a book; each
// value below was worked out by hand from the goldens' scores, never copied from a run.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type Grants = NonNullable<Extract<EntityInput, { type: 'feat' }>['grants']>;
type Effects = NonNullable<EntityInput['effects']>;

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(openFifthEditionPack(srd2024)),
  opened(openFifthEditionPack(hbLocal)),
]);

/** A character opened as a file would be, computed on its edition's packs; breakdowns add up. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  const one = opened(openFifthEditionCharacter(character));
  const { index } = one.ruleset === '2014' ? index2014 : index2024;
  const result = compute(one, index, fifthEditionModule);
  for (const [path, steps] of Object.entries(result.breakdown)) {
    const sum = steps.reduce((total, step) => total + step.change, 0);
    expect(sum, path).toBe(result.values[path]);
  }
  return result;
}

/** Path → value for every stat's spell DC and attack. */
function statCasting(result: Computed<FifthEditionEntity>) {
  return Object.fromEntries(
    Object.entries(result.values).filter(([path]) => /^abilities\.[^.]+\.spell\./.test(path)),
  );
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

/** A made-up feat with these grants and effects. */
function feat(grants: Grants, effects: Effects = []): EntityInput {
  return {
    id: 'character:feat/gifted',
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Gifted' },
    source: { pack: 'character' },
    grants,
    ...(effects.length > 0 && { effects }),
  };
}

/** A golden character that has the feat, given by hand, and these local entities beside it. */
function withFeat(
  golden: CharacterInput,
  gifted: EntityInput,
  others: EntityInput[] = [],
): CharacterInput {
  return {
    ...golden,
    localEntities: [gifted, ...others],
    systemData: {
      ...golden.systemData,
      feats: [...golden.systemData.feats, { id: 'character:feat/gifted' }],
    },
  };
}

const bless = 'srd-2014:spell/bless';
const cureWounds = 'srd-2014:spell/cure-wounds';

/** A `spell` grant of golden A's fixture spells, cast with `ability`. */
const spells = (id: string, ability?: string, atLevel?: number): Grants[number] => ({
  id,
  kind: 'spell',
  fixed: [id === 'lore' ? cureWounds : bless],
  ...(ability !== undefined && { ability }),
  ...(atLevel !== undefined && { atLevel }),
});

describe("ENG-51 a granted spell's casting numbers", () => {
  it('names where a grant casts: its own stat, none without one or for another kind', () => {
    expect(grantCastingStat({ id: 'charm', kind: 'spell', fixed: [bless], ability: 'cha' })).toBe(
      'cha',
    );
    expect(grantCastingStat({ id: 'plain', kind: 'spell', fixed: [bless] })).toBeUndefined();
    expect(
      grantCastingStat({ id: 'skills', kind: 'proficiency', category: 'skill', fixed: ['arcana'] }),
    ).toBeUndefined();
    expect(statSpellPath('san')).toBe('abilities.san.spell');
    expect(ATTACK_SPELL_BONUS_PATH).toBe('attack.spell.bonus');
  });

  it("gives each stat a grant names its DC and attack, once, by the class's rule", () => {
    // Golden A: CHA 12 → +1, INT 8 → −1, level 1 → +2.
    const a = computed(
      withFeat(
        goldenA,
        feat([
          spells('charm', 'cha'),
          spells('lore', 'int'),
          spells('again', 'cha'),
          spells('later', 'str', 3),
          spells('plain'),
        ]),
      ),
    );
    expect(statCasting(a)).toEqual({
      'abilities.cha.spell.dc': 11,
      'abilities.cha.spell.attack': 3,
      'abilities.int.spell.dc': 9,
      'abilities.int.spell.attack': 1,
    });
    expect(a.breakdown['abilities.cha.spell.dc']).toEqual([
      { kind: 'rule', rule: 'spellDcBase', value: 8, change: 8 },
      { kind: 'path', path: 'abilities.cha.mod', value: 1, change: 1 },
      { kind: 'path', path: 'prof', value: 2, change: 2 },
      { kind: 'path', path: 'spell.dc.bonus', value: 0, change: 0 },
    ]);
    expect(a.breakdown['abilities.int.spell.attack']).toEqual([
      { kind: 'path', path: 'abilities.int.mod', value: -1, change: -1 },
      { kind: 'path', path: 'prof', value: 2, change: 2 },
      { kind: 'path', path: 'spell.attack.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'attack.spell.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'd20.all.bonus', value: 0, change: 0 },
    ]);
    // The cleric's own numbers stay: WIS 16 → +3; DC 13, attack +5.
    expect(a.values['classes.cleric.spell.dc']).toBe(13);
    expect(a.values['classes.cleric.spell.attack']).toBe(5);
    expect(a.warnings).toEqual([]);
  });

  it('gives a grant at a level the character has not reached nothing, until it is reached', () => {
    // Golden A is level 1; the grant comes at 3. Golden A at cleric 3: STR 13 → +1, +2.
    const late = feat([spells('later', 'str', 3)]);
    expect(statCasting(computed(withFeat(goldenA, late)))).toEqual({});
    const cleric3: CharacterInput = {
      ...goldenA,
      systemData: {
        ...goldenA.systemData,
        classes: [
          {
            id: 'srd-2014:class/cleric',
            subclass: 'srd-2014:subclass/life',
            level: 3,
            hp: ['max', 'avg', 'avg'],
          },
        ],
      },
    };
    expect(statCasting(computed(withFeat(cleric3, late)))).toEqual({
      'abilities.str.spell.dc': 11,
      'abilities.str.spell.attack': 3,
    });
  });

  it('reads a stat the character lacks as 0, and its own stat once a pack has it', () => {
    const sanity = feat([{ id: 'spark', kind: 'spell', fixed: [bless], ability: 'san' }]);
    // Golden A has no SAN: 8 + 0 + 2, 0 + 2.
    const a = computed(withFeat(goldenA, sanity));
    expect(statCasting(a)).toEqual({
      'abilities.san.spell.dc': 10,
      'abilities.san.spell.attack': 2,
    });
    expect(codes(a)).toEqual([
      { code: 'missingPath', path: 'abilities.san.mod', for: 'abilities.san.spell.dc' },
      { code: 'missingPath', path: 'abilities.san.mod', for: 'abilities.san.spell.attack' },
    ]);
    // Golden E: SAN 14 → +2 (hb-local), level 1 → +2: 8 + 2 + 2, 2 + 2.
    const ember = fifthEditionEntitySchema.parse({
      ...cantrip,
      id: 'character:spell/ember-spark',
      source: { pack: 'character' },
    });
    const e = computed(
      withFeat(goldenE, feat([{ id: 'spark', kind: 'spell', fixed: [ember.id], ability: 'san' }]), [
        ember,
      ]),
    );
    expect(statCasting(e)).toEqual({
      'abilities.san.spell.dc': 12,
      'abilities.san.spell.attack': 4,
    });
    expect(e.warnings).toEqual([]);
  });

  it("adds the bonus targets to a stat's numbers and attack.spell.bonus to a class's attack", () => {
    const focused = feat(
      [spells('charm', 'cha')],
      [
        { id: 'dc', target: 'spell.dc.bonus', op: 'add', value: 1 },
        { id: 'attack', target: 'spell.attack.bonus', op: 'add', value: 2 },
        { id: 'roll', target: 'attack.spell.bonus', op: 'add', value: 1 },
        { id: 'd20', target: 'd20.all.bonus', op: 'add', value: -1 },
      ],
    );
    const a = computed(withFeat(goldenA, focused));
    // CHA: 11 + 1; 1 + 2 + 2 + 1 − 1. The cleric: 13 + 1; 3 + 2 + 2 + 1 − 1.
    expect(statCasting(a)).toEqual({
      'abilities.cha.spell.dc': 12,
      'abilities.cha.spell.attack': 5,
    });
    expect(a.values['classes.cleric.spell.dc']).toBe(14);
    expect(a.values['classes.cleric.spell.attack']).toBe(7);
    expect(a.breakdown['classes.cleric.spell.attack']?.slice(2)).toEqual([
      { kind: 'path', path: 'spell.attack.bonus', value: 2, change: 2 },
      { kind: 'path', path: 'attack.spell.bonus', value: 1, change: 1 },
      { kind: 'path', path: 'd20.all.bonus', value: -1, change: -1 },
    ]);
    expect(a.warnings).toEqual([]);
  });

  it("lets an override of a stat's DC win, and leaves its attack alone", () => {
    const a = computed({
      ...withFeat(goldenA, feat([spells('charm', 'cha')])),
      overrides: [{ path: 'abilities.cha.spell.dc', value: 15 }],
    });
    expect(statCasting(a)).toEqual({
      'abilities.cha.spell.dc': 15,
      'abilities.cha.spell.attack': 3,
    });
    expect(a.breakdown['abilities.cha.spell.dc']?.at(-1)).toMatchObject({ kind: 'override' });
  });

  it('gives every character attack.spell.bonus, and no stat numbers without such a grant', () => {
    const b = computed(goldenB);
    expect(b.values['attack.spell.bonus']).toBe(0);
    expect(b.breakdown['attack.spell.bonus']).toEqual([]);
    expect(statCasting(b)).toEqual({});
    expect(statCasting(computed(goldenA))).toEqual({});
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const input = withFeat(goldenA, feat([spells('charm', 'cha'), spells('lore', 'int')]));
    const character = opened(openFifthEditionCharacter(input));
    const frozen = opened(openFifthEditionCharacter(input));
    const freeze = <T>(value: T): T => {
      if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const inner of Object.values(value)) freeze(inner);
      }
      return value;
    };
    freeze(frozen);
    const first = compute(frozen, index2014.index, fifthEditionModule);
    expect(compute(frozen, index2014.index, fifthEditionModule)).toEqual(first);
    expect(first).toEqual(compute(character, index2014.index, fifthEditionModule));
  });
});
