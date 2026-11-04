import type { Computed } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { FifthEditionEntity } from './entity-types';

// SHEET-32: what the Main tab names for a fifth-edition character (board `V3-Sheet`): each stat
// with its check bonus, score and save, and each skill under the stat it is rolled with, with its
// proficiency and passive value. The stats and skills are the packs' entries read from
// `Computed.byKey` (D3: no stat or skill is written here), a skill's stat is the key path
// `skills.<key>.ability` (ENG-43), never the skill's own `ability`. The screen reads every number
// from `Computed` at the paths given here.

/** A stat of the Main tab: its entry's names and the paths of its numbers. */
export interface CheckStat {
  key: string;
  name: L10n;
  abbr: L10n;
  /** The plain check's bonus (ENG-13), which adds the stat's modifier and every d20 bonus. */
  check: string;
  score: string;
  /** The save's total and its proficiency level; none for a stat with no save. */
  save?: { total: string; prof: string };
}

/** A skill of the Main tab. */
export interface CheckSkill {
  key: string;
  name: L10n;
  total: string;
  /** The proficiency level: 0 none, 0.5 half, 1 proficient, 2 expertise. */
  prof: string;
  /** The passive value's path, for a skill that has one. */
  passive?: string;
}

/** The skills rolled with one stat. */
export interface CheckSkillGroup {
  /** The stat's key, which a stat with no entry still has. */
  stat: string;
  name: L10n | undefined;
  skills: CheckSkill[];
}

export interface ChecksShown {
  stats: CheckStat[];
  groups: CheckSkillGroup[];
  /** Every skill with a passive value, in the groups' order. */
  passives: CheckSkill[];
}

function has(computed: Computed<FifthEditionEntity>, path: string): boolean {
  return Object.hasOwn(computed.values, path);
}

/** The stats in their entries' order, and the skills grouped under their computed stat. */
export function fifthEditionChecks(computed: Computed<FifthEditionEntity>): ChecksShown {
  const stats: CheckStat[] = [];
  for (const [key, entity] of Object.entries(computed.byKey.ability ?? {})) {
    if (entity.type !== 'ability') continue;
    const save = `abilities.${key}.save`;
    stats.push({
      key,
      name: entity.name,
      abbr: entity.abbr,
      check: `checks.${key}.total`,
      score: `abilities.${key}.score`,
      ...(has(computed, save) && { save: { total: save, prof: `${save}Prof` } }),
    });
  }
  const order = (key: string) => {
    const entity = computed.byKey.ability?.[key];
    return entity?.type === 'ability' ? entity.order : Number.MAX_SAFE_INTEGER;
  };
  stats.sort((a, b) => order(a.key) - order(b.key) || (a.key < b.key ? -1 : 1));

  const groups = new Map<string, CheckSkillGroup>();
  for (const [key, entity] of Object.entries(computed.byKey.skill ?? {})) {
    if (entity.type !== 'skill') continue;
    const path = `skills.${key}`;
    const stat = Object.hasOwn(computed.keys, `${path}.ability`)
      ? (computed.keys[`${path}.ability`]?.key ?? entity.ability)
      : entity.ability;
    const found = computed.byKey.ability?.[stat];
    const group = groups.get(stat) ?? {
      stat,
      name: found?.type === 'ability' ? found.name : undefined,
      skills: [],
    };
    groups.set(stat, group);
    group.skills.push({
      key,
      name: entity.name,
      total: `${path}.total`,
      prof: `${path}.prof`,
      ...(has(computed, `${path}.passive`) && { passive: `${path}.passive` }),
    });
  }
  const sorted = [...groups.values()].sort(
    (a, b) => order(a.stat) - order(b.stat) || (a.stat < b.stat ? -1 : 1),
  );
  for (const group of sorted) {
    group.skills.sort((a, b) => (a.name.en ?? a.key).localeCompare(b.name.en ?? b.key));
  }
  return {
    stats,
    groups: sorted,
    passives: sorted.flatMap(({ skills }) => skills.filter(({ passive }) => passive !== undefined)),
  };
}

/**
 * SHEET-79: the key path behind the number at `path`, when it has one the sheet may show: a skill's
 * total or passive value is rolled with the skill's stat, `skills.<key>.ability` (ENG-43). A path
 * with no such key path gives none.
 */
export function fifthEditionKeyOf(
  computed: Pick<Computed<FifthEditionEntity>, 'keys'>,
  path: string,
): string | undefined {
  const [root, key, last, extra] = path.split('.');
  if (root !== 'skills' || key === undefined || key === '' || extra !== undefined) return undefined;
  if (last !== 'total' && last !== 'passive') return undefined;
  const keyPath = `skills.${key}.ability`;
  return Object.hasOwn(computed.keys, keyPath) ? keyPath : undefined;
}
