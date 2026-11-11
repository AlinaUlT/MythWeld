import {
  baseOf,
  type Importer,
  type ImportInput,
  type Ruleset,
  type SourceEntry,
} from './frame.ts';

// CONT-15: the rules chapters of the SRDs as `rule` entries with a topic (ADR 013 item 18, ADR 014
// item 13), and the topics as `ruleTopic` entities. SRD 5.1's 137 rules are the chapters, sections
// and sub-sections of 5e-database's `Rules`. SRD 5.2.1 has no such file in 5e-database (CONT-15
// §8); CONT-73: the fetch derives one from the SRD 5.2.1 PDF (`source/srd-pdf.ts`) in the same
// shape, with the sections of "Playing the Game" and the terms of the "Rules Glossary".

/** The topics of Quick rules, in the order ADR 013 item 18 lists them. */
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
];

/**
 * The topics a ruleset's rules need besides those: the two chapters of SRD 5.1's rules that none
 * holds (Equipment, Appendix), named as the source names them, and the terms of SRD 5.2.1's
 * "Rules Glossary" that no topic holds.
 */
const EXTRA_TOPICS: Readonly<Record<Ruleset, readonly (readonly [key: string, name: string])[]>> = {
  '2014': [
    ['equipment', 'Equipment'],
    ['appendix', 'Appendix'],
  ],
  '2024': [['glossary', 'Rules glossary']],
};

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

/**
 * SRD 5.2.1: the topic of a section of "Playing the Game", by index; its sub-sections follow it.
 * The chapters themselves ("Playing the Game", "Rules Glossary") hold no words and are no rule.
 */
const TOPIC_OF_2024: Readonly<Record<string, string>> = {
  'rhythm-of-play': 'abilitiesAndSkills',
  'the-six-abilities': 'abilitiesAndSkills',
  'd20-tests': 'abilitiesAndSkills',
  proficiency: 'abilitiesAndSkills',
  actions: 'action',
  'bonus-actions': 'bonusAction',
  reactions: 'reaction',
  'social-interaction': 'otherActions',
  exploration: 'environment',
  'adventuring-equipment': 'otherActions',
  'interacting-with-objects': 'otherActions',
  combat: 'combat',
  'movement-and-position': 'move',
  'making-an-attack': 'damageAndAttack',
  cover: 'damageAndAttack',
  'ranged-attacks': 'damageAndAttack',
  'melee-attacks': 'damageAndAttack',
  'damage-and-healing': 'damageAndAttack',
  'hit-points': 'hitPointsDeathAndRest',
  healing: 'hitPointsDeathAndRest',
  'dropping-to-0-hit-points': 'hitPointsDeathAndRest',
  'temporary-hit-points': 'hitPointsDeathAndRest',
};

/** SRD 5.2.1's glossary: the topic of a term by its bracketed kind, `[Action]`, `[Condition]`. */
const TOPIC_OF_TAG: Readonly<Record<string, string>> = {
  Action: 'action',
  Condition: 'conditionsAndDiseases',
  Hazard: 'environment',
  'Area of Effect': 'spells',
  Attitude: 'otherActions',
};

/** The terms of the glossary with no kind that a topic holds, by index; the rest are `glossary`. */
const TOPIC_OF_TERM: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries({
    bonusAction: ['bonus-action'],
    reaction: ['reaction'],
    abilitiesAndSkills: [
      'ability-check',
      'ability-score-and-modifier',
      'saving-throw',
      'save',
      'skill',
      'proficiency',
      'proficiency-rules-glossary',
      'expertise',
      'passive-perception',
      'd20-test',
      'advantage',
      'disadvantage',
      'difficulty-class',
      'difficulty-class-rules-glossary',
    ],
    damageAndAttack: [
      'attack-roll',
      'weapon-attack',
      'spell-attack',
      'critical-hit',
      'damage',
      'damage-roll',
      'damage-types',
      'damage-types-rules-glossary',
      'damage-threshold',
      'resistance',
      'vulnerability',
      'immunity',
      'immunity-rules-glossary',
      'unarmed-strike',
      'improvised-weapons',
      'armor-class',
      'armor-class-rules-glossary',
      'grappling',
      'cover',
      'cover-rules-glossary',
      'weapon',
      'opportunity-attacks',
      'opportunity-attacks-rules-glossary',
      'reach',
      'reach-rules-glossary',
    ],
    hitPointsDeathAndRest: [
      'hit-points',
      'hit-points-rules-glossary',
      'hit-point-dice',
      'temporary-hit-points',
      'temporary-hit-points-rules-glossary',
      'healing',
      'healing-rules-glossary',
      'short-rest',
      'long-rest',
      'dead',
      'stable',
      'death-saving-throw',
      'knocking-out-a-creature',
      'knocking-out-a-creature-rules-glossary',
      'bloodied',
    ],
    move: [
      'speed',
      'burrow-speed',
      'climb-speed',
      'fly-speed',
      'swim-speed',
      'climbing',
      'crawling',
      'flying',
      'swimming',
      'jumping',
      'high-jump',
      'long-jump',
      'difficult-terrain',
      'difficult-terrain-rules-glossary',
      'hover',
      'occupied-space',
      'unoccupied-space',
    ],
    spells: [
      'spell',
      'cantrip',
      'concentration',
      'ritual',
      'spellcasting-focus',
      'magical-effect',
      'illusions',
      'teleportation',
      'area-of-effect',
    ],
    environment: [
      'darkness',
      'bright-light',
      'dim-light',
      'lightly-obscured',
      'heavily-obscured',
      'darkvision',
      'blindsight',
      'tremorsense',
      'truesight',
      'telepathy',
    ],
  }).flatMap(([topic, terms]) => terms.map((term) => [term, topic] as const)),
);

/** A key as the slug of an id: `bonusAction` is `bonus-action`. */
const slugOfKey = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The `ruleTopic` entities: the same list in each ruleset, each pack with its own. */
function topicsOf(input: ImportInput) {
  return [...TOPICS, ...EXTRA_TOPICS[input.ruleset]].map(([key, name]) => ({
    ...baseOf(input, 'ruleTopic', { index: slugOfKey(key), name }),
    key,
  }));
}

/** One rule: its words, and its topic from the nearest chapter or section named above it. */
function rulesOf(input: ImportInput) {
  const entries = input.files.Rules ?? [];
  const byIndex = new Map(entries.map((entry) => [entry.index, entry]));
  const is2014 = input.ruleset === '2014';
  const table = is2014 ? TOPIC_OF : TOPIC_OF_2024;
  const topicOf = (entry: SourceEntry): string => {
    if (entry.kind === 'glossary') {
      return TOPIC_OF_TERM[entry.index] ?? TOPIC_OF_TAG[String(entry.tag)] ?? 'glossary';
    }
    for (
      let at: SourceEntry | undefined = entry;
      at !== undefined;
      at = byIndex.get(String((at.parent as { index: string } | undefined)?.index))
    ) {
      const topic = table[at.index];
      if (topic !== undefined) return topic;
    }
    throw new Error(`The rule "${entry.index}" has no topic.`);
  };
  return entries
    .filter((entry) => entry.kind !== 'chapter')
    .map((entry) => ({ ...baseOf(input, 'rule', entry), topic: topicOf(entry) }));
}

export const rules: Importer = {
  types: ['ruleTopic', 'rule'],
  files: { '2014': ['Rules'], '2024': ['Rules'] },
  run: (input) => [...topicsOf(input), ...rulesOf(input)],
};
