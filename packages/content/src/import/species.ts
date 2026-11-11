import { baseOf, entityIdOf, type Importer, type ImportInput, type SourceEntry } from './frame.ts';
import { keyOf } from './smallTypes.ts';

// CONT-09: SRD 5.1's races and subraces and SRD 5.2.1's species and subspecies, as `species` and
// `lineage` entities, and their traits as `feature` entities. The source's structure becomes
// grants (the stat increases, the languages, the traits, the lineage to pick, a trait's
// proficiencies and its choices); effects, resources and spells are the mechanics rows' (SPEC §6.8).

/** A link to another entry of the source. */
interface Ref {
  index: string;
  url?: string;
}

/** A choice in the source's shape: `choose` of the options, each a reference or a stat bonus. */
interface Options<T> {
  choose: number;
  from: { options: T[] };
}

// --- Grants

type Grant = Record<string, unknown>;

/** The key of a stat or a skill named by a link. */
const keyOfRef = (ref: Ref): string => keyOf(ref.index);

/** The ids of the entities of a type that a list of links names, in the source's order. */
const idsOf = (input: ImportInput, type: string, refs: readonly Ref[]): string[] =>
  refs.map((ref) => entityIdOf(input.packId, type, ref.index));

/** What a proficiency of the source is: the category and key a `proficiency` grant names it by. */
interface Proficiency {
  category: string;
  key: string;
}

/**
 * The category and key of each proficiency of `Proficiencies`, by its index. The key is the one
 * the proficiency is of (`reference`): a skill's, a weapon's, a tool's. A kind this ticket does not
 * need (armor, saving throws, the groups of weapons) is not mapped, so one that turns up later
 * fails the import instead of being named under a wrong key.
 */
function proficiencies(input: ImportInput): Map<string, Proficiency> {
  const found = new Map<string, Proficiency>();
  for (const entry of input.files.Proficiencies ?? []) {
    const reference = entry.reference as Ref | undefined;
    if (reference === undefined) continue;
    const type = String(entry.type);
    let category: string | undefined;
    if (type === 'Skills') category = 'skill';
    else if (type === 'Weapons' && !reference.index.endsWith('-weapons')) category = 'weapon';
    else if (
      ["Artisan's Tools", 'Gaming Sets', 'Musical Instruments', 'Other', 'Tools'].includes(type)
    ) {
      category = 'tool';
    }
    if (category !== undefined) found.set(entry.index, { category, key: keyOfRef(reference) });
  }
  return found;
}

/** The grant id of a proficiency category: `weapons`, `skills`, `tools`. */
const grantIdOf = (category: string): string => `${category}s`;

/** The proficiency grants of a trait: its fixed ones and its choices, one grant for each category. */
function proficiencyGrants(
  input: ImportInput,
  entry: SourceEntry,
  known: Map<string, Proficiency>,
): Grant[] {
  const grants = new Map<string, Grant>();
  const grantOf = (category: string): Grant => {
    let grant = grants.get(category);
    if (grant === undefined) {
      grant = { id: grantIdOf(category), kind: 'proficiency', category };
      grants.set(category, grant);
    }
    return grant;
  };
  const named = (ref: Ref): Proficiency => {
    // SRD 5.2.1 names a skill choice by the skill itself, SRD 5.1 by its proficiency.
    if (ref.url?.startsWith(`/api/${input.ruleset}/skills/`)) {
      return { category: 'skill', key: keyOfRef(ref) };
    }
    const proficiency = known.get(ref.index);
    if (proficiency === undefined) throw new Error(`The proficiency "${ref.index}" has no key.`);
    return proficiency;
  };
  for (const ref of (entry.proficiencies as Ref[] | undefined) ?? []) {
    const { category, key } = named(ref);
    const grant = grantOf(category);
    grant.fixed = [...((grant.fixed as string[] | undefined) ?? []), key];
  }
  const choice = entry.proficiency_choices as Options<{ item: Ref }> | undefined;
  if (choice !== undefined) {
    const picks = choice.from.options.map((option) => named(option.item));
    const category = picks[0]?.category ?? 'skill';
    if (picks.some((pick) => pick.category !== category)) {
      throw new Error(`The choice of "${entry.index}" mixes categories.`);
    }
    grantOf(category).choose = { count: choice.choose, from: picks.map((pick) => pick.key) };
  }
  return [...grants.values()];
}

