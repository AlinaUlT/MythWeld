import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchSource, readManifest, verifySource } from '../src/source/fetch-source.ts';
import {
  MANIFEST_NAME,
  SOURCE_COMMIT,
  SOURCE_DIR_NAME,
  SOURCE_REPO,
  SOURCE_RULESETS,
  sourceFolder,
} from '../src/source/pin.ts';

// CONT-01: the fetch command, run against a repository the test builds in a temporary folder, so
// the gate needs no network. Every file in it is made up and holds no rules text.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const size = (text: string): number => Buffer.byteLength(text);

const FILES: Readonly<Record<string, string>> = {
  'packages/5e-database/src/2014/en/5e-SRD-Made-Up.json': '[{"index":"made-up-a"}]\n',
  'packages/5e-database/src/2014/en/5e-SRD-Other.json': '[{"index":"made-up-b"}]\n',
  'packages/5e-database/src/2024/en/5e-SRD-Made-Up.json': '[{"index":"made-up-c"}]\n',
  'packages/5e-database/src/2014/ru/5e-SRD-Made-Up.json': '[{"index":"never-copied"}]\n',
  'packages/5e-database/src/2024/ru/5e-SRD-Made-Up.json': '[{"index":"never-copied"}]\n',
  'packages/5e-database/data.json': '{"never":"copied"}\n',
  'packages/5e-database/LICENSE.md': 'A made-up license text.\n',
};

let scratch: string;
let remote: string;
let remoteUrl: string; // git's partial fetch wants a URL, not a bare path
let commit: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'cont-01-test-'));
  remote = join(scratch, 'remote');
  remoteUrl = pathToFileURL(remote).href;
  mkdirSync(remote);
  git(remote, 'init', '-q');
  git(remote, 'config', 'uploadpack.allowFilter', 'true');
  git(remote, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
  for (const [path, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(remote, path)), { recursive: true });
    writeFileSync(join(remote, path), text);
  }
  git(remote, 'add', '.');
  git(
    remote,
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-q',
    '-m',
    'fixture',
  );
  commit = git(remote, 'rev-parse', 'HEAD');
});

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('CONT-01 the pin', () => {
  it('is one full commit of 5e-bits/5e-srd-api, read from its English folders', () => {
    expect(SOURCE_COMMIT).toMatch(/^[0-9a-f]{40}$/);
    expect(SOURCE_COMMIT.startsWith('e6edf9a')).toBe(true);
    expect(SOURCE_REPO).toBe('https://github.com/5e-bits/5e-srd-api.git');
    expect(SOURCE_RULESETS).toEqual(['2014', '2024']);
    expect(sourceFolder('2014')).toBe('packages/5e-database/src/2014/en');
    expect(sourceFolder('2024')).toBe('packages/5e-database/src/2024/en');
  });

  it('puts the fetched files where git does not commit them', () => {
    const inside = `packages/content/${SOURCE_DIR_NAME}/2014/5e-SRD-Spells.json`;
    expect(git(repoRoot, 'check-ignore', inside)).toBe(inside);
  });
});

