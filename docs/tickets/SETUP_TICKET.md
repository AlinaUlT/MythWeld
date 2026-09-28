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

---

### SETUP-02 One unit test and one browser test

**Hat:** Vitest and Playwright (Pixel 7) each run one passing test
**Depends on:** SETUP-01
**Size:** S
**Screen:** No
**SPEC:** §4.2 (tests row), §12 stage 0

---

#### 1. Where the code lives

**Main file:** `vitest.config.ts` — new, at the root. The other files it touches:

- `package.json` — changes: `test` runs Vitest once; new `e2e` script.
- `apps/web/playwright.config.ts` — new: the Pixel 7 project and the preview server.
- `apps/web/e2e/smoke.spec.ts` — new: the one browser test.
- `packages/engine/test/smoke.test.ts` — new: the one unit test.
- `apps/web/package.json` — changes: `e2e` script.

#### 2. What is missing now

Measured on 2026-09-27, after SETUP-01:

```
$ pnpm test
Scope: 5 of 6 workspace projects        (runs nothing, exit 0)
$ pnpm e2e
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "e2e" not found
```

#### 3. What it should look like when done

1. `pnpm test` runs Vitest once over every workspace project and reports
   `1 passed (1)`, with the test named `SETUP-02 engine smoke`.
2. `pnpm e2e` builds the web app, serves it with `vite preview`, and runs Playwright with one
   project named `pixel-7`: `1 passed`.
3. The browser test opens `/` and checks the page title is `GrimoireMancer` (read from
   `APP_NAME`, not typed a second time).
4. The browser test saves a screenshot to `apps/web/test-results/` (git-ignored; not committed).
5. `pnpm lint && pnpm typecheck` stay green; the Playwright config and the tests are type-checked.

#### 4. How to do it

1. Root dev dependency `vitest`. Root `vitest.config.ts` with
   `test.projects: ['packages/*', 'apps/web']` and `include: ['**/test/**/*.test.ts']`, so
   every package can add tests under `test/` without more config. Root script
   `test: vitest run`.
2. `packages/engine/test/smoke.test.ts`: `describe('SETUP-02 engine smoke', …)` imports
   `@grimoire/engine` and checks the import resolves. It is the only test until phase 1.
3. `apps/web` dev dependency `@playwright/test`. `playwright.config.ts`:
   - one project `pixel-7` = `devices['Pixel 7']` (touch, mobile user agent, device pixel ratio);
   - `webServer`: `pnpm build && pnpm preview --port 4173 --strictPort`, `url` on that port;
   - `launchOptions.executablePath` from `PLAYWRIGHT_CHROMIUM_PATH` when it is set, so the cloud
     environment uses its preinstalled Chromium and nothing is downloaded.
4. `apps/web/e2e/smoke.spec.ts`: `test('SETUP-02 app opens', …)` → `page.goto('/')`,
   `expect(page).toHaveTitle(APP_NAME)`, `page.screenshot(...)`.
5. Scripts: `apps/web` `e2e: playwright test`; root `e2e: pnpm --filter @grimoire/web e2e`.
6. `.gitignore`: add `test-results`, `playwright-report`.
7. Run the gate including `pnpm e2e`.

**Viewport question for the checkpoint.** Playwright's Pixel 7 is 412×839 CSS pixels.
`docs/tickets/README.md` asks for screenshots at 360×800. The plan keeps the Pixel 7 device
(touch, user agent, pixel ratio) and overrides only the viewport to 360×800, so every screenshot
is the size the README asks for.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen. The page is still blank.

#### 7. Tests

- `packages/engine/test/smoke.test.ts` — the engine package can be imported.
- `apps/web/e2e/smoke.spec.ts` — the built app opens on a Pixel 7 profile; title is `APP_NAME`.
- Control numbers from: `APP_NAME` in `apps/web/src/config/app.ts`.

#### 8. Checked against the source

