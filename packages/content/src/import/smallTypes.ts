import { baseOf, entityIdOf, type Importer, type ImportInput, type SourceEntry } from './frame.ts';

// CONT-14: the small rule types of both SRDs. A file of the source gives an entity for each entry
// (abilities, skills, conditions, damage types, languages, weapon properties, weapon masteries,
// schools of magic, tool kinds). Seven more types are only named by key in other entities and no
// file lists them (sizes, creature types, item rarities, area shapes, feat categories), so a table
// below lists each, from the values the source uses (CONT-14 §8).

/**
 * The key an entity is named by in other entities: the slug in camelCase (`deep-speech` is
 * `deepSpeech`), as the hand-written packs write it. Later importers use it for their own keys.
 */
export function keyOf(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, next: string) => next.toUpperCase());
}

/** The fields every small entity has: the frame's, and the key. */
function keyed(input: ImportInput, type: string, entry: SourceEntry) {
  return { ...baseOf(input, type, entry), key: keyOf(entry.index) };
}

/** One entity of a type for each entry of a source file. */
function fromFile(input: ImportInput, type: string, file: string) {
  return (input.files[file] ?? []).map((entry) => keyed(input, type, entry));
}

/** One entity of a type for each row of a table: a slug and a name. */
function fromTable(input: ImportInput, type: string, rows: readonly (readonly [string, string])[]) {
  return rows.map(([slug, name]) => ({
    id: entityIdOf(input.packId, type, slug),
    type,
    key: keyOf(slug),
    ruleset: input.ruleset,
    name: { en: name },
    source: { pack: input.packId },
  }));
}

// --- The tables

/** Every creature size, smallest first (`Monsters`, every `size`). */
const SIZES = [
  ['tiny', 'Tiny'],
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
  ['huge', 'Huge'],
  ['gargantuan', 'Gargantuan'],
] as const;

/** The 14 creature types of both SRDs' monsters and species (`Monsters`, `type`). */
const CREATURE_TYPES = [
  ['aberration', 'Aberration'],
  ['beast', 'Beast'],
  ['celestial', 'Celestial'],
  ['construct', 'Construct'],
  ['dragon', 'Dragon'],
  ['elemental', 'Elemental'],
  ['fey', 'Fey'],
  ['fiend', 'Fiend'],
  ['giant', 'Giant'],
  ['humanoid', 'Humanoid'],
  ['monstrosity', 'Monstrosity'],
  ['ooze', 'Ooze'],
  ['plant', 'Plant'],
  ['undead', 'Undead'],
] as const;

/**
 * The rarities of magic items (`Magic-Items`, `rarity`). An item that has several (`Uncommon (+1),
 * Rare (+2), or Very Rare (+3)`) or none (`Varies`) is named by `varies` or by one of them: the
 * magic items row decides.
 */
const ITEM_RARITIES = [
  ['common', 'Common'],
  ['uncommon', 'Uncommon'],
  ['rare', 'Rare'],
  ['very-rare', 'Very Rare'],
  ['legendary', 'Legendary'],
  ['artifact', 'Artifact'],
  ['varies', 'Varies'],
] as const;

/**
 * The shapes of a spell's area. SRD 5.1 gives `area_of_effect.type` to 88 spells: five shapes.
 * SRD 5.2.1 gives none, and its spell texts name the same five and the Emanation.
 */
const AREA_SHAPES_2014 = [
  ['cone', 'Cone'],
  ['cube', 'Cube'],
  ['cylinder', 'Cylinder'],
  ['line', 'Line'],
  ['sphere', 'Sphere'],
] as const;
const AREA_SHAPES_2024 = [...AREA_SHAPES_2014, ['emanation', 'Emanation']] as const;

/** SRD 5.2.1's four kinds of feat (`Feats`, `type`); SRD 5.1's one feat has none. */
const FEAT_CATEGORIES = [
  ['origin', 'Origin'],
  ['general', 'General'],
  ['fighting-style', 'Fighting Style'],
  ['epic-boon', 'Epic Boon'],
] as const;

/** The kinds of proficiency in `Proficiencies` that are tools or vehicles, in either SRD. */
const TOOL_PROFICIENCY_TYPES: ReadonlySet<string> = new Set([
  "Artisan's Tools",
  'Gaming Sets',
  'Musical Instruments',
  'Other',
  'Tools',
  'Vehicles',
]);

/**
 * A tool kind for each proficiency in a tool group (`Proficiencies`). It is named by the thing the
 * proficiency is of, `reference`, as the equipment names it, so a tool item and its kind share a
 * key (`tool-dice`'s kind is `dice`).
 */
function toolKinds(input: ImportInput) {
  return (input.files.Proficiencies ?? [])
    .filter((entry) => TOOL_PROFICIENCY_TYPES.has(String(entry.type)))
    .map((entry) => {
      const reference = entry.reference as { index: string; name: string };
      return {
        id: entityIdOf(input.packId, 'toolKind', reference.index),
        type: 'toolKind',
        key: keyOf(reference.index),
        ruleset: input.ruleset,
        name: { en: reference.name },
        source: { pack: input.packId },
      };
    });
}

/** The one skill whose passive score the sheet shows (SPEC §8; the hand-written packs say it too). */
const PASSIVE_SKILL = 'perception';

export const smallTypes: Importer = {
  types: [
    'ability',
    'skill',
    'condition',
    'damageType',
    'language',
    'weaponProperty',
    'weaponMastery',
    'spellSchool',
    'toolKind',
    'size',
    'creatureType',
    'itemRarity',
    'areaShape',
    'featCategory',
  ],
  files: {
    '2014': [
      'Ability-Scores',
      'Skills',
      'Conditions',
      'Damage-Types',
      'Languages',
      'Magic-Schools',
      'Weapon-Properties',
      'Proficiencies',
    ],
    '2024': [
      'Ability-Scores',
      'Skills',
      'Conditions',
      'Damage-Types',
      'Languages',
      'Magic-Schools',
      'Weapon-Properties',
      'Weapon-Mastery-Properties',
      'Proficiencies',
    ],
  },
  run: (input) => [
    // A stat is named by its short form in the source (`STR`) and its full form in `full_name`.
    ...(input.files['Ability-Scores'] ?? []).map((entry, order) => ({
      ...keyed(input, 'ability', entry),
      name: { en: String(entry.full_name) },
      abbr: { en: String(entry.name) },
      order,
    })),
    ...(input.files.Skills ?? []).map((entry) => ({
      ...keyed(input, 'skill', entry),
      ability: keyOf((entry.ability_score as { index: string }).index),
      ...(entry.index === PASSIVE_SKILL && { passive: true }),
    })),
    ...fromFile(input, 'condition', 'Conditions'),
    ...fromFile(input, 'damageType', 'Damage-Types'),
    ...fromFile(input, 'language', 'Languages'),
    ...fromFile(input, 'weaponProperty', 'Weapon-Properties'),
    ...fromFile(input, 'weaponMastery', 'Weapon-Mastery-Properties'),
    ...fromFile(input, 'spellSchool', 'Magic-Schools'),
    ...toolKinds(input),
    ...fromTable(input, 'size', SIZES),
    ...fromTable(input, 'creatureType', CREATURE_TYPES),
    ...fromTable(input, 'itemRarity', ITEM_RARITIES),
    ...fromTable(
      input,
      'areaShape',
      input.ruleset === '2014' ? AREA_SHAPES_2014 : AREA_SHAPES_2024,
    ),
    ...(input.ruleset === '2024' ? fromTable(input, 'featCategory', FEAT_CATEGORIES) : []),
  ],
};
