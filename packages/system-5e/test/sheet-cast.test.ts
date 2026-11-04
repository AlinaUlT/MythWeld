import { compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import { fifthEditionModule, spellCastingStat } from '../src/index.ts';
import { indexOf, withTrackers } from './action-checks.ts';
import { goldenA, goldenC2014 } from './golden/index.ts';

// SHEET-47: the stat a spell is cast with. Golden A (2014): cleric 1, Wisdom. Golden C (2014): wizard
// 3 (Intelligence) and paladin 3 (Charisma), SRD 5.1's spellcasting abilities (ENG-15 §8).

const MAGIC_MISSILE = 'srd-2014:spell/magic-missile';
const SMITE = 'srd-2014:spell/divine-smite';
const BLESS = 'srd-2014:spell/bless';

/** Golden C with `spells` in the lists of its classes. */
const multiclass = () =>
  withTrackers(
    goldenC2014,
    {},
    {
      systemData: {
        ...goldenC2014.systemData,
        spells: {
          'srd-2014:class/wizard': { known: [MAGIC_MISSILE] },
          'srd-2014:class/paladin': { prepared: [SMITE] },
        },
      },
    },
  );

const statOf = (character: ReturnType<typeof multiclass>, spell: string) =>
  spellCastingStat(character, compute(character, indexOf(character), fifthEditionModule), spell);

describe('SHEET-47 the stat a spell is cast with', () => {
  it('is the stat of the class whose list holds the spell', () => {
    const c = multiclass();
    expect(statOf(c, MAGIC_MISSILE)).toBe('int');
    expect(statOf(c, SMITE)).toBe('cha');
  });

  it('is none for a spell in no list when two classes cast', () => {
    expect(statOf(multiclass(), BLESS)).toBeUndefined();
  });

  it('is the one casting class’s stat for a spell in no list', () => {
    const a = withTrackers(goldenA, {});
    expect(statOf(a, MAGIC_MISSILE)).toBe('wis');
  });

  it('is none for a character that casts nothing', () => {
    const c = withTrackers(
      goldenC2014,
      {},
      { systemData: { ...goldenC2014.systemData, classes: [] } },
    );
    expect(statOf(c, MAGIC_MISSILE)).toBeUndefined();
  });
});
