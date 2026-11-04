import { applyEntry, compute, loadContentIndex, reverseEntry } from '@grimoire/engine';
import { logEntrySchema } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
  pinAcCalc,
  pinnedAcCalc,
} from '../src/index.ts';
import { stamp } from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenB, srd2024 } from './golden/index.ts';

// SHEET-35: the pick of the base AC calculation as an action. Golden B (SPEC §6.7): DEX +1, chain
// mail 16, Defense +1 in armor, so 16 + 1 = 17. Two made-up feats append to `ac.formulas`, as
// ENG-47's do, worked out by hand: `plated` 13 + DEX 1 = 14, always; `guarded` 10 + DEX 1 + CON 2 =
// 13, only without armor. In chain mail the candidates are the module's own, 16, and `plated`, 14;
// `guarded` does not apply. Pinned `plated`: 14 + Defense 1 = 15.

const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);
const source = { pack: 'character' };
const feat = (slug: string, effect: object) => ({
  id: `character:feat/${slug}`,
  type: 'feat' as const,
  ruleset: 'any' as const,
  name: { en: slug },
  source,
  effects: [{ id: slug, target: 'ac.formulas', op: 'append', ...effect }],
});
const PLATED = 'character:feat/plated#plated';
const GUARDED = 'character:feat/guarded#guarded';

const b: FifthEditionCharacter = opened(
  openFifthEditionCharacter({
    ...goldenB,
    localEntities: [
      feat('plated', { value: '13 + @abilities.dex.mod' }),
      feat('guarded', {
        value: '10 + @abilities.dex.mod + @abilities.con.mod',
        when: '!@armor.worn',
      }),
    ],
    systemData: {
      ...goldenB.systemData,
      feats: [{ id: 'character:feat/plated' }, { id: 'character:feat/guarded' }],
    },
  }),
);

function acOf(character: FifthEditionCharacter) {
  const result = compute(character, index, fifthEditionModule);
  return {
    base: result.values['ac.base'],
    total: result.values['ac.total'],
    keys: result.candidates['ac.base']?.map(({ key }) => key),
    warned: result.warnings.filter(
      (warning) => warning.code === 'stepRule' && warning.rule === 'acCalcNotApplying',
    ).length,
  };
}

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

describe('SHEET-35 pinAcCalc', () => {
  it('starts with no pin: the highest counts, and both candidates that apply are listed', () => {
    expect(pinnedAcCalc(b)).toBeUndefined();
    expect(acOf(b)).toEqual({ base: 16, total: 17, keys: ['equipment', PLATED], warned: 0 });
  });

  it('pins a part of an effect as one entry that changes the pin only, and Undo takes it back', () => {
    const made = ok(pinAcCalc(b, { calc: PLATED }, stamp));
    expect(logEntrySchema.parse(made.entry)).toEqual(made.entry);
    expect(made.entry.action).toBe('pinAcCalc');
    expect(made.entry.changes).toEqual([{ path: ['systemData', 'acCalc'], after: PLATED }]);
    expect(pinnedAcCalc(made.character)).toBe(PLATED);
    expect(acOf(made.character)).toEqual({
      base: 14,
      total: 15,
      keys: ['equipment', PLATED],
      warned: 0,
    });
    const back = reverseEntry(made.character, made.entry);
    expect(back.ok && back.character).toEqual(b);
    const again = applyEntry(b, made.entry);
    expect(again.ok && again.character).toEqual(made.character);
  });

  it("pins the module's own calculation, and changes a pin to another", () => {
    const own = ok(pinAcCalc(b, { calc: 'equipment' }, stamp));
    expect(acOf(own.character)).toMatchObject({ base: 16, total: 17 });
    const other = ok(pinAcCalc(own.character, { calc: PLATED }, stamp));
    expect(other.entry.changes).toEqual([
      { path: ['systemData', 'acCalc'], before: 'equipment', after: PLATED },
    ]);
  });

  it('takes the pin away: the field goes, and Undo puts it back', () => {
    const pinned = ok(pinAcCalc(b, { calc: PLATED }, stamp)).character;
    const freed = ok(pinAcCalc(pinned, { calc: undefined }, stamp));
    expect(freed.entry.changes).toEqual([{ path: ['systemData', 'acCalc'], before: PLATED }]);
    expect(pinnedAcCalc(freed.character)).toBeUndefined();
    expect(acOf(freed.character)).toMatchObject({ base: 16, total: 17 });
    const back = reverseEntry(freed.character, freed.entry);
    expect(back.ok && back.character).toEqual(pinned);
  });

  it('changes nothing when the pick is the pin already, or there is none to take away', () => {
    const pinned = ok(pinAcCalc(b, { calc: PLATED }, stamp)).character;
    for (const [character, calc] of [
      [pinned, PLATED],
      [b, undefined],
    ] as const) {
      expect(pinAcCalc(character, { calc }, stamp)).toMatchObject({ ok: false, code: 'unchanged' });
    }
  });

  it('refuses a name that is neither the own calculation nor an effect part', () => {
    expect(pinAcCalc(b, { calc: 'armored' }, stamp)).toMatchObject({
      ok: false,
      code: 'badCalc',
      calc: 'armored',
    });
  });

  it('keeps a pin that does not apply now, with the warning and the highest counting', () => {
    const made = ok(pinAcCalc(b, { calc: GUARDED }, stamp));
    expect(acOf(made.character)).toEqual({
      base: 16,
      total: 17,
      keys: ['equipment', PLATED],
      warned: 1,
    });
  });
});