/** A `language` grant of what a side gives: fixed languages, and a number to pick from a list. */
function languageGrant(fixed: readonly Ref[], options: Options<{ item: Ref }> | undefined) {
  if (fixed.length === 0 && options === undefined) return [];
  return [
    {
      id: 'languages',
      kind: 'proficiency',
      category: 'language',
      ...(fixed.length > 0 && { fixed: fixed.map(keyOfRef) }),
      ...(options !== undefined && {
        choose: { count: options.choose, from: options.from.options.map((o) => keyOfRef(o.item)) },
      }),
    },
  ];
}

/** The stat grants of a species or a lineage: its fixed increases and a choice among stats. */
function abilityGrants(entry: SourceEntry): Grant[] {
  const grants: Grant[] = [];
  const fixed =
    (entry.ability_bonuses as { ability_score: Ref; bonus: number }[] | undefined) ?? [];
  if (fixed.length > 0) {
    grants.push({
      id: 'ability-scores',
      kind: 'abilityScore',
      mode: 'fixed',
      values: Object.fromEntries(fixed.map((b) => [keyOfRef(b.ability_score), b.bonus])),
    });
  }
  const choice = entry.ability_bonus_options as
    | Options<{ ability_score: Ref; bonus: number }>
    | undefined;
  if (choice !== undefined) {
    const bonuses = new Set(choice.from.options.map((option) => option.bonus));
    if (bonuses.size !== 1)
      throw new Error(`The stat choice of "${entry.index}" has several bonuses.`);
    grants.push({
      id: 'ability-score-choice',
      kind: 'abilityScore',
      mode: 'distribute',
      from: choice.from.options.map((option) => keyOfRef(option.ability_score)),
      patterns: [Array.from({ length: choice.choose }, () => [...bonuses][0])],
    });
  }
  return grants;
}

// --- Sizes

/**
 * SRD 5.2.1's human is "Medium or Small", chosen when the species is picked (ENG-10 §11, CONT-05
 * §8); 5e-database gives it `Medium` alone. Everything else the source's size says.
 */
const SIZE_BY_SPECIES: Readonly<Record<string, readonly string[]>> = { human: ['medium', 'small'] };

function sizesOf(input: ImportInput, entry: SourceEntry): string[] {
  const own = input.ruleset === '2024' ? SIZE_BY_SPECIES[entry.index] : undefined;
  if (own !== undefined) return [...own];
  const options = entry.size_options as Options<{ size: string }> | undefined;
  if (options !== undefined) return options.from.options.map((o) => o.size.toLowerCase());
  return [String(entry.size).toLowerCase()];
}

// --- The entities

/** SRD 5.1's race text is in four fields, which the SRD prints under these labels. */
const RACE_TEXT = [
  ['age', 'Age'],
  ['alignment', 'Alignment'],
  ['size_description', 'Size'],
  ['language_desc', 'Languages'],
] as const;

function raceText(entry: SourceEntry): { text: { en: string } } | Record<string, never> {
  const paragraphs = RACE_TEXT.flatMap(([field, label]) => {
    const words = entry[field];
    return typeof words === 'string' && /\S/.test(words) ? [`**${label}.** ${words}`] : [];
  });
  return paragraphs.length === 0 ? {} : { text: { en: paragraphs.join('\n\n') } };
}

/** The traits by index, so a species can read what its traits give. */
function traitsOf(input: ImportInput): Map<string, SourceEntry> {
  return new Map((input.files.Traits ?? []).map((trait) => [trait.index, trait]));
}

/**
 * A language choice a trait names. It is put on the species or lineage that has the trait, not on
 * the trait: ENG-56 reads the languages a side's own grants give, and a grant left on a trait is
 * never read as that side's (the row's note: the high elf's Extra Language).
 */
function languageOptionsOf(
  traits: Map<string, SourceEntry>,
  refs: readonly Ref[],
): Options<{ item: Ref }> | undefined {
  for (const ref of refs) {
    const options = traits.get(ref.index)?.language_options as Options<{ item: Ref }> | undefined;
    if (options !== undefined) return options;
  }
  return undefined;
}

/**
 * The traits no species, lineage or trait lists, by the species they name. SRD 5.2.1's Draconic
 * Ancestry names the dragonborn in `species` and is in no `traits` list, so it joins the
 * dragonborn's traits and no trait is left that nothing gives (CONT-09 §8).
 */
