import { defineConfig } from 'vitest/config';

// SETUP-02: Vitest covers every workspace project. Tests live in each project's test/.
// ENG-23: the phase 1 gate runs in `pnpm test`, in two passes. `unit` is every test, with the
// coverage SPEC §6.6 asks of the engine and the fifth-edition module. `speed` times `compute()`
// after it, alone and without coverage, whose counters slow the code they count.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/test/**/*.test.ts', 'apps/web/test/**/*.test.{ts,tsx}'],
        },
      },
      { test: { name: 'speed', include: ['packages/*/test/**/*.speed.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/engine/src/**', 'packages/system-5e/src/**'],
      reporter: ['text-summary'],
      // At least 90 % of the lines of each package, counted on its own.
      thresholds: {
        'packages/engine/src/**': { lines: 90 },
        'packages/system-5e/src/**': { lines: 90 },
      },
    },
  },
});
