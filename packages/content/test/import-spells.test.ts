import { describe, expect, it } from 'vitest';
import { PACK_OF, RULESETS, type Ruleset, runImport } from '../src/import/frame.ts';
import { importers } from '../src/import/registry.ts';
import { readSourceFile } from '../src/import/source.ts';
import { srd2014, srd2024 } from '../src/index.ts';

// CONT-07: the spells. Control values are measured from the fetched source at `e6edf9a` by a script
// outside the repository, not from this importer's output (CONT-07 §8). No rules text is written
// here: the test asserts ids, keys, counts and shapes.

interface Made {
  id: string;
  type: string;
  key?: string;
  name: { en: string };
  text: { en: string };
  level: number;
  school: string;
  castingTime: { value: number; unit: string; note?: { en: string } };
  range: { kind: string; distance?: number; area?: { shape: string; size: number } };
  components: {
    v: boolean;
    s: boolean;
    m?: { en: string };
    mCost?: { amount: number; unit: string };
    mConsumed?: boolean;
  };
  duration: { kind: string; value?: number; unit?: string };
  concentration: boolean;
  ritual: boolean;
  classes: string[];
  attack?: string;
  save?: string;
  damage?: { formula: string; type: string }[];
  healing?: { formula: string; kind: string };
  healingEachTurn?: { formula: string; kind: string };
  scaling?: {
    kind: string;
    formula: string;
    every?: number;
    damageTypes?: string[];
    pickOne?: boolean;
  };
  upgrades?: Record<string, unknown>[];
}

const run = Object.fromEntries(
  RULESETS.map((ruleset) => [
    ruleset,
    runImport({ ruleset, importers, read: (rs, file) => readSourceFile(rs, file) }),
  ]),
) as Record<Ruleset, ReturnType<typeof runImport>>;

const made = (ruleset: Ruleset) =>
  run[ruleset].entities.filter((e) => e.type === 'spell') as unknown as Made[];
const slug = (spell: Made) => spell.id.split('/')[1] ?? '';
const spell = (ruleset: Ruleset, name: string): Made => {
  const found = made(ruleset).find((e) => e.id === `${PACK_OF[ruleset]}:spell/${name}`);
  if (found === undefined) throw new Error(`${name} is not imported`);
  return found;
};
const count = (ruleset: Ruleset, test: (spell: Made) => boolean) =>
  made(ruleset).filter(test).length;
const idsOf = (ruleset: Ruleset, test: (spell: Made) => boolean) =>
  made(ruleset).filter(test).map(slug);

describe.each(RULESETS)('CONT-07 the spells of %s', (ruleset) => {
  it('passes the frame with no problem', () => {
    expect(run[ruleset].problems).toEqual([]);
  });

  it('makes one spell for each entry, under its slug and name, with its words', () => {
    const source = readSourceFile(ruleset, 'Spells');
    expect(made(ruleset).map(slug)).toEqual(source.map((e) => e.index));
    expect(made(ruleset).map((e) => e.name.en)).toEqual(source.map((e) => e.name));
    for (const e of made(ruleset)) expect(e.text.en, e.id).toMatch(/\S/);
  });

  it('names a school, and the classes, that exist', () => {
    const schools = new Set(
      run[ruleset].entities.filter((e) => e.type === 'spellSchool').map((e) => e.key),
    );
    const classes = new Set(readSourceFile(ruleset, 'Classes').map((e) => e.index));
    for (const e of made(ruleset)) {
      expect(schools.has(e.school), e.id).toBe(true);
      expect(e.classes.length, e.id).toBeGreaterThan(0);
      for (const key of e.classes) expect(classes.has(key), `${e.id} ${key}`).toBe(true);
    }
  });

  it('names damage types and areas that exist', () => {
    const types = new Set(
      run[ruleset].entities.filter((e) => e.type === 'damageType').map((e) => e.key),
    );
    const shapes = new Set(
      run[ruleset].entities.filter((e) => e.type === 'areaShape').map((e) => e.key),
    );
    for (const e of made(ruleset)) {
      for (const d of e.damage ?? []) expect(types.has(d.type), `${e.id} ${d.type}`).toBe(true);
      if (e.range.area) expect(shapes.has(e.range.area.shape), e.id).toBe(true);
      if (e.scaling?.damageTypes) {
        for (const t of e.scaling.damageTypes) expect(types.has(t), `${e.id} ${t}`).toBe(true);
      }
    }
  });
});

