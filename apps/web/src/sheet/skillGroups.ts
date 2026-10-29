// SHEET-32: the Main tab's skills, grouped under the stat each uses now, in the stats' order, and
// split into the board's two columns. Plain lists: the screen draws them.
import type { CheckSkill, CheckStat } from '@grimoire/system-5e';

/** The skills that use one stat, by name; `stat` is `undefined` when the character has no such stat. */
export interface SkillGroup {
  ability: string;
  stat: CheckStat | undefined;
  skills: CheckSkill[];
}

/**
 * Each stat that has skills, in the stats' order, with its skills sorted by `nameOf`; then, in the
 * order first met, the groups of a stat the character does not have (Missing, not broken).
 */
export function groupSkills(
  stats: readonly CheckStat[],
  skills: readonly CheckSkill[],
  nameOf: (skill: CheckSkill) => string,
): SkillGroup[] {
  const groups = new Map<string, SkillGroup>(
    stats.map((stat) => [stat.key, { ability: stat.key, stat, skills: [] }]),
  );
  for (const skill of skills) {
    const group = groups.get(skill.ability) ?? {
      ability: skill.ability,
      stat: undefined,
      skills: [],
    };
    group.skills.push(skill);
    groups.set(skill.ability, group);
  }
  return [...groups.values()]
    .filter(({ skills: own }) => own.length > 0)
    .map((group) => ({
      ...group,
      skills: group.skills.sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    }));
}

/** The groups in two columns: whole groups to the left until it holds half of the skills. */
export function inColumns(groups: readonly SkillGroup[]): [SkillGroup[], SkillGroup[]] {
  const total = groups.reduce((sum, { skills }) => sum + skills.length, 0);
  const left: SkillGroup[] = [];
  let held = 0;
  let split = 0;
  for (const group of groups) {
    if (held >= total / 2) break;
    held += group.skills.length;
    split += 1;
    left.push(group);
  }
  return [left, groups.slice(split)];
}
