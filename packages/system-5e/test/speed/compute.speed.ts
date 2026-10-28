import { compute, loadContentIndex } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  fifthEditionModule,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../../src/index.ts';
import { opened } from '../golden/checks.ts';
import { srd2024 } from '../golden/index.ts';
import { LOAD_FEATURES, levelTwenty, loadFeatures, speedLoad } from './level-twenty.ts';

// ENG-23: SPEC §6.6, "no longer than 10 ms for a level-20 character with multiclassing on an
// average phone (a Vitest benchmark with the CPU slowed ×4)". Node has no CPU throttle; a CPU four
// times slower takes four times as long, so the measured time × 4 stands for the phone's. `pnpm
// test` runs this file in a pass of its own, alone and without coverage (`vitest.config.ts`).
// OPS-28: the clock is the process's CPU time, so time the machine gives other processes is not
// counted; and the verdict is the lowest median of several batches, because load only ever adds
// time. On a loaded container the plain median of 500 runs, × 4, gave 6.53 to 11.20 ms on one
// commit (ENG-66).

/** SPEC §6.6's budget and slowdown. */
const BUDGET_MS = 10;
const SLOWDOWN = 4;

/** The character's classes, by key. */
const CLASSES = ['fighter', 'wizard', 'paladin'];

/** Runs left out while V8 compiles the code, then batches of runs measured. */
const WARM_UP = 200;
const BATCHES = 10;
const RUNS = 100;

/** The CPU time this process has used, in ms. */
function cpuMs(): number {
  const { user, system } = process.cpuUsage();
  return (user + system) / 1000;
}

/** The middle of a list of times. */
function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

describe('ENG-23 compute() on a phone', () => {
  const packs = [srd2024, speedLoad].map((file) => opened(openFifthEditionPack(file)));
  const loaded = loadContentIndex(FIFTH_EDITION_SYSTEM, packs);
  const character = opened(openFifthEditionCharacter(levelTwenty));
  const run = () => compute(character, loaded.index, fifthEditionModule);

  it('the character is level 20 in three classes, with every load feature and no warning', () => {
    expect(loaded.warnings).toEqual([]);
    expect(loaded.loaded).toEqual(['srd-2024', 'speed-load']);
    const result = run();
    expect(result.warnings).toEqual([]);
    const levels = ['level', 'prof', ...CLASSES.map((key) => `classes.${key}.level`)];
    expect(Object.fromEntries(levels.map((path) => [path, result.values[path]]))).toEqual({
      level: 20,
      prof: 6,
      'classes.fighter.level': 10,
      'classes.wizard.level': 5,
      'classes.paladin.level': 5,
    });
    const had = new Set(result.entities.map(({ entity }) => entity.id));
    const features = loadFeatures.filter(({ id }) => had.has(id));
    expect(features).toHaveLength(LOAD_FEATURES);
  });

  it(`its lowest batch median compute() × ${SLOWDOWN} is at most ${BUDGET_MS} ms`, () => {
    for (let at = 0; at < WARM_UP; at += 1) run();
    const medians: number[] = [];
    for (let batch = 0; batch < BATCHES; batch += 1) {
      const times: number[] = [];
      for (let at = 0; at < RUNS; at += 1) {
        const start = cpuMs();
        run();
        times.push(cpuMs() - start);
      }
      medians.push(median(times));
    }
    const lowest = Math.min(...medians);
    const phone = lowest * SLOWDOWN;
    console.info(
      `compute(), level 20: lowest of ${BATCHES} medians of ${RUNS} runs ${lowest.toFixed(2)} ms ` +
        `× ${SLOWDOWN} = ${phone.toFixed(2)} ms (budget ${BUDGET_MS} ms); ` +
        `highest × ${SLOWDOWN} = ${(Math.max(...medians) * SLOWDOWN).toFixed(2)} ms`,
    );
    expect(phone).toBeLessThanOrEqual(BUDGET_MS);
  });
});
