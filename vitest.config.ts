import { defineConfig } from 'vitest/config';

// SETUP-02: one Vitest run covers every workspace project. Tests live in each project's test/.
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/web/test/**/*.test.{ts,tsx}'],
  },
});