function unlistedTraits(input: ImportInput): Map<string, Ref[]> {
  const is2014 = input.ruleset === '2014';
  const listed = new Set<string>();
  const list = (refs: unknown) => {
    for (const ref of (refs as Ref[] | undefined) ?? []) listed.add(ref.index);
  };
  for (const entry of input.files[is2014 ? 'Races' : 'Species'] ?? []) list(entry.traits);
  for (const entry of input.files[is2014 ? 'Subraces' : 'Subspecies'] ?? []) {
    list(is2014 ? entry.racial_traits : entry.traits);
  }
  for (const trait of input.files.Traits ?? []) {
    const options = (
      trait.trait_specific as { subtrait_options?: Options<{ item: Ref }> } | undefined
    )?.subtrait_options;
    list(options?.from.options.map((option) => option.item));
  }
  const bySpecies = new Map<string, Ref[]>();
  for (const trait of input.files.Traits ?? []) {
    if (listed.has(trait.index)) continue;
    for (const owner of ((is2014 ? trait.races : trait.species) as Ref[] | undefined) ?? []) {
      bySpecies.set(owner.index, [...(bySpecies.get(owner.index) ?? []), { index: trait.index }]);
    }
  }
  return bySpecies;
}

/** A species of either ruleset, and its grants. */
function speciesOf(input: ImportInput) {
  const traits = traitsOf(input);
  const unlisted = unlistedTraits(input);
  const is2014 = input.ruleset === '2014';
  const entries = input.files[is2014 ? 'Races' : 'Species'] ?? [];
  return entries.map((entry) => {
    const own = [
      ...((entry.traits as Ref[] | undefined) ?? []),
      ...(unlisted.get(entry.index) ?? []),
    ];
    const lineages = ((is2014 ? entry.subraces : entry.subspecies) as Ref[] | undefined) ?? [];
    const options =
      (entry.language_options as Options<{ item: Ref }> | undefined) ??
      languageOptionsOf(traits, own);
    const grants = [
      ...abilityGrants(entry),
      ...languageGrant((entry.languages as Ref[] | undefined) ?? [], options),
      ...(own.length > 0
        ? [{ id: 'traits', kind: 'entity', fixed: idsOf(input, 'feature', own) }]
        : []),
      ...(lineages.length > 0
        ? [
            {
              id: is2014 ? 'subrace' : 'lineage',
              kind: 'entity',
              choose: { count: 1, from: idsOf(input, 'lineage', lineages) },
            },
          ]
        : []),
    ];
    return {
      ...baseOf(input, 'species', entry),
      ...(is2014 && raceText(entry)),
      size: sizesOf(input, entry),
      speed: { walk: Number(entry.speed) },
      ...(typeof entry.type === 'string' && { creatureType: keyOf(entry.type.toLowerCase()) }),
      ...(grants.length > 0 && { grants }),
    };
  });
}

/** A lineage of either ruleset: SRD 5.1's subrace, SRD 5.2.1's subspecies. */
function lineagesOf(input: ImportInput) {
  const traits = traitsOf(input);
  const is2014 = input.ruleset === '2014';
  const entries = input.files[is2014 ? 'Subraces' : 'Subspecies'] ?? [];
  return entries.map((entry) => {
    const own = ((is2014 ? entry.racial_traits : entry.traits) as Ref[] | undefined) ?? [];
    const grants = [
      ...abilityGrants(entry),
      ...languageGrant([], languageOptionsOf(traits, own)),
      ...(own.length > 0
        ? [{ id: 'traits', kind: 'entity', fixed: idsOf(input, 'feature', own) }]
        : []),
    ];
    return { ...baseOf(input, 'lineage', entry), ...(grants.length > 0 && { grants }) };
  });
}

/** A trait: its words, what it gives by the source's structure, and the traits it offers. */
function featuresOf(input: ImportInput) {
  const known = proficiencies(input);
  return (input.files.Traits ?? []).map((entry) => {
    const grants: Grant[] = proficiencyGrants(input, entry, known);
    const options = (
      entry.trait_specific as { subtrait_options?: Options<{ item: Ref }> } | undefined
    )?.subtrait_options;
    if (options !== undefined) {
      grants.push({
        id: 'subtraits',
        kind: 'entity',
        choose: {
          count: options.choose,
          from: idsOf(
            input,
            'feature',
            options.from.options.map((option) => option.item),
          ),
        },
      });
    }
    return { ...baseOf(input, 'feature', entry), ...(grants.length > 0 && { grants }) };
  });
}

export const species: Importer = {
  types: ['species', 'lineage', 'feature'],
  files: {
    '2014': ['Races', 'Subraces', 'Traits', 'Proficiencies'],
    '2024': ['Species', 'Subspecies', 'Traits', 'Proficiencies'],
  },
  run: (input) => [...speciesOf(input), ...lineagesOf(input), ...featuresOf(input)],
};
