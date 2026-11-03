// SHEET-33: how the sheet names a computed path in a breakdown (SPEC §6.2): the path's parts, each
// an entry of the packs the path names by key, or a word the screen words in its own locale. Only
// the module knows which of its paths carry a stat's, a skill's or a class's key (D3), so the app
// writes no path of its own: `abilities.str.mod` is "Strength" and "modifier".

/** One part of a path: an entry named by type and key, or a segment of the path as a word. */
export type PathPart =
  | { type: 'entry'; entry: string; key: string }
  | { type: 'word'; word: string };

/** The path's segments that name an entry, by the segment before it: its entry type. */
const ENTRY_AFTER: Readonly<Record<string, string>> = {
  abilities: 'ability',
  checks: 'ability',
  skills: 'skill',
  classes: 'class',
};

/** The paths whose whole is one word: the proficiency bonus is `prof`, not "proficiency". */
const WHOLE_WORD: Readonly<Record<string, string>> = { prof: 'proficiencyBonus' };

/** The words a segment adds before the rest: a check's stat is followed by "check". */
const WORD_AFTER_ENTRY: Readonly<Record<string, string>> = { checks: 'check' };

/**
 * The parts of `path`, in order. A path that is not a stat's, a skill's or a class's has one word
 * for each of its segments. Pure; never throws on an odd path.
 */
export function fifthEditionPathParts(path: string): PathPart[] {
  const whole = Object.hasOwn(WHOLE_WORD, path) ? WHOLE_WORD[path] : undefined;
  if (whole !== undefined) return [{ type: 'word', word: whole }];
  const segments = path.split('.');
  const parts: PathPart[] = [];
  const [root, key, ...rest] = segments;
  const entry = root === undefined ? undefined : ENTRY_AFTER[root];
  if (root !== undefined && entry !== undefined && key !== undefined && key !== '') {
    parts.push({ type: 'entry', entry, key });
    const added = WORD_AFTER_ENTRY[root];
    if (added !== undefined) parts.push({ type: 'word', word: added });
    for (const word of rest) parts.push({ type: 'word', word });
    return parts;
  }
  return segments.map((word): PathPart => ({ type: 'word', word }));
}
