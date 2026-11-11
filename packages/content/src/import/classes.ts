import { baseOf, entityIdOf, type Importer, type ImportInput, type SourceEntry } from './frame.ts';
import { keyOf } from './smallTypes.ts';

// CONT-08: the 12 classes and 12 subclasses of each SRD, and their features as `feature` entities.
// A class's features are `entity` grants, one for each level that gives some (`features-<level>`,
// each at its `atLevel`), the conventions of ENG-09 §4 and ENG-33 §4: a level's table columns are
// the class's `levels` (the camelCase of the source's `class_specific` names), an Ability Score
// Improvement is the grant `ability-scores-<level>`, its saves are `saves` and no grant. What a
// feature does is the mechanics rows' (SPEC §6.8); here it is a name, its words, and what the
// source's structure gives: a choice among its sub-features.

/** A link to another entry of the source. */
interface Ref {
  index: string;
  name?: string;
}

/** A choice in the source's shape: `choose` of what `from` holds. */
interface Options<T> {
  choose: number;
  desc?: string;
  from: { option_set_type?: string; options: T[] };
}

type Grant = Record<string, unknown>;

/** The levels of a class: 1 to 20, in both SRDs. */
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

/** The name a feature of the source has, by which the importer knows two features of every class. */
const IMPROVEMENT = 'Ability Score Improvement';
const EPIC_BOON = 'Epic Boon';

// --- Names

/** The camelCase of a source key written with underscores: `rage_count` is `rageCount`. */
const camel = (key: string): string =>
  key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

/** The number a level's index ends with: `cleric-3` is 3. */
const levelOf = (index: string): number => Number(/(\d+)$/.exec(index)?.[1]);

// --- Proficiencies

interface Proficiency {
  category: string;
  keys: string[];
  name: string;
}

/** The kinds of `Proficiencies` that are tools, as CONT-14 reads them. */
const TOOL_TYPES: ReadonlySet<string> = new Set([
  "Artisan's Tools",
  'Gaming Sets',
  'Musical Instruments',
  'Other',
  'Tools',
  'Vehicles',
]);

const ARMOR_GROUP_OF: Readonly<Record<string, string>> = {
  'light-armor': 'light',
  'medium-armor': 'medium',
  'heavy-armor': 'heavy',
};

const WEAPON_GROUP_OF: Readonly<Record<string, string>> = {
  'simple-weapons': 'simple',
  'martial-weapons': 'martial',
};

/**
 * Every entry of `Proficiencies`, by its index: the category and keys a `proficiency` grant names
 * it by (the same map as CONT-10's, whole: CONT-68 moves it into the frame). A skill and a stat
 * are named by their key; an armor by its group (`all-armor` by the three), a shield by `shield`,
 * another armor by its item's key; a weapon by its group or its item's key; a tool, a game set,
 * an instrument and a vehicle by the tool kind's key. A kind it does not name fails the import.
 */
function proficienciesOf(input: ImportInput): Map<string, Proficiency> {
  const found = new Map<string, Proficiency>();
  for (const entry of input.files.Proficiencies ?? []) {
    const reference = (entry.reference as Ref | undefined)?.index;
    if (reference === undefined) throw new Error(`The proficiency "${entry.index}" has no link.`);
    const type = String(entry.type);
    let category: string;
    let keys: string[];
    if (type === 'Skills') [category, keys] = ['skill', [keyOf(reference)]];
    else if (type === 'Saving Throws') [category, keys] = ['save', [keyOf(reference)]];
    else if (type === 'Armor') {
      category = 'armor';
      keys =
        reference === 'armor'
          ? Object.values(ARMOR_GROUP_OF)
          : [ARMOR_GROUP_OF[reference] ?? keyOf(reference)];
    } else if (type === 'Weapons') {
      [category, keys] = ['weapon', [WEAPON_GROUP_OF[reference] ?? keyOf(reference)]];
    } else if (TOOL_TYPES.has(type)) [category, keys] = ['tool', [keyOf(reference)]];
    else throw new Error(`The proficiency kind "${type}" has no category.`);
    found.set(entry.index, { category, keys, name: String(entry.name).replace(/^[^:]+: /, '') });
  }
  return found;
}

const GRANT_ID_OF: Readonly<Record<string, string>> = {
  skill: 'skills',
  save: 'saves',
  armor: 'armor',
  weapon: 'weapons',
  tool: 'tools',
  language: 'languages',
};

