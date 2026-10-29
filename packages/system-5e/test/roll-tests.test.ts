import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionCasting,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  modeSigns,
  openFifthEditionCharacter,
  openFifthEditionPack,
  ROLL_TARGETS,
  rollTestOf,
  situationalModes,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenA, goldenB, srd2014, srd2024 } from './golden/index.ts';

// SHEET-39: which d20 test a number's path is. The numbers are SPEC §6.7's golden B (a human
// fighter 1, STR 17: Athletics +5, initiative +3, a greatsword at +5 to hit and +3 to damage) and
// golden A (a hill dwarf cleric 1, spell attack +5), worked out by hand; the effects are made up.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = CharacterInput['localEntities'][number];
type EffectInput = NonNullable<EntityInput['effects']>[number];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

function sheetOf(golden: CharacterInput) {
  const character = opened(openFifthEditionCharacter(golden));
  const { index } = character.ruleset === '2014' ? index2014 : index2024;
  return { character, computed: compute(character, index, fifthEditionModule) };
}

const CHARM = 'character:feat/charm';

/** Golden B with a feat of its own that has these effects. */
function charmed(effects: EffectInput[], toggles: Record<string, boolean> = {}) {
  const charm: EntityInput = {
    id: CHARM,
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Charm' },
    source: { pack: 'character' },
    effects,
  };
  return sheetOf({
    ...goldenB,
    localEntities: [...goldenB.localEntities, charm],
    systemData: { ...goldenB.systemData, feats: [...goldenB.systemData.feats, { id: CHARM }] },
    state: { ...goldenB.state, toggles },
  });
}

describe('SHEET-39 the d20 test of a number', () => {
  const { computed } = sheetOf(goldenB);
  const test = (path: string) => rollTestOf(path, computed);

  it('knows each kind of test by its path, with its mode path and targets', () => {
    expect(test('checks.str.total')).toMatchObject({
      kind: 'check',
      path: 'checks.str.total',
      modePath: 'checks.str.mode',
      targets: ROLL_TARGETS.check('str'),
      subject: { type: 'stat', key: 'str' },
    });
    expect(test('abilities.dex.save')).toMatchObject({
      kind: 'save',
      modePath: 'abilities.dex.saveMode',
      targets: ['roll.save.dex', 'roll.save.all'],
    });
    expect(test('skills.athletics.total')).toMatchObject({
      kind: 'skill',
      modePath: 'skills.athletics.mode',
      targets: ['roll.skill.athletics', 'roll.check.str', 'roll.check.all'],
      subject: { type: 'skill', key: 'athletics' },
    });
    expect(test('init.total')).toMatchObject({
      kind: 'init',
      modePath: 'init.mode',
      targets: ['roll.init', 'roll.check.dex', 'roll.check.all'],
    });
  });

  it("reads golden B's numbers: Athletics +5, initiative +3", () => {
    expect(computed.values['skills.athletics.total']).toBe(5);
    expect(computed.values['init.total']).toBe(3);
  });

  it("gives the greatsword's attack its weapon, critical range and damage", () => {
    expect(test('attacks.greatsword.hit')).toMatchObject({
      kind: 'weaponAttack',
      modePath: 'attacks.greatsword.mode',
      targets: ['roll.attack.weapon.melee', 'roll.attack.all'],
      subject: { type: 'item', id: 'srd-2024:item/greatsword' },
      critRange: 20,
      damage: { formula: '2d6', bonusPath: 'attacks.greatsword.damage' },
    });
    expect(computed.values['attacks.greatsword.hit']).toBe(5);
    expect(computed.values['attacks.greatsword.damage']).toBe(3);
  });

  it("gives golden A's spell attack its class path and a critical range of 20", () => {
    const a = sheetOf(goldenA);
    const [casting] = fifthEditionCasting(a.character, a.computed);
    expect(casting?.attack).toBe('classes.cleric.spell.attack');
    expect(a.computed.values['classes.cleric.spell.attack']).toBe(5);
    expect(rollTestOf('classes.cleric.spell.attack', a.computed)).toEqual({
      kind: 'spellAttack',
      path: 'classes.cleric.spell.attack',
      modePath: 'spell.attackMode',
      targets: ['roll.attack.spell', 'roll.attack.all'],
      critRange: 20,
    });
  });

  it('gives nothing for a path that is no d20 test, a missing one, or an inherited name', () => {
    expect(test('ac.total')).toBeUndefined();
    expect(test('skills.nothing.total')).toBeUndefined();
    expect(test('checks.san.total')).toBeUndefined();
    expect(test('attacks.nothing.hit')).toBeUndefined();
    expect(test('toString')).toBeUndefined();
    expect(test('')).toBeUndefined();
  });
});

