import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOUSE_RULES,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  fifthEditionModule,
  type ManualCharacterAsk,
  madeByHand,
  manualCharacter,
  manualHitPoints,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenC2024,
  srd2014,
  srd2024,
} from './golden/index.ts';

// The goldens of SPEC §6.7, typed into the manual form: what the person types is the golden's;
// its picks and size are added afterwards from the golden, so its hand-computed values hold. The id
// and time are test data. SHEET-28: the inventory is typed too, as the form's equipment step lists it.

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(openFifthEditionPack(srd2014)),
]).index;
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(openFifthEditionPack(srd2024)),
]).index;

const AT = '2026-10-29T12:00:00.000Z';
const ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

type Golden =
  | typeof goldenB
  | typeof goldenB4
  | typeof goldenA
  | typeof goldenC2014
  | typeof goldenC2024;

/** What the person types for a golden: its rules base, packs, name, origin, classes, scores and gear. */
function askOf(golden: Golden): ManualCharacterAsk {
  const data = golden.systemData;
  return {
    id: ID,
    at: AT,
    ruleset: golden.ruleset,
    allowMixedRulesets: golden.allowMixedRulesets,
    name: golden.name,
    packs: golden.packs,
    ...('species' in data && { species: data.species.id }),
    ...('background' in data && { background: data.background.id }),
    classes: data.classes.map((entry) => ({
      id: entry.id,
      level: entry.level,
      ...('subclass' in entry && { subclass: entry.subclass }),
    })),
    scores: golden.abilities.base,
    items: data.inventory.flatMap(({ uid, itemId, qty, equipped }) =>
      itemId === undefined ? [] : [{ uid, itemId, qty, equipped }],
    ),
  };
}

/** The made character with the golden's picks and size: what the sheet adds later. */
function withGoldensPicks(made: FifthEditionCharacter, golden: Golden): FifthEditionCharacter {
  const data = golden.systemData;
  return opened(
    openFifthEditionCharacter({
      ...made,
      choices: golden.choices,
      systemData: {
        ...made.systemData,
        ...('species' in data && { species: data.species }),
      },
    }),
  );
}

describe('SHEET-27 the manual form makes a character', () => {
  it('writes the first class level 1 at the maximum and every other level at the fixed value', () => {
    expect(manualHitPoints([{ id: 'p:class/a', level: 1 }])).toEqual([['max']]);
    expect(
      manualHitPoints([
        { id: 'p:class/a', level: 3 },
        { id: 'p:class/b', level: 3 },
      ]),
    ).toEqual([
      ['max', 'avg', 'avg'],
      ['avg', 'avg', 'avg'],
    ]);
    expect(manualHitPoints([])).toEqual([]);
  });

  it("gives each golden the goldens' own hit points entries", () => {
    for (const golden of [goldenA, goldenB, goldenB4, goldenC2014, goldenC2024]) {
      expect(manualCharacter(askOf(golden)).systemData.classes).toEqual(golden.systemData.classes);
    }
  });

  it("is written with the default house rules and its edition's bonus and language sides", () => {
    const b = manualCharacter(askOf(goldenB)).systemData;
    expect(b.houseRules).toEqual(DEFAULT_HOUSE_RULES);
    expect(b.abilities).toEqual({ method: 'manual', bonusSource: 'background' });
    expect(b.languageSource).toBe('background');
    const a = manualCharacter(askOf(goldenA)).systemData;
    expect(a.abilities.bonusSource).toBe('species');
    expect(a.languageSource).toBe('species');
  });

  it('makes no pick, no item and no coin for the person', () => {
    const made = manualCharacter({ ...askOf(goldenB), items: [] });
    expect(made.choices).toEqual({});
    expect(made.systemData.inventory).toEqual([]);
    expect(made.systemData.feats).toEqual([]);
    expect(made.systemData.currency).toEqual({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
    expect(made.systemData.species).toEqual({ id: 'srd-2024:species/human' });
    expect(made.mode).toBe('manual');
    expect([made.createdAt, made.updatedAt, made.rev]).toEqual([AT, AT, 0]);
  });

  it('opens through the migration frame as it was made', () => {
    const made = madeByHand(askOf(goldenB), index2024).character;
    expect(opened(openFifthEditionCharacter(made))).toEqual(made);
  });

  it('leaves out the species and background when none is named', () => {
    const made = manualCharacter(askOf(goldenC2014));
    expect('species' in made.systemData).toBe(false);
    expect('background' in made.systemData).toBe(false);
  });

  it('starts at full hit points: golden B 12, golden B4 36', () => {
    const b = madeByHand(askOf(goldenB), index2024);
    expect(b.computed.values['hp.max']).toBe(12);
    expect(b.character.systemData.state.hp).toEqual({ current: 12, temp: 0 });
    const b4 = madeByHand(askOf(goldenB4), index2024);
    expect(b4.character.systemData.state.hp).toEqual({ current: 36, temp: 0 });
  });

  it('starts at 0 hit points with no class', () => {
    const made = madeByHand({ ...askOf(goldenB), classes: [] }, index2024);
    expect(made.character.systemData.state.hp.current).toBe(0);
  });

  it("gives golden B's numbers once its picks are added, its gear typed: HP 12, AC 17, initiative +3", () => {
    const made = withGoldensPicks(madeByHand(askOf(goldenB), index2024).character, goldenB);
    const { values } = compute(made, index2024, fifthEditionModule);
    expect([values['hp.max'], values['ac.total'], values['init.total']]).toEqual([12, 17, 3]);
  });

  it("gives golden A's numbers once its picks are added, its gear typed: HP 12, AC 18, initiative +0", () => {
    const made = withGoldensPicks(madeByHand(askOf(goldenA), index2014).character, goldenA);
    const { values } = compute(made, index2014, fifthEditionModule);
    expect([values['hp.max'], values['ac.total'], values['init.total']]).toEqual([12, 18, 0]);
  });
});

describe('SHEET-28 the manual form lists the starting inventory', () => {
  it("writes the typed items as the golden's own inventory rows, none attuned", () => {
    const b = manualCharacter(askOf(goldenB));
    expect(b.systemData.inventory).toEqual(goldenB.systemData.inventory);
    expect(b.systemData.inventory.map((row) => [row.itemId, row.qty, row.equipped])).toEqual([
      ['srd-2024:item/chain-mail', 1, true],
      ['srd-2024:item/greatsword', 1, true],
    ]);
    expect(manualCharacter(askOf(goldenA)).systemData.inventory).toEqual(
      goldenA.systemData.inventory,
    );
  });

  it('writes no row for a form with no items', () => {
    const made = manualCharacter({ ...askOf(goldenB), items: [] });
    expect(made.systemData.inventory).toEqual([]);
    expect(opened(openFifthEditionCharacter(made)).systemData.inventory).toEqual([]);
  });

  it('keeps a quantity and a carried, not worn, item', () => {
    const made = opened(
      openFifthEditionCharacter(
        manualCharacter({
          ...askOf(goldenB),
          items: [
            {
              uid: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
              itemId: 'srd-2024:item/greatsword',
              qty: 3,
              equipped: false,
            },
          ],
        }),
      ),
    );
    expect(made.systemData.inventory).toEqual([
      {
        uid: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        itemId: 'srd-2024:item/greatsword',
        qty: 3,
        equipped: false,
        attuned: false,
      },
    ]);
  });
});
