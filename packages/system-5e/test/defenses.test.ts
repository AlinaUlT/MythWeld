import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  defensesOf,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { goldenC2014, goldenC2024, srd2014, srd2024 } from './golden/index.ts';

// SHEET-15: resistances, immunities and vulnerabilities. Golden C (level 6, both editions) with
// feats and a condition of the character's own (`character:`), made up, no text of a book. The
// 2014 pack has the damage type `bludgeoning`, the 2024 pack `slashing`; neither has `rust`. Each
// value below was worked out by hand from the entities here, never copied from a run.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = CharacterInput['localEntities'][number];

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

/** Golden C with these own entities, each feat taken, and these overrides and switches. */
function withOwn(
  golden: CharacterInput,
  localEntities: EntityInput[],
  more: { overrides?: CharacterInput['overrides']; toggles?: Record<string, boolean> } = {},
): CharacterInput {
  return {
    ...golden,
    localEntities,
    overrides: more.overrides ?? [],
    state: { ...golden.state, toggles: more.toggles ?? {} },
    systemData: {
      ...golden.systemData,
      feats: localEntities.flatMap(({ id, type }) => (type === 'feat' ? [{ id }] : [])),
    },
  };
}

/** Path → value of every defense path. */
function defensePaths(result: Computed<FifthEditionEntity>) {
  return Object.fromEntries(
    Object.entries(result.values).filter(([path]) => path.startsWith('defenses.')),
  );
}

/** The warnings without their log message. */
function codes(result: Computed<FifthEditionEntity>) {
  return result.warnings.map(({ message: _, ...warning }) => warning);
}

const source = { pack: 'character' };

/** A made-up feat with these effects. */
function feat(slug: string, effects: unknown[]): EntityInput {
  return {
    id: `character:feat/${slug}`,
    type: 'feat',
    ruleset: 'any',
    name: { en: slug },
    source,
    effects,
  } as EntityInput;
}

/** A made-up condition, `dazed`. */
const dazed = {
  id: 'character:condition/dazed',
  type: 'condition',
  key: 'dazed',
  ruleset: 'any',
  name: { en: 'Dazed' },
  source,
} as EntityInput;

/** Resists bludgeoning, is immune to `rust` (no pack has it) and to `dazed`. */
const stony = feat('stony', [
  { id: 'blunt', target: 'defenses.resist', op: 'append', value: 'bludgeoning' },
  { id: 'rust', target: 'defenses.immune', op: 'append', value: 'rust' },
  { id: 'dazed', target: 'defenses.conditionImmune', op: 'append', value: 'dazed' },
  // Level 6 is below 20, so this one does not apply.
  { id: 'late', target: 'defenses.vuln', op: 'append', value: 'bludgeoning', when: '@level >= 20' },
]);

/** Resists bludgeoning a second time; immune to it while switched on (off by default). */
const tough = feat('tough', [
  { id: 'blunt', target: 'defenses.resist', op: 'append', value: 'bludgeoning' },
  {
    id: 'brace',
    target: 'defenses.immune',
    op: 'append',
    value: 'bludgeoning',
    toggle: { label: { en: 'Brace' }, default: false },
  },
]);

const effect = (slug: string, id: string, change: number) => ({
  kind: 'effect',
  part: `character:feat/${slug}#${id}`,
  source: `character:feat/${slug}`,
  label: { en: slug },
  op: 'append',
  value: 1,
  change,
});

