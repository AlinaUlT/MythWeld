import {
  baseOf,
  type Importer,
  type ImportInput,
  type Ruleset,
  type SourceEntry,
  textOf,
} from './frame.ts';
import { keyOf } from './smallTypes.ts';

// CONT-07: the spells of both SRDs (319 and 339) as `spell` entities. What the source holds in
// fields is read from them: the level, school, casting time, range, components, duration, classes,
// attack, and in SRD 5.1 the save, the area, the damage by level and the healing by slot. SRD
// 5.2.1's entries have no save, area, healing or growth fields (the row's note), so a save, healing
// and growth are read from the text of the entry, and its area is left out (CONT-07 §8). Growth
// is read from the "higher level" text of both, the one place the two SRDs say it the same way,
// and kept only when the text names one die or number for each slot level; the other growths
// (more targets, a longer duration, a bigger area) are not dice and are not fields.

/** A link to another entry of the source. */
interface Ref {
  index: string;
  name?: string;
}

/** One damage of the source: its type and its roll by the slot level or the character level. */
interface SourceDamage {
  damage_type?: Ref;
  damage_at_slot_level?: Record<string, string>;
  damage_at_character_level?: Record<string, string>;
}

type Roll = { formula: string; kind: 'hp' | 'tempHp' | 'maxHp' };

// --- Rolls

/** A roll as the source writes it, as a formula: `MOD` is `@mod`, and "4d6 OR 5d6" is the first. */
function formulaOf(raw: string): string {
  return (raw.split(' OR ')[0] ?? raw).trim().replace(/\bMOD\b/g, '@mod');
}

/** The value of a table by level at its lowest level: what the spell does cast at its own level. */
function firstOf(table: Record<string, string>): string {
  const levels = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  return formulaOf(table[String(levels[0])] ?? '');
}

/** `NdM` as its parts, or `undefined` for any other roll. */
function diceOf(roll: string): { count: number; sides: number } | undefined {
  const match = /^(\d+)d(\d+)$/.exec(roll.trim());
  return match === null ? undefined : { count: Number(match[1]), sides: Number(match[2]) };
}

// --- Casting time, range, duration

const CASTING_UNITS: Readonly<Record<string, string>> = {
  action: 'action',
  'bonus action': 'bonus',
  reaction: 'reaction',
  minute: 'minute',
  minutes: 'minute',
  hour: 'hour',
  hours: 'hour',
};

/**
 * "1 action", "10 minutes" (SRD 5.1), "Action", "Bonus Action, which you take when …" (SRD 5.2.1).
 * What follows the unit is the note, as the source says it.
 */
function castingTimeOf(entry: SourceEntry) {
  const raw = String(entry.casting_time);
  const match = /^(?:(\d+)\s+)?(bonus action|action|reaction|minutes?|hours?)\b[,\s]*(.*)$/i.exec(
    raw,
  );
  if (match === null) throw new Error(`The casting time "${raw}" of "${entry.index}" is not read.`);
  const unit = CASTING_UNITS[(match[2] ?? '').toLowerCase()];
  const note = (match[3] ?? '').trim();
  return {
    value: Number(match[1] ?? 1),
    unit,
    ...(note !== '' && { note: { en: note } }),
  };
}

const FEET_IN_A_MILE = 5280;

/** The range with its tail of SRD 5.2.1's "Touch Component: V, S" taken off. */
function rangeWords(entry: SourceEntry): string {
  return String(entry.range)
    .replace(/\s+Component:.*$/i, '')
    .trim();
}

function rangeOf(entry: SourceEntry) {
  const raw = rangeWords(entry);
  const area = entry.area_of_effect as { type: string; size: number } | undefined;
  const shape = area === undefined ? {} : { area: { shape: keyOf(area.type), size: area.size } };
  const distance = /^(\d+)\s+(feet|miles?)$/i.exec(raw);
  if (distance !== null) {
    const amount = Number(distance[1]);
    const feet = /^mile/i.test(distance[2] ?? '') ? amount * FEET_IN_A_MILE : amount;
    return { kind: 'distance', distance: feet, ...shape };
  }
  const kind = (
    {
      touch: 'touch',
      self: 'self',
      sight: 'sight',
      unlimited: 'unlimited',
      special: 'special',
    } as const
  )[raw.toLowerCase() as 'touch'];
  if (kind === undefined) throw new Error(`The range "${raw}" of "${entry.index}" is not read.`);
  return { kind, ...shape };
}

const DURATION_UNITS: Readonly<Record<string, string>> = {
  round: 'round',
  minute: 'minute',
  hour: 'hour',
  day: 'day',
};

