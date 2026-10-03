import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenC2014, goldenC2024, srd2014, srd2024 } from './golden/index.ts';

// ENG-46: armor worn without training. The rules are ENG-46 §8's. Golden C (both editions): STR 13
// (+1), DEX 10 (+0), wizard 3 then paladin 3, whose multiclass gives the armor proficiencies
// `light`, `medium`, `shield`; "the wizard" is golden C with only its wizard 3, which gives none.
// Both packs have the same 18 skills; Acrobatics, Sleight of Hand and Stealth use DEX, Athletics
// STR. The SRD chain mail is heavy, base 16, no DEX, Str 13, Stealth disadvantage. The items and
// feats of the character's own (`character:`) are made up, no text of a book; each value below was
// worked out by hand from them, never copied from a run.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];
type Row = CharacterInput['systemData']['inventory'][number];

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

/** Every roll mode's path that is not 0, with its mode. */
function modesNotZero(result: Computed<FifthEditionEntity>) {
  return Object.fromEntries(
    Object.entries(result.values).filter(
      ([path, value]) => /(^|\.)(mode|saveMode|attackMode)$/.test(path) && value !== 0,
    ),
  );
}

/** How many roll mode paths a character has. */
function modeCount(result: Computed<FifthEditionEntity>) {
  return Object.keys(result.values).filter((path) => /(^|\.)(mode|saveMode|attackMode)$/.test(path))
    .length;
}

const source = { pack: 'character' };

/** An inventory row of an item, equipped unless said otherwise. */
function row(n: number, itemId: NonNullable<Row['itemId']>, equipped = true): Row {
  return {
    uid: `c3000000-0000-4000-8000-00000000000${n}`,
    itemId,
    qty: 1,
    equipped,
    attuned: false,
  };
}

/** Golden C, or with `wizardOnly` its wizard alone, with these rows, own entities and feats. */
function wearing(
  golden: CharacterInput,
  wizardOnly: boolean,
  inventory: Row[],
  localEntities: EntityInput[] = [],
): CharacterInput {
  const { classes } = golden.systemData;
  return {
    ...golden,
    localEntities,
    systemData: {
      ...golden.systemData,
      classes: wizardOnly ? classes.slice(0, 1) : classes,
      inventory,
      feats: localEntities.flatMap(({ id, type }) => (type === 'feat' ? [{ id }] : [])),
    },
  };
}

const mail2014 = 'srd-2014:item/chain-mail' as const;
const shield2014 = 'srd-2014:item/shield' as const;
const mail2024 = 'srd-2024:item/chain-mail' as const;
const mailName = { en: 'Chain Mail' };

/** A made-up shield: +2 AC and +1 initiative while equipped, a +1 magic bonus, no attunement. */
const kite = {
  id: 'character:item/kite',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Kite' },
  source,
  category: 'shield',
  magic: { rarity: 'uncommon', bonus: 1 },
  effects: [
    { id: 'ac', target: 'ac.bonus', op: 'add', value: 2, when: '@equipped' },
    { id: 'ready', target: 'init.bonus', op: 'add', value: 1, when: '@equipped' },
  ],
} as EntityInput;

/** A made-up light armor: base 11, DEX in full. */
const quilt = {
  id: 'character:item/quilt',
  type: 'item',
  ruleset: 'any',
  name: { en: 'Quilt' },
  source,
  category: 'armor',
  armor: { group: 'light', baseAC: 11, dexCap: null },
} as EntityInput;

/** A made-up feat: the armor proficiency of one armor, by its key. */
const mailed = {
  id: 'character:feat/mailed',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Mailed' },
  source,
  grants: [{ id: 'mail', kind: 'proficiency', category: 'armor', fixed: ['chainMail'] }],
} as EntityInput;

/** A made-up feat: Arcana on DEX, Athletics on INT. */
const swapped = {
  id: 'character:feat/swapped',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Swapped' },
  source,
  effects: [
    { id: 'arcana', target: 'skills.arcana.ability', op: 'set', value: 'dex' },
    { id: 'athletics', target: 'skills.athletics.ability', op: 'set', value: 'int' },
  ],
} as EntityInput;

