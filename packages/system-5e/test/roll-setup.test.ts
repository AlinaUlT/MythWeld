import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  criticalRangeOf,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  inspirationAdvantage,
  openFifthEditionCharacter,
  openFifthEditionPack,
  ROLL_TARGETS,
  rollSetupOf,
  situationalOf,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenB, goldenC2014, srd2014, srd2024 } from './golden/index.ts';

// SHEET-39: which d20 test a tapped path is, and what the dialog offers for it. The paths are the
// ones ENG-09, ENG-16, ENG-34 and ENG-43 compute; the weapon is golden B's greatsword (SRD 5.2.1:
// 2d6); the effects are made up, no text of a book. Nothing here is a computed number: the dialog
// reads those from `compute()`, which the goldens already prove.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type EffectInput = NonNullable<EntityInput['effects']>[number];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

function setupFor(input: CharacterInput) {
  const character = opened(openFifthEditionCharacter(input));
  const { index } = character.ruleset === '2014' ? index2014 : index2024;
  const result = compute(character, index, fifthEditionModule);
  return { character, index, result };
}

const B = setupFor(goldenB);

describe('SHEET-39 rollSetupOf', () => {
  const setup = (path: string) => rollSetupOf(B.character, B.result, B.index, path);

  it('finds a check, a save, a skill and initiative by their paths', () => {
    expect(setup('checks.str.total')).toMatchObject({
      kind: 'check',
      key: 'str',
      stat: 'str',
      modePath: 'checks.str.mode',
      targets: ROLL_TARGETS.check('str'),
    });
    expect(setup('abilities.str.save')).toMatchObject({
      kind: 'save',
      stat: 'str',
      modePath: 'abilities.str.saveMode',
      targets: ROLL_TARGETS.save('str'),
    });
    expect(setup('skills.athletics.total')).toMatchObject({
      kind: 'skill',
      key: 'athletics',
      stat: 'str',
      modePath: 'skills.athletics.mode',
      targets: ROLL_TARGETS.skill('athletics', 'str'),
    });
    expect(setup('init.total')).toMatchObject({
      kind: 'init',
      modePath: 'init.mode',
      targets: ROLL_TARGETS.init(),
    });
  });

  it('names each test by the entry it comes from', () => {
    expect(setup('skills.athletics.total')?.subject).toBe('srd-2024:skill/athletics');
    expect(setup('abilities.str.save')?.subject).toBe('srd-2024:ability/str');
    expect(setup('attacks.greatsword.hit')?.subject).toBe('srd-2024:item/greatsword');
    expect(setup('init.total')?.subject).toBeUndefined();
  });

  it('finds an equipped weapon by its key, with its damage and critical range', () => {
    const found = setup('attacks.greatsword.hit');
    expect(found).toMatchObject({
      kind: 'weaponAttack',
      key: 'greatsword',
      modePath: 'attacks.greatsword.mode',
      targets: ROLL_TARGETS.weaponAttack('melee'),
      critical: { rangePath: 'crit.range' },
      damage: { dice: '2d6', bonusPath: 'attacks.greatsword.damage' },
    });
    expect(found && criticalRangeOf(found, B.result)).toBe(20);
  });

  it("finds a casting class's spell attack, whose critical range is 20", () => {
    const wizard = setupFor(goldenC2014);
    const found = rollSetupOf(
      wizard.character,
      wizard.result,
      wizard.index,
      'classes.wizard.spell.attack',
    );
    expect(found).toMatchObject({
      kind: 'spellAttack',
      key: 'wizard',
      modePath: 'spell.attackMode',
      targets: ROLL_TARGETS.spellAttack(),
    });
    expect(found && criticalRangeOf(found, wizard.result)).toBe(20);
  });

  it('gives nothing for a number that rolls nothing, or a path that is not computed', () => {
    for (const path of ['ac.total', 'speed.walk', 'prof', 'checks.xyz.total', 'attacks.nope.hit']) {
      expect(setup(path), path).toBeUndefined();
    }
    expect(setup('skills.perception.passive')).toBeUndefined();
    expect(setup('__proto__')).toBeUndefined();
    expect(setup('constructor')).toBeUndefined();
  });

  it('gives nothing for a weapon that is no longer equipped', () => {
    const put = setupFor({
      ...goldenB,
      systemData: {
        ...goldenB.systemData,
        inventory: goldenB.systemData.inventory.map((row) => ({ ...row, equipped: false })),
      },
    });
    expect(
      rollSetupOf(put.character, put.result, put.index, 'attacks.greatsword.hit'),
    ).toBeUndefined();
  });
});

const CHARM = 'character:feat/charm';

/** golden B with a feat of its own that has these effects. */
function charmed(effects: EffectInput[]) {
  const charm: EntityInput = {
    id: CHARM,
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Charm' },
    source: { pack: 'character' },
    effects,
  };
  return setupFor({
    ...goldenB,
    localEntities: [...goldenB.localEntities, charm],
    systemData: { ...goldenB.systemData, feats: [...goldenB.systemData.feats, { id: CHARM }] },
  });
}

describe('SHEET-39 situationalOf', () => {
  const situational = { en: 'Against a charmer' };
  const offered = (made: ReturnType<typeof setupFor>, path: string) => {
    const setup = rollSetupOf(made.character, made.result, made.index, path);
    return setup === undefined
      ? undefined
      : situationalOf(made.result as Computed<FifthEditionEntity>, setup);
  };

  it('lists a situational advantage, disadvantage or add that names the test', () => {
    const made = charmed([
      { id: 'adv', target: 'roll.save.wis', op: 'advantage', value: true, situational },
      { id: 'dis', target: 'roll.save.all', op: 'disadvantage', value: true, situational },
      { id: 'bless', target: 'roll.save.all', op: 'add', value: '1d4', situational },
    ]);
    expect(
      offered(made, 'abilities.wis.save')?.map(({ part, op, value }) => [part, op, value]),
    ).toEqual([
      [`${CHARM}#adv`, 'advantage', undefined],
      [`${CHARM}#dis`, 'disadvantage', undefined],
      [`${CHARM}#bless`, 'add', '1d4'],
    ]);
    // Wisdom's effect names Wisdom only; the others name every save.
    expect(offered(made, 'abilities.str.save')?.map(({ part }) => part)).toEqual([
      `${CHARM}#dis`,
      `${CHARM}#bless`,
    ]);
    expect(offered(made, 'checks.wis.total')).toEqual([]);
  });

  it('leaves out an effect that is not situational, or has an op a roll cannot take', () => {
    const made = charmed([
      { id: 'plain', target: 'roll.save.all', op: 'advantage', value: true },
      { id: 'set', target: 'roll.save.all', op: 'mul', value: 2, situational },
    ]);
    expect(offered(made, 'abilities.str.save')).toEqual([]);
  });
});

describe('SHEET-39 inspirationAdvantage', () => {
  const held = (golden: CharacterInput, inspiration: number) =>
    opened(
      openFifthEditionCharacter({
        ...golden,
        systemData: {
          ...golden.systemData,
          state: { ...golden.systemData.state, inspiration },
        },
      }),
    );

  it('is true only when the edition spends it for advantage and one is held', () => {
    expect(inspirationAdvantage(held(goldenC2014, 1))).toBe(true);
    expect(inspirationAdvantage(held(goldenC2014, 0))).toBe(false);
    // 2024's heroic inspiration rerolls a die; it gives no advantage.
    expect(inspirationAdvantage(held(goldenB, 1))).toBe(false);
  });
});