/** "Instantaneous", "Up to 1 minute", "8 hours", "Concentration up to 10 minutes", "Until dispelled". */
function durationOf(entry: SourceEntry) {
  const raw = String(entry.duration).trim();
  const lower = raw.toLowerCase();
  if (lower === 'instantaneous') return { kind: 'instant' };
  if (lower === 'special') return { kind: 'special' };
  if (lower === 'until dispelled') return { kind: 'untilDispelled' };
  if (lower === 'until dispelled or triggered') return { kind: 'untilDispelledOrTriggered' };
  const match = /(\d+)\s+(round|minute|hour|day)s?\b/i.exec(raw);
  if (match === null) throw new Error(`The duration "${raw}" of "${entry.index}" is not read.`);
  return {
    kind: 'timed',
    value: Number(match[1]),
    unit: DURATION_UNITS[(match[2] ?? '').toLowerCase()],
  };
}

// --- Components

/** The coins of a price: "25gp", "1,000+ GP" (SRD 5.2.1's "at least"), "2 Copper Pieces". */
const COINS_OF_WORDS: Readonly<Record<string, string>> = {
  cp: 'cp',
  sp: 'sp',
  ep: 'ep',
  gp: 'gp',
  pp: 'pp',
  copper: 'cp',
  silver: 'sp',
  electrum: 'ep',
  gold: 'gp',
  platinum: 'pp',
};
const PRICE = /(\d[\d,]*)\+?,?\s*(cp|sp|ep|gp|pp|copper|silver|electrum|gold|platinum)\b/gi;

/**
 * The price of a material component: the one amount of coins its words name. Words that name two
 * different amounts (a gem and strips, "250 gp" and "50 gp each") price the spell no one way, and
 * give none.
 */
function priceOf(material: string): { amount: number; unit: string } | undefined {
  const prices = new Set(
    [...material.matchAll(PRICE)].map(
      (m) => `${(m[1] ?? '').replace(/,/g, '')} ${COINS_OF_WORDS[(m[2] ?? '').toLowerCase()]}`,
    ),
  );
  if (prices.size !== 1) return undefined;
  const [amount, unit] = [...prices][0]?.split(' ') ?? [];
  return { amount: Number(amount), unit: unit as string };
}

/**
 * V, S and M. SRD 5.2.1 puts the components of 9 spells in the range's tail ("Touch Component: V,
 * S") and leaves its own list empty (CONT-07 §8); the tail is then the list.
 */
function componentsOf(entry: SourceEntry) {
  const listed = (entry.components as string[] | undefined) ?? [];
  const tail = /Component:\s*([VSM,\s]+)$/i.exec(String(entry.range));
  const letters = listed.length > 0 ? listed : (tail?.[1] ?? '').split(/[,\s]+/).filter(Boolean);
  if (letters.length === 0) throw new Error(`"${entry.index}" has no components.`);
  const material = typeof entry.material === 'string' ? entry.material : undefined;
  if (letters.includes('M') !== (material !== undefined)) {
    throw new Error(`"${entry.index}" has a material component that does not match its list.`);
  }
  const cost = material === undefined ? undefined : priceOf(material);
  return {
    v: letters.includes('V'),
    s: letters.includes('S'),
    ...(material !== undefined && { m: { en: material } }),
    ...(cost !== undefined && { mCost: cost }),
    ...(material !== undefined && /\bconsum/i.test(material) && { mConsumed: true }),
  };
}

// --- Damage and its growth

/** The damages of a spell: each one's roll at the spell's own level and its type's key. */
function damagesOf(entry: SourceEntry) {
  const raw = entry.damage as SourceDamage | SourceDamage[] | undefined;
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return list.flatMap((damage) => {
    const table = damage.damage_at_slot_level ?? damage.damage_at_character_level;
    if (damage.damage_type === undefined || table === undefined) return [];
    return [{ formula: firstOf(table), type: keyOf(damage.damage_type.index) }];
  });
}

/** A typo of the source: "1dl0" for "1d10" (SRD 5.1's Moonbeam, CONT-07 §8). */
const fixDie = (token: string): string => token.replace(/d[lI](\d)/, 'd1$1');

/** The one growth by slot level a "higher level" text names: the die or number and the step. */
const GROWTH =
  /(\d+d[\dlI]+|\d+)\s+(?:additional\s+temporary\s+hit\s+points\s+)?for\s+(?:each|every)\s+(?:(two|three)\s+)?(?:spell\s+)?(?:slot\s+)?level/gi;

