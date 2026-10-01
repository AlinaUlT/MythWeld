import { evaluateNumber, loadContentIndex } from '@grimoire/engine';
import { parseEntityId } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import {
  ashExpected,
  ash as ashFile,
  brookExpected,
  brook as brookFile,
  openTalesCharacter,
  openTalesPack,
  TALES_RULES,
  type TalesCharacter,
  type TalesEntity,
  type TalesExpected,
  type TalesPack,
  talesCore,
} from '../../schema/test/tales/index.ts';

/** The value of an opener's result, or a failed test naming why it did not open. */
function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const pack: TalesPack = opened(openTalesPack(talesCore));
const { index } = loadContentIndex('tales', [pack]);
const characters: [string, TalesCharacter, TalesExpected][] = [
  ['Ash', opened(openTalesCharacter(ashFile)), ashExpected],
  ['Brook', opened(openTalesCharacter(brookFile)), brookExpected],
];

/** The character's entry with this id: its own first, then the index's. */
function find(character: TalesCharacter, id: string): TalesEntity | undefined {
  const own = character.localEntities.find((entity) => entity.id === id);
  if (own !== undefined) return own;
  const found = index.get(id);
  return found.ok ? found.entity : undefined;
}

/** Every entity id the character's document names. */
function idsNamed(character: TalesCharacter): string[] {
  const choiceValues = Object.values(character.choices)
    .flat()
    .filter((value) => parseEntityId(value) !== undefined);
  const partOwners = [
    ...Object.keys(character.choices),
    ...Object.keys(character.state.toggles),
  ].map((part) => part.slice(0, part.indexOf('#')));
  return [
    character.systemData.calling,
    ...character.systemData.talents,
    ...character.state.conditions.map((condition) => condition.id),
    ...choiceValues,
    ...partOwners,
  ];
}

/** The stats and the skills of the character's edition, from the pack. */
function statsAndSkills(character: TalesCharacter) {
  const inEdition = (entity: TalesEntity) =>
    entity.ruleset === 'any' || entity.ruleset === character.ruleset;
  const entities = pack.entities.filter(inEdition);
  return {
    stats: entities.flatMap((entity) => (entity.type === 'ability' ? [entity] : [])),
    skills: entities.flatMap((entity) => (entity.type === 'skill' ? [entity] : [])),
  };
}

/** The resource grants of the entities the character has. */
function resourceGrants(character: TalesCharacter, expected: TalesExpected) {
  return expected.entities.flatMap((id) =>
    (find(character, id)?.grants ?? []).flatMap((grant) =>
      grant.kind === 'resource' ? [grant] : [],
    ),
  );
}

describe('ENG-27 made-up test system', () => {
  it('opens its pack and characters as files, and loads the pack with no warning', () => {
    expect(openTalesPack(talesCore)).toEqual({
      ok: true,
      value: talesCore,
      from: { schemaVersion: 1, systemSchemaVersion: 1 },
    });
    for (const file of [ashFile, brookFile]) {
      expect(openTalesCharacter(file), file.name).toEqual({
        ok: true,
        value: file,
        from: { schemaVersion: 1, systemSchemaVersion: 1 },
      });
    }
    const loaded = loadContentIndex('tales', [pack]);
    expect(loaded.loaded).toEqual(['tales-core']);
    expect(loaded.refused).toEqual([]);
    expect(loaded.warnings).toEqual([]);
  });

  it.each(characters)(
    '%s: every id it names is found, but its expected missing ids',
    (_, character, expected) => {
      const missing = idsNamed(character).filter((id) => find(character, id) === undefined);
      expect(missing).toEqual(expected.missing);
      for (const id of expected.entities) {
        const entity = find(character, id);
        expect(entity?.ruleset, id).toBeOneOf(['any', character.ruleset]);
      }
    },
  );

  it.each(characters)(
    '%s: its unmade choices and unmet prerequisites are in the data',
    (_, character, expected) => {
      for (const part of expected.pendingChoices) {
        const [id = '', grantId] = part.split('#');
        const grant = find(character, id)?.grants?.find((each) => each.id === grantId);
        expect(grant && 'choose' in grant ? grant.choose : undefined, part).toBeDefined();
        expect(character.choices[part], part).toBeUndefined();
        expect(expected.entities, part).toContain(id);
      }
      for (const id of expected.unmetPrerequisites) {
        expect(expected.entities, id).toContain(id);
        expect(find(character, id)?.prerequisites?.length, id).toBeGreaterThan(0);
      }
    },
  );

  it.each(characters)(
    '%s: its values name each stat, skill and resource it has, and nothing else',
    (_, character, expected) => {
      const { stats, skills } = statsAndSkills(character);
      const paths = [
        'level',
        ...stats.flatMap(({ key }) => ['score', 'mod', 'max'].map((p) => `abilities.${key}.${p}`)),
        ...skills.flatMap(({ key, passive }) =>
          (passive ? ['prof', 'total', 'passive'] : ['prof', 'total']).map(
            (p) => `skills.${key}.${p}`,
          ),
        ),
        ...resourceGrants(character, expected).map(({ key }) => `resources.${key}.max`),
      ];
      expect(Object.keys(expected.values).sort()).toEqual(paths.sort());
      expect(expected.values.level).toBe(character.systemData.level);
    },
  );

  it.each(characters)(
    "%s: its values agree with the data's formulas and Tales' rules",
    (_, character, expected) => {
      const { values } = expected;
      const read = (path: string) => values[path];
      for (const stat of statsAndSkills(character).stats) {
        const score = values[`abilities.${stat.key}.score`] ?? Number.NaN;
        const max = values[`abilities.${stat.key}.max`];
        expect(max, stat.key).toBe(stat.defaultMax ?? TALES_RULES.statMax);
        expect(score, stat.key).toBeLessThanOrEqual(max ?? Number.NaN);
        const mod = evaluateNumber(stat.modFormula ?? TALES_RULES.modFormula, (path) =>
          path === 'score' ? score : undefined,
        );
        expect(mod, stat.key).toEqual({
          value: values[`abilities.${stat.key}.mod`],
          reads: ['score'],
          warnings: [],
        });
      }
      for (const skill of statsAndSkills(character).skills.filter(({ passive }) => passive)) {
        expect(values[`skills.${skill.key}.passive`], skill.key).toBe(
          TALES_RULES.passiveBase + (values[`skills.${skill.key}.total`] ?? Number.NaN),
        );
      }
      for (const grant of resourceGrants(character, expected)) {
        const max = evaluateNumber(grant.uses.max, read);
        expect(max.warnings, grant.key).toEqual([]);
        expect(max.value, grant.key).toBe(values[`resources.${grant.key}.max`]);
      }
      for (const override of character.overrides) {
        expect(values[override.path], override.path).toBe(override.value);
      }
    },
  );
});
