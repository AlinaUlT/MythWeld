import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACK_OF, RULESETS, type Ruleset, runImport, slugOf } from '../src/import/frame.ts';
import { importers } from '../src/import/registry.ts';
import { readSourceFile, SOURCE_DIR } from '../src/import/source.ts';

// CONT-15: the rules chapters and the topics of Quick rules. Control values are measured from the
// fetched source at `e6edf9a` by a script outside the repository (CONT-15 §8). No rules text is
// written here: the test asserts ids, keys, counts and shapes.

interface Made {
  id: string;
  type: string;
  key?: string;
  name: { en: string };
  text?: { en: string };
  topic?: string;
  icon?: string;
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({ ruleset, importers, read: (rs, file) => readSourceFile(rs, file) }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const all = (ruleset: Ruleset, type: string) =>
  run[ruleset].entities.filter((e) => e.type === type) as unknown as Made[];
const rule = (name: string): Made => {
  const found = all('2014', 'rule').find((e) => e.id === `srd-2014:rule/${name}`);
  if (found === undefined) throw new Error(`${name} is not imported`);
  return found;
};

/** The 15 topics of ADR 013 item 18, in its order, and the two chapters of SRD 5.1 that none holds. */
const TOPICS: [string, string][] = [
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

describe.each(RULESETS)('CONT-15 the topics and rules of %s', (ruleset) => {
  it('passes the frame with no problem', () => {
    expect(run[ruleset].problems).toEqual([]);
  });

  it('makes the 15 topics of ADR 013 item 18, in its order, and the two chapters that none holds', () => {
    const topics = all(ruleset, 'ruleTopic');
    expect(topics.map((e) => [e.key, e.name.en])).toEqual(TOPICS);
    expect(topics.map((e) => e.id.split('/')[1])).toEqual([
      'move',
      'action',
      'bonus-action',
      'reaction',
      'combat',
      'other-actions',
      'environment',
      'damage-and-attack',
      'hit-points-death-and-rest',
      'abilities-and-skills',
      'origins',
      'conditions-and-diseases',
      'active-class-features',
      'spells',
      'multiclassing',
      'equipment',
      'appendix',
    ]);
    for (const e of topics)
      expect(e.id.startsWith(`${PACK_OF[ruleset]}:ruleTopic/`), e.id).toBe(true);
  });

  it('gives each rule a topic that exists', () => {
    const keys = new Set(all(ruleset, 'ruleTopic').map((e) => e.key));
    for (const e of all(ruleset, 'rule')) expect(keys.has(e.topic), e.id).toBe(true);
  });
});

describe('CONT-15 SRD 5.1', () => {
  const source = readSourceFile('2014', 'Rules');

  it('makes one rule for each of the 137 entries, under its slug, with its name and words', () => {
    expect(source).toHaveLength(137);
    expect(all('2014', 'rule').map((e) => e.id.split('/')[1])).toEqual(
      source.map((e) => slugOf(e.index)),
    );
    expect(all('2014', 'rule').map((e) => e.name.en)).toEqual(source.map((e) => e.name));
    for (const entry of source) {
      const made = rule(entry.index);
      if (entry.desc === undefined) expect(made.text, entry.index).toBeUndefined();
      else expect(made.text?.en, entry.index).toBe(String(entry.desc));
    }
  });

  it('leaves the three chapters that have no words of their own without text: Combat, Adventuring, Appendix', () => {
    expect(source.filter((e) => e.desc === undefined).map((e) => e.index)).toEqual([
      'combat',
      'adventuring',
      'appendix',
    ]);
    expect(
      all('2014', 'rule')
        .filter((e) => e.text === undefined)
        .map((e) => e.id.split('/')[1]),
    ).toEqual(['combat', 'adventuring', 'appendix']);
  });

  it('gives each topic the rules of the chapters and sections the importer maps to it', () => {
    const count = (topic: string) => all('2014', 'rule').filter((e) => e.topic === topic).length;
    const counts: Record<string, number> = Object.fromEntries(
      TOPICS.map(([key]) => [key, count(key)]),
    );
    expect(counts).toEqual({
      move: 10,
      action: 11,
      bonusAction: 0,
      reaction: 1,
      combat: 10,
      otherActions: 4,
      environment: 11,
      damageAndAttack: 9,
      hitPointsDeathAndRest: 8,
      abilitiesAndSkills: 18,
      origins: 0,
      conditionsAndDiseases: 6,
      activeClassFeatures: 0,
      spells: 18,
      multiclassing: 0,
      equipment: 18,
      appendix: 13,
    });
    expect(Object.values(counts).reduce((a: number, b: number) => a + b, 0)).toBe(137);
  });

  it('puts the actions of a turn under Action, a move under Move, and a reaction under Reaction', () => {
    for (const name of [
      'attack',
      'cast-a-spell',
      'dash',
      'disengage',
      'dodge',
      'help',
      'hide',
      'ready',
      'search',
      'use-an-object',
      'actions-in-combat',
    ]) {
      expect(rule(name).topic, name).toBe('action');
    }
    for (const name of [
      'movement-and-position',
      'difficult-terrain',
      'being-prone',
      'flying-movement',
      'movement',
      'speed',
    ]) {
      expect(rule(name).topic, name).toBe('move');
    }
    expect(rule('reactions').topic).toBe('reaction');
    expect(rule('your-turn').topic).toBe('combat');
    expect(rule('interacting-with-objects-around-you').topic).toBe('otherActions');
  });

  it('splits Damage and Healing: the rolls under Damage and attack, the points under Hit points, death and rest', () => {
    expect(rule('damage-and-healing').topic).toBe('damageAndAttack');
    expect(rule('damage-rolls').topic).toBe('damageAndAttack');
    expect(rule('damage-resistance-and-vulnerability').topic).toBe('damageAndAttack');
    for (const name of [
      'hit-points',
      'healing',
      'dropping-to-0-hit-points',
      'knocking-a-creature-out',
      'temporary-hit-points',
      'resting',
      'short-rest',
      'long-rest',
    ]) {
      expect(rule(name).topic, name).toBe('hitPointsDeathAndRest');
    }
  });

  it('keeps the chapters of the source under their own topics', () => {
    for (const name of [
      'using-ability-scores',
      'ability-checks',
      'skills',
      'strength',
      'saving-throws',
    ]) {
      expect(rule(name).topic, name).toBe('abilitiesAndSkills');
    }
    for (const name of ['spellcasting', 'what-is-a-spell', 'rituals', 'areas-of-effect'])
      expect(rule(name).topic, name).toBe('spells');
    for (const name of ['diseases', 'sample-diseases', 'madness', 'madness-effects'])
      expect(rule(name).topic, name).toBe('conditionsAndDiseases');
    for (const name of ['the-environment', 'falling', 'vision-and-light', 'traps', 'time'])
      expect(rule(name).topic, name).toBe('environment');
    for (const name of ['equipment', 'attunement', 'poisons'])
      expect(rule(name).topic, name).toBe('equipment');
    for (const name of ['appendix', 'the-celtic-pantheon', 'the-planes-of-existence'])
      expect(rule(name).topic, name).toBe('appendix');
  });

  it('gives every sub-section the topic of its section, except the ones the importer names', () => {
    const topic = new Map<string | undefined, string | undefined>(
      all('2014', 'rule').map((e) => [e.id.split('/')[1], e.topic]),
    );
    const named = [
      'reactions',
      'interacting-with-objects-around-you',
      'hit-points',
      'healing',
      'dropping-to-0-hit-points',
      'knocking-a-creature-out',
      'temporary-hit-points',
    ];
    for (const entry of source) {
      const parent = (entry.parent as { index: string } | undefined)?.index;
      const grandparent = source.find((e) => e.index === parent)?.parent;
      if (parent === undefined || grandparent === undefined || named.includes(entry.index))
        continue;
      expect(topic.get(slugOf(entry.index)), entry.index).toBe(topic.get(slugOf(parent)));
    }
  });

  it('has no icon: the source has none', () => {
    for (const e of all('2014', 'rule')) expect(e.icon, e.id).toBeUndefined();
  });
});

describe('CONT-15 SRD 5.2.1', () => {
  it('has no Rules file in the source, so it has the topics and no rule', () => {
    expect(existsSync(join(SOURCE_DIR, '2024', '5e-SRD-Rules.json'))).toBe(false);
    expect(all('2024', 'rule')).toHaveLength(0);
    expect(all('2024', 'ruleTopic')).toHaveLength(17);
  });
});
