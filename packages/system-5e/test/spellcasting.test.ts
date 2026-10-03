import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  casterShare,
  castsAt,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  MULTICLASS_SLOTS,
  openFifthEditionCharacter,
  openFifthEditionPack,
  RULES_2014,
  RULES_2024,
  rulesOf,
  type SpellcastingDef,
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

// ENG-15: fifth edition's spellcasting numbers. The rules are ENG-15 §8's: both SRDs' save DC,
// attack bonus, multiclass rule and table, read from 5e-database and dnd5e. The character's own
// entities (`character:`) are made up, no text of a book; each value below was worked out by hand
// from them and from the goldens' scores, never copied from a run. ENG-34: every character has
// `spell.attackMode`, 0 for each one here: none has an effect on `roll.attack.spell` or `.all`.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** A character opened as a file would be, so it is valid, then computed on its edition's pack. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  const one = opened(openFifthEditionCharacter(character));
  const { index } = one.ruleset === '2014' ? index2014 : index2024;
  return compute(one, index, fifthEditionModule);
}

/** Path → value, for every path that starts with one of `prefixes`, in the order computed. */
function valuesUnder(result: Computed<FifthEditionEntity>, ...prefixes: string[]) {
  return Object.fromEntries(
    Object.entries(result.values).filter(([path]) =>
      prefixes.some((prefix) => path.startsWith(prefix)),
    ),
  );
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

/** A pack's class's spellcasting, read from the golden fixtures. */
function spellcastingOf(pack: { entities: readonly unknown[] }, id: string): SpellcastingDef {
  const entity = (pack.entities as EntityInput[]).find((each) => each.id === id);
  if (entity?.type !== 'class' || entity.spellcasting === undefined) throw new Error(id);
  return entity.spellcasting;
}

/** The nine slot paths, the levels with none left out of `slots`, which lists levels from 1. */
function slotsOf(...slots: number[]) {
  return Object.fromEntries(
    Array.from({ length: 9 }, (_, at) => [`spell.slots.level${at + 1}`, slots[at] ?? 0]),
  );
}

/** One number per class level, from level 1, made by `at` (0 for level 1). */
const column = (at: (index: number) => number) =>
  Array.from({ length: 20 }, (_, index) => at(index));

/** One slot row per class level, from level 1, made by `at` (0 for level 1). */
const rows = (at: (index: number) => number[]) =>
  Array.from({ length: 20 }, (_, index) => at(index));

const source = { pack: 'character' };

/** A made-up class's fields, with its spellcasting. */
function caster(slug: string, spellcasting: SpellcastingDef): EntityInput {
  return {
    id: `character:class/${slug}`,
    type: 'class',
    key: slug,
    ruleset: 'any',
    name: { en: slug },
    source,
    hitDie: 8,
    saves: ['wis', 'cha'],
    subclassLevel: 3,
    spellcasting,
  };
}

/** A made-up half caster's spellcasting, with no table and no columns: it casts from level 1. */
const wardenCasting: SpellcastingDef = {
  ability: 'wis',
  progression: 'half',
  preparation: 'known',
  spellList: { classKey: 'warden' },
};
const warden = caster('warden', wardenCasting);

/** A made-up pact caster: one slot level per row, two cantrips at every level. */
const hexer = caster('hexer', {
  ability: 'cha',
  progression: 'pact',
  preparation: 'known',
  cantripsKnown: column(() => 2),
  slotsTable: rows((at) => (at === 0 ? [1] : at === 1 ? [2] : at < 4 ? [0, 2] : [0, 0, 2])),
  spellList: { classKey: 'hexer' },
});

/** A made-up full caster by a stat no pack has, whose prepared count does not parse. */
const mystic = caster('mystic', {
  ability: 'san',
  progression: 'full',
  preparation: 'prepared',
  preparedCount: 'max(1,',
  spellList: { classKey: 'mystic' },
});

/** A made-up fighter subclass that casts as a third caster, from fighter level 3. */
const spellblade: EntityInput = {
  id: 'character:subclass/spellblade',
  type: 'subclass',
  key: 'spellblade',
  classKey: 'fighter',
  ruleset: 'any',
  name: { en: 'Spellblade' },
  source,
  spellcasting: {
    ability: 'int',
    progression: 'third',
    preparation: 'known',
    cantripsKnown: column((at) => (at < 2 ? 0 : 2)),
    spellsKnown: column((at) => (at < 2 ? 0 : at + 1)),
    slotsTable: rows((at) => (at < 2 ? [] : at === 2 ? [2] : [3])),
    spellList: { classKey: 'wizard' },
  },
};

/** A made-up feat: the two bonus targets, one slot, and every d20 test. */
const focused: EntityInput = {
  id: 'character:feat/focused',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Focused' },
  source,
  effects: [
    { id: 'dc', target: 'spell.dc.bonus', op: 'add', value: 1 },
    { id: 'attack', target: 'spell.attack.bonus', op: 'add', value: 2 },
    { id: 'slot', target: 'spell.slots.level1', op: 'add', value: 1 },
    { id: 'd20', target: 'd20.all.bonus', op: 'add', value: -1 },
  ],
};

/** A golden character with other classes. */
function withClasses(
  golden: CharacterInput,
  classes: CharacterInput['systemData']['classes'],
  localEntities: EntityInput[] = [],
): CharacterInput {
  return { ...golden, localEntities, systemData: { ...golden.systemData, classes } };
}

describe('ENG-15 spellcasting', () => {
  it("holds both SRDs' multiclass table, equal to the cleric's and the wizard's own", () => {
    expect(MULTICLASS_SLOTS).toEqual(spellcastingOf(srd2014, 'srd-2014:class/cleric').slotsTable);
    expect(MULTICLASS_SLOTS).toEqual(spellcastingOf(srd2024, 'srd-2024:class/wizard').slotsTable);
    expect(MULTICLASS_SLOTS[3]).toEqual([4, 3]);
    expect(MULTICLASS_SLOTS[4]).toEqual([4, 3, 2]);
  });

  it("rounds half a caster's levels down in 2014 and up in 2024, a third down in both", () => {
    expect(rulesOf({ ruleset: '2014' })).toBe(RULES_2014);
    expect(rulesOf({ ruleset: '2024' })).toBe(RULES_2024);
    const levels = column((at) => at + 1);
    const shares = (progression: 'full' | 'half' | 'third', rules = RULES_2014) =>
      levels.map((level) => casterShare(progression, level, rules));
    expect(shares('full')).toEqual(levels);
    expect(shares('half')).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10]);
    expect(shares('half', RULES_2024)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
    ]);
    const third = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6];
    expect(shares('third')).toEqual(third);
    expect(shares('third', RULES_2024)).toEqual(third);
    // Alone: the levels divided, rounded up, once the share is above 0 (dnd5e).
    const alone = (progression: 'full' | 'half' | 'third', rules = RULES_2014) =>
      levels.map((level) => casterShare(progression, level, rules, true));
    expect(alone('full')).toEqual(levels);
    expect(alone('half')).toEqual([0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
    expect(alone('half', RULES_2024)).toEqual(shares('half', RULES_2024));
    const thirdAlone = [0, 0, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7];
    expect(alone('third')).toEqual(thirdAlone);
    expect(alone('third', RULES_2024)).toEqual(thirdAlone);
  });

  it("gives a lone half caster the SRD paladin's own table from the multiclass one, both editions", () => {
    const fromMulticlass = (rules: typeof RULES_2014) =>
      column((at) => casterShare('half', at + 1, rules, true)).map((share) =>
        share === 0 ? [] : MULTICLASS_SLOTS[share - 1],
      );
    expect(fromMulticlass(RULES_2014)).toEqual(
      spellcastingOf(srd2014, 'srd-2014:class/paladin').slotsTable,
    );
    expect(fromMulticlass(RULES_2024)).toEqual(
      spellcastingOf(srd2024, 'srd-2024:class/paladin').slotsTable,
    );
  });

  it('starts the 2014 paladin casting at level 2, the 2024 one and the cleric at level 1', () => {
    const casts = (def: SpellcastingDef) => column((at) => (castsAt(def, at + 1) ? 1 : 0));
    const paladin2014 = spellcastingOf(srd2014, 'srd-2014:class/paladin');
    expect(casts(paladin2014)).toEqual(column((at) => (at === 0 ? 0 : 1)));
    expect(casts(spellcastingOf(srd2024, 'srd-2024:class/paladin'))).toEqual(column(() => 1));
    expect(casts(spellcastingOf(srd2014, 'srd-2014:class/cleric'))).toEqual(column(() => 1));
    // Made up: cantrips alone, from level 2; neither column, from level 1.
    const cantripsOnly: SpellcastingDef = {
      ability: 'wis',
      progression: 'none',
      preparation: 'known',
      cantripsKnown: column((at) => (at === 0 ? 0 : 2)),
      spellList: { classKey: 'warden' },
    };
    expect(casts(cantripsOnly)).toEqual(column((at) => (at === 0 ? 0 : 1)));
    expect(casts(wardenCasting)).toEqual(column(() => 1));
  });

  it("gives golden A's numbers, each with its breakdown", () => {
    const a = computed(goldenA);
    // WIS 16 → +3, level 1 → +2.
    expect(valuesUnder(a, 'classes.cleric.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.cleric.spell.dc': 13,
      'classes.cleric.spell.attack': 5,
      'classes.cleric.spell.prepared': 4,
      'classes.cleric.spell.cantrips': 3,
      'spell.casterLevel': 1,
      ...slotsOf(2),
    });
    const cleric = { source: 'srd-2014:class/cleric', label: { en: 'Cleric' } };
    expect(a.breakdown['classes.cleric.spell.dc']).toEqual([
      { kind: 'rule', rule: 'spellDcBase', value: 8, change: 8 },
      { kind: 'path', path: 'abilities.wis.mod', value: 3, change: 3 },
      { kind: 'path', path: 'prof', value: 2, change: 2 },
      { kind: 'path', path: 'spell.dc.bonus', value: 0, change: 0 },
    ]);
    expect(a.breakdown['classes.cleric.spell.attack']).toEqual([
      { kind: 'path', path: 'abilities.wis.mod', value: 3, change: 3 },
      { kind: 'path', path: 'prof', value: 2, change: 2 },
      { kind: 'path', path: 'spell.attack.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'attack.spell.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'd20.all.bonus', value: 0, change: 0 },
    ]);
    expect(a.breakdown['classes.cleric.spell.prepared']).toEqual([
      {
        kind: 'entity',
        ...cleric,
        formula: 'max(1, @abilities.wis.mod + @classes.cleric.level)',
        value: 4,
        change: 4,
      },
    ]);
    expect(a.breakdown['classes.cleric.spell.cantrips']).toEqual([
      { kind: 'entity', ...cleric, value: 3, change: 3 },
    ]);
    expect(a.breakdown['spell.casterLevel']).toEqual([
      { kind: 'path', path: 'classes.cleric.level', value: 1, change: 1 },
    ]);
    expect(a.breakdown['spell.slots.level1']).toEqual([
      { kind: 'entity', ...cleric, value: 2, change: 2 },
    ]);
    expect(a.breakdown['spell.slots.level2']).toEqual([]);
  });

  it("gives golden C's numbers per class and its slots by the multiclass table, both editions", () => {
    // INT 15 → +2, CHA 14 → +2, level 6 → +3. Wizard: max(1, 2 + 3); paladin: max(1, 2 + ⌊3/2⌋).
    const c2014 = computed(goldenC2014);
    expect(valuesUnder(c2014, 'classes.', 'spell.')).toEqual({
      'classes.wizard.level': 3,
      'classes.paladin.level': 3,
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.wizard.spell.dc': 13,
      'classes.wizard.spell.attack': 5,
      'classes.wizard.spell.prepared': 5,
      'classes.wizard.spell.cantrips': 3,
      'classes.paladin.spell.dc': 13,
      'classes.paladin.spell.attack': 5,
      'classes.paladin.spell.prepared': 3,
      'spell.casterLevel': 4,
      ...slotsOf(4, 3),
    });
    expect(c2014.breakdown['spell.casterLevel']).toEqual([
      { kind: 'path', path: 'classes.wizard.level', value: 3, change: 3 },
      { kind: 'path', path: 'classes.paladin.level', value: 3, change: 1 },
    ]);
    expect(c2014.breakdown['spell.slots.level2']).toEqual([
      { kind: 'path', path: 'spell.casterLevel', value: 4, change: 3 },
    ]);
    expect(c2014.breakdown['spell.slots.level3']).toEqual([]);

    // 2024: the wizard's column at 3 is 6, the paladin's 4; the paladin adds ⌈3/2⌉.
    const c2024 = computed(goldenC2024);
    expect(valuesUnder(c2024, 'classes.wizard.spell.', 'classes.paladin.spell.', 'spell.')).toEqual(
      {
        'spell.dc.bonus': 0,
        'spell.attack.bonus': 0,
        'spell.attackMode': 0,
        'classes.wizard.spell.dc': 13,
        'classes.wizard.spell.attack': 5,
        'classes.wizard.spell.prepared': 6,
        'classes.wizard.spell.cantrips': 3,
        'classes.paladin.spell.dc': 13,
        'classes.paladin.spell.attack': 5,
        'classes.paladin.spell.prepared': 4,
        'spell.casterLevel': 5,
        ...slotsOf(4, 3, 2),
      },
    );
    expect(c2024.breakdown['classes.paladin.spell.prepared']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2024:class/paladin',
        label: { en: 'Paladin' },
        value: 4,
        change: 4,
      },
    ]);
    expect(c2024.breakdown['spell.casterLevel']?.[1]).toEqual({
      kind: 'path',
      path: 'classes.paladin.level',
      value: 3,
      change: 2,
    });
  });

  it('leaves a 2014 paladin 1 out, so the wizard reads its own table; a 2024 one casts', () => {
    // Level 4 → +2. 2014: the wizard alone, its row 3. 2024: 3 + ⌈1/2⌉ = 4, the table's row 4.
    const classes = [
      { id: 'srd-2014:class/wizard', level: 3, hp: ['max', 'avg', 'avg'] },
      { id: 'srd-2014:class/paladin', level: 1, hp: ['avg'] },
    ] satisfies CharacterInput['systemData']['classes'];
    const c2014 = computed(withClasses(goldenC2014, classes));
    expect(valuesUnder(c2014, 'classes.paladin.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'spell.casterLevel': 3,
      ...slotsOf(4, 2),
    });
    expect(c2014.values['classes.wizard.spell.dc']).toBe(12);
    expect(c2014.breakdown['spell.slots.level2']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2014:class/wizard',
        label: { en: 'Wizard' },
        value: 2,
        change: 2,
      },
    ]);
    const c2024 = computed(
      withClasses(goldenC2024, [
        { id: 'srd-2024:class/wizard', level: 3, hp: ['max', 'avg', 'avg'] },
        { id: 'srd-2024:class/paladin', level: 1, hp: ['avg'] },
      ]),
    );
    expect(valuesUnder(c2024, 'classes.paladin.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.paladin.spell.dc': 12,
      'classes.paladin.spell.attack': 4,
      'classes.paladin.spell.prepared': 2,
      'spell.casterLevel': 4,
      ...slotsOf(4, 3),
    });
    expect(c2014.warnings).toEqual([]);
    expect(c2024.warnings).toEqual([]);
  });

  it('gives a lone class without a table the multiclass row at its share, by its edition', () => {
    // Warden 5, alone: ⌈5/2⌉ = 3 in both editions, row 3. Level 5 → +3.
    const warden5: CharacterInput['systemData']['classes'] = [
      { id: 'character:class/warden', level: 5, hp: ['max', 1, 1, 1, 1] },
    ];
    const in2014 = computed(withClasses(goldenC2014, warden5, [warden]));
    const in2024 = computed(withClasses(goldenB, warden5, [warden]));
    // WIS 8 → −1 (golden C), WIS 12 → +1 (golden B).
    expect(valuesUnder(in2014, 'classes.warden.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.warden.spell.dc': 10,
      'classes.warden.spell.attack': 2,
      'spell.casterLevel': 3,
      ...slotsOf(4, 2),
    });
    expect(valuesUnder(in2024, 'classes.warden.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.warden.spell.dc': 12,
      'classes.warden.spell.attack': 4,
      'spell.casterLevel': 3,
      ...slotsOf(4, 2),
    });
    expect(in2014.breakdown['spell.casterLevel']).toEqual([
      { kind: 'path', path: 'classes.warden.level', value: 5, change: 3 },
    ]);
    expect(in2024.breakdown['spell.slots.level1']).toEqual([
      { kind: 'path', path: 'spell.casterLevel', value: 3, change: 4 },
    ]);
    expect(in2014.warnings).toEqual([]);
    expect(in2024.warnings).toEqual([]);

    // Warden 1: ⌊1/2⌋ = 0 in 2014, no slot; ⌈1/2⌉ = 1 in 2024, row 1.
    const warden1: CharacterInput['systemData']['classes'] = [
      { id: 'character:class/warden', level: 1, hp: ['max'] },
    ];
    const one2014 = computed(withClasses(goldenC2014, warden1, [warden]));
    const one2024 = computed(withClasses(goldenB, warden1, [warden]));
    expect(valuesUnder(one2014, 'spell.casterLevel', 'spell.slots.')).toEqual({
      'spell.casterLevel': 0,
      ...slotsOf(),
    });
    expect(valuesUnder(one2024, 'spell.casterLevel', 'spell.slots.')).toEqual({
      'spell.casterLevel': 1,
      ...slotsOf(2),
    });
  });

  it('rounds each half caster on its own, then adds the shares (dnd5e, ENG-15 §4)', () => {
    // 2014 paladin 3 and warden 3: ⌊3/2⌋ + ⌊3/2⌋ = 2, the table's row 2; not ⌊6/2⌋ = 3.
    const both = computed(
      withClasses(
        goldenC2014,
        [
          { id: 'srd-2014:class/paladin', level: 3, hp: ['max', 'avg', 'avg'] },
          { id: 'character:class/warden', level: 3, hp: [1, 1, 1] },
        ],
        [warden],
      ),
    );
    expect(valuesUnder(both, 'spell.casterLevel', 'spell.slots.')).toEqual({
      'spell.casterLevel': 2,
      ...slotsOf(3),
    });
    expect(both.warnings).toEqual([]);
  });

  it("casts by a subclass's spellcasting under its class's key, from the level its table starts", () => {
    // Fighter 4, INT 8 → −1, +2: DC 8 − 1 + 2, attack −1 + 2; its row 4; alone, ⌈4/3⌉ = 2.
    const subclassed = (golden: CharacterInput): CharacterInput => ({
      ...golden,
      localEntities: [spellblade],
      systemData: {
        ...golden.systemData,
        classes: golden.systemData.classes.map((entry) => ({
          ...entry,
          subclass: 'character:subclass/spellblade',
        })),
      },
    });
    const b4 = computed(subclassed(goldenB4));
    expect(valuesUnder(b4, 'classes.fighter.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.fighter.spell.dc': 9,
      'classes.fighter.spell.attack': 1,
      'classes.fighter.spell.cantrips': 2,
      'classes.fighter.spell.known': 4,
      'spell.casterLevel': 2,
      ...slotsOf(3),
    });
    const spellbladeStep = {
      kind: 'entity',
      source: 'character:subclass/spellblade',
      label: { en: 'Spellblade' },
    };
    expect(b4.breakdown['classes.fighter.spell.known']).toEqual([
      { ...spellbladeStep, value: 4, change: 4 },
    ]);
    expect(b4.breakdown['spell.slots.level1']).toEqual([
      { ...spellbladeStep, value: 3, change: 3 },
    ]);
    expect(b4.warnings).toEqual([]);
    // Fighter 1: no slot and no cantrip yet, so no spellcasting path.
    const b = computed(subclassed(goldenB));
    expect(Object.keys(valuesUnder(b, 'classes.fighter.spell.', 'spell.'))).toEqual([
      'spell.dc.bonus',
      'spell.attack.bonus',
      'spell.attackMode',
    ]);
  });

  it('keeps pact slots apart from the caster level, alone and beside a wizard', () => {
    // Hexer 3: its row 3 is two slots of level 2. Golden B: CHA 10 → +0, level 3 → +2.
    const alone = computed(
      withClasses(goldenB, [{ id: 'character:class/hexer', level: 3, hp: ['max', 1, 1] }], [hexer]),
    );
    expect(valuesUnder(alone, 'classes.hexer.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.hexer.spell.dc': 10,
      'classes.hexer.spell.attack': 2,
      'classes.hexer.spell.cantrips': 2,
      'spell.pact.level': 2,
      'spell.pact.slots': 2,
    });
    const hexerStep = { kind: 'entity', source: 'character:class/hexer', label: { en: 'hexer' } };
    expect(alone.breakdown['spell.pact.level']).toEqual([{ ...hexerStep, value: 2, change: 2 }]);
    // Beside wizard 3 (golden C 2024): the wizard alone casts by slots, its own row 3. CHA +2, +3.
    const beside = computed(
      withClasses(
        goldenC2024,
        [
          { id: 'srd-2024:class/wizard', level: 3, hp: ['max', 'avg', 'avg'] },
          { id: 'character:class/hexer', level: 3, hp: [1, 1, 1] },
        ],
        [hexer],
      ),
    );
    expect(valuesUnder(beside, 'classes.hexer.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.hexer.spell.dc': 13,
      'classes.hexer.spell.attack': 5,
      'classes.hexer.spell.cantrips': 2,
      'spell.casterLevel': 3,
      ...slotsOf(4, 2),
      'spell.pact.level': 2,
      'spell.pact.slots': 2,
    });
    expect(alone.warnings).toEqual([]);
    expect(beside.warnings).toEqual([]);
  });

  it('applies effects on the bonus targets and a slot; the attack reads d20 tests, the DC not', () => {
    const result = computed({
      ...goldenA,
      localEntities: [focused],
      systemData: { ...goldenA.systemData, feats: [{ id: 'character:feat/focused' }] },
    });
    // DC 13 + 1; attack 3 + 2 + 2 − 1; slots 2 + 1.
    expect(
      valuesUnder(
        result,
        'classes.cleric.spell.dc',
        'classes.cleric.spell.attack',
        'spell.slots.level1',
      ),
    ).toEqual({
      'classes.cleric.spell.dc': 14,
      'classes.cleric.spell.attack': 6,
      'spell.slots.level1': 3,
    });
    expect(result.breakdown['classes.cleric.spell.attack']?.slice(2)).toEqual([
      { kind: 'path', path: 'spell.attack.bonus', value: 2, change: 2 },
      { kind: 'path', path: 'attack.spell.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'd20.all.bonus', value: -1, change: -1 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('reads a stat the character lacks as 0 and a prepared formula that does not parse as 0', () => {
    // Mystic 1 on golden B: no `san`, level 1 → +2; a lone full caster with no table: row 1.
    const result = computed(
      withClasses(goldenB, [{ id: 'character:class/mystic', level: 1, hp: ['max'] }], [mystic]),
    );
    expect(valuesUnder(result, 'classes.mystic.spell.', 'spell.')).toEqual({
      'spell.dc.bonus': 0,
      'spell.attack.bonus': 0,
      'spell.attackMode': 0,
      'classes.mystic.spell.dc': 10,
      'classes.mystic.spell.attack': 2,
      'classes.mystic.spell.prepared': 0,
      'spell.casterLevel': 1,
      ...slotsOf(2),
    });
    expect(codes(result)).toEqual([
      { code: 'missingPath', path: 'abilities.san.mod', for: 'classes.mystic.spell.dc' },
      { code: 'missingPath', path: 'abilities.san.mod', for: 'classes.mystic.spell.attack' },
      {
        code: 'stepFormula',
        path: 'classes.mystic.spell.prepared',
        warning: expect.objectContaining({ code: 'unexpected' }),
      },
    ]);
  });

  it('gives a character who casts nothing the bonus targets only', () => {
    const b = computed(goldenB);
    expect(Object.keys(b.values).filter((path) => path.includes('spell.'))).toEqual([
      'spell.dc.bonus',
      'spell.attack.bonus',
      'attack.spell.bonus',
      'spell.attackMode',
    ]);
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const character = opened(openFifthEditionCharacter(goldenC2024));
    const frozen = opened(openFifthEditionCharacter(goldenC2024));
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
