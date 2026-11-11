import { describe, expect, it } from 'vitest';
import {
  PACK_OF,
  RULESETS,
  type Ruleset,
  runImport,
  slugOf as slugOfIndex,
} from '../src/import/frame.ts';
import { importers } from '../src/import/registry.ts';
import { readSourceFile } from '../src/import/source.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-08: the classes, their subclasses and their features. Control values are measured from the
// fetched source at `e6edf9a` by a script outside the repository, not from this importer's output
// (CONT-08 §8). No rules text is written here: the test asserts ids, keys, counts and shapes.

type Grant = Record<string, unknown> & { id: string; kind: string; atLevel?: number };

interface Made {
  id: string;
  type: string;
  key?: string;
  classKey?: string;
  name: { en: string };
  text?: { en: string };
  hitDie?: number;
  primaryAbilities?: string[];
  saves?: string[];
  subclassLevel?: number;
  levels?: { level: number; table?: Record<string, number> }[];
  spellcasting?: {
    ability: string;
    progression: string;
    preparation: string;
    preparedCount?: string | number[];
    cantripsKnown?: number[];
    spellsKnown?: number[];
    slotsTable: number[][];
    spellList: { classKey: string };
    ritual?: boolean;
  };
  multiclass?: { prerequisites?: Record<string, unknown>[]; grants?: Grant[] };
  grants?: Grant[];
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({ ruleset, importers, read: (rs, file) => readSourceFile(rs, file) }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const all = (ruleset: Ruleset, type: string) =>
  run[ruleset].entities.filter((e) => e.type === type) as unknown as Made[];
const slugOf = (e: Made) => e.id.split('/')[1] ?? '';
const classOf = (ruleset: Ruleset, key: string): Made => {
  const found = all(ruleset, 'class').find((e) => e.key === key);
  if (found === undefined) throw new Error(`${key} is not imported`);
  return found;
};
const subclassOf = (ruleset: Ruleset, slug: string): Made => {
  const found = all(ruleset, 'subclass').find((e) => slugOf(e) === slug);
  if (found === undefined) throw new Error(`${slug} is not imported`);
  return found;
};
const grant = (made: Made, id: string) => made.grants?.find((g) => g.id === id);
const choice = (made: Made | undefined, id: string) =>
  ((made && grant(made, id)?.choose) ?? { count: 0, from: [] }) as {
    count: number;
    from: string[];
  };
const grantIds = (made: Made, prefix: string) =>
  (made.grants ?? []).filter((g) => g.id.startsWith(prefix)).map((g) => g.id);
const row = (made: Made, level: number) => made.levels?.find((r) => r.level === level)?.table;

const CLASSES = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
];

describe.each(RULESETS)('CONT-08 the classes of %s', (ruleset) => {
  it('passes the frame with no problem', () => {
    expect(run[ruleset].problems).toEqual([]);
  });

  it('makes the 12 classes and 12 subclasses of the source, each under its slug and name', () => {
    const classes = readSourceFile(ruleset, 'Classes');
    const subclasses = readSourceFile(ruleset, 'Subclasses');
    expect(all(ruleset, 'class').map(slugOf)).toEqual(classes.map((e) => e.index));
    expect(all(ruleset, 'class').map((e) => e.name.en)).toEqual(classes.map((e) => e.name));
    expect(all(ruleset, 'class').map((e) => e.key)).toEqual(CLASSES);
    expect(all(ruleset, 'subclass').map(slugOf)).toEqual(subclasses.map((e) => e.index));
    expect(all(ruleset, 'subclass').map((e) => e.classKey)).toEqual(
      subclasses.map((e) => (e.class as { index: string }).index),
    );
    for (const e of [...all(ruleset, 'class'), ...all(ruleset, 'subclass')]) {
      expect(e.key, e.id).toMatch(/^[a-z][A-Za-z0-9]*$/);
    }
  });

  it('keeps each class’s hit die and saving throws, and no saving throw is a grant', () => {
    const source = readSourceFile(ruleset, 'Classes');
    for (const entry of source) {
      const made = classOf(ruleset, entry.index);
      expect(made.hitDie, entry.index).toBe(entry.hit_die);
      expect(made.saves, entry.index).toEqual(
        (entry.saving_throws as { index: string }[]).map((s) => s.index),
      );
      expect(grant(made, 'saves'), entry.index).toBeUndefined();
      expect(made.text?.en, entry.index).toMatch(/\*\*Hit Die:\*\* d\d+/);
    }
  });

  it('makes one feature for each entry of Features, and every feature a level gives', () => {
    const features = readSourceFile(ruleset, 'Features');
    const ids = new Set(all(ruleset, 'feature').map((e) => e.id));
    const wanted = features.map((f) => `${PACK_OF[ruleset]}:feature/${slugOfIndex(f.index)}`);
    expect(wanted).toHaveLength(ruleset === '2014' ? 407 : 232);
    expect(new Set(wanted).size).toBe(wanted.length);
    for (const id of wanted) expect(ids.has(id), id).toBe(true);
    for (const f of features) {
      const made = all(ruleset, 'feature').find(
        (e) => e.id === `${PACK_OF[ruleset]}:feature/${slugOfIndex(f.index)}`,
      );
      expect(made?.name.en, f.index).toBe(f.name);
    }
    const named = new Set(
      [...all(ruleset, 'class'), ...all(ruleset, 'subclass')].flatMap((e) =>
        (e.grants ?? [])
          .filter((g) => g.id.startsWith('features-'))
          .flatMap((g) => g.fixed as string[]),
      ),
    );
    const levels = readSourceFile(ruleset, 'Levels');
    const given = new Set(
      levels.flatMap((l) =>
        (l.features as { index: string }[]).map((f) => `${PACK_OF[ruleset]}:feature/${f.index}`),
      ),
    );
    expect(named).toEqual(given);
    for (const id of named) expect(ids.has(id), id).toBe(true);
  });

  it('gives each level’s features at that level: `features-<level>` with its `atLevel`', () => {
    const levels = readSourceFile(ruleset, 'Levels');
    for (const made of all(ruleset, 'class')) {
      const own = levels.filter(
        (l) => (l.class as { index: string }).index === made.key && l.subclass === undefined,
      );
      const expected = own
        .filter((l) => (l.features as unknown[]).length > 0)
        .map((l) => [
          `features-${l.level}`,
          l.level,
          (l.features as { index: string }[]).map((f) => `${PACK_OF[ruleset]}:feature/${f.index}`),
        ]);
      const have = (made.grants ?? [])
        .filter((g) => g.id.startsWith('features-'))
        .map((g) => [g.id, g.atLevel, g.fixed]);
      expect(have, made.id).toEqual(expected);
    }
  });
});

describe('CONT-08 the numbers of the source', () => {
  const SUBCLASS_LEVEL = {
    '2014': {
      barbarian: 3,
      bard: 3,
      cleric: 1,
      druid: 2,
      fighter: 3,
      monk: 3,
      paladin: 3,
      ranger: 3,
      rogue: 3,
      sorcerer: 1,
      warlock: 1,
      wizard: 2,
    },
    '2024': Object.fromEntries(CLASSES.map((c) => [c, 3])),
  } as const;
  const HIT_DIE = {
    barbarian: 12,
    bard: 8,
    cleric: 8,
    druid: 8,
    fighter: 10,
    monk: 8,
    paladin: 10,
    ranger: 10,
    rogue: 8,
    sorcerer: 6,
    warlock: 8,
    wizard: 6,
  };
  const STANDARD = [4, 8, 12, 16, 19];

  it.each(RULESETS)('%s: the hit die and the level of the subclass are the source’s', (ruleset) => {
    for (const key of CLASSES) {
      const made = classOf(ruleset, key);
      expect(made.hitDie, key).toBe(HIT_DIE[key as keyof typeof HIT_DIE]);
      expect(made.subclassLevel, key).toBe(
        (SUBCLASS_LEVEL[ruleset] as Record<string, number>)[key],
      );
    }
  });

  it('SRD 5.1: an Ability Score Improvement at levels 4, 8, 12, 16 and 19; the fighter and rogue more', () => {
    for (const key of CLASSES) {
      const made = classOf('2014', key);
      const levels = (made.grants ?? [])
        .filter((g) => g.id.startsWith('ability-scores-'))
        .map((g) => g.atLevel);
      const want =
        key === 'fighter'
          ? [4, 6, 8, 12, 14, 16, 19]
          : key === 'rogue'
            ? [4, 8, 10, 12, 16, 19]
            : STANDARD;
      expect(levels, key).toEqual(want);
      expect(grant(made, 'epic-boon'), key).toBeUndefined();
    }
  });

  it('SRD 5.2.1: an Ability Score Improvement at levels 4, 8, 12 and 16, and an Epic Boon at 19', () => {
    for (const key of CLASSES) {
      const made = classOf('2024', key);
      const levels = (made.grants ?? [])
        .filter((g) => g.id.startsWith('ability-scores-'))
        .map((g) => g.atLevel);
      const want =
        key === 'fighter'
          ? [4, 6, 8, 12, 14, 16]
          : key === 'rogue'
            ? [4, 8, 10, 12, 16]
            : [4, 8, 12, 16];
      expect(levels, key).toEqual(want);
      expect(grant(made, 'epic-boon'), key).toEqual({
        id: 'epic-boon',
        kind: 'entity',
        atLevel: 19,
        choose: { count: 1, from: { type: 'feat', category: 'epicBoon' } },
      });
    }
  });

  it('keeps an improvement as +2 to one stat or +1 to two, among the stats of the source', () => {
    const stats = readSourceFile('2024', 'Ability-Scores').map((s) => s.index);
    expect(grant(classOf('2024', 'fighter'), 'ability-scores-6')).toEqual({
      id: 'ability-scores-6',
      kind: 'abilityScore',
      atLevel: 6,
      mode: 'distribute',
      from: stats,
      patterns: [[2], [1, 1]],
    });
  });

  const COLUMNS = {
    '2014': {
      barbarian: ['rageCount', 'rageDamageBonus', 'brutalCriticalDice'],
      bard: [
        'bardicInspirationDie',
        'songOfRestDie',
        'magicalSecretsMax5',
        'magicalSecretsMax7',
        'magicalSecretsMax9',
      ],
      cleric: ['channelDivinityCharges', 'destroyUndeadCr'],
      druid: ['wildShapeMaxCr', 'wildShapeSwim', 'wildShapeFly'],
      fighter: ['actionSurges', 'indomitableUses', 'extraAttacks'],
      monk: ['martialArtsDiceCount', 'martialArtsDiceValue', 'kiPoints', 'unarmoredMovement'],
      paladin: ['auraRange'],
      ranger: ['favoredEnemies', 'favoredTerrain'],
      rogue: ['sneakAttackDiceCount', 'sneakAttackDiceValue'],
      sorcerer: ['sorceryPoints', 'metamagicKnown'],
      warlock: [
        'invocationsKnown',
        'mysticArcanumLevel6',
        'mysticArcanumLevel7',
        'mysticArcanumLevel8',
        'mysticArcanumLevel9',
      ],
      wizard: ['arcaneRecoveryLevels'],
    },
    '2024': {
      barbarian: ['rageCount', 'rageDamageBonus', 'weaponMastery'],
      bard: ['bardicInspirationDie'],
      cleric: ['channelDivinityCharges'],
      druid: ['wildShapeUses'],
      fighter: ['secondWindUses', 'weaponMastery'],
      monk: ['martialArtsDie', 'focusPoints', 'unarmoredMovementBonus'],
      paladin: ['channelDivinityCharges'],
      ranger: ['favoredEnemies'],
      rogue: ['sneakAttackDiceCount', 'sneakAttackDiceValue'],
      sorcerer: ['sorceryPoints'],
      warlock: ['eldritchInvocations'],
    },
  } as Record<Ruleset, Record<string, string[]>>;

  it.each(RULESETS)(
    '%s: a class’s table has the columns of the source’s `class_specific`, on 20 rows',
    (ruleset) => {
      for (const key of CLASSES) {
        const made = classOf(ruleset, key);
        const want = COLUMNS[ruleset][key];
        if (want === undefined) {
          expect(made.levels, key).toBeUndefined();
          continue;
        }
        expect(
          made.levels?.map((r) => r.level),
          key,
        ).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
        for (const r of made.levels ?? [])
          expect(Object.keys(r.table ?? {}).sort(), `${key} ${r.level}`).toEqual([...want].sort());
      }
    },
  );

  it('reads the numbers of a row as the source has them', () => {
    expect(row(classOf('2014', 'barbarian'), 5)).toEqual({
      rageCount: 3,
      rageDamageBonus: 2,
      brutalCriticalDice: 0,
    });
    expect(row(classOf('2014', 'monk'), 5)).toMatchObject({
      martialArtsDiceCount: 1,
      martialArtsDiceValue: 6,
      kiPoints: 5,
      unarmoredMovement: 10,
    });
    expect(row(classOf('2014', 'rogue'), 5)).toEqual({
      sneakAttackDiceCount: 3,
      sneakAttackDiceValue: 6,
    });
    expect(row(classOf('2014', 'rogue'), 1)).toEqual({
      sneakAttackDiceCount: 1,
      sneakAttackDiceValue: 6,
    });
    expect(row(classOf('2024', 'fighter'), 4)).toEqual({ secondWindUses: 3, weaponMastery: 4 });
    expect(row(classOf('2024', 'fighter'), 10)).toEqual({ secondWindUses: 4, weaponMastery: 5 });
    expect(row(classOf('2024', 'fighter'), 16)).toEqual({ secondWindUses: 4, weaponMastery: 6 });
    expect(row(classOf('2024', 'monk'), 5)).toEqual({
      martialArtsDie: 8,
      focusPoints: 5,
      unarmoredMovementBonus: 10,
    });
    expect(row(classOf('2024', 'warlock'), 5)).toEqual({ eldritchInvocations: 5 });
    // A flag is 1 or 0; a list (the Sorcerer's `creating_spell_slots`) is no column.
    const flags = classOf('2014', 'druid').levels?.flatMap((r) => [
      r.table?.wildShapeSwim,
      r.table?.wildShapeFly,
    ]);
    expect(new Set(flags)).toEqual(new Set([0, 1]));
    expect(
      classOf('2014', 'sorcerer').levels?.every((r) => !('creatingSpellSlots' in (r.table ?? {}))),
    ).toBe(true);
  });

  it('SRD 5.1: the fixed starting items are an item grant; SRD 5.2.1 has none (a package or gold)', () => {
    expect(grant(classOf('2014', 'paladin'), 'equipment')).toEqual({
      id: 'equipment',
      kind: 'item',
      fixed: [{ id: 'srd-2014:item/chain-mail', qty: 1 }],
    });
    expect(grant(classOf('2014', 'monk'), 'equipment')).toEqual({
      id: 'equipment',
      kind: 'item',
      fixed: [{ id: 'srd-2014:item/dart', qty: 10 }],
    });
    for (const key of CLASSES)
      expect(grant(classOf('2024', key), 'equipment'), key).toBeUndefined();
    // Every item named exists.
    const items = new Set<string>(
      run['2014'].entities.filter((e) => e.type === 'item').map((e) => e.id),
    );
    for (const made of all('2014', 'class')) {
      for (const item of (grant(made, 'equipment')?.fixed as { id: string }[] | undefined) ?? []) {
        expect(items.has(item.id), item.id).toBe(true);
      }
    }
  });
});

describe('CONT-08 proficiencies and multiclassing', () => {
  it('names armor by group, a shield as `shield`, a weapon by group or by its item’s key', () => {
    const paladin = classOf('2014', 'paladin');
    expect(grant(paladin, 'armor')).toMatchObject({
      category: 'armor',
      fixed: ['light', 'medium', 'heavy', 'shield'],
    });
    expect(grant(paladin, 'weapons')).toMatchObject({
      category: 'weapon',
      fixed: ['simple', 'martial'],
    });
    expect(grant(classOf('2014', 'wizard'), 'weapons')?.fixed).toEqual([
      'dagger',
      'dart',
      'sling',
      'quarterstaff',
      'crossbowLight',
    ]);
    expect(grant(classOf('2014', 'bard'), 'weapons')?.fixed).toEqual([
      'simple',
      'longsword',
      'rapier',
      'shortsword',
      'crossbowHand',
    ]);
    expect(grant(classOf('2024', 'rogue'), 'weapons')?.fixed).toEqual([
      'simple',
      'longsword',
      'rapier',
      'scimitar',
      'shortsword',
      'whip',
      'handCrossbow',
    ]);
    expect(grant(classOf('2014', 'cleric'), 'armor')?.fixed).toEqual(['light', 'medium', 'shield']);
  });

  it('names a tool by its kind: the Druid’s herbalism kit, the Rogue’s thieves’ tools', () => {
    expect(grant(classOf('2014', 'druid'), 'tools')?.fixed).toEqual(['herbalismKit']);
    expect(grant(classOf('2024', 'druid'), 'tools')?.fixed).toEqual(['herbalismKit']);
    expect(grant(classOf('2014', 'rogue'), 'tools')?.fixed).toEqual(['thievesTools']);
    expect(grant(classOf('2024', 'rogue'), 'tools')?.fixed).toEqual(['thievesTools']);
    const kinds = new Set(
      run['2024'].entities
        .filter((e) => e.type === 'toolKind')
        .map((e) => (e as unknown as Made).key),
    );
    expect(kinds.has('thievesTools')).toBe(true);
  });

  it('chooses skills from the class’s list, any skill as a filter, and the Monk’s tool from both kinds', () => {
    expect(grant(classOf('2014', 'cleric'), 'skills')).toMatchObject({
      choose: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    });
    expect(grant(classOf('2024', 'fighter'), 'skills')).toMatchObject({
      choose: {
        count: 2,
        from: [
          'acrobatics',
          'animalHandling',
          'athletics',
          'history',
          'insight',
          'intimidation',
          'perception',
          'survival',
        ],
      },
    });
    for (const ruleset of RULESETS) {
      expect(grant(classOf(ruleset, 'bard'), 'skills')).toMatchObject({
        choose: { count: 3, from: { type: 'skill' } },
      });
      expect(grant(classOf(ruleset, 'rogue'), 'skills')).toMatchObject({ choose: { count: 4 } });
      const tool = grant(classOf(ruleset, 'monk'), 'tools') as unknown as {
        choose: { count: number; from: string[] };
      };
      expect(tool.choose.count).toBe(1);
      // 17 artisan's tools' kinds and the 10 instruments, and in SRD 5.1 two kits among them.
      expect(tool.choose.from).toEqual(expect.arrayContaining(['smithsTools', 'lute', 'flute']));
      expect(new Set(tool.choose.from).size).toBe(tool.choose.from.length);
      expect(grant(classOf(ruleset, 'bard'), 'tools')).toMatchObject({
        choose: { count: 3, from: expect.arrayContaining(['lute', 'bagpipes']) },
      });
    }
  });

  it('keeps the prerequisites and proficiencies of multiclassing', () => {
    for (const ruleset of RULESETS) {
      expect(classOf(ruleset, 'paladin').multiclass?.prerequisites).toEqual([
        { kind: 'ability', key: 'str', min: 13 },
        { kind: 'ability', key: 'cha', min: 13 },
      ]);
      expect(classOf(ruleset, 'fighter').multiclass?.prerequisites).toEqual([
        {
          kind: 'formula',
          formula: '@abilities.str.score >= 13 || @abilities.dex.score >= 13',
          label: { en: 'Strength 13 or Dexterity 13' },
        },
      ]);
      expect(classOf(ruleset, 'wizard').multiclass).toEqual({
        prerequisites: [{ kind: 'ability', key: 'int', min: 13 }],
      });
      expect(classOf(ruleset, 'sorcerer').multiclass?.grants).toBeUndefined();
    }
    expect(classOf('2014', 'barbarian').multiclass?.grants).toEqual([
      { id: 'multiclass-armor', kind: 'proficiency', category: 'armor', fixed: ['shield'] },
      {
        id: 'multiclass-weapons',
        kind: 'proficiency',
        category: 'weapon',
        fixed: ['simple', 'martial'],
      },
    ]);
    expect(classOf('2024', 'paladin').multiclass?.grants).toEqual([
      {
        id: 'multiclass-armor',
        kind: 'proficiency',
        category: 'armor',
        fixed: ['light', 'medium', 'shield'],
      },
      { id: 'multiclass-weapons', kind: 'proficiency', category: 'weapon', fixed: ['martial'] },
    ]);
    expect(classOf('2024', 'rogue').multiclass?.grants?.map((g) => g.id)).toEqual([
      'multiclass-armor',
      'multiclass-tools',
      'multiclass-skills',
    ]);
    expect(grant(classOf('2024', 'rogue'), 'multiclass-skills')).toBeUndefined();
  });

  it('SRD 5.2.1 names each class’s primary ability; SRD 5.1 has none', () => {
    expect(classOf('2024', 'paladin').primaryAbilities).toEqual(['str', 'cha']);
    expect(classOf('2024', 'fighter').primaryAbilities).toEqual(['str', 'dex']);
    expect(classOf('2024', 'wizard').primaryAbilities).toEqual(['int']);
    for (const key of CLASSES) expect(classOf('2014', key).primaryAbilities, key).toBeUndefined();
  });

  it('puts right the one wrongly decoded apostrophe of the source, in the Monk’s words', () => {
    const source = JSON.stringify(readSourceFile('2024', 'Classes'));
    expect(source.includes('\u00e2\u20ac\u2122')).toBe(true);
    for (const ruleset of RULESETS) {
      const text = classOf(ruleset, 'monk').text?.en ?? '';
      expect(text).toMatch(/artisan’s tools/);
      expect(text).not.toMatch(/â/);
    }
  });
});

describe('CONT-08 spellcasting', () => {
  const CASTERS = {
    '2014': {
      bard: ['full', 'known'],
      cleric: ['full', 'prepared'],
      druid: ['full', 'prepared'],
      paladin: ['half', 'prepared'],
      ranger: ['half', 'known'],
      sorcerer: ['full', 'known'],
      warlock: ['pact', 'known'],
      wizard: ['full', 'spellbook'],
    },
    '2024': {
      bard: ['full', 'prepared'],
      cleric: ['full', 'prepared'],
      druid: ['full', 'prepared'],
      paladin: ['half', 'prepared'],
      ranger: ['half', 'prepared'],
      sorcerer: ['full', 'prepared'],
      warlock: ['pact', 'prepared'],
      wizard: ['full', 'spellbook'],
    },
  } as Record<Ruleset, Record<string, string[]>>;

  it.each(RULESETS)('%s: the eight casters and no other class cast', (ruleset) => {
    for (const key of CLASSES) {
      const made = classOf(ruleset, key);
      const want = CASTERS[ruleset][key];
      if (want === undefined) {
        expect(made.spellcasting, key).toBeUndefined();
        continue;
      }
      expect([made.spellcasting?.progression, made.spellcasting?.preparation], key).toEqual(want);
      expect(made.spellcasting?.spellList, key).toEqual({ classKey: key });
      expect(made.spellcasting?.slotsTable, key).toHaveLength(20);
    }
  });

  it('reads the slots of each level from the source, the trailing zeros dropped', () => {
    const levels = readSourceFile('2014', 'Levels').filter(
      (l) => (l.class as { index: string }).index === 'wizard' && l.subclass === undefined,
    );
    for (const l of levels) {
      const slots = Array.from(
        { length: 9 },
        (_, i) => (l.spellcasting as Record<string, number>)[`spell_slots_level_${i + 1}`] ?? 0,
      );
      while (slots.at(-1) === 0) slots.pop();
      expect(
        classOf('2014', 'wizard').spellcasting?.slotsTable[Number(l.level) - 1],
        `level ${l.level}`,
      ).toEqual(slots);
    }
    const table = (ruleset: Ruleset, key: string) => classOf(ruleset, key).spellcasting?.slotsTable;
    expect(table('2014', 'paladin')?.[0]).toEqual([]);
    expect(table('2014', 'paladin')?.[1]).toEqual([2]);
    expect(table('2014', 'paladin')?.[4]).toEqual([4, 2]);
    expect(table('2024', 'paladin')?.[0]).toEqual([2]);
    expect(table('2014', 'warlock')?.[0]).toEqual([1]);
    expect(table('2014', 'warlock')?.[4]).toEqual([0, 0, 2]);
    expect(table('2014', 'warlock')?.[19]).toEqual([0, 0, 0, 0, 4]);
    expect(table('2024', 'wizard')?.[19]).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
    expect(table('2014', 'wizard')).toEqual(table('2024', 'wizard'));
  });

  it('reads the cantrips and the spells known or prepared as a column of 20', () => {
    expect(classOf('2014', 'cleric').spellcasting?.cantripsKnown).toEqual([
      3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    ]);
    expect(classOf('2014', 'paladin').spellcasting?.cantripsKnown).toBeUndefined();
    expect(classOf('2024', 'paladin').spellcasting?.cantripsKnown).toBeUndefined();
    expect(classOf('2024', 'wizard').spellcasting?.preparedCount).toEqual([
      4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
    ]);
    expect(classOf('2024', 'paladin').spellcasting?.preparedCount).toEqual([
      2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15,
    ]);
    expect(classOf('2014', 'bard').spellcasting?.spellsKnown?.slice(0, 5)).toEqual([4, 5, 6, 7, 8]);
    expect(classOf('2014', 'bard').spellcasting?.preparedCount).toBeUndefined();
    expect(classOf('2014', 'warlock').spellcasting?.spellsKnown?.slice(0, 5)).toEqual([
      2, 3, 4, 5, 6,
    ]);
  });

  it('SRD 5.1: a class that prepares says how many in a formula, read from its words', () => {
    expect(classOf('2014', 'cleric').spellcasting?.preparedCount).toBe(
      'max(1, @abilities.wis.mod + @classes.cleric.level)',
    );
    expect(classOf('2014', 'druid').spellcasting?.preparedCount).toBe(
      'max(1, @abilities.wis.mod + @classes.druid.level)',
    );
    expect(classOf('2014', 'wizard').spellcasting?.preparedCount).toBe(
      'max(1, @abilities.int.mod + @classes.wizard.level)',
    );
    expect(classOf('2014', 'paladin').spellcasting?.preparedCount).toBe(
      'max(1, @abilities.cha.mod + floor(@classes.paladin.level / 2))',
    );
  });

  it('SRD 5.1: ritual casting is the Bard’s, Cleric’s, Druid’s and Wizard’s; SRD 5.2.1: every caster’s', () => {
    expect(CLASSES.filter((k) => classOf('2014', k).spellcasting?.ritual === true)).toEqual([
      'bard',
      'cleric',
      'druid',
      'wizard',
    ]);
    expect(CLASSES.filter((k) => classOf('2024', k).spellcasting?.ritual === true)).toEqual([
      'bard',
      'cleric',
      'druid',
      'paladin',
      'ranger',
      'sorcerer',
      'warlock',
      'wizard',
    ]);
  });
});

describe('CONT-08 subclasses and features', () => {
  it('SRD 5.1: a domain’s or oath’s spells are always prepared, at the class level that gives them', () => {
    expect(grantIds(subclassOf('2014', 'life'), 'domain-spells-')).toEqual([
      'domain-spells-1',
      'domain-spells-3',
      'domain-spells-5',
      'domain-spells-7',
      'domain-spells-9',
    ]);
    expect(grant(subclassOf('2014', 'life'), 'domain-spells-1')).toEqual({
      id: 'domain-spells-1',
      kind: 'spell',
      atLevel: 1,
      fixed: ['srd-2014:spell/bless', 'srd-2014:spell/cure-wounds'],
      alwaysPrepared: true,
    });
    expect(grantIds(subclassOf('2014', 'devotion'), 'domain-spells-')).toEqual([
      'domain-spells-3',
      'domain-spells-5',
      'domain-spells-9',
      'domain-spells-13',
      'domain-spells-17',
    ]);
    const spells = new Set<string>(
      run['2014'].entities.filter((e) => e.type === 'spell').map((e) => e.id),
    );
    for (const made of all('2014', 'subclass')) {
      for (const g of (made.grants ?? []).filter((g) => g.kind === 'spell')) {
        for (const id of g.fixed as string[]) expect(spells.has(id), id).toBe(true);
      }
    }
  });

  it('SRD 5.1: the Land druid’s circle spells are the grants of the terrain chosen, not of the subclass', () => {
    expect(grantIds(subclassOf('2014', 'land'), 'domain-spells-')).toEqual([]);
    const arctic = all('2014', 'feature').find((e) => slugOf(e) === 'circle-of-the-land-arctic');
    expect(arctic?.grants?.map((g) => [g.id, g.atLevel])).toEqual([
      ['domain-spells-3', 3],
      ['domain-spells-5', 5],
      ['domain-spells-7', 7],
      ['domain-spells-9', 9],
    ]);
    expect(arctic?.grants?.[0]).toMatchObject({
      kind: 'spell',
      fixed: ['srd-2014:spell/hold-person', 'srd-2014:spell/spike-growth'],
      alwaysPrepared: true,
    });
    const terrains = all('2014', 'feature').filter(
      (e) => slugOf(e).startsWith('circle-of-the-land-') && e.grants !== undefined,
    );
    expect(terrains).toHaveLength(7);
  });

  it('SRD 5.1: the Fiend’s list is an expanded list to choose from, so it is no grant', () => {
    const source = readSourceFile('2014', 'Subclasses').find((e) => e.index === 'fiend');
    expect(((source?.spells ?? []) as unknown[]).length).toBe(10);
    expect(grantIds(subclassOf('2014', 'fiend'), 'domain-spells-')).toEqual([]);
  });

  it('SRD 5.2.1: a subclass has its features only; the Circle of the Land’s source lists differ and Levels decides', () => {
    for (const made of all('2024', 'subclass')) {
      expect(
        (made.grants ?? []).every((g) => g.id.startsWith('features-')),
        made.id,
      ).toBe(true);
    }
    expect(grantIds(subclassOf('2024', 'champion'), 'features-')).toEqual([
      'features-3',
      'features-7',
      'features-10',
      'features-15',
      'features-18',
    ]);
  });

  it('gives a feature that offers sub-features a choice among them: 14 in SRD 5.1', () => {
    const offering = all('2014', 'feature').filter((e) => grant(e, 'subfeatures') !== undefined);
    expect(offering).toHaveLength(14);
    const style = grant(
      all('2014', 'feature').find((e) => slugOf(e) === 'fighter-fighting-style') as Made,
      'subfeatures',
    );
    expect(style).toEqual({
      id: 'subfeatures',
      kind: 'entity',
      choose: {
        count: 1,
        from: [
          'srd-2014:feature/fighter-fighting-style-archery',
          'srd-2014:feature/fighter-fighting-style-defense',
          'srd-2014:feature/fighter-fighting-style-dueling',
          'srd-2014:feature/fighter-fighting-style-great-weapon-fighting',
          'srd-2014:feature/fighter-fighting-style-protection',
          'srd-2014:feature/fighter-fighting-style-two-weapon-fighting',
        ],
      },
    });
    expect(
      choice(
        all('2014', 'feature').find((e) => slugOf(e) === 'metamagic-1'),
        'subfeatures',
      ).count,
    ).toBe(2);
    expect(
      grant(
        all('2014', 'feature').find((e) => slugOf(e) === 'dragon-ancestor') as Made,
        'subfeatures',
      )?.choose,
    ).toMatchObject({
      count: 1,
      from: expect.arrayContaining(['srd-2014:feature/dragon-ancestor-black-acid-damage']),
    });
    const ids = new Set(all('2014', 'feature').map((e) => e.id));
    for (const e of offering) {
      for (const id of choice(e, 'subfeatures').from) expect(ids.has(id), id).toBe(true);
    }
    expect(
      all('2024', 'feature').filter((e) => grant(e, 'subfeatures') !== undefined),
    ).toHaveLength(0);
  });
});

describe('CONT-08 the hand-written packs', () => {
  const held = (pack: { entities: unknown[] }, type: string) =>
    (pack.entities as Made[]).filter((e) => e.type === type);

  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: each class and subclass it holds is imported with the same fields and grants',
    (ruleset, pack) => {
      const classes = held(pack, 'class');
      expect(classes.length).toBeGreaterThan(0);
      for (const e of [...classes, ...held(pack, 'subclass')]) {
        const imported = [...all(ruleset, 'class'), ...all(ruleset, 'subclass')].find(
          (i) => i.id === e.id,
        );
        expect(imported, e.id).toBeDefined();
        for (const g of e.grants ?? [])
          expect(
            imported?.grants?.find((i) => i.id === g.id),
            `${e.id} ${g.id}`,
          ).toEqual(g);
        for (const field of [
          'key',
          'classKey',
          'hitDie',
          'primaryAbilities',
          'saves',
          'subclassLevel',
          'levels',
          'multiclass',
        ] as const) {
          if (e[field] !== undefined)
            expect(imported?.[field], `${e.id} ${field}`).toEqual(e[field]);
        }
        if (e.spellcasting !== undefined) {
          for (const [field, value] of Object.entries(e.spellcasting)) {
            expect(
              ((imported?.spellcasting ?? {}) as Record<string, unknown>)[field],
              `${e.id} spellcasting.${field}`,
            ).toEqual(value);
          }
        }
      }
    },
  );

  it.each([
    ['2014', srd2014],
    ['2024', srd2024],
  ] as const)(
    '%s: the features of a class or subclass the pack holds are imported',
    (ruleset, pack) => {
      const ids = new Set(all(ruleset, 'feature').map((e) => e.id));
      const classes = new Set(
        [...held(pack, 'class'), ...held(pack, 'subclass')].flatMap((e) =>
          (e.grants ?? [])
            .filter((g) => g.kind === 'entity')
            .flatMap((g) => (g.fixed as string[] | undefined) ?? []),
        ),
      );
      expect(classes.size).toBeGreaterThan(0);
      for (const id of classes) expect(ids.has(id), id).toBe(true);
    },
  );
});