/** One option of a proficiency choice: a proficiency, or a nested choice of them (the Monk's). */
interface ProficiencyOption {
  option_type: string;
  item?: Ref;
  choice?: { from: { options: ProficiencyOption[] } };
}

/**
 * The proficiency grants of a list of fixed proficiencies and of choices among proficiencies, one
 * grant for each category. A choice of every skill the source has is the filter `{ type: 'skill' }`
 * ("any skill", ENG-09 §4); another is the list of its keys. Saving throws are not grants: they
 * are the class's `saves`.
 */
function proficiencyGrants(
  known: Map<string, Proficiency>,
  fixed: readonly Ref[],
  choices: readonly Options<ProficiencyOption>[],
  prefix = '',
): Grant[] {
  const grants = new Map<string, Grant>();
  const grantOf = (category: string): Grant => {
    let grant = grants.get(category);
    if (grant === undefined) {
      grant = { id: `${prefix}${GRANT_ID_OF[category]}`, kind: 'proficiency', category };
      grants.set(category, grant);
    }
    return grant;
  };
  const named = (ref: Ref): Proficiency => {
    const proficiency = known.get(ref.index);
    if (proficiency === undefined) throw new Error(`The proficiency "${ref.index}" has no key.`);
    return proficiency;
  };
  for (const ref of fixed) {
    const { category, keys } = named(ref);
    if (category === 'save') continue;
    const grant = grantOf(category);
    grant.fixed = [...((grant.fixed as string[] | undefined) ?? []), ...keys];
  }
  const skills = [...known.values()].filter((p) => p.category === 'skill').flatMap((p) => p.keys);
  for (const choice of choices) {
    const refs = (options: readonly ProficiencyOption[]): Ref[] =>
      options.flatMap((option) => {
        if (option.item !== undefined) return [option.item];
        if (option.choice !== undefined) return refs(option.choice.from.options);
        throw new Error('A proficiency option is not a link or a choice.');
      });
    const picks = refs(choice.from.options).map(named);
    const category = picks[0]?.category ?? 'skill';
    if (picks.some((pick) => pick.category !== category)) {
      throw new Error('A proficiency choice mixes categories.');
    }
    const keys = picks.flatMap((pick) => pick.keys);
    const every = category === 'skill' && keys.length === skills.length;
    grantOf(category).choose = { count: choice.choose, from: every ? { type: 'skill' } : keys };
  }
  return [...grants.values()];
}

// --- Stats

/** The stats, in the order of `Ability-Scores`: by index, and by full name. */
function statsOf(input: ImportInput) {
  const entries = input.files['Ability-Scores'] ?? [];
  return {
    keys: entries.map((entry) => keyOf(entry.index)),
    names: new Map(entries.map((entry) => [entry.index, String(entry.full_name)])),
  };
}

interface Prerequisite {
  ability_score: Ref;
  minimum_score: number;
}

/** A class's multiclass prerequisites: each minimum, and a choice of stats as one formula. */
function multiclassPrerequisites(
  multi: SourceEntry,
  names: Map<string, string>,
): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = (
    (multi.prerequisites as Prerequisite[] | undefined) ?? []
  ).map((need) => ({
    kind: 'ability',
    key: keyOf(need.ability_score.index),
    min: need.minimum_score,
  }));
  const options = multi.prerequisite_options as
    | {
        choose: number;
        type: string;
        from: { options: Prerequisite[] };
      }
    | undefined;
  if (options !== undefined) {
    if (options.choose !== 1 || options.type !== 'ability-scores') {
      throw new Error('The multiclass prerequisite options are not one of several stats.');
    }
    found.push({
      kind: 'formula',
      formula: options.from.options
        .map((o) => `@abilities.${keyOf(o.ability_score.index)}.score >= ${o.minimum_score}`)
        .join(' || '),
      label: {
        en: options.from.options
          .map(
            (o) =>
              `${names.get(o.ability_score.index) ?? o.ability_score.index} ${o.minimum_score}`,
          )
          .join(' or '),
      },
    });
  }
  return found;
}

// --- The level table

/** One class-level entry of the source, by class and level; the subclass entries are apart. */
function classLevels(input: ImportInput, cls: string): Map<number, SourceEntry> {
  return new Map(
    (input.files.Levels ?? [])
      .filter((entry) => (entry.class as Ref).index === cls && entry.subclass === undefined)
      .map((entry) => [Number(entry.level), entry]),
  );
}

