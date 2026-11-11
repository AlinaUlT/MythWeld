import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  MANIFEST_NAME,
  SOURCE_COMMIT,
  SOURCE_LICENSE,
  SOURCE_REPO,
  SOURCE_RULESETS,
  sourceFolder,
} from './pin.ts';

// CONT-01: fetch the import source at the pinned commit into a folder git ignores.
// The files are the source, not our content (SPEC §3.2). Their legal text is the data package's
// MIT license and a README line for the OGL 1.0a, not the CC-BY-4.0 the packs carry, so the files
// are not committed:
// the importers (CONT-04 and wave 2) read them from here, and the packs they write are what the
// repository carries.

export interface SourceFileEntry {
  /** Path inside the target folder, with `/`: `2014/spells.json`, `LICENSE.md`. */
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface SourceManifest {
  readonly repo: string;
  readonly commit: string;
  readonly files: readonly SourceFileEntry[];
}

export interface FetchOptions {
  /** The folder the files go to. Created, or replaced when it holds an earlier fetch. */
  readonly dir: string;
  /** Defaults to the pinned repository; a test passes a local one. */
  readonly repo?: string;
  /** Defaults to the pinned commit. */
  readonly commit?: string;
}

export type FetchResult =
  | { readonly status: 'fetched'; readonly manifest: SourceManifest }
  | { readonly status: 'already-there'; readonly manifest: SourceManifest };

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Every file under `root`, as `/` paths relative to it, sorted. */
function listFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (folder: string): void => {
    for (const name of readdirSync(folder)) {
      const full = join(folder, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(root, full).split('\\').join('/'));
    }
  };
  walk(root);
  return found.sort();
}

function describeFiles(root: string, paths: readonly string[]): SourceFileEntry[] {
  return paths.map((path) => {
    const bytes = readFileSync(join(root, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

/** The manifest of an earlier fetch, or `undefined` when the folder has none or it is unreadable. */
export function readManifest(dir: string): SourceManifest | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, MANIFEST_NAME), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { repo, commit, files } = parsed as Partial<SourceManifest>;
    if (typeof repo !== 'string' || typeof commit !== 'string' || !Array.isArray(files)) {
      return undefined;
    }
    return { repo, commit, files };
  } catch {
    return undefined;
  }
}

/**
 * What is wrong with a fetched folder, one line each: a file the manifest names that is missing or
 * changed, and a file the manifest does not name. An empty list means the folder is as it was
 * fetched.
 */
export function verifySource(dir: string): string[] {
  const manifest = readManifest(dir);
  if (manifest === undefined) return [`${MANIFEST_NAME} is missing or unreadable`];
  const problems: string[] = [];
  const present = new Set(listFiles(dir).filter((path) => path !== MANIFEST_NAME));
  for (const entry of manifest.files) {
    present.delete(entry.path);
    const full = join(dir, entry.path);
    if (!existsSync(full)) problems.push(`${entry.path} is missing`);
    else if (sha256(readFileSync(full)) !== entry.sha256) problems.push(`${entry.path} changed`);
  }
  for (const extra of present) problems.push(`${extra} is not in ${MANIFEST_NAME}`);
  return problems;
}

/**
 * Fetches the pinned commit and copies the English data folders and the license into `dir`.
 * Nothing is fetched when `dir` already holds this commit and every file is as fetched.
 * `dir` is replaced only when it is empty, absent, or holds an earlier fetch (it has a manifest).
 */
export function fetchSource(options: FetchOptions): FetchResult {
  const { dir } = options;
  const repo = options.repo ?? SOURCE_REPO;
  const commit = options.commit ?? SOURCE_COMMIT;

  const earlier = readManifest(dir);
  if (earlier?.commit === commit && earlier.repo === repo && verifySource(dir).length === 0) {
    return { status: 'already-there', manifest: earlier };
  }
  if (existsSync(dir) && earlier === undefined && readdirSync(dir).length > 0) {
    throw new Error(`${dir} is not empty and holds no ${MANIFEST_NAME}; it is not touched`);
  }

  const work = mkdtempSync(join(tmpdir(), 'grimoire-source-'));
  try {
    git(work, ['init', '-q']);
    // Only the commit's trees come first; the files of the folders below come in one batch
    // when the sparse checkout reads them.
    git(work, ['fetch', '-q', '--depth', '1', '--filter=blob:none', repo, commit]);
    const fetched = git(work, ['rev-parse', 'FETCH_HEAD']).trim();
    if (fetched !== commit) throw new Error(`asked for ${commit}, the remote gave ${fetched}`);
    const folders = SOURCE_RULESETS.map(sourceFolder);
    git(work, ['sparse-checkout', 'set', '--no-cone', ...folders, SOURCE_LICENSE]);
    git(work, ['-c', 'advice.detachedHead=false', 'checkout', '-q', commit]);

    const staged = join(work, 'staged');
    mkdirSync(staged);
    for (const ruleset of SOURCE_RULESETS) {
      cpSync(join(work, sourceFolder(ruleset)), join(staged, ruleset), { recursive: true });
    }
    cpSync(join(work, SOURCE_LICENSE), join(staged, 'LICENSE.md'));

    const files = describeFiles(staged, listFiles(staged));
    if (!files.some((file) => file.path.startsWith('2014/') && file.path.endsWith('.json'))) {
      throw new Error('no 2014 data files came with that commit');
    }
    if (!files.some((file) => file.path.startsWith('2024/') && file.path.endsWith('.json'))) {
      throw new Error('no 2024 data files came with that commit');
    }
    const manifest: SourceManifest = { repo, commit, files };
    writeFileSync(join(staged, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);

    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, '..'), { recursive: true });
    cpSync(staged, dir, { recursive: true });
    return { status: 'fetched', manifest };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