/** SRD 5.2.1 puts a few spells' growth in the entry's words, after this label, not in a field. */
const HIGHER_LABEL = /Using a Higher-Level Spell Slot\.\s*/;

interface Growth {
  formula: string;
  every?: number;
  /** The words of the sentence before the die, where the damage it grows is named. */
  clause: string;
}

/** The words that say how a spell grows with a higher slot: the field, else the labelled tail. */
function higherWords(entry: SourceEntry): string {
  const higher = entry.higher_level;
  if (Array.isArray(higher)) return higher.join(' ');
  if (typeof higher === 'string') return higher;
  return (textOf(entry) ?? '').split(HIGHER_LABEL)[1] ?? '';
}

/**
 * The growth the words name, when they name exactly one die or number for each slot level and no
 * other die: "Clenched Fist 2d8 and Grasping Hand 2d6" is two growths, which one formula cannot
 * hold, so it is none.
 */
function growthOf(entry: SourceEntry): Growth | undefined {
  const text = higherWords(entry);
  const found = [...text.matchAll(GROWTH)];
  if (found.length !== 1) return undefined;
  const dice = new Set((text.match(/\d+d[\dlI]+/g) ?? []).map(fixDie));
  const [match] = found;
  const formula = fixDie(match?.[1] ?? '');
  if (dice.size > 1 || (dice.size === 1 && !dice.has(formula))) return undefined;
  const before = text.slice(0, match?.index ?? 0);
  const step = { two: 2, three: 3 }[(match?.[2] ?? '').toLowerCase() as 'two'];
  return {
    formula,
    ...(step !== undefined && { every: step }),
    clause: before.slice(before.lastIndexOf('. ') + 1),
  };
}

/** What the damage type names of a text are: key by lowercase name, read from `Damage-Types`. */
function damageTypeNames(input: ImportInput): Map<string, string> {
  return new Map(
    (input.files['Damage-Types'] ?? []).map((type) => [
      String(type.name).toLowerCase(),
      keyOf(type.index),
    ]),
  );
}

/**
 * The slot scaling of a spell that has damage or healing to grow. The damage types the sentence
 * names are the ones that grow: when none of them is a damage of the spell the growth is another
 * damage's and the spell has none (SRD 5.2.1's Ice Knife grows its cold damage, which the source
 * does not list). With two or more types in the spell and some named, those are `damageTypes`,
 * and `pickOne` is on where the text says "your choice" (SRD 5.1's Flame Strike).
 */
function slotScaling(
  growth: Growth,
  damages: readonly { type: string }[],
  names: Map<string, string>,
) {
  const types = [...new Set(damages.map((damage) => damage.type))];
  const mentioned = [...names]
    .filter(([name]) => new RegExp(`\\b${name}\\b`, 'i').test(growth.clause))
    .map(([, key]) => key);
  if (types.length > 0 && mentioned.length > 0 && !mentioned.some((key) => types.includes(key))) {
    return undefined;
  }
  const named = types.filter((type) => mentioned.includes(type));
  const choice = named.length > 1 && /your choice/i.test(growth.clause);
  const some = types.length > 1 && named.length > 0 && (named.length < types.length || choice);
  return {
    kind: 'slot',
    formula: growth.formula,
    ...(growth.every !== undefined && { every: growth.every }),
    ...(some && { damageTypes: named }),
    ...(some && choice && { pickOne: true }),
  };
}

/**
 * A cantrip's growth by character level: SRD 5.1 gives the damage at levels 1, 5, 11 and 17; SRD
 * 5.2.1 says "The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8)".
 * Both are the die that joins the damage at each step; none when the damage does not grow so.
 */
function cantripScaling(entry: SourceEntry) {
  const raw = entry.damage as SourceDamage | SourceDamage[] | undefined;
  const first = Array.isArray(raw) ? raw[0] : raw;
  const table = first?.damage_at_character_level;
  if (table !== undefined) {
    const steps = ['1', '5', '11', '17'].map((level) => diceOf(table[level] ?? ''));
    const [base, ...rest] = steps;
    if (base === undefined || rest.some((step) => step === undefined)) return undefined;
    const each = (rest[0]?.count ?? 0) - base.count;
    const even = steps.every(
      (step, i) => step?.sides === base.sides && step.count === base.count + each * i,
    );
    return even && each > 0 ? { kind: 'cantrip', formula: `${each}d${base.sides}` } : undefined;
  }
  const match = /damage increases by (\d+d\d+) when you reach levels? 5\b/i.exec(
    textOf(entry) ?? '',
  );
  return match === null ? undefined : { kind: 'cantrip', formula: match[1] };
}