/**
 * The columns of one row of a class's table, as numbers: a count by its name, a pair of numbers
 * (`martial_arts`: `dice_count`, `dice_value`) as two columns, a flag as 1 or 0. A list (SRD 5.1's
 * Sorcerer's `creating_spell_slots`) has no column (CONT-08 §11).
 */
function columnsOf(row: SourceEntry): Record<string, number> {
  const columns: Record<string, number> = {};
  for (const [name, value] of Object.entries(
    (row.class_specific as Record<string, unknown>) ?? {},
  )) {
    if (typeof value === 'number') columns[camel(name)] = value;
    else if (typeof value === 'boolean') columns[camel(name)] = value ? 1 : 0;
    else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [part, number] of Object.entries(value)) {
        if (typeof number === 'number') columns[camel(`${name}_${part}`)] = number;
      }
    }
  }
  return columns;
}

function levelTable(rows: Map<number, SourceEntry>) {
  const table = LEVELS.map((level) => {
    const columns = columnsOf(rows.get(level) ?? ({ index: '' } as SourceEntry));
    return { level, ...(Object.keys(columns).length > 0 && { table: columns }) };
  });
  return table.some((row) => 'table' in row) ? table : undefined;
}

// --- Spellcasting

/** The column of one spellcasting value, one number for each level; none when it is 0 throughout. */
function column(rows: Map<number, SourceEntry>, name: string): number[] | undefined {
  const values = LEVELS.map((level) =>
    Number((rows.get(level)?.spellcasting as Record<string, number> | undefined)?.[name] ?? 0),
  );
  return values.some((value) => value > 0) ? values : undefined;
}

/** The slots of each class level, spell levels 1 to 9, with the trailing 0s dropped. */
function slotRows(rows: Map<number, SourceEntry>): number[][] {
  return LEVELS.map((level) => {
    const slots = Array.from({ length: 9 }, (_, i) =>
      Number(
        (rows.get(level)?.spellcasting as Record<string, number> | undefined)?.[
          `spell_slots_level_${i + 1}`
        ] ?? 0,
      ),
    );
    while (slots.length > 0 && slots[slots.length - 1] === 0) slots.pop();
    return slots;
  });
}

/**
 * How many spells a class prepares, from its words: "Wisdom modifier + your cleric level (minimum
 * of one spell)", "Charisma modifier + half your paladin level, rounded down (minimum of one
 * spell)" (SRD 5.1). SRD 5.2.1 gives a column instead.
 */
function preparedFormula(
  words: string,
  cls: string,
  stats: Map<string, string>,
): string | undefined {
  const match = /equal to your (\w+) modifier \+ (half )?your \w+ level/i.exec(words);
  if (match === null) return undefined;
  const stat = [...stats].find(([, name]) => name.toLowerCase() === (match[1] ?? '').toLowerCase());
  if (stat === undefined) throw new Error(`The stat "${match[1]}" of "${cls}" is not read.`);
  const level = `@classes.${keyOf(cls)}.level`;
  return `max(1, @abilities.${keyOf(stat[0])}.mod + ${match[2] === undefined ? level : `floor(${level} / 2)`})`;
}

function spellcastingOf(
  input: ImportInput,
  entry: SourceEntry,
  rows: Map<number, SourceEntry>,
  stats: Map<string, string>,
) {
  const spellcasting = entry.spellcasting as
    | { spellcasting_ability: Ref; info: { name: string; desc: string[] }[] }
    | undefined;
  if (spellcasting === undefined) return undefined;
  const slots = slotRows(rows);
  const words = spellcasting.info.map((part) => part.desc.join(' ')).join(' ');
  const parts = spellcasting.info.map((part) => part.name.toLowerCase());
  const highest = Math.max(...slots.map((row) => row.length));
  // Pact magic: no row has slots of two spell levels, only the one level that grows.
  const pact = slots.every((row) => row.filter((n) => n > 0).length <= 1);
  const progression = pact ? 'pact' : highest === 9 ? 'full' : highest === 5 ? 'half' : undefined;
  if (progression === undefined)
    throw new Error(`The slots of "${entry.index}" are no progression.`);
  const known = column(rows, 'spells_known');
  const preparation = /spellbook/i.test(words)
    ? 'spellbook'
    : known !== undefined
      ? 'known'
      : 'prepared';
  const prepared = column(rows, 'prepared_spells') ?? preparedFormula(words, entry.index, stats);
  if (preparation !== 'known' && prepared === undefined) {
    throw new Error(`The spells "${entry.index}" prepares are not read.`);
  }
  const cantrips = column(rows, 'cantrips_known');
  // SRD 5.1: the "Ritual Casting" section of the class. SRD 5.2.1: "To cast a spell as a Ritual, a
  // spellcaster must have it prepared" (Rituals, CONT-08 §8), so every class that prepares spells.
  const ritual = input.ruleset === '2014' ? parts.includes('ritual casting') : true;
  return {
    ability: keyOf(spellcasting.spellcasting_ability.index),
    progression,
    preparation,
    ...(prepared !== undefined && { preparedCount: prepared }),
    ...(cantrips !== undefined && { cantripsKnown: cantrips }),
    ...(known !== undefined && { spellsKnown: known }),
    slotsTable: slots,
    spellList: { classKey: keyOf(entry.index) },
    ritual,
  };
}

