import { type Computed, compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  castWarnings,
  FIFTH_EDITION_SYSTEM,
  type FifthEditionEntity,
  type fifthEditionCharacterSchema,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
  setConditionLevel,
} from '../src/index.ts';
import { done, stamp } from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenC2014, goldenC2024, srd2014, srd2024 } from './golden/index.ts';

// SHEET-61: a condition the character is immune to has no effect. Golden C (level 6, both
// editions, 30 hit points stored) with feats and conditions of the character's own, made up, no
// text of a book. Each condition changes one number by a round amount, so its effect shows as
// that change against golden C without it; every expected change was worked out by hand.

type CharacterInput = z.input<typeof fifthEditionCharacterSchema>;
type EntityInput = CharacterInput['localEntities'][number];
type Stored = CharacterInput['state']['conditions'];

const index2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]);
const index2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2024))]);

const source = { pack: 'character' };

/** A character opened as a file would be. */
const open = (character: CharacterInput) => opened(openFifthEditionCharacter(character));

/** The character's edition's index. */
const indexFor = (character: CharacterInput) =>
  (character.ruleset === '2014' ? index2014 : index2024).index;

/** A character opened as a file would be, computed on its edition's pack. */
function computed(character: CharacterInput): Computed<FifthEditionEntity> {
  return compute(open(character), indexFor(character), fifthEditionModule);
}

/** Golden C with these own entities, each feat taken, these stored conditions and switches. */
function withOwn(
  golden: CharacterInput,
  localEntities: EntityInput[],
  conditions: Stored,
  more: { overrides?: CharacterInput['overrides']; toggles?: Record<string, boolean> } = {},
): CharacterInput {
  return {
    ...golden,
    localEntities,
    overrides: more.overrides ?? [],
    state: { ...golden.state, conditions, toggles: more.toggles ?? {} },
    systemData: {
      ...golden.systemData,
      feats: localEntities.flatMap(({ id, type }) => (type === 'feat' ? [{ id }] : [])),
    },
  };
}

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

/** A made-up condition with this key, these effects and these grants. */
function condition(key: string, effects: unknown[], grants: unknown[] = []): EntityInput {
  return {
    id: `character:condition/${key}`,
    type: 'condition',
    key,
    ruleset: 'any',
    name: { en: key },
    source,
    effects,
    grants,
  } as EntityInput;
}

/** The effect that makes a feat or condition immune to the condition `key`. */
const immuneTo = (key: string, more: object = {}) => ({
  id: `no-${key}`,
  target: 'defenses.conditionImmune',
  op: 'append',
  value: key,
  ...more,
});

/** `dazed`: the Dexterity save 3 lower. */
const dazed = condition('dazed', [
  { id: 'slow', target: 'abilities.dex.save', op: 'add', value: -3 },
]);
const DEX_SAVE = 'abilities.dex.save';

/** A computed character's Dexterity save. */
const dexSave = (result: Computed<FifthEditionEntity>) => Number(result.values[DEX_SAVE]);
const dazedId = 'character:condition/dazed' as const;

/** Immune to `dazed`. */
const calm = feat('calm', [immuneTo('dazed')]);

/** The warnings of the rule `immuneCondition`, without their log message. */
function immuneWarnings(result: Computed<FifthEditionEntity>) {
  return result.warnings.flatMap(({ message: _, ...warning }) =>
    'rule' in warning && warning.rule === 'immuneCondition' ? [warning] : [],
  );
}

/** The warning of a condition left out because the character is immune to it. */
const immuneWarning = (key: string) => ({
  code: 'characterRule',
  rule: 'immuneCondition',
  data: { condition: `character:condition/${key}`, key },
});

/** The ids of the conditions withheld. */
const withheldIds = (result: Computed<FifthEditionEntity>) =>
  result.withheld?.map(({ entity }) => entity.id) ?? [];

