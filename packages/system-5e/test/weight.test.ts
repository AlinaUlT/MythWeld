import { type Computed, compute } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  CARRIED_PATH,
  containedWeightPath,
  type FifthEditionEntity,
  fifthEditionModule,
  rowWeightPath,
} from '../src/index.ts';
import { type CharacterInput, indexOf, open } from './action-checks.ts';
import { goldenA, goldenB } from './golden/index.ts';

// SHEET-50: what the inventory weighs. Golden B carries chain mail (55 lb) and a greatsword (6 lb);
// golden A (2014) its own rows. The packs' weights are the SRDs' (SHEET-50 §8). The rows added
// here are custom rows with made-up weights, each total worked out by hand in the ticket, never
// copied from a run.

type Row = CharacterInput['systemData']['inventory'][number];

const uid = (n: number) => `a5000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

/** A custom row: `name`, what one weighs (none when `undefined`), how many, where it is. */
const custom = (n: number, weight: number | undefined, qty: number, container?: number): Row => ({
  uid: uid(n),
  custom: { name: `Thing ${n}`, ...(weight !== undefined && { weight }) },
  qty,
  equipped: false,
  attuned: false,
  ...(container !== undefined && { container: uid(container) }),
});

const carrying = (golden: CharacterInput, rows: Row[]): CharacterInput => ({
  ...golden,
  systemData: { ...golden.systemData, inventory: [...golden.systemData.inventory, ...rows] },
});

/** Computed, with every breakdown adding up to its value. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  const one = open(character);
  const result = compute(one, indexOf(one), fifthEditionModule);
  for (const [path, steps] of Object.entries(result.breakdown)) {
    expect(
      steps.reduce((total, step) => total + step.change, 0),
      path,
    ).toBe(result.values[path]);
  }
  return result;
}

const CHAIN_MAIL = '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c';
const GREATSWORD = '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d';

describe('SHEET-50 what the inventory weighs', () => {
  it("weighs golden B's chain mail and greatsword by the pack's weights", () => {
    const result = computed(goldenB);
    expect(result.values[rowWeightPath(CHAIN_MAIL)]).toBe(55);
    expect(result.values[rowWeightPath(GREATSWORD)]).toBe(6);
    expect(result.values[CARRIED_PATH]).toBe(61);
    expect(result.breakdown[rowWeightPath(CHAIN_MAIL)]).toEqual([
      {
        kind: 'entity',
        source: 'srd-2024:item/chain-mail',
        label: { en: 'Chain Mail' },
        value: 55,
        change: 55,
      },
    ]);
    expect(result.breakdown[CARRIED_PATH]?.map((step) => step.change)).toEqual([55, 6]);
  });

  it('weighs a quantity: one weight a step, the weight times the count its change', () => {
    const result = computed(carrying(goldenB, [custom(1, 2, 3)]));
    expect(result.values[rowWeightPath(uid(1))]).toBe(6);
    expect(result.breakdown[rowWeightPath(uid(1))]).toEqual([
      { kind: 'base', value: 2, change: 6 },
    ]);
    expect(result.values[CARRIED_PATH]).toBe(67);
  });

  it('weighs nothing it does not know: no weight, no count, an item no pack has', () => {
    const missing: Row = {
      uid: uid(4),
      itemId: 'character:item/not-here',
      qty: 1,
      equipped: false,
      attuned: false,
    };
    const result = computed(carrying(goldenB, [custom(1, undefined, 1), custom(2, 5, 0), missing]));
    expect(result.values[rowWeightPath(uid(1))]).toBe(0);
    expect(result.values[rowWeightPath(uid(2))]).toBe(0);
    expect(result.values[rowWeightPath(uid(4))]).toBe(0);
    expect(result.breakdown[rowWeightPath(uid(2))]).toEqual([]);
    expect(result.values[CARRIED_PATH]).toBe(61);
  });

  it('weighs a container by what is inside it, each row inside still carried once', () => {
    // Row 1 a backpack (5 lb). In it, row 2 a pouch (1 lb) and row 4 rations (2 lb each, 3 of
    // them). In the pouch, row 3 gems (0.5 lb each, 4 of them). Rows: 5, 1, 2, 6. The pouch holds
    // 2. The backpack holds the pouch 1, what the pouch holds 2, the rations 6: 9.
    // Carried: 61 + 5 + 1 + 2 + 6 = 75.
    const rows = [custom(1, 5, 1), custom(2, 1, 1, 1), custom(3, 0.5, 4, 2), custom(4, 2, 3, 1)];
    const result = computed(carrying(goldenB, rows));
    expect([1, 2, 3, 4].map((n) => result.values[rowWeightPath(uid(n))])).toEqual([5, 1, 2, 6]);
    expect(result.values[containedWeightPath(uid(2))]).toBe(2);
    expect(result.values[containedWeightPath(uid(1))]).toBe(9);
    expect(result.breakdown[containedWeightPath(uid(1))]?.map((step) => step.change)).toEqual([
      1, 2, 6,
    ]);
    expect(result.values[CARRIED_PATH]).toBe(75);
    // Only a row something is inside has a contents path.
    expect(Object.hasOwn(result.values, containedWeightPath(uid(3)))).toBe(false);
  });

  it('follows golden A the same way, and a manual override wins', () => {
    const base = carrying(goldenA, [custom(1, 10, 1)]);
    const before = computed(base);
    expect(before.values[rowWeightPath(uid(1))]).toBe(10);
    const over = computed({ ...base, overrides: [{ path: CARRIED_PATH, value: 30 }] });
    expect(over.values[CARRIED_PATH]).toBe(30);
  });
});