// --- Equipment, words

interface StartingItem {
  equipment: Ref;
  quantity: number;
}

/** SRD 5.1's fixed starting items. The choices and SRD 5.2.1's packages are CONT-71's. */
function equipmentGrants(input: ImportInput, entry: SourceEntry): Grant[] {
  const fixed = (entry.starting_equipment as StartingItem[] | undefined) ?? [];
  if (fixed.length === 0) return [];
  return [
    {
      id: 'equipment',
      kind: 'item',
      fixed: fixed.map((part) => ({
        id: entityIdOf(input.packId, 'item', part.equipment.index),
        qty: part.quantity,
      })),
    },
  ];
}

/**
 * A text with the one fault the source has: SRD 5.2.1's Monk "artisan’s tools" reads as the three
 * characters a wrong decoding makes of the apostrophe (CONT-08 §8). Only that is put right.
 */
const repaired = (text: string): string => text.replace(/\u00e2\u20ac\u2122/g, '\u2019');

/** A line of a class's words: the label in bold, then what it says. */
const line = (label: string, words: string): string => `**${label}:** ${words}`;

function wordsOf(entry: SourceEntry, known: Map<string, Proficiency>, stats: Map<string, string>) {
  const primary = (entry.primary_ability as { desc: string } | undefined)?.desc;
  const saves = ((entry.saving_throws as Ref[] | undefined) ?? []).map(
    (ref) => stats.get(ref.index) ?? ref.index,
  );
  const proficiencies = ((entry.proficiencies as Ref[] | undefined) ?? [])
    .map((ref) => known.get(ref.index))
    .filter((p): p is Proficiency => p !== undefined && p.category !== 'save')
    .map((p) => p.name);
  const choices = ((entry.proficiency_choices as { desc?: string }[] | undefined) ?? []).flatMap(
    (choice) => (choice.desc === undefined ? [] : [repaired(choice.desc)]),
  );
  const items = ((entry.starting_equipment as StartingItem[] | undefined) ?? []).map(
    (part) => `${part.equipment.name}${part.quantity > 1 ? ` (${part.quantity})` : ''}`,
  );
  const options = (
    (entry.starting_equipment_options as { desc?: string }[] | undefined) ?? []
  ).flatMap((option) => (option.desc === undefined ? [] : [option.desc]));
  const parts = [
    line('Hit Die', `d${entry.hit_die}`),
    primary !== undefined && line('Primary Ability', primary),
    saves.length > 0 && line('Saving Throws', saves.join(' and ')),
    proficiencies.length > 0 && line('Proficiencies', proficiencies.join(', ')),
    choices.length > 0 && line('Proficiency Choices', choices.join('; ')),
    items.length + options.length > 0 && line('Equipment', [...items, ...options].join('; ')),
  ];
  return {
    text: { en: parts.filter((part): part is string => typeof part === 'string').join('\n\n') },
  };
}

// --- Features

/** The features of each level of one class, or one subclass, in the source's order. */
function featuresByLevel(entries: readonly SourceEntry[]): Map<number, Ref[]> {
  const by = new Map<number, Ref[]>();
  for (const entry of entries) by.set(Number(entry.level), (entry.features as Ref[]) ?? []);
  return by;
}

/** The `features-<level>` grants of a class or subclass: each level's features, at that level. */
function featureGrants(input: ImportInput, by: Map<number, Ref[]>): Grant[] {
  return [...by]
    .filter(([, refs]) => refs.length > 0)
    .sort(([a], [b]) => a - b)
    .map(([level, refs]) => ({
      id: `features-${level}`,
      kind: 'entity',
      atLevel: level,
      fixed: refs.map((ref) => entityIdOf(input.packId, 'feature', ref.index)),
    }));
}

