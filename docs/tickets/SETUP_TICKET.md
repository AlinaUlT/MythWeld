# SETUP — The scaffold

**Why this theme:** Nothing can be built, tested or shown until the repository has a workspace,
a build, a linter, tests, CI, an installable offline app and a public link. This theme lays that
ground once, so every later ticket only adds code and runs the same quality gate.
**SPEC:** stage 0, sections §2 (D1, D5), §4
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** every SETUP row is ✅ or ❌, and the stage 0 "Готово, когда" list in
SPEC §12 is proved, with the English-only screenshot from ADR 000.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections above.

---

### SETUP-01 An empty pnpm monorepo

**Hat:** An empty pnpm monorepo with the six packages builds and lints
**Depends on:** Nothing
**Size:** S
**Screen:** No
**SPEC:** §4.1, §4.2 (build, UI, quality rows), D1, D2

---

#### 1. Where the code lives

**Main file:** `pnpm-workspace.yaml` — new. The other files it touches:

- `package.json` — new: the root scripts `lint`, `format`, `typecheck`, `test`, `build`.
- `tsconfig.base.json` — new: the strict compiler options every package extends.
- `biome.json` — new: lint and format rules.
- `.gitignore`, `.nvmrc` — new.
- `apps/web/` — new: Vite + React 19 + TypeScript; `src/config/app.ts` holds `APP_NAME`.
- `packages/schema/`, `packages/engine/`, `packages/content/`, `packages/pdf/` — new, each with
  `package.json`, `tsconfig.json` and an empty `src/index.ts`.

"The six packages" in the hat is `apps/web` plus the four packages above plus the workspace
root. `packages/foundry` is not created (BACKLOG note: phase L1).

#### 2. What is missing now

The repository holds only documents. Measured on 2026-09-27:

```
$ pnpm lint
 ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND  No package.json (or package.yaml, or package.json5) was found in "/home/user/MythWeld".
```

There is no `package.json`, no workspace, no TypeScript config and no linter.

#### 3. What it should look like when done

1. `pnpm install` finishes with no errors and writes `pnpm-lock.yaml`.
2. `pnpm -r ls --depth -1` lists 5 workspace projects: `@grimoire/web`, `@grimoire/schema`,
   `@grimoire/engine`, `@grimoire/content`, `@grimoire/pdf` (plus the private root).
3. `pnpm lint` (Biome) exits 0 with 0 errors and 0 warnings.
4. `pnpm typecheck` exits 0; every project compiles under `strict: true`.
5. `pnpm test` exits 0. It runs no tests yet; the test runner is SETUP-02.
6. `pnpm build` exits 0 and writes `apps/web/dist/index.html`, whose `<title>` is
   `GrimoireMancer`.
7. `packages/engine/package.json` has no dependency except `@grimoire/schema`.
8. The app name is written in exactly one place: `apps/web/src/config/app.ts`
   (`APP_NAME = 'GrimoireMancer'`, `APP_SHORT_NAME = 'GM'`).
   `grep -r GrimoireMancer apps packages --include=*.ts*` finds that one line.

#### 4. How to do it

1. Root `package.json`: `"private": true`, `"type": "module"`,
   `"packageManager": "pnpm@10.33.0"`, `"engines": { "node": ">=22" }`. Scripts:
   - `lint`: `biome check .`
   - `format`: `biome check --write .`
   - `typecheck`: `pnpm -r --if-present typecheck`
   - `test`: `pnpm -r --if-present test`
   - `build`: `pnpm -r --if-present build`