// --- Cantrip upgrades that scaling cannot hold (CONT-05 §3 item 5, §8)

interface Upgrade {
  atLevel: number;
  beams?: number;
  die?: string;
  range?: number;
  extraDamage?: { formula: string; type: string };
}

const steps = (levels: readonly number[], make: (i: number) => Omit<Upgrade, 'atLevel'>) =>
  levels.map((atLevel, i) => ({ atLevel, ...make(i) }));
const AT = [5, 11, 17] as const;
const BEAMS: Upgrade[] = steps(AT, (i) => ({ beams: i + 2 }));

/** By ruleset and the spell's index; each is checked against the spell's words by a test. */
const UPGRADES: Readonly<Record<Ruleset, Readonly<Record<string, readonly Upgrade[]>>>> = {
  '2014': { 'eldritch-blast': BEAMS },
  '2024': {
    'eldritch-blast': BEAMS,
    shillelagh: steps(AT, (i) => ({ die: ['1d10', '1d12', '2d6'][i] as string })),
    'spare-the-dying': steps(AT, (i) => ({ range: [30, 60, 120][i] as number })),
    'true-strike': steps(AT, (i) => ({
      extraDamage: { formula: `${i + 1}d6`, type: 'radiant' },
    })),
  },
};

// --- Healing

/** SRD 5.1's `heal_at_slot_level`: the healing at the spell's own level, and what it gives. */
function healingTable(entry: SourceEntry): Roll | undefined {
  const table = entry.heal_at_slot_level as Record<string, string> | undefined;
  if (table === undefined) return undefined;
  const words = textOf(entry) ?? '';
  const kind = /hit point maximum[^.]*increase/i.test(words)
    ? 'maxHp'
    : /temporary hit points/i.test(words)
      ? 'tempHp'
      : 'hp';
  return { formula: firstOf(table), kind };
}

/**
 * Healing read from a spell's words, in the shapes the SRDs use (CONT-07 §8): "regains Hit Points
 * equal to 2d8 plus your spellcasting ability modifier", "regains 4d8 + 15 Hit Points", "restoring
 * 70 Hit Points", "gain 2d4 + 4 Temporary Hit Points", "Hit Point maximum … increase by 5".
 */
const HEALING_WORDS: readonly { pattern: RegExp; read: (m: RegExpExecArray) => Roll }[] = [
  {
    pattern:
      /regains? (?:a number of )?Hit Points equal to (\d+d\d+) plus your spellcasting ability modifier/i,
    read: (m) => ({ formula: `${m[1]} + @mod`, kind: 'hp' }),
  },
  {
    pattern: /regains? (\d+d\d+(?: \+ \d+)?) Hit Points/i,
    read: (m) => ({ formula: m[1] as string, kind: 'hp' }),
  },
  {
    pattern: /(?:restoring|restore up to) (\d+) Hit Points/i,
    read: (m) => ({ formula: m[1] as string, kind: 'hp' }),
  },
  {
    pattern: /gains? (\d+d\d+(?: \+ \d+)?) Temporary Hit Points/i,
    read: (m) => ({ formula: m[1] as string, kind: 'tempHp' }),
  },
  {
    pattern: /Hit Point maximum and current Hit Points increase by (\d+)/i,
    read: (m) => ({ formula: m[1] as string, kind: 'maxHp' }),
  },
];

/** What heals at the start of each of the target's turns (Heroism, Regenerate; CONT-05 §3 item 6). */
const EACH_TURN: readonly { pattern: RegExp; read: (m: RegExpExecArray) => Roll }[] = [
  {
    pattern:
      /gains? Temporary Hit Points equal to your spellcasting ability modifier at the start of each of its turns/i,
    read: () => ({ formula: '@mod', kind: 'tempHp' }),
  },
  {
    pattern: /regains? (\d+) Hit Points? at the start of each of its turns/i,
    read: (m) => ({ formula: m[1] as string, kind: 'hp' }),
  },
];

/** A maximum raised by a roll: Heroes' Feast's "Hit Point maximum also increases by 2d10". */
const MAXIMUM_WORDS = /Hit Point maximum also increases by (\d+d\d+)/i;

/**
 * The spells whose words are read for healing: SRD 5.1's eleven with a healing roll (its
 * `heal_at_slot_level`, ten, and Heroes' Feast), by index. Another spell's healing is one option
 * of a list (Conjure Celestial's Healing Light, Enhance Ability's Bear's Endurance) or a side
 * effect, and is not the spell's healing (CONT-07 §8).
 */