Nothing to check. The ticket holds no rules facts.

#### 9. Not in this ticket

- Coverage reporting and the 90 % `engine` threshold — ENG-23.
- The iPhone 14 project from SPEC §4.2 — not in the phase 0 rows; added when a screen needs it.
- Screenshot comparison against saved images — not planned; screenshots are shown in the chat.
- CI — SETUP-03.

#### 10. Rake check

- **`engine` is pure TypeScript:** Vitest is a root dev dependency, not an `engine` dependency;
  the smoke test imports only `@grimoire/engine`.
- **No telemetry:** Playwright and Vitest run locally; the test makes no external request.
- **Screenshots are not committed:** `test-results` is git-ignored.
- **No tool attribution; nothing invisible.**

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->

**Measured on 2026-09-27, after a clean `pnpm install --frozen-lockfile`:**

- `pnpm test`: `Test Files 1 passed (1)`, `Tests 1 passed (1)`, 185 ms.
- `pnpm e2e`: `1 passed (3.2s)` on project `pixel-7`; the build and preview server included.
- Screenshot `home.png`: 945×2100 pixels = 360×800 CSS pixels at the Pixel 7 pixel ratio 2.625.
  It is blank, as expected before SETUP-04. Not committed.
- Whole gate (`lint && typecheck && test && e2e`): 7.3 s.
- Versions: Vitest 5.0.2, `@playwright/test` 1.63.0, Chromium from `/opt/pw-browsers`.

**Differences from §4:**

- No Vitest `projects`: one root config with an `include` list
  (`packages/*/test/**/*.test.ts`, `apps/web/test/**/*.test.{ts,tsx}`). A projects glob would
  also have picked up the Playwright spec. Projects come back when `apps/web` needs a DOM
  environment for its tests.
- `vite.config.ts` imports `./src/config/app.ts` with the extension, because Vite 8 warned
  about the extensionless import. `tsconfig.base.json` got `allowImportingTsExtensions`.
- `apps/web` got `@types/node` 22 so the Playwright config type-checks.
- The environment variable is `PLAYWRIGHT_CHROMIUM_PATH`; without it Playwright uses its own
  browser. SETUP-09 writes this into `docs/RUNNING.md`.

**Found, not fixed:** nothing.

**Changelog:** nothing for the changelog; nothing a person sees changed.

---

### SETUP-03 CI on every push · XS

**Hat:** CI runs lint, typecheck, test and build on every push to `main`
**Where:** `.github/workflows/ci.yml` — new
**Depends on:** SETUP-02

**What it should look like when done:**
1. A push to `main` starts the workflow `CI` on GitHub Actions.
2. It runs, in order: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, `pnpm build`, with Node from `.nvmrc` and pnpm from `packageManager`.
3. The run for this ticket's own commit is green.

**Tests:** the workflow run for this commit on GitHub Actions — every step green, control numbers:
the same `1 passed (1)` that `pnpm test` gives locally.
**What came out of it:** The workflow has one job, `check`, on `ubuntu-latest`, with the five
steps of §3 item 2. Locally, before the push, the same commands gave: lint 26 files, 0 errors;
typecheck 5 of 5 projects; `Tests 1 passed (1)`; build in 362 ms. Item 3 can only be seen after
the push, because a push to `main` is what starts the run; its result is reported in the chat.
`pnpm e2e` is not in CI: the row names lint, typecheck, test and build only. Found, not fixed:
nothing. Nothing for the changelog.

---

### SETUP-04 The app shell

