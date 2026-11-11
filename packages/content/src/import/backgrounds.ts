import {
  baseOf,
  entityIdOf,
  type Importer,
  type ImportInput,
  type SourceEntry,
  slugOf,
} from './frame.ts';
import { keyOf } from './smallTypes.ts';

// CONT-10: the backgrounds of both SRDs, as `background` entities, and SRD 5.1's background
// feature as a `feature` entity. What a background gives is its grants (the stat increases, the
// feat, the proficiencies, the languages, the starting items). The words of SRD 5.2.1's backgrounds
// are not in 5e-database, so they are written from its structured fields in the order the SRD 5.2.1
// prints them (page 83), the equipment line being the source's own words (CONT-10 §8).

/** A link to another entry of the source. */
interface Ref {
  index: string;
  name?: string;
  note?: string;
}

/** A choice in the source's shape: `choose` of what `from` holds. */
interface Options<T> {
  choose: number;
  desc?: string;
  from: { options: T[] };
}

type Grant = Record<string, unknown>;

// --- Proficiencies

/** What a proficiency of the source is: its category and the keys it names. */
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

/** The armor groups an `armor` proficiency names (`ARMOR_GROUPS`, ENG-44). */
const ARMOR_GROUP_OF: Readonly<Record<string, string>> = {
  'light-armor': 'light',
  'medium-armor': 'medium',
  'heavy-armor': 'heavy',
};

/** The weapon groups a `weapon` proficiency names, besides one weapon's own key (ENG-34). */
const WEAPON_GROUP_OF: Readonly<Record<string, string>> = {
  'simple-weapons': 'simple',
  'martial-weapons': 'martial',
};

/** The name of a proficiency without its kind: `Skill: Insight` is `Insight`. */
const plainName = (name: string): string => name.replace(/^[^:]+: /, '');

/**
 * Every entry of `Proficiencies`, by its index: the category and the keys a `proficiency` grant
 * names it by. A skill and a stat are named by their key; an armor by its group (`all-armor` by the
 * three), a shield by `shield` and another armor by its item's key (ENG-46); a weapon by its group
 * or its item's key; a tool, a game set, an instrument and a vehicle by the tool kind's key
 * (CONT-14). A kind the map does not name fails the import instead of getting a wrong key.
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
    found.set(entry.index, { category, keys, name: plainName(String(entry.name)) });
  }
  return found;
}

/** The grant id of a proficiency category. */
const GRANT_ID_OF: Readonly<Record<string, string>> = {
  skill: 'skills',
  save: 'saves',
  armor: 'armor',
  weapon: 'weapons',
  tool: 'tools',
  language: 'languages',
};

/**
 * The proficiency grants of a list of fixed proficiencies and of one choice among proficiencies,
 * one grant for each category.
 */
