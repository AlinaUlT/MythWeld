# ENG — The game-free core and the fifth-edition module

**Why this theme:** Every number the app shows comes from the engine, and a wrong rule gives a
wrong number with no error. This theme builds the schemas, formulas, dice, effects and the
`compute()` pipeline, with no UI: first the core, which knows no game and is tested on a made-up
system, then the fifth-edition module as its own package (ADR 004). The golden tests of SPEC §6.7
are its proof.
**SPEC:** stage 1, sections §4.1, §5, §6; ADR 004, ADR 005
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** every ENG row is ✅ or ❌, and the phase 1 gate named in `BACKLOG.md`
(SPEC §12 stage 1, widened by ADR 004 and ADR 005) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections above,
ADR 004.

---

### ENG-01 The engine stays pure · XS

**Hat:** CI fails if `engine` imports React, DOM, Dexie or the network
**Where:** `biome.json` — a new override for `packages/engine/src/**`;
`packages/engine/tsconfig.json` — changed; `packages/engine/test/tsconfig.json` and
`packages/engine/test/purity.test.ts` — new; `packages/engine/package.json` — the typecheck
script, and `@types/node` for the tests
**Depends on:** SETUP-03 (CI runs the gate), SETUP-05 (how a lint rule is tested)

**What it should look like when done:**
1. `pnpm lint` fails on any import in `packages/engine/src` other than the package's own files
   and `@grimoire/schema`. That covers `react`, `react-dom/client`, `dexie`, `node:http`, network
   libraries (`axios`, `ws`), `import type`, `export … from`, a dynamic `import()`, and a
   relative path into `apps/` or `node_modules/`. The message starts with `ENG-01`.
2. `pnpm lint` fails on these globals in `packages/engine/src`: `globalThis`, `self`, `window`,
   `document`, `navigator`, `location`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`,
   `XMLHttpRequest`, `WebSocket`, `EventSource`. The message starts with `ENG-01`.
3. `pnpm typecheck` checks `packages/engine/src` with `lib: ["ES2022"]` and `types: []`, so
   `document`, `window`, `process`, `fetch` and `localStorage` are errors there. The tests are
   checked by their own `test/tsconfig.json` with Node types, which never reach `src`.
4. A test proves items 1–3, and fails when any one guard is removed.
5. The quality gate is green. CI runs the same lint, typecheck and test (SETUP-03), so CI fails
   in each case of items 1–3.

**Tests:** `packages/engine/test/purity.test.ts` — `describe('ENG-01 engine purity')`, 4 tests.
Sample files are linted and type-checked in a temp folder holding copies of the real `biome.json`,
`biome/`, `tsconfig.base.json` and `packages/engine/tsconfig.json`, with the engine's
`node_modules` linked in. Control numbers: the line numbers of the forbidden lines in each sample,
written by hand.

**What came out of it:**

Before, measured with a sample file in `packages/engine/src`:
- `pnpm exec biome lint` on imports of `react`, `dexie`, `node:http`, `axios` and uses of
  `document`, `fetch`, `globalThis`: exit 0, `Checked 1 file`. No rule existed.
- `tsc` failed on them, but by accident: `Cannot find module 'react'`, because `react` was not
  installed for `engine`. With `react` linked into `packages/engine/node_modules`, the same
  import type-checked with exit 0. `(globalThis as { fetch?: unknown }).fetch` passed both.

After:
- Lint: `Checked 54 files`, 0 errors (52 files before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all `Done`.
- Test: `Test Files 7 passed (7)`, `Tests 22 passed (22)`, 1.12 s (before: 6 files, 18 tests).
  The new file alone: 4 passed, 742 ms.
- Build: `Done`.
- The test bites. Override removed from `biome.json`: 2 of its 4 tests fail. `"DOM"` added to
  the engine's `lib`: 1 fails. `"types": ["node"]` in the engine's config: 1 fails. The
  `apps/` and `node_modules/` patterns removed: 1 fails.

Differences from the row, and why:
- The import rule is an allow-list, not a list of forbidden names. "The network" has no end of
  libraries; an allow-list refuses every one. A new pure dependency (for example `zod`) is added
  to the list in `biome.json`, which the message says.
- A relative path is allowed, which let `../../../apps/web/src/db/db.ts` bring in Dexie: that
  import passed lint and typecheck. `**/apps/**` and `**/node_modules/**` after the allowed
  entries close it (Biome reads the list in order; the last match wins).
- Biome's pattern `*` matches one path segment, so it missed `@scope/pkg/sub` and
  `react-dom/client`. `**` is used.
- The engine's tests got their own tsconfig with `@types/node` 22.20.4, the version already in
  the lockfile. Before, `src` and `test` were one program; a test that needed Node would have
  given Node's global `fetch` to `src`. This ticket's test is the first that needs Node.
- `biome.json` does not accept comments (`biome check` fails on one), so the ENG-01 code comment
  is in `packages/engine/tsconfig.json`, and each lint message starts with `ENG-01`.
- `pnpm exec biome lint --stdin-file-path` was tried for the test and dropped: it reports
  `The contents aren't fixed` with exit 1 even for a clean file.

Found, not fixed:
- A relative path can still climb into a sibling package, for example
  `../../content/src/index.ts`. The rule cannot tell how deep a file sits, so it cannot tell a
  climb out of `packages/engine` from a path inside it. Today no sibling package holds React,
  DOM, Dexie or the network. The package boundary itself is ENG-31's: the note on its row in
  `BACKLOG.md` now says so.

Nothing for the changelog.
