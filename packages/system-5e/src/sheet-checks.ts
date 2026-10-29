import { type Computed, STAT_TYPE } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { FifthEditionEntity } from './entity-types';

// SHEET-32: what the Main tab names for a fifth-edition character (board `V3-Sheet`, BRIEF P4):
// each stat with the paths of its check, score and save, each skill with the paths of its total,
// proficiency and passive value. The screen reads every number from `Computed` at these paths.
// A skill's stat is the key path `skills.<key>.ability`, never the skill's own `ability` (ENG-43).

/** A stat the character has, and where its numbers are. */
export interface CheckStat {
  key: string;
  name: L10n;
  abbr: L10n;
  /** The ability check's total: the bonus a tap on the stat rolls. */
  check: string;
  score: string;
  /** The save's path, and the path of its proficiency level; `undefined` for a stat with no save. */
  save?: { total: string; prof: string };
}

/** A skill the character has, and where its numbers are. */
export interface CheckSkill {
  key: string;
  name: L10n;
  /** The key of the stat the skill uses now. */
  ability: string;
  total: string;
  /** The proficiency level, 0 for none. */
  prof: string;
  /** The passive value; `undefined` for a skill that shows none. */
  passive?: string;
}

export interface SheetChecks {
  /** The stats, by their `order`. */
  stats: CheckStat[];
  /** The skills, in the order the packs list them. */
  skills: CheckSkill[];
}

/** How a proficiency level is marked: none, half, proficient, or expertise. */
export type ProficiencyMark = 'none' | 'half' | 'full' | 'expert';

/** The mark of a proficiency level: below 1 half or none, 1 up to 2 proficient, 2 and more expertise. */
export function proficiencyMark(level: number | undefined): ProficiencyMark {
  if (level === undefined || !(level > 0)) return 'none';
  if (level < 1) return 'half';
  return level < 2 ? 'full' : 'expert';
}

/** The stats and skills the character has, with their paths in `computed`. */
export function fifthEditionChecks(computed: Computed<FifthEditionEntity>): SheetChecks {
  const has = (path: string) => Object.hasOwn(computed.values, path);
  const stats = Object.values(computed.byKey[STAT_TYPE] ?? {})
    .flatMap((stat) => (stat.type === STAT_TYPE ? [stat] : []))
    .sort((a, b) => a.order - b.order)
    .map(
      ({ key, name, abbr }): CheckStat => ({
        key,
        name,
        abbr,
        check: `checks.${key}.total`,
        score: `abilities.${key}.score`,
        ...(has(`abilities.${key}.save`) && {
          save: { total: `abilities.${key}.save`, prof: `abilities.${key}.saveProf` },
        }),
      }),
    );
  const skills = Object.values(computed.byKey.skill ?? {}).flatMap((skill): CheckSkill[] => {
    if (skill.type !== 'skill') return [];
    const { key } = skill;
    const path = `skills.${key}`;
    const own = Object.hasOwn(computed.keys, `${path}.ability`)
      ? computed.keys[`${path}.ability`]
      : undefined;
    return [
      {
        key,
        name: skill.name,
        ability: own?.key ?? skill.ability,
        total: `${path}.total`,
        prof: `${path}.prof`,
        ...(has(`${path}.passive`) && { passive: `${path}.passive` }),
      },
    ];
  });
  return { stats, skills };
}