describe('CONT-01 fetchSource', () => {
  it('copies both English folders and the license, and writes a manifest of what it copied', () => {
    const dir = join(scratch, 'first');
    const result = fetchSource({ dir, repo: remoteUrl, commit });
    expect(result.status).toBe('fetched');
    expect(readFileSync(join(dir, '2014', '5e-SRD-Made-Up.json'), 'utf8')).toBe(
      FILES['packages/5e-database/src/2014/en/5e-SRD-Made-Up.json'],
    );
    expect(readManifest(dir)).toEqual({
      repo: remoteUrl,
      commit,
      files: [
        {
          path: '2014/5e-SRD-Made-Up.json',
          bytes: size('[{"index":"made-up-a"}]\n'),
          sha256: sha('[{"index":"made-up-a"}]\n'),
        },
        {
          path: '2014/5e-SRD-Other.json',
          bytes: size('[{"index":"made-up-b"}]\n'),
          sha256: sha('[{"index":"made-up-b"}]\n'),
        },
        {
          path: '2024/5e-SRD-Made-Up.json',
          bytes: size('[{"index":"made-up-c"}]\n'),
          sha256: sha('[{"index":"made-up-c"}]\n'),
        },
        {
          path: 'LICENSE.md',
          bytes: size('A made-up license text.\n'),
          sha256: sha('A made-up license text.\n'),
        },
      ],
    });
    expect(verifySource(dir)).toEqual([]);
  });

  it('takes nothing from a ru folder or from beside the data folders', () => {
    const dir = join(scratch, 'second');
    fetchSource({ dir, repo: remoteUrl, commit });
    const paths = readManifest(dir)?.files.map((file) => file.path) ?? [];
    expect(paths.filter((path) => path.includes('ru') || path.includes('never'))).toEqual([]);
    expect(existsSync(join(dir, 'data.json'))).toBe(false);
  });

  it('answers "already-there" with the manifest it holds, without reaching the remote', () => {
    const dir = join(scratch, 'idle');
    fetchSource({ dir, repo: remoteUrl, commit });
    const hidden = join(scratch, 'remote-hidden');
    execFileSync('mv', [remote, hidden]);
    try {
      expect(fetchSource({ dir, repo: remoteUrl, commit }).status).toBe('already-there');
    } finally {
      execFileSync('mv', [hidden, remote]);
    }
  });

  it('names a changed, a missing and an extra file, and fetches again to put them right', () => {
    const dir = join(scratch, 'damaged');
    fetchSource({ dir, repo: remoteUrl, commit });
    writeFileSync(join(dir, '2014', '5e-SRD-Made-Up.json'), '[]\n');
    rmSync(join(dir, '2014', '5e-SRD-Other.json'));
    writeFileSync(join(dir, '2024', 'extra.json'), '[]\n');
    expect(verifySource(dir)).toEqual([
      '2014/5e-SRD-Made-Up.json changed',
      '2014/5e-SRD-Other.json is missing',
      '2024/extra.json is not in SOURCE.json',
    ]);
    expect(fetchSource({ dir, repo: remoteUrl, commit }).status).toBe('fetched');
    expect(verifySource(dir)).toEqual([]);
    expect(existsSync(join(dir, '2024', 'extra.json'))).toBe(false);
  });

  it('reports a folder with no manifest as unverifiable', () => {
    const dir = join(scratch, 'bare');
    mkdirSync(dir);
    expect(verifySource(dir)).toEqual([`${MANIFEST_NAME} is missing or unreadable`]);
  });

  it('refuses a folder that holds other files and no manifest, and leaves it alone', () => {
    const dir = join(scratch, 'foreign');
    mkdirSync(dir);
    writeFileSync(join(dir, 'mine.txt'), 'keep');
    expect(() => fetchSource({ dir, repo: remoteUrl, commit })).toThrow(/is not touched/);
    expect(readFileSync(join(dir, 'mine.txt'), 'utf8')).toBe('keep');
  });

  it('fails, and leaves the folder as it was, when the commit does not exist', () => {
    const dir = join(scratch, 'wrong');
    fetchSource({ dir, repo: remoteUrl, commit });
    const missing = '0123456789abcdef0123456789abcdef01234567';
    expect(() => fetchSource({ dir, repo: remoteUrl, commit: missing })).toThrow();
    expect(readManifest(dir)?.commit).toBe(commit);
    expect(verifySource(dir)).toEqual([]);
  });

  it('fails when the commit holds no data files for a ruleset', () => {
    const empty = join(scratch, 'empty-remote');
    mkdirSync(empty);
    git(empty, 'init', '-q');
    git(empty, 'config', 'uploadpack.allowFilter', 'true');
    git(empty, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
    writeFileSync(join(empty, 'readme.txt'), 'nothing here');
    git(empty, 'add', '.');
    git(
      empty,
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-q',
      '-m',
      'x',
    );
    const dir = join(scratch, 'none');
    expect(() =>
      fetchSource({
        dir,
        repo: pathToFileURL(empty).href,
        commit: git(empty, 'rev-parse', 'HEAD'),
      }),
    ).toThrow();
    expect(existsSync(dir)).toBe(false);
  });
});