2. `pnpm-workspace.yaml`: `packages: ['apps/*', 'packages/*']`.
3. `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
   `verbatimModuleSyntax`, `isolatedModules`, `module: ESNext`, `moduleResolution: bundler`,
   `target: ES2022`, `noEmit: true`, `skipLibCheck: true`.
4. Each of `schema`, `engine`, `content`, `pdf`: `package.json` with
   `"name": "@grimoire/<name>"`, `"private": true`, `"type": "module"`,
   `"exports": { ".": "./src/index.ts" }` (packages are used as TypeScript source; no separate
   build step), script `typecheck: tsc -p tsconfig.json`; `src/index.ts` with `export {};` and
   one comment naming the package's job.
5. Workspace dependencies follow `schema ← engine ← pdf ← apps/web`:
   `engine` → `schema`; `content` → `schema`; `pdf` → `schema`, `engine`;
   `web` → all four.
6. `apps/web`: `index.html` with `<title>%APP_NAME%</title>` and `<div id="root">`;
   `src/main.tsx` mounts `<App />`; `App` renders nothing yet (`return null`), so no visible
   string exists before SETUP-05; `src/config/app.ts` exports `APP_NAME`;
   `vite.config.ts` uses `@vitejs/plugin-react` and a small `transformIndexHtml` step that
   replaces `%APP_NAME%` with `APP_NAME`. Scripts: `dev`, `build` (`vite build`), `preview`,
   `typecheck`.
7. `biome.json`: recommended lint rules, formatter with 2 spaces and line width 100, uses
   `.gitignore`, ignores `dist` and `pnpm-lock.yaml`.
8. `.gitignore`: `node_modules`, `dist`, `coverage`, `*.log`, `.DS_Store`. `.nvmrc`: `22`.
9. Run the gate, then `pnpm build`.

Versions are the current stable releases on the registry at build time; §11 records them.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen. The built page is blank; the bottom bar is SETUP-04.

#### 7. Tests

- No test files. The test runner does not exist until SETUP-02.
- Control numbers from: the command outputs in §3, measured when the ticket is built.

#### 8. Checked against the source

Nothing to check. The ticket holds no rules facts.

#### 9. Not in this ticket

- Vitest and Playwright — SETUP-02. Until then `pnpm e2e` does not exist, so the gate for this
  ticket is `lint`, `typecheck`, `test` (runs nothing) and `build`.
- CI — SETUP-03.
- Tailwind, shadcn/ui, the tabs — SETUP-04.
- i18next and the lint rule against string literals in JSX — SETUP-05.
- The CI check that `engine` imports no React, DOM, Dexie or network — ENG-01. This ticket only
  keeps `engine`'s dependency list empty except `@grimoire/schema`.
- `packages/foundry` — phase L1.

#### 10. Rake check

- **`engine` is pure TypeScript:** its `package.json` lists only `@grimoire/schema`; no React,
  no DOM types in its `tsconfig.json` (`lib: ["ES2022"]`).
- **No WotC names:** `APP_NAME` is `GrimoireMancer`; no "D&D" anywhere in the scaffold.
- **No telemetry:** no analytics package; Vite sends nothing at runtime.
- **No tool attribution:** the commit has no attribution lines; no file names the assistant.
- **Nothing invisible:** new files are plain ASCII.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->

**Measured on 2026-09-27, after a clean `pnpm install --frozen-lockfile`:**

- `pnpm -r ls --depth -1`: 5 projects — `@grimoire/web`, `schema`, `engine`, `content`, `pdf`.
- `pnpm lint`: `Checked 22 files in 8ms. No fixes applied.` 0 errors, 0 warnings.
- `pnpm typecheck`: 5 of 5 projects `Done`. A planted type error in `engine` made `tsc` exit 1,
  so the check is live.
- `pnpm test`: exit 0, 0 tests (the runner is SETUP-02).
- Whole gate (`lint && typecheck && test`): 2.2 s.
- `pnpm build`: built in 342 ms; `dist/index.html` has `<title>GrimoireMancer</title>`;
  the JS bundle is 219.65 kB (68.60 kB gzip), all of it React.
- `packages/engine` depends only on `@grimoire/schema`; its `lib` is `ES2022`, no DOM.

**Versions installed:** pnpm 10.33.0, Node 22.22.2, TypeScript 7.0.2, Biome 2.5.14, Vite 8.3.1,
`@vitejs/plugin-react` 6.1.1, React 19.3.0.

**Differences from §3:**

- Alina chose the short name `GM`, so `APP_SHORT_NAME` sits next to `APP_NAME`. It is not used
  yet; the PWA manifest (SETUP-07) will read it.
- `pnpm e2e` does not exist yet (SETUP-02), so this ticket's gate had no e2e step.

**Decisions taken at this checkpoint (Alina, 2026-09-27):**

- Work goes to `main`, as `CLAUDE.md` says.
- The four translation labels of SPEC §5.2 are used — noted on ENG-02 in `BACKLOG.md`.
- Golden A's subrace is checked against the sources in ENG-09 §8 — noted on ENG-09 in
  `BACKLOG.md`.

**Found, not fixed:** nothing.

**Changelog:** nothing for the changelog; a person sees a blank page.