**Hat:** The app shell shows the bottom bar with four empty tabs
**Depends on:** SETUP-02, and SETUP-05 if the checkpoint accepts the order change below
**Size:** S
**Screen:** Yes — the shell: bottom bar and four empty tab pages
**SPEC:** §7.1, §7.2 (last bullet: dark theme, 44 px targets), §4.2 (styles, routing rows)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shell/AppShell.tsx` — new. The other files it touches:

- `apps/web/src/shell/tabs.ts` — new: the four tabs as data (route, icon, i18n key).
- `apps/web/src/pages/{Characters,Library,Dice,Settings}Page.tsx` — new, empty pages.
- `apps/web/src/App.tsx` — changes: the router.
- `apps/web/src/index.css` — new: Tailwind v4 and the theme colour tokens.
- `apps/web/src/lib/cn.ts`, `apps/web/components.json` — new: the shadcn/ui setup.
- `apps/web/vite.config.ts` — changes: the Tailwind plugin.
- `apps/web/e2e/shell.spec.ts` — new.

#### 2. What is missing now

Measured on 2026-09-27: `App` returns `null`; the SETUP-02 screenshot is a blank white
945×2100 page. There is no router, no CSS and no Tailwind.

#### 3. What it should look like when done

1. At 360×800 a bar is fixed to the bottom of the screen with four tabs, left to right:
   Characters · Library · Dice · Settings, each with a lucide icon above its label.
2. Each tab is at least 44 px tall and 44 px wide (SPEC §7.2).
3. `/` opens Characters. Tapping a tab changes the URL to `/characters`, `/library`, `/dice`,
   `/settings` and marks that tab as current (`aria-current="page"`).
4. Each page shows only its title (the same word as its tab). Nothing else yet.
5. The page is dark by default: the `<html>` element has the class `dark`.
6. `pnpm e2e`: the shell test taps all four tabs and passes; 4 screenshots at 360×800.

#### 4. How to do it

1. Add `tailwindcss` 4 with `@tailwindcss/vite`, `lucide-react`, `react-router` 7,
   `clsx`, `tailwind-merge`.
2. `index.css`: `@import "tailwindcss";`, colour tokens as CSS variables in the shadcn/ui
   form (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, …), dark values
   on `.dark`. `index.html` gets `class="dark"` on `<html>`.
3. shadcn/ui: `components.json` and `cn()` so components can be added later. **No component is
   added yet**: the bar needs none. The shadcn registry (`ui.shadcn.com`) is blocked from this
   cloud environment (`CONNECT tunnel failed, response 403`), so later components are copied
   in by hand from the shadcn source (MIT).
4. `tabs.ts`: `[{ path: '/characters', icon: Users, labelKey: 'nav.characters' }, …]`.
5. `AppShell`: `<main>` with `<Outlet/>`, then `<nav>` fixed to the bottom with `NavLink`s,
   padded for the phone's bottom safe area (`env(safe-area-inset-bottom)`).
6. Router: `createBrowserRouter` with the shell as layout, the four pages, `/` → redirect to
   `/characters`, unknown paths → Characters.
7. Tests: unit test that `tabs.ts` has four unique paths; e2e test taps each tab, checks the
   URL, the title and `aria-current`, and saves a screenshot.

**Order question for the checkpoint.** The tab labels are visible text. The rules forbid a
string literal in a component, but i18next comes one row later, in SETUP-05. Two ways:
- **A (recommended):** do SETUP-05 before SETUP-04. The labels are i18n keys from the start;
  nothing is written twice. SETUP-05's lint rule is tested on `App.tsx` and a test fixture.
- **B:** keep the order. SETUP-04 puts the labels in a temporary map; SETUP-05 moves them to
  i18next and deletes the map.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

The shell at 360×800, dark. Bottom bar with four tabs. English keys (SETUP-05 owns the file):

| Key | Text |
|---|---|
| `nav.characters` | Characters |
| `nav.library` | Library |
| `nav.dice` | Dice |
| `nav.settings` | Settings |

Each page title uses the same key. There is no loading, empty or error state yet: the pages
hold nothing.

#### 7. Tests

- `apps/web/test/tabs.test.ts` — four tabs, unique paths, every label key exists in `en`.
- `apps/web/e2e/shell.spec.ts` — taps all four tabs; URL, title and `aria-current` change.
- Control numbers from: SPEC §7.1 (the four tabs and their order), §7.2 (44 px).

#### 8. Checked against the source

Nothing to check. The ticket holds no rules facts.

#### 9. Not in this ticket

- The fifth tab "Game master" — later (SPEC §7.1).
- Light theme and the theme switch — the Settings screen, phase 2.
- Any content in the pages — phase 2 onwards.
- The app icon and install — SETUP-07.

#### 10. Rake check

- **No string literal in a component:** labels are i18n keys (order A) or one temporary map
  that SETUP-05 deletes (order B).
- **No WotC names or logos:** lucide icons only (`Users`, `BookOpen`, `Dices`, `Settings`).
- **No external requests:** no web fonts from a CDN; the system font stack.
- **No tool attribution; nothing invisible.**

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->

**Built in order A** (Alina, 2026-09-27): SETUP-05 came first, so the labels are i18n keys.

**Measured on 2026-09-27:**

- `pnpm lint`: `Checked 44 files`, 0 errors. `pnpm typecheck`: 5 of 5 projects `Done`.
- `pnpm test`: `Test Files 4 passed (4)`, `Tests 10 passed (10)`, 587 ms.
- `pnpm e2e`: `5 passed (10.5s)` on `pixel-7` (1 from SETUP-02, 4 new).
- The four tabs at 360x800: each 90x56 CSS pixels, top at y = 744, bottom at y = 800.
- Screenshots: `characters.png`, `library.png`, `dice.png`, `settings.png`, each 945x2100
  pixels = 360x800 CSS pixels. Shown in the chat; not committed.
- Build: JS 396.10 kB (125.66 kB gzip), up from 264.27 kB; CSS 7.01 kB (2.29 kB gzip).
  The difference is react-router, the four lucide icons and Tailwind.

**Versions:** tailwindcss 4.3.3, `@tailwindcss/vite` 4.3.3, react-router 7.18.4,
lucide-react 1.48.0, clsx 2.1.1, tailwind-merge 3.7.0.

**Differences from §1 and §4:**

- `src/pages/PageTitle.tsx` is new: the heading the four pages share.
- `biome.json` got `css.parser.tailwindDirectives: true`; without it Biome fails to parse
  `@theme`, `@custom-variant` and `@apply`.
- `index.html` got `viewport-fit=cover`, so `env(safe-area-inset-bottom)` has a value on a
  phone with a home bar.
- The current tab is marked by colour (`text-primary`) and `aria-current="page"`; the others
  use `text-muted-foreground`.
- `components.json` names the alias `@/…` the shadcn CLI expects. No `@` path alias exists in
  Vite or TypeScript yet; components copied in by hand use relative imports.
- The e2e test reads the expected labels from `locales/en/common.json`, not from typed text.

**Found, not fixed:** nothing.

**Changelog:** one line — the bottom bar with four tabs.

---

### SETUP-05 Visible text through i18next

**Hat:** Every visible string goes through an i18next key, enforced by lint
**Depends on:** SETUP-02
**Size:** S
**Screen:** No
**SPEC:** §9 (first bullet: locale files, no text in JSX), ADR 000 item 3 (`en` only)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/i18n/index.ts` — new: creates and initialises the i18next instance.
The other files it touches:

