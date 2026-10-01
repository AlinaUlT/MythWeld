import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// The real biome.json and tsconfig files are copied next to a sample file, so the sample is
// checked by the same rules as packages/engine/src without ever being a file the gate sees. The
// engine's node_modules is linked in, so a type package the config names would really load.
const repo = resolve(import.meta.dirname, '../../..');
const bin = join(repo, 'node_modules/.bin');
const dir = mkdtempSync(join(tmpdir(), 'eng-01-'));
cpSync(join(repo, 'biome.json'), join(dir, 'biome.json'));
cpSync(join(repo, 'biome'), join(dir, 'biome'), { recursive: true });
cpSync(join(repo, 'tsconfig.base.json'), join(dir, 'tsconfig.base.json'));
mkdirSync(join(dir, 'packages/engine/src'), { recursive: true });
mkdirSync(join(dir, 'packages/schema/src'), { recursive: true });
cpSync(join(repo, 'packages/engine/tsconfig.json'), join(dir, 'packages/engine/tsconfig.json'));
symlinkSync(join(repo, 'packages/engine/node_modules'), join(dir, 'packages/engine/node_modules'));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(
  command: string,
  args: string[],
  source: string,
  file = 'packages/engine/src/Sample.ts',
) {
  writeFileSync(join(dir, file), source);
  const result = spawnSync(join(bin, command), args, { cwd: dir, encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
}

function linesOf(output: string, pattern: RegExp) {
  return [...output.matchAll(pattern)].map((m) => Number(m[1])).sort((a, b) => a - b);
}

function lint(source: string) {
  const { status, output } = run(
    'biome',
    ['lint', '--vcs-enabled=false', '--max-diagnostics=50', 'packages/engine/src/Sample.ts'],
    source,
  );
  return {
    status,
    imports: linesOf(output, /Sample\.ts:(\d+):\d+ lint\/style\/noRestrictedImports/g),
    globals: linesOf(output, /Sample\.ts:(\d+):\d+ lint\/style\/noRestrictedGlobals/g),
  };
}

function typecheck(source: string) {
  const { status, output } = run('tsc', ['-p', 'packages/engine/tsconfig.json'], source);
  return { status, lines: linesOf(output, /Sample\.ts\((\d+),\d+\): error TS/g) };
}

const badImports = `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dexie from 'dexie';
import { request } from 'node:http';
import type { AxiosInstance } from 'axios';
export { WebSocket } from 'ws';
export const app = () => import('@grimoire/web');
import { db } from '../../../apps/web/src/db/db.ts';
import '../../../node_modules/.pnpm/node_modules/dexie/dist/dexie.mjs';
export const all = [useState, createRoot, Dexie, request, db];
export type Client = AxiosInstance;
`;

const badGlobals = `export const page = document.title;
export const tab = window.name;
export const agent = navigator.userAgent;
export const saved = localStorage.getItem('hp');
export const db = indexedDB.open('grimoire');
export const get = fetch('/pack.json');
export const xhr = new XMLHttpRequest();
export const socket = new WebSocket('wss://table.example');
export const hidden = (globalThis as { fetch?: unknown }).fetch;
`;

const good = `import type { Pack } from '@grimoire/schema';
import { roll } from './dice.ts';
import { sum } from '../util/sum.ts';

export const run = [roll, sum];
export type Loaded = Pack;
export const top = Math.max(1, 2);
`;

describe('ENG-01 engine purity', () => {
  it('fails lint on React, Dexie, network, any other library and a path out to them', () => {
    const result = lint(badImports);
    expect(result.status).toBe(1);
    // react (1), react-dom (2), dexie (3), node:http (4), a type from axios (5),
    // a re-export from ws (6), a dynamic import of the app (7), a relative path into the app's
    // Dexie file (8), a relative path into node_modules (9).
    expect(result.imports).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('fails lint on DOM, storage and network globals', () => {
    const result = lint(badGlobals);
    expect(result.status).toBe(1);
    expect(result.globals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('passes lint on its own files and the schema package', () => {
    const result = lint(good);
    expect(result.imports).toEqual([]);
    expect(result.globals).toEqual([]);
    expect(result.status).toBe(0);
  });

  it('fails typecheck on DOM, Node and network names', () => {
    const result = typecheck(`export const page = document.title;
export const tab = window.name;
export const env = process.env;
export const get = fetch('/pack.json');
export const saved = localStorage.getItem('hp');
export const top = Math.max(1, 2);
`);
    expect(result.status).not.toBe(0);
    // Lines 1–5 each name something outside the language; line 6 is plain ES2022.
    expect(result.lines).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('ENG-07 formulas never run code', () => {
  it('fails lint on eval and Function in the engine', () => {
    const { output } = run(
      'biome',
      ['lint', '--vcs-enabled=false', '--max-diagnostics=50', 'packages/engine/src/Sample.ts'],
      `export const a = eval('1');
export const b = new Function('return 1');
export const c = Function('return 1');
export const d = Math.max(1, 2);
`,
    );
    // eval (1), new Function (2), Function called (3); line 4 is plain ES2022.
    expect(linesOf(output, /Sample\.ts:(\d+):\d+ lint\/style\/noRestrictedGlobals/g)).toEqual([
      1, 2, 3,
    ]);
    expect(output.match(/ENG-07: formulas never run code/g)).toHaveLength(3);
  });
});

describe('ENG-08 the engine has no randomness of its own', () => {
  it('fails lint on Math.random in the engine', () => {
    const { status, output } = run(
      'biome',
      ['lint', '--vcs-enabled=false', '--max-diagnostics=50', 'packages/engine/src/Sample.ts'],
      `export const a = Math.random();
export const b = Math.random;
export const c = Math.max(1, 2);
`,
    );
    expect(status).toBe(1);
    // Math.random called (1), Math.random taken (2); line 3 is plain ES2022.
    expect(linesOf(output, /Sample\.ts:(\d+):\d+ plugin/g)).toEqual([1, 2]);
    expect(output.match(/ENG-08: the engine has no randomness of its own/g)).toHaveLength(2);
  });
});

// A relative path from a file in packages/<core>/src climbs two steps to reach packages/.
const moduleImports = `import { rules } from '@grimoire/system-5e';
import type { Rules } from '@grimoire/system-5e';
export { steps } from '@grimoire/system-5e/src/steps.ts';
export const later = () => import('@grimoire/system-tales');
import { climb } from '../../system-5e/src/index.ts';
import { deep } from '../../../packages/system-5e/src/rulesets/2024.ts';
import { linked } from '../node_modules/@grimoire/system-5e/src/index.ts';
import { own } from './system.ts';
import { named } from './system-lists.ts';
export const all = [rules, climb, deep, linked, own, named];
export type Both = Rules;
`;

/** The lines of `file` that lint refuses with the message starting `id`. */
function refused(file: string, source: string, id: string) {
  const { status, output } = run(
    'biome',
    ['lint', '--vcs-enabled=false', '--max-diagnostics=100', '--reporter=github', file],
    source,
    file,
  );
  const lines = linesOf(output, new RegExp(`line=(\\d+),[^\\n]*::${id}:`, 'g'));
  return { status, lines };
}

describe('ENG-31 the core cannot import a system module', () => {
  it('fails lint when the schema package imports a module, by name or by a climb', () => {
    const result = refused('packages/schema/src/Sample.ts', moduleImports, 'ENG-31');
    expect(result.status).toBe(1);
    // By name (1), as a type (2), a re-export from a path inside it (3), another module by a
    // dynamic import (4), a climb into its folder (5), a deeper climb (6), a path through
    // node_modules (7). Its own system.ts (8) and system-lists.ts (9) stay allowed.
    expect(result.lines).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('fails lint when the engine imports a module, and keeps the engine to ENG-01', () => {
    const file = 'packages/engine/src/Sample.ts';
    expect(refused(file, moduleImports, 'ENG-31').lines).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // A name not on the engine's list (1–4) and a path into node_modules (7) break ENG-01 too.
    expect(refused(file, moduleImports, 'ENG-01').lines).toEqual([1, 2, 3, 4, 7]);
  });
});
