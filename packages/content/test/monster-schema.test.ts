import { fifthEditionEntitySchema } from '@grimoire/system-5e';
import { beforeAll, describe, expect, it } from 'vitest';
import { slugOf } from '../src/import/frame.ts';
import { readSourceFile, SOURCE_DIR } from '../src/import/source.ts';
import { verifySource } from '../src/source/fetch-source.ts';

// CONT-06: the `monster` type must hold every stat block of both SRDs. This test maps each of the
// 675 monsters of the fetched source into the schema's shape, with a mapping of its own (CONT-20
// writes the importer), and the schema must accept every one. Control numbers: the source's own
// counts, 334 in SRD 5.1 and 341 in SRD 5.2.1 (measured on `e6edf9a`, CONT-06 §8).

// biome-ignore lint/suspicious/noExplicitAny: the source's JSON, read as it comes
type Raw = Record<string, any>;

/** `swarm of Tiny beasts` and `sleight-of-hand` as camelCase keys. */
function keyOf(words: string): string {
  const [first = '', ...rest] = words.toLowerCase().split(/[\s-]+/);
  return first + rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

const feet = (text: string): number => Number.parseInt(text, 10);
const words = (text: string) => ({ en: text });

/** One trait, action, reaction or legendary action, in the schema's shape. */
function abilityOf(raw: Raw) {
  const damage = (raw.damage ?? []).flatMap((part: Raw) =>
    part.damage_dice === undefined
      ? []
      : [{ formula: part.damage_dice, type: part.damage_type.index }],
  );
  const usage = raw.usage as Raw | undefined;
  return {
    name: words(raw.name),
    text: words(raw.desc ?? raw.name),
    ...(raw.attack_bonus !== undefined && { attackBonus: raw.attack_bonus }),
    ...(damage.length > 0 && { damage }),
    ...(raw.dc !== undefined && {
      save: {
        ability: raw.dc.dc_type.index,
        ...(raw.dc.dc_value !== undefined && { dc: raw.dc.dc_value }),
      },
    }),
    ...(usage?.type === 'per day' && {
      usage: {
        kind: 'perDay',
        times: usage.times,
        ...(usage.times_in_lair !== undefined && { inLair: usage.times_in_lair }),
      },
    }),
    ...(usage?.type === 'recharge on roll' && {
      usage: { kind: 'recharge', dice: usage.dice, min: usage.min_value },
    }),
    ...(usage?.type === 'recharge after rest' && {
      usage: { kind: 'rest', rests: usage.rest_types.map(keyOf) },
    }),
  };
}

function monsterOf(pack: string, ruleset: string, raw: Raw) {
  const list = (items: Raw[] | undefined) =>
    items === undefined || items.length === 0 ? undefined : items.map(abilityOf);
  const bonus = (prefix: string) =>
    Object.fromEntries(
      (raw.proficiencies as Raw[])
        .filter((p) => p.proficiency.index.startsWith(prefix))
        .map((p) => [keyOf(p.proficiency.index.slice(prefix.length)), p.value]),
    );
  const saves = bonus('saving-throw-');
  const skills = bonus('skill-');
  const { hover, ...speeds } = raw.speed as Raw;
  const senses = { ...raw.senses } as Raw;
  const passive = senses.passive_perception;
  senses.passive_perception = undefined;
  const text = (items: string[]) => (items.length === 0 ? undefined : items.map(words));
  return {
    id: `${pack}:monster/${slugOf(raw.index)}`,
    type: 'monster',
    ruleset,
    name: words(raw.name),
    source: { pack },
    size: raw.size.split(' or ').map(keyOf),
    creatureType: keyOf(raw.type),
    ...(raw.subtype && { subtype: words(raw.subtype) }),
    alignment: words(raw.alignment),
    armorClass: raw.armor_class.map((ac: Raw) => ({
      value: ac.value,
      ...(ac.type && { kind: keyOf(ac.type) }),
    })),
    hitPoints: { average: raw.hit_points, formula: raw.hit_points_roll },
    speed: Object.fromEntries(Object.entries(speeds).map(([kind, text]) => [kind, feet(text)])),
    ...(hover !== undefined && { hover }),
    scores: {
      str: raw.strength,
      dex: raw.dexterity,
      con: raw.constitution,
      int: raw.intelligence,
      wis: raw.wisdom,
      cha: raw.charisma,
    },
    ...(Object.keys(saves).length > 0 && { saves }),
    ...(Object.keys(skills).length > 0 && { skills }),
    vulnerabilities: text(raw.damage_vulnerabilities),
    resistances: text(raw.damage_resistances),
    immunities: text(raw.damage_immunities),
    ...(raw.condition_immunities.length > 0 && {
      // Six SRD 5.1 monsters list Blinded twice (measured, CONT-06 §8): a list holds each once.
      conditionImmunities: [...new Set(raw.condition_immunities.map((c: Raw) => keyOf(c.index)))],
    }),
    senses: Object.fromEntries(
      Object.entries(senses).flatMap(([kind, value]) =>
        typeof value === 'string' ? [[keyOf(kind), feet(value)]] : [],
      ),
    ),
    passivePerception: passive,
    ...(raw.languages.trim() !== '' && { languages: words(raw.languages) }),
    challengeRating: raw.challenge_rating,
    proficiencyBonus: raw.proficiency_bonus,
    xp: raw.xp,
    xpInLair: raw.xp_in_lair,
    traits: list(raw.special_abilities),
    actions: list(raw.actions),
    bonusActions: list(raw.bonus_actions),
    reactions: list(raw.reactions),
    legendaryActions: list(raw.legendary_actions),
  };
}

describe('CONT-06 the monster type holds both SRDs', () => {
  beforeAll(() => {
    const problems = verifySource(SOURCE_DIR);
    if (problems.length > 0) {
      throw new Error(
        `The import source is not in place (${problems[0]}): run \`pnpm fetch-source\`.`,
      );
    }
  });

  it.each([
    ['2014', 'srd-2014', 334],
    ['2024', 'srd-2024', 341],
  ] as const)('accepts all %s stat blocks', (ruleset, pack, count) => {
    const raws = readSourceFile(ruleset, 'Monsters') as Raw[];
    expect(raws).toHaveLength(count);
    const refused = raws.flatMap((raw) => {
      const monster = JSON.parse(JSON.stringify(monsterOf(pack, ruleset, raw)));
      const result = fifthEditionEntitySchema.safeParse(monster);
      return result.success ? [] : [`${raw.index}: ${result.error.issues[0]?.path.join('.')}`];
    });
    expect(refused).toEqual([]);
  });

  it('refuses a stat block with no creature type, no scores or no armor class', () => {
    const raw = (readSourceFile('2024', 'Monsters') as Raw[])[0] as Raw;
    const monster = JSON.parse(JSON.stringify(monsterOf('srd-2024', '2024', raw)));
    expect(fifthEditionEntitySchema.safeParse(monster).success).toBe(true);
    for (const field of ['creatureType', 'scores', 'armorClass', 'hitPoints', 'challengeRating']) {
      const { [field]: _, ...rest } = monster;
      expect(fifthEditionEntitySchema.safeParse(rest).success, field).toBe(false);
    }
    expect(fifthEditionEntitySchema.safeParse({ ...monster, scores: {} }).success).toBe(false);
  });
});