- `apps/web/src/locales/en/common.json` — new: the English strings of the `common` namespace.
- `apps/web/src/i18n/i18next.d.ts` — new: tells TypeScript which keys exist.
- `apps/web/src/main.tsx` — changes: imports `./i18n` before rendering.
- `apps/web/package.json` — changes: `i18next`, `react-i18next`.
- `apps/web/tsconfig.json` — changes: `resolveJsonModule`; `test` joins `include`.
- `biome.json` — changes: an override for `apps/web/src/**` that turns on `noJsxLiterals` and
  the plugin below.
- `biome/no-visible-literals.grit` — new: a Biome GritQL plugin.
- `apps/web/test/i18n.test.ts`, `apps/web/test/no-visible-literals.test.ts` — new.

#### 2. What is missing now

Measured on 2026-09-27, at `6691b3c`:

- No i18n: `grep -rl i18n apps packages` finds nothing; `apps/web/src` holds only `App.tsx`,
  `main.tsx`, `config/app.ts`.
- No rule: a probe file `apps/web/src/Probe.tsx` with `<p title="Tip">Hello</p>` passes
  `pnpm lint` (`Checked 27 files in 7ms. No fixes applied.`, exit 0).

#### 3. What it should look like when done

1. `apps/web/src/locales/en/common.json` holds 4 keys: `nav.characters` = `Characters`,
   `nav.library` = `Library`, `nav.dice` = `Dice`, `nav.settings` = `Settings` (the tab labels
   SETUP-04 §6 asks for). No `ru` folder (ADR 000).
