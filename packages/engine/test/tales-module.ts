import type { BreakdownStep, DerivedStep, SystemModule } from '@grimoire/engine';
import {
  TALES_RULES,
  type TalesCharacter,
  type TalesEntity,
} from '../../schema/test/tales/index.ts';

// Tales' module (ENG-27): the character's level, the entities its part names (the calling first,
// then the talents), a stat's defaults, and its derived values (ENG-28), from Tales' rules in
// `tales/system.ts`.

/** A path whose value is 0 until an effect changes it. */
const zero: DerivedStep = () => ({ value: 0, steps: [] });

export const talesModule: SystemModule<TalesCharacter, TalesEntity> = {
  level: (character) => character.systemData.level,
  entities: (character) =>
    [character.systemData.calling, ...character.systemData.talents].map((id) => ({ id })),
  statDefaults: {
    defaultMax: TALES_RULES.statMax,
    modFormula: TALES_RULES.modFormula,
    hasSave: TALES_RULES.hasSave,
  },
  derive: ({ gathered }) => {
    const names = new Map(gathered.entities.map(({ entity }) => [entity.id, entity.name]));
    const grants = new Map(gathered.grants.map((grant) => [grant.part, grant]));

    /** A skill's knack level: the highest its `knack` grants give, with that grant as its step. */
    const knackOf = (key: string): DerivedStep => {
      let level = 0;
      let steps: BreakdownStep[] = [];
      for (const given of gathered.proficiencies) {
        if (given.category !== TALES_RULES.knackCategory || given.key !== key) continue;
        const each = given.level ?? TALES_RULES.knackLevel;
        const grant = grants.get(given.from);
        if (each <= level || grant === undefined) continue;
        level = each;
        const label = names.get(grant.source) ?? {};
        steps = [
          {
            kind: 'grant',
            part: given.from,
            source: grant.source,
            label,
            value: each,
            change: each,
          },
        ];
      }
      return () => ({ value: level, steps });
    };

    /** A sum of other paths, each taken `times` times, with a step for each. */
    const sumOf =
      (parts: readonly [path: string, times: number][]): DerivedStep =>
      (read) => {
        const steps = parts.map(([path, times]): BreakdownStep => {
          const value = read(path);
          return { kind: 'path', path, value, change: value * times };
        });
        return { value: steps.reduce((sum, step) => sum + step.change, 0), steps };
      };

    const steps: Record<string, DerivedStep> = { 'skills.all.bonus': zero };
    for (const [key, skill] of Object.entries(gathered.byKey.skill ?? {})) {
      if (skill.type !== 'skill') continue;
      const path = `skills.${key}`;
      steps[`${path}.prof`] = knackOf(key);
      steps[`${path}.bonus`] = zero;
      steps[`${path}.total`] = sumOf([
        [`abilities.${skill.ability}.mod`, 1],
        [`${path}.prof`, TALES_RULES.knackStep],
        [`${path}.bonus`, 1],
        ['skills.all.bonus', 1],
      ]);
      if (skill.passive === true) {
        steps[`${path}.passive`] = (read) => {
          const base = TALES_RULES.passiveBase;
          const total = read(`${path}.total`);
          return {
            value: base + total,
            steps: [
              { kind: 'rule', rule: 'passiveBase', value: base, change: base },
              { kind: 'path', path: `${path}.total`, value: total, change: total },
            ],
          };
        };
      }
    }
    return steps;
  },
};