describe('SHEET-39 the sources of a roll mode', () => {
  it("takes a step's sign from each step of the breakdown", () => {
    const { computed } = charmed([
      { id: 'sneak', target: 'roll.skill.stealth', op: 'advantage', value: true },
    ]);
    // Chain mail's Stealth disadvantage (-1) and the feat's advantage (+1): they cancel.
    expect(computed.values['skills.stealth.mode']).toBe(0);
    expect(modeSigns(computed, 'skills.stealth.mode').sort()).toEqual([-1, 1]);
  });

  it('takes a manual edit of the mode as the one source', () => {
    const { character } = sheetOf(goldenB);
    const edited = opened(
      openFifthEditionCharacter({
        ...goldenB,
        overrides: [{ path: 'skills.athletics.mode', value: 1 }],
      }),
    );
    const { index } = index2024;
    const computed = compute(edited, index, fifthEditionModule);
    expect(character.id).toBe(edited.id);
    expect(computed.values['skills.athletics.mode']).toBe(1);
    expect(modeSigns(computed, 'skills.athletics.mode')).toEqual([1]);
  });

  it('lists a situational effect that names the test, and keeps it out of the number', () => {
    const { character, computed } = charmed([
      {
        id: 'high-ground',
        target: 'roll.attack.all',
        op: 'advantage',
        value: true,
        situational: { en: 'Against a foe below you' },
        label: { en: 'High ground' },
      },
    ]);
    expect(computed.values['attacks.greatsword.mode']).toBe(0);
    const test = rollTestOf('attacks.greatsword.hit', computed);
    expect(situationalModes(character, computed, test?.targets ?? [])).toEqual([
      {
        part: `${CHARM}#high-ground`,
        hint: { en: 'Against a foe below you' },
        label: { en: 'High ground' },
        sign: 1,
      },
    ]);
    // A test it does not name is not offered it.
    expect(situationalModes(character, computed, ROLL_TARGETS.save('dex'))).toEqual([]);
  });

  it('offers a disadvantage, and not a number op, a plain effect or a false when', () => {
    const { character, computed } = charmed([
      {
        id: 'dazzled',
        target: 'roll.check.all',
        op: 'disadvantage',
        value: true,
        situational: { en: 'In bright light' },
      },
      { id: 'plain', target: 'roll.check.all', op: 'advantage', value: true },
      {
        id: 'bonus',
        target: 'roll.check.all',
        op: 'add',
        value: 1,
        situational: { en: 'Blessed' },
      },
      {
        id: 'never',
        target: 'roll.check.all',
        op: 'advantage',
        value: true,
        when: '0',
        situational: { en: 'Never' },
      },
    ]);
    expect(situationalModes(character, computed, ROLL_TARGETS.check('str'))).toEqual([
      {
        part: `${CHARM}#dazzled`,
        hint: { en: 'In bright light' },
        label: { en: 'Charm' },
        sign: -1,
      },
    ]);
  });

  it('leaves out a situational effect whose toggle is off', () => {
    const effects: EffectInput[] = [
      {
        id: 'raging',
        target: 'roll.check.all',
        op: 'advantage',
        value: true,
        situational: { en: 'While raging' },
        toggle: { label: { en: 'Raging' }, default: false },
      },
    ];
    const targets = ROLL_TARGETS.check('str');
    const off = charmed(effects);
    expect(situationalModes(off.character, off.computed, targets)).toEqual([]);
    const on = charmed(effects, { [`${CHARM}#raging`]: true });
    expect(situationalModes(on.character, on.computed, targets)).toHaveLength(1);
  });
});