2. The app initialises i18next once, before the first render, with language `en`, namespace
   `common`, and the strings bundled into the build (no network loading).
3. `i18n.t('nav.dice')` returns `Dice`. `t('nav.nope')` is a TypeScript error.
4. `pnpm lint` fails on each of these in `apps/web/src/**`:
   text between tags (`<p>Hello</p>`); a string or template in braces (`{'Hello'}`,
   `` {`Hello`} ``); a string in the attributes `title`, `alt`, `placeholder`, `label`,
   `aria-label`, `aria-description` (as `"…"` or `{'…'}`).
5. `pnpm lint` does not fail on: `{t('nav.dice')}`, `title={t('…')}`, `className="…"`, `href`,
   `src`, `type`, `data-*`, and `{' '}` (a space between elements).
6. `pnpm test`: the lint test runs Biome on a bad sample (expects exit 1 and 9 errors at the
   listed lines) and on a good sample (expects exit 0).
7. The screen does not change: `App` still renders nothing.

#### 4. How to do it

1. Add `i18next` 26 and `react-i18next` 17 to `apps/web`.
2. `locales/en/common.json` with the 4 keys of §3.1, nested (`{ "nav": { "dice": "Dice" } }`).
3. `i18n/index.ts`: `i18next.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en',
   supportedLngs: ['en'], ns: ['common'], defaultNS: 'common', resources: { en: { common } },
   interpolation: { escapeValue: false } })`, synchronous, and `export default i18next`.
4. `i18n/i18next.d.ts`: `CustomTypeOptions` with `defaultNS: 'common'` and
   `resources: { common: typeof common }`, so unknown keys fail `pnpm typecheck`.
5. `main.tsx`: `import './i18n';` above the `App` import.
6. The lint rule, in two parts (see "Differs from the row" below):
   - Biome's built-in `style/noJsxLiterals` with default options: text between tags.
   - `biome/no-visible-literals.grit`: a string or template literal as a JSX child, and a
     string in the six visible attributes of §3.4. Whitespace-only strings are allowed.
   - Both are switched on in a `biome.json` `overrides` entry for `apps/web/src/**` only.
7. `test/no-visible-literals.test.ts` (`describe('SETUP-05 no visible literals')`): copies
   `biome.json` and the plugin into a temporary folder, writes the bad and the good sample to
   `apps/web/src/Sample.tsx` inside it, runs the repository's `biome lint` there, and checks
   the exit code and the error lines. The samples are strings inside the test, so the real
   `pnpm lint` never sees a bad file.
8. `test/i18n.test.ts` (`describe('SETUP-05 i18n')`): language is `en`; the 4 keys give their
   English text; one `@ts-expect-error` line on an unknown key keeps the type check honest.
9. Run the gate, `pnpm e2e` included (the ticket touches `apps/web`).

**Differs from the row and SETUP-04, checked against the code:**

