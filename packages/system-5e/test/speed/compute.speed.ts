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

/** SPEC §6.6's budget and slowdown. */
const BUDGET_MS = 10;
const SLOWDOWN = 4;

/** The character's classes, by key. */
const CLASSES = ['fighter', 'wizard', 'paladin'];

/** Runs left out while V8 compiles the code, then runs measured. */
const WARM_UP = 200;
const RUNS = 500;

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

  it(`its median compute() × ${SLOWDOWN} is at most ${BUDGET_MS} ms`, () => {
    for (let at = 0; at < WARM_UP; at += 1) run();
    const times: number[] = [];
    for (let at = 0; at < RUNS; at += 1) {
      const start = performance.now();
      run();
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const median = times[RUNS / 2] ?? Number.NaN;
    const slowest = times[RUNS - 1] ?? Number.NaN;
    const phone = median * SLOWDOWN;
    console.info(
      `compute(), level 20: median ${median.toFixed(2)} ms × ${SLOWDOWN} = ${phone.toFixed(2)} ms ` +
        `(budget ${BUDGET_MS} ms); slowest of ${RUNS} ${slowest.toFixed(2)} ms`,
    );
    expect(phone).toBeLessThanOrEqual(BUDGET_MS);
  });
});
