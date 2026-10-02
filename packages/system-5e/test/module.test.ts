import { type Computed, compute, evaluateNumber, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  FIFTH_EDITION_STAT_DEFAULTS,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
  proficiencyBonus,
} from '../src/index.ts';
import { opened, standingIn } from './golden/checks.ts';
import {
  goldenA,
  goldenB,
  goldenB4,
  goldenC2014,
  goldenC2024,
  goldenD,
  srd2014,
  srd2024,
} from './golden/index.ts';

// ENG-13: fifth edition's module. The rules' numbers are ENG-13 §8's: the SRD tables of modifiers
// and proficiency bonuses, and the multiclassing rules golden C's fixtures carry. The character's
// own entities (`character:`) are made up, no text of a book; each value below was worked out by
// hand from them.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = FifthEditionCharacter['localEntities'][number];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

/** A character opened as a file would be, so it is valid, then computed on its edition's pack. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  const one = opened(openFifthEditionCharacter(character));
  const { index } = one.ruleset === '2014' ? index2014 : index2024;
  return compute(one, index, standingIn);
}

/** Path → value, for the paths named. */
function valuesOf(result: Computed<FifthEditionEntity>, paths: readonly string[]) {
  return Object.fromEntries(paths.map((path) => [path, result.values[path]]));
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

const source = { pack: 'character' };

/** A made-up feat: two skill levels, a second source of one, a save, five bonus targets. */
const trained: EntityInput = {
  id: 'character:feat/trained',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Trained' },
  source,
  grants: [
    { id: 'expert', kind: 'proficiency', category: 'skill', fixed: ['perception'], level: 2 },
    { id: 'half', kind: 'proficiency', category: 'skill', fixed: ['stealth'], level: 0.5 },
    { id: 'again', kind: 'proficiency', category: 'skill', fixed: ['arcana'] },
    { id: 'save', kind: 'proficiency', category: 'save', fixed: ['dex'] },
  ],
  effects: [
    { id: 'skills', target: 'skills.all.bonus', op: 'add', value: 1 },
    { id: 'history', target: 'skills.history.bonus', op: 'add', value: 2 },
    { id: 'saves', target: 'saves.all.bonus', op: 'add', value: 1 },
    { id: 'con-save', target: 'abilities.con.saveBonus', op: 'add', value: 2 },
    { id: 'wis-checks', target: 'checks.wis.bonus', op: 'add', value: 1 },
  ],
};

/** A made-up feat with no grant: what `replaces` names it in place of. */
const keen: EntityInput = {
  id: 'character:feat/keen',
  type: 'feat',
  ruleset: 'any',
  name: { en: 'Keen' },
  source,
};

/**
 * A made-up class: a table with a number and a text column, its saves, a starting proficiency and
 * item, a proficiency at level 2, and what it gives as a later class.
 */
const scribe: EntityInput = {
  id: 'character:class/scribe',
  type: 'class',
  key: 'scribe',
  ruleset: 'any',
  name: { en: 'Scribe' },
  source,
  hitDie: 6,
  saves: ['int', 'cha'],
  subclassLevel: 3,
  levels: [{ level: 1, table: { inks: 2, title: 'Novice' } }],
  grants: [
    { id: 'tools', kind: 'proficiency', category: 'tool', fixed: ['quills'] },
    { id: 'kit', kind: 'item', atLevel: 1, fixed: [{ id: 'srd-2014:item/shield', qty: 1 }] },
    { id: 'late-tools', kind: 'proficiency', category: 'tool', atLevel: 2, fixed: ['seals'] },
  ],
  multiclass: {
    grants: [{ id: 'multiclass-tools', kind: 'proficiency', category: 'tool', fixed: ['ink'] }],
  },
};

describe("ENG-13 fifth edition's module", () => {
  it("gives SPEC §5.3's stat defaults; the modifier of each score 1 to 30 is the SRD table's", () => {
    expect(fifthEditionModule.statDefaults).toEqual({
      defaultMax: 20,
      modFormula: 'floor((@score - 10) / 2)',
      hasSave: true,
    });
    // The SRD's table: 1 is −5, 2–3 −4, …, 28–29 +9, 30 +10.
    const table = [-5, ...Array.from({ length: 29 }, (_, at) => Math.floor((at + 2) / 2) - 5)];
    expect(table.slice(0, 4)).toEqual([-5, -4, -4, -3]);
    expect(table.slice(-3)).toEqual([9, 9, 10]);
    const mods = table.map(
      (_, at) =>
        evaluateNumber(FIFTH_EDITION_STAT_DEFAULTS.modFormula, (path) =>
          path === 'score' ? at + 1 : undefined,
        ).value,
    );
    expect(mods).toEqual(table);
  });

  it("gives both editions' proficiency bonus at levels 1 to 20, and +2 at level 0", () => {
    const levels = Array.from({ length: 21 }, (_, level) => proficiencyBonus(level));
    expect(levels).toEqual([2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]);
  });

  it('names what systemData names, each class at its level, and adds the levels', () => {
    const b4 = opened(openFifthEditionCharacter(goldenB4));
    expect(fifthEditionModule.entities(b4)).toEqual([
      { id: 'srd-2024:species/human' },
      { id: 'srd-2024:background/soldier' },
      { id: 'srd-2024:class/fighter', level: 4 },
      { id: 'srd-2024:subclass/champion', level: 4 },
    ]);
    expect(fifthEditionModule.level(b4)).toBe(4);
    const c = opened(openFifthEditionCharacter(goldenC2014));
    expect(fifthEditionModule.level(c)).toBe(6);
  });

  it('gives a later class its multiclass grants, not its starting ones, nor its saves', () => {
    const given = (result: Computed<FifthEditionEntity>) =>
      result.proficiencies.map(({ category, key, from }) => `${category} ${key} ← ${from}`);
    const c2014 = computed(goldenC2014);
    expect(given(c2014)).toEqual([
      'weapon dagger ← srd-2014:class/wizard#weapons',
      'weapon dart ← srd-2014:class/wizard#weapons',
      'weapon sling ← srd-2014:class/wizard#weapons',
      'weapon quarterstaff ← srd-2014:class/wizard#weapons',
      'weapon crossbowLight ← srd-2014:class/wizard#weapons',
      'skill arcana ← srd-2014:class/wizard#skills',
      'skill history ← srd-2014:class/wizard#skills',
      'armor light ← srd-2014:class/paladin#multiclass-armor',
      'armor medium ← srd-2014:class/paladin#multiclass-armor',
      'armor shield ← srd-2014:class/paladin#multiclass-armor',
      'weapon simple ← srd-2014:class/paladin#multiclass-weapons',
      'weapon martial ← srd-2014:class/paladin#multiclass-weapons',
    ]);
    expect(c2014.pendingChoices).toEqual([]);
    const c2024 = computed(goldenC2024);
    expect(given(c2024).slice(3)).toEqual([
      'armor light ← srd-2024:class/paladin#multiclass-armor',
      'armor medium ← srd-2024:class/paladin#multiclass-armor',
      'armor shield ← srd-2024:class/paladin#multiclass-armor',
      'weapon martial ← srd-2024:class/paladin#multiclass-weapons',
    ]);
    expect(c2024.pendingChoices).toEqual([]);
    // The wizard's saves, INT and WIS, at +3; not the paladin's CHA. Modifiers: +2, −1, +2.
    expect(
      valuesOf(c2014, ['abilities.int.save', 'abilities.wis.save', 'abilities.cha.save']),
    ).toEqual({ 'abilities.int.save': 5, 'abilities.wis.save': 2, 'abilities.cha.save': 2 });
    expect(c2014.breakdown['abilities.int.saveProf']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2014:class/wizard',
        label: { en: 'Wizard' },
        value: 1,
        change: 1,
      },
    ]);
    expect(c2014.breakdown['abilities.cha.saveProf']).toEqual([]);
  });

  it("keeps a later class's grants after level 1, and leaves its starting items out", () => {
    const parts = (result: Computed<FifthEditionEntity>) =>
      result.grants.flatMap(({ part }) => (part.startsWith('character:') ? [part] : []));
    const later = computed({
      ...goldenC2014,
      localEntities: [scribe],
      systemData: {
        ...goldenC2014.systemData,
        classes: [
          ...goldenC2014.systemData.classes,
          { id: 'character:class/scribe', level: 2, hp: ['avg', 'avg'] },
        ],
      },
    });
    expect(parts(later)).toEqual([
      'character:class/scribe#late-tools',
      'character:class/scribe#multiclass-tools',
    ]);
    const first = computed({
      ...goldenB,
      localEntities: [scribe],
      systemData: {
        ...goldenB.systemData,
        classes: [{ id: 'character:class/scribe', level: 1, hp: ['max'] }],
      },
    });
    expect(parts(first)).toEqual(['character:class/scribe#tools', 'character:class/scribe#kit']);
    expect(first.warnings).toEqual([]);
  });

  it('gives no grant a feat is taken in place of, and reads no choice of it', () => {
    const replaced = computed({
      ...goldenB4,
      localEntities: [keen],
      systemData: {
        ...goldenB4.systemData,
        feats: [{ id: 'character:feat/keen', replaces: 'srd-2024:class/fighter#ability-scores-4' }],
      },
    });
    expect(replaced.entities.map(({ entity }) => entity.id)).toContain('character:feat/keen');
    expect(replaced.grants.map(({ part }) => part)).not.toContain(
      'srd-2024:class/fighter#ability-scores-4',
    );
    // STR 15 + 2 from the Soldier, and no +2 at level 4.
    expect(
      valuesOf(replaced, ['abilities.str.score', 'abilities.str.mod', 'skills.athletics.total']),
    ).toEqual({ 'abilities.str.score': 17, 'abilities.str.mod': 3, 'skills.athletics.total': 5 });
    expect(replaced.pendingChoices).toEqual([]);
    expect(replaced.warnings).toEqual([]);
  });

  it("gives each class its level and its table's numbers at that level, a text column none", () => {
    const b4 = computed(goldenB4);
    expect(
      valuesOf(b4, [
        'classes.fighter.level',
        'classes.fighter.table.secondWindUses',
        'classes.fighter.table.weaponMastery',
      ]),
    ).toEqual({
      'classes.fighter.level': 4,
      'classes.fighter.table.secondWindUses': 3,
      'classes.fighter.table.weaponMastery': 4,
    });
    expect(b4.breakdown['classes.fighter.level']).toEqual([{ kind: 'base', value: 4, change: 4 }]);
    expect(b4.breakdown['classes.fighter.table.weaponMastery']).toEqual([
      {
        kind: 'entity',
        source: 'srd-2024:class/fighter',
        label: { en: 'Fighter' },
        value: 4,
        change: 4,
      },
    ]);
    const c = computed(goldenC2014);
    const classPaths = Object.keys(c.values).filter((path) => path.startsWith('classes.'));
    expect(classPaths).toEqual(['classes.wizard.level', 'classes.paladin.level']);

    // The scribe as a first class: a number column and a text one; its own saves, INT and CHA.
    const scribal = computed({
      ...goldenB,
      localEntities: [scribe],
      systemData: {
        ...goldenB.systemData,
        classes: [{ id: 'character:class/scribe', level: 1, hp: ['max'] }],
      },
    });
    const own = Object.keys(scribal.values).filter((path) => path.startsWith('classes.'));
    expect(own).toEqual(['classes.scribe.level', 'classes.scribe.table.inks']);
    // INT −1 + 2, CHA 0 + 2, STR 3 + 0: golden B's modifiers, the scribe's saves.
    expect(
      valuesOf(scribal, [
        'classes.scribe.table.inks',
        'abilities.int.save',
        'abilities.cha.save',
        'abilities.str.save',
      ]),
    ).toEqual({
      'classes.scribe.table.inks': 2,
      'abilities.int.save': 1,
      'abilities.cha.save': 2,
      'abilities.str.save': 3,
    });
    expect(scribal.warnings).toEqual([]);
  });

  it('lets a base-phase formula read a class level, and no other path of the module', () => {
    const climber: EntityInput = {
      ...keen,
      effects: [
        { id: 'str', target: 'abilities.str.score', op: 'add', value: '@classes.fighter.level' },
        { id: 'dex', target: 'abilities.dex.score', op: 'add', value: '@prof' },
      ],
    };
    const result = computed({
      ...goldenB,
      localEntities: [climber],
      systemData: { ...goldenB.systemData, feats: [{ id: 'character:feat/keen' }] },
    });
    // STR 17 + fighter 1; DEX 13, its effect refused.
    expect(valuesOf(result, ['abilities.str.score', 'abilities.dex.score'])).toEqual({
      'abilities.str.score': 18,
      'abilities.dex.score': 13,
    });
    expect(codes(result)).toEqual([
      { code: 'notInBasePhase', part: 'character:feat/keen#dex', paths: ['prof'] },
    ]);
  });

  it('takes the highest proficiency level, half rounded down, and each bonus target, at +3', () => {
    // Golden C (2014): level 6, +3. STR +1, DEX +0, CON +1, INT +2, WIS −1, CHA +2.
    const result = computed({
      ...goldenC2014,
      localEntities: [trained],
      systemData: { ...goldenC2014.systemData, feats: [{ id: 'character:feat/trained' }] },
    });
    expect(
      valuesOf(result, [
        'skills.perception.prof',
        'skills.perception.total',
        'skills.perception.passive',
        'skills.stealth.prof',
        'skills.stealth.total',
        'skills.arcana.total',
        'skills.history.total',
        'skills.athletics.total',
        'skills.insight.total',
      ]),
    ).toEqual({
      // −1 + 2 × 3 + 1 (every skill) + 1 (WIS checks); 10 + 7.
      'skills.perception.prof': 2,
      'skills.perception.total': 7,
      'skills.perception.passive': 17,
      // 0 + ⌊0.5 × 3⌋ + 1.
      'skills.stealth.prof': 0.5,
      'skills.stealth.total': 2,
      // 2 + 3 + 1, proficient twice, counted once.
      'skills.arcana.total': 6,
      // 2 + 3 + 2 (History's own) + 1.
      'skills.history.total': 8,
      'skills.athletics.total': 2,
      // −1 + 1 + 1.
      'skills.insight.total': 1,
    });
    // Each save + 1 (every save); DEX +3 from the feat, CON +2 its own, INT and WIS the wizard's.
    expect(
      Object.fromEntries(
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => [
          key,
          result.values[`abilities.${key}.save`],
        ]),
      ),
    ).toEqual({ str: 2, dex: 4, con: 4, int: 6, wis: 3, cha: 3 });
    expect(valuesOf(result, ['checks.wis.total', 'checks.str.total'])).toEqual({
      'checks.wis.total': 0,
      'checks.str.total': 1,
    });
    expect(result.breakdown['skills.perception.total']).toEqual([
      { kind: 'path', path: 'abilities.wis.mod', value: -1, change: -1 },
      { kind: 'path', path: 'prof', value: 3, change: 6 },
      { kind: 'path', path: 'skills.perception.bonus', value: 0, change: 0 },
      { kind: 'path', path: 'skills.all.bonus', value: 1, change: 1 },
      { kind: 'path', path: 'checks.wis.bonus', value: 1, change: 1 },
      { kind: 'path', path: 'd20.all.bonus', value: 0, change: 0 },
    ]);
    const trainedBy = (id: string, value: number) => ({
      kind: 'grant',
      part: `character:feat/trained#${id}`,
      source: 'character:feat/trained',
      label: { en: 'Trained' },
      value,
      change: value,
    });
    expect(result.breakdown['skills.perception.prof']).toEqual([trainedBy('expert', 2)]);
    expect(result.breakdown['abilities.dex.saveProf']).toEqual([trainedBy('save', 1)]);
    // An equal level keeps its first source: the wizard's.
    expect(result.breakdown['skills.arcana.prof']).toEqual([
      {
        kind: 'grant',
        part: 'srd-2014:class/wizard#skills',
        source: 'srd-2014:class/wizard',
        label: { en: 'Wizard' },
        value: 1,
        change: 1,
      },
    ]);
    expect(result.breakdown['skills.athletics.prof']).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("gives a pack's own stat a check and its skills a total; a stat without a save has none", () => {
    const san: EntityInput = {
      id: 'character:ability/san',
      type: 'ability',
      key: 'san',
      ruleset: 'any',
      name: { en: 'Sanity' },
      abbr: { en: 'SAN' },
      order: 6,
      hasSave: false,
      source,
    };
    const composure: EntityInput = {
      id: 'character:skill/composure',
      type: 'skill',
      key: 'composure',
      ruleset: 'any',
      name: { en: 'Composure' },
      ability: 'san',
      passive: true,
      source,
    };
    const result = computed({
      ...goldenB,
      abilities: { base: { ...goldenB.abilities.base, san: 14 } },
      localEntities: [san, composure],
    });
    expect(
      valuesOf(result, [
        'abilities.san.mod',
        'checks.san.total',
        'skills.composure.total',
        'skills.composure.passive',
      ]),
    ).toEqual({
      'abilities.san.mod': 2,
      'checks.san.total': 2,
      'skills.composure.total': 2,
      'skills.composure.passive': 12,
    });
    const saves = Object.keys(result.values).filter((path) => path.includes('.save'));
    expect(saves).toHaveLength(18);
    expect(saves.some((path) => path.startsWith('abilities.san.'))).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('totals a skill by its own formula; one that does not parse gives 0 and warns', () => {
    const skill = (slug: string, totalFormula: string): EntityInput => ({
      id: `character:skill/${slug}`,
      type: 'skill',
      key: slug,
      ruleset: 'any',
      name: { en: slug },
      ability: 'wis',
      totalFormula,
      passive: true,
      source,
    });
    const result = computed({
      ...goldenC2014,
      localEntities: [
        skill('omens', '@abilities.wis.mod + @abilities.int.mod'),
        skill('riddles', '@abilities.int.mod +'),
      ],
    });
    // WIS −1 + INT +2; 10 + 1.
    expect(
      valuesOf(result, [
        'skills.omens.total',
        'skills.omens.passive',
        'skills.riddles.total',
        'skills.riddles.passive',
      ]),
    ).toEqual({
      'skills.omens.total': 1,
      'skills.omens.passive': 11,
      'skills.riddles.total': 0,
      'skills.riddles.passive': 10,
    });
    expect(result.breakdown['skills.omens.total']).toEqual([
      {
        kind: 'formula',
        formula: '@abilities.wis.mod + @abilities.int.mod',
        of: 'skill',
        value: 1,
        change: 1,
      },
    ]);
    expect(codes(result)).toEqual([
      {
        code: 'stepFormula',
        path: 'skills.riddles.total',
        warning: expect.objectContaining({ code: 'unexpected' }),
      },
    ]);
  });

  it('takes exhaustion from every check, save, skill and passive value; one skill is passive', () => {
    // Golden D: golden B's values − 4. Not SPEC §6.7 lines: worked out by hand (ENG-13 §4).
    const d = computed(goldenD);
    expect(
      valuesOf(d, [
        'd20.all.bonus',
        'checks.str.total',
        'checks.dex.total',
        'abilities.con.save',
        'skills.perception.passive',
      ]),
    ).toEqual({
      'd20.all.bonus': -4,
      // STR +3, DEX +1.
      'checks.str.total': -1,
      'checks.dex.total': -3,
      // CON +2, +2 proficient.
      'abilities.con.save': 0,
      // 10 + 3 − 4: dnd5e adds the reduction to the passive score (ENG-13 §8).
      'skills.perception.passive': 9,
    });
    const passive = Object.keys(computed(goldenA).values).filter((path) =>
      path.endsWith('.passive'),
    );
    expect(passive).toEqual(['skills.perception.passive']);
  });

  it('gives a character with no class level 0, +2, and no save of a class', () => {
    const result = computed({
      ...goldenB,
      systemData: { ...goldenB.systemData, classes: [] },
    });
    // STR +3, not proficient; Perception +1, the fighter's proficiency gone.
    expect(
      valuesOf(result, ['level', 'prof', 'abilities.str.save', 'skills.perception.total']),
    ).toEqual({ level: 0, prof: 2, 'abilities.str.save': 3, 'skills.perception.total': 1 });
    expect(result.warnings).toEqual([]);
  });

  it('is pure: frozen inputs, and two runs give equal results', () => {
    const character = opened(openFifthEditionCharacter(goldenB4));
    const frozen = opened(openFifthEditionCharacter(goldenB4));
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