// --- The classes

/** The spellcasting of each class that casts, by the class's index. */
function spellcastingDefs(input: ImportInput) {
  const stats = statsOf(input);
  return new Map(
    (input.files.Classes ?? []).flatMap((entry) => {
      const def = spellcastingOf(input, entry, classLevels(input, entry.index), stats.names);
      return def === undefined ? [] : [[entry.index, def] as const];
    }),
  );
}

/**
 * SRD 5.2.1's primary ability: the stats it lists ("Strength and Charisma"), or, where the words say
 * "or", the stats to choose one from (the Fighter's "Strength or Dexterity"). SRD 5.1 has none.
 */
function primaryAbilitiesOf(entry: SourceEntry): string[] | undefined {
  const primary = entry.primary_ability as
    | {
        ability_scores?: Ref[];
        ability_score_options?: { from: { options: { item: Ref }[] } };
      }
    | undefined;
  const refs =
    primary?.ability_scores ?? primary?.ability_score_options?.from.options.map((o) => o.item);
  return refs === undefined ? undefined : refs.map((ref) => keyOf(ref.index));
}

function classesOf(input: ImportInput, casting: ReturnType<typeof spellcastingDefs>) {
  const known = proficienciesOf(input);
  const stats = statsOf(input);
  const features = new Map((input.files.Features ?? []).map((f) => [f.index, f]));
  const subclassLevels = new Map<string, number>();
  for (const entry of input.files.Levels ?? []) {
    if (entry.subclass === undefined) continue;
    const cls = (entry.class as Ref).index;
    subclassLevels.set(cls, Math.min(subclassLevels.get(cls) ?? 20, Number(entry.level)));
  }
  return (input.files.Classes ?? []).map((entry) => {
    const rows = classLevels(input, entry.index);
    const by = featuresByLevel([...rows.values()]);
    const multi = entry.multi_classing as SourceEntry;
    const choices = (entry.proficiency_choices as Options<ProficiencyOption>[]) ?? [];
    const multiGrants = proficiencyGrants(
      known,
      (multi.proficiencies as Ref[] | undefined) ?? [],
      (multi.proficiency_choices as Options<ProficiencyOption>[] | undefined) ?? [],
      'multiclass-',
    );
    const prerequisites = multiclassPrerequisites(multi, stats.names);
    const primary = primaryAbilitiesOf(entry);
    const spellcasting = casting.get(entry.index);
    const levels = levelTable(rows);
    const subclassLevel = subclassLevels.get(entry.index);
    if (subclassLevel === undefined) throw new Error(`"${entry.index}" has no subclass level.`);
    const grants: Grant[] = [
      ...featureGrants(input, by),
      ...[...by]
        .sort(([a], [b]) => a - b)
        .flatMap(([level, refs]) =>
          refs.flatMap((ref): Grant[] => {
            const name = features.get(ref.index)?.name;
            if (name === IMPROVEMENT) {
              return [
                {
                  id: `ability-scores-${level}`,
                  kind: 'abilityScore',
                  atLevel: level,
                  mode: 'distribute',
                  from: stats.keys,
                  patterns: [[2], [1, 1]],
                },
              ];
            }
            if (name === EPIC_BOON) {
              return [
                {
                  id: 'epic-boon',
                  kind: 'entity',
                  atLevel: level,
                  choose: { count: 1, from: { type: 'feat', category: 'epicBoon' } },
                },
              ];
            }
            return [];
          }),
        ),
      ...proficiencyGrants(known, (entry.proficiencies as Ref[]) ?? [], choices),
      ...equipmentGrants(input, entry),
    ];
    return {
      ...baseOf(input, 'class', entry),
      ...wordsOf(entry, known, stats.names),
      key: keyOf(entry.index),
      hitDie: Number(entry.hit_die),
      ...(primary !== undefined && { primaryAbilities: primary }),
      saves: ((entry.saving_throws as Ref[]) ?? []).map((ref) => keyOf(ref.index)),
      subclassLevel,
      ...(levels !== undefined && { levels }),
      ...(spellcasting !== undefined && { spellcasting }),
      ...(prerequisites.length > 0 || multiGrants.length > 0
        ? {
            multiclass: {
              ...(prerequisites.length > 0 && { prerequisites }),
              ...(multiGrants.length > 0 && { grants: multiGrants }),
            },
          }
        : {}),
      grants,
    };
  });
}