describe('SHEET-61 a condition the character is immune to', () => {
  for (const golden of [goldenC2014, goldenC2024]) {
    it(`${golden.ruleset}: has no effect, stays stored, and warns`, () => {
      const plain = computed(withOwn(golden, [calm, dazed], []));
      expect(typeof plain.values[DEX_SAVE]).toBe('number');

      const affected = computed(withOwn(golden, [dazed], [{ id: dazedId }]));
      expect(dexSave(affected)).toBe(dexSave(plain) - 3);
      expect(affected.values['conditions.dazed.level']).toBe(1);
      expect(immuneWarnings(affected)).toEqual([]);

      const character = withOwn(golden, [calm, dazed], [{ id: dazedId }]);
      const immune = computed(character);
      expect(immune.values).toEqual(plain.values);
      expect(immune.values['conditions.dazed.level']).toBe(0);
      expect(immune.entities.map(({ entity }) => entity.id)).not.toContain(dazedId);
      expect(immune.withheld?.map(({ entity, from }) => [entity.id, from])).toEqual([
        [dazedId, ['character']],
      ]);
      expect(immuneWarnings(immune)).toEqual([immuneWarning('dazed')]);
      expect(open(character).state.conditions).toEqual([{ id: dazedId }]);
    });
  }

  it('follows the immunity: switched off or overridden to 0, the condition applies again', () => {
    const brave = feat('brave', [
      immuneTo('dazed', { toggle: { label: { en: 'Brave' }, default: false } }),
    ]);
    const plain = dexSave(computed(withOwn(goldenC2014, [], [])));

    const off = computed(withOwn(goldenC2014, [brave, dazed], [{ id: dazedId }]));
    expect(dexSave(off)).toBe(plain - 3);
    expect(withheldIds(off)).toEqual([]);

    const on = computed(
      withOwn(goldenC2014, [brave, dazed], [{ id: dazedId }], {
        toggles: { 'character:feat/brave#no-dazed': true },
      }),
    );
    expect(dexSave(on)).toBe(plain);
    expect(withheldIds(on)).toEqual([dazedId]);

    const overridden = computed(
      withOwn(goldenC2014, [calm, dazed], [{ id: dazedId }], {
        overrides: [{ path: 'defenses.conditionImmune.dazed', value: 0 }],
      }),
    );
    expect(dexSave(overridden)).toBe(plain - 3);
    expect(withheldIds(overridden)).toEqual([]);
    expect(immuneWarnings(overridden)).toEqual([]);
  });

  it('withholds a condition another one gives, and keeps the giver', () => {
    // `reeling` gives `incapacitated`, and is 2 lower on every save of its own.
    const incapacitated = condition('incapacitated', []);
    const reeling = condition(
      'reeling',
      [{ id: 'shaky', target: 'abilities.str.save', op: 'add', value: -2 }],
      [{ id: 'give', kind: 'entity', fixed: ['character:condition/incapacitated'] }],
    );
    const steady = feat('steady', [immuneTo('incapacitated')]);
    const stored: Stored = [{ id: 'character:condition/reeling' }];
    const plain = computed(withOwn(goldenC2014, [], []));

    const affected = computed(withOwn(goldenC2014, [reeling, incapacitated], stored));
    expect(affected.values['conditions.incapacitated.level']).toBe(1);
    expect(castWarnings(affected).map(({ code }) => code)).toEqual(['incapacitated']);

    const immune = computed(withOwn(goldenC2014, [steady, reeling, incapacitated], stored));
    expect(immune.values['conditions.incapacitated.level']).toBe(0);
    expect(immune.values['conditions.reeling.level']).toBe(1);
    expect(immune.values['abilities.str.save']).toBe(
      Number(plain.values['abilities.str.save']) - 2,
    );
    expect(immune.withheld?.map(({ entity, from }) => [entity.id, from])).toEqual([
      ['character:condition/incapacitated', ['character:condition/reeling#give']],
    ]);
    expect(castWarnings(immune)).toEqual([]);
    expect(immuneWarnings(immune)).toEqual([immuneWarning('incapacitated')]);
  });

  it('drops an immunity a withheld condition gave: being immune to `stone` lets `dazed` apply', () => {
    // `stone` is immune to `dazed`; `hardy` is immune to `stone`.
    const stone = condition('stone', [immuneTo('dazed')]);
    const hardy = feat('hardy', [immuneTo('stone')]);
    const stored: Stored = [{ id: 'character:condition/stone' }, { id: dazedId }];
    const plain = dexSave(computed(withOwn(goldenC2014, [], [])));

    const inStone = computed(withOwn(goldenC2014, [stone, dazed], stored));
    expect(withheldIds(inStone)).toEqual([dazedId]);
    expect(dexSave(inStone)).toBe(plain);

    const result = computed(withOwn(goldenC2014, [hardy, stone, dazed], stored));
    expect(withheldIds(result)).toEqual(['character:condition/stone']);
    // Withheld, `stone` appends nothing: no effect the character has names the path.
    expect(result.values['defenses.conditionImmune.dazed']).toBeUndefined();
    expect(result.values['conditions.dazed.level']).toBe(1);
    expect(dexSave(result)).toBe(plain - 3);
    expect(result.warnings.map(({ code }) => code)).not.toContain('withheldUnsettled');
  });

  it('at 0 hit points, immune to Unconscious: no condition, and no warning that none is there', () => {
    const asleep = condition('unconscious', [
      { id: 'still', target: 'speed.all.mul', op: 'set', value: 0 },
    ]);
    const awake = feat('awake', [immuneTo('unconscious')]);
    const down = (entities: EntityInput[]): CharacterInput => {
      const character = withOwn(goldenC2014, entities, []);
      const { state } = character.systemData;
      return {
        ...character,
        systemData: { ...character.systemData, state: { ...state, hp: { current: 0, temp: 0 } } },
      };
    };
    const rules = (result: Computed<FifthEditionEntity>) =>
      result.warnings.flatMap((warning) => ('rule' in warning ? [warning.rule] : []));

    const affected = computed(down([asleep]));
    expect(affected.values['conditions.unconscious.level']).toBe(1);
    expect(affected.values['speed.all.mul']).toBe(0);

    const immune = computed(down([awake, asleep]));
    expect(immune.values['conditions.unconscious.level']).toBe(0);
    expect(immune.values['speed.all.mul']).toBe(computed(down([])).values['speed.all.mul']);
    expect(immune.values['speed.all.mul']).not.toBe(0);
    expect(rules(immune)).toEqual(['immuneCondition']);
    // With no entry at all, ENG-62's warning stays.
    expect(rules(computed(down([awake])))).toContain('noUnconsciousCondition');
  });

  it('is set, not refused: the stored condition waits for the immunity to end', () => {
    const character = open(withOwn(goldenC2014, [calm, dazed], []));
    const changed = done(
      character,
      setConditionLevel(character, index2014.index, { id: dazedId }, stamp),
    ).character;
    expect(changed.state.conditions).toEqual([{ id: dazedId }]);
    const result = compute(changed, index2014.index, fifthEditionModule);
    expect(withheldIds(result)).toEqual([dazedId]);
    expect(immuneWarnings(result)).toEqual([immuneWarning('dazed')]);
  });
});
