import { baseOf, type Importer, type ImportInput, type SourceEntry } from './frame.ts';
import { keyOf } from './smallTypes.ts';

// CONT-11: the feats of both SRDs (SRD 5.1's one, SRD 5.2.1's seventeen). A feat's `type` is its
// category, a key of the `featCategory` entities CONT-14 makes; its prerequisites are the
// schema's kinds, and what it gives is the mechanics rows' (CONT-37).

interface ScorePrerequisite {
  ability_score: { index: string };
  minimum_score: number;
}

/** A `prerequisite_options` in the source's shape. */
interface PrerequisiteOptions {
  desc: string;
  choose: number;
  type: string;
  from: {
    options: { option_type: string; ability_score: { index: string }; minimum_score: number }[];
  };
}

/** The prerequisites of a feat, in the schema's kinds. */
function prerequisitesOf(entry: SourceEntry): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  // SRD 5.1 lists stat minimums.
  for (const need of (Array.isArray(entry.prerequisites)
    ? entry.prerequisites
    : []) as ScorePrerequisite[]) {
    found.push({ kind: 'ability', key: keyOf(need.ability_score.index), min: need.minimum_score });
  }
  // SRD 5.2.1 gives an object: a level, and the name of a feature the character has.
  const needs = Array.isArray(entry.prerequisites)
    ? undefined
    : (entry.prerequisites as { minimum_level?: number; feature_named?: string } | undefined);
  if (needs?.minimum_level !== undefined) found.push({ kind: 'level', min: needs.minimum_level });
  if (needs?.feature_named !== undefined)
    found.push({ kind: 'featureNamed', name: needs.feature_named });
  // "Strength or Dexterity 13+": one of the stats, as one formula and the source's words.
  const options = entry.prerequisite_options as PrerequisiteOptions | undefined;
  if (options !== undefined) {
    if (options.choose !== 1 || options.type !== 'ability-scores') {
      throw new Error(`The prerequisite options of "${entry.index}" are not one of several stats.`);
    }
    found.push({
      kind: 'formula',
      formula: options.from.options
        .map(
          (option) =>
            `@abilities.${keyOf(option.ability_score.index)}.score >= ${option.minimum_score}`,
        )
        .join(' || '),
      label: { en: options.desc },
    });
  }
  return found;
}

function featsOf(input: ImportInput) {
  return (input.files.Feats ?? []).map((entry) => {
    const prerequisites = prerequisitesOf(entry);
    return {
      ...baseOf(input, 'feat', entry),
      ...(typeof entry.type === 'string' && { category: keyOf(entry.type) }),
      // The source gives the words of the rule ("You can take this feat more than once"), not a flag.
      ...(typeof entry.repeatable === 'string' && { repeatable: true }),
      ...(prerequisites.length > 0 && { prerequisites }),
    };
  });
}

export const feats: Importer = {
  types: ['feat'],
  files: { '2014': ['Feats'], '2024': ['Feats'] },
  run: (input) => featsOf(input),
};