// --- The subclasses

interface SourceSubclassSpell {
  prerequisites: { index?: string; type: string }[];
  spell: Ref;
}

/**
 * SRD 5.1's subclass spells (a domain's, an oath's) as `spell` grants, by the class level that
 * gives them. A spell that also needs a feature (the Land druid's circle spells, each needs the
 * terrain chosen) is the grant of that feature, not of the subclass: `own` has the subclass's,
 * `byFeature` the features'. They are always prepared, for a class that prepares its spells.
 */
function subclassSpells(input: ImportInput, casting: ReturnType<typeof spellcastingDefs>) {
  const own = new Map<string, Grant[]>();
  const byFeature = new Map<string, Grant[]>();
  for (const entry of input.files.Subclasses ?? []) {
    // Where a class does not prepare its spells (the Warlock knows them), a subclass's list is an
    // expanded list to choose from, not spells it always has prepared: no grant holds that
    // (CONT-08 §11).
    if (casting.get((entry.class as Ref).index)?.preparation !== 'prepared') continue;
    const groups = new Map<string, { feature?: string; level: number; spells: string[] }>();
    for (const given of (entry.spells as SourceSubclassSpell[] | undefined) ?? []) {
      const level = levelOf(given.prerequisites.find((p) => p.type === 'level')?.index ?? '');
      const feature = given.prerequisites.find((p) => p.type === 'feature')?.index;
      const key = `${feature ?? ''}#${level}`;
      const group = groups.get(key) ?? {
        ...(feature !== undefined && { feature }),
        level,
        spells: [],
      };
      const id = entityIdOf(input.packId, 'spell', given.spell.index);
      if (!group.spells.includes(id)) group.spells.push(id);
      groups.set(key, group);
    }
    for (const { feature, level, spells } of [...groups.values()].sort(
      (a, b) => a.level - b.level,
    )) {
      const grant = {
        id: `domain-spells-${level}`,
        kind: 'spell',
        atLevel: level,
        fixed: spells,
        alwaysPrepared: true,
      };
      const target = feature === undefined ? own : byFeature;
      const owner = feature ?? entry.index;
      target.set(owner, [...(target.get(owner) ?? []), grant]);
    }
  }
  return { own, byFeature };
}

function subclassesOf(input: ImportInput, spells: Map<string, Grant[]>) {
  const levels = (input.files.Levels ?? []).filter((entry) => entry.subclass !== undefined);
  return (input.files.Subclasses ?? []).map((entry) => {
    const own = levels.filter((level) => (level.subclass as Ref).index === entry.index);
    const grants = [
      ...featureGrants(input, featuresByLevel(own)),
      ...(spells.get(entry.index) ?? []),
    ];
    return {
      ...baseOf(input, 'subclass', entry),
      key: keyOf(entry.index),
      classKey: keyOf((entry.class as Ref).index),
      ...(grants.length > 0 && { grants }),
    };
  });
}

// --- The features

/** A feature: its words, and the choice among its sub-features that the source names. */
function featuresOf(input: ImportInput, spells: Map<string, Grant[]>) {
  return (input.files.Features ?? []).map((entry) => {
    const options = (
      entry.feature_specific as { subfeature_options?: Options<{ item: Ref }> } | undefined
    )?.subfeature_options;
    const grants: Grant[] = [
      ...(options === undefined
        ? []
        : [
            {
              id: 'subfeatures',
              kind: 'entity',
              choose: {
                count: options.choose,
                from: options.from.options.map((option) =>
                  entityIdOf(input.packId, 'feature', option.item.index),
                ),
              },
            },
          ]),
      ...(spells.get(entry.index) ?? []),
    ];
    return { ...baseOf(input, 'feature', entry), ...(grants.length > 0 && { grants }) };
  });
}

export const classes: Importer = {
  types: ['class', 'subclass', 'feature'],
  files: {
    '2014': ['Classes', 'Subclasses', 'Levels', 'Features', 'Proficiencies', 'Ability-Scores'],
    '2024': ['Classes', 'Subclasses', 'Levels', 'Features', 'Proficiencies', 'Ability-Scores'],
  },
  run: (input) => {
    const casting = spellcastingDefs(input);
    const spells = subclassSpells(input, casting);
    return [
      ...classesOf(input, casting),
      ...subclassesOf(input, spells.own),
      ...featuresOf(input, spells.byFeature),
    ];
  },
};