function proficiencyGrants(
  known: Map<string, Proficiency>,
  fixed: readonly Ref[],
  choice: Options<{ item: Ref }> | undefined,
): Grant[] {
  const grants = new Map<string, Grant>();
  const grantOf = (category: string): Grant => {
    let grant = grants.get(category);
    if (grant === undefined) {
      grant = { id: GRANT_ID_OF[category], kind: 'proficiency', category };
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
    const grant = grantOf(category);
    grant.fixed = [...((grant.fixed as string[] | undefined) ?? []), ...keys];
  }
  if (choice !== undefined) {
    const picks = choice.from.options.map((option) => named(option.item));
    const category = picks[0]?.category ?? 'skill';
    if (picks.some((pick) => pick.category !== category)) {
      throw new Error('A proficiency choice mixes categories.');
    }
    grantOf(category).choose = { count: choice.choose, from: picks.flatMap((pick) => pick.keys) };
  }
  return [...grants.values()];
}

// --- Languages

/**
 * SRD 5.2.1's Standard Languages table, without Common (page 20, CONT-10 §8): the languages a
 * character chooses two of at the origin step, besides Common. 5e-database has no such field.
 */
const STANDARD_LANGUAGES_2024: readonly string[] = [
  'common-sign-language',
  'draconic',
  'dwarvish',
  'elvish',
  'giant',
  'gnomish',
  'goblin',
  'halfling',
  'orc',
];

// --- Equipment

/** The ids of the items an equipment category lists, in the source's order. */
function categoryItems(input: ImportInput, category: string): string[] {
  const listed = (input.files['Equipment-Categories'] ?? []).find((c) => c.index === category);
  if (listed === undefined) throw new Error(`The equipment category "${category}" is missing.`);
  return ((listed.equipment as Ref[] | undefined) ?? []).map((item) =>
    entityIdOf(input.packId, 'item', item.index),
  );
}

/**
 * SRD 5.1's starting equipment: its fixed items, and each choice of one item from a category as a
 * choice among the category's items. The gold is not a grant (CONT-10 §11).
 */
function equipmentGrants(input: ImportInput, entry: SourceEntry): Grant[] {
  const fixed =
    (entry.starting_equipment as { equipment: Ref; quantity: number }[] | undefined) ?? [];
  const options =
    (entry.starting_equipment_options as
      | {
          choose: number;
          from: { option_set_type: string; equipment_category: Ref };
        }[]
      | undefined) ?? [];
  const grants: Grant[] = [];
  if (fixed.length > 0) {
    grants.push({
      id: 'equipment',
      kind: 'item',
      fixed: fixed.map((part) => ({
        id: entityIdOf(input.packId, 'item', part.equipment.index),
        qty: part.quantity,
      })),
    });
  }
  options.forEach((option, order) => {
    if (option.from.option_set_type !== 'equipment_category') {
      throw new Error(`The equipment choice of "${entry.index}" is not of a category.`);
    }
    grants.push({
      id: `equipment-choice${options.length > 1 ? `-${order + 1}` : ''}`,
      kind: 'item',
      choose: {
        count: option.choose,
        from: categoryItems(input, option.from.equipment_category.index),
      },
    });
  });
  return grants;
}

// --- Words

const NUMBER_WORDS = ['One', 'Two', 'Three', 'Four'];

/** "Insight and Religion", "Athletics, Stealth and Survival". */
function listOf(names: readonly string[]): string {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A line of a background's words: the label in bold, then what it says. */
const line = (label: string, words: string): string => `**${label}:** ${words}`;

/**
 * The alignment a list of alignments suggests, as the SRD prints it after an ideal: `Lawful`,
 * `Good`, `Any`. The word every alignment shares; `Any` when the list holds all of them.
 */
function alignmentWord(names: readonly string[], all: number): string {
  if (names.length === all) return 'Any';
  const common = names[0]
    ?.split(' ')
    .filter((word) => names.every((n) => n.split(' ').includes(word)));
  if (common === undefined || common.length !== 1) {
    throw new Error(`The alignments ${names.join(', ')} share no one word.`);
  }
  return common[0] as string;
}

/** One table of suggested characteristics, as a numbered list under its heading. */
function characteristics(
  entry: SourceEntry,
  field: string,
  heading: string,
  alignmentCount: number,
): string | undefined {
  const table = entry[field] as
    | {
        choose: number;
        from: {
          options: { string?: string; desc?: string; alignments?: Ref[] }[];
        };
      }
    | undefined;
  if (table === undefined) return undefined;
  const rows = table.from.options.map((option, order) => {
    const words = option.string ?? option.desc ?? '';
    const alignments = (option.alignments ?? []).map((a) => String(a.name));
    const suffix = alignments.length > 0 ? ` (${alignmentWord(alignments, alignmentCount)})` : '';
    return `${order + 1}. ${words}${suffix}`;
  });
  return [`**${heading}** (choose ${table.choose})`, rows.join('\n')].join('\n\n');
}

// --- SRD 5.1

/** A name's slug: lowercase words joined by hyphens, apostrophes dropped. */
const slugOfName = (name: string): string =>
  slugOf(
    name
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
  );

/** A background's feature in SRD 5.1 is a name and words inside the background, not an entry. */
function featureOf(entry: SourceEntry): SourceEntry | undefined {
  const feature = entry.feature as { name: string; desc: readonly string[] } | undefined;
  return feature === undefined
    ? undefined
    : { index: slugOfName(feature.name), name: feature.name, desc: feature.desc };
}

function backgrounds2014(input: ImportInput) {
  const known = proficienciesOf(input);
  const alignmentCount = (input.files.Alignments ?? []).length;
  const made: unknown[] = [];
  for (const entry of input.files.Backgrounds ?? []) {
    const feature = featureOf(entry);
    const languages = entry.language_options as Options<unknown> | undefined;
    const gold = entry.starting_gold as { quantity: number; unit: string } | undefined;
    const fixedItems = (
      (entry.starting_equipment as { equipment: Ref; quantity: number }[] | undefined) ?? []
    ).map((part) => `${part.equipment.name}${part.quantity > 1 ? ` (${part.quantity})` : ''}`);
    const skills = ((entry.starting_proficiencies as Ref[] | undefined) ?? []).map((ref) =>
      plainName(String(ref.name)),
    );
    const words = [
      skills.length > 0 && line('Skill Proficiencies', listOf(skills)),
      languages !== undefined &&
        line(
          'Languages',
          `${NUMBER_WORDS[languages.choose - 1] ?? languages.choose} of your choice`,
        ),
      line(
        'Equipment',
        [
          ...fixedItems,
          ...(
            (entry.starting_equipment_options as
              | { from: { equipment_category: Ref } }[]
              | undefined) ?? []
          ).map((option) => `one from ${option.from.equipment_category.name}`),
          ...(gold !== undefined ? [`${gold.quantity} ${gold.unit}`] : []),
        ].join('; '),
      ),
      feature !== undefined && line('Feature', String(feature.name)),
      characteristics(entry, 'personality_traits', 'Suggested Personality Traits', alignmentCount),
      characteristics(entry, 'ideals', 'Suggested Ideals', alignmentCount),
      characteristics(entry, 'bonds', 'Suggested Bonds', alignmentCount),
      characteristics(entry, 'flaws', 'Suggested Flaws', alignmentCount),
    ].filter((part): part is string => typeof part === 'string');
    const grants = [
      ...proficiencyGrants(
        known,
        (entry.starting_proficiencies as Ref[] | undefined) ?? [],
        undefined,
      ),
      ...(languages !== undefined
        ? [
            {
              id: 'languages',
              kind: 'proficiency',
              category: 'language',
              choose: { count: languages.choose, from: { type: 'language' } },
            },
          ]
        : []),
      ...(feature !== undefined
        ? [
            {
              id: 'feature',
              kind: 'entity',
              fixed: [entityIdOf(input.packId, 'feature', feature.index)],
            },
          ]
        : []),
      ...equipmentGrants(input, entry),
    ];
    made.push({
      ...baseOf(input, 'background', entry),
      text: { en: words.join('\n\n') },
      ...(grants.length > 0 && { grants }),
    });
    if (feature !== undefined) made.push(baseOf(input, 'feature', feature));
  }
  return made;
}

// --- SRD 5.2.1

/**
 * The spell list a background's feat names where 5e-database leaves the note out: SRD 5.2.1 page 83
 * prints the Sage's feat as "Magic Initiate (Wizard)", and the source's feat has no note (CONT-10
 * §8). The Acolyte's note is in the source.
 */
const FEAT_NOTE_2024: Readonly<Record<string, string>> = { sage: 'Wizard' };

/** The feat's name, and the spell list it names, in brackets. */
function featWords(background: string, feat: Ref): string {
  const note = feat.note ?? FEAT_NOTE_2024[background];
  return note === undefined ? String(feat.name) : `${feat.name} (${note})`;
}

function backgrounds2024(input: ImportInput) {
  const known = proficienciesOf(input);
  const abilityNames = new Map(
    (input.files['Ability-Scores'] ?? []).map((a) => [a.index, String(a.full_name)]),
  );
  return (input.files.Backgrounds ?? []).map((entry) => {
    const stats = (entry.ability_scores as Ref[]).map((ref) => ref.index);
    const feat = entry.feat as Ref;
    const fixed = (entry.proficiencies as Ref[] | undefined) ?? [];
    const choice = entry.proficiency_choices as
      | (Options<{ item: Ref }> & { desc: string })[]
      | undefined;
    const equipment = (entry.equipment_options as { desc: string }[] | undefined) ?? [];
    if ((choice?.length ?? 0) > 1)
      throw new Error(`"${entry.index}" has several proficiency choices.`);
    const skills = fixed.filter((ref) => known.get(ref.index)?.category === 'skill');
    const tools = fixed.filter((ref) => known.get(ref.index)?.category === 'tool');
    const words = [
      line('Ability Scores', stats.map((s) => abilityNames.get(s) ?? s).join(', ')),
      line('Feat', featWords(entry.index, feat)),
      line('Skill Proficiencies', listOf(skills.map((ref) => known.get(ref.index)?.name ?? ''))),
      line(
        'Tool Proficiency',
        choice?.[0]?.desc ?? tools.map((ref) => known.get(ref.index)?.name ?? '').join(', '),
      ),
      ...equipment.map((option) => line('Equipment', option.desc)),
    ];
    const grants = [
      {
        id: 'ability-scores',
        kind: 'abilityScore',
        mode: 'distribute',
        from: stats.map(keyOf),
        patterns: [
          [2, 1],
          [1, 1, 1],
        ],
      },
      { id: 'feat', kind: 'entity', fixed: [entityIdOf(input.packId, 'feat', feat.index)] },
      ...proficiencyGrants(known, fixed, choice?.[0]),
      // "Common plus two languages", from the origin step (ENG-56): the background gives them.
      {
        id: 'languages',
        kind: 'proficiency',
        category: 'language',
        fixed: ['common'],
        choose: { count: 2, from: STANDARD_LANGUAGES_2024.map(keyOf) },
      },
    ];
    return { ...baseOf(input, 'background', entry), text: { en: words.join('\n\n') }, grants };
  });
}

export const backgrounds: Importer = {
  types: ['background', 'feature'],
  files: {
    '2014': ['Backgrounds', 'Proficiencies', 'Equipment-Categories', 'Alignments'],
    '2024': ['Backgrounds', 'Proficiencies', 'Ability-Scores'],
  },
  run: (input) => (input.ruleset === '2014' ? backgrounds2014(input) : backgrounds2024(input)),
};
