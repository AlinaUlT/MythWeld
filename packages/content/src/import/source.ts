import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_DIR_NAME } from '../source/pin.ts';
import type { Ruleset, SourceEntry } from './frame.ts';

// CONT-04: reads the files `pnpm fetch-source` fetched (CONT-01). Node only; the frame itself
// (`frame.ts`) is pure and takes a reader, so a test passes made-up entries.

/** Where the fetched files are: `packages/content/.source/5e-database`. */
export const SOURCE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  SOURCE_DIR_NAME,
);

/** A source file's name on disk: `Spells` is `5e-SRD-Spells.json`. */
export const sourceFileName = (file: string): string => `5e-SRD-${file}.json`;

/** The entries of one source file of one ruleset. Throws when it is missing or not a list. */
export function readSourceFile(ruleset: Ruleset, file: string, dir = SOURCE_DIR): SourceEntry[] {
  const path = join(dir, ruleset, sourceFileName(file));
  if (!existsSync(path)) {
    throw new Error(`${path} is missing: run \`pnpm fetch-source\``);
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${path} is not a list`);
  return parsed as SourceEntry[];
}