- The row says "a lint rule". Biome 2.5.14's `noJsxLiterals` alone catches only text between
  tags. Its `noStrings` option would also catch `{'…'}` and attributes, but measured on a
  sample it also flags the key inside `t('nav.dice')` and every `className`, so it cannot be
  used. The GritQL plugin covers the rest. It was tried on a sample: 9 of 9 bad spots found,
  0 false hits.
- SETUP-04 §4 says the rule is "tested on `App.tsx`". `App.tsx` has no JSX (`return null`), so
  the test uses the two samples instead. `App.tsx` is still linted like every file.
- Biome cannot lint text piped in (`--stdin-file-path` exits 1 even on a clean file, and
  prints no errors), hence the temporary folder in step 7.
- SPEC §9 names four namespaces and `ru`. Only `en/common.json` is created: ADR 000 keeps `ru`
  for later, and `sheet`, `library`, `editor` come with their screens.

#### 5. Stored data

Nothing stored changes. The language is not saved yet; there is only one.

#### 6. What a person will see

Not a screen. The keys of §3.1 are shown by SETUP-04.

#### 7. Tests

- `apps/web/test/i18n.test.ts` — i18next is `en`; the 4 keys return their English text.
- `apps/web/test/no-visible-literals.test.ts` — bad sample: exit 1, 9 errors at the expected
  lines; good sample: exit 0.
- Control numbers from: the key table in SETUP-04 §6; the samples' line numbers, counted in the
  test source.

#### 8. Checked against the source

Nothing to check. The ticket holds no rules facts.

#### 9. Not in this ticket

- The tab bar that uses the `nav.*` keys — SETUP-04.
- The Russian locale, the glossary check and the language switch — the Russian phase (ADR 000).
- Ruleset-dependent terms through i18next context (`term.species_2014`, SPEC §9) — the first
  ticket that shows such a term.
- The `sheet`, `library`, `editor` namespaces — the phases that build those screens.
- Strings passed to our own components under other prop names (for example `heading="…"`) — not
  caught; the six attribute names are extended when such a component appears.

#### 10. Rake check

- **No user-facing string literal in a component:** this ticket builds the rule itself.
- **No external requests:** the strings are bundled; no `i18next-http-backend`, no language
  detector that reads anything but the build.
- **`engine` is pure TypeScript:** i18next is added to `apps/web` only.
- **No tool attribution; nothing invisible:** the JSON and the plugin are plain ASCII.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->

**Order change (Alina, 2026-09-27):** SETUP-05 is built before SETUP-04 (option A in SETUP-04 §4),
so the tab labels are i18n keys from the start. SETUP-04 stays 🚧 and is built next.

**Measured on 2026-09-27:**

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 7.4 s.
- `pnpm lint`: `Checked 32 files`, 0 errors. `pnpm typecheck`: 5 of 5 projects `Done`.
- `pnpm test`: `Test Files 3 passed (3)`, `Tests 6 passed (6)`, 323 ms.
- `pnpm e2e`: `1 passed (3.3s)` on `pixel-7`. The screen is unchanged (still blank).
- The real `pnpm lint` on a probe `<p title="Tip">Hello</p>` in `apps/web/src`: 2 errors
  (`plugin` at 2:19, `lint/style/noJsxLiterals` at 2:25). The probe was deleted.
- The `@ts-expect-error` line is live: pointed at `nav.dice`, `tsc` failed with TS2578.
- Build: JS bundle 264.27 kB (82.64 kB gzip), up from 219.65 kB in SETUP-01; the difference is
  i18next and react-i18next.

**Versions:** i18next 26.4.2, react-i18next 17.0.15.

**Differences from §3 and §4:**

- The bad sample puts `Hello` inside `<p>` on its own line: `noJsxLiterals` reports a text
  node from where it starts, and bare text after a tag starts on the tag's line.