describe('CONT-07 the numbers of the source', () => {
  const EXPECTED = {
    '2014': {
      total: 319,
      levels: [24, 49, 54, 42, 31, 37, 31, 20, 16, 15],
      schools: {
        abjuration: 39,
        conjuration: 52,
        divination: 29,
        enchantment: 29,
        evocation: 60,
        illusion: 27,
        necromancy: 24,
        transmutation: 59,
      },
      casting: { action: 242, minute: 46, hour: 13, bonus: 14, reaction: 4 },
      range: { distance: 186, self: 62, touch: 67, special: 1, sight: 2, unlimited: 1 },
      duration: { instant: 87, timed: 218, untilDispelled: 12, special: 2 },
      ritual: 29,
      concentration: 126,
      attack: 16,
      material: 184,
      v: 312,
      s: 286,
      classPairs: 778,
      area: 88,
      save: { dex: 34, wis: 35, con: 29, cha: 13, str: 4, int: 2 },
      damage: 64,
    },
    '2024': {
      total: 339,
      levels: [27, 57, 57, 42, 34, 38, 31, 20, 17, 16],
      schools: {
        abjuration: 49,
        conjuration: 54,
        divination: 31,
        enchantment: 34,
        evocation: 54,
        illusion: 29,
        necromancy: 27,
        transmutation: 61,
      },
      casting: { action: 257, minute: 41, hour: 14, bonus: 23, reaction: 4 },
      range: { distance: 198, self: 72, touch: 66, special: 1, sight: 1, unlimited: 1 },
      duration: {
        instant: 101,
        timed: 223,
        untilDispelled: 12,
        special: 1,
        untilDispelledOrTriggered: 2,
      },
      ritual: 29,
      concentration: 132,
      attack: 21,
      material: 189,
      v: 329,
      s: 300,
      classPairs: 879,
      area: 0,
      save: { dex: 38, wis: 40, con: 31, cha: 12, str: 10, int: 3 },
      damage: 89,
    },
  } as const;

  const tally = (ruleset: Ruleset, read: (spell: Made) => string) => {
    const by: Record<string, number> = {};
    for (const e of made(ruleset)) by[read(e)] = (by[read(e)] ?? 0) + 1;
    return by;
  };

  it.each(RULESETS)('%s: the counts of each field are the source’s', (ruleset) => {
    const want = EXPECTED[ruleset];
    expect(made(ruleset)).toHaveLength(want.total);
    expect(Array.from({ length: 10 }, (_, l) => count(ruleset, (e) => e.level === l))).toEqual(
      want.levels,
    );
    expect(tally(ruleset, (e) => e.school)).toEqual(want.schools);
    expect(tally(ruleset, (e) => e.castingTime.unit)).toEqual(want.casting);
    expect(tally(ruleset, (e) => e.range.kind)).toEqual(want.range);
    expect(tally(ruleset, (e) => e.duration.kind)).toEqual(want.duration);
    expect(count(ruleset, (e) => e.ritual)).toBe(want.ritual);
    expect(count(ruleset, (e) => e.concentration)).toBe(want.concentration);
    expect(count(ruleset, (e) => e.attack !== undefined)).toBe(want.attack);
    expect(count(ruleset, (e) => e.components.m !== undefined)).toBe(want.material);
    expect(count(ruleset, (e) => e.components.v)).toBe(want.v);
    expect(count(ruleset, (e) => e.components.s)).toBe(want.s);
    expect(made(ruleset).reduce((n, e) => n + e.classes.length, 0)).toBe(want.classPairs);
    expect(count(ruleset, (e) => e.range.area !== undefined)).toBe(want.area);
    const saved = Object.values(want.save).reduce((a, b) => a + b, 0);
    expect(tally(ruleset, (e) => e.save ?? '')).toEqual({ ...want.save, '': want.total - saved });
    expect(count(ruleset, (e) => e.damage !== undefined)).toBe(want.damage);
  });

  it('keeps a distance in feet: a mile is 5280 feet', () => {
    expect(spell('2014', 'clairvoyance').range).toEqual({ kind: 'distance', distance: 5280 });
    expect(spell('2014', 'project-image').range.distance).toBe(500 * 5280);
    expect(spell('2024', 'project-image').range.distance).toBe(500 * 5280);
  });

  it('SRD 5.1: an area is the source’s shape and size, on the range', () => {
    expect(spell('2014', 'fireball').range).toEqual({
      kind: 'distance',
      distance: 150,
      area: { shape: 'sphere', size: 20 },
    });
    expect(spell('2014', 'burning-hands').range.area).toEqual({ shape: 'cone', size: 15 });
    expect(spell('2014', 'lightning-bolt').range.area).toEqual({ shape: 'line', size: 100 });
    expect(spell('2014', 'flame-strike').range.area).toEqual({ shape: 'cylinder', size: 40 });
    expect(spell('2014', 'alarm').range.area).toEqual({ shape: 'cube', size: 20 });
  });

  it('SRD 5.2.1: a casting time keeps what follows its unit as the note', () => {
    expect(spell('2024', 'fireball').castingTime).toEqual({ value: 1, unit: 'action' });
    expect(spell('2024', 'shield').castingTime).toMatchObject({ value: 1, unit: 'reaction' });
    expect(idsOf('2024', (e) => e.castingTime.note !== undefined)).toEqual([
      'counterspell',
      'divine-smite',
      'ensnaring-strike',
      'feather-fall',
      'hellish-rebuke',
      'plant-growth',
      'searing-smite',
      'shield',
      'shining-smite',
    ]);
    expect(count('2014', (e) => e.castingTime.note !== undefined)).toBe(0);
    expect(spell('2014', 'identify').castingTime).toEqual({ value: 1, unit: 'minute' });
    expect(spell('2014', 'wish').castingTime).toEqual({ value: 1, unit: 'action' });
    expect(spell('2014', 'forbiddance').castingTime).toEqual({ value: 10, unit: 'minute' });
  });

  it('SRD 5.2.1: nine spells have their components in the range’s tail, and are read from it', () => {
    const source = readSourceFile('2024', 'Spells');
    const tail = source.filter((e) => /Component:/.test(String(e.range)));
    expect(tail.map((e) => e.index)).toEqual([
      'contagion',
      'divine-smite',
      'find-steed',
      'guidance',
      'power-word-heal',
      'power-word-kill',
      'resistance',
      'searing-smite',
      'sorcerous-burst',
    ]);
    expect(spell('2024', 'contagion').components).toEqual({ v: true, s: true });
    expect(spell('2024', 'contagion').range).toEqual({ kind: 'touch' });
    expect(spell('2024', 'divine-smite').components).toEqual({ v: true, s: false });
    expect(spell('2024', 'divine-smite').range).toEqual({ kind: 'self' });
    expect(spell('2024', 'find-steed').range).toEqual({ kind: 'distance', distance: 30 });
    expect(spell('2024', 'power-word-kill').components).toEqual({ v: true, s: false });
  });

  it('reads a duration: timed, instant, until dispelled, or triggered', () => {
    expect(spell('2014', 'bless').duration).toEqual({ kind: 'timed', value: 1, unit: 'minute' });
    expect(spell('2014', 'contagion').duration).toEqual({ kind: 'timed', value: 7, unit: 'day' });
    expect(spell('2024', 'contagion').duration).toEqual({ kind: 'timed', value: 7, unit: 'day' });
    expect(spell('2014', 'shield').duration).toEqual({ kind: 'timed', value: 1, unit: 'round' });
    expect(spell('2014', 'wish').duration).toEqual({ kind: 'instant' });
    expect(spell('2024', 'glyph-of-warding').duration).toEqual({
      kind: 'untilDispelledOrTriggered',
    });
    expect(spell('2024', 'symbol').duration).toEqual({ kind: 'untilDispelledOrTriggered' });
    expect(spell('2014', 'glyph-of-warding').duration).toEqual({ kind: 'untilDispelled' });
  });
});