const HEALING_SPELLS: ReadonlySet<string> = new Set([
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
]);

function healingOf(entry: SourceEntry): Roll | undefined {
  const table = healingTable(entry);
  if (table !== undefined) return table;
  if (!HEALING_SPELLS.has(entry.index)) return undefined;
  const words = textOf(entry) ?? '';
  const maximum = MAXIMUM_WORDS.exec(words);
  if (maximum !== null) return { formula: maximum[1] as string, kind: 'maxHp' };
  for (const { pattern, read } of HEALING_WORDS) {
    const match = pattern.exec(words);
    if (match !== null) return read(match);
  }
  return undefined;
}

function healingEachTurnOf(entry: SourceEntry): Roll | undefined {
  const words = textOf(entry) ?? '';
  for (const { pattern, read } of EACH_TURN) {
    const match = pattern.exec(words);
    if (match !== null) return read(match);
  }
  return undefined;
}

// --- The save

/** The stat a spell's save is of: SRD 5.1's `dc`, else the first "<Stat> saving throw" of its words. */
function saveOf(entry: SourceEntry, stats: Map<string, string>): string | undefined {
  const dc = entry.dc as { dc_type: Ref } | undefined;
  if (dc !== undefined) return keyOf(dc.dc_type.index);
  const names = [...stats.keys()].join('|');
  const match = new RegExp(`\\b(${names})\\s+saving\\s+throw`, 'i').exec(textOf(entry) ?? '');
  const stat = stats.get((match?.[1] ?? '').toLowerCase());
  return stat === undefined ? undefined : keyOf(stat);
}

// --- The spell

/** The words of a spell: its text, then the growth the source keeps in a field of its own. */
function wordsOf(entry: SourceEntry, ruleset: Ruleset) {
  const text = textOf(entry);
  const higher = entry.higher_level;
  const extra = Array.isArray(higher)
    ? higher.join('\n\n')
    : typeof higher === 'string'
      ? higher
      : '';
  if (text === undefined) throw new Error(`"${entry.index}" has no words.`);
  if (extra === '' || text.includes(extra)) return { text: { en: text } };
  const label = ruleset === '2014' ? 'At Higher Levels.' : 'Using a Higher-Level Spell Slot.';
  return { text: { en: `${text}\n\n**${label}** ${extra}` } };
}

function spellOf(
  input: ImportInput,
  entry: SourceEntry,
  names: Map<string, string>,
  stats: Map<string, string>,
) {
  const level = Number(entry.level);
  const damages = damagesOf(entry);
  const healing = healingOf(entry);
  const eachTurn = healingEachTurnOf(entry);
  const growth = level > 0 ? growthOf(entry) : undefined;
  const scaling =
    level === 0
      ? cantripScaling(entry)
      : growth !== undefined && (damages.length > 0 || healing !== undefined)
        ? slotScaling(growth, damages, names)
        : undefined;
  const save = saveOf(entry, stats);
  const attack = entry.attack_type;
  const upgrades = UPGRADES[input.ruleset][entry.index];
  return {
    ...baseOf(input, 'spell', entry),
    ...wordsOf(entry, input.ruleset),
    level,
    school: keyOf((entry.school as Ref).index),
    castingTime: castingTimeOf(entry),
    range: rangeOf(entry),
    components: componentsOf(entry),
    duration: durationOf(entry),
    concentration: entry.concentration === true,
    ritual: entry.ritual === true,
    classes: ((entry.classes as Ref[]) ?? []).map((ref) => keyOf(ref.index)),
    ...(typeof attack === 'string' && { attack }),
    ...(save !== undefined && { save }),
    ...(damages.length > 0 && { damage: damages }),
    ...(healing !== undefined && { healing }),
    ...(eachTurn !== undefined && { healingEachTurn: eachTurn }),
    ...(scaling !== undefined && { scaling }),
    ...(upgrades !== undefined && { upgrades }),
  };
}

export const spells: Importer = {
  types: ['spell'],
  files: {
    '2014': ['Spells', 'Ability-Scores', 'Damage-Types'],
    '2024': ['Spells', 'Ability-Scores', 'Damage-Types'],
  },
  run: (input) => {
    const names = damageTypeNames(input);
    const stats = new Map(
      (input.files['Ability-Scores'] ?? []).map((stat) => [
        String(stat.full_name).toLowerCase(),
        stat.index,
      ]),
    );
    return (input.files.Spells ?? []).map((entry) => spellOf(input, entry, names, stats));
  },
};