describe('SHEET-15 defenses from effects', () => {
  it('gives a character with no such effect no defense path', () => {
    const result = computed(goldenC2014);
    expect(defensePaths(result)).toEqual({});
    expect(defensesOf(result.values)).toEqual({
      resist: [],
      immune: [],
      vuln: [],
      conditionImmune: [],
    });
  });

  it('gives each appended key a path, 1 while an effect applies, else 0', () => {
    const result = computed(withOwn(goldenC2014, [stony, dazed]));
    expect(defensePaths(result)).toEqual({
      'defenses.resist.bludgeoning': 1,
      'defenses.immune.rust': 1,
      'defenses.conditionImmune.dazed': 1,
      'defenses.vuln.bludgeoning': 0,
    });
    expect(result.breakdown['defenses.resist.bludgeoning']).toEqual([effect('stony', 'blunt', 1)]);
    expect(result.breakdown['defenses.vuln.bludgeoning']).toEqual([]);
    expect(defensesOf(result.values)).toEqual({
      resist: ['bludgeoning'],
      immune: ['rust'],
      vuln: [],
      conditionImmune: ['dazed'],
    });
  });

  it('warns of a key no entry of its type has, and still counts it', () => {
    const result = computed(withOwn(goldenC2014, [stony, dazed]));
    expect(codes(result)).toEqual([
      {
        code: 'stepRule',
        path: 'defenses.immune.rust',
        rule: 'defenseMissing',
        data: { list: 'immune', key: 'rust' },
      },
    ]);
    // Without its own entry, `dazed` is missing too.
    const without = computed(withOwn(goldenC2014, [stony]));
    expect(codes(without).map(({ code, ...rest }) => ('path' in rest ? rest.path : code))).toEqual([
      'defenses.immune.rust',
      'defenses.conditionImmune.dazed',
    ]);
  });

  it('counts two sources of one defense once, each named in its breakdown', () => {
    const result = computed(withOwn(goldenC2014, [stony, tough]));
    expect(result.values['defenses.resist.bludgeoning']).toBe(1);
    expect(result.breakdown['defenses.resist.bludgeoning']).toEqual([
      effect('stony', 'blunt', 1),
      effect('tough', 'blunt', 0),
    ]);
  });

  it("applies a toggled defense by the person's switch, else by its default", () => {
    const off = computed(withOwn(goldenC2014, [tough]));
    expect(off.values['defenses.immune.bludgeoning']).toBe(0);
    const on = computed(
      withOwn(goldenC2014, [tough], { toggles: { 'character:feat/tough#brace': true } }),
    );
    expect(on.values['defenses.immune.bludgeoning']).toBe(1);
    expect(defensesOf(on.values).immune).toEqual(['bludgeoning']);
  });

  it('lets an override of 0 take a defense away, as a manual edit', () => {
    const result = computed(
      withOwn(goldenC2014, [stony, dazed], {
        overrides: [{ path: 'defenses.resist.bludgeoning', value: 0 }],
      }),
    );
    expect(result.values['defenses.resist.bludgeoning']).toBe(0);
    expect(result.breakdown['defenses.resist.bludgeoning']).toEqual([
      effect('stony', 'blunt', 1),
      { kind: 'override', value: 0, change: -1 },
    ]);
    expect(defensesOf(result.values).resist).toEqual([]);
  });

  it("lets a formula read a defense's path", () => {
    const guarded = feat('guarded', [
      { id: 'ac', target: 'ac.bonus', op: 'add', value: 1, when: '@defenses.resist.bludgeoning' },
    ]);
    const without = computed(withOwn(goldenC2014, [guarded, feat('stony', [])]));
    const with_ = computed(withOwn(goldenC2014, [guarded, stony, dazed]));
    expect(Number(with_.values['ac.total']) - Number(without.values['ac.total'])).toBe(1);
    // Without the path, the formula reads 0 with a warning.
    expect(codes(without).map(({ code }) => code)).toEqual(['missingPath']);
  });

  it('warns of an effect on a list that appends no key', () => {
    const odd = feat('odd', [
      { id: 'set', target: 'defenses.resist', op: 'set', value: 'bludgeoning' },
      { id: 'edge', target: 'defenses.vuln', op: 'advantage', value: true },
      { id: 'words', target: 'defenses.immune', op: 'append', value: 'Not a key' },
      { id: 'aside', target: 'defenses.resist', op: 'note', value: { en: 'Aside' } },
      { id: 'add', target: 'defenses.resist', op: 'add', value: 1 },
      { id: 'other', target: 'defenses.other', op: 'append', value: 'bludgeoning' },
    ]);
    const result = computed(withOwn(goldenC2014, [odd]));
    expect(defensePaths(result)).toEqual({});
    const part = (id: string) => `character:feat/odd#${id}`;
    expect(codes(result)).toEqual([
      { code: 'noTarget', part: part('add'), target: 'defenses.resist' },
      {
        code: 'characterRule',
        rule: 'defenseNotAppended',
        data: { part: part('set'), list: 'resist', op: 'set' },
      },
      {
        code: 'characterRule',
        rule: 'defenseNotAppended',
        data: { part: part('edge'), list: 'vuln', op: 'advantage' },
      },
      {
        code: 'characterRule',
        rule: 'defenseNotAKey',
        data: { part: part('words'), list: 'immune' },
      },
    ]);
  });

  it('warns of a `when` that does not parse, and does not apply it', () => {
    const broken = feat('broken', [
      {
        id: 'blunt',
        target: 'defenses.resist',
        op: 'append',
        value: 'slashing',
        when: '@level >=',
      },
    ]);
    const result = computed(withOwn(goldenC2024, [broken]));
    expect(result.values['defenses.resist.slashing']).toBe(0);
    expect(codes(result).map(({ code }) => code)).toEqual(['formula']);
  });

  it('finds a 2024 damage type in the 2024 pack', () => {
    const edged = feat('edged', [
      { id: 'cut', target: 'defenses.resist', op: 'append', value: 'slashing' },
    ]);
    const result = computed(withOwn(goldenC2024, [edged]));
    expect(defensePaths(result)).toEqual({ 'defenses.resist.slashing': 1 });
    expect(codes(result)).toEqual([]);
  });
});