describe('CONT-07 material components', () => {
  it('prices a material by the one amount its words name, and marks one the spell consumes', () => {
    for (const ruleset of RULESETS) {
      expect(spell(ruleset, 'revivify').components).toMatchObject({
        mCost: { amount: 300, unit: 'gp' },
        mConsumed: true,
      });
      expect(spell(ruleset, 'raise-dead').components).toMatchObject({
        mCost: { amount: 500, unit: 'gp' },
        mConsumed: true,
      });
      expect(spell(ruleset, 'identify').components.mConsumed).toBeUndefined();
    }
    expect(spell('2014', 'identify').components.mCost).toEqual({ amount: 100, unit: 'gp' });
    expect(spell('2024', 'gentle-repose').components).toMatchObject({
      mCost: { amount: 2, unit: 'cp' },
      mConsumed: true,
    });
  });

  it('gives no price to a material whose words name two different amounts', () => {
    expect(spell('2014', 'legend-lore').components.mCost).toBeUndefined();
    expect(spell('2024', 'legend-lore').components.mCost).toBeUndefined();
    expect(spell('2014', 'legend-lore').components.mConsumed).toBe(true);
  });

  it('counts the priced materials and the consumed ones', () => {
    expect([
      count('2014', (e) => e.components.mCost !== undefined),
      count('2014', (e) => e.components.mConsumed === true),
    ]).toEqual([47, 29]);
    expect([
      count('2024', (e) => e.components.mCost !== undefined),
      count('2024', (e) => e.components.mConsumed === true),
    ]).toEqual([55, 31]);
  });
});

