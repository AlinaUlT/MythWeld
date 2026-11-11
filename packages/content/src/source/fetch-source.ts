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
import { fileURLToPath } from 'node:url';
import {
  DERIVED_RULES_PATH,
  MANIFEST_NAME,
  SOURCE_COMMIT,
  SOURCE_LICENSE,
  SOURCE_REPO,
  SOURCE_RULESETS,
  SRD_PDF,
  SRD_PDF_LICENSE_PATH,
  SRD_PDF_PATH,
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

/** CONT-73: a PDF fetched beside the data, by its hash. */
export interface PdfSource {
  readonly url: string;
  readonly sha256: string;
  /** Whether the rules are derived from it into the 2024 folder. Default true. */
  readonly derive?: boolean;
}

export interface SourceManifest {
  readonly repo: string;
  readonly commit: string;
  readonly files: readonly SourceFileEntry[];
  /** The PDF the fetch added, when it did (CONT-73). */
  readonly pdf?: { readonly url: string; readonly sha256: string };
}

export interface FetchOptions {
  /** The folder the files go to. Created, or replaced when it holds an earlier fetch. */
  readonly dir: string;
  /** Defaults to the pinned repository; a test passes a local one. */
  readonly repo?: string;
  /** Defaults to the pinned commit. */
  readonly commit?: string;
  /** Defaults to the pinned SRD 5.2.1 PDF; `false` fetches the data alone (a test, offline). */
  readonly pdf?: PdfSource | false;
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
    const { repo, commit, files, pdf } = parsed as Partial<SourceManifest>;
    if (typeof repo !== 'string' || typeof commit !== 'string' || !Array.isArray(files)) {
      return undefined;
    }
    return { repo, commit, files, ...(pdf !== undefined && { pdf }) };
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

/** The attribution the SRD 5.2.1 asks for, kept beside the PDF. */
const SRD_PDF_LICENSE = `This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
`;

/**
 * CONT-73: downloads the PDF into `staged`, refuses bytes whose hash is not the pinned one, and
 * derives the 2024 rules file from it. Nothing is kept when the hash is wrong.
 */
function addPdf(staged: string, pdf: PdfSource): void {
  const path = join(staged, SRD_PDF_PATH);
  mkdirSync(join(path, '..'), { recursive: true });
  execFileSync('curl', ['-fsSL', '--max-time', '300', '-o', path, pdf.url], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const got = sha256(readFileSync(path));
  if (got !== pdf.sha256)
    throw new Error(`the PDF has the hash ${got}, not the pinned ${pdf.sha256}`);
  writeFileSync(join(staged, SRD_PDF_LICENSE_PATH), SRD_PDF_LICENSE);
  if (pdf.derive === false) return;
  const out = join(staged, DERIVED_RULES_PATH);
  if (existsSync(out))
    throw new Error(`${DERIVED_RULES_PATH} is already in the data; it is not replaced`);
  const cli = fileURLToPath(new URL('./srd-pdf-cli.ts', import.meta.url));
  execFileSync(process.execPath, [cli, path, out], { stdio: ['ignore', 'pipe', 'pipe'] });
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
  const pdf = options.pdf === undefined ? SRD_PDF : options.pdf;
  const same = (earlier: SourceManifest) =>
    pdf === false
      ? earlier.pdf === undefined
      : earlier.pdf?.url === pdf.url && earlier.pdf.sha256 === pdf.sha256;

  const earlier = readManifest(dir);
  if (
    earlier?.commit === commit &&
    earlier.repo === repo &&
    same(earlier) &&
    verifySource(dir).length === 0
  ) {
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
    let manifest: SourceManifest = { repo, commit, files };
    if (pdf !== false) {
      addPdf(staged, pdf);
      manifest = {
        repo,
        commit,
        files: describeFiles(staged, listFiles(staged)),
        pdf: { url: pdf.url, sha256: pdf.sha256 },
      };
    }
    writeFileSync(join(staged, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);

    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, '..'), { recursive: true });
    cpSync(staged, dir, { recursive: true });
    return { status: 'fetched', manifest };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
