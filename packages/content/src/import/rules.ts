import { baseOf, type Importer, type ImportInput, type SourceEntry } from './frame.ts';

// CONT-15: the rules chapters of the SRDs as `rule` entries with a topic (ADR 013 item 18, ADR 014
// item 13), and the topics as `ruleTopic` entities. SRD 5.1's 137 rules are the chapters, sections
// and sub-sections of 5e-database's `Rules`. SRD 5.2.1 has no such file in 5e-database (CONT-15
// §8), so it has the topics and no rule yet (CONT-73).

/**
 * The topics of Quick rules, in the order ADR 013 item 18 lists them, then the two chapters of
 * SRD 5.1's rules that none of them holds (Equipment, Appendix), named as the source names them.
 */
const TOPICS: readonly (readonly [key: string, name: string])[] = [
  ['move', 'Move'],
  ['action', 'Action'],
  ['bonusAction', 'Bonus action'],
  ['reaction', 'Reaction'],
  ['combat', 'Combat'],
  ['otherActions', 'Other actions'],
  ['environment', 'Environment'],
  ['damageAndAttack', 'Damage and attack'],
  ['hitPointsDeathAndRest', 'Hit points, death and rest'],
  ['abilitiesAndSkills', 'Abilities and skills'],
  ['origins', 'Origins'],
  ['conditionsAndDiseases', 'Conditions and diseases'],
  ['activeClassFeatures', 'Active class features'],
  ['spells', 'Spells'],
  ['multiclassing', 'Multiclassing'],
  ['equipment', 'Equipment'],
  ['appendix', 'Appendix'],
];

/**
 * The topic of a rule, by the index of a chapter, a section or one sub-section: a rule has the
 * topic of the nearest of these above it, itself included. A chapter or section not named, and
 * a sub-section with no section named above it, fails the import, so a rule the source adds is
 * never left without a topic.
 */
const TOPIC_OF: Readonly<Record<string, string>> = {
  // Combat
  combat: 'combat',
  'the-order-of-combat': 'combat',
  reactions: 'reaction',
  'movement-and-position': 'move',
  'interacting-with-objects-around-you': 'otherActions',
  'actions-in-combat': 'action',
  'making-an-attack': 'damageAndAttack',
  cover: 'damageAndAttack',
  'damage-and-healing': 'damageAndAttack',
  'hit-points': 'hitPointsDeathAndRest',
  healing: 'hitPointsDeathAndRest',
  'dropping-to-0-hit-points': 'hitPointsDeathAndRest',
  'knocking-a-creature-out': 'hitPointsDeathAndRest',
  'temporary-hit-points': 'hitPointsDeathAndRest',
  'mounted-combat': 'combat',
  'underwater-combat': 'combat',
  // Using Ability Scores
  'using-ability-scores': 'abilitiesAndSkills',
  // Adventuring
  adventuring: 'environment',
  movement: 'move',
  diseases: 'conditionsAndDiseases',
  madness: 'conditionsAndDiseases',
  resting: 'hitPointsDeathAndRest',
  'between-adventures': 'otherActions',
  // Spellcasting, Equipment, Appendix
  spellcasting: 'spells',
  equipment: 'equipment',
  appendix: 'appendix',
};

/** A key as the slug of an id: `bonusAction` is `bonus-action`. */
const slugOfKey = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The `ruleTopic` entities: the same list in each ruleset, each pack with its own. */
function topicsOf(input: ImportInput) {
  return TOPICS.map(([key, name]) => ({
    ...baseOf(input, 'ruleTopic', { index: slugOfKey(key), name }),
    key,
  }));
}

/** One rule of SRD 5.1: its words, and its topic from the nearest chapter or section named. */
function rulesOf(input: ImportInput) {
  const entries = input.files.Rules ?? [];
  const byIndex = new Map(entries.map((entry) => [entry.index, entry]));
  const topicOf = (entry: SourceEntry): string => {
    for (
      let at: SourceEntry | undefined = entry;
      at !== undefined;
      at = byIndex.get(String((at.parent as { index: string } | undefined)?.index))
    ) {
      const topic = TOPIC_OF[at.index];
      if (topic !== undefined) return topic;
    }
    throw new Error(`The rule "${entry.index}" has no topic.`);
  };
  return entries.map((entry) => ({ ...baseOf(input, 'rule', entry), topic: topicOf(entry) }));
}

export const rules: Importer = {
  types: ['ruleTopic', 'rule'],
  files: { '2014': ['Rules'], '2024': [] },
  run: (input) => [...topicsOf(input), ...rulesOf(input)],
};