describe('CONT-07 saves', () => {
  it('reads SRD 5.1’s save from its `dc`, and the others from the first "<stat> saving throw"', () => {
    const source = readSourceFile('2014', 'Spells');
    const withDc = source.filter((e) => e.dc !== undefined);
    expect(withDc).toHaveLength(92);
    for (const e of withDc) {
      const dc = e.dc as { dc_type: { index: string } };
      expect(spell('2014', e.index).save, e.index).toBe(dc.dc_type.index);
    }
    // 25 spells have no `dc` and name a save in their words.
    expect(count('2014', (e) => e.save !== undefined)).toBe(117);
    expect(spell('2014', 'call-lightning').save).toBe('dex');
    expect(spell('2014', 'sleep').save).toBeUndefined();
  });

  it('SRD 5.2.1: Black Tentacles is Strength now (2014: Dexterity), Sleep has a Wisdom save', () => {
    expect(spell('2024', 'black-tentacles').save).toBe('str');
    expect(spell('2014', 'black-tentacles').save).toBe('dex');
    expect(spell('2024', 'sleep').save).toBe('wis');
    expect(spell('2024', 'poison-spray').save).toBeUndefined();
    expect(spell('2024', 'poison-spray').attack).toBe('ranged');
  });
});

describe('CONT-07 damage and growth', () => {
  it('reads a damage at the spell’s own level, with its type', () => {
    expect(spell('2014', 'fireball').damage).toEqual([{ formula: '8d6', type: 'fire' }]);
    expect(spell('2024', 'fireball').damage).toEqual([{ formula: '8d6', type: 'fire' }]);
    expect(spell('2014', 'ice-storm').damage).toEqual([
      { formula: '2d8', type: 'bludgeoning' },
      { formula: '4d6', type: 'cold' },
    ]);
    expect(spell('2014', 'flame-strike').damage).toEqual([
      { formula: '4d6', type: 'fire' },
      { formula: '4d6', type: 'radiant' },
    ]);
    expect(spell('2014', 'spiritual-weapon').damage).toEqual([
      { formula: '1d8 + @mod', type: 'force' },
    ]);
    // Two of SRD 5.1's damages name no damage type: the source gives a roll and nothing else.
    expect(spell('2014', 'sleep').damage).toBeUndefined();
    expect(spell('2014', 'prismatic-spray').damage).toBeUndefined();
  });

  const SLOT_2014 = [
    'acid-arrow',
    'aid',
    'blight',
    'branding-smite',
    'burning-hands',
    'call-lightning',
    'circle-of-death',
    'cloudkill',
    'cone-of-cold',
    'cure-wounds',
    'delayed-blast-fireball',
    'disintegrate',
    'false-life',
    'fireball',
    'flame-blade',
    'flame-strike',
    'flaming-sphere',
    'freezing-sphere',
    'guiding-bolt',
    'heal',
    'healing-word',
    'heat-metal',
    'hellish-rebuke',
    'ice-storm',
    'inflict-wounds',
    'insect-plague',
    'lightning-bolt',
    'mass-cure-wounds',
    'mass-healing-word',
    'moonbeam',
    'phantasmal-killer',
    'prayer-of-healing',
    'shatter',
    'spiritual-weapon',
    'thunderwave',
    'vampiric-touch',
    'wall-of-fire',
    'wall-of-thorns',
  ];
  const SLOT_2024 = [
    'acid-arrow',
    'aid',
    'blight',
    'burning-hands',
    'call-lightning',
    'circle-of-death',
    'cloudkill',
    'cone-of-cold',
    'conjure-animals',
    'conjure-celestial',
    'conjure-woodland-beings',
    'cure-wounds',
    'dissonant-whispers',
    'divine-smite',
    'ensnaring-strike',
    'false-life',
    'fireball',
    'flame-strike',
    'flaming-sphere',
    'freezing-sphere',
    'guiding-bolt',
    'heal',
    'healing-word',
    'heat-metal',
    'hellish-rebuke',
    'ice-storm',
    'inflict-wounds',
    'insect-plague',
    'lightning-bolt',
    'mass-cure-wounds',
    'mass-healing-word',
    'mind-spike',
    'moonbeam',
    'phantasmal-killer',
    'prayer-of-healing',
    'ray-of-sickness',
    'searing-smite',
    'shatter',
    'shining-smite',
    'spirit-guardians',
    'thunderwave',
    'vampiric-touch',
    'vitriolic-sphere',
    'wall-of-fire',
    'wall-of-thorns',
  ];

  it('gives a slot scaling to the spells whose words name one die or number for each slot level', () => {
    expect(idsOf('2014', (e) => e.scaling?.kind === 'slot')).toEqual(SLOT_2014);
    expect(idsOf('2024', (e) => e.scaling?.kind === 'slot')).toEqual(SLOT_2024);
  });

  it('reads the die of a growth: SRD 5.1’s Fireball 1d6, Cure Wounds 1d8; SRD 5.2.1’s Cure Wounds 2d8', () => {
    expect(spell('2014', 'fireball').scaling).toEqual({ kind: 'slot', formula: '1d6' });
    expect(spell('2014', 'cure-wounds').scaling).toEqual({ kind: 'slot', formula: '1d8' });
    expect(spell('2024', 'cure-wounds').scaling).toEqual({ kind: 'slot', formula: '2d8' });
    expect(spell('2024', 'healing-word').scaling).toEqual({ kind: 'slot', formula: '2d4' });
    expect(spell('2014', 'heal').scaling).toEqual({ kind: 'slot', formula: '10' });
    expect(spell('2024', 'aid').scaling).toEqual({ kind: 'slot', formula: '5' });
    expect(spell('2014', 'false-life').scaling).toEqual({ kind: 'slot', formula: '5' });
  });

  it('keeps a step of two slot levels as `every`: Flame Blade and Spiritual Weapon of SRD 5.1', () => {
    expect(idsOf('2014', (e) => e.scaling?.every !== undefined)).toEqual([
      'flame-blade',
      'spiritual-weapon',
    ]);
    expect(spell('2014', 'flame-blade').scaling).toEqual({
      kind: 'slot',
      formula: '1d6',
      every: 2,
    });
    expect(idsOf('2024', (e) => e.scaling?.every !== undefined)).toEqual([]);
    expect(spell('2024', 'spiritual-weapon').scaling).toBeUndefined();
  });

  it('names the damage that grows when a spell has two: Ice Storm’s bludgeoning, Flame Strike’s choice', () => {
    expect(spell('2014', 'ice-storm').scaling).toEqual({
      kind: 'slot',
      formula: '1d8',
      damageTypes: ['bludgeoning'],
    });
    expect(spell('2014', 'flame-strike').scaling).toEqual({
      kind: 'slot',
      formula: '1d6',
      damageTypes: ['fire', 'radiant'],
      pickOne: true,
    });
    expect(idsOf('2014', (e) => e.scaling?.damageTypes !== undefined)).toEqual([
      'flame-strike',
      'ice-storm',
    ]);
    expect(idsOf('2024', (e) => e.scaling?.damageTypes !== undefined)).toEqual([]);
  });

  it('corrects a source typo from the spell’s own table: Moonbeam grows by 1d10 ("1dl0")', () => {
    const source = readSourceFile('2014', 'Spells').find((e) => e.index === 'moonbeam');
    expect(JSON.stringify(source?.higher_level)).toMatch(/1dl0/);
    expect(spell('2014', 'moonbeam').scaling?.formula).toBe('1d10');
    // The table of the same entry: 2d10 at 2, 3d10 at 3.
    const damages = (source?.damage ?? []) as { damage_at_slot_level: Record<string, string> }[];
    const table = damages[0]?.damage_at_slot_level;
    expect([table?.['2'], table?.['3']]).toEqual(['2d10', '3d10']);
  });

  it('reads a growth from SRD 5.1’s garbled words when its table agrees: Shatter 1d8', () => {
    expect(spell('2014', 'shatter').scaling).toEqual({ kind: 'slot', formula: '1d8' });
    expect(spell('2024', 'shatter').scaling).toEqual({ kind: 'slot', formula: '1d8' });
  });

  it('reads a growth SRD 5.2.1 puts in the words of the entry, not in a field', () => {
    const source = readSourceFile('2024', 'Spells');
    const inline = source.filter(
      (e) =>
        e.higher_level === undefined &&
        /Using a Higher-Level Spell Slot/.test(String(e.description)),
    );
    expect(inline.map((e) => e.index)).toEqual([
      'cure-wounds',
      'dragons-breath',
      'prayer-of-healing',
      'ray-of-sickness',
      'shatter',
      'thunderwave',
    ]);
    for (const e of inline.filter((i) => !['dragons-breath'].includes(i.index))) {
      expect(spell('2024', e.index).scaling, e.index).toBeDefined();
    }
  });

  it('gives no growth where the words name two dice, or the grown damage is not the spell’s', () => {
    for (const name of ['arcane-hand', 'wall-of-ice']) {
      expect(spell('2024', name).scaling, name).toBeUndefined();
    }
    expect(spell('2014', 'wall-of-ice').scaling).toBeUndefined();
    // "The Cold damage increases by 1d6": the spell's own damage in the source is piercing.
    expect(spell('2024', 'ice-knife').scaling).toBeUndefined();
    // "one more dart": not a die.
    expect(spell('2014', 'magic-missile').scaling).toBeUndefined();
    expect(spell('2024', 'magic-missile').scaling).toBeUndefined();
    // Another growth than dice: targets, duration.
    for (const name of ['bless', 'hold-person', 'magic-circle', 'confusion']) {
      expect(spell('2014', name).scaling, name).toBeUndefined();
    }
  });

  it('SRD 5.1: the growth agrees with the spell’s own damage table where it has one', () => {
    const parse = (roll: string) => /^(\d+)d(\d+)$/.exec(roll.split(' OR ')[0] ?? '');
    let checked = 0;
    for (const entry of readSourceFile('2014', 'Spells')) {
      const damages = entry.damage as
        | { damage_at_slot_level?: Record<string, string> }[]
        | undefined;
      const table = damages?.[0]?.damage_at_slot_level;
      const grown = spell('2014', entry.index).scaling;
      if (table === undefined || grown?.kind !== 'slot') continue;
      // SRD 5.1's Flame Strike lists "4d6 OR 5d6": a choice, not a growth of one roll.
      if (Object.values(table).some((roll) => roll.includes(' OR '))) continue;
      const levels = Object.keys(table)
        .map(Number)
        .sort((a, b) => a - b);
      const first = parse(table[String(levels[0])] ?? '');
      // The roll `every` slot levels above the first, which the table may list at every level
      // or at every second one.
      const next = parse(table[String((levels[0] ?? 0) + (grown.every ?? 1))] ?? '');
      if (levels.length < 3 || first === null || next === null) continue;
      const formula = /^(\d+)d(\d+)$/.exec(grown.formula);
      if (formula === null) continue;
      // Over `every` slot levels the table gains the formula's dice, of the same size.
      expect(Number(next[1]) - Number(first[1]), entry.index).toBe(Number(formula[1]));
      expect(Number(next[2]), entry.index).toBe(Number(first[2]));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('reads a cantrip’s growth: the die that joins at levels 5, 11 and 17', () => {
    const cantrips = (ruleset: Ruleset) =>
      made(ruleset)
        .filter((e) => e.scaling?.kind === 'cantrip')
        .map((e) => [slug(e), e.scaling?.formula]);
    expect(cantrips('2014')).toEqual([
      ['acid-splash', '1d6'],
      ['chill-touch', '1d8'],
      ['fire-bolt', '1d10'],
      ['poison-spray', '1d12'],
      ['produce-flame', '1d8'],
      ['ray-of-frost', '1d8'],
      ['sacred-flame', '1d8'],
      ['shocking-grasp', '1d8'],
      ['vicious-mockery', '1d4'],
    ]);
    expect(cantrips('2024')).toEqual([
      ['acid-splash', '1d6'],
      ['chill-touch', '1d10'],
      ['fire-bolt', '1d10'],
      ['poison-spray', '1d12'],
      ['produce-flame', '1d8'],
      ['ray-of-frost', '1d8'],
      ['sacred-flame', '1d8'],
      ['shocking-grasp', '1d8'],
      ['sorcerous-burst', '1d8'],
      ['starry-wisp', '1d8'],
      ['vicious-mockery', '1d6'],
    ]);
    for (const ruleset of RULESETS) {
      // Every cantrip that has a damage grows, and only a cantrip has a cantrip scaling.
      const grows = idsOf(ruleset, (e) => e.level === 0 && e.damage !== undefined);
      expect(grows.filter((id) => spell(ruleset, id).scaling === undefined)).toEqual([
        'eldritch-blast',
      ]);
      for (const e of made(ruleset)) {
        expect(e.scaling === undefined || (e.scaling.kind === 'cantrip') === (e.level === 0)).toBe(
          true,
        );
      }
    }
  });

  it('keeps what a cantrip’s growth cannot say as upgrades: beams, a die, a range, an extra damage', () => {
    const beams = [
      { atLevel: 5, beams: 2 },
      { atLevel: 11, beams: 3 },
      { atLevel: 17, beams: 4 },
    ];
    expect(spell('2014', 'eldritch-blast').upgrades).toEqual(beams);
    expect(spell('2024', 'eldritch-blast').upgrades).toEqual(beams);
    expect(spell('2024', 'shillelagh').upgrades).toEqual([
      { atLevel: 5, die: '1d10' },
      { atLevel: 11, die: '1d12' },
      { atLevel: 17, die: '2d6' },
    ]);
    expect(spell('2024', 'spare-the-dying').upgrades).toEqual([
      { atLevel: 5, range: 30 },
      { atLevel: 11, range: 60 },
      { atLevel: 17, range: 120 },
    ]);
    expect(spell('2024', 'true-strike').upgrades).toEqual([
      { atLevel: 5, extraDamage: { formula: '1d6', type: 'radiant' } },
      { atLevel: 11, extraDamage: { formula: '2d6', type: 'radiant' } },
      { atLevel: 17, extraDamage: { formula: '3d6', type: 'radiant' } },
    ]);
    expect(idsOf('2014', (e) => e.upgrades !== undefined)).toEqual(['eldritch-blast']);
    expect(idsOf('2024', (e) => e.upgrades !== undefined)).toEqual([
      'eldritch-blast',
      'shillelagh',
      'spare-the-dying',
      'true-strike',
    ]);
    // The numbers are in the words of the spell, in order.
    const numbers = (ruleset: Ruleset, name: string) =>
      (spell(ruleset, name).text.en.match(/\d+/g) ?? []).map(Number);
    expect(numbers('2024', 'spare-the-dying')).toEqual(
      expect.arrayContaining([5, 30, 11, 60, 17, 120]),
    );
    expect(numbers('2024', 'shillelagh')).toEqual(expect.arrayContaining([5, 10, 11, 12, 17, 6]));
    expect(numbers('2014', 'eldritch-blast')).toEqual(expect.arrayContaining([5, 11, 17]));
  });
});

describe('CONT-07 healing', () => {
  const HEALS = [
    'aid',
    'cure-wounds',
    'false-life',
    'heal',
    'healing-word',
    'heroes-feast',
    'mass-cure-wounds',
    'mass-heal',
    'mass-healing-word',
    'prayer-of-healing',
    'regenerate',
  ];

  it('gives healing to eleven spells in each ruleset', () => {
    expect(idsOf('2014', (e) => e.healing !== undefined)).toEqual(HEALS);
    expect(idsOf('2024', (e) => e.healing !== undefined)).toEqual(HEALS);
  });

  it('SRD 5.1: reads the healing at the spell’s own level from `heal_at_slot_level`', () => {
    const table = Object.fromEntries(
      readSourceFile('2014', 'Spells')
        .filter((e) => e.heal_at_slot_level !== undefined)
        .map((e) => {
          const rolls = e.heal_at_slot_level as Record<string, string>;
          const first = Math.min(...Object.keys(rolls).map(Number));
          return [e.index, (rolls[String(first)] ?? '').replace('MOD', '@mod')];
        }),
    );
    expect(Object.keys(table)).toHaveLength(10);
    for (const [name, formula] of Object.entries(table)) {
      expect(spell('2014', name).healing?.formula, name).toBe(formula);
    }
    expect(spell('2014', 'heroes-feast').healing).toEqual({ formula: '2d10', kind: 'maxHp' });
  });

  it('SRD 5.2.1: reads it from the words, as the source has no table', () => {
    const formulas = Object.fromEntries(
      made('2024')
        .filter((e) => e.healing !== undefined)
        .map((e) => [slug(e), e.healing]),
    );
    expect(formulas).toEqual({
      aid: { formula: '5', kind: 'maxHp' },
      'cure-wounds': { formula: '2d8 + @mod', kind: 'hp' },
      'false-life': { formula: '2d4 + 4', kind: 'tempHp' },
      heal: { formula: '70', kind: 'hp' },
      'healing-word': { formula: '2d4 + @mod', kind: 'hp' },
      'heroes-feast': { formula: '2d10', kind: 'maxHp' },
      'mass-cure-wounds': { formula: '5d8 + @mod', kind: 'hp' },
      'mass-heal': { formula: '700', kind: 'hp' },
      'mass-healing-word': { formula: '2d4 + @mod', kind: 'hp' },
      'prayer-of-healing': { formula: '2d8', kind: 'hp' },
      regenerate: { formula: '4d8 + 15', kind: 'hp' },
    });
  });

  it('keeps what heals each turn: Heroism’s temporary hit points and Regenerate’s 1', () => {
    for (const ruleset of RULESETS) {
      expect(idsOf(ruleset, (e) => e.healingEachTurn !== undefined)).toEqual([
        'heroism',
        'regenerate',
      ]);
      expect(spell(ruleset, 'heroism').healingEachTurn).toEqual({
        formula: '@mod',
        kind: 'tempHp',
      });
      expect(spell(ruleset, 'regenerate').healingEachTurn).toEqual({ formula: '1', kind: 'hp' });
    }
  });

  it('leaves a healing that is one choice of a list out: Conjure Celestial, Enhance Ability', () => {
    expect(spell('2024', 'conjure-celestial').healing).toBeUndefined();
    expect(spell('2014', 'enhance-ability').healing).toBeUndefined();
  });
});

describe('CONT-07 the hand-written packs', () => {
  it('SRD 5.1: Bless and Cure Wounds are imported with the fields the pack holds, equal', () => {
    const held = (srd2014.entities as { id: string; type: string }[]).filter(
      (e) => e.type === 'spell',
    );
    expect(held.map((e) => e.id)).toEqual(['srd-2014:spell/bless', 'srd-2014:spell/cure-wounds']);
    for (const e of held) {
      const imported = spell('2014', e.id.split('/')[1] ?? '') as unknown as Record<
        string,
        unknown
      >;
      for (const [field, value] of Object.entries(e)) {
        if (field === 'source') continue;
        expect(imported[field], `${e.id} ${field}`).toEqual(value);
      }
    }
  });

  it('SRD 5.2.1: the pack holds no spell', () => {
    expect(
      (srd2024.entities as { id: string; type: string }[]).filter((e) => e.type === 'spell'),
    ).toEqual([]);
  });
});
