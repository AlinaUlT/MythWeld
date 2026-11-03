import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionModule,
  fifthEditionRollTest,
  fifthEditionSituational,
  openFifthEditionCharacter,
  openFifthEditionPack,
  ROLL_TARGETS,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenB, goldenB4, srd2024 } from './golden/index.ts';

// SHEET-39: what the roll dialog asks of the module. Golden B (SPEC §6.7) is a human fighter 1 with
// a greatsword (2d6) and chain mail; golden B4 adds Remarkable Athlete, whose advantage on
// Athletics and on initiative is in the steps of their modes (ENG-34). The feat below is made up.

const { index } = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);
const source = { pack: 'character' };

function computedFor(golden: typeof goldenB | typeof goldenB4, localEntities: unknown[] = []) {
  const character = opened(
    openFifthEditionCharacter({
      ...golden,
      localEntities,
      systemData: {
        ...golden.systemData,
        feats: [
          ...golden.systemData.feats,
          ...(localEntities as { id: string }[]).map(({ id }) => ({ id })),
        ],
      },
    }),
  );
  return compute(character, index, fifthEditionModule);
}

describe('SHEET-39 the test a number is', () => {
  const b = computedFor(goldenB);

  it('names each d20 test by its number’s path, its mode path and its targets', () => {
    expect(fifthEditionRollTest(b, 'checks.str.total')).toEqual({
      kind: 'check',
      bonus: 'checks.str.total',
      mode: 'checks.str.mode',
      targets: ROLL_TARGETS.check('str'),
    });
    expect(fifthEditionRollTest(b, 'abilities.con.save')).toEqual({
      kind: 'save',
      bonus: 'abilities.con.save',
      mode: 'abilities.con.saveMode',
      targets: ROLL_TARGETS.save('con'),
    });
    expect(fifthEditionRollTest(b, 'skills.athletics.total')).toEqual({
      kind: 'skill',
      bonus: 'skills.athletics.total',
      mode: 'skills.athletics.mode',
      targets: ROLL_TARGETS.skill('athletics', 'str'),
    });
    expect(fifthEditionRollTest(b, 'init.total')).toEqual({
      kind: 'init',
      bonus: 'init.total',
      mode: 'init.mode',
      targets: ROLL_TARGETS.init(),
    });
  });

  it('reads a skill’s stat from its key path, not the skill’s own', () => {
    const moved = computedFor({
      ...goldenB,
      overrides: [{ path: 'skills.athletics.ability', value: 'cha' }],
    } as typeof goldenB);
    expect(fifthEditionRollTest(moved, 'skills.athletics.total')?.targets).toEqual(
      ROLL_TARGETS.skill('athletics', 'cha'),
    );
  });

  it('gives the greatsword attack its critical range and its damage: 2d6 and the sheet’s bonus', () => {
    expect(fifthEditionRollTest(b, 'attacks.greatsword.hit')).toEqual({
      kind: 'weaponAttack',
      bonus: 'attacks.greatsword.hit',
      mode: 'attacks.greatsword.mode',
      targets: ROLL_TARGETS.weaponAttack('melee'),
      critRange: 'crit.range',
      damage: {
        dice: '2d6',
        bonus: 'attacks.greatsword.damage',
        path: 'attacks.greatsword.damage',
      },
    });
  });

  it('gives no test for a number that does not roll, or a name Object has', () => {
    for (const path of ['ac.total', 'abilities.str.score', 'toString', 'constructor', '', 'prof']) {
      expect(fifthEditionRollTest(b, path), path).toBeUndefined();
    }
    expect(fifthEditionRollTest(b, 'attacks.nothing.hit')).toBeUndefined();
    expect(fifthEditionRollTest(b, 'skills.nothing.total')).toBeUndefined();
  });

  it('keeps the sources of Remarkable Athlete in the mode steps the dialog adds to', () => {
    const b4 = computedFor(goldenB4);
    expect(b4.values['skills.athletics.mode']).toBe(1);
    expect(b4.breakdown['skills.athletics.mode']?.map((step) => step.value)).toEqual([1]);
    expect(b.values['skills.athletics.mode']).toBe(0);
  });
});

describe('SHEET-39 the situational effects of a test', () => {
  const feat = {
    id: 'character:feat/wary',
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Wary' },
    source,
    effects: [
      {
        id: 'poison',
        target: 'roll.save.con',
        op: 'advantage',
        value: true,
        situational: { en: 'against poison' },
        label: { en: 'Hardy' },
      },
      {
        id: 'all-saves',
        target: 'roll.save.all',
        op: 'disadvantage',
        value: true,
        situational: { en: 'in darkness' },
      },
      {
        id: 'other',
        target: 'roll.save.wis',
        op: 'advantage',
        value: true,
        situational: { en: 'x' },
      },
      { id: 'always', target: 'roll.save.con', op: 'advantage', value: true },
      { id: 'bonus', target: 'checks.con.bonus', op: 'add', value: 1, situational: { en: 'y' } },
    ],
  };
  const withFeat = computedFor(goldenB, [feat]);

  it('lists those naming one of the targets, in order, with their sign and words', () => {
    const found = fifthEditionSituational(withFeat, ROLL_TARGETS.save('con'));
    expect(found).toEqual([
      {
        part: 'character:feat/wary#poison',
        label: { en: 'Hardy' },
        situation: { en: 'against poison' },
        sign: 1,
      },
      {
        part: 'character:feat/wary#all-saves',
        label: { en: 'Wary' },
        situation: { en: 'in darkness' },
        sign: -1,
      },
    ]);
  });

  it('never applies a situational effect to the sheet’s own number', () => {
    expect(withFeat.values['abilities.con.saveMode']).toBe(1);
    expect(withFeat.breakdown['abilities.con.saveMode']).toHaveLength(1);
    expect(fifthEditionSituational(computedFor(goldenB), ROLL_TARGETS.save('con'))).toEqual([]);
  });
});
