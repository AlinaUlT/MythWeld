import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  equipmentOf,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  needsAttunement,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2014, srd2024 } from './golden/index.ts';

// ENG-44: what equipped items count as. The rules are ENG-44 §8's. The items (`character:`) are
// made up, no text of a book; each value below was worked out by hand from them and golden B's
// data, never copied from a run. Golden B (2024): DEX 13 (+1), Defense (+1 AC `when:
// '@armor.worn'`), Alert (+2 initiative); the SRD's chain mail is heavy, base 16.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type Row = CharacterInput['systemData']['inventory'][number];
type Magic = NonNullable<Extract<EntityInput, { type: 'item' }>['magic']>;

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** A character opened as a file would be, computed on its edition's pack; its breakdowns add up. */
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

/** Path → value, for the paths named. */
function valuesOf(result: Computed<FifthEditionEntity>, paths: readonly string[]) {
  return Object.fromEntries(paths.map((path) => [path, result.values[path]]));
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

/** The gathered items: id, and `dormant` when it is. */
function items(result: Computed<FifthEditionEntity>) {
  return result.entities.flatMap(({ entity, dormant }) =>
    entity.type === 'item' ? [dormant ? `${entity.id} dormant` : entity.id] : [],
  );
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
const chainMail = 'srd-2024:item/chain-mail' as const;

/** An inventory row of an item, equipped unless said otherwise. */
function row(n: number, itemId: NonNullable<Row['itemId']>, attuned = false, equipped = true): Row {
  return { uid: `b2000000-0000-4000-8000-00000000000${n}`, itemId, qty: 1, equipped, attuned };
}

/** A made-up item of a category, with its fields. */
function item(slug: string, category: 'armor' | 'shield' | 'gear', fields: object = {}) {
  return {
    id: `character:item/${slug}`,
    type: 'item',
    ruleset: 'any',
    name: { en: slug },
    source,
    category,
    ...fields,
  } as EntityInput;
}

/** A shield's normal +2, written as SPEC §5.3 writes it. */
const shieldEffect = { id: 'ac', target: 'ac.bonus', op: 'add', value: 2, when: '@equipped' };

/** Plate +1: heavy, base 18, no attunement. */
const plate = item('plate', 'armor', {
  armor: { group: 'heavy', baseAC: 18, dexCap: 0 },
  magic: { rarity: 'rare', bonus: 1 } satisfies Magic,
});
/** Warded hide: medium, base 14, DEX at most 2; attunement, +2, and +1 to Dexterity checks. */
const warded = item('warded', 'armor', {
  armor: { group: 'medium', baseAC: 14, dexCap: 2 },
  magic: { rarity: 'rare', attunement: true, bonus: 2 } satisfies Magic,
  effects: [{ id: 'quick', target: 'checks.dex.bonus', op: 'add', value: 1 }],
});
/** Padding: light, base 11, DEX in full. */
const padding = item('padding', 'armor', { armor: { group: 'light', baseAC: 11, dexCap: null } });
const tower = item('tower', 'shield', { effects: [shieldEffect] });
/** A second shield, +1. */
const buckler = item('buckler', 'shield', {
  magic: { rarity: 'uncommon', bonus: 1 } satisfies Magic,
  effects: [shieldEffect],
});
/** A shield +1 attuned only by a spellcaster: attunement as a text. */
const spellguard = item('spellguard', 'shield', {
  magic: { rarity: 'veryRare', attunement: { en: 'by a spellcaster' }, bonus: 1 } satisfies Magic,
  effects: [shieldEffect],
});
/**
 * A charm that needs attunement: +1 AC with no `when`, +1 initiative with one, and a resource.
 */
const charm = item('charm', 'gear', {
  magic: { rarity: 'rare', attunement: true } satisfies Magic,
  effects: [
    { id: 'ward', target: 'ac.bonus', op: 'add', value: 1 },
    { id: 'alert', target: 'init.bonus', op: 'add', value: 1, when: '@equipped' },
  ],
  grants: [
    {
      id: 'charges',
      kind: 'resource',
      key: 'charmCharges',
      label: { en: 'Charges' },
      uses: { max: '3', recovery: [{ on: 'dawn', amount: 'all' }] },
    },
  ],
});
const own = [plate, warded, padding, tower, buckler, spellguard, charm];

/** Golden B with all of the made-up items, these rows equipped. */
function wearing(...inventory: Row[]): CharacterInput {
  return {
    ...goldenB,
    localEntities: own,
    systemData: { ...goldenB.systemData, inventory },
  };
}

const AC = ['armor.worn', 'shield', 'ac.base', 'ac.bonus', 'ac.total'];
const GROUPS = ['armor.light', 'armor.medium', 'armor.heavy'];

describe('ENG-44 equipped items', () => {
  it('counts one armor and one shield, the first of each; warns of the others', () => {
    // ENG-44 §2's character: plate +1, chain mail, two shields, the charm not attuned.
    const result = computed(
      wearing(
        row(1, plate.id),
        row(2, chainMail),
        row(3, tower.id),
        row(4, buckler.id),
        row(5, charm.id),
      ),
    );
    // Plate 18, no DEX (heavy); its +1 + Defense 1 + the tower's 2; the buckler and its +1 count
    // for nothing, the charm's +1 has no `when`.
    expect(valuesOf(result, AC)).toEqual({
      'armor.worn': 1,
      shield: 1,
      'ac.base': 18,
      'ac.bonus': 4,
      'ac.total': 22,
    });
    expect(result.breakdown['ac.bonus']).toEqual([
      { kind: 'entity', source: plate.id, label: { en: 'plate' }, value: 1, change: 1 },
      {
        kind: 'effect',
        part: 'srd-2024:feat/defense#armor-class',
        source: 'srd-2024:feat/defense',
        label: { en: 'Defense' },
        op: 'add',
        value: 1,
        change: 1,
      },
      {
        kind: 'effect',
        part: `${tower.id}#ac`,
        source: tower.id,
        label: { en: 'tower' },
        op: 'add',
        value: 2,
        change: 2,
      },
    ]);
    expect(codes(result)).toEqual([
      {
        code: 'stepRule',
        path: 'armor.worn',
        rule: 'oneAtATime',
        data: { item: chainMail, worn: plate.id },
      },
      {
        code: 'stepRule',
        path: 'shield',
        rule: 'oneAtATime',
        data: { item: buckler.id, worn: tower.id },
      },
    ]);
    expect(items(result)).toEqual([plate.id, tower.id, `${charm.id} dormant`]);
    // The charm's +1 initiative has a `when`: Alert 2 + 1. Its charges are not given.
    expect(result.values['init.bonus']).toBe(3);
    expect(result.resources.map(({ key }) => key)).not.toContain('charmCharges');
  });

  it('counts the same item in two rows once, and warns of the second', () => {
    const result = computed(wearing(row(1, chainMail), row(2, chainMail)));
    // Chain mail 16 + Defense 1.
    expect(valuesOf(result, ['ac.base', 'ac.total'])).toEqual({ 'ac.base': 16, 'ac.total': 17 });
    expect(codes(result)).toEqual([
      {
        code: 'stepRule',
        path: 'armor.worn',
        rule: 'oneAtATime',
        data: { item: chainMail, worn: chainMail },
      },
    ]);
  });

  it('gives an item that needs attunement, not attuned, only its nonmagical benefits', () => {
    const asleep = computed(wearing(row(1, warded.id), row(2, charm.id)));
    // Worn all the same: hide 14 + DEX 1 (at most 2); Defense 1; no +2, no +1 to Dexterity checks.
    expect(valuesOf(asleep, [...AC, 'checks.dex.total', ...GROUPS])).toEqual({
      'armor.worn': 1,
      shield: 0,
      'ac.base': 15,
      'ac.bonus': 1,
      'ac.total': 16,
      'checks.dex.total': 1,
      'armor.light': 0,
      'armor.medium': 1,
      'armor.heavy': 0,
    });
    expect(items(asleep)).toEqual([`${warded.id} dormant`, `${charm.id} dormant`]);
    expect(asleep.entities.find(({ entity }) => entity.id === warded.id)?.paths).toEqual({
      equipped: 1,
      attuned: 0,
    });
    expect(asleep.warnings).toEqual([]);

    const attuned = computed(wearing(row(1, warded.id, true), row(2, charm.id, true)));
    // 15; its +2, Defense 1, the charm's +1; DEX +1 + 1; initiative 2 + Alert 2 + the charm's 1.
    expect(valuesOf(attuned, [...AC, 'checks.dex.total', 'init.total'])).toEqual({
      'armor.worn': 1,
      shield: 0,
      'ac.base': 15,
      'ac.bonus': 4,
      'ac.total': 19,
      'checks.dex.total': 2,
      'init.total': 5,
    });
    expect(items(attuned)).toEqual([warded.id, charm.id]);
    expect(attuned.values['resources.charmCharges.max']).toBe(3);
    expect(attuned.warnings).toEqual([]);
  });

  it("keeps a shield's normal +2 without attunement; its own +1 needs it", () => {
    const acOf = (attuned: boolean) =>
      valuesOf(computed(wearing(row(1, chainMail), row(2, spellguard.id, attuned))), AC);
    // Chain mail 16; Defense 1 + the shield's 2, + its 1 when attuned.
    expect(acOf(false)).toEqual({
      'armor.worn': 1,
      shield: 1,
      'ac.base': 16,
      'ac.bonus': 3,
      'ac.total': 19,
    });
    expect(acOf(true)).toEqual({
      'armor.worn': 1,
      shield: 1,
      'ac.base': 16,
      'ac.bonus': 4,
      'ac.total': 20,
    });
  });

  it("gives the worn armor's group as a number", () => {
    const groupsOf = (...inventory: Row[]) => valuesOf(computed(wearing(...inventory)), GROUPS);
    expect(groupsOf(row(1, padding.id))).toEqual({
      'armor.light': 1,
      'armor.medium': 0,
      'armor.heavy': 0,
    });
    expect(groupsOf(row(1, padding.id, false, false), row(2, tower.id))).toEqual({
      'armor.light': 0,
      'armor.medium': 0,
      'armor.heavy': 0,
    });
    const a = computed(goldenA);
    expect(valuesOf(a, GROUPS)).toEqual({ 'armor.light': 0, 'armor.medium': 0, 'armor.heavy': 1 });
    expect(a.breakdown['armor.heavy']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2014:item/chain-mail',
        label: { en: 'Chain Mail' },
        value: 1,
        change: 1,
      },
    ]);
    expect(computed(goldenB).values['armor.heavy']).toBe(1);
  });

  it('names an item no pack has and an id that is not an item as they are', () => {
    const result = computed(
      wearing(row(1, 'character:item/gone'), row(2, 'srd-2024:feat/alert'), row(3, chainMail)),
    );
    expect(codes(result)).toEqual([
      { code: 'missing', id: 'character:item/gone', from: 'character' },
    ]);
    // Chain mail is the armor worn: neither row before it is armor.
    expect(result.values['ac.base']).toBe(16);

    const find = (id: string) => own.find((each) => each.id === id);
    const character = opened(
      openFifthEditionCharacter(
        wearing(
          row(1, 'character:item/gone'),
          row(2, charm.id, false, false),
          row(3, tower.id, true),
        ),
      ),
    );
    expect(equipmentOf(character, find)).toEqual({
      named: [
        { id: 'character:item/gone', paths: { equipped: 1, attuned: 0 } },
        { id: tower.id, paths: { equipped: 1, attuned: 1 } },
      ],
      shield: { item: tower, magic: true },
      extra: { armor: [], shield: [] },
      // ENG-16: no weapon is equipped.
      weapons: [],
    });
  });

  it('stays pure: frozen inputs give equal results', () => {
    const character = deepFreeze(
      opened(
        openFifthEditionCharacter(
          wearing(row(1, plate.id), row(2, chainMail), row(3, buckler.id), row(4, charm.id)),
        ),
      ),
    );
    const { index } = index2024;
    deepFreeze(index);
    expect(compute(character, index, fifthEditionModule)).toEqual(
      compute(character, index, fifthEditionModule),
    );
  });

  it('reads attunement as needed when `true` or a text, not when `false` or absent', () => {
    const asked = [charm, spellguard, plate, item('plain', 'gear')].map((each) =>
      each.type === 'item' ? needsAttunement(each) : undefined,
    );
    const no = item('no', 'gear', { magic: { rarity: 'common', attunement: false } });
    expect([...asked, no.type === 'item' && needsAttunement(no)]).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
