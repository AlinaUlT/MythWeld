import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACK_OF, RULESETS, type Ruleset, runImport, slugOf } from '../src/import/frame.ts';
import { importers } from '../src/import/registry.ts';
import { readSourceFile, SOURCE_DIR } from '../src/import/source.ts';
import {
  DERIVED_RULES_PATH,
  SRD_PDF,
  SRD_PDF_LICENSE_PATH,
  SRD_PDF_PATH,
} from '../src/source/pin.ts';

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

/** The 15 topics of ADR 013 item 18, in its order. */
const COMMON: [string, string][] = [
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
/** The topics a ruleset's rules need besides those. */
const EXTRA: Record<Ruleset, [string, string][]> = {
  '2014': [
    ['equipment', 'Equipment'],
    ['appendix', 'Appendix'],
  ],
  '2024': [['glossary', 'Rules glossary']],
};
const TOPICS = [...COMMON, ...EXTRA['2014']];

describe.each(RULESETS)('CONT-15 the topics and rules of %s', (ruleset) => {
  it('passes the frame with no problem', () => {
    expect(run[ruleset].problems).toEqual([]);
  });

  it('makes the 15 topics of ADR 013 item 18, in its order, and the ones its rules need besides', () => {
    const topics = all(ruleset, 'ruleTopic');
    expect(topics.map((e) => [e.key, e.name.en])).toEqual([...COMMON, ...EXTRA[ruleset]]);
    expect(topics.map((e) => e.id.split('/')[1]).slice(0, 15)).toEqual([
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

describe('CONT-73 SRD 5.2.1', () => {
  const source = readSourceFile('2024', 'Rules');
  const rules = () => all('2024', 'rule');
  const get = (index: string): Made => {
    const found = rules().find((e) => e.id === `srd-2024:rule/${index}`);
    if (found === undefined) throw new Error(`${index} is not imported`);
    return found;
  };

  it('has its Rules file from the PDF: 2 chapters, 9 + 40 + 61 sections, 155 glossary terms', () => {
    const count = (kind: string, depth?: number) =>
      source.filter((e) => e.kind === kind && (depth === undefined || e.depth === depth)).length;
    expect([
      count('chapter'),
      count('section', 1),
      count('section', 2),
      count('section', 3),
      count('glossary'),
    ]).toEqual([2, 9, 40, 61, 155]);
    expect(source).toHaveLength(267);
    expect(new Set(source.map((e) => e.index)).size).toBe(267);
  });

  it('is derived from the pinned PDF: the manifest names it by its hash and lists the derived file', () => {
    const manifest = JSON.parse(readFileSync(join(SOURCE_DIR, 'SOURCE.json'), 'utf8')) as {
      pdf: { sha256: string };
      files: { path: string }[];
    };
    expect(manifest.pdf.sha256).toBe(SRD_PDF.sha256);
    const paths = manifest.files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([SRD_PDF_PATH, DERIVED_RULES_PATH, SRD_PDF_LICENSE_PATH]),
    );
    expect(source.every((e) => typeof e.page === 'number')).toBe(true);
  });

  it('makes a rule for each entry but the two chapters, under its slug, name and words', () => {
    const entries = source.filter((e) => e.kind !== 'chapter');
    expect(rules().map((e) => e.id.split('/')[1])).toEqual(entries.map((e) => slugOf(e.index)));
    expect(rules().map((e) => e.name.en)).toEqual(entries.map((e) => e.name));
    for (const e of entries) expect(get(e.index).text?.en, e.index).toBe(String(e.desc));
    expect(rules()).toHaveLength(265);
    expect(source.filter((e) => e.desc === undefined).map((e) => e.index)).toEqual([
      'playing-the-game',
      'rules-glossary',
    ]);
  });

  it('reads the glossary whole: its 155 terms from Ability Check to Weapon Attack, in the PDF’s order', () => {
    const terms = source.filter((e) => e.kind === 'glossary').map((e) => String(e.name));
    expect(terms[0]).toBe('Ability Check');
    expect(terms.at(-1)).toBe('Weapon Attack');
    const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let i = 1; i < terms.length; i += 1) {
      expect(key(terms[i - 1] ?? '') <= key(terms[i] ?? ''), `${terms[i - 1]} / ${terms[i]}`).toBe(
        true,
      );
    }
    // The kinds of term the glossary brackets: 12 actions, 15 conditions, 6 areas, 5 hazards, 3 attitudes.
    const tags: Record<string, number> = {};
    for (const e of source)
      if (e.tag !== undefined) tags[String(e.tag)] = (tags[String(e.tag)] ?? 0) + 1;
    expect(tags).toEqual({
      Action: 12,
      Condition: 15,
      'Area of Effect': 6,
      Hazard: 5,
      Attitude: 3,
    });
  });

  it('names the sections of "Playing the Game" as the PDF’s contents does', () => {
    expect(source.filter((e) => e.kind === 'section' && e.depth === 1).map((e) => e.name)).toEqual([
      'Rhythm of Play',
      'The Six Abilities',
      'D20 Tests',
      'Proficiency',
      'Actions',
      'Social Interaction',
      'Exploration',
      'Combat',
      'Damage and Healing',
    ]);
    expect(
      source
        .filter(
          (e) =>
            e.kind === 'section' &&
            e.depth === 2 &&
            (e.parent as { index: string }).index === 'damage-and-healing',
        )
        .map((e) => e.name),
    ).toEqual([
      'Hit Points',
      'Damage Rolls',
      'Critical Hits',
      'Saving Throws and Damage',
      'Damage Types',
      'Resistance and Vulnerability',
      'Immunity',
      'Healing',
      'Dropping to 0 Hit Points',
      'Temporary Hit Points',
    ]);
  });

  it('keeps the pages: each entry has the page of its heading, inside its part', () => {
    for (const e of source) {
      const page = Number(e.page);
      if (e.kind === 'glossary' || e.index === 'rules-glossary')
        expect(page >= 176 && page <= 191, e.index).toBe(true);
      else expect(page >= 5 && page <= 18, e.index).toBe(true);
    }
  });

  it('gives each topic its rules: the counts, the sections, the kinds of term', () => {
    const count = (topic: string) => rules().filter((e) => e.topic === topic).length;
    const counts: Record<string, number> = Object.fromEntries(
      [...COMMON, ...EXTRA['2024']].map(([key]) => [key, count(key)]),
    );
    expect(counts).toEqual({
      move: 22,
      action: 14,
      bonusAction: 2,
      reaction: 2,
      combat: 14,
      otherActions: 14,
      environment: 25,
      damageAndAttack: 39,
      hitPointsDeathAndRest: 26,
      abilitiesAndSkills: 42,
      origins: 0,
      conditionsAndDiseases: 15,
      activeClassFeatures: 0,
      spells: 15,
      multiclassing: 0,
      glossary: 35,
    });
    expect(Object.values(counts).reduce((a: number, b: number) => a + b, 0)).toBe(265);
    for (const name of ['dash', 'dodge', 'help', 'hide', 'ready', 'search', 'attack'])
      expect(get(name).topic, name).toBe('action');
    for (const name of ['blinded', 'prone', 'exhaustion'])
      expect(get(name).topic, name).toBe('conditionsAndDiseases');
    expect(get('bonus-actions').topic).toBe('bonusAction');
    expect(get('bonus-action').topic).toBe('bonusAction');
    expect(get('reactions').topic).toBe('reaction');
    expect(get('movement-and-position').topic).toBe('move');
    expect(get('hit-points').topic).toBe('hitPointsDeathAndRest');
    expect(get('damage-rolls').topic).toBe('damageAndAttack');
    expect(get('cone').topic).toBe('spells');
    expect(get('falling').topic).toBe('environment');
    expect(get('campaign').topic).toBe('glossary');
  });

  it('keeps a term that both parts of the PDF define under two ids', () => {
    expect(get('cover').text?.en).not.toBe(get('cover-rules-glossary').text?.en);
    expect(get('hit-points-rules-glossary').topic).toBe('hitPointsDeathAndRest');
  });

  it('has no icon, and no character a PDF reader leaves of its own: no soft hyphen, no line-end hyphen of a word', () => {
    for (const e of rules()) {
      expect(e.icon, e.id).toBeUndefined();
      expect(e.text?.en ?? '', e.id).not.toMatch(/[\u00a0\u00ad\u200b\ufeff]/);
      expect(e.text?.en ?? '', e.id).not.toMatch(/[a-z]-\n/);
    }
  });
});