- Biome formats `.grit` files too; the plugin is kept in Biome's format.
- `pnpm e2e` needs `PLAYWRIGHT_CHROMIUM_PATH` in the cloud container
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`); without it Playwright looks for a
  browser build that is not installed. Same as SETUP-02 §11; SETUP-09 writes it down.

**Found, not fixed:** strings passed to our own components under other prop names are not
caught (§9).

**Changelog:** nothing for the changelog; nothing a person sees changed.

---

### SETUP-06 The database and persistent storage · XS

**Hat:** Dexie opens its database and asks for persistent storage
**Where:** `apps/web/src/db/` — `db.ts` (the database) and `persist.ts` (the request), both
started from `apps/web/src/main.tsx`
**Depends on:** SETUP-02

**What it should look like when done:**
1. After the app opens, the browser holds an IndexedDB database named `grimoire`, at Dexie
   version 1 (IndexedDB version 10), with no tables.
2. On every start the app calls `navigator.storage.persisted()`. If the answer is `false`, it
   calls `navigator.storage.persist()` once. If it is `true`, it asks nothing more.
3. `requestPersistentStorage()` returns `granted`, `denied` or `unsupported` (no Storage API).
4. Neither step holds up the first render. A failure is logged to the console; nothing breaks.
5. `dexie` is a dependency of `apps/web` only. The screen does not change.

It stays XS: no table and no record is stored (no §5), the screen does not change (no §6), and
there are no rules facts (no §8).

**Tests:** `apps/web/test/storage.test.ts` — the name `grimoire`, version 1, no tables; the four
answers of `requestPersistentStorage()` with a fake Storage API and with none.
`apps/web/e2e/storage.spec.ts` — in Chromium, the database appears and the app calls `persisted`
then `persist`. Control numbers: SPEC §11 (the `persist()` call); Dexie's "version 1 = IndexedDB
version 10", measured in Chromium.

**What came out of it:**

Measured on 2026-09-28:

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 10.6 s.
- `pnpm lint`: `Checked 48 files`, 0 errors. `pnpm typecheck`: 5 of 5 projects `Done`.
- `pnpm test`: `Test Files 5 passed (5)`, `Tests 15 passed (15)` (5 new).
- `pnpm e2e`: `6 passed` on `pixel-7` (1 new).
- In headless Chromium after the app opens: `indexedDB.databases()` gives
  `[{ name: 'grimoire', version: 10 }]`; `navigator.storage.persisted()` gives `false`, so the
  app goes on to call `persist()`. The e2e test records the calls instead of expecting a yes.
- The e2e test is live: with the `db.open()` call removed it failed (`Received array: []`); with
  only the `persist` call removed it failed (`Received: Array []`).
- Build: JS 491.88 kB (156.88 kB gzip), up from 396.10 kB (125.66 kB gzip): +95.78 kB
  (+31.22 kB gzip), all of it Dexie. CSS 7.01 → 7.03 kB: Tailwind reads the word "table" in a
  code comment as a class name.

**Versions:** dexie 4.4.6.

**Differences from SPEC §11:**

- SPEC §11 lists seven tables. Version 1 declares none. Each table comes as a new version with
  the ticket that first stores into it, once its record shape exists (ENG-05, ENG-06). Reason:
  Dexie cannot change a table's primary key later; in Dexie 4.4.6 such an upgrade throws
  `Not yet support for changing primary key` (`dexie.mjs`, line 3827).
- SPEC §11 says to ask at the first start. The app asks at every start until the answer is yes,
  because Chrome decides by itself and says yes more readily once the app is installed
  (SETUP-07). Only Chromium was measured; what other browsers show when asked was not.

**Not in this ticket:** the seven tables and `dexie-react-hooks` (the phase 2 tickets that store
data); a screen that shows whether storage is persistent, or that the database failed to open
(phase 2, Settings).

**Found, not fixed:** nothing.

**Changelog:** nothing for the changelog; nothing a person sees changed.
