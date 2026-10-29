import {
  type ActionResult,
  compute,
  type LogStamp,
  loadContentIndex,
  removeCondition,
  reverseEntry,
} from '@grimoire/engine';
import { logEntrySchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  longRest,
  openFifthEditionCharacter,
  openFifthEditionPack,
  revive,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenB, srd2024 } from './golden/index.ts';

// SHEET-22: what fifth edition keeps for an entity, its switches and the pinned base AC
// calculation, goes with it. Golden B (DEX +1, chain mail 16, Defense +1 in armor) under a
// made-up condition of its own, Braced: its `brace` appends 13 + DEX to `ac.formulas` behind a
// switch, and it ends on a long rest and on a revival. Stored: `brace` on and pinned. Worked out
// by hand, as ENG-47's `plated` in chain mail: Braced 13 + 1 = 14, + Defense 1 = 15; without it,
// SPEC §6.7's golden B: 16, + Defense 1 = 17.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];

const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);
const source = { pack: 'character' };

const stamp: LogStamp = {
  id: '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
  at: '2026-10-29T18:30:00.000Z',
  by: { role: 'player', name: 'Wren' },
};

const BRACED = 'character:condition/braced';
const BRACE = `${BRACED}#brace`;
const WARD = 'character:item/ward-stone#ward';
const PIN = ['systemData', 'acCalc'];

const braced = {
  id: BRACED,
  type: 'condition',
  ruleset: 'any',
  name: { en: 'Braced' },
  recovery: [
    { on: 'long', amount: 'all' },
    { on: 'revive', amount: 'all' },
  ],
  effects: [
    {
      id: 'brace',
      target: 'ac.formulas',
      op: 'append',
      value: '13 + @abilities.dex.mod',
      toggle: { label: { en: 'Bracing' }, default: false },
    },
  ],
  source,
} satisfies EntityInput;

/** A made-up stone, carried and not equipped: its `ward` would append 12 + DEX. */
const wardStone = {
  id: 'character:item/ward-stone',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Ward stone' },
  source,
  category: 'gear',
  effects: [{ id: 'ward', target: 'ac.formulas', op: 'append', value: '12 + @abilities.dex.mod' }],
} satisfies EntityInput;

/** Golden B, Braced with `brace` on, the pin `acCalc`, and changes to its state. */
function bracedB(
  acCalc: string,
  state: Partial<CharacterInput['systemData']['state']> = {},
): FifthEditionCharacter {
  return opened(
    openFifthEditionCharacter({
      ...goldenB,
      state: { ...goldenB.state, conditions: [{ id: BRACED }], toggles: { [BRACE]: true } },
      localEntities: [braced, wardStone],
      systemData: {
        ...goldenB.systemData,
        acCalc,
        inventory: [
          ...goldenB.systemData.inventory,
          {
            uid: 'd4000000-0000-4000-8000-000000000001',
            itemId: wardStone.id,
            qty: 1,
            equipped: false,
            attuned: false,
          },
        ],
        state: { ...goldenB.systemData.state, ...state },
      },
    }),
  );
}

/** A result that changed the character; a failed test with its message when it did not. */
function changed(result: ActionResult<FifthEditionCharacter, { code: string; message: string }>) {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  expect(logEntrySchema.parse(result.entry)).toEqual(result.entry);
  return result;
}

/** The AC numbers and the pin warnings of a character. */
function acOf(character: FifthEditionCharacter) {
  const { values, warnings } = compute(character, index, fifthEditionModule);
  return {
    base: values['ac.base'],
    total: values['ac.total'],
    pinWarnings: warnings.filter(
      (warning) => warning.code === 'stepRule' && warning.rule === 'acCalcNotApplying',
    ).length,
  };
}

/** The changes that drop the switch and the pin of Braced. */
const droppedBrace = [
  { path: ['state', 'toggles', BRACE], before: true },
  { path: PIN, before: BRACE },
];

describe('SHEET-22 removing an entity drops what was stored for it', () => {
  it('drops the switch and the pin of a condition taken away', () => {
    const character = bracedB(BRACE);
    expect(acOf(character)).toEqual({ base: 14, total: 15, pinWarnings: 0 });

    const freed = changed(
      removeCondition(character, index, fifthEditionModule, { id: BRACED }, stamp),
    );
    expect(freed.entry.changes).toEqual([
      { path: ['state', 'conditions'], before: [{ id: BRACED }], after: [] },
      ...droppedBrace,
    ]);
    expect(freed.character.state.toggles).toEqual({});
    expect(freed.character.systemData.acCalc).toBeUndefined();
    expect(acOf(freed.character)).toEqual({ base: 16, total: 17, pinWarnings: 0 });

    const back = reverseEntry(freed.character, freed.entry);
    expect(back.ok && back.character).toEqual(character);
  });

  it('keeps a pin of an item put away, which the character still carries', () => {
    const character = bracedB(WARD);
    expect(acOf(character)).toEqual({ base: 16, total: 17, pinWarnings: 1 });
    const freed = changed(
      removeCondition(character, index, fifthEditionModule, { id: BRACED }, stamp),
    );
    expect(freed.entry.changes.slice(1)).toEqual([droppedBrace[0]]);
    expect(freed.character.systemData.acCalc).toBe(WARD);
  });

  it('drops them when a long rest ends the condition', () => {
    const rested = changed(longRest(bracedB(BRACE), index, stamp));
    expect(rested.entry.changes.slice(-2)).toEqual(droppedBrace);
    expect(rested.character.state.conditions).toEqual([]);
    expect(acOf(rested.character)).toEqual({ base: 16, total: 17, pinWarnings: 0 });
  });

  it('drops them when a revival ends the condition', () => {
    const dead = bracedB(BRACE, {
      hp: { current: 0, temp: 0 },
      deathSaves: { success: 0, failure: 3, stable: false },
    });
    const revived = changed(revive(dead, index, { hp: 1 }, stamp));
    expect(revived.entry.changes.slice(-2)).toEqual(droppedBrace);
    expect(acOf(revived.character)).toEqual({ base: 16, total: 17, pinWarnings: 0 });
  });
});
