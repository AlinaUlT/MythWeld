import { type FifthEditionEntity, fifthEditionEntitySchema } from '@grimoire/system-5e';

// CONT-04: the frame every importer of phase 3 runs inside. An importer reads the entries of its
// source files and returns entity inputs; the frame names them (`entityIdOf`), reads their text
// (`textOf`), and checks each one with the fifth-edition pack's entity schema, so what comes out
// is what a pack may hold (SPEC §3.2, §5.1, §5.7). Pure: it reads no file (`source.ts` does).

/** The two rulesets the source holds, named as its folders are. */
export type Ruleset = '2014' | '2024';
export const RULESETS: readonly Ruleset[] = ['2014', '2024'];

/** The built-in pack each ruleset's entities belong to (SPEC §3.1). */
export const PACK_OF: Readonly<Record<Ruleset, string>> = {
  '2014': 'srd-2014',
  '2024': 'srd-2024',
};

/**
 * One entry of a source file. Only `index` is always there (`Levels` has no `name`). Text is
 * `desc` or `description`, and `desc` is a list of paragraphs or one string (`textOf`).
 */
export interface SourceEntry {
  index: string;
  name?: string;
  desc?: string | readonly string[];
  description?: string;
  [field: string]: unknown;
}

/** What an importer is given for one ruleset: its source files' entries, by the file's short name. */
export interface ImportInput {
  ruleset: Ruleset;
  packId: string;
  files: Readonly<Record<string, readonly SourceEntry[]>>;
}

/**
 * One importer, a file of its own (`importers` in `registry.ts`). `types` are the entity types it
 * makes; `files` the source files it reads in each ruleset, by short name (`Spells` for
 * `5e-SRD-Spells.json`). Its `run` returns entity inputs, which the frame then checks.
 */
export interface Importer {
  readonly types: readonly string[];
  readonly files: Readonly<Record<Ruleset, readonly string[]>>;
  readonly run: (input: ImportInput) => readonly unknown[];
}

// --- Ids

// The slug pattern of an entity id (`slugSchema`): groups of lowercase letters and digits, joined by
// single hyphens.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The slug of a source `index`. 4,417 of the source's 4,428 indexes are slugs already and stay as
 * they are. The other 11 (ENG-02 §11) are mapped: a run of hyphens becomes one, and parentheses
 * are dropped (`dragon-ancestor-black---acid-damage` → `dragon-ancestor-black-acid-damage`,
 * `stone-of-good-luck-(luckstone)` → `stone-of-good-luck-luckstone`). Throws when the result is
 * still not a slug, so an entry the mapping cannot name is never imported under a wrong id.
 */
export function slugOf(index: string): string {
  const slug = index.replace(/[()]/g, '').replace(/-{2,}/g, '-');
  if (!SLUG.test(slug)) throw new Error(`The index "${index}" does not map to a slug.`);
  return slug;
}

/** `<pack>:<type>/<slug>` for an entry of the source (SPEC §5.1). */
export function entityIdOf(packId: string, type: string, index: string): string {
  return `${packId}:${type}/${slugOf(index)}`;
}

// --- Text

/**
 * The text of an entry, as one string with a blank line between paragraphs, or `undefined` when it
 * has none. SRD 5.1 keeps it in `desc`, a list of paragraphs, or, for 206 entries, one string; SRD
 * 5.2.1 keeps it in `description`, one string (SPEC §3.2), and its magic items keep `desc`. An
 * empty paragraph is dropped (SRD 5.1's Scrying has one). With both fields `description` wins.
 */
export function textOf(entry: SourceEntry): string | undefined {
  const raw = entry.description ?? entry.desc;
  if (raw === undefined) return undefined;
  const paragraphs = (typeof raw === 'string' ? [raw] : raw).filter((text) => /\S/.test(text));
  return paragraphs.length === 0 ? undefined : paragraphs.join('\n\n');
}

/** The fields every entity of the source has, for an importer to add its own to. */
export function baseOf(input: ImportInput, type: string, entry: SourceEntry) {
  const text = textOf(entry);
  return {
    id: entityIdOf(input.packId, type, entry.index),
    type,
    ruleset: input.ruleset,
    ...(entry.name !== undefined && { name: { en: entry.name } }),
    ...(text !== undefined && { text: { en: text } }),
    source: { pack: input.packId },
  };
}

// --- The run

/** One thing the frame refused: the importer, the entity's id when it has one, and why. */
export interface ImportProblem {
  importer: string;
  id?: string;
  message: string;
}

export interface ImportResult {
  /** The entities that passed the schema, in the order the importers made them. */
  entities: FifthEditionEntity[];
  problems: ImportProblem[];
}

export interface ImportOptions {
  ruleset: Ruleset;
  importers: Readonly<Record<string, Importer>>;
  /** Reads one source file of this ruleset by its short name (`source.ts`'s `readSourceFile`). */
  read: (ruleset: Ruleset, file: string) => readonly SourceEntry[];
}

/** Each issue of a refused entity, as `path: message`. */
function issuesOf(error: { issues: readonly { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .map((issue) => `${issue.path.map(String).join('.') || '(entity)'}: ${issue.message}`)
    .join('; ');
}

/**
 * Runs every importer for one ruleset. An entity the schema refuses, one whose id is not of this
 * ruleset's pack, one whose type its importer does not name, and a repeated id are each a problem,
 * and the entity is left out. The caller (the build, CONT-21) fails on any problem.
 */
export function runImport({ ruleset, importers, read }: ImportOptions): ImportResult {
  const packId = PACK_OF[ruleset];
  const entities: FifthEditionEntity[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Set<string>();
  for (const [name, importer] of Object.entries(importers)) {
    const files: Record<string, readonly SourceEntry[]> = {};
    for (const file of importer.files[ruleset]) files[file] = read(ruleset, file);
    for (const made of importer.run({ ruleset, packId, files })) {
      const parsed = fifthEditionEntitySchema.safeParse(made);
      if (!parsed.success) {
        const id = (made as { id?: unknown } | null)?.id;
        problems.push({
          importer: name,
          ...(typeof id === 'string' && { id }),
          message: issuesOf(parsed.error),
        });
        continue;
      }
      const entity = parsed.data;
      const problem = (message: string) =>
        problems.push({ importer: name, id: entity.id, message });
      if (!entity.id.startsWith(`${packId}:`)) problem(`The id is not of the pack "${packId}".`);
      else if (!importer.types.includes(entity.type)) {
        problem(`The importer does not name the type "${entity.type}".`);
      } else if (seen.has(entity.id)) problem('The id is made twice.');
      else {
        seen.add(entity.id);
        entities.push(entity);
      }
    }
  }
  return { entities, problems };
}
