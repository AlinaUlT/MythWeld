import { type Computed, compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  ATTUNEMENT_LIMIT,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  fifthEditionModule,
} from '../src/index.ts';
import { type CharacterInput, frozen, indexOf, open } from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// SHEET-18: attunement past the limit warns. The rule is one in both SRDs (SHEET-18 §8), so each
// case runs on golden A (2014) and golden B (2024), whose own rows are none attuned. The charms
// (`character:`) are made up, no text of a book; each value was worked out by hand in the ticket,
// never copied from a run.

type EntityInput = FifthEditionCharacter['localEntities'][number];
type Row = CharacterInput['systemData']['inventory'][number];

const GOLDENS = [goldenA, goldenB];

/** A made-up charm that needs attunement and gives +1 AC. */
const charmOf = (n: number) =>
  ({
    id: `character:item/charm-${n}`,
    type: 'item',
    ruleset: 'any',
    name: { en: `Charm ${n}` },
    source: { pack: 'character' },
    category: 'gear',
    magic: { rarity: 'rare', attunement: true },
    effects: [{ id: 'ward', target: 'ac.bonus', op: 'add', value: 1 }],
  }) satisfies EntityInput;

const uid = (n: number) => `e1000000-0000-4000-8000-00000000000${n}`;

/** The row of charm `n`, equipped and attuned unless said otherwise. */
const charmRow = (n: number, attuned = true, equipped = true): Row => ({
  uid: uid(n),
  itemId: charmOf(n).id,
  qty: 1,
  equipped,
  attuned,
});

/** The golden with its own rows, then `rows`, and every charm as its own entity. */
const carrying = (golden: CharacterInput, rows: Row[]): CharacterInput => ({
  ...golden,
  localEntities: [1, 2, 3, 4, 5].map(charmOf),
  systemData: { ...golden.systemData, inventory: [...golden.systemData.inventory, ...rows] },
});

/** The character opened, computed on its edition's pack. */
const computed = (character: CharacterInput): Computed<FifthEditionEntity> => {
  const one = open(character);
  return compute(one, indexOf(one), fifthEditionModule);
};

/** The attunement warnings, without their log message. */
const limitWarnings = (result: Computed<FifthEditionEntity>) =>
  result.warnings.flatMap(({ message: _, ...warning }) =>
    warning.code === 'characterRule' && warning.rule === 'attunementLimit' ? [warning] : [],
  );

const PAST = (attuned: number) => ({
  code: 'characterRule',
  rule: 'attunementLimit',
  data: { attuned, limit: 3 },
});

describe('SHEET-18 attunement past the limit gives a warning', () => {
  it('has a limit of three', () => {
    expect(ATTUNEMENT_LIMIT).toBe(3);
  });

  it('gives no warning up to three attuned rows, in both editions', () => {
    for (const golden of GOLDENS) {
      expect(limitWarnings(computed(golden))).toEqual([]);
      expect(
        limitWarnings(
          computed(
            carrying(
              golden,
              [1, 2, 3].map((n) => charmRow(n)),
            ),
          ),
        ),
      ).toEqual([]);
    }
  });

  it('warns of a fourth, and the fourth still works, in both editions', () => {
    for (const golden of GOLDENS) {
      const none = computed(golden);
      const four = computed(
        carrying(
          golden,
          [1, 2, 3, 4].map((n) => charmRow(n)),
        ),
      );
      expect(limitWarnings(four)).toEqual([PAST(4)]);
      // Never a block: each of the four charms gives its +1 AC.
      expect(Number(four.values['ac.total']) - Number(none.values['ac.total'])).toBe(4);
      const message = four.warnings.find(
        (warning) => warning.code === 'characterRule' && warning.rule === 'attunementLimit',
      )?.message;
      expect(message).toBe('The character is attuned to 4 magic items; no more than 3 at a time.');
    }
  });

  it('counts five as five', () => {
    const five = computed(
      carrying(
        goldenB,
        [1, 2, 3, 4, 5].map((n) => charmRow(n)),
      ),
    );
    expect(limitWarnings(five)).toEqual([PAST(5)]);
  });

  it('counts only the rows attuned', () => {
    const rows = [charmRow(1), charmRow(2), charmRow(3), charmRow(4, false), charmRow(5, false)];
    expect(limitWarnings(computed(carrying(goldenB, rows)))).toEqual([]);
  });

  it('counts a row not equipped, a custom row and a row whose item is missing', () => {
    const custom: Row = {
      uid: uid(6),
      custom: { name: 'Lucky stone' },
      qty: 1,
      equipped: false,
      attuned: true,
    };
    const missing: Row = {
      uid: uid(7),
      itemId: 'character:item/lost',
      qty: 1,
      equipped: false,
      attuned: true,
    };
    const rows = [charmRow(1), charmRow(2, true, false), custom, missing];
    expect(limitWarnings(computed(carrying(goldenA, rows)))).toEqual([PAST(4)]);
  });

  it('neither throws nor changes a frozen character', () => {
    const one = open(
      carrying(
        goldenB,
        [1, 2, 3, 4].map((n) => charmRow(n)),
      ),
    );
    const copy = structuredClone(one);
    const result = compute(frozen(one), indexOf(one), fifthEditionModule);
    expect(limitWarnings(result)).toEqual([PAST(4)]);
    expect(one).toEqual(copy);
  });
});