/** A rule step of a training penalty. */
const rule = (name: 'untrainedArmor' | 'untrainedShield', value: number, change: number) => ({
  kind: 'rule',
  rule: name,
  value,
  change,
});

/** The warning of an item worn without training. */
const warned = (path: 'armor.untrained' | 'shield.untrained', item: string) => ({
  code: 'stepRule',
  path,
  rule: path === 'armor.untrained' ? 'untrainedArmor' : 'untrainedShield',
  data: { item },
});

/** The Strength and Dexterity tests of golden C, each at mode −1. */
const STR_DEX_MODES = {
  'checks.str.mode': -1,
  'abilities.str.saveMode': -1,
  'checks.dex.mode': -1,
  'abilities.dex.saveMode': -1,
  'skills.acrobatics.mode': -1,
  'skills.athletics.mode': -1,
  'skills.sleightOfHand.mode': -1,
  'skills.stealth.mode': -1,
  'init.mode': -1,
};

/** 6 checks, 6 saves, 18 skills, initiative, spell attacks, the death save. */
const MODES = 33;

describe('ENG-46 armor without training', () => {
  it('gives the 2014 wizard in chain mail disadvantage on Strength and Dexterity, and no spells', () => {
    const result = computed(wearing(goldenC2014, true, [row(1, mail2014)]));
    expect(valuesOf(result, ['armor.untrained', 'shield.untrained', 'spell.cannotCast'])).toEqual({
      'armor.untrained': 1,
      'shield.untrained': 0,
      'spell.cannotCast': 1,
    });
    expect(result.breakdown['armor.untrained']).toEqual([
      { kind: 'entity', source: mail2014, label: mailName, value: 1, change: 1 },
    ]);
    expect(result.breakdown['shield.untrained']).toEqual([]);
    expect(result.breakdown['spell.cannotCast']).toEqual([rule('untrainedArmor', 1, 1)]);
    expect(modesNotZero(result)).toEqual(STR_DEX_MODES);
    expect(modeCount(result)).toBe(MODES);
    for (const path of ['checks.str.mode', 'abilities.dex.saveMode', 'skills.athletics.mode']) {
      expect(result.breakdown[path], path).toEqual([rule('untrainedArmor', -1, -1)]);
    }
    expect(result.breakdown['init.mode']).toEqual([rule('untrainedArmor', -1, -1)]);
    // The chain mail's own Stealth rule first (ENG-34), then the training's.
    expect(result.breakdown['skills.stealth.mode']).toEqual([
      { kind: 'entity', source: mail2014, label: mailName, value: -1, change: -1 },
      rule('untrainedArmor', -1, 0),
    ]);
    expect(result.breakdown['abilities.wis.saveMode']).toEqual([]);
    // The AC as without the rule: 16, no DEX.
    expect(valuesOf(result, ['ac.base', 'ac.bonus', 'ac.total'])).toEqual({
      'ac.base': 16,
      'ac.bonus': 0,
      'ac.total': 16,
    });
    expect(codes(result)).toEqual([warned('armor.untrained', mail2014)]);
  });

  it('keeps a 2014 shield its AC without training, and gives its own disadvantage', () => {
    const both = computed(wearing(goldenC2014, true, [row(1, mail2014), row(2, shield2014)]));
    expect(valuesOf(both, ['armor.untrained', 'shield.untrained', 'spell.cannotCast'])).toEqual({
      'armor.untrained': 1,
      'shield.untrained': 1,
      'spell.cannotCast': 1,
    });
    expect(both.breakdown['shield.untrained']).toEqual([
      { kind: 'entity', source: shield2014, label: { en: 'Shield' }, value: 1, change: 1 },
    ]);
    // 16 + the shield's 2.
    expect(valuesOf(both, ['ac.base', 'ac.bonus', 'ac.total'])).toEqual({
      'ac.base': 16,
      'ac.bonus': 2,
      'ac.total': 18,
    });
    expect(modesNotZero(both)).toEqual(STR_DEX_MODES);
    expect(both.breakdown['checks.dex.mode']).toEqual([
      rule('untrainedArmor', -1, -1),
      rule('untrainedShield', -1, 0),
    ]);
    expect(both.breakdown['skills.stealth.mode']).toEqual([
      { kind: 'entity', source: mail2014, label: mailName, value: -1, change: -1 },
      rule('untrainedArmor', -1, 0),
      rule('untrainedShield', -1, 0),
    ]);
    expect(both.breakdown['spell.cannotCast']).toEqual([
      rule('untrainedArmor', 1, 1),
      rule('untrainedShield', 1, 0),
    ]);
    expect(codes(both)).toEqual([
      warned('armor.untrained', mail2014),
      warned('shield.untrained', shield2014),
    ]);

    const alone = computed(wearing(goldenC2014, true, [row(2, shield2014)]));
    expect(valuesOf(alone, ['armor.untrained', 'shield.untrained', 'spell.cannotCast'])).toEqual({
      'armor.untrained': 0,
      'shield.untrained': 1,
      'spell.cannotCast': 1,
    });
    // 10 + DEX 0, + 2.
    expect(valuesOf(alone, ['ac.base', 'ac.bonus', 'ac.total'])).toEqual({
      'ac.base': 10,
      'ac.bonus': 2,
      'ac.total': 12,
    });
    expect(modesNotZero(alone)).toEqual(STR_DEX_MODES);
    expect(alone.breakdown['skills.stealth.mode']).toEqual([rule('untrainedShield', -1, -1)]);
    expect(codes(alone)).toEqual([warned('shield.untrained', shield2014)]);
  });

  it('judges each item by its own training: golden C has a shield, no heavy armor', () => {
    const result = computed(wearing(goldenC2014, false, [row(1, mail2014), row(2, shield2014)]));
    expect(valuesOf(result, ['armor.untrained', 'shield.untrained', 'spell.cannotCast'])).toEqual({
      'armor.untrained': 1,
      'shield.untrained': 0,
      'spell.cannotCast': 1,
    });
    expect(result.breakdown['checks.str.mode']).toEqual([rule('untrainedArmor', -1, -1)]);
    expect(codes(result)).toEqual([warned('armor.untrained', mail2014)]);
  });

  it('judges only the armor worn: not one carried, not a second that counts for nothing', () => {
    const carried = computed(wearing(goldenC2014, false, [row(1, mail2014, false)]));
    const second = computed(
      wearing(goldenC2014, false, [row(1, quilt.id), row(2, mail2014)], [quilt]),
    );
    for (const result of [carried, second]) {
      expect(valuesOf(result, ['armor.untrained', 'spell.cannotCast'])).toEqual({
        'armor.untrained': 0,
        'spell.cannotCast': 0,
      });
      expect(modesNotZero(result)).toEqual({});
    }
    expect(codes(carried)).toEqual([]);
    expect(codes(second)).toEqual([
      {
        code: 'stepRule',
        path: 'armor.worn',
        rule: 'oneAtATime',
        data: { item: mail2014, worn: quilt.id },
      },
    ]);
  });

  it("gives a weapon attack disadvantage by the attack's stat", () => {
    const result = computed(
      wearing(goldenC2014, true, [row(1, mail2014), row(3, 'srd-2014:item/warhammer')]),
    );
    expect(result.values['attacks.warhammer.mode']).toBe(-1);
    expect(result.breakdown['attacks.warhammer.mode']).toEqual([rule('untrainedArmor', -1, -1)]);
    expect(modeCount(result)).toBe(MODES + 1);
  });

  it("follows a skill's stat", () => {
    const result = computed(wearing(goldenC2014, true, [row(1, mail2014)], [swapped]));
    expect(valuesOf(result, ['skills.arcana.mode', 'skills.athletics.mode'])).toEqual({
      'skills.arcana.mode': -1,
      'skills.athletics.mode': 0,
    });
    expect(result.breakdown['skills.arcana.mode']).toEqual([rule('untrainedArmor', -1, -1)]);
    expect(result.breakdown['skills.athletics.mode']).toEqual([]);
  });

  it("takes an armor's training from a proficiency naming its own key", () => {
    const result = computed(wearing(goldenC2014, true, [row(1, mail2014)], [mailed]));
    expect(valuesOf(result, ['armor.untrained', 'spell.cannotCast'])).toEqual({
      'armor.untrained': 0,
      'spell.cannotCast': 0,
    });
    // The chain mail's own Stealth rule only.
    expect(modesNotZero(result)).toEqual({ 'skills.stealth.mode': -1 });
    expect(codes(result)).toEqual([]);
  });

  it('gives the 2024 wizard in chain mail the same penalties', () => {
    const result = computed(wearing(goldenC2024, true, [row(1, mail2024)]));
    expect(valuesOf(result, ['armor.untrained', 'shield.untrained', 'spell.cannotCast'])).toEqual({
      'armor.untrained': 1,
      'shield.untrained': 0,
      'spell.cannotCast': 1,
    });
    expect(modesNotZero(result)).toEqual(STR_DEX_MODES);
    expect(modeCount(result)).toBe(MODES);
    expect(result.breakdown['skills.acrobatics.mode']).toEqual([rule('untrainedArmor', -1, -1)]);
    expect(codes(result)).toEqual([warned('armor.untrained', mail2024)]);
  });

  it("takes a 2024 shield's AC away without training, and nothing else", () => {
    const result = computed(wearing(goldenC2024, true, [row(2, kite.id)], [kite]));
    expect(valuesOf(result, ['shield', 'shield.untrained', 'spell.cannotCast'])).toEqual({
      shield: 1,
      'shield.untrained': 1,
      'spell.cannotCast': 0,
    });
    // 10 + DEX 0; neither the +2 nor the +1; the +1 initiative stays.
    expect(valuesOf(result, ['ac.base', 'ac.bonus', 'ac.total', 'init.bonus'])).toEqual({
      'ac.base': 10,
      'ac.bonus': 0,
      'ac.total': 10,
      'init.bonus': 1,
    });
    expect(result.breakdown['ac.bonus']).toEqual([rule('untrainedShield', 0, 0)]);
    expect(result.breakdown['spell.cannotCast']).toEqual([]);
    expect(modesNotZero(result)).toEqual({});
    const had = result.entities.find(({ entity }) => entity.id === kite.id);
    expect(had?.suppressed).toEqual(['ac']);
    expect(codes(result)).toEqual([warned('shield.untrained', kite.id)]);

    // Golden C's paladin gives `shield`: 10 + the +1 + the +2.
    const trained = computed(wearing(goldenC2024, false, [row(2, kite.id)], [kite]));
    expect(valuesOf(trained, ['shield.untrained', 'ac.bonus', 'ac.total'])).toEqual({
      'shield.untrained': 0,
      'ac.bonus': 3,
      'ac.total': 13,
    });
    expect(trained.entities.find(({ entity }) => entity.id === kite.id)).not.toHaveProperty(
      'suppressed',
    );
    expect(codes(trained)).toEqual([]);
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const input = wearing(goldenC2024, true, [row(1, mail2024), row(2, kite.id)], [kite]);
    const character = opened(openFifthEditionCharacter(input));
    const frozen = opened(openFifthEditionCharacter(input));
    const freeze = <T>(value: T): T => {
      if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const inner of Object.values(value)) freeze(inner);
      }
      return value;
    };
    freeze(frozen);
    const first = compute(frozen, index2024.index, fifthEditionModule);
    expect(compute(frozen, index2024.index, fifthEditionModule)).toEqual(first);
    expect(first).toEqual(compute(character, index2024.index, fifthEditionModule));
  });
});
